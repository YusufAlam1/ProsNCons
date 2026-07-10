import React from "react";

const DK = "#2b2b2b";

// Clean-SVG trash can. The lid tilts open while a reason is dragged over it,
// and the "drop to delete" hint only shows while dragging.
export default function Trash({ open, dragging }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
      }}
    >
      <svg width={74} height={96} viewBox="0 0 74 96" style={{ overflow: "visible" }}>
        {/* bucket body */}
        <path
          d="M12 28 L18 82 Q18 86 22 86 L52 86 Q56 86 56 82 L62 28"
          fill="none"
          stroke={DK}
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <line x1={24} y1={38} x2={26} y2={74} stroke={DK} strokeWidth={2.5} strokeLinecap="round" />
        <line x1={37} y1={38} x2={37} y2={74} stroke={DK} strokeWidth={2.5} strokeLinecap="round" />
        <line x1={50} y1={38} x2={48} y2={74} stroke={DK} strokeWidth={2.5} strokeLinecap="round" />

        {/* lid (rotates open) */}
        <g
          style={{
            transformOrigin: "64px 26px",
            transform: `rotate(${open ? -42 : 0}deg)`,
            transition: "transform .22s ease",
          }}
        >
          <line x1={6} y1={26} x2={68} y2={26} stroke={DK} strokeWidth={3} strokeLinecap="round" />
          <path
            d="M30 26 L32 17 L44 17 L46 26"
            fill="none"
            stroke={DK}
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </g>
      </svg>
      <div
        style={{
          font: "700 12px Kalam, Caveat, cursive",
          color: open ? "#2b2b2b" : "rgba(0,0,0,.4)",
          opacity: dragging ? 1 : 0,
          transition: "opacity .2s",
        }}
      >
        drop to delete
      </div>
    </div>
  );
}
