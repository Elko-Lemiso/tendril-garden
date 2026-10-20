const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const Film = require('../film.js');
const { makeApi } = require('../harness.js');

const recipe = () => ({ version: 1, width: 1200, height: 1200, seed: 12345, background: '#1e1c18', palette: ['#743b16', '#c97b4a', '#7fa08a'], strokes: [{ ci: 1, w: 2, pts: [{ x: 10, y: 10 }, { x: 11, y: 10 }, { x: 111, y: 10 }] }], dots: [{ x: 111, y: 10, r: 2, ci: 1 }] });

test('film has a fixed frame count and preserves the entire square in each shape', () => {
  for (const duration of [10, 12, 15]) {
    for (const aspect of ['square', 'landscape', 'portrait']) {
      const opts = Film.options({ duration, aspect });
      assert.equal(opts.frames, duration * 30);
      const place = Film.placement(recipe(), opts);
      assert.ok(place.x >= 0 && place.y >= 0);
      assert.ok(place.x + 1200 * place.scale <= opts.width);
      assert.ok(place.y + 1200 * place.scale <= opts.height);
    }
  }
});

test('reveal follows arc length rather than uneven vertex spacing', () => {
  const stroke = Film.prepare(recipe()).strokes[0];
  const halfway = Film.prefix(stroke, .5);
  assert.deepEqual(halfway.at(-1), { x: 60.5, y: 10 });
  assert.deepEqual(stroke.pts.at(-1), { x: 111, y: 10 });
});

test('opening is blank and the final hold includes every stroke and terminal dot', () => {
  const scene = Film.prepare(recipe()), opts = Film.options();
  assert.doesNotMatch(Film.frameSVG(scene, 0, opts), /polyline|circle/);
  const last = Film.frameSVG(scene, opts.frames - 1, opts);
  assert.match(last, /10,10 11,10 111,10/);
  assert.match(last, /<circle/);
  assert.equal(Film.frameSVG(scene, opts.frames - 20, opts), last);
  assert.throws(() => Film.frameSVG(scene, opts.frames, opts), /outside/);
});

test('a scene and frame render reproducibly regardless of frame request order', () => {
  const scene = Film.prepare(recipe()), opts = Film.options({ size: 360 });
  const render = frame => Film.frameSVG(scene, frame, opts);
  const hash = value => createHash('sha256').update(value).digest('hex');
  const first = hash(render(125));
  render(359); render(0);
  assert.equal(hash(render(125)), first);
  assert.notEqual(hash(render(0)), hash(render(359)));
});

test('saved scene validation prevents invalid geometry and SVG markup injection', () => {
  for (const input of [NaN, Infinity, 9, 16]) assert.throws(() => Film.options({ duration: input }));
  assert.throws(() => Film.options({ size: 10000 }));
  const hostile = recipe(); hostile.palette[0] = 'red" onload="alert(1)';
  assert.throws(() => Film.prepare(hostile), /hex/);
  const invalid = recipe(); invalid.strokes[0].pts[0].x = Infinity;
  assert.throws(() => Film.prepare(invalid), /point/);
  const empty = recipe(); empty.strokes = [];
  assert.throws(() => Film.prepare(empty), /Grow a drawing/);
});

test('film snapshot reuses actual engine paths and never changes its geometry', () => {
  const api = makeApi();
  api.params.seed = 12345; api.params.render = 'instant';
  api.initializeSystem();
  const before = JSON.stringify(api.collectStrokes());
  const scene = api.getFilmScene();
  assert.equal(JSON.stringify(scene.strokes), before);
  assert.equal(scene.seed, 12345);
  const prepared = Film.prepare(scene), opts = Film.options({ size: 360 });
  assert.ok(prepared.strokes.length > 10);
  Film.frameSVG(prepared, 0, opts); Film.frameSVG(prepared, 359, opts);
  scene.strokes[0].pts[0].x = -999;
  assert.equal(JSON.stringify(api.collectStrokes()), before);
  assert.notEqual(prepared.strokes[0].pts[0].x, -999);
});
