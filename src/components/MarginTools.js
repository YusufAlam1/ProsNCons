import React from "react";
import { rLine, rPath } from "../lib/rough";
import { shade } from "../lib/scaleMath";

// Little doodles that live in the notebook's red margin: undo / redo arrows
// and the weights on/off switch. Drawn with the same seeded rough strokes as
// the rest of the page so they read as part of the notebook, not chrome.

const DK = "#2b2b2b";
const HAND = "Kalam, Caveat, cursive";

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

// hand-drawn ↶ / ↷: an over-the-top hook arriving straight down, with two
// barbs for the arrowhead (seeded — sketched once at module load)
const UNDO_PATHS = [
  ...rPath("M 28 22 Q 29 8 18 8 Q 7 8 7 19", 11, 3),
  ...rLine(7, 19, 2.5, 15, 12, 3),
  ...rLine(7, 19, 11.5, 15, 13, 3),
];
const REDO_PATHS = [
  ...rPath("M 8 22 Q 7 8 18 8 Q 29 8 29 19", 14, 3),
  ...rLine(29, 19, 24.5, 15, 15, 3),
  ...rLine(29, 19, 33.5, 15, 16, 3),
];
// a faint pencil tick separating the arrows from the switch
const DIVIDER_PATHS = rLine(0, 3, 28, 3, 17, 2);

function MarginButton({ tip, disabled, onClick, paths }) {
  return (
    <button
      type="button"
      className="margin-btn mtip"
      data-tip={tip}
      disabled={disabled}
      onClick={onClick}
    >
      <svg width={30} height={30} viewBox="0 0 36 36" style={{ display: "block", overflow: "visible" }}>
        {paint(paths, 3, "g")}
      </svg>
    </button>
  );
}

// The weights switch: green + knob right = weights shown, red + knob left =
// everything counts the same (see the Board's `hideWeights`).
function WeightToggle({ on, onToggle }) {
  return (
    <button
      type="button"
      className="margin-btn mtip"
      data-tip={on ? "hide weights — Alt+W" : "show weights — Alt+W"}
      aria-pressed={on}
      onClick={onToggle}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}
    >
      <div
        style={{
          position: "relative",
          width: 46,
          height: 24,
          boxSizing: "border-box",
          border: `2.5px solid ${DK}`,
          borderRadius: 999,
          background: on ? shade("pro", 6) : shade("con", 6),
          transition: "background .25s ease",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: on ? 22 : 0,
            width: 15,
            height: 15,
            border: `2px solid ${DK}`,
            borderRadius: "50%",
            background: "#fff",
            transition: "left .22s ease",
          }}
        />
      </div>
      <div style={{ font: `700 12px ${HAND}`, color: "#8f8f8b", transform: "rotate(-0.5deg)" }}>
        weights
      </div>
    </button>
  );
}

export default function MarginTools({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  weightsOn,
  onToggleWeights,
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <MarginButton tip="undo — Ctrl+Z" disabled={!canUndo} onClick={onUndo} paths={UNDO_PATHS} />
      <MarginButton tip="redo — Ctrl+Y" disabled={!canRedo} onClick={onRedo} paths={REDO_PATHS} />
      <svg width={28} height={6} viewBox="0 0 28 6" style={{ margin: "4px 0", opacity: 0.3 }}>
        {paint(DIVIDER_PATHS, 2, "d")}
      </svg>
      <WeightToggle on={weightsOn} onToggle={onToggleWeights} />
    </div>
  );
}
