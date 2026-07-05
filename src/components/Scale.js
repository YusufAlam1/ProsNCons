import React from "react";

// ── geometry constants ──────────────────────────────────────────────────────
const STROKE     = 2;
const W          = 500;
const H          = 440;
const CX         = W / 2;           // 250 – horizontal center

const PIVOT_R    = 5;
const PIVOT_CY   = 48;              // pivot circle center

const BEAM_Y     = 48;              // horizontal beam
const BEAM_LEFT  = 85;
const BEAM_RIGHT = 415;

const SHOULDER_Y = BEAM_Y + 0;    // short vertical drop at each beam end
                                    // before strings branch (108)
const TRAY_W     = 140;          
const TRAY_H     = 52;
const TRAY_TOP   = 258;

const POLE_BTMY  = 412;            // pole height
const BASE_HALF  = 70;             // scale base
// ────────────────────────────────────────────────────────────────────────────

export default function Scale({ style }) {
  // tray left / right edges (trays are centered below each beam endpoint)
  const lTrayL = BEAM_LEFT  - TRAY_W / 2;   // 30
  const lTrayR = BEAM_LEFT  + TRAY_W / 2;   // 170
  const rTrayL = BEAM_RIGHT - TRAY_W / 2;   // 330
  const rTrayR = BEAM_RIGHT + TRAY_W / 2;   // 470

  const ln = {
    stroke: "#1a1a1a",
    strokeWidth: STROKE,
    strokeLinecap: "square",
  };

  return (
    <div style={{ position: "absolute", userSelect: "none", ...style }}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
      >
        {/* ── central pole (from bottom of pivot circle down to base) ── */}
        <line x1={CX} y1={PIVOT_CY + PIVOT_R} x2={CX} y2={POLE_BTMY} {...ln} />

        {/* ── horizontal beam ── */}
        <line x1={BEAM_LEFT} y1={BEAM_Y} x2={BEAM_RIGHT} y2={BEAM_Y} {...ln} />

        {/* ── shoulders: short vertical drop at each beam end ── */}
        <line x1={BEAM_LEFT}  y1={BEAM_Y} x2={BEAM_LEFT}  y2={SHOULDER_Y} {...ln} />
        <line x1={BEAM_RIGHT} y1={BEAM_Y} x2={BEAM_RIGHT} y2={SHOULDER_Y} {...ln} />

        {/* ── T-base ── */}
        <line x1={CX - BASE_HALF} y1={POLE_BTMY} x2={CX + BASE_HALF} y2={POLE_BTMY} {...ln} />

        {/* ── left strings + tray ── */}
        <line x1={BEAM_LEFT} y1={SHOULDER_Y} x2={lTrayL} y2={TRAY_TOP} {...ln} />
        <line x1={BEAM_LEFT} y1={SHOULDER_Y} x2={lTrayR} y2={TRAY_TOP} {...ln} />
        <rect
          x={lTrayL} y={TRAY_TOP}
          width={TRAY_W} height={TRAY_H}
          fill="none" stroke="#1a1a1a" strokeWidth={STROKE}
        />

        {/* ── right strings + tray ── */}
        <line x1={BEAM_RIGHT} y1={SHOULDER_Y} x2={rTrayL} y2={TRAY_TOP} {...ln} />
        <line x1={BEAM_RIGHT} y1={SHOULDER_Y} x2={rTrayR} y2={TRAY_TOP} {...ln} />
        <rect
          x={rTrayL} y={TRAY_TOP}
          width={TRAY_W} height={TRAY_H}
          fill="none" stroke="#1a1a1a" strokeWidth={STROKE}
        />

        {/* ── pivot circle (drawn last so it sits on top of the pole) ── */}
        <circle
          cx={CX} cy={PIVOT_CY} r={PIVOT_R}
          fill="none" stroke="#1a1a1a" strokeWidth={STROKE}
        />
      </svg>
    </div>
  );
}
