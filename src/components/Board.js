import React, { useState, useRef, useEffect, useMemo } from "react";
import Scale from "./Scale";
import ReasonColumn from "./ReasonColumn";
import Trash from "./Trash";
import { rLine } from "../lib/rough";
import { shade, clampWeight, verdictFor } from "../lib/scaleMath";
import { GEO } from "../lib/scalePhysics";

// Design-space size. The stage is at LEAST this big; whichever axis has spare
// room grows so the lined paper always covers the whole screen (no grey
// letterbox), then the stage is uniformly scaled back down to fit.
const W = 1320;
const H = 840;

// Ruled-line rhythm of the paper. Everything on the page snaps to this.
const RULE = 44;

// Lined-paper background: red margin rule + white header strip + ruled lines.
const PAPER_BG = [
  "linear-gradient(90deg,transparent 95px,#f0c5c5 95px,#f0c5c5 96px,transparent 96px)",
  "linear-gradient(#fcfcfa 0 110px,rgba(252,252,250,0) 110px)",
  `repeating-linear-gradient(#fcfcfa 0 ${RULE - 1}px,#ccd7e8 ${RULE - 1}px ${RULE}px)`,
].join(",");

const MARKER = "'Permanent Marker', cursive";
const INK = "#1d1d1d";
const PEN_BLUE = "#2456a4"; // handwritten-in-blue-ink accent for user input
const POP_MS = 380; // covers the .pop-core / .pop-particle CSS animations

const paintRough = (ds, sw, keyPrefix) =>
  ds.map((d, i) => (
    <path
      key={keyPrefix + i}
      d={d}
      fill="none"
      stroke="#2b2b2b"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ));

export default function Board() {
  const [title, setTitle] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [reasons, setReasons] = useState([]);
  const [adding, setAdding] = useState(null); // 'pro' | 'con' | null
  const [draftText, setDraftText] = useState("");
  const [draftWeight, setDraftWeight] = useState(5);
  const [dims, setDims] = useState({ s: 1, sw: W, sh: H });
  // what has physically landed on the scale — reported up by the physics sim
  const [landed, setLanded] = useState({ net: 0, count: 0 });
  // reasons mid-deletion: gone from the list, ball still popping on the scale
  const [popping, setPopping] = useState([]);

  // drag state that needs to render
  const [dragId, setDragId] = useState(null);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [dragMeta, setDragMeta] = useState({ text: "", weight: 0, color: "#333" });
  const [overTrash, setOverTrash] = useState(false);

  // refs so the window listeners always see the latest interaction state
  const nid = useRef(0);
  const pendingRef = useRef(null); // { r, sx, sy }
  const dragIdRef = useRef(null);
  const overTrashRef = useRef(false);
  const titleRef = useRef(null);
  const popTimers = useRef([]);

  useEffect(() => {
    const fit = () => {
      const s = Math.min(window.innerWidth / W, window.innerHeight / H);
      setDims({ s, sw: window.innerWidth / s, sh: window.innerHeight / s });
    };
    fit();

    const move = (e) => {
      const pending = pendingRef.current;
      if (pending && dragIdRef.current == null) {
        if (Math.hypot(e.clientX - pending.sx, e.clientY - pending.sy) > 6) {
          const r = pending.r;
          dragIdRef.current = r.id;
          setDragId(r.id);
          setDragMeta({ text: r.text, weight: r.weight, color: shade(r.side, r.weight) });
          setDragPos({ x: e.clientX, y: e.clientY });
        }
        return;
      }
      if (dragIdRef.current == null) return;
      const t = document.getElementById("trashzone");
      let over = false;
      if (t) {
        const b = t.getBoundingClientRect();
        over =
          e.clientX >= b.left - 50 &&
          e.clientX <= b.right + 50 &&
          e.clientY >= b.top - 50 &&
          e.clientY <= b.bottom + 50;
      }
      overTrashRef.current = over;
      setOverTrash(over);
      setDragPos({ x: e.clientX, y: e.clientY });
    };

    const up = () => {
      if (dragIdRef.current == null) {
        pendingRef.current = null;
        return;
      }
      const del = overTrashRef.current;
      const id = dragIdRef.current;
      pendingRef.current = null;
      dragIdRef.current = null;
      overTrashRef.current = false;
      setDragId(null);
      setOverTrash(false);
      if (del) {
        // the row leaves the list at once, but the ball stays on the scale
        // just long enough to pop — only then is the reason really removed
        // and the beam re-settles
        setPopping((p) => [...p, id]);
        popTimers.current.push(
          setTimeout(() => {
            setReasons((rs) => rs.filter((r) => r.id !== id));
            setPopping((p) => p.filter((x) => x !== id));
          }, POP_MS)
        );
      }
    };

    window.addEventListener("resize", fit);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    const timers = popTimers.current;
    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      timers.forEach(clearTimeout);
    };
  }, []);

  // when the title enters edit mode, focus it and select what's there
  useEffect(() => {
    if (editingTitle && titleRef.current) {
      titleRef.current.focus();
      const range = document.createRange();
      range.selectNodeContents(titleRef.current);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }, [editingTitle]);

  const onRowPointerDown = (e, r) => {
    e.preventDefault();
    pendingRef.current = { r, sx: e.clientX, sy: e.clientY };
  };

  const openAdd = (side) => {
    setAdding(side);
    setDraftText("");
    setDraftWeight(5);
  };

  const submitAdd = () => {
    if (!adding) return;
    const t = (draftText || "").trim();
    if (!t) {
      setAdding(null);
      return;
    }
    nid.current += 1;
    const nr = { id: nid.current, side: adding, text: t, weight: clampWeight(+draftWeight || 1) };
    setReasons((rs) => [...rs, nr]);
    setAdding(null);
    setDraftText("");
  };

  const onDraftKey = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitAdd();
    }
    if (e.key === "Escape") {
      setAdding(null);
      setDraftText("");
    }
  };

  const updateReason = (id, text, weight) =>
    setReasons((rs) =>
      rs.map((r) =>
        r.id === id ? { ...r, text, weight: clampWeight(+weight || 1) } : r
      )
    );

  const { s, sw, sh } = dims;

  // ── page layout, in stage units ────────────────────────────────────────────
  // The T-chart claims all the room between the red margin and the scale, and
  // its top lines up with the top of the scale (pivot badge ≈ stage y 166).
  const scaleLeft = sw - 582; // scale container: right:16, width:566
  const chartLeft = 110;
  const chartRight = Math.min(900, scaleLeft - 26);
  const midX = Math.round((chartLeft + chartRight) / 2);
  const headerTop = 4 * RULE + 1; // header row: PROS / CONS on the 2nd rule
  const crossTop = 5 * RULE; // crossbar drawn ON the ruled line below them
  const colTop = crossTop; // reason rows hang right under the crossbar
  // the divider stops level with the scale's base line
  const dividerBottom = 128 + GEO.POLE_BTM;
  const listMaxH = Math.max(
    4 * RULE,
    Math.min(sh - colTop - 110, dividerBottom - colTop - 44)
  ); // keep ＋ visible, stay inside the chart
  // verdict sits under the last ruled line, tucked to the right
  const verdictTop = RULE * Math.floor((sh - 38) / RULE) + 4;

  // stable references so the memoized <Scale/> skips drag re-renders
  const pros = useMemo(() => reasons.filter((r) => r.side === "pro"), [reasons]);
  const cons = useMemo(() => reasons.filter((r) => r.side === "con"), [reasons]);
  // rows leave the columns as soon as the delete lands; balls linger to pop
  const proRows = useMemo(() => pros.filter((r) => !popping.includes(r.id)), [pros, popping]);
  const conRows = useMemo(() => cons.filter((r) => !popping.includes(r.id)), [cons, popping]);
  // the verdict tracks landed balls, so the text flips in sync with the beam —
  // not the moment a reason is typed, but when its ball touches down
  const verdict = verdictFor(landed.net);
  const empty = landed.count === 0;

  // T-chart as a cross: the divider rises past the crossbar to split the two
  // headers, then runs down the page; the crossbar reinforces a ruled line.
  // Rough strokes are seeded — they only re-scribble when the stage resizes.
  const decor = useMemo(() => {
    const crossbar = rLine(chartLeft, crossTop, chartRight, crossTop, 8, 3);
    const divider = rLine(midX, headerTop - 6, midX, dividerBottom, 5, 3);
    return [...paintRough(crossbar, 3, "th"), ...paintRough(divider, 3, "tv")];
  }, [chartLeft, chartRight, midX, headerTop, crossTop, dividerBottom]);

  const today = useMemo(
    () =>
      new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    []
  );

  const columnProps = {
    draftText,
    draftWeight,
    draggingId: dragId,
    maxListHeight: listMaxH,
    onRowPointerDown,
    onUpdateReason: updateReason,
    onDraftText: (e) => setDraftText(e.currentTarget.value),
    onDraftWeight: (e) => setDraftWeight(clampWeight(+e.currentTarget.value || 1)),
    onDraftKey,
  };

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#fcfcfa" }}>
      {/* the paper stage — covers the entire viewport */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: sw,
          height: sh,
          transform: `scale(${s})`,
          transformOrigin: "0 0",
          overflow: "hidden",
          fontFamily: "system-ui, sans-serif",
          background: PAPER_BG,
        }}
      >
        {/* date: written in the margin, resting on the first ruled line */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 3 * RULE - 21,
            width: 92,
            textAlign: "center",
            lineHeight: "28px",
            fontFamily: "Kalam, Caveat, cursive",
            fontWeight: 700,
            fontSize: 14.5,
            color: "#8f8f8b",
            transform: "rotate(-0.5deg)",
            whiteSpace: "nowrap",
            zIndex: 1,
          }}
        >
          {today}
        </div>

        {/* title: printed prompt + handwritten (double-click to edit) answer.
            Sits just right of the red margin, resting on the first ruled line
            — like the heading written at the top of a notebook page. */}
        <div
          style={{
            position: "absolute",
            top: 3 * RULE - 42,
            left: 120,
            maxWidth: 760,
            display: "flex",
            alignItems: "baseline",
            justifyContent: "flex-start",
            gap: 16,
            zIndex: 4,
          }}
        >
          <span
            style={{
              fontFamily: MARKER,
              fontSize: 38,
              lineHeight: 1,
              color: "#6b6b66",
              whiteSpace: "nowrap",
            }}
          >
            I am deciding
          </span>
          <span
            ref={titleRef}
            className="title-edit"
            data-placeholder="..."
            contentEditable={editingTitle}
            suppressContentEditableWarning
            title={editingTitle ? undefined : "double-click to edit"}
            onDoubleClick={() => setEditingTitle(true)}
            onBlur={(e) => {
              setTitle(e.currentTarget.textContent.trim());
              setEditingTitle(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
              if (e.key === "Escape") {
                e.currentTarget.textContent = title;
                e.currentTarget.blur();
              }
            }}
            style={{
              fontFamily: MARKER,
              fontSize: 46,
              lineHeight: 0.80,
              color: PEN_BLUE,
              cursor: editingTitle ? "text" : "pointer",
              minWidth: 60,
              textAlign: "left",
              borderBottom: editingTitle
                ? "3px solid rgba(36,86,164,.35)"
                : "3px solid transparent",
              overflowWrap: "anywhere",
            }}
          >
            {title}
          </span>
        </div>

        {/* T-chart + headers */}
        <div style={{ position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none" }}>
          <svg width={sw} height={sh} viewBox={`0 0 ${sw} ${sh}`} style={{ width: "100%", height: "100%" }}>
            {decor}
          </svg>
          <div style={{ position: "absolute", left: chartLeft, top: headerTop, width: midX - chartLeft, textAlign: "center", lineHeight: `${RULE}px`, fontFamily: MARKER, fontSize: 30, color: INK }}>
            PROS
          </div>
          <div style={{ position: "absolute", left: midX, top: headerTop, width: chartRight - midX, textAlign: "center", lineHeight: `${RULE}px`, fontFamily: MARKER, fontSize: 30, color: INK }}>
            CONS
          </div>
          <div
            style={{
              position: "absolute",
              whiteSpace: "nowrap",
              fontFamily: MARKER,
              fontSize: 26,
              color: INK,
              right: 24,
              top: verdictTop,
            }}
          >
            {empty ? (
              <>
                The Scale <span style={{ color: "#9a9a9a" }}>AWAITS</span> your reasons
              </>
            ) : (
              <>
                The Scale <span style={{ color: verdict.color }}>{verdict.word}</span> your decision
              </>
            )}
          </div>
        </div>

        {/* PROS column */}
        <div style={{ position: "absolute", left: chartLeft + 8, top: colTop, width: midX - chartLeft - 26, zIndex: 2 }}>
          <ReasonColumn side="pro" reasons={proRows} {...columnProps} adding={adding === "pro"} onOpenAdd={() => openAdd("pro")} />
        </div>

        {/* CONS column */}
        <div style={{ position: "absolute", left: midX + 18, top: colTop, width: chartRight - midX - 26, zIndex: 2 }}>
          <ReasonColumn side="con" reasons={conRows} {...columnProps} adding={adding === "con"} onOpenAdd={() => openAdd("con")} />
        </div>

        {/* SCALE */}
        {/* right: 24 — the pans now overhang the 560-wide viewBox by ~20px a
            side (overflow visible), so keep the CON pan clear of the paper edge */}
        <div style={{ position: "absolute", right: 24, top: 128, width: 566, height: 648, zIndex: 2 }}>
          <Scale pros={pros} cons={cons} onLanded={setLanded} markedId={dragId} popping={popping} />
        </div>

        {/* TRASH */}
        <div id="trashzone" style={{ position: "absolute", left: 16, bottom: 10, zIndex: 3 }}>
          <Trash open={overTrash} />
        </div>
      </div>

      {/* DRAG CLONE (follows the cursor at unscaled screen coords) */}
      {dragId != null && (
        <div
          style={{
            position: "fixed",
            zIndex: 60,
            pointerEvents: "none",
            left: dragPos.x,
            top: dragPos.y,
            transform: "translate(-50%,-50%) rotate(-3deg)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "4px 14px",
            borderRadius: 8,
            background: "rgba(255,255,255,.92)",
            boxShadow: "0 8px 20px rgba(0,0,0,.22)",
            font: "700 24px Kalam, Caveat, cursive",
            color: dragMeta.color,
            whiteSpace: "nowrap",
          }}
        >
          <span>{dragMeta.text}</span>
          <span style={{ fontWeight: 700 }}>{dragMeta.weight}</span>
        </div>
      )}
    </div>
  );
}
