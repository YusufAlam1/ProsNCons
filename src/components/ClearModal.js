import React, { useMemo } from "react";
import { rLine } from "../lib/rough";

// The "clear the page" flow, opened by right-clicking the trash can. Two
// steps on one paper card: pick a scope (all pros / all cons / everything),
// then a second "are you sure" — both drawn in the notebook's own hand:
// rough-inked frame, marker headings, Kalam body text.

const MARKER = "'Permanent Marker', cursive";
const HAND = "Kalam, Caveat, cursive";
const DK = "#2b2b2b";
const PRO = "#3f8a1a";
const CON = "#c3352c";

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

// hand-inked border around the card (seeded per size, so it never re-scribbles)
function Frame({ w, h, seed }) {
  const paths = useMemo(
    () => [
      ...rLine(4, 4, w - 4, 4, seed, 3),
      ...rLine(w - 4, 4, w - 4, h - 4, seed + 1, 3),
      ...rLine(w - 4, h - 4, 4, h - 4, seed + 2, 3),
      ...rLine(4, h - 4, 4, 4, seed + 3, 3),
    ],
    [w, h, seed]
  );
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}
    >
      {paint(paths, 3, "fr")}
    </svg>
  );
}

function Option({ color, disabled, onClick, children }) {
  return (
    <button
      type="button"
      className="modal-opt"
      disabled={disabled}
      onClick={onClick}
      style={{ color, fontFamily: MARKER, fontSize: 21 }}
    >
      {children}
    </button>
  );
}

const CARD_W = 400;

export default function ClearModal({ proCount, conCount, scope, onScope, onConfirm, onClose }) {
  const total = proCount + conCount;
  const counts = { pro: proCount, con: conCount, all: total };
  const noun = { pro: "pros", con: "cons", all: "reasons" };
  const confirming = scope != null;
  const cardH = confirming ? 224 : 336;

  return (
    <div
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 30,
        background: "rgba(29,29,29,0.28)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        className="modal-card"
        style={{
          position: "relative",
          width: CARD_W,
          height: cardH,
          background: "#fffef8",
          borderRadius: 10,
          boxShadow: "0 18px 50px rgba(0,0,0,.28)",
          transform: "rotate(-0.6deg)",
        }}
      >
        <Frame w={CARD_W} h={cardH} seed={confirming ? 80 : 70} />

        {!confirming ? (
          <div style={{ position: "relative", padding: "24px 30px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontFamily: MARKER, fontSize: 29, color: DK, transform: "rotate(-0.4deg)" }}>
              Clear the page?
            </div>
            <div style={{ font: `700 15px ${HAND}`, color: "#8f8f8b", marginTop: -6, marginBottom: 4 }}>
              what should the trash take?
            </div>
            <Option color={PRO} disabled={!proCount} onClick={() => onScope("pro")}>
              all the PROS <span style={{ font: `700 16px ${HAND}` }}>({proCount})</span>
            </Option>
            <Option color={CON} disabled={!conCount} onClick={() => onScope("con")}>
              all the CONS <span style={{ font: `700 16px ${HAND}` }}>({conCount})</span>
            </Option>
            <Option color={DK} disabled={!total} onClick={() => onScope("all")}>
              EVERYTHING <span style={{ font: `700 16px ${HAND}` }}>({total})</span>
            </Option>
            <button type="button" className="modal-dismiss" onClick={onClose}>
              never mind
            </button>
          </div>
        ) : (
          <div style={{ position: "relative", padding: "24px 30px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontFamily: MARKER, fontSize: 29, color: DK, transform: "rotate(-0.4deg)" }}>
              Are you sure?
            </div>
            <div style={{ font: `700 16.5px ${HAND}`, color: "#4a4a47", lineHeight: 1.45 }}>
              The trash will crumple up {counts[scope]} {counts[scope] === 1 ? noun[scope].slice(0, -1) : noun[scope]}.
              <br />
              <span style={{ color: "#8f8f8b" }}>(Ctrl+Z can still rescue them.)</span>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
              <button
                type="button"
                className="modal-opt"
                onClick={onConfirm}
                style={{ color: CON, fontFamily: MARKER, fontSize: 20, flex: 1 }}
              >
                yes, clear
              </button>
              <button
                type="button"
                className="modal-opt"
                onClick={() => onScope(null)}
                style={{ color: DK, fontFamily: MARKER, fontSize: 20, flex: 1 }}
              >
                keep them
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
