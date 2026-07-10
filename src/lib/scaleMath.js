// ── Visual math for the decision scale ──────────────────────────────────────
// Ported from the exported design prototype (Pros N Cons.dc.html). These pure
// helpers define how a reason's 1–10 weight maps to size/color, how the beam
// tilts, and how balls settle into a pan. Kept framework-free so both the
// Scale SVG and the reason rows can share them.

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

// ── Deterministic gravity settling ──────────────────────────────────────────
// Each ball drops and rests on the floor or on top of already-placed balls
// (no overlap). Returns { [id]: {x, y} } in pan-local coordinates where x=0 is
// the pan center and y grows downward. `panWidth` is the half-width bound.
export function packBalls(balls, panWidth, floorY) {
  const half = panWidth - 8;
  const steps = 72;
  const placed = [];
  const pos = {};
  for (const b of balls) {
    const r = b.r;
    let xmin = -half + r;
    let xmax = half - r;
    if (xmax < xmin) {
      xmin = 0;
      xmax = 0;
    }
    let best = null;
    for (let i = 0; i <= steps; i++) {
      const x = xmin + (xmax - xmin) * (steps ? i / steps : 0);
      let y = floorY - r; // resting on the flat floor
      for (const q of placed) {
        // or resting on top of an existing ball
        const dx = x - q.x;
        const rr = r + q.r;
        if (Math.abs(dx) < rr) {
          const yy = q.y - Math.sqrt(rr * rr - dx * dx);
          if (yy < y) y = yy;
        }
      }
      // pick the deepest rest (largest y); tie -> closest to centre
      if (
        !best ||
        y > best.y + 0.02 ||
        (Math.abs(y - best.y) <= 0.02 && Math.abs(x) < Math.abs(best.x))
      ) {
        best = { x, y };
      }
    }
    placed.push({ x: best.x, y: best.y, r });
    pos[b.id] = { x: best.x, y: best.y };
  }
  return pos;
}
