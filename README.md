# Tendril Garden

**A deterministic generative line-drawing studio built around one rule: lines share the page without touching.**

[Open the live studio](https://tendril-garden.vercel.app) · [Read the artistic philosophy](PHILOSOPHY.md) · [Explore the ornament grammar](RULEBOOK.md)

Tendril Garden grows drawings rather than placing motifs. Independent lines advance through a shared spatial field, feel for occupied space, turn away from collisions, branch, and resolve into circular or geometric endings. The result is a negotiated composition whose negative space comes from the same rules as its ink.

The studio is a static browser application. Its drawing engine, interface, and an inlined copy of p5.js live in `index.html`; there is no application server and no build step.

## What you can make

- Start from a numeric seed and reproduce the same geometry with the same settings and engine revision.
- Move between organic, angular, and flowing growth, with circular, triangular, square, or plain endings.
- Introduce mirror or rotational symmetry, 30°–90° lattices, branching, rhythm, curls, return paths, family inheritance, directional grain, and composition-aware voids.
- Fill text or a locally selected image silhouette, optionally tracing its contour.
- Paint directly into the system with plant, draw, stamp, erase, and keep-clear tools.
- Save up to 24 recipes on the local shelf, recolor a finished drawing without regrowing it, and share a recipe in the URL.
- Export PNG, layered SVG, animated SVG, or plotter-oriented paths with optional stroke joining and paper sizing.
- Turn the visible drawing into a silent 10–15 second short film, with a scrub-and-play preview and local MP4/WebM download.
- Generate seamless tiles and use the quieter [`wallpaper.html`](wallpaper.html) view as a continuously changing display.

## The system

The engine calls the approach **Courteous Growth**. Each tendril proposes small movements while a uniform spatial grid records previously inked points. A movement is accepted only when it preserves the configured clearance from other paths and from the older parts of its own trail. Endings and higher-order behaviors are constructed from that same clearance, so ornament emerges from interactions rather than from a library of prefabricated shapes.

Random choices are seeded. Newer mechanisms use purpose-specific generators so enabling one behavior does not unnecessarily reroll unrelated decisions. `golden.json` records geometry hashes for the regression matrix, making unintended visual drift visible during testing.

For the design intent behind those decisions, see:

- [`PHILOSOPHY.md`](PHILOSOPHY.md) — the artistic contract and aesthetic standard.
- [`RULEBOOK.md`](RULEBOOK.md) — the switchable ornament grammar and its build order.

## Run locally

Tendril Garden needs only a modern browser. Serve the repository from its root so URL sharing and browser security rules behave consistently:

```bash
python3 -m http.server 4173
```

Then open [http://localhost:4173](http://localhost:4173). Opening `index.html` directly also works in browsers that permit the required local-file APIs.

No package installation is required to use the studio or its film editor. The checked-in video encoder runs on your device; drawings are never uploaded.

## Make a short film

Choose **Make a film** after growing a drawing. The editor waits for growth to finish, snapshots the current visible paths and inks, and offers 10, 12 or 15 seconds in square, landscape or portrait format at 720p or 1080p. **Play from start** and the position slider use a fixed 30 fps timeline. Saving a film renders each frame with an explicit timestamp, rather than recording a real-time screen capture. A short final hold lets the finished drawing settle. There is no audio.

MP4 and WebM encoding depend on the browser's WebCodecs support. Try another format/size if encoding is unavailable. The studio reports errors and supports cancellation; it never labels a failed export as saved. **Save film recipe** preserves the exact visible geometry, including hand edits, a mask or a scrubbed composition, for an offline render:

```bash
npm ci
npm run film:render -- --recipe path/to/tendril-12345.film.json --output exports/my-film.mp4
```

Or grow an existing seed with the real studio engine and render it directly:

```bash
npm run film:render -- --seed 12345 --duration 12 --size 1080 --output exports/tendril-12345.mp4
```

The renderer writes a silent H.264 MP4, a final-frame PNG and the reusable film recipe. Existing files are not overwritten. `--size` accepts 360 (quick proofs), 720 or 1080; `--aspect` accepts `square`, `landscape` or `portrait`. Use `--help` for the complete command. Keep the recipe to reproduce manual changes; a seed alone recreates the default recipe for this engine revision.

Preview, browser encoding and local rendering share `film.js`: final surviving paths are revealed by arc length in the same staggered order as the existing animated SVG. This is a film of the resolved drawing, not a replay of temporary growth that was later erased. It leaves the engine, its random stream and the current drawing unchanged. Identical scene/options/frame produce identical vector frames; codec bytes and antialiasing can differ between browser encoders and the local renderer.

For this path-based composition, a direct frame renderer avoids adding a React/Remotion application or a Chromium capture runtime. Offline rendering uses native Canvas/Skia and FFmpeg; browser encoding uses Mediabunny and WebCodecs. Both call the same Canvas drawing function. No paid renderer or cloud account is required. To rebuild the committed browser encoder after changing its source:

```bash
npm run build:film
npm run test:film
```

## Test the engine

```bash
npm test
```

This extracts the real engine from `index.html` and runs 27 configurations across five seeds: **135 deterministic scenarios** covering termination, resolution, fragment prevention, coverage floors, balance, feature efficacy, and golden geometry hashes.

CI deliberately excludes elapsed-time budgets because shared runners are not stable performance instruments. To include the existing local performance gates:

```bash
npm run test:performance
```

Useful diagnostics:

```bash
npm run test:show -- mask
npm run test:show -- ornament
```

Only use `npm run test:bless` after reviewing an intentional geometry change; it rewrites the golden hashes.

## Repository map

| Path | Purpose |
| --- | --- |
| `index.html` | Production studio, drawing engine, interaction layer, and inlined p5.js runtime |
| `wallpaper.html` | Passive full-screen variation with its own deliberately simpler engine |
| `harness.js` | Dependency-free seeded regression and invariant harness |
| `golden.json` | Expected geometry hashes for the 135-run matrix |
| `film.js` | Shared deterministic timeline, path reveal and Canvas/SVG frame rendering |
| `film-ui.js` / `film.css` | Film preview, settings, progress, cancellation and recipe download |
| `assets/film-encoder.js` | Committed static browser encoder built from `tools/film-encode-entry.mjs` |
| `tools/render-film.cjs` | Offline Canvas/FFmpeg MP4 renderer |
| `PHILOSOPHY.md` | Courteous Growth as an algorithmic and visual philosophy |
| `RULEBOOK.md` | Rules for extending the grammar without replacing emergence with motifs |
| `vercel.json` | Static deployment and response-header configuration |

## Known constraints

- The production app is intentionally self-contained, which makes `index.html` large and keeps the UI and engine in one file.
- p5.js is vendored inline for reliable static and sandboxed use; dependency updates are therefore manual.
- `wallpaper.html` is a separate, quieter variation. It does not share the studio engine or its golden regression matrix, so changes to one surface must be checked against the other deliberately.
- Dense masks, high clearances, and composition-heavy presets can take noticeably longer on slower devices.
- The headless harness validates deterministic output and engine-level invariants, but it does not replace cross-browser interaction and export testing.
- Saved shelf items and preferences live in browser `localStorage`; they do not sync between devices.

## License

Elko Lemiso's original work is visible for evaluation but is not currently offered under an open-source license. The inlined p5.js runtime remains under LGPL-2.1. See [`LICENSE`](LICENSE) and [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
