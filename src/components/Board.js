import React, { useState, useRef, useEffect } from "react";
import Scale from "./Scale";
import ReasonColumn from "./ReasonColumn";
import Trash from "./Trash";
import { shade, clampWeight, netWeight, verdictFor } from "../lib/scaleMath";

const W = 1320;
const H = 840;

// Lined-paper background: red margin rule + white header strip + ruled lines.
const PAPER_BG = [
  "linear-gradient(90deg,transparent 95px,#f0c5c5 95px,#f0c5c5 96px,transparent 96px)",
  "linear-gradient(#fcfcfa 0 110px,rgba(252,252,250,0) 110px)",
  "repeating-linear-gradient(#fcfcfa 0 43px,#ccd7e8 43px 44px)",
].join(",");

const MARKER = "'Permanent Marker', cursive";

export default function Board() {
  const [title, setTitle] = useState("Homework Before Gym");
  const [reasons, setReasons] = useState([
    { id: 1, side: "pro", text: "Homework will be done", weight: 9 },
    { id: 2, side: "con", text: "Not enough time for gym", weight: 6 },
    { id: 3, side: "con", text: "No Gains", weight: 3 },
  ]);
  const [adding, setAdding] = useState(null); // 'pro' | 'con' | null
  const [draftText, setDraftText] = useState("");
  const [draftWeight, setDraftWeight] = useState(5);
  const [scale, setScale] = useState(1);

  // drag state that needs to render
  const [dragId, setDragId] = useState(null);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [dragMeta, setDragMeta] = useState({ text: "", weight: 0, color: "#333" });
  const [overTrash, setOverTrash] = useState(false);

  // refs so the window listeners always see the latest interaction state
  const nid = useRef(5);
  const pendingRef = useRef(null); // { r, sx, sy }
  const dragIdRef = useRef(null);
  const overTrashRef = useRef(false);

  useEffect(() => {
    const fit = () =>
      setScale(Math.min(window.innerWidth / W, window.innerHeight / H));
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
      if (del) setReasons((rs) => rs.filter((r) => r.id !== id));
    };

    window.addEventListener("resize", fit);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);

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

  const pros = reasons.filter((r) => r.side === "pro");
  const cons = reasons.filter((r) => r.side === "con");
  const net = netWeight(pros, cons);
  const verdict = verdictFor(net);

  const columnProps = {
    adding: false, // overridden per column
    draftText,
    draftWeight,
    draggingId: dragId,
    onRowPointerDown,
    onDraftText: (e) => setDraftText(e.currentTarget.value),
    onDraftWeight: (e) => setDraftWeight(clampWeight(+e.currentTarget.value || 1)),
    onDraftKey,
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#e7e7e6",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "relative",
          width: W,
          height: H,
          flex: "none",
          overflow: "hidden",
          fontFamily: "system-ui, sans-serif",
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          boxShadow: "0 10px 40px rgba(0,0,0,.18)",
          background: PAPER_BG,
        }}
      >
        {/* editable title */}
        <div
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => setTitle(e.currentTarget.textContent)}
          style={{
            position: "absolute",
            top: 30,
            right: 64,
            maxWidth: 900,
            textAlign: "right",
            fontFamily: MARKER,
            fontSize: 46,
            lineHeight: 1,
            color: "#000",
            cursor: "text",
            zIndex: 4,
          }}
        >
          {title}
        </div>

        {/* T-chart decor + column headers */}
        <div style={{ position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none" }}>
          <svg
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            style={{ width: "100%", height: "100%" }}
          >
            <line x1={110} y1={176} x2={710} y2={176} stroke="#2b2b2b" strokeWidth={3} strokeLinecap="round" />
            <line x1={410} y1={132} x2={410} y2={764} stroke="#2b2b2b" strokeWidth={3} strokeLinecap="round" />
          </svg>
          <div style={{ position: "absolute", left: 126, top: 134, width: 270, textAlign: "center", fontFamily: MARKER, fontSize: 30, color: "#1d1d1d" }}>
            PROS
          </div>
          <div style={{ position: "absolute", left: 428, top: 134, width: 270, textAlign: "center", fontFamily: MARKER, fontSize: 30, color: "#1d1d1d" }}>
            CONS
          </div>
          <div style={{ position: "absolute", whiteSpace: "nowrap", fontFamily: MARKER, fontSize: 26, color: "#1d1d1d", left: 866, top: 796 }}>
            The Scale <span style={{ color: verdict.color }}>{verdict.word}</span> your decision
          </div>
        </div>

        {/* PROS column */}
        <div style={{ position: "absolute", left: 120, top: 176, width: 270, zIndex: 2 }}>
          <ReasonColumn side="pro" reasons={pros} {...columnProps} adding={adding === "pro"} onOpenAdd={() => openAdd("pro")} />
        </div>

        {/* CONS column */}
        <div style={{ position: "absolute", left: 428, top: 176, width: 270, zIndex: 2 }}>
          <ReasonColumn side="con" reasons={cons} {...columnProps} adding={adding === "con"} onOpenAdd={() => openAdd("con")} />
        </div>

        {/* SCALE */}
        <div style={{ position: "absolute", right: 16, top: 128, width: 566, height: 648, zIndex: 2 }}>
          <Scale pros={pros} cons={cons} />
        </div>

        {/* TRASH */}
        <div id="trashzone" style={{ position: "absolute", left: 12, top: 714, zIndex: 3 }}>
          <Trash open={overTrash} dragging={dragId != null} />
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
