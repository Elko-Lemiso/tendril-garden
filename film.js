// One frame-indexed timeline for the studio preview and both video exporters.
// Replays surviving geometry; it never advances or rerolls the drawing engine.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TendrilFilm = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clamp = x => Math.max(0, Math.min(1, x));
  const finite = x => typeof x === 'number' && Number.isFinite(x);
  const color = x => typeof x === 'string' && /^#[0-9a-f]{6}$/i.test(x);

  function options(input = {}) {
    const duration = Number(input.duration ?? 12);
    const size = Number(input.size ?? 1080);
    const fps = 30;
    const aspect = input.aspect ?? 'square';
    if (!finite(duration) || duration < 10 || duration > 15) throw new Error('Choose a film length between 10 and 15 seconds.');
    if (![360, 720, 1080].includes(size)) throw new Error('Choose 360, 720 or 1080 pixels.');
    if (!['square', 'landscape', 'portrait'].includes(aspect)) throw new Error('Unknown film shape.');
    const long = Math.round(size * 16 / 9 / 2) * 2;
    const width = aspect === 'landscape' ? long : size;
    const height = aspect === 'portrait' ? long : size;
    return { duration, size, fps, aspect, width, height, frames: Math.round(duration * fps) };
  }

  function prepare(scene) {
    if (!scene || scene.version !== 1 || !finite(scene.width) || !finite(scene.height) || scene.width <= 0 || scene.height <= 0 || scene.width > 10000 || scene.height > 10000) throw new Error('This is not a supported Tendril film recipe.');
    if (!color(scene.background) || !Array.isArray(scene.palette) || scene.palette.length !== 3 || !scene.palette.every(color)) throw new Error('Film inks must be six-digit hex colours.');
    if (!Array.isArray(scene.strokes) || scene.strokes.length === 0 || scene.strokes.length > 10000) throw new Error('Grow a drawing before making a film.');
    let pointCount = 0;
    const strokes = scene.strokes.map(stroke => {
      if (!Number.isInteger(stroke.ci) || stroke.ci < 0 || stroke.ci > 2 || !finite(stroke.w) || stroke.w <= 0 || stroke.w > 100 || !Array.isArray(stroke.pts) || stroke.pts.length < 2) throw new Error('Invalid film stroke.');
      pointCount += stroke.pts.length;
      if (pointCount > 2000000) throw new Error('This drawing is too large for a short film.');
      const cumulative = [0];
      const pts = stroke.pts.map((point, i) => {
        if (!point || !finite(point.x) || !finite(point.y) || Math.abs(point.x) > 20000 || Math.abs(point.y) > 20000) throw new Error('Invalid film point.');
        if (i) cumulative.push(cumulative[i - 1] + Math.hypot(point.x - stroke.pts[i - 1].x, point.y - stroke.pts[i - 1].y));
        return { x: point.x, y: point.y };
      });
      return { ci: stroke.ci, w: stroke.w, pts, cumulative, length: cumulative.at(-1) };
    });
    const dots = scene.dots ?? [];
    if (!Array.isArray(dots) || dots.length > 50000 || dots.some(d => !d || !finite(d.x) || !finite(d.y) || !finite(d.r) || d.r <= 0 || d.r > 100 || Math.abs(d.x) > 20000 || Math.abs(d.y) > 20000 || !Number.isInteger(d.ci) || d.ci < 0 || d.ci > 2)) throw new Error('Invalid film dots.');
    return { ...scene, palette: [...scene.palette], strokes, dots: dots.map(d => ({ ...d })) };
  }

  function timing(frame, opts) {
    if (!Number.isInteger(frame) || frame < 0 || frame >= opts.frames) throw new RangeError('Film frame is outside the timeline.');
    const time = frame / opts.fps;
    const start = 0.35;
    const growth = opts.duration - start - 1;
    return { time, start, growth, dotAlpha: clamp((time - (start + growth - .2)) / .2) };
  }

  function strokeProgress(index, count, timeline) {
    const begin = timeline.start + index / Math.max(1, count - 1) * timeline.growth * .82;
    return clamp((timeline.time - begin) / (timeline.growth * .18));
  }

  // Return a prefix ending at an interpolated point: smooth speed, not vertex count.
  function prefix(stroke, progress) {
    if (progress <= 0) return [];
    if (progress >= 1 || stroke.length === 0) return stroke.pts;
    const distance = stroke.length * progress;
    let lo = 1, hi = stroke.cumulative.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (stroke.cumulative[mid] < distance) lo = mid + 1;
      else hi = mid;
    }
    const a = stroke.pts[lo - 1], b = stroke.pts[lo];
    const span = stroke.cumulative[lo] - stroke.cumulative[lo - 1];
    const fraction = span ? (distance - stroke.cumulative[lo - 1]) / span : 0;
    return stroke.pts.slice(0, lo).concat({ x: a.x + (b.x - a.x) * fraction, y: a.y + (b.y - a.y) * fraction });
  }

  function placement(scene, opts) {
    const scale = Math.min(opts.width / scene.width, opts.height / scene.height);
    return { scale, x: (opts.width - scene.width * scale) / 2, y: (opts.height - scene.height * scale) / 2 };
  }

  function drawFrame(ctx, scene, frame, opts) {
    const clock = timing(frame, opts), place = placement(scene, opts);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = scene.background;
    ctx.fillRect(0, 0, opts.width, opts.height);
    ctx.translate(place.x, place.y);
    ctx.scale(place.scale, place.scale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < scene.strokes.length; i++) {
      const stroke = scene.strokes[i];
      const pts = prefix(stroke, strokeProgress(i, scene.strokes.length, clock));
      if (pts.length < 2) continue;
      ctx.strokeStyle = scene.palette[stroke.ci];
      ctx.lineWidth = stroke.w;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let p = 1; p < pts.length; p++) ctx.lineTo(pts[p].x, pts[p].y);
      ctx.stroke();
    }
    ctx.globalAlpha = clock.dotAlpha;
    for (const dot of scene.dots) {
      ctx.fillStyle = scene.palette[dot.ci];
      ctx.beginPath(); ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function frameSVG(scene, frame, opts) {
    const clock = timing(frame, opts), place = placement(scene, opts);
    const n = x => Number(x.toFixed(4));
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${opts.width}" height="${opts.height}" viewBox="0 0 ${opts.width} ${opts.height}"><rect width="100%" height="100%" fill="${scene.background}"/><g transform="translate(${n(place.x)} ${n(place.y)}) scale(${n(place.scale)})" fill="none" stroke-linecap="round" stroke-linejoin="round">`;
    for (let i = 0; i < scene.strokes.length; i++) {
      const stroke = scene.strokes[i];
      const pts = prefix(stroke, strokeProgress(i, scene.strokes.length, clock));
      if (pts.length > 1) svg += `<polyline stroke="${scene.palette[stroke.ci]}" stroke-width="${n(stroke.w)}" points="${pts.map(p => `${n(p.x)},${n(p.y)}`).join(' ')}"/>`;
    }
    if (clock.dotAlpha) for (const dot of scene.dots) svg += `<circle cx="${n(dot.x)}" cy="${n(dot.y)}" r="${n(dot.r)}" fill="${scene.palette[dot.ci]}" opacity="${n(clock.dotAlpha)}"/>`;
    return svg + '</g></svg>';
  }

  return { options, prepare, timing, strokeProgress, prefix, placement, drawFrame, frameSVG };
});
