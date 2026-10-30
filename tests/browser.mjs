// Real Chrome + CDP using only Node's standard library. Node >=22 and Chrome required.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, extname } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const buildDir = resolve(process.argv[2] ?? 'dist');
const chromePath = process.env.CHROME_BIN ?? '/usr/bin/google-chrome';
const profile = await mkdtemp(join(tmpdir(), 'defchrtool-chrome-'));
let chrome;
let socket;
let embedded = false;
const exceptions = [];

const fixture = `<!doctype html><meta charset="utf-8"><script>
window.requests = [];
window.hostMode = 'success';
window.host = { async exportPCG(request) {
  const record = { ...request, blob: undefined,
    crossRealm: !(request.blob instanceof Blob),
    bytes: [...new Uint8Array(await request.blob.arrayBuffer())],
    text: await request.blob.text() };
  window.requests.push(record);
  if (window.hostMode === 'throw') throw Error('host exception');
  if (window.hostMode === 'invalid') return { ok: true, insertedInto: 'wrong' };
  if (window.hostMode === 'pending') await new Promise(resolve => { window.releaseHost = resolve; });
  if (window.hostMode === 'conflict') return { ok: false, code: 'conflict', message: '<b>既存行と衝突しました</b>' };
  return { ok: true, insertedInto: request.target === 'fuzzybasic' ? 'asm' : request.target,
    message: 'ホストに反映しました' };
} };
</script><iframe id="tool" src="/defchrtool/index.html?host" style="width:640px;height:700px"></iframe>`;

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/fixture') return res.end(fixture);
    if (url.pathname === '/test-host.js') {
      res.setHeader('Content-Type', 'application/javascript');
      return res.end('window.X1Host = parent.host;');
    }
    const relative = url.pathname.replace(/^\/defchrtool\//, '');
    const file = resolve(buildDir, relative);
    if (!file.startsWith(buildDir + '/')) { res.writeHead(404); return res.end(); }
    let content = await readFile(file);
    const type = { '.html': 'text/html', '.js': 'application/javascript', '.png': 'image/png', '.css': 'text/css' }[extname(file)];
    res.setHeader('Content-Type', type ?? 'application/octet-stream');
    if (extname(file) === '.html' && url.searchParams.has('host')) {
      content = content.toString().replace('<script type="module"', '<script src="/test-host.js"></script><script type="module"');
    }
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end();
  }
});

async function until(action, label) {
  const deadline = Date.now() + 10000;
  let lastError;
  while (Date.now() < deadline) {
    try { if (await action()) return; } catch (error) { lastError = error; }
    await delay(40);
  }
  throw Error(`Timed out: ${label}`, { cause: lastError });
}

let nextId = 1;
const pending = new Map();
async function cdp(method, params = {}) {
  const id = nextId++;
  const response = new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  socket.send(JSON.stringify({ id, method, params }));
  return response;
}
async function evaluate(fn, ...args) {
  const win = embedded ? 'document.querySelector("#tool").contentWindow' : 'window';
  const expression = `(${fn.toString()})(${win}, ...${JSON.stringify(args)})`;
  const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
const key = (code, key = code) => evaluate((w, code, key) => {
  w.dispatchEvent(new w.KeyboardEvent('keydown', { code, key, bubbles: true }));
  w.dispatchEvent(new w.KeyboardEvent('keyup', { code, key, bubbles: true }));
}, code, key);
const select = (id, value) => evaluate((w, id, value) => {
  const control = w.document.getElementById(id);
  control.value = value;
  control.dispatchEvent(new w.Event('change', { bubbles: true }));
}, id, value);
const click = id => evaluate((w, id) => w.document.getElementById(id).click(), id);
const field = (id, value) => evaluate((w, id, value) => { w.document.getElementById(id).value = value; }, id, value);
const radio = (name, value) => evaluate((w, name, value) => {
  w.document.querySelector(`input[name="${name}"][value="${value}"]`).click();
}, name, value);
const panelVisible = () => evaluate(w => w.document.getElementById('programming-area').classList.contains('visible'));
const requestCount = () => evaluate(w => w.parent.requests.length);
async function openPanel() {
  await key('KeyP', 'p');
  await until(panelVisible, 'PROGRAMMING opens');
}
async function navigate(path, isEmbedded) {
  embedded = isEmbedded;
  await cdp('Page.navigate', { url: `${origin}${path}` });
  await until(() => evaluate(w => w.__ready), 'app initialized and font loaded');
}
let origin;

try {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  origin = `http://127.0.0.1:${server.address().port}`;
  chrome = spawn(chromePath, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  let chromeError = '';
  chrome.stderr.on('data', data => { chromeError += data; });
  await until(async () => {
    try { return (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).length > 0; } catch { return false; }
  }, 'Chrome starts').catch(error => { throw Error(chromeError, { cause: error }); });
  const [port] = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails);
    const waiter = pending.get(message.id);
    if (waiter) {
      pending.delete(message.id);
      if (message.error) waiter.reject(Error(JSON.stringify(message.error)));
      else waiter.resolve(message.result);
    }
  });
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve); socket.addEventListener('error', reject); });
  await cdp('Page.enable');
  await cdp('Runtime.enable');
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `
    const log = console.log;
    console.log = (...args) => { if (args[0] === '[DEFCHRApp] Initialized successfully') window.__ready = true; log(...args); };
    window.downloads = [];
    const blobs = new Map();
    URL.createObjectURL = blob => { const id = 'blob:test-' + blobs.size; blobs.set(id, blob); return id; };
    URL.revokeObjectURL = () => {};
    const anchorClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function() {
      if (this.download) window.downloads.push({ name: this.download, blob: blobs.get(this.href) });
      else anchorClick.call(this);
    };
    if (!localStorage.getItem('defchr-pcgdata')) {
      const data = new Uint8Array(6144);
      const planes = [0,1,2,3,4,5,6,7,16,17,18,19,20,21,22,23,32,33,34,35,36,37,38,39];
      data.set(planes, 65 * 24); data.set(planes.map(n => n+1), 66 * 24);
      localStorage.setItem('defchr-pcgdata', btoa(String.fromCharCode(...data)));
      localStorage.setItem('defchr-editbuffer', btoa(String.fromCharCode(...data)));
      localStorage.setItem('defchr-state', '{}');
    }
  ` });

  await navigate('/defchrtool/index.html', false);
  await openPanel();
  assert.equal(await evaluate(w => {
    const row = w.document.getElementById('host-delivery-row');
    return row ? w.getComputedStyle(row).display : 'none';
  }), 'none');
  const snapshots = {};
  for (const [format, basFormat] of [['image'], ['bin'], ['bin3'], ['bas', 'asc'], ['bas', 'bin'], ['asm'], ['asm3']]) {
    if (!(await panelVisible())) await openPanel();
    await radio('prog-format', format);
    if (basFormat) await radio('bas-save-format', basFormat);
    await field('prog-start', '41'); await field('prog-end', '42');
    await click('prog-exec-btn');
    await until(() => evaluate(w => w.downloads.length > 0), `${format} download`);
    const saved = await evaluate(async w => {
      const { blob, name } = w.downloads.shift();
      return { name, bytes: [...new Uint8Array(await blob.arrayBuffer())] };
    });
    snapshots[format + (basFormat ?? '')] = saved;
    assert.ok(saved.bytes.length > 0);
    if (format === 'bas' && basFormat === 'asc') assert.match(String.fromCharCode(...saved.bytes), /^60960DEFCHR\$/);
  }
  console.log('PASS standalone: hidden host UI; all seven original save variants');
  if (process.env.DEFCHR_SNAPSHOTS_PATH) {
    await writeFile(process.env.DEFCHR_SNAPSHOTS_PATH, JSON.stringify(snapshots));
  }

  if (process.env.DEFCHR_STANDALONE_ONLY !== '1') {
  await navigate('/fixture', true);
  await openPanel();
  assert.equal(await evaluate(w => w.document.getElementById('prog-exec-btn').disabled), true);
  assert.equal(await evaluate(w => w.document.getElementById('host-target').value), '');
  for (const [target, format] of [['fuzzybasic', 'asm3'], ['asm', 'asm3'], ['slang', 'bin3'], ['hubasic', 'bas']]) {
    if (!(await panelVisible())) await openPanel();
    await select('host-target', target);
    assert.equal(await evaluate(w => w.document.querySelector('input[name="prog-format"]:checked').value), format);
    assert.equal(await evaluate(w => !w.document.getElementById('host-lines-row').hidden), target === 'hubasic');
    await field('prog-start', '41'); await field('prog-end', '42');
    if (target === 'hubasic') { await field('host-line-start', '100'); await field('host-line-step', '5'); }
    const before = await requestCount();
    await click('prog-exec-btn');
    await until(async () => await requestCount() === before + 1 && !(await panelVisible()), `${target} inserts`);
    const request = await evaluate(w => w.parent.requests.at(-1));
    assert.equal(request.target, target);
    assert.equal(request.format, format);
    assert.equal(request.crossRealm, true);
    assert.equal(request.start, 65); assert.equal(request.end, 66);
    if (target === 'hubasic') {
      assert.match(request.text, /^100DEFCHR\$\(65\)/);
      assert.match(request.text, /\r105DEFCHR\$\(66\)/);
      assert.doesNotMatch(request.text, /RETURN/);
    } else assert.deepEqual(request.bytes, snapshots[format].bytes);
  }
  console.log('PASS iframe: four recommendations, cross-realm Blob, custom HuBASIC lines');

  await openPanel();
  assert.equal(await evaluate(w => w.document.getElementById('host-line-start').value), '100');
  for (const invalid of ['', '0', '-1', '10x', '1.5', '65529']) {
    await field('host-line-start', invalid);
    const before = await requestCount();
    await click('prog-exec-btn');
    assert.equal(await requestCount(), before);
    assert.equal(await panelVisible(), true);
  }
  await field('host-line-start', '100');
  await field('prog-start', 'GG');
  await click('prog-exec-btn');
  assert.match(await evaluate(w => w.document.getElementById('host-output-note').textContent), /範囲/);
  await field('prog-start', '41'); await field('prog-end', '42');
  await evaluate(w => { w.parent.hostMode = 'conflict'; });
  await click('prog-exec-btn');
  await until(() => evaluate(w => w.document.getElementById('host-output-note').textContent.includes('衝突')), 'conflict shown');
  assert.equal(await evaluate(w => w.document.querySelector('#host-output-note b') === null), true);
  assert.equal(await panelVisible(), true);
  assert.equal(await evaluate(w => w.downloads.length), 0);
  for (const mode of ['throw', 'invalid']) {
    await evaluate((w, mode) => { w.parent.hostMode = mode; }, mode);
    await click('prog-exec-btn');
    await until(() => evaluate(w => w.document.getElementById('host-output-note').textContent.includes('反映状況')), mode);
    assert.equal(await evaluate(w => w.downloads.length), 0);
  }
  console.log('PASS errors: invalid numbers, conflict as literal text, exception/invalid reply, no fallback');

  await select('host-target', 'slang');
  await radio('prog-format', 'bin');
  await radio('prog-mode', 'load');
  assert.equal(await evaluate(w => w.document.getElementById('host-delivery-row').hidden), true);
  await radio('prog-mode', 'save');
  assert.equal(await evaluate(w => w.document.querySelector('input[name="prog-format"]:checked').value), 'bin');
  await key('Escape'); await openPanel();
  assert.equal(await evaluate(w => w.document.querySelector('input[name="prog-format"]:checked').value), 'bin');
  assert.equal(await evaluate(w => w.document.getElementById('prog-start').value), '00');
  await radio('prog-format', 'image');
  assert.equal(await evaluate(w => w.document.getElementById('prog-exec-btn').disabled), true);
  await select('host-delivery', 'file');
  await click('prog-exec-btn');
  await until(() => evaluate(w => w.downloads.length === 1), 'file route still supports PNG');
  await openPanel(); await select('host-delivery', 'host'); await select('host-target', 'fuzzybasic');
  await field('prog-start', '41'); await field('prog-end', '42');
  await evaluate(w => { w.parent.hostMode = 'pending'; });
  const beforePending = await requestCount();
  await click('prog-exec-btn');
  await until(async () => await requestCount() === beforePending + 1, 'pending host received once');
  await click('prog-exec-btn'); await click('prog-cancel-btn'); await key('Escape'); await key('KeyP', 'p');
  assert.equal(await panelVisible(), true);
  assert.equal(await requestCount(), beforePending + 1);
  await evaluate(w => {
    w.parent.document.querySelector('#tool').hidden = true;
    w.parent.document.querySelector('#tool').hidden = false;
    w.parent.releaseHost();
  });
  await until(async () => !(await panelVisible()), 'pending result completes');
  assert.equal(await requestCount(), beforePending + 1);
  console.log('PASS UI: manual formats persist; unsupported formats can save locally; pending send cannot duplicate');

  const storedBefore = await evaluate(w => w.localStorage.getItem('defchr-pcgdata'));
  await openPanel();
  await evaluate(w => { delete w.X1Host; });
  await click('prog-exec-btn');
  await until(() => evaluate(w => w.document.getElementById('host-output-note').textContent.includes('接続')), 'host removed');
  assert.equal(await requestCount(), beforePending + 1);
  await key('Escape');
  // Exercise normal keyboard drawing and the existing autosave/restore path.
  const editBefore = await evaluate(w => w.localStorage.getItem('defchr-editbuffer'));
  await key('Digit7', '7');
  await delay(650);
  const editSaved = await evaluate(w => w.localStorage.getItem('defchr-editbuffer'));
  assert.notEqual(editSaved, editBefore);
  await evaluate(w => { w.location.reload(); });
  await until(() => evaluate(w => w.__ready), 'iframe reload');
  assert.equal(await evaluate(w => w.localStorage.getItem('defchr-pcgdata')), storedBefore);
  assert.equal(await evaluate(w => w.localStorage.getItem('defchr-editbuffer')), editSaved);
  await openPanel();
  assert.equal(await evaluate(w => w.document.getElementById('host-target').value), '');
  assert.equal(await evaluate(w => w.document.getElementById('host-line-start').value), '60960');
  assert.equal(await evaluate(w => w.document.getElementById('host-delivery').value), 'host');
  await key('Escape');
  await key('KeyS', 's');
  await evaluate(w => {
    const input = w.document.getElementById('input-field');
    input.value = '43';
    input.dispatchEvent(new w.KeyboardEvent('keydown', { code: 'Enter', key: 'Enter', bubbles: true }));
  });
  // Let Chrome update focus after the existing SET CHR dialog becomes hidden.
  await delay(100);
  await openPanel(); await select('host-target', 'slang'); await radio('prog-format', 'bin');
  await field('prog-start', '43'); await field('prog-end', '43');
  await evaluate(w => { w.parent.hostMode = 'success'; });
  const beforeRestored = await requestCount();
  await click('prog-exec-btn');
  await until(async () => await requestCount() === beforeRestored + 1, 'restored edit buffer exports after SET CHR');
  const restored = await evaluate(w => w.parent.requests.at(-1).bytes);
  assert.equal(restored[0], 128); assert.equal(restored[8], 128); assert.equal(restored[16], 128);
  assert.deepEqual(exceptions, []);
  console.log('PASS state: lost host does not download; keyboard/autosave/reload; export preferences reset on reload');
  }
  console.log(`Browser checks passed (${buildDir}).`);
} finally {
  socket?.close();
  if (chrome?.pid && chrome.exitCode === null && chrome.signalCode === null) {
    const exited = new Promise(resolve => chrome.once('exit', resolve));
    chrome.kill();
    await exited;
  }
  await new Promise(resolve => server.close(resolve));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
