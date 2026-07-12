// ── Mini physics for the trash can ──────────────────────────────────────────
// A pocket-sized matter-js world (framework-free, like scalePhysics): every
// stashed reason is a tiny uniform ball — green pro or red con, weights
// deliberately ignored — that drops into the hand-drawn can and piles up.
// It's a directional "you've got stuff in here" visual, not a tally (the
// count badge does the counting), so the pile is CAPPED: past MAX_BALLS,
// extra reasons simply don't get a body.
//
// Geometry mirrors the can drawn in Trash.js (viewBox 74×96): rim at y≈28
// spanning x 12–62, tapered sides down to the floor at y≈86 spanning x 22–52.
// The walls extend above the rim so a bouncy drop can't escape the can.

import Matter from "matter-js";

const { Engine, Bodies, Composite } = Matter;

export const TRASH_GEO = {
  BALL_R: 4.4,
  MAX_BALLS: 14,
  SPAWN_X: 37,
  SPAWN_Y: -10,
};

const STEP_MS = 1000 / 120; // same fixed-substep guard as the scale sim
const MAX_FRAME_MS = 100;

// deterministic per-ball jitter, seeded by reason id (matches scalePhysics)
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createTrashSim() {
  const engine = Engine.create({ enableSleeping: true });
  const world = engine.world;
  let acc = 0;

  // the can: floor + two slanted walls (thickness sits OUTSIDE the ink line,
  // so balls rest on the drawn stroke, not floating inside it)
  const LEAN = Math.atan2(6, 56); // the sides run (12,28)→(18,84) / mirrored
  Composite.add(world, [
    Bodies.rectangle(37, 89.5, 42, 9, { isStatic: true }),
    Bodies.rectangle(9.9, 41, 7, 96, { isStatic: true, angle: -LEAN }),
    Bodies.rectangle(64.1, 41, 7, 96, { isStatic: true, angle: LEAN }),
  ]);

  const ballBodies = new Map(); // reason id → body

  return {
    // Diff the stashed reasons against the world: new ids drop in from above
    // the lid, gone ids vanish (restore / shred / empty). Only the first
    // MAX_BALLS get bodies — the pile is a mood, not a measurement.
    syncItems(items) {
      const want = new Map(items.slice(0, TRASH_GEO.MAX_BALLS).map((r) => [r.id, r]));
      for (const id of [...ballBodies.keys()]) {
        if (!want.has(id)) {
          Composite.remove(world, ballBodies.get(id));
          ballBodies.delete(id);
        }
      }
      let stack = 0; // a batch arriving together stacks upward so balls don't overlap
      for (const [id, r] of want) {
        if (ballBodies.has(id)) continue;
        const jitter = (mulberry32((id * 2654435761) >>> 0)() - 0.5) * 14;
        const body = Bodies.circle(
          TRASH_GEO.SPAWN_X + jitter,
          TRASH_GEO.SPAWN_Y - stack * 12,
          TRASH_GEO.BALL_R,
          { restitution: 0.25, friction: 0.15, frictionAir: 0.02, label: "tb-" + id }
        );
        body._side = r.side;
        ballBodies.set(id, body);
        Composite.add(world, body);
        stack += 1;
      }
    },

    step(dtMs) {
      acc += Math.min(dtMs || STEP_MS, MAX_FRAME_MS);
      while (acc >= STEP_MS - 1e-6) {
        acc -= STEP_MS;
        Engine.update(engine, STEP_MS);
      }
    },

    snapshot() {
      return [...ballBodies.entries()].map(([id, b]) => ({
        id,
        side: b._side,
        x: b.position.x,
        y: b.position.y,
      }));
    },

    count() {
      return ballBodies.size;
    },

    destroy() {
      Composite.clear(world, false);
      Engine.clear(engine);
      ballBodies.clear();
    },
  };
}
