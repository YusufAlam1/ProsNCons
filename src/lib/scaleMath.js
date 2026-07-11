// ── Visual math for the decision scale ──────────────────────────────────────
// Ported from the exported design prototype (Pros N Cons.dc.html). These pure
// helpers define how a reason's 1–10 weight maps to size/color and how far
// the beam tilts. Kept framework-free so the Scale, the physics sim
// (scalePhysics.js) and the reason rows can all share them. How balls FALL
// and settle is matter-js physics now — see scalePhysics.js.

export const clampWeight = (w) => Math.max(1, Math.min(10, w));

// Weight → fill color. Pros ramp green, cons ramp red; heavier = deeper.
export function shade(side, w) {
  const f = (clampWeight(w) - 1) / 9;
  if (side === "pro") return `hsl(95 52% ${70 - f * 36}%)`;
  return `hsl(6 66% ${64 - f * 30}%)`;
}

// Weight → darker stroke/accent color (used for ball outlines + weight numbers).
export function shadeStroke(side, w) {
  const f = (clampWeight(w) - 1) / 9;
  if (side === "pro") return `hsl(95 55% ${Math.max(20, 70 - f * 36 - 16)}%)`;
  return `hsl(6 68% ${Math.max(22, 64 - f * 30 - 15)}%)`;
}

// Weight → ball radius.
export const ballRadius = (w) => 7 + clampWeight(w) * 1.7;

export const sumWeights = (arr) => arr.reduce((t, r) => t + r.weight, 0);

// net > 0 favors pros, < 0 favors cons.
export const netWeight = (pros, cons) => sumWeights(pros) - sumWeights(cons);

// Net weight → beam tilt in degrees, softened so it saturates near ±15°.
export const tiltFor = (net, sensitivity = 10) => 15 * Math.tanh(net / sensitivity);

export function verdictFor(net) {
  const mag = Math.abs(net);
  if (net > 0) return { word: "FAVORS", color: shade("pro", mag) };
  if (net < 0) return { word: "DISFAVORS", color: shade("con", mag) };
  return { word: "BALANCES", color: "#8a8a8a" };
}
