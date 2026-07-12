import React, { useState, useRef, useEffect, useMemo } from "react";
import Scale from "./Scale";
import ReasonColumn from "./ReasonColumn";
import Trash from "./Trash";
import MarginTools from "./MarginTools";
import ClearModal from "./ClearModal";
import { rLine } from "../lib/rough";
import { shade, clampWeight, verdictFor } from "../lib/scaleMath";
import { GEO } from "../lib/scalePhysics";

// Design-space size. The stage is at LEAST this big; whichever axis has spare
// room grows so the lined paper always covers the whole screen (no grey
// letterbox), then the stage is uniformly scaled back down to fit.
const W = 1320;
const H = 840;

// Ruled-line rhythm of the paper. Everything on the page snaps to this.
// Tighter than a college rule so the page reads as real lined paper — more
// lines, less air per line (the reason rows in ReasonColumn share this rhythm).
const RULE = 35;

// Lined-paper background: red margin rule + white header strip + ruled lines.
const PAPER_BG = [
  "linear-gradient(90deg,transparent 95px,#f0c5c5 95px,#f0c5c5 96px,transparent 96px)",
  "linear-gradient(#fcfcfa 0 110px,rgba(252,252,250,0) 110px)",
  `repeating-linear-gradient(#fcfcfa 0 ${RULE - 1}px,#ccd7e8 ${RULE - 1}px ${RULE}px)`,
].join(",");

const MARKER = "'Permanent Marker', cursive";
const INK = "#1d1d1d";
const POP_MS = 380; // covers the .pop-core / .pop-particle CSS animations
// Longest title that still fits on the header strip's single line at fontSize
// 50 — past this the editable span would start scrolling like a never-ending
// line, so we hard-stop input here (and on paste) instead.
const MAX_TITLE_LENGTH = 38;

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
  const [dims, setDims] = useState({ s: 1, sw: W, sh: H });
  // what has physically landed on the scale — reported up by the physics sim
  const [landed, setLanded] = useState({ net: 0, count: 0 });
  // reasons mid-deletion: gone from the list, ball still popping on the scale
  const [popping, setPopping] = useState([]);
  // weights hidden: every reason silently counts as 5 (real weights are kept
  // in state, so toggling back restores them exactly)
  const [hideWeights, setHideWeights] = useState(false);
  // Undo/redo across every content action. Each entry is one user gesture:
  //   add    — a reason committed from a composer
  //   edit   — one edit session of a row (focus → blur), text and/or weight
  //   delete — one trash drop or "clear the page" batch, [{ reason, index }]
  //   title  — a committed change to the page title
  // The weights switch is a view preference and deliberately stays out.
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  // the right-click-the-trash flow: scope pick, then confirm
  const [clearMenu, setClearMenu] = useState(false);
  const [confirmScope, setConfirmScope] = useState(null); // 'pro' | 'con' | 'all'

  // drag state that needs to render
  const [dragId, setDragId] = useState(null);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [dragMeta, setDragMeta] = useState({ text: "", weight: 0, color: "#333" });
  const [overTrash, setOverTrash] = useState(false);
  // the reason whose text/weight currently holds the caret — its ball glows on
  // the scale so an edit (especially a live weight morph) is visibly anchored
  // to one ball. Single-valued: focus can only be in one row at a time.
  const [editingId, setEditingId] = useState(null);

  // refs so the window listeners always see the latest interaction state
  const nid = useRef(0);
  const pendingRef = useRef(null); // { r, sx, sy }
  const dragIdRef = useRef(null);
  const overTrashRef = useRef(false);
  const titleRef = useRef(null);
  const popTimerMap = useRef(new Map()); // reason id → pending removal timer (undo can cancel it)
  const deletingRef = useRef(new Set()); // reason ids mid-pop, so delete is idempotent
  const reasonsRef = useRef([]);
  const hideWeightsRef = useRef(false);
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const undoRef = useRef(() => {});
  const redoRef = useRef(() => {});
  const editSessionRef = useRef(null); // { id, text, weight } — row state when the caret entered it
  const pendingSessionRef = useRef(null); // a just-blurred session, until its deferred record lands
  reasonsRef.current = reasons;
  hideWeightsRef.current = hideWeights;
  undoStackRef.current = undoStack;
  redoStackRef.current = redoStack;

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
          setDragMeta({
            text: r.text,
            weight: r.weight,
            color: shade(r.side, hideWeightsRef.current ? 5 : r.weight),
          });
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
      if (del) deleteReason(id);
    };

    window.addEventListener("resize", fit);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    const timers = popTimerMap.current;
    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      timers.forEach(clearTimeout);
    };
  }, []);

  // Hotkeys. Alt+W flips the weights switch anywhere. Ctrl+Z / Ctrl+Y (or
  // Ctrl+Shift+Z) drive undo/redo — but never while the caret is in a text
  // field, where Ctrl+Z must stay the browser's own typing undo (the app
  // history takes over the moment the caret leaves the field).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setClearMenu(false);
        setConfirmScope(null);
      }
      const k = e.key.toLowerCase();
      if (e.altKey && !e.ctrlKey && !e.metaKey && k === "w") {
        e.preventDefault();
        setHideWeights((h) => !h);
        return;
      }
      const t = e.target;
      const inEditor =
        t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.isContentEditable);
      if (inEditor || !(e.ctrlKey || e.metaKey)) return;
      if (!e.shiftKey && k === "z") {
        e.preventDefault();
        undoRef.current();
      } else if (k === "y" || (e.shiftKey && k === "z")) {
        e.preventDefault();
        redoRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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

  // any new action lands on the undo stack (capped) and invalidates redo
  const pushAction = (action) => {
    setUndoStack((st) => [...st.slice(-99), action]);
    setRedoStack([]);
  };

  // a reason is committed straight from a column's composer (Enter / blur)
  const addReason = (side, text, weight) => {
    const t = (text || "").trim();
    if (!t) return;
    nid.current += 1;
    const reason = { id: nid.current, side, text: t, weight: clampWeight(+weight || 1) };
    pushAction({ type: "add", reason, index: reasonsRef.current.length });
    setReasons((rs) => [...rs, reason]);
  };

  const updateReason = (id, text, weight) =>
    setReasons((rs) =>
      rs.map((r) =>
        r.id === id ? { ...r, text, weight: clampWeight(+weight || 1) } : r
      )
    );

  // ── edit sessions: one undo step per visit to a row ────────────────────────
  // Text and weight commit live on every keystroke, so the history can't
  // record per-change. Instead a row's state is snapshotted when the caret
  // enters it, and a single edit entry lands when it leaves. The record is
  // deferred one microtask: blur-time commits (weight normalization, text
  // trim) run in the same event as the blur, and the deferral lets React
  // flush them so the recorded "after" is what the page actually shows.
  const closeEditSession = (s) => {
    editSessionRef.current = null;
    pendingSessionRef.current = s; // a same-event delete can still claim it
    queueMicrotask(() => {
      if (pendingSessionRef.current !== s) return; // claimed by a delete
      pendingSessionRef.current = null;
      const r = reasonsRef.current.find((x) => x.id === s.id);
      if (!r || deletingRef.current.has(s.id)) return; // the delete owns history
      if (r.text === s.text && r.weight === s.weight) return;
      pushAction({
        type: "edit",
        id: s.id,
        before: { text: s.text, weight: s.weight },
        after: { text: r.text, weight: r.weight },
      });
    });
  };

  // rows report where the caret lives; blur only clears if focus didn't
  // already move on to another row (its focus event lands first-or-after,
  // so the functional check keeps the newest row's highlight)
  const onEditFocus = (id) => {
    setEditingId(id);
    const s = editSessionRef.current;
    if (s?.id === id) return; // hopping text ↔ weight inside the same row
    if (s) closeEditSession(s); // ordering-proof: a blur may land after this focus
    const r = reasonsRef.current.find((x) => x.id === id);
    editSessionRef.current = r ? { id, text: r.text, weight: r.weight } : null;
  };
  const onEditBlur = (id) => {
    setEditingId((cur) => (cur === id ? null : cur));
    const s = editSessionRef.current;
    if (s?.id === id) closeEditSession(s);
  };

  // the row leaves the list at once, but the ball stays on the scale just
  // long enough to pop — only then is the reason really removed and the beam
  // re-settles. Shared by the trash drop and by emptying a reason's text, and
  // idempotent: a reason already mid-pop ignores repeat calls (the keyboard
  // delete and the follow-on blur can both fire for one row).
  // performDelete only animates+removes; recording for undo happens in the
  // user-facing entry points (deleteReason / clearReasons) so redo can replay
  // a deletion without stacking a second history entry.
  const performDelete = (id) => {
    if (deletingRef.current.has(id)) return;
    deletingRef.current.add(id);
    setEditingId((cur) => (cur === id ? null : cur)); // a dying row stops glowing
    setPopping((p) => [...p, id]);
    popTimerMap.current.set(
      id,
      setTimeout(() => {
        setReasons((rs) => rs.filter((r) => r.id !== id));
        setPopping((p) => p.filter((x) => x !== id));
        deletingRef.current.delete(id);
        popTimerMap.current.delete(id);
      }, POP_MS)
    );
  };

  // A row deleted mid-edit-session is recorded at its PRE-session state
  // (covers select-all → backspace → blur: undo brings the words back, not
  // an empty row). The session is consumed so no edit entry lands for it.
  const sessionStateFor = (id) => {
    const s =
      editSessionRef.current?.id === id
        ? editSessionRef.current
        : pendingSessionRef.current?.id === id
          ? pendingSessionRef.current
          : null;
    if (!s) return null;
    if (editSessionRef.current === s) editSessionRef.current = null;
    if (pendingSessionRef.current === s) pendingSessionRef.current = null;
    return { text: s.text, weight: s.weight };
  };

  const deleteReason = (id) => {
    if (deletingRef.current.has(id)) return;
    const idx = reasonsRef.current.findIndex((r) => r.id === id);
    if (idx < 0) return;
    const before = sessionStateFor(id);
    const reason = before
      ? { ...reasonsRef.current[idx], ...before }
      : reasonsRef.current[idx];
    pushAction({ type: "delete", items: [{ reason, index: idx }] });
    performDelete(id);
  };

  // the trash's right-click menu: clear one side or the whole page, as a
  // single undoable step
  const clearReasons = (scope) => {
    const items = reasonsRef.current
      .map((reason, index) => ({ reason, index }))
      .filter(
        ({ reason }) =>
          !deletingRef.current.has(reason.id) && (scope === "all" || reason.side === scope)
      )
      .map(({ reason, index }) => {
        const before = sessionStateFor(reason.id);
        return { reason: before ? { ...reason, ...before } : reason, index };
      });
    if (items.length) pushAction({ type: "delete", items });
    items.forEach(({ reason }) => performDelete(reason.id));
    setClearMenu(false);
    setConfirmScope(null);
  };

  // Put deleted reasons back: one still mid-pop is rescued in place (removal
  // timer cancelled, recorded text/weight restored — no re-drop); one already
  // gone is spliced back into its old spot and its ball falls in fresh.
  const restoreReasons = (items) => {
    for (const { reason } of items) {
      const t = popTimerMap.current.get(reason.id);
      if (t) {
        clearTimeout(t);
        popTimerMap.current.delete(reason.id);
        deletingRef.current.delete(reason.id);
        setPopping((p) => p.filter((x) => x !== reason.id));
      }
    }
    setReasons((rs) => {
      const have = new Set(rs.map((r) => r.id));
      const next = rs.map((r) => items.find((i) => i.reason.id === r.id)?.reason || r);
      for (const { reason, index } of items) {
        if (!have.has(reason.id)) next.splice(Math.min(index, next.length), 0, reason);
      }
      return next;
    });
  };

  // one switchboard applies any history entry in either direction
  const applyAction = (action, dir) => {
    const undoing = dir === "undo";
    switch (action.type) {
      case "delete":
        if (undoing) restoreReasons(action.items);
        else action.items.forEach(({ reason }) => performDelete(reason.id));
        break;
      case "add":
        if (undoing) performDelete(action.reason.id);
        else restoreReasons([{ reason: action.reason, index: action.index }]);
        break;
      case "edit": {
        const v = undoing ? action.before : action.after;
        setReasons((rs) =>
          rs.map((r) => (r.id === action.id ? { ...r, text: v.text, weight: v.weight } : r))
        );
        break;
      }
      case "title":
        setTitle(undoing ? action.before : action.after);
        break;
      default:
        break;
    }
  };

  const undo = () => {
    const st = undoStackRef.current;
    if (!st.length) return;
    const action = st[st.length - 1];
    setUndoStack(st.slice(0, -1));
    setRedoStack([...redoStackRef.current, action]);
    applyAction(action, "undo");
  };
  const redo = () => {
    const rd = redoStackRef.current;
    if (!rd.length) return;
    const action = rd[rd.length - 1];
    setRedoStack(rd.slice(0, -1));
    setUndoStack([...undoStackRef.current, action]);
    applyAction(action, "redo");
  };
  undoRef.current = undo;
  redoRef.current = redo;

  const { s, sw, sh } = dims;

  // ── page layout, in stage units ────────────────────────────────────────────
  // The T-chart claims all the room between the red margin and the scale, and
  // its top lines up with the top of the scale (pivot badge ≈ stage y 166).
  const scaleLeft = sw - 622; // scale container: right:64, width:566
  const chartLeft = 110;
  const chartRight = Math.min(900, scaleLeft - 26);
  const midX = Math.round((chartLeft + chartRight) / 2);
  // With the tighter rule the header/crossbar sit one rule lower so the top of
  // the page (title, date, headings) keeps roughly its original breathing room.
  const headerTop = 5 * RULE + 1; // header row: PROS / CONS heading
  const crossTop = 6 * RULE; // crossbar drawn ON the ruled line below them
  const colTop = crossTop; // reason rows hang right under the crossbar
  // the divider stops level with the scale's base line
  const dividerBottom = 128 + GEO.POLE_BTM;
  const listMaxH = Math.max(
    4 * RULE,
    Math.min(sh - colTop - 110, dividerBottom - colTop - RULE)
  ); // the writing area — a fixed-height "page", staying inside the chart
  // verdict sits on the very last ruled line that fits, tucked to the right
  const verdictTop = RULE * Math.floor((sh - 4) / RULE) - 30;

  // With weights hidden every reason acts as a flat 5 — balls morph to one
  // size, colors even out, and the tally becomes a pure headcount. The real
  // weights stay untouched in `reasons` for when the switch flips back.
  const effective = useMemo(
    () => (hideWeights ? reasons.map((r) => ({ ...r, weight: 5 })) : reasons),
    [reasons, hideWeights]
  );
  // stable references so the memoized <Scale/> skips drag re-renders
  const pros = useMemo(() => effective.filter((r) => r.side === "pro"), [effective]);
  const cons = useMemo(() => effective.filter((r) => r.side === "con"), [effective]);
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
    rule: RULE,
    hideWeights,
    draggingId: dragId,
    listHeight: listMaxH,
    onRowPointerDown,
    onUpdateReason: updateReason,
    onAddReason: addReason,
    onDeleteReason: deleteReason,
    onEditFocus,
    onEditBlur,
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
            top: 4 * RULE - 28,
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
            top: 4 * RULE - 50,
            left: 120,
            right: 120,
            display: "flex",
            alignItems: "baseline",
            justifyContent: "flex-start",
            gap: 16,
            zIndex: 4,
            overflow: "hidden",
          }}
        >
          <span
            style={{
              fontFamily: MARKER,
              fontSize: 50,
              lineHeight: 1,
              color: INK,
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
              const next = e.currentTarget.textContent.trim();
              if (next !== title) pushAction({ type: "title", before: title, after: next });
              setTitle(next);
              setEditingTitle(false);
            }}
            
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
                return;
              }
              if (e.key === "Escape") {
                e.currentTarget.textContent = title;
                e.currentTarget.blur();
                return;
              }
              // block any character-producing key once we're at the cap —
              // but let editing/navigation keys, shortcuts, and typing over a
              // selection (which nets no growth) through.
              const sel = window.getSelection();
              const hasSelection = sel && !sel.isCollapsed;
              const typingKey = e.key.length === 1 && !e.ctrlKey && !e.metaKey;
              if (
                typingKey &&
                !hasSelection &&
                (e.currentTarget.textContent || "").length >= MAX_TITLE_LENGTH
              ) {
                e.preventDefault();
              }
            }}
            onPaste={(e) => {
              // trim pasted text so the total never exceeds the cap
              e.preventDefault();
              const el = e.currentTarget;
              const sel = window.getSelection();
              const selLen =
                sel && !sel.isCollapsed ? sel.toString().length : 0;
              const room = MAX_TITLE_LENGTH - ((el.textContent || "").length - selLen);
              if (room <= 0) return;
              const paste = (e.clipboardData || window.clipboardData)
                .getData("text")
                .replace(/\s+/g, " ")
                .slice(0, room);
              document.execCommand("insertText", false, paste);
            }}
            style={{
              fontFamily: MARKER,
              fontSize: 50,
              lineHeight: 0.80,
              color: "#737370",
              cursor: editingTitle ? "text" : "pointer",
              minWidth: 60,
              textAlign: "left",
              whiteSpace: "nowrap",
              outline: "none",
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

        {/* PROS column — its left edge (where the scrollbar rides) sits on the
            crossbar's left end; the right edge runs close to the divider, with
            just enough gap for the grip to tuck beside the beam. */}
        <div style={{ position: "absolute", left: chartLeft, top: colTop, width: midX - chartLeft - 6, zIndex: 2 }}>
          <ReasonColumn side="pro" reasons={proRows} {...columnProps} />
        </div>

        {/* CONS column — its right edge (scrollbar) sits on the crossbar's right
            end; the left edge runs close to the divider, mirroring PROS. */}
        <div style={{ position: "absolute", left: midX + 6, top: colTop, width: chartRight - midX - 6, zIndex: 2 }}>
          <ReasonColumn side="con" reasons={conRows} {...columnProps} />
        </div>

        {/* SCALE */}
        {/* right: 24 — the pans now overhang the 560-wide viewBox by ~20px a
            side (overflow visible), so keep the CON pan clear of the paper edge */}
        <div style={{ position: "absolute", right: 64, top: 128, width: 566, height: 648, zIndex: 2 }}>
          <Scale
            pros={pros}
            cons={cons}
            onLanded={setLanded}
            markedId={dragId}
            editingId={editingId}
            popping={popping}
            hideWeights={hideWeights}
          />
        </div>

        {/* MARGIN TOOLS — undo/redo + the weights switch, doodled in the
            red margin between the date up top and the trash below */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 9 * RULE - 22,
            width: 92,
            display: "flex",
            justifyContent: "center",
            zIndex: 3,
          }}
        >
          <MarginTools
            canUndo={undoStack.length > 0}
            canRedo={redoStack.length > 0}
            onUndo={undo}
            onRedo={redo}
            weightsOn={!hideWeights}
            onToggleWeights={() => setHideWeights((h) => !h)}
          />
        </div>

        {/* TRASH — drop a reason to delete it; right-click to clear the page */}
        <div
          id="trashzone"
          className="mtip mtip-up"
          data-tip={overTrash ? undefined : "right-click to clear the page"}
          onContextMenu={(e) => {
            e.preventDefault();
            setClearMenu(true);
          }}
          style={{ position: "absolute", left: 16, bottom: 10, zIndex: 3 }}
        >
          <Trash open={overTrash} />
        </div>

        {/* CLEAR-THE-PAGE modal (right-click on the trash) */}
        {clearMenu && (
          <ClearModal
            proCount={proRows.length}
            conCount={conRows.length}
            scope={confirmScope}
            onScope={setConfirmScope}
            onConfirm={() => clearReasons(confirmScope)}
            onClose={() => {
              setClearMenu(false);
              setConfirmScope(null);
            }}
          />
        )}
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
          {!hideWeights && <span style={{ fontWeight: 700 }}>{dragMeta.weight}</span>}
        </div>
      )}
    </div>
  );
}
