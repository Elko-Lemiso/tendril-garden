#!/usr/bin/env node
// Offline renderer: the browser's exact Canvas frame renderer, rasterized by
// native Skia and piped to FFmpeg. No browser automation, network or cloud.
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { createCanvas } = require('@napi-rs/canvas');
const ffmpeg = require('ffmpeg-static');
const Film = require('../film.js');
const { makeApi } = require('../harness.js');

async function main() {
  const args = process.argv.slice(2), flags = {};
  if (args.includes('--help')) {
    console.log('node tools/render-film.cjs [--seed 12345 | --recipe drawing.film.json] [--duration 12] [--size 1080] [--aspect square|landscape|portrait] [--output exports/tendril.mp4]');
    return;
  }
  for (let i = 0; i < args.length; i += 2) {
    if (!['--seed', '--recipe', '--duration', '--size', '--aspect', '--output'].includes(args[i]) || !args[i + 1]) throw new Error('Unknown or incomplete option. Use --help.');
    flags[args[i].slice(2)] = args[i + 1];
  }
  let scene, savedOptions = {};
  if (flags.recipe) {
    if (flags.seed) throw new Error('Choose a seed or a saved recipe, not both.');
    const stat = await fs.stat(flags.recipe);
    if (stat.size > 80_000_000) throw new Error('Film recipe is too large.');
    const recipe = JSON.parse(await fs.readFile(flags.recipe, 'utf8'));
    scene = recipe.scene; savedOptions = recipe.options || {};
  } else {
    const seed = Number(flags.seed ?? 12345);
    if (!Number.isSafeInteger(seed) || seed < 1 || seed > 0xffffffff) throw new Error('Seed must be a positive 32-bit integer.');
    console.log('Growing seed ' + seed + ' with the existing engine…');
    const api = makeApi();
    api.params.seed = seed; api.params.render = 'instant';
    api.initializeSystem();
    let guard = 0;
    while (api.isLooping() && guard++ < 30000) api.draw();
    if (api.isLooping()) throw new Error('The drawing did not settle.');
    scene = api.getFilmScene();
  }
  const opts = Film.options({ ...savedOptions, ...(flags.duration ? { duration: flags.duration } : {}), ...(flags.size ? { size: flags.size } : {}), ...(flags.aspect ? { aspect: flags.aspect } : {}) });
  const prepared = Film.prepare(scene);
  const output = path.resolve(flags.output || path.join('exports', 'tendril-' + scene.seed + '-' + opts.duration + 's.mp4'));
  if (path.extname(output).toLowerCase() !== '.mp4') throw new Error('The local renderer writes MP4 files.');
  await fs.mkdir(path.dirname(output), { recursive: true });
  const recipePath = output.replace(/\.mp4$/i, '.film.json');
  const posterPath = output.replace(/\.mp4$/i, '.poster.png');
  for (const file of [output, recipePath, posterPath]) {
    try { await fs.access(file); throw new Error('Output already exists; choose a new filename.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const canvas = createCanvas(opts.width, opts.height), ctx = canvas.getContext('2d');
  const child = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-n', '-f', 'image2pipe', '-framerate', String(opts.fps), '-vcodec', 'png', '-i', 'pipe:0', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-threads', '1', '-movflags', '+faststart', '-map_metadata', '-1', '-metadata', 'creation_time=1970-01-01T00:00:00Z', output], { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
  let diagnostic = '', streamError;
  child.stderr.on('data', bytes => { diagnostic = (diagnostic + bytes).slice(-4000); });
  child.stdin.on('error', error => { streamError = error; });
  const completion = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', code => code === 0 ? resolve() : reject(new Error('FFmpeg failed: ' + diagnostic))); });
  // Observe rejection immediately, even if encoding fails while frames render.
  completion.catch(() => {});
  try {
    for (let frame = 0; frame < opts.frames; frame++) {
      if (streamError) throw streamError;
      Film.drawFrame(ctx, prepared, frame, opts);
      const png = canvas.toBuffer('image/png');
      if (!child.stdin.write(png)) await once(child.stdin, 'drain');
      if (frame % opts.fps === 0) console.log('Rendering ' + Math.floor(frame / opts.fps) + ' / ' + opts.duration + ' seconds');
    }
    child.stdin.end();
    await completion;
  } catch (error) { child.kill(); throw error; }
  await fs.writeFile(recipePath, JSON.stringify({ scene, options: opts }), { flag: 'wx' });
  await fs.writeFile(posterPath, canvas.toBuffer('image/png'), { flag: 'wx' });
  const stats = await fs.stat(output);
  console.log(JSON.stringify({ output, recipePath, bytes: stats.size, frames: opts.frames, fps: opts.fps, duration: opts.duration, width: opts.width, height: opts.height, seed: scene.seed, strokes: prepared.strokes.length }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
