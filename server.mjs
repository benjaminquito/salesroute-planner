import http from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { emptyWorkspace, validateWorkspace, createPlan } from './src/application.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(process.env.SALESROUTE_DATA_DIR || join(root, 'data'));
mkdirSync(dataDir, { recursive: true, mode: 0o700 });
const filename = join(dataDir, 'workspace.json');
let state = existsSync(filename) ? JSON.parse(readFileSync(filename, 'utf8')) : { revision: 0, workspace: emptyWorkspace(), plan: null };
validateWorkspace(state.workspace);
function persist(next) {
  const temp = filename + '.tmp';
  writeFileSync(temp, JSON.stringify(next, null, 2), { mode: 0o600 });
  if (existsSync(filename)) copyFileSync(filename, filename + '.previous');
  renameSync(temp, filename); state = next;
}
const port = Number(process.env.PORT || 47840);
const server = http.createServer(async (req, res) => {
  const host = `127.0.0.1:${server.address().port}`;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  const send = (status, value) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
  if (req.headers.host !== host || (req.headers.origin && req.headers.origin !== `http://${host}`)) return send(403, { error: 'Only the local application may access this server.' });
  try {
    if (req.method === 'GET' && req.url === '/api/workspace') return send(200, state);
    if (req.method === 'POST' && ['/api/workspace', '/api/plan'].includes(req.url)) {
      if (req.headers['content-type'] !== 'application/json') return send(415, { error: 'JSON is required.' });
      let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 2_000_000) return send(413, { error: 'File is too large.' }); }
      const body = JSON.parse(raw);
      if (body.revision !== state.revision) return send(409, { error: 'This workspace changed in another window. Reload before saving.' });
      const workspace = req.url === '/api/workspace' ? validateWorkspace(body.workspace) : state.workspace;
      const plan = req.url === '/api/plan' ? createPlan(workspace) : null;
      persist({ revision: state.revision + 1, workspace, plan });
      return send(200, state);
    }
    const files = { '/': ['public/index.html','text/html'], '/app.js': ['public/app.js','text/javascript'], '/style.css': ['public/style.css','text/css'] };
    if (req.method === 'GET' && files[req.url]) {
      const [path, type] = files[req.url]; res.writeHead(200, { 'Content-Type': type }); return res.end(readFileSync(join(root,path)));
    }
    send(404, { error: 'Not found.' });
  } catch (error) { send(400, { error: error.message }); }
});
server.listen(port, '127.0.0.1', () => console.log(`SalesRoute Planner: http://127.0.0.1:${server.address().port}`));
