import React, { useEffect, useMemo, useRef, useState } from "react";
import { rLine, rPath } from "../lib/rough";
import { shade, shadeStroke, ballRadius } from "../lib/scaleMath";
import { GEO, createScaleSim } from "../lib/scalePhysics";

// A classic balance: wide beam pivoting on a pole, long chain triangles, and
// hanging cradle bowls. All geometry comes from GEO so the SVG and the
// physics bodies are the same shapes — what you see is the hard barrier the
// balls actually collide with.
const { VW, VH, CX, CY, L, CHAIN_H, PW, POLE_BTM, BASE_HALF, BOWL_R, SPAWN_Y } = GEO;
const DK = "#2b2b2b"; // ink color
const STEP_FALLBACK = 1000 / 60; // dt for the very first frame

const paint = (ds, sw, keyPrefix) =>
  ds.map((d, i) => (
    <path
      key={keyPrefix + i}
      d={d}
      fill="none"
      stroke={DK}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ));

// Rough strokes are deterministic (seeded), so generate once at module load.
const STRUCT_PATHS = [
  ...rLine(CX, CY, CX, POLE_BTM, 21, 4),
  ...rLine(CX - BASE_HALF, POLE_BTM, CX + BASE_HALF, POLE_BTM, 22, 4),
];
const BEAM_PATHS = rLine(-L, 0, L, 0, 31, 4.5);

// Hanging pan, in pan-local coords: origin = rim centre, so the beam hook is
// at (0, -CHAIN_H). The two chains end EXACTLY on the rim corners (±PW, 0) —
// the same points the back-rim arc and the cradle bowl arc start from.
const panPaths = (seed) => [
  ...rLine(0, -CHAIN_H, -PW, 0, seed, 2.5),
  ...rLine(0, -CHAIN_H, PW, 0, seed + 1, 2.5),
  ...rPath(`M ${-PW} 0 Q 0 16 ${PW} 0`, seed + 2, 2.5),
  ...rPath(`M ${-PW} 0 A ${BOWL_R} ${BOWL_R} 0 1 0 ${PW} 0`, seed + 3, 3),
];
const PAN_PRO_PATHS = panPaths(40);
const PAN_CON_PATHS = panPaths(60);

// Scatter directions for the unsend-style poof: a loose ring with a slight
// upward bias, like the bubble bursting into mist.
const POP_DIRS = Array.from({ length: 7 }, (_, i) => {
  const a = ((i * 51 - 100) * Math.PI) / 180;
  return { x: Math.cos(a), y: Math.sin(a) - 0.25 };
});

function Scale({ pros, cons, onLanded, markedId, editingId, popping, hideWeights }) {
  // what has physically touched down — drives the pivot badge
  const [landed, setLanded] = useState({ net: 0, count: 0 });

  const simRef = useRef(null);
  const ballEls = useRef(new Map()); // reason id → wrapper <g> element
  const coreEls = useRef(new Map()); // reason id → the ball's <circle> (loop sets r)
  const beamRef = useRef(null);
  const panProRef = useRef(null);
  const panConRef = useRef(null);

  const reasons = useMemo(() => [...pros, ...cons], [pros, cons]);
  const reasonsRef = useRef(reasons);
  reasonsRef.current = reasons;
  const onLandedRef = useRef(onLanded);
  onLandedRef.current = onLanded;

  useEffect(() => {
    const sim = createScaleSim();
    simRef.current = sim;
    sim.onLanded((info) => {
      setLanded(info);
      if (onLandedRef.current) onLandedRef.current(info);
    });
    sim.syncReasons(reasonsRef.current);

    // Headless environments (jsdom) just render the static frame.
    if (typeof window === "undefined" || !window.requestAnimationFrame) {
      return () => {
        sim.destroy();
        simRef.current = null;
      };
    }

    let raf = 0;
    let last = 0;
    const frame = (t) => {
      sim.step(last ? t - last : STEP_FALLBACK);
      last = t;
      const s = sim.snapshot();
      if (beamRef.current) {
        beamRef.current.setAttribute(
          "transform",
          `translate(${CX} ${CY}) rotate(${s.beamDeg})`
        );
      }
      if (panProRef.current) {
        panProRef.current.setAttribute("transform", `translate(${s.pro.x} ${s.pro.y})`);
      }
      if (panConRef.current) {
        panConRef.current.setAttribute("transform", `translate(${s.con.x} ${s.con.y})`);
      }
      const present = new Set();
      for (const b of s.balls) {
        present.add(b.id);
        const el = ballEls.current.get(b.id);
        if (el) {
          el.setAttribute("transform", `translate(${b.x} ${b.y})`);
          // reveal only now — the loop is the single source of ball paint, so
          // a ball can never flash up at a stale position before its first
          // physics frame; it always enters already falling, from the top
          el.setAttribute("visibility", "visible");
        }
        // the drawn radius follows the physics radius (1px ink inset) — during
        // a weight-edit morph this is what makes the ball visibly grow/shrink
        const core = coreEls.current.get(b.id);
        if (core) core.setAttribute("r", Math.max(0.75, b.r - 1));
      }
      // balls with no body (still queued, or spilled off the page) stay hidden
      for (const [id, el] of ballEls.current) {
        if (!present.has(id)) el.setAttribute("visibility", "hidden");
      }
      raf = window.requestAnimationFrame(frame);
    };
    raf = window.requestAnimationFrame(frame);

    return () => {
      window.cancelAnimationFrame(raf);
      sim.destroy();
      simRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (simRef.current) simRef.current.syncReasons(reasons);
  }, [reasons]);

  // Each ball = a wrapper <g> the rAF loop moves (and reveals), plus inner
  // shapes that own looks + CSS effects. Splitting them means the pop/marked
  // animations can transform the circle without ever fighting the physics
  // transform on the wrapper. Balls render hidden AND parked at the spawn
  // point until the sim owns them — so no render/remount path can ever flash
  // a ball anywhere but the top of the page. The live circle carries NO r in
  // JSX: the loop owns the radius (drawn 1px inside the physics circle so the
  // 2px stroke stays within it — resting balls touch, ink never overlaps),
  // which is also what animates a weight-edit morph without React snapping it.
  // Fill/stroke DO come from JSX (the new weight's shade) — index.css
  // transitions them so a morphing ball re-inks as smoothly as it grows.
  //
  // A popping ball bursts iMessage-unsend style: the bubble puffs up a hair,
  // collapses, and a ring of little droplets scatters outward and dissolves.
  const ballsLayer = useMemo(
    () => (
      <g>
        {reasons.map((r) => {
          const rad = ballRadius(r.weight) - 1;
          const fill = shade(r.side, r.weight);
          const stroke = shadeStroke(r.side, r.weight);
          return (
            <g
              key={r.id}
              visibility="hidden"
              transform={`translate(${CX} ${SPAWN_Y})`}
              ref={(el) => {
                if (el) ballEls.current.set(r.id, el);
                else ballEls.current.delete(r.id);
              }}
            >
              {popping.includes(r.id) ? (
                <g>
                  <circle className="pop-core" r={rad} fill={fill} stroke={stroke} strokeWidth={2} />
                  {POP_DIRS.map((d, i) => (
                    <circle
                      key={i}
                      className="pop-particle"
                      cx={d.x * rad * 0.5}
                      cy={d.y * rad * 0.5}
                      r={Math.max(2.5, rad * (i % 2 ? 0.16 : 0.24))}
                      fill={fill}
                      style={{
                        "--px": `${d.x * rad * 2.4}px`,
                        "--py": `${d.y * rad * 2.4 - rad * 0.6}px`,
                      }}
                    />
                  ))}
                </g>
              ) : (
                <circle
                  ref={(el) => {
                    if (el) coreEls.current.set(r.id, el);
                    else coreEls.current.delete(r.id);
                  }}
                  className={
                    "ball-core" +
                    (markedId === r.id
                      ? " ball-marked"
                      : editingId === r.id
                      ? " ball-editing"
                      : "")
                  }
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={2}
                  style={{ "--glow": stroke }}
                />
              )}
            </g>
          );
        })}
      </g>
    ),
    [reasons, markedId, editingId, popping]
  );

  const mag = Math.abs(landed.net);
  // weights hidden → every landed ball carries a flat 5, so the badge shows
  // the plain headcount difference instead of the weight-ledger net
  const shownMag = hideWeights ? Math.round(mag / 5) : mag;
  const pivotColor =
    landed.net === 0 ? "#9a9a9a" : shade(landed.net > 0 ? "pro" : "con", shownMag);

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      preserveAspectRatio="xMidYMid meet"
      // overflow visible: falling balls are drawn above the viewBox, so they
      // appear to drop in from the top of the page
      style={{ width: "100%", height: "100%", overflow: "visible" }}
    >
      {/* structural pole + base */}
      <g>{paint(STRUCT_PATHS, 4, "st")}</g>

      {/* physics balls — BEHIND the cradles, so the bowls' ink always draws
          over them: balls read as sitting inside the pan, never on top of it */}
      {ballsLayer}

      {/* hanging pans (translated every frame by the physics loop) */}
      <g ref={panProRef} transform={`translate(${CX - L} ${CY + CHAIN_H})`}>
        {paint(PAN_PRO_PATHS, 3, "pp")}
      </g>
      <g ref={panConRef} transform={`translate(${CX + L} ${CY + CHAIN_H})`}>
        {paint(PAN_CON_PATHS, 3, "pc")}
      </g>

      {/* tilting beam */}
      <g ref={beamRef} transform={`translate(${CX} ${CY})`}>
        {paint(BEAM_PATHS, 4.5, "bm")}
      </g>

      {/* pivot badge with the landed net magnitude */}
      <g>
        <circle cx={CX} cy={CY} r={26} fill={pivotColor} stroke={DK} strokeWidth={2.5} />
        <text
          x={CX}
          y={CY + 8}
          textAnchor="middle"
          fontFamily="Kalam, Caveat, cursive"
          fontWeight={700}
          fontSize={26}
          fill="#fff"
        >
          {shownMag}
        </text>
      </g>
    </svg>
  );
}

// memo: the scale only re-renders when the reasons actually change,
// not on every drag pointermove.
export default React.memo(Scale);
