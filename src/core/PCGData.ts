/**
 * PCGデータ管理クラス
 * X1のPCG（Programmable Character Generator）データを管理する
 *
 * データ構造:
 * - 256文字 x 24バイト（B,R,G各8バイト）= 6144バイト
 * - 各プレーンは8行 x 1バイト/行 = 8バイト
 * - 色は3プレーンのビットを合成して0-7で表現
 */

import {
  EventType,
  EventHandler,
  PCG_BYTES_PER_CHAR,
  PCG_BYTES_PER_PLANE,
  PCG_TOTAL_BYTES,
  X1Color
} from './types';

export class PCGData {
  /** PCGデータ（256文字 x 24バイト = 6144バイト） */
  private data: Uint8Array;

  /** イベントリスナー */
  private listeners: Map<EventType, Set<EventHandler>>;

  constructor() {
    // 256文字 x 24バイト = 6144バイト
    this.data = new Uint8Array(PCG_TOTAL_BYTES);
    this.listeners = new Map();

    // デフォルトパターンで初期化（全て0）
    this.clear();
  }

  /**
   * 全PCGデータをクリア
   */
  clear(): void {
    this.data.fill(0);
    this.emit('pcg-updated', { code: -1 }); // -1 = all
  }

  /**
   * 指定したキャラクターコードのPCGデータを取得（24バイト）
   * @param code キャラクターコード（0-255）
   * @returns 24バイトのUint8Array（B[8], R[8], G[8]）
   */
  getCharacter(code: number): Uint8Array {
    const offset = (code & 0xFF) * PCG_BYTES_PER_CHAR;
    return new Uint8Array(this.data.buffer, offset, PCG_BYTES_PER_CHAR);
  }

  /**
   * 指定したキャラクターコードのPCGデータを設定（24バイト）
   * @param code キャラクターコード（0-255）
   * @param data 24バイトのデータ（B[8], R[8], G[8]）
   */
  setCharacter(code: number, data: Uint8Array): void {
    if (data.length !== PCG_BYTES_PER_CHAR) {
      throw new Error(`PCG data must be ${PCG_BYTES_PER_CHAR} bytes`);
    }
    const offset = (code & 0xFF) * PCG_BYTES_PER_CHAR;
    this.data.set(data, offset);
    this.emit('pcg-updated', { code: code & 0xFF });
  }

  /**
   * 指定したドットの色を取得（0-7）
   * @param charCode キャラクターコード（0-255）
   * @param x X座標（0-7）
   * @param y Y座標（0-7）
   * @returns 色（0-7）
   */
  getPixel(charCode: number, x: number, y: number): X1Color {
    const offset = (charCode & 0xFF) * PCG_BYTES_PER_CHAR;
    const mask = 0x80 >> (x & 0x07);
    const row = y & 0x07;

    // B, R, G プレーンからビットを取得
    const b = (this.data[offset + row] & mask) !== 0 ? 1 : 0;
    const r = (this.data[offset + PCG_BYTES_PER_PLANE + row] & mask) !== 0 ? 1 : 0;
    const g = (this.data[offset + PCG_BYTES_PER_PLANE * 2 + row] & mask) !== 0 ? 1 : 0;

    // 色を合成（bit0=B, bit1=R, bit2=G）
    return (b | (r << 1) | (g << 2)) as X1Color;
  }

  /**
   * 指定したドットの色を設定（0-7）
   * @param charCode キャラクターコード（0-255）
   * @param x X座標（0-7）
   * @param y Y座標（0-7）
   * @param color 色（0-7）
   */
  setPixel(charCode: number, x: number, y: number, color: X1Color): void {
    const offset = (charCode & 0xFF) * PCG_BYTES_PER_CHAR;
    const mask = 0x80 >> (x & 0x07);
    const row = y & 0x07;

    // 色を分解
    const b = (color & 1) !== 0;
    const r = (color & 2) !== 0;
    const g = (color & 4) !== 0;

    // Bプレーン
    if (b) {
      this.data[offset + row] |= mask;
    } else {
      this.data[offset + row] &= ~mask;
    }

    // Rプレーン
    if (r) {
      this.data[offset + PCG_BYTES_PER_PLANE + row] |= mask;
    } else {
      this.data[offset + PCG_BYTES_PER_PLANE + row] &= ~mask;
    }

    // Gプレーン
    if (g) {
      this.data[offset + PCG_BYTES_PER_PLANE * 2 + row] |= mask;
    } else {
      this.data[offset + PCG_BYTES_PER_PLANE * 2 + row] &= ~mask;
    }

    this.emit('pcg-updated', { code: charCode & 0xFF });
  }

  /**
   * 指定したプレーンの1行を取得
   * @param charCode キャラクターコード（0-255）
   * @param plane プレーン（0=B, 1=R, 2=G）
   * @param row 行（0-7）
   * @returns 1バイト
   */
  getPlaneRow(charCode: number, plane: number, row: number): number {
    const offset = (charCode & 0xFF) * PCG_BYTES_PER_CHAR + (plane & 0x03) * PCG_BYTES_PER_PLANE + (row & 0x07);
    return this.data[offset];
  }

  /**
   * 指定したプレーンの1行を設定
   * @param charCode キャラクターコード（0-255）
   * @param plane プレーン（0=B, 1=R, 2=G）
   * @param row 行（0-7）
   * @param value 1バイト
   */
  setPlaneRow(charCode: number, plane: number, row: number, value: number): void {
    const offset = (charCode & 0xFF) * PCG_BYTES_PER_CHAR + (plane & 0x03) * PCG_BYTES_PER_PLANE + (row & 0x07);
    this.data[offset] = value & 0xFF;
    this.emit('pcg-updated', { code: charCode & 0xFF });
  }

  /**
   * PCGDataのコピーを作成
   */
  clone(): PCGData {
    const cloned = new PCGData();
    cloned.data.set(this.data);
    return cloned;
  }

  /**
   * 全PCGデータをUint8Arrayとして取得
   */
  getAllData(): Uint8Array {
    return new Uint8Array(this.data);
  }

  /**
   * 全PCGデータを設定
   */
  setAllData(data: Uint8Array): void {
    if (data.length !== PCG_TOTAL_BYTES) {
      throw new Error(`PCG data must be ${PCG_TOTAL_BYTES} bytes`);
    }
    this.data.set(data);
    this.emit('pcg-updated', { code: -1 });
  }

  /**
   * 単色のPCGデータ（8バイト）を8色対応の24バイトに変換して設定
   * @param charCode キャラクターコード
   * @param monoData 8バイトの単色データ
   * @param color 設定する色（0-7）
   */
  setMonochromeCharacter(charCode: number, monoData: Uint8Array, color: X1Color): void {
    if (monoData.length !== 8) {
      throw new Error('Monochrome data must be 8 bytes');
    }

    const offset = (charCode & 0xFF) * PCG_BYTES_PER_CHAR;

    // 色を分解
    const useB = (color & 1) !== 0;
    const useR = (color & 2) !== 0;
    const useG = (color & 4) !== 0;

    for (let row = 0; row < 8; row++) {
      // Bプレーン
      this.data[offset + row] = useB ? monoData[row] : 0;
      // Rプレーン
      this.data[offset + PCG_BYTES_PER_PLANE + row] = useR ? monoData[row] : 0;
      // Gプレーン
      this.data[offset + PCG_BYTES_PER_PLANE * 2 + row] = useG ? monoData[row] : 0;
    }

    this.emit('pcg-updated', { code: charCode & 0xFF });
  }

  /**
   * イベントリスナーを登録
   */
  on(event: EventType, handler: EventHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  /**
   * イベントリスナーを解除
   */
  off(event: EventType, handler: EventHandler): void {
    this.listeners.get(event)?.delete(handler);
  }

  /**
   * イベントを発火
   */
  private emit(event: EventType, data: unknown): void {
    this.listeners.get(event)?.forEach(handler => handler(data));
  }
}
