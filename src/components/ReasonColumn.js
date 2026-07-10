import React from "react";
import { shade, shadeStroke } from "../lib/scaleMath";

// Per-side accent colors for the add form (from the design prototype).
const ACCENT = {
  pro: { line: "#4b9a1e", text: "#3f8a1a", plus: "#4b9a1e" },
  con: { line: "#cf3b32", text: "#c3352c", plus: "#cf3b32" },
};

export default function ReasonColumn({
  side,
  reasons,
  adding,
  draftText,
  draftWeight,
  draggingId,
  onRowPointerDown,
  onOpenAdd,
  onDraftText,
  onDraftWeight,
  onDraftKey,
}) {
  const accent = ACCENT[side];

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {reasons.map((r) => (
        <div
          key={r.id}
          className="reason"
          onPointerDown={(e) => onRowPointerDown(e, r)}
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
      ))}

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
            style={{
              flex: 1,
              border: "none",
              borderBottom: `2px solid ${accent.line}`,
              outline: "none",
              background: "transparent",
              font: "700 24px Kalam, Caveat, cursive",
              color: accent.text,
            }}
          />
          <input
            type="number"
            min="1"
            max="10"
            value={draftWeight}
            onInput={onDraftWeight}
            onKeyDown={onDraftKey}
            style={{
              width: 44,
              border: "none",
              borderBottom: `2px solid ${accent.line}`,
              outline: "none",
              background: "transparent",
              font: "700 26px Kalam, Caveat, cursive",
              color: accent.text,
              textAlign: "center",
            }}
          />
        </div>
      ) : (
        <button
          title={`add a ${side}`}
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
    </div>
  );
}
