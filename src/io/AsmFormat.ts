/**
 * ASM形式（アセンブラ）の保存
 * DB文によるテキスト出力（SAVE専用）
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
   * @returns Blob
   */
  static save(pcgData: PCGData, start: number, end: number): Blob {
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

      // B[8], R[8], G[8] を各8バイトずつDB行で出力
      for (let plane = 0; plane < 3; plane++) {
        const offset = plane * 8;
        const bytes: string[] = [];
        for (let j = 0; j < 8; j++) {
          bytes.push('$' + charData[offset + j].toString(16).toUpperCase().padStart(2, '0'));
        }
        lines.push(`\tDB\t${bytes.join(',')}`);
      }
    }

    const content = lines.join('\n') + '\n';
    return new Blob([content], { type: 'text/plain' });
  }

  /**
   * デフォルトのファイル名を取得
   */
  static getDefaultFileName(): string {
    return 'pcg.asm';
  }
}
