const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { createCanvas } = require('@napi-rs/canvas');
const Film = require('../film.js');

test('browser exporter reports unavailable encoding instead of returning an empty film', async () => {
  const { exportVideo } = await import('../tools/film-encode-entry.mjs');
  const scene = { version: 1, width: 1200, height: 1200, seed: 12345, background: '#1e1c18', palette: ['#743b16', '#c97b4a', '#7fa08a'], strokes: [{ ci: 1, w: 2, pts: [{ x: 10, y: 10 }, { x: 111, y: 10 }] }], dots: [] };
  await assert.rejects(exportVideo(scene, {}), /browser cannot export video/);
});

test('local Canvas frames repeat exactly when scrubbing backwards and forwards', () => {
  const scene = Film.prepare({ version: 1, width: 1200, height: 1200, seed: 12345, background: '#1e1c18', palette: ['#743b16', '#c97b4a', '#7fa08a'], strokes: [{ ci: 1, w: 6, pts: [{ x: 100, y: 100 }, { x: 600, y: 800 }, { x: 1100, y: 300 }] }], dots: [] });
  const opts = Film.options({ size: 360 });
  const canvas = createCanvas(opts.width, opts.height), ctx = canvas.getContext('2d');
  const render = frame => {
    Film.drawFrame(ctx, scene, frame, opts);
    return createHash('sha256').update(canvas.toBuffer('image/png')).digest('hex');
  };
  const middle = render(100), last = render(359), first = render(0);
  assert.equal(render(100), middle);
  assert.notEqual(first, last);
});
