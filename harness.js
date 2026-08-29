#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
//  TENDRIL GARDEN — REGRESSION HARNESS
//
//  Runs the real engine headlessly across a matrix of configurations and
//  seeds, asserts the invariants the project promises, and compares a
//  geometry hash against a blessed golden file.
//
//    node harness.js check    → exit 1 on any invariant failure or hash drift
//    node harness.js bless    → accept current geometry as the new golden
//
//  INVARIANTS (always enforced, never blessable):
//    • zero dead ends       (every visible line resolves or forks or is a
//                            deliberate plain/void ending)
//    • zero fragments       (no floating commas)
//    • the run terminates
//    • coverage ≥ per-config floor
//    • ink balance          (max−min share ≤ 12 points, lineage mode)
//    • shape balance        (max/min drawn-count ratio ≤ 1.6 when mixed)
//
//  HASH: FNV-1a over every visible stroke's rounded points. Drift means the
//  drawing changed for a given seed — fine if intentional (re-bless), fatal
//  if not.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'index.html');
const GOLDEN = path.join(__dirname, 'golden.json');
const MODE = process.argv[2] || 'check';

// ── engine extraction: anchored on the engine banner, because the file
// also inlines all of p5.js in an earlier <script> block ──
function extractEngine(src) {
  const banner = src.indexOf('//  TENDRIL GARDEN');
  if (banner < 0) throw new Error('engine banner not found');
  const open = src.lastIndexOf('<script>', banner);
  const close = src.indexOf('</script>', banner);
  if (open < 0 || close < 0) throw new Error('engine script block not found');
  return src.slice(open + '<script>'.length, close);
}

function makeApi() {
  const src = fs.readFileSync(FILE, 'utf8');
  const engine = extractEngine(src);
  let _s = 1;
  const rnd = () => { _s = (_s * 1664525 + 1013904223) >>> 0; return _s / 4294967296; };
  const state = { looping: true };
  const stubs = {
    PI: Math.PI, TWO_PI: Math.PI * 2, HALF_PI: Math.PI / 2, ROUND: 'round',
    radians: d => d * Math.PI / 180,
    random: (a, b) => a === undefined ? rnd() : (b === undefined ? rnd() * a : a + rnd() * (b - a)),
    randomSeed: s => { _s = s >>> 0 || 1; }, noiseSeed: () => {}, noise: () => 0.5,
    pow: Math.pow, pixelDensity: () => {},
    createCanvas: () => ({ parent: () => {}, elt: { addEventListener: () => {}, style: {}, setPointerCapture: () => {}, getBoundingClientRect: () => ({ width: 0 }) } }),
    background: () => {}, stroke: () => {}, strokeWeight: () => {}, strokeCap: () => {},
    line: () => {}, noStroke: () => {}, fill: () => {}, circle: () => {},
    beginShape: () => {}, endShape: () => {}, vertex: () => {}, noFill: () => {},
    color: () => ({ setAlpha() {} }),
    loop: () => { state.looping = true; }, noLoop: () => { state.looping = false; }, saveCanvas: () => {},
    lerpColor: () => '#000000',
    window: { addEventListener: () => {}, matchMedia: () => ({ matches: false }), devicePixelRatio: 1 },
    location: { hash: '' }, history: { replaceState: () => {} },
    btoa: s => s, atob: s => s, Image: function () {},
    URL: { createObjectURL: () => '', revokeObjectURL: () => {} }, navigator: {},
    setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0,
    document: {
      hidden: false, addEventListener() {},
      getElementById: () => ({ value: 0, textContent: '', style: {}, files: [], appendChild() {}, remove() {}, classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {} }),
      querySelector: () => null, querySelectorAll: () => [],
      createElement: () => ({ getContext: () => null, addEventListener: () => {}, style: {}, classList: { add() {}, remove() {} } }),
    },
  };
  const fn = new Function(...Object.keys(stubs), engine + `
    ;return {
      get params(){ return params }, get tendrils(){ return tendrils },
      get doodles(){ return doodles },
      setMask(m){ maskArr = m; if (typeof maskDistField !== 'undefined') maskDistField = m && typeof maskDistance === 'function' ? maskDistance() : null; },
      initializeSystem, draw, isBlocked, W, H,
      tendrilPath: (typeof tendrilPath === 'function' ? tendrilPath : null),
      colIdxOf: (typeof colIdxOf === 'function' ? colIdxOf : null),
      collectStrokes: (typeof collectStrokes === 'function' ? collectStrokes : null),
      stitchStrokes: (typeof stitchStrokes === 'function' ? stitchStrokes : null),
      familyPaths: (typeof familyPaths === 'function' ? familyPaths : null),
    };`);
  const api = fn(...Object.values(stubs));
  api.isLooping = () => state.looping;
  return api;
}

// ── one synthetic mask: three bars of different widths (tests adaptive fill) ──
function syntheticMask(api, narrow) {
  const N = 300, m = new Uint8Array(N * N);
  // wide: 100–240px bars (an easy blob). narrow: 32–40px bars — real
  // letterform stroke widths, the case that used to force pure linework.
  const bars = narrow === 'thin' ? [[60, 66], [140, 145], [200, 206]]
             : narrow ? [[60, 70], [140, 148], [200, 210]]
                      : [[40, 70], [120, 180], [220, 245]];
  for (let y = 30; y < 270; y++) for (const [a, b] of bars)
    for (let x = a; x < b; x++) m[y * N + x] = 1;
  return m;
}

// ── metrics ──
function fnv(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16);
}
function measure(api, wantMask) {
  const T = api.tendrils;
  const vis = T.filter(t => !t.erased && t.idx > 1);
  // in pure-linework and void modes a plain stop IS the resolution
  const plainModes = api.params.endings === 'lines' || api.params.endings === 'empty';
  const dead = vis.filter(t => t.state === 'done' && !t.coilPath && t.branches === 0 &&
    !(t.hosts > 0) && !t.contour && !t.plainEnd && !t.voidEnd && !plainModes);
  const frags = vis.filter(t => !t.coilPath && !t.contour && t.trail.length < 14 && t.branches === 0 && !(t.hosts > 0));
  // ink share by drawn length
  const L = [0, 0, 0];
  for (const t of vis) {
    if (t.contour) continue;             // outline passes are always ink 0 by design
    const p = api.tendrilPath(t); let d = 0;
    for (let i = 1; i < p.length; i++) d += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y);
    L[api.colIdxOf(t)] += d;
  }
  const tot = L[0] + L[1] + L[2] || 1;
  const shares = L.map(x => x / tot * 100);
  // shape tally
  const shapes = {};
  for (const t of vis) if (t.coilKind) shapes[t.coilKind] = (shapes[t.coilKind] || 0) + 1;
  // coverage
  const c = api.params.clearance;
  let covered = 0, total = 0;
  if (wantMask) {
    // thin strokes demand a sampler finer than the strokes themselves
    // (clearance-sized cells step right over 20px bars): walk an 8px
    // lattice of in-mask points; a point is covered when any ink sits
    // within one clearance of it
    for (let gx = 20; gx < api.W - 20; gx += 8) for (let gy = 20; gy < api.H - 20; gy += 8) {
      if (!wantMask(gx, gy)) continue;
      total++;
      if (api.isBlocked(gx, gy, -1, 0, Infinity)) covered++;
    }
  } else {
    const cs = c * 4;
    for (let gx = 40; gx < api.W - 40; gx += cs) for (let gy = 40; gy < api.H - 40; gy += cs) {
      total++;
      let hit = false;
      for (let dx = 0; dx < cs && !hit; dx += c) for (let dy = 0; dy < cs && !hit; dy += c)
        if (api.isBlocked(gx + dx, gy + dy, -1, 0, Infinity)) hit = true;
      if (hit) covered++;
    }
  }
  // geometry hash
  let acc = '';
  for (const t of vis) {
    const p = api.tendrilPath(t);
    for (let i = 0; i < p.length; i += 3) acc += (p[i].x | 0) + ',' + (p[i].y | 0) + ';';
  }
  return {
    lines: vis.length, deadEnds: dead.length, fragments: frags.length,
    spiralPct: (() => {
      const eligible = vis.filter(t => !t.contour && !t.plainEnd && !t.voidEnd);
      return Math.round(eligible.filter(t => t.coilPath).length / Math.max(1, eligible.length) * 100);
    })(),
    inkSpread: +(Math.max(...shares) - Math.min(...shares)).toFixed(1),
    shapes,
    coverage: +(covered / Math.max(1, total)).toFixed(3),
    hash: fnv(acc),
  };
}

// ── the matrix ──
const CONFIGS = [
  { name: 'default', set: {} , floor: 0.90 },
  { name: 'angular60', set: { style: 'angular', latticeAngle: 60 }, floor: 0.90 },
  { name: 'flowing', set: { style: 'flowing' }, floor: 0.85 },
  { name: 'tiling', set: { tile: 'on' }, floor: 0.95 },
  { name: 'rot6', set: { symmetry: 'rot6' }, floor: 0.80 },
  { name: 'spirals-only', set: { shapes: ['circles'], endings: 'circles' }, floor: 0.88 },
  { name: 'lines-only', set: { shapes: ['lines'], endings: 'lines' }, floor: 0.92 },
  { name: 'tree', set: { origin: 'tree', branching: 9 }, floor: 0.35 },
  { name: 'mask-bars', set: {}, mask: true, floor: 0.80 },
  { name: 'mask-narrow', set: {}, mask: 'narrow', floor: 0.85 },
  // the switchable grammar: each new mechanism gets its own runs so its
  // contribution (and its regressions) are visible in isolation
  { name: 'vacancy', set: { vacancy: 'on' }, floor: 0.90 },
  { name: 'rhythm-loose', set: { rhythm: 'loose' }, floor: 0.85 },
  { name: 'rhythm-key', set: { rhythm: 'strict', style: 'angular', latticeAngle: 90 }, floor: 0.85 },
  { name: 'vac-rhythm', set: { vacancy: 'on', rhythm: 'loose', style: 'angular', latticeAngle: 60 }, floor: 0.85 },
  // masks + switches: the review's blind spot, plus the flagged scenario —
  // thin strokes at high clearance, where a wrong doneness test starves the fill
  { name: 'mask-vac', set: { vacancy: 'on' }, mask: true, floor: 0.80 },
  { name: 'mask-narrow-vac', set: { vacancy: 'on' }, mask: 'narrow', floor: 0.85 },
  { name: 'mask-thin-off', set: { clearance: 22 }, mask: 'thin', floor: 0.10, minLines: 2, slowMs: 15000 },
  { name: 'mask-thin-vac', set: { vacancy: 'on', clearance: 22 }, mask: 'thin', floor: 0.10, minLines: 2, slowMs: 15000 },
  { name: 'vac-tile', set: { vacancy: 'on', tile: 'on' }, floor: 0.95 },
];
const SEEDS = [12345, 4242, 99, 777, 31337];

const results = {}, failures = [];
for (const cfg of CONFIGS) {
  for (const seed of SEEDS) {
    const api = makeApi();                       // fresh module state per run
    Object.assign(api.params, JSON.parse(JSON.stringify(cfg.set)));
    api.params.seed = seed;
    api.params.render = 'instant';
    api.params.startEmpty = 'off';
    let maskFn = null;
    if (cfg.mask) {
      const m = syntheticMask(api, cfg.mask === true ? false : cfg.mask);
      api.setMask(m);
      maskFn = (x, y) => m[Math.floor(y * 300 / api.H) * 300 + Math.floor(x * 300 / api.W)] === 1;
    }
    const t0 = Date.now();
    api.initializeSystem();
    let guard = 0;
    while (api.isLooping() && guard++ < 30000) api.draw();
    const ms = Date.now() - t0;
    const key = cfg.name + ':' + seed;
    const m = measure(api, maskFn);
    m.ms = ms;
    results[key] = m;
    // invariants
    if (api.isLooping()) failures.push(key + ': did not terminate');
    if (m.deadEnds > 0) failures.push(key + ': ' + m.deadEnds + ' dead ends');
    if (m.fragments > 0) failures.push(key + ': ' + m.fragments + ' fragments');
    if (m.coverage < cfg.floor) failures.push(key + ': coverage ' + m.coverage + ' < ' + cfg.floor);
    if (cfg.minLines && m.lines < cfg.minLines) failures.push(key + ': only ' + m.lines + ' lines, need ' + cfg.minLines);
    if (cfg.name === 'default' && m.inkSpread > 12) failures.push(key + ': ink spread ' + m.inkSpread);
    if (cfg.name === 'default') {
      const v = Object.values(m.shapes);
      if (v.length >= 2 && Math.max(...v) / Math.max(1, Math.min(...v)) > 1.6)
        failures.push(key + ': shape imbalance ' + JSON.stringify(m.shapes));
    }
    if (ms > (cfg.slowMs || 8000)) failures.push(key + ': slow (' + ms + 'ms)');
  }
}

if (MODE === 'show') {
  // full metrics for every key matching the given substring
  const pat = process.argv[3] || '';
  for (const k in results) if (k.includes(pat)) console.log(k, JSON.stringify(results[k]));
  process.exit(0);
}

if (MODE === 'bless') {
  const golden = {};
  for (const k in results) golden[k] = results[k].hash;
  fs.writeFileSync(GOLDEN, JSON.stringify(golden, null, 1));
  console.log('BLESSED', Object.keys(golden).length, 'runs');
  if (failures.length) { console.log('WARNING — invariant failures at bless time:'); failures.forEach(f => console.log('  ' + f)); process.exit(1); }
  process.exit(0);
}

let drift = [];
if (fs.existsSync(GOLDEN)) {
  const golden = JSON.parse(fs.readFileSync(GOLDEN, 'utf8'));
  for (const k in golden) {
    if (!results[k]) drift.push(k + ': missing from run');
    else if (results[k].hash !== golden[k]) drift.push(k + ': geometry changed');
  }
} else drift.push('no golden.json — run `node harness.js bless` first');

console.log('runs:', Object.keys(results).length);
const worst = Object.entries(results).sort((a, b) => a[1].coverage - b[1].coverage)[0];
console.log('lowest coverage:', worst[0], worst[1].coverage);
if (failures.length) { console.log('\nINVARIANT FAILURES:'); failures.forEach(f => console.log('  ✗ ' + f)); }
if (drift.length) { console.log('\nGEOMETRY DRIFT (re-bless if intentional):'); drift.forEach(f => console.log('  ~ ' + f)); }
if (!failures.length && !drift.length) console.log('\nALL GREEN');
process.exit(failures.length || drift.length ? 1 : 0);
