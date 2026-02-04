/**
 * BAS形式（X1 BASIC）の保存・読み込み
 * ASCII形式とバイナリ形式に対応
 */

import { PCGData } from '../core/PCGData';
import { BAS_LINE_START } from '../core/constants';

/** X1 BASICトークン定義 */
const TOKENS = {
  DEFCHR: 0xB2,
  DOLLAR: 0xFF,       // $ (文字列関数拡張プレフィックス)
  FUNC_CALL: 0xA0,    // 関数呼び出し (DEFCHR$の後)
  LPAREN: 0x28,       // (
  RPAREN: 0x29,       // )
  EQUAL: 0xF4,        // =
  HEXCHR: 0xBF,       // HEXCHR (0xFFの後)
  QUOTE: 0x22,        // "
  INT16: 0x12,        // 16ビット整数プレフィックス
  LINE_END: 0x00,     // 行終端
} as const;

/** プログラム終端 */
const PROGRAM_END = [0x00, 0x00];

/**
 * BAS形式の保存・読み込みユーティリティ
 */
export class BasFormat {
  /**
   * ASCII形式で保存
   * @param pcgData PCGデータ
   * @param start 開始文字コード
   * @param end 終了文字コード
   * @returns Blob
   */
  static saveAscii(pcgData: PCGData, start: number, end: number): Blob {
    const count = end - start + 1;
    if (count <= 0) {
      throw new Error('Invalid range');
    }

    const lines: string[] = [];

    for (let i = 0; i < count; i++) {
      const charCode = start + i;
      const charData = pcgData.getCharacter(charCode);

      // B[8], R[8], G[8] を16進文字列に変換
      let hexStr = '';
      for (let j = 0; j < 24; j++) {
        hexStr += charData[j].toString(16).toUpperCase().padStart(2, '0');
      }

      // DEFCHR$(code)=HEXCHR$("...")
      const lineNum = BAS_LINE_START + i * 10;
      lines.push(`${lineNum}DEFCHR$(${charCode})=HEXCHR$("${hexStr}")`);
    }

    // ASCファイル（X1 BASICはCRのみ）
    const content = lines.join('\r') + '\r';
    return new Blob([content], { type: 'text/plain' });
  }

  /**
   * バイナリ形式で保存
   * @param pcgData PCGデータ
   * @param start 開始文字コード
   * @param end 終了文字コード
   * @returns Blob
   */
  static saveBinary(pcgData: PCGData, start: number, end: number): Blob {
    const count = end - start + 1;
    if (count <= 0) {
      throw new Error('Invalid range');
    }

    // 1行のデータを生成する関数
    const generateLine = (lineNum: number, charCode: number, hexStr: string): number[] => {
      const lineData: number[] = [];

      // 行番号 (リトルエンディアン 2バイト)
      lineData.push(lineNum & 0xFF);
      lineData.push((lineNum >> 8) & 0xFF);

      // DEFCHR$ トークン: b2 ff a0
      lineData.push(TOKENS.DEFCHR);
      lineData.push(TOKENS.DOLLAR);
      lineData.push(TOKENS.FUNC_CALL);

      // (
      lineData.push(TOKENS.LPAREN);

      // 文字コード (16ビット整数): 12 xx xx
      lineData.push(TOKENS.INT16);
      lineData.push(charCode & 0xFF);
      lineData.push((charCode >> 8) & 0xFF);

      // )
      lineData.push(TOKENS.RPAREN);

      // =
      lineData.push(TOKENS.EQUAL);

      // HEXCHR$: ff bf
      lineData.push(TOKENS.DOLLAR);
      lineData.push(TOKENS.HEXCHR);

      // (
      lineData.push(TOKENS.LPAREN);

      // "文字列"
      lineData.push(TOKENS.QUOTE);
      for (let i = 0; i < hexStr.length; i++) {
        lineData.push(hexStr.charCodeAt(i));
      }
      lineData.push(TOKENS.QUOTE);

      // )
      lineData.push(TOKENS.RPAREN);

      // 行終端
      lineData.push(TOKENS.LINE_END);

      return lineData;
    };

    // 全行のデータを生成
    const allLines: number[][] = [];

    for (let i = 0; i < count; i++) {
      const charCode = start + i;
      const charData = pcgData.getCharacter(charCode);

      // B[8], R[8], G[8] を16進文字列に変換
      let hexStr = '';
      for (let j = 0; j < 24; j++) {
        hexStr += charData[j].toString(16).toUpperCase().padStart(2, '0');
      }

      const lineNum = BAS_LINE_START + i * 10;
      allLines.push(generateLine(lineNum, charCode, hexStr));
    }

    // リンクポインタを計算して最終データを生成
    const finalData: number[] = [];

    for (let i = 0; i < allLines.length; i++) {
      const lineData = allLines[i];
      const lineSize = 2 + lineData.length;

      // リンクポインタを追加（リトルエンディアン）
      finalData.push(lineSize & 0xFF);
      finalData.push((lineSize >> 8) & 0xFF);

      // 行データを追加
      finalData.push(...lineData);
    }

    // プログラム終端を追加
    finalData.push(...PROGRAM_END);

    const data = new Uint8Array(finalData);
    return new Blob([data.buffer as ArrayBuffer], { type: 'application/octet-stream' });
  }

  /**
   * BAS形式を読み込み（ASCII/バイナリ自動判定）
   * @param data バイナリデータ
   * @param pcgData 書き込み先のPCGData
   * @param start 開始文字コード（'start'モード時のみ使用）
   * @param mode 'start': STARTから連続読み込み, 'original': ファイル内のコードをそのまま使用
   * @returns 読み込んだ文字数
   */
  static load(data: Uint8Array, pcgData: PCGData, start: number, mode: 'start' | 'original'): number {
    // バイナリ形式かASCII形式かを判定（行終端に0x00を含むかどうか）
    const isBinary = data.includes(0x00);

    if (isBinary) {
      return BasFormat.loadBinary(data, pcgData, start, mode);
    } else {
      const text = new TextDecoder().decode(data);
      return BasFormat.loadAsciiText(text, pcgData, start, mode);
    }
  }

  /**
   * ASCII形式のテキストを読み込み
   */
  private static loadAsciiText(text: string, pcgData: PCGData, start: number, mode: 'start' | 'original'): number {
    // すべての改行コードに対応（CR, LF, CRLF）
    const lines = text.split(/\r\n|\r|\n/);

    // DEFCHR$パターン
    const defchrPattern = /DEFCHR\$\s*\(\s*(\d+)\s*\)\s*=\s*HEXCHR\$\s*\(\s*"([0-9A-Fa-f]+)"\s*\)/i;

    let loadCount = 0;
    let currentCode = start;

    for (const line of lines) {
      const match = line.match(defchrPattern);
      if (!match) continue;

      const originalCode = parseInt(match[1], 10);
      const hexStr = match[2];

      // 48文字（24バイト x 2）でない場合はスキップ
      if (hexStr.length !== 48) {
        console.warn(`Invalid hex length for code ${originalCode}: ${hexStr.length}`);
        continue;
      }

      // 16進文字列をバイト配列に変換
      const charData = new Uint8Array(24);
      for (let i = 0; i < 24; i++) {
        charData[i] = parseInt(hexStr.substr(i * 2, 2), 16);
      }

      // 書き込み先コードを決定
      const targetCode = mode === 'original' ? originalCode : currentCode;

      // 範囲チェック
      if (targetCode < 0 || targetCode > 255) {
        console.warn(`Code out of range: ${targetCode}`);
        if (mode === 'start') currentCode++;
        continue;
      }

      pcgData.setCharacter(targetCode, charData);
      loadCount++;

      if (mode === 'start') {
        currentCode++;
        if (currentCode > 255) break;
      }
    }

    return loadCount;
  }

  /**
   * バイナリ形式を読み込み
   */
  private static loadBinary(data: Uint8Array, pcgData: PCGData, start: number, mode: 'start' | 'original'): number {
    let loadCount = 0;
    let currentCode = start;
    let offset = 0;

    // プログラム終端（0x00 0x00）まで処理
    while (offset < data.length - 1) {
      const linkLow = data[offset];
      const linkHigh = data[offset + 1];
      const linkPointer = linkLow | (linkHigh << 8);

      // プログラム終端
      if (linkPointer === 0x0000) {
        break;
      }

      const lineStart = offset;
      offset += 4;  // リンクポインタ(2B) + 行番号(2B)

      const lineEnd = lineStart + linkPointer - 1;

      // DEFCHR$行かチェック（b2 ff a0 で始まる）
      if (offset + 3 <= lineEnd &&
          data[offset] === TOKENS.DEFCHR &&
          data[offset + 1] === TOKENS.DOLLAR &&
          data[offset + 2] === TOKENS.FUNC_CALL) {

        const result = BasFormat.parseDefchrBinaryLine(data, offset, lineEnd);

        if (result) {
          const { charCode: originalCode, hexStr } = result;
          const targetCode = mode === 'original' ? originalCode : currentCode;

          if (targetCode >= 0 && targetCode <= 255) {
            const charData = new Uint8Array(24);
            for (let i = 0; i < 24; i++) {
              charData[i] = parseInt(hexStr.substr(i * 2, 2), 16);
            }

            pcgData.setCharacter(targetCode, charData);
            loadCount++;

            if (mode === 'start') {
              currentCode++;
              if (currentCode > 255) break;
            }
          }
        }
      }

      offset = lineStart + linkPointer;
    }

    return loadCount;
  }

  /**
   * DEFCHR$バイナリ行をパース
   */
  private static parseDefchrBinaryLine(data: Uint8Array, offset: number, lineEnd: number): { charCode: number; hexStr: string } | null {
    // b2 ff a0 をスキップ（DEFCHR$）
    offset += 3;

    // ( (0x28) をスキップ
    if (offset >= lineEnd || data[offset] !== TOKENS.LPAREN) return null;
    offset++;

    // 文字コードを読む
    let charCode: number;
    if (data[offset] === TOKENS.INT16) {
      // 16ビット整数: 12 xx xx
      if (offset + 3 > lineEnd) return null;
      charCode = data[offset + 1] | (data[offset + 2] << 8);
      offset += 3;
    } else if (data[offset] >= 0x02 && data[offset] <= 0x0A) {
      // 小さい整数: 1-9 は値+1で格納
      charCode = data[offset] - 1;
      offset++;
    } else {
      return null;
    }

    // ) (0x29) をスキップ
    if (offset >= lineEnd || data[offset] !== TOKENS.RPAREN) return null;
    offset++;

    // = (0xF4) をスキップ
    if (offset >= lineEnd || data[offset] !== TOKENS.EQUAL) return null;
    offset++;

    // HEXCHR$ (ff bf) をスキップ
    if (offset + 2 > lineEnd || data[offset] !== TOKENS.DOLLAR || data[offset + 1] !== TOKENS.HEXCHR) return null;
    offset += 2;

    // ( (0x28) をスキップ
    if (offset >= lineEnd || data[offset] !== TOKENS.LPAREN) return null;
    offset++;

    // " (0x22) をスキップ
    if (offset >= lineEnd || data[offset] !== TOKENS.QUOTE) return null;
    offset++;

    // 48文字のHEX文字列を読む
    if (offset + 48 > lineEnd) return null;
    let hexStr = '';
    for (let i = 0; i < 48; i++) {
      hexStr += String.fromCharCode(data[offset + i]);
    }
    offset += 48;

    // " (0x22) を確認
    if (offset >= lineEnd || data[offset] !== TOKENS.QUOTE) return null;

    // HEX文字列の検証
    if (!/^[0-9A-Fa-f]{48}$/.test(hexStr)) return null;

    return { charCode, hexStr };
  }

  /**
   * デフォルトのファイル名を取得
   */
  static getDefaultFileName(isBinary: boolean): string {
    return isBinary ? 'pcg.bas' : 'pcg.asc';
  }
}
