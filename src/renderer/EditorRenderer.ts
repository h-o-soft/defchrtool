/**
 * 編集エリアレンダラー
 * 8x8ドット（または16x16）の編集領域を描画する
 */

import { PCGData } from '../core/PCGData';
import { CanvasManager } from './CanvasManager';
import { X1Renderer } from './X1Renderer';
import {
  FONT_WIDTH,
  FONT_HEIGHT,
  X1_COLOR_RGB,
  X1_COLORS,
  EditMode,
  Position
} from '../core/types';

/** 編集エリアのドットサイズ（拡大表示用） */
const DOT_SIZE = 8;

/** グリッド線の色 */
const GRID_COLOR = 'rgba(128, 128, 128, 0.5)';

export class EditorRenderer {
  private canvasManager: CanvasManager;
  private pcgData: PCGData;
  private x1Renderer: X1Renderer;

  /** 編集エリアの描画開始位置 */
  private offsetX: number = 8;
  private offsetY: number = 32;

  /** グリッド表示フラグ */
  private showGrid: boolean = true;

  /** カーソル点滅用タイマー */
  private cursorVisible: boolean = true;
  private cursorBlinkInterval: number | null = null;

  constructor(canvasManager: CanvasManager, pcgData: PCGData, x1Renderer: X1Renderer) {
    this.canvasManager = canvasManager;
    this.pcgData = pcgData;
    this.x1Renderer = x1Renderer;

    // カーソル点滅開始
    this.startCursorBlink();
  }

  /**
   * 描画開始位置を設定
   */
  setOffset(x: number, y: number): void {
    this.offsetX = x;
    this.offsetY = y;
  }

  /**
   * グリッド表示を切り替え
   */
  setShowGrid(show: boolean): void {
    this.showGrid = show;
  }

  /**
   * カーソル点滅開始
   */
  private startCursorBlink(): void {
    if (this.cursorBlinkInterval !== null) return;
    this.cursorBlinkInterval = window.setInterval(() => {
      this.cursorVisible = !this.cursorVisible;
    }, 500);
  }

  /**
   * カーソル点滅停止
   */
  stopCursorBlink(): void {
    if (this.cursorBlinkInterval !== null) {
      clearInterval(this.cursorBlinkInterval);
      this.cursorBlinkInterval = null;
    }
  }

  /**
   * 編集エリアを描画（2x2文字 = 16x16ドット）
   * @param baseCharCode 左上のキャラクターコード
   * @param editMode 編集モード
   * @param cursorPos カーソル位置（ドット座標: 0-15, 0-15）
   */
  render(baseCharCode: number, editMode: EditMode, cursorPos: Position): void {
    const ctx = this.canvasManager.getBackContext();

    // 2x2文字分の描画領域サイズ
    const areaWidth = 16 * DOT_SIZE;  // 128px
    const areaHeight = 16 * DOT_SIZE; // 128px

    // 背景（黒）
    ctx.fillStyle = '#000000';
    ctx.fillRect(this.offsetX, this.offsetY, areaWidth, areaHeight);

    // 4文字分のPCGデータを描画（●文字パターンを使用）
    for (let charY = 0; charY < 2; charY++) {
      for (let charX = 0; charX < 2; charX++) {
        // キャラクターコードの計算（縦方向は+16）
        const charCode = (baseCharCode + charX + charY * 16) & 0xFF;

        // 8x8ドットを描画
        for (let y = 0; y < FONT_HEIGHT; y++) {
          for (let x = 0; x < FONT_WIDTH; x++) {
            const color = this.pcgData.getPixel(charCode, x, y);
            const drawX = this.offsetX + charX * FONT_WIDTH * DOT_SIZE + x * DOT_SIZE;
            const drawY = this.offsetY + charY * FONT_HEIGHT * DOT_SIZE + y * DOT_SIZE;

            // ●パターンで描画（DOT_SIZE = 8なので1:1対応）
            this.drawCircleDot(ctx, drawX, drawY, color);
          }
        }
      }
    }

    // グリッド線
    if (this.showGrid) {
      this.drawGrid(ctx, areaWidth, areaHeight);
    }

    // カーソル描画
    if (this.cursorVisible) {
      this.drawCursor(ctx, cursorPos, editMode);
    }

    // 編集モードの範囲枠（グリッド表示時のみ）
    if (this.showGrid) {
      this.drawEditModeFrame(ctx, editMode, cursorPos);
    }
  }

  /**
   * ●パターンでドットを描画
   */
  private drawCircleDot(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    color: number
  ): void {
    const [r, g, b] = X1_COLOR_RGB[color as keyof typeof X1_COLOR_RGB];

    // ROMフォントの0xE0（●）を使用
    const circlePattern = this.x1Renderer.getFontData(0xE0);
    for (let py = 0; py < 8; py++) {
      const rowBits = circlePattern[py];
      for (let px = 0; px < 8; px++) {
        const isSet = (rowBits & (0x80 >> px)) !== 0;
        if (isSet) {
          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        } else {
          ctx.fillStyle = 'rgb(0, 0, 0)';
        }
        ctx.fillRect(x + px, y + py, 1, 1);
      }
    }
  }

  /**
   * グリッド線を描画
   */
  private drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;

    // 縦線
    for (let x = 0; x <= 16; x++) {
      const px = this.offsetX + x * DOT_SIZE;
      ctx.beginPath();
      ctx.moveTo(px + 0.5, this.offsetY);
      ctx.lineTo(px + 0.5, this.offsetY + height);
      ctx.stroke();
    }

    // 横線
    for (let y = 0; y <= 16; y++) {
      const py = this.offsetY + y * DOT_SIZE;
      ctx.beginPath();
      ctx.moveTo(this.offsetX, py + 0.5);
      ctx.lineTo(this.offsetX + width, py + 0.5);
      ctx.stroke();
    }

    // 8x8の境界線（太線）
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;

    // 中央縦線
    const centerX = this.offsetX + 8 * DOT_SIZE;
    ctx.beginPath();
    ctx.moveTo(centerX, this.offsetY);
    ctx.lineTo(centerX, this.offsetY + height);
    ctx.stroke();

    // 中央横線
    const centerY = this.offsetY + 8 * DOT_SIZE;
    ctx.beginPath();
    ctx.moveTo(this.offsetX, centerY);
    ctx.lineTo(this.offsetX + width, centerY);
    ctx.stroke();
  }

  /**
   * カーソルを描画（塗りつぶし矩形）
   */
  private drawCursor(ctx: CanvasRenderingContext2D, pos: Position, _editMode: EditMode): void {
    const cursorX = this.offsetX + pos.x * DOT_SIZE;
    const cursorY = this.offsetY + pos.y * DOT_SIZE;

    // 塗りつぶし矩形（白）
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(cursorX, cursorY, DOT_SIZE, DOT_SIZE);
  }

  /**
   * 編集モードに応じた範囲枠を描画（編集エリアの外側に描画）
   */
  private drawEditModeFrame(ctx: CanvasRenderingContext2D, editMode: EditMode, cursorPos: Position): void {
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.7)';
    ctx.lineWidth = 1;

    let frameX = this.offsetX;
    let frameY = this.offsetY;
    let frameW = 16 * DOT_SIZE;
    let frameH = 16 * DOT_SIZE;

    switch (editMode) {
      case EditMode.SEPARATE:
        // 4Chr.ベツベツ: カーソルがある8x8エリアのみ
        frameX = this.offsetX + Math.floor(cursorPos.x / 8) * 8 * DOT_SIZE;
        frameY = this.offsetY + Math.floor(cursorPos.y / 8) * 8 * DOT_SIZE;
        frameW = 8 * DOT_SIZE;
        frameH = 8 * DOT_SIZE;
        break;

      case EditMode.VERTICAL:
        // タテ2Chr.: カーソルがある縦2文字エリア
        frameX = this.offsetX + Math.floor(cursorPos.x / 8) * 8 * DOT_SIZE;
        frameW = 8 * DOT_SIZE;
        break;

      case EditMode.HORIZONTAL:
        // ヨコ2Chr.: カーソルがある横2文字エリア
        frameY = this.offsetY + Math.floor(cursorPos.y / 8) * 8 * DOT_SIZE;
        frameH = 8 * DOT_SIZE;
        break;

      case EditMode.ALL:
        // 4Chr.スベテ: 全体
        break;
    }

    // 外側に1ドット広げて描画（編集エリアの画像に重ならないように）
    ctx.strokeRect(frameX - 1, frameY - 1, frameW + 2, frameH + 2);
  }

  /**
   * 実サイズ表示（8x8または16x16）
   * @param x 描画X座標
   * @param y 描画Y座標
   * @param baseCharCode 基準キャラクターコード
   * @param mode 編集モード
   * @param cursorPos カーソル位置（オプション、指定時はカーソル位置に応じた文字を表示）
   */
  renderActualSize(x: number, y: number, baseCharCode: number, mode: EditMode, cursorPos?: Position): void {
    const ctx = this.canvasManager.getBackContext();

    // カーソル位置から文字オフセットを計算（0-1, 0-1）
    const cursorCharX = cursorPos ? Math.floor(cursorPos.x / 8) : 0;
    const cursorCharY = cursorPos ? Math.floor(cursorPos.y / 8) : 0;

    // 編集モードに応じてサイズと開始オフセットを決定
    let width = 8;
    let height = 8;
    let startCharX = 0;
    let startCharY = 0;

    switch (mode) {
      case EditMode.SEPARATE:
        // 1文字モード: カーソル位置の1文字のみ
        startCharX = cursorCharX;
        startCharY = cursorCharY;
        break;
      case EditMode.VERTICAL:
        // 縦2文字モード: カーソルがある列の縦2文字
        startCharX = cursorCharX;
        height = 16;
        break;
      case EditMode.HORIZONTAL:
        // 横2文字モード: カーソルがある行の横2文字
        startCharY = cursorCharY;
        width = 16;
        break;
      case EditMode.ALL:
        // 4文字モード: 全4文字
        width = 16;
        height = 16;
        break;
    }

    // 描画
    for (let charY = 0; charY < Math.ceil(height / 8); charY++) {
      for (let charX = 0; charX < Math.ceil(width / 8); charX++) {
        const charCode = (baseCharCode + (startCharX + charX) + (startCharY + charY) * 16) & 0xFF;

        for (let py = 0; py < FONT_HEIGHT; py++) {
          for (let px = 0; px < FONT_WIDTH; px++) {
            const color = this.pcgData.getPixel(charCode, px, py);
            if (color !== X1_COLORS.BLACK) {
              const [r, g, b] = X1_COLOR_RGB[color];
              ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
              ctx.fillRect(x + charX * 8 + px, y + charY * 8 + py, 1, 1);
            }
          }
        }
      }
    }
  }

  /**
   * 破棄
   */
  dispose(): void {
    this.stopCursorBlink();
  }
}
