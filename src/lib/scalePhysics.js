// ── Real-world physics for the decision scale ────────────────────────────────
// A matter-js simulation, kept framework-free (like scaleMath) so it can run
// headless in tests. The Scale component owns one sim, steps it from
// requestAnimationFrame, and paints body positions straight into the SVG.
//
// How it works:
//  • Balls are dynamic circles that spawn above the page and free-fall under
//    weight-scaled gravity (heavier reason → stronger pull → lands sooner).
//  • Each pan is a hanging cradle bowl: a static compound body made of thick
//    overlapping segments along a circular arc — a hard barrier balls bounce
//    off, roll along and stack inside.
//  • The beam is NOT a free rigid body: its angle is a spring-damper chasing
//    tiltFor(net-of-LANDED-balls). A ball only counts once it has physically
//    touched its pan (or a ball already resting in it), so the scale never
//    moves before the ball arrives; on touchdown the impact also kicks the
//    beam for a natural dip. This keeps the settled angle exactly consistent
//    with the verdict math while the balls stay fully physical.
//  • A weight EDIT never despawns the ball: the body stays where it is and
//    its radius eases toward the new size (Body.scale per substep), so the
//    ball visibly grows/shrinks in place and shoulders its neighbours aside.
//    Only a side change (pro ↔ con) re-drops — that ball belongs to the
//    other pan.

import Matter from "matter-js";
import { tiltFor, ballRadius, clampWeight } from "./scaleMath";

const { Engine, Bodies, Body, Composite, Events } = Matter;

// Geometry shared by the physics and the Scale SVG (design coordinates).
export const GEO = {
  VW: 560,
  VH: 648,
  CX: 280, // pivot x
  CY: 64, // pivot / beam y
  L: 208, // half beam length (wide beam)
  CHAIN_H: 210, // long drop from beam end to pan rim
  PW: 92, // pan rim half-width
  DEPTH: 96, // bowl depth below the rim
  POLE_BTM: 610,
  BASE_HALF: 56,
  SPAWN_Y: -150, // balls enter here — above the visible page
};
// Circle through both rim points and the bowl bottom — the cradle surface.
GEO.BOWL_R = (GEO.PW * GEO.PW + GEO.DEPTH * GEO.DEPTH) / (2 * GEO.DEPTH);

// Fixed 120Hz substeps (2 per 60fps frame) so fast balls can't tunnel
// through the bowl shell between collision checks.
export const STEP_MS = 1000 / 120;
const MAX_FRAME_MS = 100; // clamp after a background-tab stall

// Beam spring-damper: slightly under-damped so it overshoots a touch and
// settles in well under a second.
const OMEGA = 7.0; // natural frequency (rad/s)
const ZETA = 0.78; // damping ratio
const MAX_TILT = (16.5 * Math.PI) / 180; // hard stop just past tiltFor's ±15°
const MAX_BEAM_VEL = 1.8; // rad/s
const KICK = 0.55; // touchdown impulse at weight 10, full speed

const MAX_FALL = 26; // terminal velocity, px per 16.666ms (~1560 px/s)
const SPAWN_GAP_PX = 60; // next same-side ball waits until this much clearance

// Every ball is the same 24-gon regardless of size (Bodies.circle would give
// small balls as few as 10 sides — fine at spawn size, visibly faceted once
// a weight edit grows one 3×). Uniform roundness keeps morphed balls rolling
// and stacking exactly like born-big ones.
const BALL_SIDES = 24;
// Weight edit → the radius eases toward its new size with a ~90ms time
// constant (≈ a third of a second to finish): quick enough to feel tied to
// the keystroke, slow enough that the pile visibly makes room.
const MORPH_K = 1 - Math.exp(-STEP_MS / 90);
const densityFor = (w) => 0.0011 * (0.85 + 0.05 * w); // heavier shoves lighter
// constant-acceleration fall, scaled by weight: w=1 → 1.15g, w=10 → 2.05g
const gMultFor = (w) => 1.15 + ((w - 1) / 9) * 0.9;

// Two materials per ball. AIRBORNE is lively: a clean fall, the slight
// touchdown bounce, a bit of rolling along the bowl. Once a landed ball is
// slow and inside its bowl it switches to SETTLED — grippy and heavily
// damped — so the pile absorbs later impacts instead of boiling: without
// this, matter's frictionless-rolling circles swing in the curved bowl for
// ages and each new landing kicks neighbours UP the wall.
const AIRBORNE = { restitution: 0.24, friction: 0.09, frictionStatic: 0.5, frictionAir: 0.009 };
const SETTLED = { restitution: 0.06, friction: 0.38, frictionStatic: 1, frictionAir: 0.026 };
const CALM_SPEED = 6; // px per 16.666ms (~360 px/s) — below this, settle

// A ball that falls off the pan is returned to the top and re-dropped. The
// first two returns fall straight back down; after failing to stay TWICE we
// start nudging the landing point sideways (a step bigger each try, alternating
// sides) so a ball can't loop forever spilling from the same spot. Past
// MAX_RETRIES a landed ball has clearly met a full bowl — it spills for good
// (credit kept) rather than raining back in endlessly.
const RETRY_STEP = 12; // px the landing point shifts per extra attempt
const MAX_RETRIES = 6;

// Pros and cons live in separate collision groups: same-side balls interact
// with each other and their own pan/walls, never with the other side.
const CAT_BALL = { pro: 0x0002, con: 0x0004 };
const CAT_ENV = { pro: 0x0008, con: 0x0010 };
const ballFilter = (side) => ({
  category: CAT_BALL[side],
  mask: CAT_BALL[side] | CAT_ENV[side],
});
const envFilter = (side) => ({
  category: CAT_ENV[side],
  mask: CAT_BALL[side],
});

// Deterministic per-ball jitter (seeded by id) keeps drops from looking
// robotic while staying reproducible in tests.
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createScaleSim() {
  const engine = Engine.create({
    positionIterations: 8,
    velocityIterations: 6,
  });
  const world = engine.world;

  let beamAngle = 0; // radians, SVG sense: negative = pro (left) side down
  let beamVel = 0;
  let lastAppliedAngle = null;
  let landedNet = 0;
  let landedCount = 0;
  let landedCb = null;
  let acc = 0;
  let substeps = 0;

  const ballBodies = new Map(); // reason id → Matter body
  // Reasons whose ball overflowed the bowl and fell off the page. They stay
  // counted in the net (the reason exists!), we just no longer simulate them.
  const spilled = new Map(); // reason id → { side, weight }
  const queues = { pro: [], con: [] };
  const lastSpawnId = { pro: null, con: null };
  const spawnCount = { pro: 0, con: 0 };
  const panBody = {};
  const panOffset = {}; // compound centre-of-mass − rim centre

  // Where a pan's rim centre sits for the current beam angle. Pans hang from
  // the beam ends, so they translate but always stay level.
  const rimCenter = (side) => {
    const c = Math.cos(beamAngle);
    const s = Math.sin(beamAngle);
    const dir = side === "pro" ? -1 : 1;
    return {
      x: GEO.CX + dir * GEO.L * c,
      y: GEO.CY + dir * GEO.L * s + GEO.CHAIN_H,
    };
  };

  // ── static world: two cradle bowls (nothing else to lean on) ──────────────
  const SEGS = 18;
  const SHELL = 17; // bowl shell thickness — thick enough to never tunnel
  // The wall must end AT the rim ink, never past it: an invisible overhang
  // past the rim gives squeezed balls a ledge to perch on above the drawn
  // bowl, which reads as balls floating in mid-air. The segments are pulled
  // slightly INSIDE the rim points; their 1.45× overlap stretches the last
  // one back out so the effective barrier tops out exactly at the rim.
  const LIP = -0.045;
  // The bowl is DRAWN with a 3px stroke centred on the BOWL_R arc, so the
  // ink's inner edge sits 1.5px inside it. The collision surface matches that
  // inner edge: balls come to rest touching the line, never overlapping it.
  const SURF_INSET = 1.5;
  function buildPan(side) {
    const rim0 = rimCenter(side); // beamAngle is 0 here
    const cyL = GEO.DEPTH - GEO.BOWL_R; // arc centre, pan-local
    const aEdge = Math.atan2(cyL, GEO.PW);
    const aStart = Math.PI + aEdge + LIP; // left rim …
    const aEnd = -aEdge - LIP; // … through the bottom, to right rim
    const rc = GEO.BOWL_R - SURF_INSET + SHELL / 2; // segment centres sit outside the surface
    const segLen = 2 * rc * Math.sin(Math.abs(aEnd - aStart) / SEGS / 2) * 1.45;
    const parts = [];
    for (let i = 0; i < SEGS; i++) {
      const am = aStart + ((aEnd - aStart) * (i + 0.5)) / SEGS;
      parts.push(
        Bodies.rectangle(
          rim0.x + rc * Math.cos(am),
          rim0.y + cyL + rc * Math.sin(am),
          segLen,
          SHELL,
          {
            angle: am + Math.PI / 2,
            label: "pan-" + side,
            friction: 0.28,
            restitution: 0.05,
            collisionFilter: envFilter(side),
          }
        )
      );
    }
    const pan = Body.create({
      parts,
      isStatic: true,
      label: "pan-" + side,
      collisionFilter: envFilter(side),
    });
    panOffset[side] = { x: pan.position.x - rim0.x, y: pan.position.y - rim0.y };
    panBody[side] = pan;
    Composite.add(world, pan);
    // No side walls: the bowl itself is the only support. Whatever doesn't
    // fit INSIDE it has nothing to lean against and tumbles off the page —
    // an over-full pan visibly overflows instead of growing a hanging blob.
  }
  buildPan("pro");
  buildPan("con");

  // ── touchdown detection ────────────────────────────────────────────────────
  const notify = () => {
    if (landedCb) landedCb({ net: landedNet, count: landedCount });
  };

  function maybeLand(body, other) {
    const m = body._pnc;
    if (!m || m.landed) return false;
    const om = other._pnc;
    const onOwnPan = other.label === "pan-" + m.side;
    const onSettledBall = !!om && om.landed && om.side === m.side;
    if (!onOwnPan && !onSettledBall) return false;
    m.landed = true;
    landedNet += m.side === "pro" ? m.weight : -m.weight;
    landedCount += 1;
    // touched down well ABOVE the rim plane → it landed on a full pile, not
    // in the bowl; mark it to be spilled over the side
    if (rimCenter(m.side).y - body.position.y > 0.9 * m.r) m.overflow = true;
    // the impact momentum dips the beam: heavier + faster → bigger kick
    const speed = Math.abs(Body.getVelocity(body).y) * 60; // px/s
    const dir = m.side === "pro" ? -1 : 1;
    beamVel += dir * KICK * (m.weight / 10) * Math.min(speed / 1300, 1);
    beamVel = Math.max(-MAX_BEAM_VEL, Math.min(MAX_BEAM_VEL, beamVel));
    return true;
  }

  // collisionActive too: a ball that came to rest on a still-falling ball is
  // credited the moment the pile under it touches down.
  const onCollide = (e) => {
    let changed = false;
    for (const p of e.pairs) {
      if (maybeLand(p.bodyA, p.bodyB)) changed = true;
      if (maybeLand(p.bodyB, p.bodyA)) changed = true;
    }
    if (changed) notify();
  };
  Events.on(engine, "collisionStart", onCollide);
  Events.on(engine, "collisionActive", onCollide);

  // ── spawning ───────────────────────────────────────────────────────────────
  const canSpawn = (side) => {
    const lastId = lastSpawnId[side];
    if (lastId == null) return true;
    const last = ballBodies.get(lastId);
    if (!last || last._pnc.landed) return true;
    return last.position.y > GEO.SPAWN_Y + SPAWN_GAP_PX;
  };

  function spawnBall({ id, side, weight }) {
    const w = clampWeight(weight);
    const r = ballRadius(w);
    const rand = mulberry32((id * 2654435761) >>> 0)();
    const n = spawnCount[side]++;
    const dx = (n % 2 === 0 ? -1 : 1) * (6 + rand * 16);
    const body = Bodies.polygon(rimCenter(side).x + dx, GEO.SPAWN_Y, BALL_SIDES, r, {
      ...AIRBORNE,
      density: densityFor(w), // heavier reasons shove lighter balls
      collisionFilter: ballFilter(side),
      label: "ball-" + id,
    });
    // mark it a circle so Body.scale keeps scaling one radius, not an ellipse
    body.circleRadius = r;
    body._pnc = {
      id,
      side,
      weight: w,
      r, // current physics radius (eases toward targetR during a morph)
      targetR: r,
      gMult: gMultFor(w),
      landed: false,
      calm: false, // switched to the SETTLED material yet?
      overflow: false,
      fails: 0, // times it fell off and had to be re-dropped
    };
    ballBodies.set(id, body);
    lastSpawnId[side] = id;
    Composite.add(world, body);
  }

  function removeBall(id) {
    const body = ballBodies.get(id);
    if (!body) return false;
    ballBodies.delete(id);
    Composite.remove(world, body);
    if (body._pnc.landed) {
      landedNet -= body._pnc.side === "pro" ? body._pnc.weight : -body._pnc.weight;
      landedCount -= 1;
      return true;
    }
    return false;
  }

  // Where to re-drop a returning ball: straight over its own pan for the first
  // two tries, then nudged sideways once it has failed to stay twice. The
  // offset grows a step per attempt and alternates sides, but stays inside the
  // cradle width so the ball always falls into the bowl's mouth, never past the
  // rim.
  function retryDropX(m) {
    const rimX = rimCenter(m.side).x;
    if (m.fails <= 2) return rimX;
    const k = m.fails - 2; // 1, 2, 3, … once we start adjusting
    const maxOff = Math.max(0, GEO.PW - m.r - 6); // keep the drop within the cradle
    const off = Math.min(k * RETRY_STEP, maxOff);
    const dir = k % 2 === 1 ? 1 : -1; // alternate right, left, right…
    return rimX + dir * off;
  }

  // Balls that leave the play area FAILED TO STAY. Return each to the top and
  // re-drop it: a landed ball keeps its credit throughout (the reason still
  // exists — the bowl just spat it out) so the verdict never flickers while it
  // retries. Each miss bumps a per-ball counter; retryDropX nudges the landing
  // point sideways so it can't loop forever spilling from the same place. If
  // even that can't seat a landed ball (a genuinely full bowl), it finally
  // spills for good. Airborne strays always retry — a ball that never lands
  // would silently disagree with the verdict.
  function cleanupStrays() {
    for (const body of [...ballBodies.values()]) {
      const p = body.position;
      if (p.y <= GEO.VH + 240 && Math.abs(p.x - GEO.CX) <= 500) continue;
      const m = body._pnc;
      m.fails = (m.fails || 0) + 1;
      if (m.landed && m.fails > MAX_RETRIES) {
        spilled.set(m.id, { side: m.side, weight: m.weight });
        ballBodies.delete(m.id);
        Composite.remove(world, body);
        continue;
      }
      m.overflow = false; // fresh attempt — let it prove it can rest in the bowl
      m.calm = false; // fall lively again; it re-settles once back in the bowl
      Object.assign(body, AIRBORNE);
      Body.setPosition(body, { x: retryDropX(m), y: GEO.SPAWN_Y });
      Body.setVelocity(body, { x: 0, y: 0 });
      Body.setAngularVelocity(body, 0);
    }
  }

  // The pile never grows past the rim: anything perched above it gets a
  // gentle sideways nudge until it rolls over the edge and falls away.
  function spillOverflow() {
    for (const body of ballBodies.values()) {
      const m = body._pnc;
      if (!m.landed) continue;
      const rim = rimCenter(m.side);
      const above = rim.y - body.position.y;
      if (!m.overflow && above > 1.1 * m.r) m.overflow = true; // pushed up by the pile
      if (!m.overflow) continue;
      if (above < 0.4 * m.r) {
        m.overflow = false; // found its way INTO the bowl after all
        continue;
      }
      const v = Body.getVelocity(body);
      if (Math.hypot(v.x, v.y) < 0.5) {
        const dir = body.position.x >= rim.x ? 1 : -1;
        Body.setVelocity(body, { x: v.x + dir * 2.2, y: v.y - 0.6 });
      }
    }
  }

  // ── the fixed-step loop ────────────────────────────────────────────────────
  function substep() {
    substeps += 1;

    for (const side of ["pro", "con"]) {
      if (queues[side].length && canSpawn(side)) spawnBall(queues[side].shift());
    }

    // beam chases the tilt of everything that has LANDED
    const target = (-tiltFor(landedNet) * Math.PI) / 180;
    const dt = STEP_MS / 1000;
    beamVel += (OMEGA * OMEGA * (target - beamAngle) - 2 * ZETA * OMEGA * beamVel) * dt;
    beamAngle += beamVel * dt;
    if (beamAngle > MAX_TILT) {
      beamAngle = MAX_TILT;
      if (beamVel > 0) beamVel = 0;
    } else if (beamAngle < -MAX_TILT) {
      beamAngle = -MAX_TILT;
      if (beamVel < 0) beamVel = 0;
    }

    // pans ride the beam ends (they stay level — they hang)
    if (beamAngle !== lastAppliedAngle) {
      for (const side of ["pro", "con"]) {
        const rim = rimCenter(side);
        Body.setPosition(panBody[side], {
          x: rim.x + panOffset[side].x,
          y: rim.y + panOffset[side].y,
        });
      }
      lastAppliedAngle = beamAngle;
    }

    // weight-scaled gravity (matter applies 1×; add the remainder) + terminal velocity
    for (const body of ballBodies.values()) {
      const m = body._pnc;
      // mid-morph: ease the radius toward its edited size. Growth per substep
      // is ~1px at worst — far thinner than the bowl shell, so no tunnelling;
      // the position solver walks neighbours apart as the ball swells.
      if (m.r !== m.targetR) {
        let next = m.r + (m.targetR - m.r) * MORPH_K;
        if (Math.abs(next - m.targetR) < 0.05) next = m.targetR;
        Body.scale(body, next / m.r, next / m.r);
        m.r = next;
      }
      body.force.y +=
        body.mass * engine.gravity.y * engine.gravity.scale * (m.gMult - 1);
      const v = Body.getVelocity(body);
      if (v.y > MAX_FALL) Body.setVelocity(body, { x: v.x, y: MAX_FALL });
      // a landed ball that has slowed down inside its bowl settles: it keeps
      // its place with grip instead of skittering when the next ball hits.
      // (The first-touch bounce is unaffected — the ball is fast then.)
      if (m.landed && !m.calm) {
        const rim = rimCenter(m.side);
        if (
          body.position.y > rim.y - m.r &&
          Math.abs(body.position.x - rim.x) < GEO.PW &&
          Math.hypot(v.x, v.y) < CALM_SPEED
        ) {
          Object.assign(body, SETTLED);
          m.calm = true;
        }
      }
    }

    Engine.update(engine, STEP_MS);
    if (substeps % 6 === 0) spillOverflow();
    if (substeps % 30 === 0) cleanupStrays();
  }

  return {
    onLanded(cb) {
      landedCb = cb;
    },

    // Diff the reason list against the world: new ids queue up to drop,
    // deleted ids vanish (beam re-settles), side flips re-drop onto the other
    // pan, and weight edits MORPH the existing ball in place — the ledger
    // swaps to the new weight at once (the beam's spring supplies the smooth
    // swing) while the body eases its radius in substep().
    syncReasons(reasons) {
      const want = new Map(reasons.map((r) => [r.id, r]));
      let changed = false;

      for (const id of [...ballBodies.keys()]) {
        const r = want.get(id);
        const body = ballBodies.get(id);
        const m = body._pnc;
        if (!r || r.side !== m.side) {
          if (removeBall(id)) changed = true;
          continue;
        }
        const w = clampWeight(r.weight);
        if (w !== m.weight) {
          if (m.landed) {
            landedNet += m.side === "pro" ? w - m.weight : m.weight - w;
            changed = true;
          }
          m.weight = w;
          m.gMult = gMultFor(w);
          m.targetR = ballRadius(w);
          Body.setDensity(body, densityFor(w));
        }
      }
      // spilled balls have no body but still sit on the ledger — deleting or
      // editing their reason must release the credit (an edit then re-queues)
      for (const id of [...spilled.keys()]) {
        const r = want.get(id);
        const sp = spilled.get(id);
        if (!r || r.side !== sp.side || clampWeight(r.weight) !== sp.weight) {
          spilled.delete(id);
          landedNet -= sp.side === "pro" ? sp.weight : -sp.weight;
          landedCount -= 1;
          changed = true;
        }
      }
      for (const side of ["pro", "con"]) {
        queues[side] = queues[side].filter((q) => {
          const r = want.get(q.id);
          return r && r.side === q.side && clampWeight(r.weight) === q.weight;
        });
      }
      const queued = new Set([...queues.pro, ...queues.con].map((q) => q.id));
      for (const r of reasons) {
        if (!ballBodies.has(r.id) && !queued.has(r.id) && !spilled.has(r.id)) {
          queues[r.side].push({ id: r.id, side: r.side, weight: clampWeight(r.weight) });
        }
      }
      if (changed) notify();
    },

    step(dtMs) {
      acc += Math.min(dtMs || STEP_MS, MAX_FRAME_MS);
      while (acc >= STEP_MS - 1e-6) {
        acc -= STEP_MS;
        substep();
      }
    },

    snapshot() {
      return {
        beamDeg: (beamAngle * 180) / Math.PI,
        pro: rimCenter("pro"),
        con: rimCenter("con"),
        balls: [...ballBodies.values()].map((b) => ({
          id: b._pnc.id,
          side: b._pnc.side,
          landed: b._pnc.landed,
          x: b.position.x,
          y: b.position.y,
          r: b._pnc.r, // live radius — mid-morph it is between the two sizes
        })),
      };
    },

    getLanded() {
      return { net: landedNet, count: landedCount };
    },

    destroy() {
      Events.off(engine);
      Composite.clear(world, false);
      Engine.clear(engine);
      ballBodies.clear();
      spilled.clear();
      queues.pro.length = 0;
      queues.con.length = 0;
      landedCb = null;
    },
  };
}
