import { useEffect, useRef, useState } from "react";
import { clampWeight, shade, shadeStroke } from "../lib/scaleMath";

// Per-side ink colors for the handwriting.
const ACCENT = {
  pro: { text: "#3f8a1a", faint: "rgba(63,138,26,0.5)" },
  con: { text: "#c3352c", faint: "rgba(195,53,44,0.5)" },
};

// past this many reasons in one column, gently push back
const CROWDED_AT = 8;

// Handwriting size, and how far the ink is pushed DOWN within each ruled band
// so letters rest ON the line (which sits at the bottom of the band) and
// descenders like g / y dip just below it — real writing, not floating text.
// The push is a transform, NOT padding: a transform doesn't count toward
// scrollHeight, so an autosized textarea is exactly lines×rule tall and the
// rows below it stay snapped to the ruled grid.
const FONT = 23;
const DROP = 9;
const WEIGHT_W = 30;

// Grow a textarea to whole ruled lines. Its line-height IS the rule, so
// scrollHeight always lands on rule-multiples. Toggling height to "auto"
// forces a reflow that some browsers use to collapse the caret to index 0 on
// a focused field, so snapshot the selection and put it back.
function autosize(el) {
  if (!el) return;
  const focused = document.activeElement === el;
  const start = el.selectionStart;
  const end = el.selectionEnd;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
  if (focused) el.setSelectionRange(start, end);
}

// the reason text — a textarea styled to vanish into the paper
const inkTextarea = (rule, color) => ({
  flex: 1,
  minWidth: 0,
  boxSizing: "border-box",
  margin: 0,
  padding: 0,
  border: "none",
  outline: "none",
  resize: "none",
  overflow: "hidden",
  background: "transparent",
  fontFamily: "Kalam, Caveat, cursive",
  fontWeight: 700,
  fontSize: FONT,
  lineHeight: `${rule}px`,
  transform: `translateY(${DROP}px)`,
  color,
});

// the weight — sits on the first line, at the right edge of the column
const inkWeight = (rule, color) => ({
  flex: "none",
  width: WEIGHT_W,
  height: rule,
  boxSizing: "border-box",
  margin: 0,
  padding: 0,
  border: "none",
  outline: "none",
  background: "transparent",
  fontFamily: "Kalam, Caveat, cursive",
  fontWeight: 700,
  fontSize: FONT,
  lineHeight: `${rule}px`,
  transform: `translateY(${DROP}px)`,
  color,
  textAlign: "right",
});

// ── caret geometry ──────────────────────────────────────────────────────────
// Browsers don't expose caret coordinates inside a textarea, so a hidden
// mirror with identical typography answers "which visual line is the caret
// on, and at what x?" — needed to know when an ArrowUp/Down should leave the
// textarea versus move within its wrapped lines.
const MIRROR_PROPS = [
  "boxSizing",
  "width",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "fontFamily",
  "fontWeight",
  "fontSize",
  "lineHeight",
  "letterSpacing",
];
let mirror = null;
function measureCaret(el, offset) {
  if (!mirror) {
    mirror = document.createElement("div");
    Object.assign(mirror.style, {
      position: "fixed",
      top: "-9999px",
      left: "0",
      visibility: "hidden",
      pointerEvents: "none",
    });
    document.body.appendChild(mirror);
  }
  const cs = window.getComputedStyle(el);
  MIRROR_PROPS.forEach((p) => {
    mirror.style[p] = cs[p];
  });
  mirror.style.whiteSpace = "pre-wrap"; // textarea's own wrapping rules
  mirror.style.wordWrap = "break-word";
  mirror.style.overflowWrap = "break-word";

  mirror.textContent = el.value.slice(0, offset);
  const marker = document.createElement("span");
  marker.textContent = "​"; // zero-width — marks the caret slot, adds no ink
  mirror.appendChild(marker);
  return { left: marker.offsetLeft, top: marker.offsetTop };
}

// the text offset on a textarea's first or last visual line closest to x —
// so arrowing between rows keeps the caret's column, like a document editor
function offsetForX(el, x, edge) {
  const len = el.value.length;
  let best = 0;
  let bestDx = Infinity;
  if (edge === "first") {
    for (let i = 0; i <= len; i++) {
      const m = measureCaret(el, i);
      if (m.top > 1) break; // left the first line
      const dx = Math.abs(m.left - x);
      if (dx < bestDx) {
        bestDx = dx;
        best = i;
      }
    }
  } else {
    const lastTop = measureCaret(el, len).top;
    for (let i = len; i >= 0; i--) {
      const m = measureCaret(el, i);
      if (m.top < lastTop - 1) break; // left the last line
      const dx = Math.abs(m.left - x);
      if (dx < bestDx) {
        bestDx = dx;
        best = i;
      }
    }
  }
  return best;
}

// ── arrow-key navigation grid ───────────────────────────────────────────────
// Every editable cell carries data-nav="side:row:field", with the composer as
// each side's last row. Arrows only leave a cell at its edges — Up/Down on the
// first/last visual line, Left/Right with the caret at the very start/end —
// so ordinary within-text cursor movement is untouched. Crossing left/right
// walks pro-text → pro-weight → con-text → con-weight along the same row,
// which is what lets the caret hop the T-chart divider without the mouse.
const NAV_ORDER = ["pro:text", "pro:weight", "con:text", "con:weight"];

const lastRow = (side) =>
  document.querySelectorAll(`[data-nav^="${side}:"][data-nav$=":text"]`).length - 1;

function focusCell(side, row, field, place) {
  if (row < 0 || row > lastRow(side)) return false;
  const pick = (f) => document.querySelector(`[data-nav="${side}:${row}:${f}"]`);
  // the composer's weight box only exists while the composer is active —
  // land on its text instead of dead-ending
  const el = pick(field) || (field === "weight" ? pick("text") : null);
  if (!el) return false;
  el.focus();
  if (el.tagName === "INPUT") {
    el.select(); // type-to-replace, like a spreadsheet cell
    return true;
  }
  let off = el.value.length;
  if (place?.at === "start") off = 0;
  else if (place?.at === "x") off = offsetForX(el, place.x, place.edge);
  el.setSelectionRange(off, off);
  return true;
}

function navKey(e, side, row, field) {
  if (e.shiftKey || e.altKey || e.metaKey || e.ctrlKey || e.nativeEvent.isComposing) return;
  const el = e.currentTarget;
  const at = el.selectionStart;
  if (at == null || at !== el.selectionEnd) return; // never hijack a selection
  const len = el.value.length;
  const idx = NAV_ORDER.indexOf(`${side}:${field}`);
  let moved = false;

  if (e.key === "ArrowLeft" && at === 0 && idx > 0) {
    const [s, f] = NAV_ORDER[idx - 1].split(":");
    moved = focusCell(s, Math.min(row, lastRow(s)), f, { at: "end" });
  } else if (e.key === "ArrowRight" && at === len && idx < NAV_ORDER.length - 1) {
    const [s, f] = NAV_ORDER[idx + 1].split(":");
    moved = focusCell(s, Math.min(row, lastRow(s)), f, { at: "start" });
  } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
    const dir = e.key === "ArrowUp" ? -1 : 1;
    let place;
    if (field === "text") {
      const m = measureCaret(el, at);
      if (dir < 0 && m.top > 1) return; // not on the first visual line yet
      if (dir > 0 && m.top < measureCaret(el, len).top - 1) return; // nor the last
      place = { at: "x", x: m.left, edge: dir < 0 ? "last" : "first" };
    }
    moved = focusCell(side, row + dir, field, place);
  }

  if (moved) e.preventDefault();
}

// ── the weight cell ─────────────────────────────────────────────────────────
// Free-typed digits (a text input: number inputs don't support the selection
// APIs the arrow-nav needs). Valid values commit the moment they're typed so
// the scale reacts live; whatever half-typed state remains is normalized to
// 1–10 on the way out.
function WeightInput({ side, row, value, color, rule, onCommit, onKeyDownExtra, onBlurExtra }) {
  const [s, setS] = useState(String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setS(String(value));
  }, [value]);
  return (
    <input
      type="text"
      inputMode="numeric"
      maxLength={2}
      data-nav={`${side}:${row}:weight`}
      value={s}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(e) => {
        const str = e.currentTarget.value.replace(/\D/g, "");
        setS(str);
        const n = parseInt(str, 10);
        if (n >= 1 && n <= 10) onCommit(n);
      }}
      onKeyDown={(e) => {
        onKeyDownExtra?.(e);
        if (!e.defaultPrevented) navKey(e, side, row, "weight");
      }}
      onBlur={(e) => {
        focused.current = false;
        const n = clampWeight(parseInt(s, 10) || value);
        setS(String(n));
        onCommit(n);
        onBlurExtra?.(e);
      }}
      style={inkWeight(rule, color)}
    />
  );
}

// ── one committed reason: an always-editable line of the page ───────────────
// Click anywhere in the text to edit (no mode switch); the grip in the left
// gutter is the drag handle for the trash. A reason whose text is emptied is
// deleted the moment focus leaves the row.
function ReasonRow({ side, row, r, rule, dragging, onRowPointerDown, onUpdate, onDelete }) {
  const taRef = useRef(null);
  useEffect(() => {
    autosize(taRef.current);
  }, [r.text, rule]);

  return (
    <div
      className="reason"
      onBlur={(e) => {
        if (e.currentTarget.contains(e.relatedTarget)) return; // text ↔ weight
        const t = r.text.trim();
        if (!t) onDelete(r.id);
        else if (t !== r.text) onUpdate(r.id, t, r.weight);
      }}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        flex: "0 0 auto",
        minHeight: rule,
        opacity: dragging ? 0.25 : 1,
      }}
    >
      <div
        className={`grip grip-${side}`}
        title="drag to the trash to delete"
        style={{ color: shade(side, r.weight) }}
        onPointerDown={(e) => onRowPointerDown(e, r)}
      />
      <textarea
        rows={1}
        data-nav={`${side}:${row}:text`}
        ref={taRef}
        value={r.text}
        onChange={(e) => {
          onUpdate(r.id, e.currentTarget.value, r.weight);
          autosize(e.currentTarget);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.currentTarget.blur();
            return;
          }
          if (e.key === "Enter") {
            // Enter finishes the line and drops to the next one, like a
            // document. Moving focus onto the next row triggers this row's
            // onBlur, which deletes it if the text was emptied — so an
            // Enter-after-backspace lands the caret on the next line instead
            // of stranding it (matching the arrow-key path).
            e.preventDefault();
            focusCell(side, row + 1, "text", { at: "start" });
            return;
          }
          if (e.key === "Backspace" && !r.text) {
            // Backspacing an already-empty line removes the reason and pulls
            // the caret up to the end of the previous one — the same "join
            // upward" muscle memory as a document, but reason-by-reason.
            e.preventDefault();
            if (!focusCell(side, row - 1, "text", { at: "end" })) e.currentTarget.blur();
            onDelete(r.id);
            return;
          }
          navKey(e, side, row, "text");
        }}
        style={inkTextarea(rule, shade(side, r.weight))}
      />
      <WeightInput
        side={side}
        row={row}
        value={r.weight}
        color={shadeStroke(side, r.weight)}
        rule={rule}
        onCommit={(n) => onUpdate(r.id, r.text, n)}
        onKeyDownExtra={(e) => {
          if (e.key === "Enter" || e.key === "Escape") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
      />
    </div>
  );
}

export default function ReasonColumn({
  side,
  reasons,
  rule,
  draggingId,
  listHeight,
  onRowPointerDown,
  onUpdateReason,
  onAddReason,
  onDeleteReason,
}) {
  const accent = ACCENT[side];
  const listRef = useRef(null);

  // ── the composer (the "first empty line": click it to start writing) ──
  const [draft, setDraft] = useState("");
  const [draftWeight, setDraftWeight] = useState(5);
  const [active, setActive] = useState(false);
  const taRef = useRef(null);

  const commitDraft = () => {
    const t = draft.trim();
    if (t) onAddReason(side, t, draftWeight);
    setDraft("");
    // keep the caret on the now-next line, like typing in a document
    requestAnimationFrame(() => {
      autosize(taRef.current);
      taRef.current?.focus();
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });
  };
  const onDraftKey = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitDraft();
      return;
    }
    if (e.key === "Escape") {
      setDraft("");
      setActive(false);
      e.currentTarget.blur();
      return;
    }
    // Backspace on the empty composer walks back up to the previous reason —
    // the mirror image of Enter, which had dropped the caret down onto this
    // fresh line. Leaving lets the composer fall back to its "new reason" hint.
    if (
      e.key === "Backspace" &&
      e.currentTarget.tagName === "TEXTAREA" &&
      !draft &&
      reasons.length > 0
    ) {
      e.preventDefault();
      setActive(false);
      focusCell(side, reasons.length - 1, "text", { at: "end" });
      return;
    }
    // the composer is the column's last nav row
    navKey(e, side, reasons.length, e.currentTarget.tagName === "TEXTAREA" ? "text" : "weight");
  };
  const onDraftBlur = (e) => {
    // moving between the textarea and its weight box isn't leaving the composer
    if (e.relatedTarget && e.currentTarget.parentNode.contains(e.relatedTarget)) return;
    const t = draft.trim();
    if (t) onAddReason(side, t, draftWeight);
    setDraft("");
    setActive(false);
  };

  const crowded = reasons.length >= CROWDED_AT;

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* The writing area: a fixed-height "page" of ruled lines. Reasons stack
          from the top; the composer fills whatever is left, so a click anywhere
          in the blank space drops the caret onto the first empty line.
          PROS scrolls on its left edge, CONS on its right (see index.css). */}
      <div
        ref={listRef}
        className={`reason-list ${side === "pro" ? "list-pro" : "list-con"}`}
        style={{
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          overflowX: "hidden",
          height: listHeight,
        }}
      >
        {reasons.map((r, i) => (
          <ReasonRow
            key={r.id}
            side={side}
            row={i}
            r={r}
            rule={rule}
            dragging={draggingId === r.id}
            onRowPointerDown={onRowPointerDown}
            onUpdate={onUpdateReason}
            onDelete={onDeleteReason}
          />
        ))}

        {/* composer — always the last line; grows to fill the blank page */}
        <div
          className="composer"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) {
              e.preventDefault();
              taRef.current?.focus();
            }
          }}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
            flex: "1 0 auto",
            minHeight: rule,
            cursor: "text",
          }}
        >
          <textarea
            ref={taRef}
            rows={1}
            data-nav={`${side}:${reasons.length}:text`}
            value={draft}
            placeholder={active ? "" : "new reason…"}
            onFocus={() => setActive(true)}
            onChange={(e) => {
              setDraft(e.currentTarget.value);
              autosize(e.currentTarget);
            }}
            onKeyDown={onDraftKey}
            onBlur={onDraftBlur}
            style={{ ...inkTextarea(rule, shade(side, draftWeight)), "--ph": accent.faint }}
          />
          {active && (
            <WeightInput
              side={side}
              row={reasons.length}
              value={draftWeight}
              color={shadeStroke(side, draftWeight)}
              rule={rule}
              onCommit={setDraftWeight}
              onKeyDownExtra={onDraftKey}
              onBlurExtra={onDraftBlur}
            />
          )}
        </div>
      </div>

      {crowded && (
        <div
          style={{
            font: "700 14px Kalam, Caveat, cursive",
            color: accent.text,
            opacity: 0.85,
            transform: "rotate(-0.1deg)",
            whiteSpace: "nowrap",
            marginTop: 9,
          }}
        >
          easy there, keep to the key reasons
        </div>
      )}
    </div>
  );
}
