import rough from "roughjs";

// Shared rough.js generator. Every helper takes a fixed seed so the sketchy
// wobble is deterministic — lines don't re-scribble themselves on re-render.
let _gen = null;
const gen = () => {
  if (!_gen) _gen = rough.generator();
  return _gen;
};

const toPaths = (drawable) =>
  drawable.sets
    .filter((s) => s.type === "path")
    .map((s) => gen().opsToPath(s));

export const rLine = (x1, y1, x2, y2, seed = 1, sw = 3) =>
  toPaths(
    gen().line(x1, y1, x2, y2, {
      roughness: 0.75,
      bowing: 0.6,
      seed,
      strokeWidth: sw,
    })
  );

export const rPath = (d, seed = 1, sw = 3) =>
  toPaths(
    gen().path(d, {
      roughness: 0.75,
      bowing: 0.7,
      seed,
      strokeWidth: sw,
      fill: "none",
    })
  );
