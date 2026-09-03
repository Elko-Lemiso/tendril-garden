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

No package installation is required. Node.js is used only by the regression harness.

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
