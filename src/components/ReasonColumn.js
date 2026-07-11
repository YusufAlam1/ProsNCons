import { useRef, useState } from "react";
import { clampWeight, shade, shadeStroke } from "../lib/scaleMath";

// Per-side ink colors for the handwriting.
const ACCENT = {
  pro: { text: "#3f8a1a", faint: "rgba(63,138,26,0.5)" },
  con: { text: "#c3352c", faint: "rgba(195,53,44,0.5)" },
};

// past this many reasons in one column, gently push back
const CROWDED_AT = 8;

// Handwriting size, and how far the baseline is pushed DOWN within each ruled
// band so letters rest ON the line (which sits at the bottom of the band) and
// descenders like g / y dip just below it — real writing, not floating text.
// One line box == one rule, so wrapped lines each land on their own rule and a
// reason that spills over reads like a continued sentence on lined paper.
const FONT = 23;
const DROP = 9;
const WEIGHT_W = 30;

// Grow a textarea to whole ruled lines. Its line-height IS the rule and its top
// padding is DROP, so scrollHeight always lands on rule-multiples + DROP.
function autosize(el) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

// the reason text — a textarea styled to vanish into the paper
const inkTextarea = (rule, color) => ({
  flex: 1,
  minWidth: 0,
  boxSizing: "border-box",
  margin: 0,
  padding: `${DROP}px 0 0`,
  border: "none",
  outline: "none",
  resize: "none",
  overflow: "hidden",
  background: "transparent",
  fontFamily: "Kalam, Caveat, cursive",
  fontWeight: 700,
  fontSize: FONT,
  lineHeight: `${rule}px`,
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

// text/weight of a settled reason, shifted the same DROP so it rests on the rule
const inkSpan = (rule, color, extra) => ({
  fontFamily: "Kalam, Caveat, cursive",
  fontWeight: 700,
  fontSize: FONT,
  lineHeight: `${rule}px`,
  color,
  transform: `translateY(${DROP}px)`,
  ...extra,
});

export default function ReasonColumn({
  side,
  reasons,
  rule,
  draggingId,
  listHeight,
  onRowPointerDown,
  onUpdateReason,
  onAddReason,
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
    }
    if (e.key === "Escape") {
      setDraft("");
      setActive(false);
      taRef.current?.blur();
    }
  };
  const onDraftBlur = (e) => {
    // moving between the textarea and its weight box isn't leaving the composer
    if (e.relatedTarget && e.currentTarget.parentNode.contains(e.relatedTarget)) return;
    const t = draft.trim();
    if (t) onAddReason(side, t, draftWeight);
    setDraft("");
    setActive(false);
  };

  // ── inline edit (double-click a settled reason) ──
  const [editId, setEditId] = useState(null);
  const [eText, setEText] = useState("");
  const [eWeight, setEWeight] = useState(5);

  const startEdit = (r) => {
    setEditId(r.id);
    setEText(r.text);
    setEWeight(r.weight);
  };
  const saveEdit = () => {
    if (editId == null) return;
    const t = eText.trim();
    if (t) onUpdateReason(editId, t, eWeight);
    setEditId(null);
  };
  const onEditKey = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveEdit();
    }
    if (e.key === "Escape") setEditId(null);
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
        {reasons.map((r) =>
          editId === r.id ? (
            <div
              key={r.id}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) saveEdit();
              }}
              style={{ display: "flex", alignItems: "flex-start", gap: 12, flex: "0 0 auto" }}
            >
              <textarea
                autoFocus
                rows={1}
                ref={(el) => autosize(el)}
                value={eText}
                onChange={(e) => {
                  setEText(e.currentTarget.value);
                  autosize(e.currentTarget);
                }}
                onKeyDown={onEditKey}
                style={inkTextarea(rule, shade(side, eWeight))}
              />
              <input
                type="number"
                min="1"
                max="10"
                value={eWeight}
                onChange={(e) => setEWeight(clampWeight(+e.currentTarget.value || 1))}
                onKeyDown={onEditKey}
                style={inkWeight(rule, shadeStroke(side, eWeight))}
              />
            </div>
          ) : (
            <div
              key={r.id}
              className="reason"
              title="drag to the trash to delete · double-click to edit"
              onPointerDown={(e) => onRowPointerDown(e, r)}
              onDoubleClick={() => startEdit(r)}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                flex: "0 0 auto",
                minHeight: rule,
                cursor: "grab",
                userSelect: "none",
                touchAction: "none",
                opacity: draggingId === r.id ? 0.25 : 1,
              }}
            >
              <span style={inkSpan(rule, shade(side, r.weight), { flex: 1, minWidth: 0, overflowWrap: "anywhere" })}>
                {r.text}
              </span>
              <span style={inkSpan(rule, shadeStroke(side, r.weight), { flex: "none", width: WEIGHT_W, textAlign: "right" })}>
                {r.weight}
              </span>
            </div>
          ),
        )}

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
            <input
              type="number"
              min="1"
              max="10"
              value={draftWeight}
              onChange={(e) => setDraftWeight(clampWeight(+e.currentTarget.value || 1))}
              onKeyDown={onDraftKey}
              onBlur={onDraftBlur}
              style={inkWeight(rule, shadeStroke(side, draftWeight))}
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
