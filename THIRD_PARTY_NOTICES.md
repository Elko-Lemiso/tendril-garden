# Third-party notices

Tendril Garden includes the following third-party software. Its license applies only to that component and is not replaced by the repository's root `LICENSE`.

## p5.js 1.7.0

- Project: [p5.js](https://github.com/processing/p5.js)
- Version: [v1.7.0](https://github.com/processing/p5.js/releases/tag/v1.7.0)
- License: GNU Lesser General Public License v2.1 (`LGPL-2.1`)
- License text: [`LICENSES/LGPL-2.1.txt`](LICENSES/LGPL-2.1.txt)

The production HTML files contain an unmodified inlined distribution build of p5.js so the static studio can run without an external script host. Source for the corresponding release is available from the upstream project at the version link above.

## Mediabunny 1.62.0

- Project/source: [Mediabunny](https://github.com/Vanilagy/mediabunny/tree/v1.62.0)
- License: Mozilla Public License 2.0; text in [`LICENSES/Mediabunny-MPL-2.0.txt`](LICENSES/Mediabunny-MPL-2.0.txt).
- The browser encoder bundles the unmodified upstream library with the project's original adapter. The source adapter and locked build dependencies are included in this repository; `npm run build:film` reproduces the bundle.

The optional local renderer uses npm-installed @napi-rs/canvas (MIT) and FFmpeg through ffmpeg-static (GPL-3.0-or-later); their binaries are not checked into or served by the static website. Their upstream license files are distributed with the installed packages.
