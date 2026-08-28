// Headless harness: stub p5 + DOM, run the real algorithm, report stats.
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/index.html', 'utf8');
const m = src.match(/<script>\n([\s\S]*?)\n    <\/script>/);
if (!m) { console.error('script not found'); process.exit(1); }

// seeded LCG so runs are reproducible
let _s = 1;
function rnd() { _s = (_s * 1664525 + 1013904223) >>> 0; return _s / 4294967296; }

const stubs = {
    PI: Math.PI, TWO_PI: Math.PI * 2, HALF_PI: Math.PI / 2, ROUND: 'round',
    radians: d => d * Math.PI / 180,
    random: (a, b) => a === undefined ? rnd() : (b === undefined ? rnd() * a : a + rnd() * (b - a)),
    randomSeed: s => { _s = s >>> 0 || 1; },
    noiseSeed: () => {},
    noise: () => 0.5,
    pow: Math.pow,
    createCanvas: () => ({ parent: () => {} }),
    background: () => {}, stroke: () => {}, strokeWeight: () => {}, strokeCap: () => {},
    line: () => {}, noStroke: () => {}, fill: () => {}, circle: () => {},
    beginShape: () => {}, endShape: () => {}, vertex: () => {}, noFill: () => {},
    loop: () => { looping = true; }, noLoop: () => { looping = false; },
    saveCanvas: () => {},
    window: { addEventListener: () => {} },
    location: { hash: '' }, history: { replaceState: () => {} },
    btoa: s => s, atob: s => s, Image: function(){}, URL: { createObjectURL: () => '', revokeObjectURL: () => {} },
    navigator: {},
    document: { getElementById: () => ({ value: 0, textContent: '', style: {} }), querySelector: () => null },
};
let looping = true;
stubs.window.looping = true;

const fn = new Function(...Object.keys(stubs), m[1] + `
;return { get params(){return params}, get tendrils(){return tendrils}, get grid(){return grid},
  initializeSystem, draw, isBlocked, W, H, get looping(){ return undefined; } };`);
const api = fn(...Object.values(stubs));

api.initializeSystem();
let frames = 0;
while (looping && frames < 20000) { api.draw(); frames++; }

const ts = api.tendrils;
const vis = ts.filter(t => t.idx > 1 && !t.erased);
const spiral = vis.filter(t => t.coilPath);
const forkEnd = vis.filter(t => !t.coilPath && t.branches > 0);
const deadEnds = vis.filter(t => !t.coilPath && t.branches === 0);
const fragments = vis.filter(t => !t.coilPath && t.trail.length < 14);
const roots = vis.filter(t => !t.parentRef);
const erased = ts.filter(t => t.erased).length;

const c = api.params.clearance, cs = c * 4;
let covered = 0, total = 0;
for (let gx = 40; gx < api.W - 40; gx += cs) {
    for (let gy = 40; gy < api.H - 40; gy += cs) {
        total++;
        let hit = false;
        for (let dx = 0; dx < cs && !hit; dx += c)
            for (let dy = 0; dy < cs && !hit; dy += c)
                if (api.isBlocked(gx + dx, gy + dy, -1, 0, Infinity)) hit = true;
        if (hit) covered++;
    }
}

console.log(JSON.stringify({
    visibleLines: vis.length,
    spiralEnds: spiral.length,
    forkEnds: forkEnd.length,
    deadEnds: deadEnds.length,
    fragments: fragments.length,
    roots: roots.length,
    erased,
    coverage: (covered / total).toFixed(2),
}, null, 2));
