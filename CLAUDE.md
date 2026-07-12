# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Frontend (Create React App, run from repo root):

- `npm start` — dev server at http://localhost:3000
- `npm run build` — production build
- `npm test` — Jest watch mode (react-scripts)
- `npm test -- --watchAll=false` — run all tests once (CI-style)
- `npm test -- App.test.js` — run a single test file
- `npm test -- -t "renders the pros and cons board"` — run a single test by name

Backend (`backend/`, standalone Express server — run separately):

- `cd backend && npm run dev` — nodemon on http://localhost:3001
- `cd backend && npm start` — plain node
- Requires `backend/.env` with `OPENAI_API_KEY`. Without it the API still responds, returning a fallback weight of `5`.

## Architecture

Single-screen React 19 app. `App` renders one component, `Board`, which owns essentially all state.

**Fixed design canvas.** The board is authored at a fixed `1320×840` (`W`/`H` in `Board.js`) and CSS-`transform: scale()`-ed to fit the viewport (see the `fit` handler). Positions are absolute pixel coordinates against that canvas, not a responsive layout. When adjusting layout, work in these design coordinates, not screen pixels.

**Pure logic core: `src/lib/scaleMath.js`.** Framework-free helpers shared by the `Scale` SVG, the physics sim and the reason rows: weight→color (`shade`/`shadeStroke`), weight→radius (`ballRadius`), `netWeight`, beam `tiltFor` (a `tanh` curve saturating near ±15°), and `verdictFor`. This is the place to change any visual math; it has no React dependency by design.

**Physics core: `src/lib/scalePhysics.js`.** A framework-free matter-js simulation (`createScaleSim`), also headless-testable (`scalePhysics.test.js`). Balls are dynamic circles falling under weight-scaled gravity; each pan is a static compound "cradle bowl" of thick arc segments; the beam angle is NOT free physics — it's a spring-damper chasing `tiltFor(net of LANDED balls)`, so the scale only moves once a ball has physically touched its pan, and the settled angle always matches the verdict math. Touchdowns also kick the beam for a natural dip. Runs fixed 120Hz substeps (tunneling guard) regardless of frame rate. `GEO` here is the single source of truth for scale geometry — the SVG in `Scale.js` is drawn from the same constants, so the drawn bowl IS the collision shape.

**Component tree.** `Board` (state + all pointer logic) → `ReasonColumn` (pros/cons lists + add form), `Scale` (the SVG balance; owns one physics sim and paints body positions into SVG transforms from a `requestAnimationFrame` loop — React re-renders only when the reason lists or the landed tally change, never per frame), `Trash` (drag-to-delete drop zone). Reasons live in `Board` as `{ id, side: 'pro'|'con', text, weight }`; columns are derived by filtering on `side`. `Scale` reports `{ net, count }` of landed balls up via `onLanded`; Board's verdict line renders from that, so the text flips in sync with the beam.

**Custom drag-and-drop (no library).** Dragging is hand-rolled in a single `useEffect` in `Board.js` using window `pointermove`/`pointerup` listeners. State that the listeners must read synchronously is mirrored into refs (`dragIdRef`, `overTrashRef`, `pendingRef`) alongside the React state used for rendering — because the listeners are registered once and close over stale state otherwise. A drag only begins after the pointer moves >6px from press (`pendingRef`), and a floating "drag clone" is rendered at unscaled screen coordinates while the source row is dimmed.

**Design source of truth.** The visual design was exported from Claude Design to `pros-n-cons/project/Pros N Cons.dc.html`. Treat that file (and its constants/colors) as the spec; match its visual output rather than copying its structure. Layout/color magic numbers throughout the components are ported from it.

**Styling** is all inline `style={{}}` objects with per-file design constants at the top (`PAPER_BG`, `MARKER`, `ACCENT`, the `VW`/`CX`/`L`… geometry in `Scale.js`). There is no CSS framework; `src/styles/index.css` is minimal.

## Gotchas / current state

- **`roughjs` is wrapped by `src/lib/rough.js`** (seeded, deterministic strokes — lines don't re-scribble on re-render); `matter-js` lives only in the physics libs — `src/lib/scalePhysics.js` (the scale) and `src/lib/trashPhysics.js` (the mini ball pile inside the trash can). Don't import matter elsewhere — components should talk to a sim API (`syncReasons`/`syncItems`/`step`/`snapshot`).
- **The rAF loop, not React, owns the animated SVG transforms** (beam, pans, balls in `Scale.js`). Per-ball JSX `transform` values are constants (an off-screen parking spot) so reconciliation never clobbers live physics positions. If you add animated elements, follow the same pattern: static JSX + a ref the loop writes to.
- **The backend is not connected to the frontend.** Weights are entered by hand in the add form; nothing in `src/` calls `/api/weight`. The Express + OpenAI weighting server exists but is standalone. Wiring it in (auto-weighting a reason on add) is an obvious next step.
- **The root `README.md` is aspirational and inaccurate.** It describes a Python/FastAPI + TextBlob backend and Chart.js/Axios frontend; the real stack is an Express/OpenAI backend and a custom-SVG React frontend. Trust the code over that README.
 