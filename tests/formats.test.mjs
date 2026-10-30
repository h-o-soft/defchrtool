import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { after, test } from 'node:test';

// Compile with the project's existing TypeScript, with no additional test dependency.
const output = mkdtempSync(join(tmpdir(), 'defchrtool-tests-'));
const compilerEnv = { ...process.env };
delete compilerEnv.NODE_TEST_CONTEXT;
execFileSync(process.execPath, [resolve('node_modules/typescript/bin/tsc'),
  '--target', 'ES2020', '--module', 'commonjs', '--moduleResolution', 'node',
  '--strict', '--skipLibCheck', '--outDir', output,
  'src/io/AsmFormat.ts', 'src/io/BinFormat.ts', 'src/io/BasFormat.ts', 'src/host/X1Host.ts'
], { stdio: 'inherit', env: compilerEnv });
after(() => rmSync(output, { recursive: true, force: true }));
const require = createRequire(import.meta.url);
const { PCGData } = require(join(output, 'core/PCGData.js'));
const { BinFormat } = require(join(output, 'io/BinFormat.js'));
const { AsmFormat } = require(join(output, 'io/AsmFormat.js'));
const { BasFormat } = require(join(output, 'io/BasFormat.js'));
const host = require(join(output, 'host/X1Host.js'));

const planes = [0, 1, 2, 3, 4, 5, 6, 7, 16, 17, 18, 19, 20, 21, 22, 23, 32, 33, 34, 35, 36, 37, 38, 39];
const rows = [0, 16, 32, 1, 17, 33, 2, 18, 34, 3, 19, 35, 4, 20, 36, 5, 21, 37, 6, 22, 38, 7, 23, 39];
const hex = '000102030405060710111213141516172021222324252627';
function sample() {
  const pcg = new PCGData();
  pcg.setCharacter(0x41, Uint8Array.from(planes));
  pcg.setCharacter(0x42, Uint8Array.from(planes.map(n => n + 1)));
  return pcg;
}

test('BIN and DB preserve plane order or interleave BRG rows for two characters', async () => {
  for (const x3 of [false, true]) {
    const expected = x3 ? rows : planes;
    const pcg = sample();
    const bytes = new Uint8Array(await BinFormat.save(pcg, 0x41, 0x42, x3).arrayBuffer());
    assert.deepEqual([...bytes], [...expected, ...expected.map(n => n + 1)]);
    const asm = await AsmFormat.save(pcg, 0x41, 0x42, x3).text();
    assert.match(asm, /^; CHR \$41\n/);
    assert.match(asm, /; CHR \$42\n/);
    assert.deepEqual([...asm.matchAll(/\$([0-9A-F]{2})/g)]
      .filter(match => !asm.slice(0, match.index).endsWith('CHR '))
      .map(match => parseInt(match[1], 16)), [...bytes]);
  }
});

test('default BAS ASCII is unchanged; custom lines affect only explicit ASCII export', async () => {
  const pcg = sample();
  assert.equal(await BasFormat.saveAscii(pcg, 0x41, 0x41).text(),
    `60960DEFCHR$(65)=HEXCHR$("${hex}")\r`);
  assert.equal(await BasFormat.saveAscii(pcg, 0x41, 0x42, { lineStart: 100, lineStep: 5 }).text(),
    `100DEFCHR$(65)=HEXCHR$("${hex}")\r105DEFCHR$(66)=HEXCHR$("010203040506070811121314151617182122232425262728")\r`);
  assert.doesNotMatch(await BasFormat.saveAscii(pcg, 0, 255).text(), /RETURN/);
  const binary = new Uint8Array(await BasFormat.saveBinary(pcg, 0x41, 0x41).arrayBuffer());
  assert.deepEqual([...binary.slice(2, 4)], [0x20, 0xee]); // 60960, little endian
  assert.deepEqual([...binary.slice(-2)], [0, 0]);
  assert.equal(BasFormat.getDefaultFileName(false), 'pcg.asc');
  assert.equal(BasFormat.getDefaultFileName(true), 'pcg.bas');
});

test('range and line-number boundaries reject overflow, invalid integers and wrapping', () => {
  for (const range of [[0, 0], [255, 255], [0, 255]]) assert.equal(host.isValidRange(...range), true);
  for (const range of [[-1, 1], [1, 256], [3, 2], [0.5, 1], [NaN, 1], [0, Infinity]]) {
    assert.equal(host.isValidRange(...range), false);
  }
  assert.equal(host.validateHuBasicLines({ lineStart: 60960, lineStep: 10 }, 256), null);
  assert.equal(host.validateHuBasicLines({ lineStart: 65529, lineStep: 1 }, 1), null);
  for (const lines of [undefined, { lineStart: 65529, lineStep: 1 },
    { lineStart: 1, lineStep: 0 }, { lineStart: 0, lineStep: 1 },
    { lineStart: 1.5, lineStep: 1 }, { lineStart: 1, lineStep: Infinity }]) {
    assert.notEqual(host.validateHuBasicLines(lines, 2), null);
  }
  assert.throws(() => BasFormat.saveAscii(sample(), 0, 255, { lineStart: 65500, lineStep: 10 }));
});

test('all recommended routes and manual supported/unsupported combinations are explicit', () => {
  for (const [target, format] of [['fuzzybasic', 'asm3'], ['asm', 'asm3'], ['slang', 'bin3'], ['hubasic', 'bas']]) {
    assert.equal(host.getRecommendedFormat(target).format, format);
    for (const candidate of ['image', 'bin', 'bin3', 'bas', 'asm', 'asm3']) {
      for (const basFormat of ['asc', 'bin']) {
        const supported = candidate !== 'image' && !(candidate === 'bas' && basFormat === 'bin') &&
          (target !== 'hubasic' || candidate === 'bas');
        assert.equal(host.getHostFormatError(target, candidate, basFormat) === null, supported);
      }
    }
  }
  assert.notEqual(host.getHostFormatError('', 'asm3'), null);
  assert.notEqual(host.validateHostExport({ target: 'hubasic', format: 'bas', basFormat: 'asc', start: 0, end: 255 }), null);
});

test('host detection is optional, handles throwing properties, and preserves method this', async () => {
  globalThis.window = {};
  assert.equal(host.getX1Host(), null);
  window.X1Host = { exportPCG: true };
  assert.equal(host.getX1Host(), null);
  Object.defineProperty(window, 'X1Host', { configurable: true, get() { throw Error('not available'); } });
  assert.equal(host.getX1Host(), null);
  globalThis.window = {};
  const request = { version: 1, target: 'fuzzybasic', format: 'asm3', start: 65, end: 65,
    fileName: 'pcg_x3.asm', blob: AsmFormat.save(sample(), 65, 65, true) };
  assert.equal((await host.sendPCGToHost(request)).code, 'unavailable');
  let calls = 0;
  window.X1Host = {
    async exportPCG(value) {
      assert.equal(this, window.X1Host);
      assert.equal(value, request);
      calls++;
      return { ok: true, insertedInto: 'asm', message: '挿入しました' };
    }
  };
  assert.equal((await host.sendPCGToHost(request)).message, '挿入しました');
  assert.equal(calls, 1);
  for (const result of [undefined, null, {}, { ok: true, insertedInto: 'slang' },
    { ok: true, insertedInto: 'asm', message: 123 }, { ok: false, code: 'other', message: 'bad' }]) {
    window.X1Host.exportPCG = async () => result;
    await assert.rejects(host.sendPCGToHost(request), /反映状況/);
  }
  window.X1Host.exportPCG = async () => { throw Error('unknown application state'); };
  await assert.rejects(host.sendPCGToHost(request), /反映状況/);
  for (const code of ['unsupported', 'invalid', 'conflict', 'unavailable']) {
    window.X1Host.exportPCG = async () => ({ ok: false, code, message: '<b>ホストの説明</b>' });
    assert.deepEqual(await host.sendPCGToHost(request), { ok: false, code, message: '<b>ホストの説明</b>' });
  }
});

test('full range and FF character boundaries have the exact byte count', async () => {
  for (const [start, end] of [[0, 0], [255, 255], [0, 255]]) {
    for (const x3 of [false, true]) {
      assert.equal((await BinFormat.save(sample(), start, end, x3).arrayBuffer()).byteLength, 24 * (end - start + 1));
    }
  }
  assert.match(await BasFormat.saveAscii(sample(), 0, 255).text(), /63510DEFCHR\$\(255\)/);
});
