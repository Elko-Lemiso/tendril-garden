import { Output, Mp4OutputFormat, WebMOutputFormat, BufferTarget, CanvasSource, Quality, canEncodeVideo } from 'mediabunny';
import Film from '../film.js';

export async function exportVideo(rawScene, inputOptions, { format = 'mp4', signal, onProgress = () => {} } = {}) {
  const scene = Film.prepare(rawScene), opts = Film.options(inputOptions);
  if (!['mp4', 'webm'].includes(format)) throw new Error('Choose MP4 or WebM.');
  if (typeof VideoEncoder === 'undefined') throw new Error('This browser cannot export video. Save the film recipe and use the local MP4 renderer, or try a current Chrome or Edge browser.');
  const codec = format === 'mp4' ? 'avc' : 'vp9';
  const quality = new Quality({ bitrate: 6_000_000 });
  if (!await canEncodeVideo(codec, { width: opts.width, height: opts.height, frameRate: opts.fps, quality })) throw new Error(`This browser cannot encode ${format.toUpperCase()} at this size. Try ${format === 'mp4' ? 'WebM' : 'MP4'} or a smaller size. The saved recipe also works with the local MP4 renderer.`);
  const canvas = document.createElement('canvas');
  canvas.width = opts.width; canvas.height = opts.height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('A drawing surface is not available.');
  const output = new Output({ format: format === 'mp4' ? new Mp4OutputFormat() : new WebMOutputFormat(), target: new BufferTarget() });
  const source = new CanvasSource(canvas, { codec, quality });
  output.addVideoTrack(source, { frameRate: opts.fps });
  try {
    await output.start();
    for (let frame = 0; frame < opts.frames; frame++) {
      if (signal?.aborted) throw new DOMException('Film export cancelled.', 'AbortError');
      Film.drawFrame(ctx, scene, frame, opts);
      await source.add(frame / opts.fps, 1 / opts.fps, { keyFrame: frame % opts.fps === 0 });
      onProgress((frame + 1) / opts.frames);
      if (frame % 8 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
    source.close();
    await output.finalize();
    if (signal?.aborted) throw new DOMException('Film export cancelled.', 'AbortError');
    return new Blob([output.target.buffer], { type: format === 'mp4' ? 'video/mp4' : 'video/webm' });
  } catch (error) {
    if (output.state !== 'finalized' && output.state !== 'canceled') await output.cancel();
    throw error;
  }
}
