const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const files = new Set(['index.html', 'wallpaper.html', 'film.js', 'film-ui.js', 'film.css', 'assets/film-encoder.js']);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const port = Number(process.env.PORT || 4187);
http.createServer((req, res) => {
  const file = new URL(req.url, 'http://localhost').pathname.slice(1) || 'index.html';
  if (!files.has(file) || !['GET', 'HEAD'].includes(req.method)) { res.writeHead(404); return res.end('Not found'); }
  const stream = fs.createReadStream(path.join(__dirname, '..', file));
  stream.once('error', () => { res.writeHead(404); res.end('Not found'); });
  stream.once('open', () => {
    res.writeHead(200, { 'Content-Type': types[path.extname(file)], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    if (req.method === 'HEAD') { stream.destroy(); res.end(); } else stream.pipe(res);
  });
}).listen(port, '127.0.0.1', () => console.log('Tendril Garden: http://127.0.0.1:' + port));
