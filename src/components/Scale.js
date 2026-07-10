import React from "react";
import {
  shade,
  shadeStroke,
  ballRadius,
  netWeight,
  tiltFor,
  packBalls,
} from "../lib/scaleMath";

// ── geometry (matches the exported design's 560×648 scale) ──────────────────
const VW = 560;
const VH = 648;
const CX = 280; // pivot x
const CY = 58; // pivot / beam y
const L = 176; // half beam length
const POLE_BTM = 636;
const CHAIN_H = 110; // drop from beam to pan rim
const PW = 100; // pan half-width
const DEPTH = 110; // pan depth
const FLOOR_Y = CHAIN_H + DEPTH - 24; // where balls rest, pan-local
const DK = "#2b2b2b"; // ink color
const TRANS = "transform .85s cubic-bezier(.34,1.4,.5,1)";

const line = (x1, y1, x2, y2, sw = 3, key) => (
  <line
    key={key}
    x1={x1}
    y1={y1}
    x2={x2}
    y2={y2}
    stroke={DK}
    strokeWidth={sw}
    strokeLinecap="round"
  />
);

// A "box" pan: two chains angling in to the rim, then a rectangular bucket.
function Pan({ baseX, dx, dy, balls }) {
  const pos = packBalls(balls, PW, FLOOR_Y);
  return (
    <g
      style={{
        transform: `translate(${baseX + dx}px,${CY + dy}px)`,
        transition: TRANS,
      }}
    >
      {line(0, 0, -PW, CHAIN_H, 3, "cl")}
      {line(0, 0, PW, CHAIN_H, 3, "cr")}
      <path
        d={`M${-PW} ${CHAIN_H} L${-PW} ${CHAIN_H + DEPTH - 20} L${PW} ${
          CHAIN_H + DEPTH - 20
        } L${PW} ${CHAIN_H}`}
        fill="none"
        stroke={DK}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      {line(-PW, CHAIN_H, PW, CHAIN_H, 2.5, "rim")}
      {balls.map((b) => {
        const p = pos[b.id] || { x: 0, y: FLOOR_Y };
        return (
          <circle
            key={b.id}
            className="ball"
            cx={p.x}
            cy={p.y}
            r={b.r}
            fill={b.fill}
            stroke={b.stroke}
            strokeWidth={2}
          />
        );
      })}
    </g>
  );
}

const toBalls = (arr) =>
  arr.map((r) => ({
    id: r.id,
    r: ballRadius(r.weight),
    fill: shade(r.side, r.weight),
    stroke: shadeStroke(r.side, r.weight),
  }));

export default function Scale({ pros, cons, sensitivity = 10 }) {
  const net = netWeight(pros, cons);
  const tilt = tiltFor(net, sensitivity);
  const mag = Math.abs(net);

  // beam tilt shifts each pan's attach point so pans hang level
  const a = (tilt * Math.PI) / 180;
  const dLX = L * (1 - Math.cos(a));
  const dLY = L * Math.sin(a);
  const dRX = -L * (1 - Math.cos(a));
  const dRY = -L * Math.sin(a);

  const pivotColor = net === 0 ? "#9a9a9a" : shade(net > 0 ? "pro" : "con", mag);

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: "100%", height: "100%" }}
    >
      {/* structural pole + base */}
      <g>
        {line(CX, CY, CX, POLE_BTM, 4, "pole")}
        {line(CX - 52, POLE_BTM, CX + 52, POLE_BTM, 4, "base")}
      </g>

      <Pan baseX={CX - L} dx={dLX} dy={dLY} balls={toBalls(pros)} />
      <Pan baseX={CX + L} dx={dRX} dy={dRY} balls={toBalls(cons)} />

      {/* tilting beam */}
      <g
        style={{
          transform: `translate(${CX}px,${CY}px) rotate(${-tilt}deg)`,
          transformOrigin: "0px 0px",
          transition: TRANS,
        }}
      >
        {line(-L, 0, L, 0, 4, "beam")}
      </g>

      {/* pivot badge with net magnitude */}
      <g>
        <circle
          cx={CX}
          cy={CY}
          r={26}
          fill={pivotColor}
          stroke={DK}
          strokeWidth={2.5}
        />
        <text
          x={CX}
          y={CY + 8}
          textAnchor="middle"
          fontFamily="Caveat, cursive"
          fontWeight={700}
          fontSize={30}
          fill="#fff"
        >
          {mag}
        </text>
      </g>
    </svg>
  );
}
