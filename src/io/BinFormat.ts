/**
 * BIN形式（バイナリ）の保存・読み込み
 * 通常モードと三倍速定義モードに対応
 */

import { PCGData } from '../core/PCGData';

/** BIN形式の定数 */
const BYTES_PER_CHAR = 24;  // 1文字 = 24バイト（B[8], R[8], G[8]）

/**
 * BIN形式の保存・読み込みユーティリティ
 */
export class BinFormat {
  /**
   * BIN形式でPCGデータを保存
   * @param pcgData PCGデータ
   * @param start 開始文字コード
   * @param end 終了文字コード
   * @param x3mode 三倍速定義モード
   * @returns Blob
   */
  static save(pcgData: PCGData, start: number, end: number, x3mode: boolean): Blob {
    const count = end - start + 1;
    if (count <= 0) {
      throw new Error('Invalid range');
    }

    let data: Uint8Array;

    if (x3mode) {
      // 三倍速定義モード: B0,R0,G0, B1,R1,G1, ... の形式（行ごとにインターリーブ）
      // 1文字 = 8行 x 3プレーン = 24バイト
      data = new Uint8Array(count * BYTES_PER_CHAR);
      let offset = 0;
      for (let i = 0; i < count; i++) {
        const charData = pcgData.getCharacter(start + i);
        // 行ごとにB, R, Gをインターリーブ
        for (let row = 0; row < 8; row++) {
          data[offset++] = charData[row];      // B
          data[offset++] = charData[8 + row];  // R
          data[offset++] = charData[16 + row]; // G
        }
      }
    } else {
      // 通常モード: 各文字のデータをそのまま連結（B[8], R[8], G[8]）
      data = new Uint8Array(count * BYTES_PER_CHAR);
      let offset = 0;
      for (let i = 0; i < count; i++) {
        const charData = pcgData.getCharacter(start + i);
        data.set(charData, offset);
        offset += BYTES_PER_CHAR;
      }
    }

    return new Blob([data.buffer as ArrayBuffer], { type: 'application/octet-stream' });
  }

  /**
   * BIN形式でPCGデータを読み込み
   * @param data バイナリデータ
   * @param pcgData 書き込み先のPCGData
   * @param start 開始文字コード
   * @param x3mode 三倍速定義モード
   * @returns 読み込んだ文字数
   */
  static load(data: Uint8Array, pcgData: PCGData, start: number, x3mode: boolean): number {
    const charCount = Math.floor(data.length / BYTES_PER_CHAR);

    if (charCount === 0) {
      throw new Error('File too small');
    }

    if (start + charCount > 256) {
      throw new Error('Data exceeds 256 chars');
    }

    for (let i = 0; i < charCount; i++) {
      const charCode = start + i;
      const charData = new Uint8Array(BYTES_PER_CHAR);

      if (x3mode) {
        // 三倍速定義モード: 行ごとにB, R, Gがインターリーブされている
        const srcOffset = i * BYTES_PER_CHAR;
        for (let row = 0; row < 8; row++) {
          charData[row] = data[srcOffset + row * 3];      // B
          charData[8 + row] = data[srcOffset + row * 3 + 1];  // R
          charData[16 + row] = data[srcOffset + row * 3 + 2]; // G
        }
      } else {
        // 通常モード: そのままコピー
        charData.set(data.slice(i * BYTES_PER_CHAR, (i + 1) * BYTES_PER_CHAR));
      }

      pcgData.setCharacter(charCode, charData);
    }

    return charCount;
  }

  /**
   * デフォルトのファイル名を取得
   */
  static getDefaultFileName(x3mode: boolean): string {
    return x3mode ? 'pcg_x3.bin' : 'pcg.bin';
  }
}
