// End-to-end tests for the scale physics, run headless: the sim is stepped
// exactly the way the Scale component steps it from requestAnimationFrame.
import { createScaleSim, GEO, STEP_MS } from "./scalePhysics";
import { tiltFor, ballRadius } from "./scaleMath";

// one call = one 120Hz substep
const stepFor = (sim, ms) => {
  for (let t = 0; t < ms; t += STEP_MS) sim.step(STEP_MS);
};

test("beam stays level until the ball touches, then settles to tiltFor", () => {
  const sim = createScaleSim();
  sim.syncReasons([{ id: 1, side: "pro", weight: 5 }]);

  // while the ball is still airborne the beam must not move at all
  let steps = 0;
  while (sim.getLanded().count === 0 && steps < 1200) {
    expect(sim.snapshot().beamDeg).toBeCloseTo(0, 10);
    sim.step(STEP_MS);
    steps += 1;
  }
  expect(sim.getLanded()).toEqual({ net: 5, count: 1 });
  expect(steps).toBeLessThan(360); // touched down in under 3s of sim time

  // after settling, the tilt matches the pure verdict math
  stepFor(sim, 3000);
  const s = sim.snapshot();
  expect(Math.abs(s.beamDeg - -tiltFor(5))).toBeLessThan(0.75);

  // and the ball rests inside the bowl, near the bottom of the curve
  const b = s.balls[0];
  expect(b.landed).toBe(true);
  expect(Math.abs(b.x - s.pro.x)).toBeLessThan(30);
  expect(b.y).toBeGreaterThan(s.pro.y - 40);
  expect(b.y).toBeLessThan(s.pro.y + GEO.DEPTH);
  sim.destroy();
});

test("heavier reasons fall faster", () => {
  const timeToLand = (weight) => {
    const sim = createScaleSim();
    sim.syncReasons([{ id: 1, side: "pro", weight }]);
    let steps = 0;
    while (sim.getLanded().count === 0 && steps < 1200) {
      sim.step(STEP_MS);
      steps += 1;
    }
    sim.destroy();
    expect(steps).toBeLessThan(1200);
    return steps;
  };
  expect(timeToLand(10)).toBeLessThan(timeToLand(1));
});

test("the ball bounces slightly on touchdown", () => {
  const sim = createScaleSim();
  sim.syncReasons([{ id: 1, side: "con", weight: 6 }]);
  let steps = 0;
  while (sim.getLanded().count === 0 && steps < 1200) {
    sim.step(STEP_MS);
    steps += 1;
  }
  // in the half second after impact the ball must move UP at some point
  let prevY = sim.snapshot().balls[0].y;
  let rose = 0;
  for (let i = 0; i < 60; i++) {
    sim.step(STEP_MS);
    const y = sim.snapshot().balls[0].y;
    rose = Math.max(rose, prevY - y);
    prevY = y;
  }
  expect(rose).toBeGreaterThan(0.2);
  sim.destroy();
});

test("many quick reasons: balls stay inside the bowls, stack, and tilt correctly", () => {
  const reasons = [
    { id: 1, side: "pro", weight: 10 },
    { id: 2, side: "con", weight: 8 },
    { id: 3, side: "pro", weight: 7 },
    { id: 4, side: "con", weight: 3 },
    { id: 5, side: "pro", weight: 4 },
    { id: 6, side: "con", weight: 10 },
    { id: 7, side: "pro", weight: 9 },
    { id: 8, side: "con", weight: 2 },
  ];
  const sim = createScaleSim();
  sim.syncReasons(reasons); // all at once — the spawn queue staggers them

  // the bowl is a hard barrier: at no instant may any ball pass below the
  // shell or drift out of its side's area
  for (let i = 0; i < 1800; i++) {
    sim.step(STEP_MS);
    const s = sim.snapshot();
    for (const b of s.balls) {
      const pan = b.side === "pro" ? s.pro : s.con;
      expect(b.y).toBeLessThan(pan.y + GEO.DEPTH + 5);
      expect(Math.abs(b.x - pan.x)).toBeLessThan(150);
    }
  }

  // everything landed and was counted
  expect(sim.getLanded()).toEqual({ net: 7, count: 8 });

  const s = sim.snapshot();
  expect(Math.abs(s.beamDeg - -tiltFor(7))).toBeLessThan(0.9);

  // settled balls sit inside their bowl...
  const byId = Object.fromEntries(reasons.map((r) => [r.id, r]));
  for (const b of s.balls) {
    const pan = b.side === "pro" ? s.pro : s.con;
    expect(b.landed).toBe(true);
    expect(Math.abs(b.x - pan.x)).toBeLessThanOrEqual(GEO.PW);
    expect(b.y).toBeLessThan(pan.y + GEO.DEPTH);
    expect(b.y).toBeGreaterThan(pan.y - 80);
  }
  // ...resting against each other, not inside each other
  for (const a of s.balls) {
    for (const b of s.balls) {
      if (a.id >= b.id || a.side !== b.side) continue;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const minDist = ballRadius(byId[a.id].weight) + ballRadius(byId[b.id].weight);
      expect(dist).toBeGreaterThan(minDist - 3.5);
    }
  }
  sim.destroy();
});

test("a filling pile plops and stays: no boiling, no ball perched above the rim", () => {
  // six mid-weight balls comfortably fit in one bowl, dropped in succession
  const reasons = Array.from({ length: 6 }, (_, i) => ({
    id: i + 1,
    side: "pro",
    weight: 5 + (i % 3),
  }));
  const sim = createScaleSim();
  sim.syncReasons(reasons);
  stepFor(sim, 12000); // everything lands and settles

  expect(sim.getLanded().count).toBe(6);
  expect(sim.snapshot().balls).toHaveLength(6);

  // for the next two seconds the pile must sit still — the old behaviour
  // (balls sliding UP the bowl wall after landing) shows up as movement here
  const prev = new Map(sim.snapshot().balls.map((b) => [b.id, b]));
  let maxMove = 0;
  for (let i = 0; i < 240; i++) {
    sim.step(STEP_MS);
    for (const b of sim.snapshot().balls) {
      const p = prev.get(b.id);
      maxMove = Math.max(maxMove, Math.hypot(b.x - p.x, b.y - p.y));
      prev.set(b.id, b);
    }
  }
  expect(maxMove).toBeLessThan(0.35);

  // …and entirely INSIDE the bowl: every centre below the rim line, within it
  const s = sim.snapshot();
  for (const b of s.balls) {
    expect(b.y).toBeGreaterThan(s.pro.y + 2);
    expect(Math.abs(b.x - s.pro.x)).toBeLessThan(GEO.PW);
  }
  sim.destroy();
});

test("an over-full bowl: balls return and retry, then spill for good, credit kept", () => {
  const reasons = Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    side: "con",
    weight: 10,
  }));
  const sim = createScaleSim();
  sim.syncReasons(reasons);

  // Once a ball has touched down it is credited for good. A ball that then
  // spills is returned to the top and re-dropped — but it keeps its credit the
  // whole time, so the count must never fall back below 12 while balls rain
  // back in and retry (the verdict can't flicker).
  let everFull = false;
  for (let i = 0; i < 7200; i++) {
    // 60s at 120Hz
    sim.step(STEP_MS);
    const { count } = sim.getLanded();
    if (count === 12) everFull = true;
    if (everFull) expect(count).toBe(12);
  }
  expect(everFull).toBe(true);

  // every reason is credited whether its ball fit in the bowl or fell off
  expect(sim.getLanded()).toEqual({ net: -120, count: 12 });

  const s = sim.snapshot();
  // some balls physically could not fit; after exhausting their retries they
  // spilled off for good
  expect(s.balls.length).toBeLessThan(12);
  // the settled survivors sit in (or barely crest) the bowl — no hanging blob.
  // (Ignore any ball caught mid-return, high above the rim, at this instant.)
  for (const b of s.balls) {
    if (b.y < s.con.y - 2 * ballRadius(10)) continue; // in flight, returning
    expect(s.con.y - b.y).toBeLessThan(1.8 * ballRadius(10));
  }

  // deleting everything releases spilled credit too
  sim.syncReasons([]);
  expect(sim.getLanded()).toEqual({ net: 0, count: 0 });
  sim.destroy();
});

test("a weight edit morphs the landed ball in place — no despawn, no re-drop", () => {
  const sim = createScaleSim();
  sim.syncReasons([{ id: 1, side: "pro", weight: 2 }]);
  stepFor(sim, 5000);
  expect(sim.getLanded()).toEqual({ net: 2, count: 1 });
  expect(sim.snapshot().balls[0].r).toBeCloseTo(ballRadius(2), 1);

  sim.syncReasons([{ id: 1, side: "pro", weight: 9 }]);
  // the credit swaps immediately; the ball itself never leaves the world
  expect(sim.getLanded()).toEqual({ net: 9, count: 1 });

  for (let i = 0; i < 360; i++) {
    sim.step(STEP_MS);
    const s = sim.snapshot();
    expect(s.balls).toHaveLength(1); // never despawned…
    expect(s.balls[0].y).toBeGreaterThan(100); // …never reset to the sky
  }
  const s = sim.snapshot();
  expect(s.balls[0].r).toBeCloseTo(ballRadius(9), 1); // grew to the new size
  expect(Math.abs(s.balls[0].x - s.pro.x)).toBeLessThan(GEO.PW); // still in its bowl

  stepFor(sim, 3000);
  expect(Math.abs(sim.snapshot().beamDeg - -tiltFor(9))).toBeLessThan(0.9);
  sim.destroy();
});

test("shrinking a weight eases the ball smaller and the beam follows", () => {
  const sim = createScaleSim();
  sim.syncReasons([{ id: 1, side: "con", weight: 10 }]);
  stepFor(sim, 5000);
  expect(sim.getLanded()).toEqual({ net: -10, count: 1 });

  sim.syncReasons([{ id: 1, side: "con", weight: 1 }]);
  expect(sim.getLanded()).toEqual({ net: -1, count: 1 });
  stepFor(sim, 4000);

  const s = sim.snapshot();
  expect(s.balls).toHaveLength(1);
  expect(s.balls[0].r).toBeCloseTo(ballRadius(1), 1);
  expect(Math.abs(s.balls[0].x - s.con.x)).toBeLessThan(GEO.PW);
  expect(Math.abs(s.beamDeg - -tiltFor(-1))).toBeLessThan(0.9);
  sim.destroy();
});

test("growing a ball inside a pile shoves neighbours aside without overlap", () => {
  const reasons = [
    { id: 1, side: "con", weight: 3 },
    { id: 2, side: "con", weight: 3 },
    { id: 3, side: "con", weight: 3 },
  ];
  const sim = createScaleSim();
  sim.syncReasons(reasons);
  stepFor(sim, 9000);
  expect(sim.getLanded()).toEqual({ net: -9, count: 3 });

  sim.syncReasons(reasons.map((r) => (r.id === 2 ? { ...r, weight: 10 } : r)));
  expect(sim.getLanded()).toEqual({ net: -16, count: 3 });
  stepFor(sim, 5000); // morph + re-settle

  const s = sim.snapshot();
  expect(s.balls).toHaveLength(3);
  const rOf = { 1: ballRadius(3), 2: ballRadius(10), 3: ballRadius(3) };
  for (const a of s.balls) {
    for (const b of s.balls) {
      if (a.id >= b.id) continue;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      expect(dist).toBeGreaterThan(rOf[a.id] + rOf[b.id] - 3.5);
    }
  }
  sim.destroy();
});

test("a weight edit mid-fall keeps the same ball falling — no reset to the sky", () => {
  const sim = createScaleSim();
  sim.syncReasons([{ id: 1, side: "pro", weight: 1 }]);
  // step until the ball is well below the spawn point but not yet landed
  let y0 = null;
  for (let i = 0; i < 2400 && sim.getLanded().count === 0; i++) {
    sim.step(STEP_MS);
    const b = sim.snapshot().balls[0];
    if (b && b.y > 60) {
      y0 = b.y;
      break;
    }
  }
  expect(y0).not.toBeNull();

  sim.syncReasons([{ id: 1, side: "pro", weight: 10 }]);
  sim.step(STEP_MS);
  expect(sim.snapshot().balls[0].y).toBeGreaterThanOrEqual(y0 - 1); // kept falling

  let steps = 0;
  while (sim.getLanded().count === 0 && steps < 1200) {
    sim.step(STEP_MS);
    steps += 1;
  }
  expect(sim.getLanded()).toEqual({ net: 10, count: 1 });
  stepFor(sim, 600); // let the tail of the morph finish
  expect(sim.snapshot().balls[0].r).toBeCloseTo(ballRadius(10), 1);
  sim.destroy();
});

test("changing a reason's side still re-drops the ball onto the other pan", () => {
  const sim = createScaleSim();
  sim.syncReasons([{ id: 1, side: "pro", weight: 6 }]);
  stepFor(sim, 5000);
  expect(sim.getLanded()).toEqual({ net: 6, count: 1 });

  sim.syncReasons([{ id: 1, side: "con", weight: 6 }]);
  expect(sim.getLanded()).toEqual({ net: 0, count: 0 }); // lifted off, falling again
  stepFor(sim, 6000);
  expect(sim.getLanded()).toEqual({ net: -6, count: 1 });
  const s = sim.snapshot();
  expect(Math.abs(s.balls[0].x - s.con.x)).toBeLessThan(GEO.PW);
  sim.destroy();
});

test("removing a reason lifts its ball off and the beam re-levels", () => {
  const sim = createScaleSim();
  sim.syncReasons([{ id: 1, side: "pro", weight: 8 }]);
  stepFor(sim, 4000);
  expect(sim.getLanded()).toEqual({ net: 8, count: 1 });

  sim.syncReasons([]);
  stepFor(sim, 2500);
  expect(sim.getLanded()).toEqual({ net: 0, count: 0 });
  expect(sim.snapshot().balls).toHaveLength(0);
  expect(Math.abs(sim.snapshot().beamDeg)).toBeLessThan(0.75);
  sim.destroy();
});
