import React, { useEffect, useRef, useState } from "react";
import { rLine, rPath } from "../lib/rough";
import { shade, shadeStroke } from "../lib/scaleMath";
import { createTrashSim, TRASH_GEO } from "../lib/trashPhysics";

const DK = "#2b2b2b";
const STEP_FALLBACK = 1000 / 60;

const paint = (ds, sw, keyPrefix) =>
  ds.map((d, i) => (
    <path
      key={keyPrefix + i}
      className="trash-ink"
      d={d}
      fill="none"
      stroke={DK}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ));

// Sketchy strokes are seeded/deterministic — generate once at module load.
const BODY_PATHS = [
  ...rPath("M12 28 L18 82 Q18 86 22 86 L52 86 Q56 86 56 82 L62 28", 2, 3),
  ...rLine(24, 38, 26, 74, 7, 2.5),
  ...rLine(37, 38, 37, 74, 8, 2.5),
  ...rLine(50, 38, 48, 74, 9, 2.5),
];
const LID_PATHS = [
  ...rLine(6, 26, 68, 26, 4, 3),
  ...rPath("M30 26 L32 17 L44 17 L46 26", 5, 3),
];

// Hand-drawn trash can, now an archive. While a reason hovers over it (or has
// just dropped in) the lid swings UP, hinged at its left corner, and the whole
// can leans in slightly. Stashed reasons live inside as tiny weightless balls
// — green pros, red cons — piling up under a pocket physics sim; a hand-inked
// badge on the rim keeps the true count.
export default function Trash({ open, items }) {
  const simRef = useRef(null);
  const ballEls = useRef(new Map()); // reason id → <circle>, moved by the rAF loop
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // the lid also pops open for a beat whenever something new lands inside
  const [lidPop, setLidPop] = useState(false);
  const prevLen = useRef(items.length);
  useEffect(() => {
    const grew = items.length > prevLen.current;
    prevLen.current = items.length;
    if (!grew) return;
    setLidPop(true);
    const t = setTimeout(() => setLidPop(false), 650);
    return () => clearTimeout(t);
  }, [items.length]);

  useEffect(() => {
    const sim = createTrashSim();
    simRef.current = sim;
    sim.syncItems(itemsRef.current);

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
      const present = new Set();
      for (const b of sim.snapshot()) {
        present.add(b.id);
        const el = ballEls.current.get(b.id);
        if (el) {
          el.setAttribute("transform", `translate(${b.x} ${b.y})`);
          el.setAttribute("visibility", "visible");
        }
      }
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
    if (simRef.current) simRef.current.syncItems(items);
  }, [items]);

  const lidUp = open || lidPop;

  return (
    <svg
      width={74}
      height={96}
      viewBox="0 0 74 96"
      className={open ? "trash-hot" : undefined}
      style={{
        overflow: "visible",
        transform: `scale(${open ? 1.1 : 1})`,
        transformOrigin: "50% 100%",
        transition: "transform .22s ease",
      }}
    >
      {/* stashed reasons: tiny weightless balls behind the can's scribbles,
          parked above the lid and hidden until the sim owns them (same
          pattern as the scale — the loop is the single source of position) */}
      <g>
        {items.slice(0, TRASH_GEO.MAX_BALLS).map((r) => (
          <circle
            key={r.id}
            visibility="hidden"
            transform={`translate(${TRASH_GEO.SPAWN_X} ${TRASH_GEO.SPAWN_Y})`}
            r={TRASH_GEO.BALL_R - 0.6}
            fill={shade(r.side, 5)}
            stroke={shadeStroke(r.side, 5)}
            strokeWidth={1.2}
            ref={(el) => {
              if (el) ballEls.current.set(r.id, el);
              else ballEls.current.delete(r.id);
            }}
          />
        ))}
      </g>

      {paint(BODY_PATHS, 3, "tb")}
      <g
        style={{
          transformOrigin: "6px 26px",
          transform: `rotate(${lidUp ? -42 : 0}deg)`,
          transition: "transform .22s ease",
        }}
      >
        {paint(LID_PATHS, 3, "tl")}
      </g>

      {/* hand-inked count badge — the real tally (the pile inside is capped) */}
      {items.length > 0 && (
        <g>
          <circle cx={64} cy={13} r={10.5} fill="#fcfcfa" stroke={DK} strokeWidth={2.5} />
          <text
            x={64}
            y={17.5}
            textAnchor="middle"
            fontFamily="Kalam, Caveat, cursive"
            fontWeight={700}
            fontSize={13}
            fill="#4a4a47"
          >
            {Math.min(items.length, 99)}
          </text>
        </g>
      )}
    </svg>
  );
}
