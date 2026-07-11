import React from "react";
import { rLine, rPath } from "../lib/rough";

const DK = "#2b2b2b";

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

// Hand-drawn trash can. While a reason hovers over it, the lid swings UP,
// hinged at its left corner, and the whole can leans in slightly.
export default function Trash({ open }) {
  return (
    <svg
      width={74}
      height={96}
      viewBox="0 0 74 96"
      style={{
        overflow: "visible",
        transform: `scale(${open ? 1.1 : 1})`,
        transformOrigin: "50% 100%",
        transition: "transform .22s ease",
      }}
    >
      {paint(BODY_PATHS, 3, "tb")}
      <g
        style={{
          transformOrigin: "6px 26px",
          transform: `rotate(${open ? -42 : 0}deg)`,
          transition: "transform .22s ease",
        }}
      >
        {paint(LID_PATHS, 3, "tl")}
      </g>
    </svg>
  );
}
