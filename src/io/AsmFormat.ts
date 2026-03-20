/**
 * ASM形式（アセンブラ）の保存
 * DB文によるテキスト出力（SAVE専用）
 * 通常モードと三倍速定義モード（x3）に対応
 */

import { PCGData } from '../core/PCGData';

/**
 * ASM形式の保存ユーティリティ
 */
export class AsmFormat {
  /**
   * ASM形式で保存
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

    const lines: string[] = [];

    for (let i = 0; i < count; i++) {
      const charCode = start + i;
      const charData = pcgData.getCharacter(charCode);

      // ; CHR $XX ヘッダ
      lines.push(`; CHR $${charCode.toString(16).toUpperCase().padStart(2, '0')}`);

      if (x3mode) {
        // 三倍速定義モード: 行ごとにB,R,Gインターリーブで24バイト1行
        const bytes: string[] = [];
        for (let row = 0; row < 8; row++) {
          bytes.push('$' + charData[row].toString(16).toUpperCase().padStart(2, '0'));       // B
          bytes.push('$' + charData[8 + row].toString(16).toUpperCase().padStart(2, '0'));   // R
          bytes.push('$' + charData[16 + row].toString(16).toUpperCase().padStart(2, '0')); // G
        }
        lines.push(`\tDB\t${bytes.join(',')}`);
      } else {
        // 通常モード: B[8], R[8], G[8] を各8バイトずつ3行で出力
        for (let plane = 0; plane < 3; plane++) {
          const offset = plane * 8;
          const bytes: string[] = [];
          for (let j = 0; j < 8; j++) {
            bytes.push('$' + charData[offset + j].toString(16).toUpperCase().padStart(2, '0'));
          }
          lines.push(`\tDB\t${bytes.join(',')}`);
        }
      }
    }

    const content = lines.join('\n') + '\n';
    return new Blob([content], { type: 'text/plain' });
  }

  /**
   * デフォルトのファイル名を取得
   */
  static getDefaultFileName(x3mode: boolean): string {
    return x3mode ? 'pcg_x3.asm' : 'pcg.asm';
  }
}
