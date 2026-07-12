import React, { useMemo, useState } from "react";
import { rLine } from "../lib/rough";
import { shade, shadeStroke } from "../lib/scaleMath";

// The trash can's menu, opened by clicking the can. Four views on one paper
// card, all in the notebook's own hand (rough-inked frame, marker headings,
// Kalam body):
//   menu         — view the stash, or clear the page
//   trash        — a mini T-chart of stashed reasons: restore ↩ or shred ✕
//   confirmClear — scope picked; choose the destination: trash or outright
//   confirmEmpty — the one truly destructive step, so it double-checks
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

const Count = ({ n }) => <span style={{ font: `700 16px ${HAND}` }}>({n})</span>;

// one stashed reason in the mini T-chart
function TrashRow({ r, onRestore, onShred }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 6, padding: "2px 6px" }}>
      <span
        style={{
          flex: 1,
          font: `700 15px ${HAND}`,
          color: shade(r.side, 5),
          overflowWrap: "anywhere",
        }}
      >
        {r.text}
      </span>
      <span style={{ font: `700 15px ${HAND}`, color: shadeStroke(r.side, 5) }}>{r.weight}</span>
      <button
        type="button"
        className="trow-btn"
        title="restore to the scale"
        style={{ color: PRO }}
        onClick={() => onRestore(r.id)}
      >
        ↩
      </button>
      <button
        type="button"
        className="trow-btn"
        title="shred forever"
        style={{ color: CON }}
        onClick={() => onShred(r.id)}
      >
        ✕
      </button>
    </div>
  );
}

const CARD_W = { menu: 400, trash: 560, confirmClear: 400, confirmEmpty: 400 };
const CARD_H = { menu: 424, trash: 440, confirmClear: 330, confirmEmpty: 232 };
const SEED = { menu: 70, trash: 90, confirmClear: 80, confirmEmpty: 100 };

export default function TrashModal({
  proCount,
  conCount,
  trash,
  onClear,
  onRestore,
  onShred,
  onEmptyTrash,
  onClose,
}) {
  const [view, setView] = useState("menu");
  const [scope, setScope] = useState(null); // 'pro' | 'con' | 'all'
  const total = proCount + conCount;
  const counts = { pro: proCount, con: conCount, all: total };
  const noun = { pro: "pros", con: "cons", all: "reasons" };

  const trashPros = trash.filter((r) => r.side === "pro");
  const trashCons = trash.filter((r) => r.side === "con");
  const w = CARD_W[view];
  const h = CARD_H[view];

  // the trash view's own little T: crossbar under the headers, divider down
  // the middle — a pocket copy of the main page's chart
  const chartDecor = useMemo(() => {
    if (view !== "trash") return null;
    return [
      ...paint(rLine(30, 108, w - 30, 108, 95, 2.5), 2.5, "tc"),
      ...paint(rLine(w / 2, 82, w / 2, 322, 96, 2.5), 2.5, "td"),
    ];
  }, [view, w]);

  const title = (text) => (
    <div style={{ fontFamily: MARKER, fontSize: 29, color: DK, transform: "rotate(-0.4deg)" }}>
      {text}
    </div>
  );

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
          width: w,
          height: h,
          background: "#fffef8",
          borderRadius: 10,
          boxShadow: "0 18px 50px rgba(0,0,0,.28)",
          transform: "rotate(-0.6deg)",
        }}
      >
        <Frame w={w} h={h} seed={SEED[view]} />

        {view === "menu" && (
          <div style={{ position: "relative", padding: "24px 30px", display: "flex", flexDirection: "column", gap: 10 }}>
            {title("The Trash")}
            <div style={{ font: `700 15px ${HAND}`, color: "#8f8f8b", marginTop: -6, marginBottom: 4 }}>
              dig through it, or clear the page
            </div>
            <Option color={DK} onClick={() => setView("trash")}>
              view the trash <Count n={trash.length} />
            </Option>
            <svg width={90} height={6} viewBox="0 0 90 6" style={{ alignSelf: "center", opacity: 0.3 }}>
              {paint(rLine(0, 3, 90, 3, 76, 2), 2, "dv")}
            </svg>
            <Option color={PRO} disabled={!proCount} onClick={() => { setScope("pro"); setView("confirmClear"); }}>
              clear the PROS <Count n={proCount} />
            </Option>
            <Option color={CON} disabled={!conCount} onClick={() => { setScope("con"); setView("confirmClear"); }}>
              clear the CONS <Count n={conCount} />
            </Option>
            <Option color={DK} disabled={!total} onClick={() => { setScope("all"); setView("confirmClear"); }}>
              clear EVERYTHING <Count n={total} />
            </Option>
            <button type="button" className="modal-dismiss" onClick={onClose}>
              never mind
            </button>
          </div>
        )}

        {view === "trash" && (
          <div style={{ position: "relative", padding: "20px 26px", display: "flex", flexDirection: "column", height: "100%", boxSizing: "border-box" }}>
            {title("In the trash")}
            {trash.length === 0 ? (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  font: `700 16px ${HAND}`,
                  color: "#8f8f8b",
                  textAlign: "center",
                }}
              >
                nothing stashed — drop a reason onto the can
                <br />
                (or press Alt+T while writing one)
              </div>
            ) : (
              <>
                <svg
                  width={w}
                  height={h}
                  viewBox={`0 0 ${w} ${h}`}
                  style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}
                >
                  {chartDecor}
                </svg>
                <div style={{ display: "flex", marginTop: 8 }}>
                  <div style={{ flex: 1, textAlign: "center", fontFamily: MARKER, fontSize: 19, color: PRO }}>
                    PROS
                  </div>
                  <div style={{ flex: 1, textAlign: "center", fontFamily: MARKER, fontSize: 19, color: CON }}>
                    CONS
                  </div>
                </div>
                <div style={{ display: "flex", flex: 1, minHeight: 0, marginTop: 10, gap: 14 }}>
                  <div className="reason-list" style={{ flex: 1, overflowY: "auto", minWidth: 0, paddingRight: 6 }}>
                    {trashPros.map((r) => (
                      <TrashRow key={r.id} r={r} onRestore={onRestore} onShred={onShred} />
                    ))}
                  </div>
                  <div className="reason-list" style={{ flex: 1, overflowY: "auto", minWidth: 0, paddingLeft: 6 }}>
                    {trashCons.map((r) => (
                      <TrashRow key={r.id} r={r} onRestore={onRestore} onShred={onShred} />
                    ))}
                  </div>
                </div>
              </>
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18, marginTop: 12 }}>
              <button
                type="button"
                className="modal-opt"
                disabled={!trash.length}
                onClick={() => setView("confirmEmpty")}
                style={{ color: CON, fontFamily: MARKER, fontSize: 17, padding: "4px 12px" }}
              >
                empty the trash
              </button>
              <button type="button" className="modal-dismiss" style={{ marginTop: 0 }} onClick={() => setView("menu")}>
                back
              </button>
            </div>
          </div>
        )}

        {view === "confirmClear" && (
          <div style={{ position: "relative", padding: "24px 30px", display: "flex", flexDirection: "column", gap: 10 }}>
            {title("Are you sure?")}
            <div style={{ font: `700 16px ${HAND}`, color: "#4a4a47", marginTop: -2, marginBottom: 2 }}>
              Take {counts[scope]} {counts[scope] === 1 ? noun[scope].slice(0, -1) : noun[scope]} off the scale…
            </div>
            <Option color={DK} onClick={() => onClear(scope, "trash")}>
              into the trash <span style={{ font: `700 14px ${HAND}`, color: "#8f8f8b" }}>stash for later</span>
            </Option>
            <Option color={CON} onClick={() => onClear(scope, "delete")}>
              delete outright <span style={{ font: `700 14px ${HAND}`, color: "#8f8f8b" }}>Ctrl+Z can rescue</span>
            </Option>
            <Option color={DK} onClick={() => setView("menu")}>
              keep them
            </Option>
          </div>
        )}

        {view === "confirmEmpty" && (
          <div style={{ position: "relative", padding: "24px 30px", display: "flex", flexDirection: "column", gap: 12 }}>
            {title("Shred everything?")}
            <div style={{ font: `700 16.5px ${HAND}`, color: "#4a4a47", lineHeight: 1.45 }}>
              This shreds {trash.length} stashed {trash.length === 1 ? "reason" : "reasons"} for good.
              <br />
              <span style={{ color: CON }}>Not even Ctrl+Z brings these back.</span>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
              <button
                type="button"
                className="modal-opt"
                onClick={() => {
                  onEmptyTrash();
                  setView("trash");
                }}
                style={{ color: CON, fontFamily: MARKER, fontSize: 20, flex: 1 }}
              >
                yes, shred
              </button>
              <button
                type="button"
                className="modal-opt"
                onClick={() => setView("trash")}
                style={{ color: DK, fontFamily: MARKER, fontSize: 20, flex: 1 }}
              >
                back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
