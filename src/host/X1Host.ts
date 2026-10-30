import type { BasSaveFormat, FileFormat, FileParams } from '../input/InputEventTypes';

export type PCGTarget = 'fuzzybasic' | 'asm' | 'slang' | 'hubasic';
export interface HuBasicLines {
  lineStart: number;
  lineStep: number;
}

export interface PCGExportRequest {
  version: 1;
  target: PCGTarget;
  format: FileFormat;
  basFormat?: BasSaveFormat;
  start: number;
  end: number;
  fileName: string;
  blob: Blob;
  hubasic?: HuBasicLines;
}

export type PCGFailure = { ok: false; code: 'unsupported' | 'invalid' | 'conflict' | 'unavailable'; message: string };
export type PCGExportResult = { ok: true; insertedInto: 'asm' | 'slang' | 'hubasic'; message?: string } | PCGFailure;
export type PCGCopyResult = { ok: true; message?: string } | PCGFailure;

export interface X1Host {
  exportPCG(request: PCGExportRequest): Promise<PCGExportResult>;
  copyPCG?(request: PCGExportRequest): Promise<PCGCopyResult>;
  saveFile?(blob: Blob, fileName: string): void | Promise<void>;
}

declare global {
  interface Window {
    X1Host?: Partial<X1Host>;
  }
}

export const HUBASIC_MAX_LINE = 65529;
export const DEFAULT_HUBASIC_LINES: HuBasicLines = { lineStart: 60960, lineStep: 10 };

/** Discover each capability independently, in this iframe only. Capture method and this together. */
function getHostMethod<K extends keyof X1Host>(name: K): { host: Partial<X1Host>; method: NonNullable<X1Host[K]> } | null {
  try {
    const host = window.X1Host;
    const method = host?.[name];
    return host && typeof method === 'function' ? { host, method: method as NonNullable<X1Host[K]> } : null;
  } catch {
    return null;
  }
}

export function getX1Host(): X1Host | null {
  const bridge = getHostMethod('exportPCG');
  return bridge ? bridge.host as X1Host : null;
}

export function hasCopyPCG(): boolean {
  return getHostMethod('copyPCG') !== null;
}

export function isPCGTarget(value: unknown): value is PCGTarget {
  return value === 'fuzzybasic' || value === 'asm' || value === 'slang' || value === 'hubasic';
}

export function getRecommendedFormat(target: PCGTarget): { format: FileFormat; basFormat?: BasSaveFormat } {
  if (target === 'hubasic') return { format: 'bas', basFormat: 'asc' };
  return { format: target === 'slang' ? 'bin3' : 'asm3' };
}

export function isValidRange(start: number, end: number): boolean {
  return Number.isInteger(start) && Number.isInteger(end) && start >= 0 && start <= end && end <= 255;
}

export function validateHuBasicLines(lines: HuBasicLines | undefined, count: number): string | null {
  if (!Number.isInteger(count) || count < 1 || count > 256 ||
      !lines || !Number.isInteger(lines.lineStart) || !Number.isInteger(lines.lineStep) ||
      lines.lineStart < 1 || lines.lineStep < 1 || lines.lineStep > HUBASIC_MAX_LINE ||
      lines.lineStart + (count - 1) * lines.lineStep > HUBASIC_MAX_LINE) {
    return '開始行とステップは正の整数で指定し、最後の行番号を65529以下にしてください。';
  }
  return null;
}

/** Unsupported formats remain selectable for the ordinary file-save route. */
export function getHostFormatError(target: unknown, format: FileFormat, basFormat?: BasSaveFormat): string | null {
  if (!isPCGTarget(target)) return '出力先を選んでください。';
  if (format === 'image' || (format === 'bas' && basFormat === 'bin') ||
      (target === 'hubasic' && format !== 'bas')) {
    return 'この形式はこの出力先に対応していません。ファイル保存を選ぶか、出力先を選び直して推奨形式に変更してください。';
  }
  if (!['bin', 'bin3', 'bas', 'asm', 'asm3'].includes(format) ||
      (format === 'bas' && basFormat !== 'asc')) {
    return '出力形式を確認してください。';
  }
  return null;
}

export function validateHostExport(params: FileParams): string | null {
  if (!isValidRange(params.start, params.end)) return '文字コードの範囲を00〜FFで正しく指定してください。';
  const formatError = getHostFormatError(params.target, params.format, params.basFormat);
  if (formatError) return formatError;
  return params.target === 'hubasic'
    ? validateHuBasicLines(params.hubasic, params.end - params.start + 1) : null;
}

const UNCERTAIN_RESULT = 'X1Pen の応答を確認できません。出力先の反映状況を確認してから再操作してください。';
const UNCERTAIN_COPY = 'X1Pen のコピー結果を確認できません。クリップボードの内容を確認してから再操作してください。';

/** Validate across realms by shape, with distinct success rules. Never retry or fall back. */
async function callPCGHost<T>(
  name: 'exportPCG' | 'copyPCG', request: PCGExportRequest,
  success: (value: Record<string, unknown>) => T | undefined, uncertain: string
): Promise<T | PCGFailure> {
  const bridge = getHostMethod(name);
  if (!bridge) return { ok: false, code: 'unavailable', message: name === 'copyPCG'
    ? 'X1Pen のコピー機能が利用できません。保存先を選び直してください。'
    : 'X1Pen との接続がありません。設定を確認してください。' };
  try {
    const result: unknown = await bridge.method.call(bridge.host, request);
    if (typeof result !== 'object' || result === null) throw new Error(uncertain);
    const value = result as Record<string, unknown>;
    const parsed = success(value);
    if (parsed) return parsed;
    if (value.ok === false && typeof value.code === 'string' &&
        ['unsupported', 'invalid', 'conflict', 'unavailable'].includes(value.code) && typeof value.message === 'string') {
      return { ok: false, code: value.code as PCGFailure['code'], message: value.message };
    }
    throw new Error(uncertain);
  } catch {
    throw new Error(uncertain);
  }
}

export function sendPCGToHost(request: PCGExportRequest): Promise<PCGExportResult> {
  return callPCGHost('exportPCG', request, value => {
    const expected = request.target === 'fuzzybasic' ? 'asm' : request.target;
    if (value.ok === true && value.insertedInto === expected &&
        (value.message === undefined || typeof value.message === 'string')) {
      return { ok: true as const, insertedInto: expected, message: value.message as string | undefined };
    }
  }, UNCERTAIN_RESULT);
}

export function copyPCGToHost(request: PCGExportRequest): Promise<PCGCopyResult> {
  return callPCGHost('copyPCG', request, value => {
    if (value.ok === true && value.insertedInto === undefined &&
        (value.message === undefined || typeof value.message === 'string')) {
      return { ok: true as const, message: value.message as string | undefined };
    }
  }, UNCERTAIN_COPY);
}

/** Only absence permits the existing child download. Once invoked, errors must propagate. */
export async function saveFileWithHost(blob: Blob, fileName: string): Promise<boolean> {
  const bridge = getHostMethod('saveFile');
  if (!bridge) return false;
  try {
    await bridge.method.call(bridge.host, blob, fileName);
    return true;
  } catch {
    throw new Error('X1Pen でのファイル保存を確認できません。保存状況を確認してから再操作してください。');
  }
}
