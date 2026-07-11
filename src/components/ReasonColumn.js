import { useState } from "react";
import { clampWeight, shade, shadeStroke } from "../lib/scaleMath";

// Per-side accent colors for the add/edit forms (from the design prototype).
const ACCENT = {
  pro: { line: "#4b9a1e", text: "#3f8a1a", plus: "#4b9a1e" },
  con: { line: "#cf3b32", text: "#c3352c", plus: "#cf3b32" },
};

// past this many reasons in one column, gently push back
const CROWDED_AT = 8;

const textInputStyle = (accent) => ({
  flex: 1,
  // minWidth 0 beats the flex-item default of min-width:auto —
  // without it the input's intrinsic size overflows the column
  minWidth: 0,
  boxSizing: "border-box",
  border: "none",
  borderBottom: `2px solid ${accent.line}`,
  outline: "none",
  background: "transparent",
  font: "700 22px Kalam, Caveat, cursive",
  color: accent.text,
});

const numInputStyle = (accent) => ({
  flex: "none",
  width: 38,
  boxSizing: "border-box",
  border: "none",
  borderBottom: `2px solid ${accent.line}`,
  outline: "none",
  background: "transparent",
  font: "700 26px Kalam, Caveat, cursive",
  color: accent.text,
  textAlign: "center",
});

export default function ReasonColumn({
  side,
  reasons,
  adding,
  draftText,
  draftWeight,
  draggingId,
  maxListHeight,
  onRowPointerDown,
  onOpenAdd,
  onUpdateReason,
  onDraftText,
  onDraftWeight,
  onDraftKey,
}) {
  const accent = ACCENT[side];

  // inline edit state (double-click a row to open it)
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
      {/* only the reason rows scroll; the ＋ / add form stays put below.
          PROS scrolls on its left edge, CONS on its right (see index.css) */}
      <div
        className={`reason-list ${side === "pro" ? "list-pro" : "list-con"}`}
        style={{
          overflowY: "auto",
          overflowX: "hidden",
          maxHeight: maxListHeight,
        }}
      >
        {reasons.map((r) =>
          editId === r.id ? (
            <div
              key={r.id}
              onBlur={(e) => {
                // save when focus leaves the whole edit row (not just moving
                // between its text and weight inputs)
                if (!e.currentTarget.contains(e.relatedTarget)) saveEdit();
              }}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 8,
                minHeight: 44,
                lineHeight: "44px",
              }}
            >
              <input
                autoFocus
                value={eText}
                onInput={(e) => setEText(e.currentTarget.value)}
                onKeyDown={onEditKey}
                style={textInputStyle(accent)}
              />
              <input
                type="number"
                min="1"
                max="10"
                value={eWeight}
                onInput={(e) =>
                  setEWeight(clampWeight(+e.currentTarget.value || 1))
                }
                onKeyDown={onEditKey}
                style={numInputStyle(accent)}
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
                justifyContent: "space-between",
                gap: 12,
                minHeight: 44,
                cursor: "grab",
                userSelect: "none",
                touchAction: "none",
                opacity: draggingId === r.id ? 0.25 : 1,
              }}
            >
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  font: "700 24px/44px Kalam, Caveat, cursive",
                  color: shade(side, r.weight),
                  overflowWrap: "anywhere",
                }}
              >
                {r.text}
              </span>
              <span
                style={{
                  flex: "none",
                  font: "700 27px/44px Kalam, Caveat, cursive",
                  color: shadeStroke(side, r.weight),
                }}
              >
                {r.weight}
              </span>
            </div>
          ),
        )}
      </div>

      {adding ? (
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            minHeight: 44,
            lineHeight: "44px",
          }}
        >
          <input
            autoFocus
            placeholder="write a reason…"
            value={draftText}
            onInput={onDraftText}
            onKeyDown={onDraftKey}
            style={textInputStyle(accent)}
          />
          <input
            type="number"
            min="1"
            max="10"
            value={draftWeight}
            onInput={onDraftWeight}
            onKeyDown={onDraftKey}
            style={numInputStyle(accent)}
          />
        </div>
      ) : (
        <button
          title={`add a ${side}`}
          className="add-plus"
          onClick={onOpenAdd}
          style={{
            alignSelf: "flex-start",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: accent.plus,
            font: "400 36px 'Permanent Marker', cursive",
            lineHeight: "44px",
            padding: "0 4px",
          }}
        >
          ＋
        </button>
      )}

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
