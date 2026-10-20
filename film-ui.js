(function () {
  'use strict';
  let dialog, scene, prepared, opts, animation, waiting, exporting = false, abort;
  const byId = id => dialog.querySelector('#' + id);
  function stop() { cancelAnimationFrame(animation); animation = null; }
  function status(text) { byId('film-status').textContent = text; }
  function save(name, blob) {
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  function controls(disabled) {
    for (const element of dialog.querySelectorAll('[data-film-control]')) element.disabled = disabled;
    byId('film-cancel').hidden = !exporting;
  }
  function paint(frame) {
    if (!prepared) return;
    TendrilFilm.drawFrame(byId('film-canvas').getContext('2d', { alpha: false }), prepared, frame, opts);
    byId('film-scrub').value = frame;
    byId('film-time').textContent = (frame / opts.fps).toFixed(1) + ' / ' + opts.duration + ' s';
  }
  function configure() {
    stop();
    opts = TendrilFilm.options({ duration: byId('film-duration').value, size: byId('film-size').value, aspect: byId('film-aspect').value });
    const canvas = byId('film-canvas'); canvas.width = opts.width; canvas.height = opts.height;
    byId('film-scrub').max = opts.frames - 1;
    paint(opts.frames - 1);
  }
  function capture() {
    if (!dialog.open) return;
    try {
      scene = getFilmScene(); prepared = TendrilFilm.prepare(scene);
      configure(); controls(false);
      status('Seed ' + scene.seed + ' · 30 frames per second · silent film. Your drawing stays unchanged.');
    } catch (error) {
      if (error.code === 'GROWING') {
        status('Your drawing is still growing. The film will be ready when it finishes.');
        waiting = setTimeout(capture, 250);
      } else status(error.message);
    }
  }
  function close() { stop(); clearTimeout(waiting); abort?.abort(); dialog.close(); }
  function create() {
    dialog = document.createElement('dialog');
    dialog.className = 'film-dialog';
    dialog.setAttribute('aria-labelledby', 'film-title');
    dialog.innerHTML = `<div class="film-heading"><div><p class="film-eyebrow">Tendril Garden / moving ink</p><h2 id="film-title">Make a short film</h2></div><button type="button" id="film-close" aria-label="Close film editor">Close</button></div>
      <p class="film-intro">Watch this drawing unfold, then save a film. Nothing is uploaded.</p>
      <canvas id="film-canvas" width="1080" height="1080" aria-label="Short film preview"></canvas>
      <div class="film-playback"><button type="button" id="film-play" data-film-control>Play from start</button><label class="film-range">Film position<input id="film-scrub" data-film-control type="range" min="0" max="359" value="359"></label><output id="film-time">12.0 / 12 s</output></div>
      <div class="film-settings"><label for="film-duration">Length<select id="film-duration" data-film-control><option value="10">10 seconds</option><option value="12" selected>12 seconds</option><option value="15">15 seconds</option></select></label><label for="film-aspect">Shape<select id="film-aspect" data-film-control><option value="square">Square</option><option value="landscape">Landscape</option><option value="portrait">Portrait</option></select></label><label for="film-size">Size<select id="film-size" data-film-control><option value="720">720p</option><option value="1080" selected>1080p</option></select></label><label for="film-format">File<select id="film-format" data-film-control><option value="mp4">MP4</option><option value="webm">WebM</option></select></label></div>
      <div class="film-save"><button type="button" id="film-export" class="film-primary" data-film-control>Save film</button><button type="button" id="film-recipe" data-film-control>Save film recipe</button><button type="button" id="film-cancel" hidden>Cancel export</button><progress id="film-progress" max="1" value="0" hidden aria-label="Film export progress"></progress></div>
      <p id="film-status" role="status"></p><p class="film-note">The same paths and frame timing drive preview and export. Video encoding varies by browser. The recipe preserves the exact visible drawing, including hand edits, for local MP4 rendering.</p>`;
    document.body.appendChild(dialog);
    byId('film-close').addEventListener('click', close);
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    // Keep studio shortcuts from regrowing or recolouring behind this modal.
    dialog.addEventListener('keydown', event => event.stopPropagation());
    byId('film-cancel').addEventListener('click', () => abort?.abort());
    for (const id of ['film-duration', 'film-size', 'film-aspect']) byId(id).addEventListener('change', configure);
    byId('film-scrub').addEventListener('input', () => { stop(); paint(Number(byId('film-scrub').value)); });
    byId('film-play').addEventListener('click', () => {
      stop(); const start = performance.now();
      const tick = now => {
        const frame = Math.min(opts.frames - 1, Math.floor((now - start) * opts.fps / 1000));
        paint(frame);
        if (frame < opts.frames - 1 && dialog.open) animation = requestAnimationFrame(tick);
      };
      animation = requestAnimationFrame(tick);
    });
    byId('film-recipe').addEventListener('click', () => save('tendril-' + scene.seed + '.film.json', new Blob([JSON.stringify({ scene, options: opts })], { type: 'application/json' })));
    byId('film-export').addEventListener('click', async () => {
      if (exporting || !prepared) return;
      stop(); exporting = true; abort = new AbortController(); controls(true);
      const progress = byId('film-progress'); progress.hidden = false; progress.value = 0;
      status('Rendering your film on this device…');
      const format = byId('film-format').value;
      try {
        if (!window.TendrilFilmExport) throw new Error('The video exporter did not load. Reload the studio or save a recipe for local rendering.');
        const blob = await TendrilFilmExport.exportVideo(scene, opts, { format, signal: abort.signal, onProgress: value => { progress.value = value; } });
        if (!abort.signal.aborted && dialog.open) {
          save('tendril-' + scene.seed + '-' + opts.duration + 's.' + format, blob);
          status('Film ready. Your browser will save the ' + format.toUpperCase() + ' file.');
        }
      } catch (error) { if (dialog.open) status(error.name === 'AbortError' ? 'Export cancelled. Your drawing is unchanged.' : error.message); }
      finally { exporting = false; abort = null; progress.hidden = true; controls(false); paint(opts.frames - 1); }
    });
  }
  window.TendrilFilmUI = { open() {
    if (!dialog) create();
    if (dialog.open || exporting) return;
    scene = null; prepared = null; controls(true); dialog.showModal();
    status('Preparing your drawing…'); capture();
  } };
})();
