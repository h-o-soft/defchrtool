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

export type PCGExportResult =
  | { ok: true; insertedInto: 'asm' | 'slang' | 'hubasic'; message?: string }
  | { ok: false; code: 'unsupported' | 'invalid' | 'conflict' | 'unavailable'; message: string };

export interface X1Host {
  exportPCG(request: PCGExportRequest): Promise<PCGExportResult>;
}

declare global {
  interface Window {
    X1Host?: Partial<X1Host>;
  }
}

export const HUBASIC_MAX_LINE = 65529;
export const DEFAULT_HUBASIC_LINES: HuBasicLines = { lineStart: 60960, lineStep: 10 };

/** The host is injected into this iframe; never search its parent. */
export function getX1Host(): X1Host | null {
  try {
    const host = window.X1Host;
    return host && typeof host.exportPCG === 'function' ? host as X1Host : null;
  } catch {
    return null;
  }
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
    return 'この形式は挿入できません。ファイル保存を選ぶか、出力先を選び直して推奨形式に変更してください。';
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

/** Validate across window realms by shape, not instanceof. Never retry here. */
export async function sendPCGToHost(request: PCGExportRequest): Promise<PCGExportResult> {
  const host = getX1Host();
  if (!host) return { ok: false, code: 'unavailable', message: 'X1Pen との接続がありません。設定を確認してください。' };

  let result: unknown;
  try {
    result = await host.exportPCG(request);
  } catch {
    throw new Error(UNCERTAIN_RESULT);
  }
  if (typeof result !== 'object' || result === null) throw new Error(UNCERTAIN_RESULT);
  const value = result as Record<string, unknown>;
  const expected = request.target === 'fuzzybasic' ? 'asm' : request.target;
  if (value.ok === true && value.insertedInto === expected &&
      (value.message === undefined || typeof value.message === 'string')) {
    return { ok: true, insertedInto: expected, message: value.message as string | undefined };
  }
  if (value.ok === false && typeof value.code === 'string' &&
      ['unsupported', 'invalid', 'conflict', 'unavailable'].includes(value.code) && typeof value.message === 'string') {
    return { ok: false, code: value.code as 'unsupported' | 'invalid' | 'conflict' | 'unavailable', message: value.message };
  }
  throw new Error(UNCERTAIN_RESULT);
}
