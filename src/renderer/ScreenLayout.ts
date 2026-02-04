/**
 * 画面レイアウト管理
 * タイトル、編集エリア枠、定義エリア枠、メニューを描画する
 */

import { X1Renderer } from './X1Renderer';
import {
  X1_COLORS,
  X1_BOX_CHARS,
  X1_ARROW_CHARS,
  EditMode,
  Direction,
  X1Color
} from '../core/types';

/** 画面レイアウト座標定数 */
const LAYOUT = {
  // タイトル
  TITLE_X: 5,      // 文字単位
  TITLE_Y: 0,      // 行番号

  // 編集エリア（文字単位座標）
  EDITOR_FRAME_X: 0,
  EDITOR_FRAME_Y: 1,   // 1つ上に詰めた
  EDITOR_FRAME_W: 18,  // 枠含む幅（16+2）
  EDITOR_FRAME_H: 18,  // 枠含む高さ（16+2）

  // 定義エリア（文字単位座標）
  DEF_FRAME_X: 20,
  DEF_FRAME_Y: 1,    // 1つ上に詰めた
  DEF_FRAME_W: 18,   // 枠含む幅（16+2）
  DEF_FRAME_H: 18,   // 枠含む高さ（16+2）

  // メニューエリア
  MENU_Y: 19         // 2つ上に詰めた
} as const;

/** 1文字のピクセルサイズ */
const CHAR_WIDTH = 8;
const CHAR_HEIGHT = 8;

export class ScreenLayout {
  private x1Renderer: X1Renderer;

  constructor(x1Renderer: X1Renderer) {
    this.x1Renderer = x1Renderer;
  }

  /**
   * タイトルを描画
   */
  drawTitle(): void {
    const x = LAYOUT.TITLE_X * CHAR_WIDTH;
    const y = LAYOUT.TITLE_Y * CHAR_HEIGHT;
    this.x1Renderer.drawText(x, y, '***** Character maker *****', X1_COLORS.WHITE, X1_COLORS.BLACK);
  }

  /**
   * 編集エリアの枠を描画（罫線文字使用）
   */
  drawEditorFrame(): void {
    this.drawFrame(
      LAYOUT.EDITOR_FRAME_X,
      LAYOUT.EDITOR_FRAME_Y,
      LAYOUT.EDITOR_FRAME_W,
      LAYOUT.EDITOR_FRAME_H,
      X1_COLORS.CYAN
    );
  }

  /**
   * 定義エリアの枠を描画（罫線文字 + 0-F表示）
   */
  drawDefinitionFrame(): void {
    const baseX = LAYOUT.DEF_FRAME_X;
    const baseY = LAYOUT.DEF_FRAME_Y;

    // 上部のインデックス行「+0123456789ABCDEF+」
    const topY = baseY * CHAR_HEIGHT;
    this.x1Renderer.drawChar(baseX * CHAR_WIDTH, topY, X1_BOX_CHARS.TOP_LEFT, X1_COLORS.CYAN);
    for (let i = 0; i < 16; i++) {
      const hex = i.toString(16).toUpperCase();
      this.x1Renderer.drawText((baseX + 1 + i) * CHAR_WIDTH, topY, hex, X1_COLORS.CYAN);
    }
    this.x1Renderer.drawChar((baseX + 17) * CHAR_WIDTH, topY, X1_BOX_CHARS.TOP_RIGHT, X1_COLORS.CYAN);

    // 左右の縦線とインデックス
    for (let row = 0; row < 16; row++) {
      const y = (baseY + 1 + row) * CHAR_HEIGHT;
      const hex = row.toString(16).toUpperCase();

      // 左側: インデックス（水色）
      this.x1Renderer.drawText(baseX * CHAR_WIDTH, y, hex, X1_COLORS.CYAN);

      // 右側: インデックス（水色）
      this.x1Renderer.drawText((baseX + 17) * CHAR_WIDTH, y, hex, X1_COLORS.CYAN);
    }

    // 下部のインデックス行「+0123456789ABCDEF+」
    const bottomY = (baseY + 17) * CHAR_HEIGHT;
    this.x1Renderer.drawChar(baseX * CHAR_WIDTH, bottomY, X1_BOX_CHARS.BOTTOM_LEFT, X1_COLORS.CYAN);
    for (let i = 0; i < 16; i++) {
      const hex = i.toString(16).toUpperCase();
      this.x1Renderer.drawText((baseX + 1 + i) * CHAR_WIDTH, bottomY, hex, X1_COLORS.CYAN);
    }
    this.x1Renderer.drawChar((baseX + 17) * CHAR_WIDTH, bottomY, X1_BOX_CHARS.BOTTOM_RIGHT, X1_COLORS.CYAN);
  }

  /**
   * 罫線文字で枠を描画
   */
  private drawFrame(
    charX: number,
    charY: number,
    charW: number,
    charH: number,
    color: X1Color
  ): void {
    // 左上角
    this.x1Renderer.drawChar(charX * CHAR_WIDTH, charY * CHAR_HEIGHT, X1_BOX_CHARS.TOP_LEFT, color);

    // 上辺
    for (let x = 1; x < charW - 1; x++) {
      this.x1Renderer.drawChar((charX + x) * CHAR_WIDTH, charY * CHAR_HEIGHT, X1_BOX_CHARS.HORIZONTAL, color);
    }

    // 右上角
    this.x1Renderer.drawChar((charX + charW - 1) * CHAR_WIDTH, charY * CHAR_HEIGHT, X1_BOX_CHARS.TOP_RIGHT, color);

    // 左右の縦線
    for (let y = 1; y < charH - 1; y++) {
      this.x1Renderer.drawChar(charX * CHAR_WIDTH, (charY + y) * CHAR_HEIGHT, X1_BOX_CHARS.VERTICAL, color);
      this.x1Renderer.drawChar((charX + charW - 1) * CHAR_WIDTH, (charY + y) * CHAR_HEIGHT, X1_BOX_CHARS.VERTICAL, color);
    }

    // 左下角
    this.x1Renderer.drawChar(charX * CHAR_WIDTH, (charY + charH - 1) * CHAR_HEIGHT, X1_BOX_CHARS.BOTTOM_LEFT, color);

    // 下辺
    for (let x = 1; x < charW - 1; x++) {
      this.x1Renderer.drawChar((charX + x) * CHAR_WIDTH, (charY + charH - 1) * CHAR_HEIGHT, X1_BOX_CHARS.HORIZONTAL, color);
    }

    // 右下角
    this.x1Renderer.drawChar((charX + charW - 1) * CHAR_WIDTH, (charY + charH - 1) * CHAR_HEIGHT, X1_BOX_CHARS.BOTTOM_RIGHT, color);
  }

  /**
   * メニューエリアを描画（6行）
   * @param editMode 現在の編集モード
   * @param currentCharCode 現在のキャラクターコード（未使用、互換性のため残す）
   * @param editChrCode EDIT CHR.で入力した文字コード
   * @param lastDirection 最後のカーソル移動方向
   * @param currentColor 現在の描画色
   * @param inputDeviceMode 入力デバイスモード（keyboard/mouse）
   */
  drawMenu(
    editMode: EditMode,
    _currentCharCode: number,
    editChrCode: number = 0,
    lastDirection: Direction = Direction.RIGHT,
    currentColor: X1Color = X1_COLORS.WHITE,
    inputDeviceMode: 'keyboard' | 'mouse' = 'keyboard'
  ): void {
    const baseY = LAYOUT.MENU_Y;
    const editChrCodeHex = editChrCode.toString(16).toUpperCase().padStart(2, '0');

    // 1行目: ><^v..CURSOR MOVE   :0ｶﾗ7.POINT SET
    this.drawMenuLine1(baseY, lastDirection);

    // 2行目: M.....EDIT MODE=X   :C....COLOR CHANGE
    this.drawMenuLine2(baseY + 1, editMode);

    // 3行目: E.....EDIT CHR.(??) :S....SET CHR.
    this.drawMenuLine3(baseY + 2, editChrCodeHex);

    // 4行目: CLR...CLS  !...END  :R....ROTATION
    this.drawMenuLine4(baseY + 3);

    // 5行目: P.....PROGRAMMING   :T....TRANSFER
    this.drawMenuLine5(baseY + 4);

    // 6行目: G.....GRID          :K....INPUT=XX COL=N
    this.drawMenuLine6(baseY + 5, currentColor, inputDeviceMode);
  }

  /**
   * メニュー1行目: カーソル移動、ポイントセット
   * @param row 行番号
   * @param lastDirection 最後のカーソル移動方向（この方向の矢印が赤くなる）
   */
  private drawMenuLine1(row: number, lastDirection: Direction): void {
    const y = row * CHAR_HEIGHT;

    // 矢印文字で「><^v」（最後に移動した方向は赤、それ以外は白）
    this.x1Renderer.drawChar(0 * CHAR_WIDTH, y, X1_ARROW_CHARS.RIGHT,
      lastDirection === Direction.RIGHT ? X1_COLORS.RED : X1_COLORS.WHITE);
    this.x1Renderer.drawChar(1 * CHAR_WIDTH, y, X1_ARROW_CHARS.LEFT,
      lastDirection === Direction.LEFT ? X1_COLORS.RED : X1_COLORS.WHITE);
    this.x1Renderer.drawChar(2 * CHAR_WIDTH, y, X1_ARROW_CHARS.UP,
      lastDirection === Direction.UP ? X1_COLORS.RED : X1_COLORS.WHITE);
    this.x1Renderer.drawChar(3 * CHAR_WIDTH, y, X1_ARROW_CHARS.DOWN,
      lastDirection === Direction.DOWN ? X1_COLORS.RED : X1_COLORS.WHITE);

    this.x1Renderer.drawText(4 * CHAR_WIDTH, y, '..CURSOR MOVE', X1_COLORS.WHITE);

    // コロン区切り
    this.x1Renderer.drawText(19 * CHAR_WIDTH, y, ':', X1_COLORS.WHITE);

    // 0-7 ポイントセット
    this.x1Renderer.drawText(20 * CHAR_WIDTH, y, '0ｶﾗ7.POINT SET', X1_COLORS.WHITE);
  }

  /**
   * メニュー2行目: EDIT MODE, COLOR CHANGE
   */
  private drawMenuLine2(row: number, editMode: EditMode): void {
    const y = row * CHAR_HEIGHT;

    this.x1Renderer.drawText(0 * CHAR_WIDTH, y, 'M.....EDIT MODE=', X1_COLORS.WHITE);

    // モード表示（白背景・赤文字の罫線文字）
    // SEPARATE: ┼ (0x96), VERTICAL: │ (0x91), HORIZONTAL: ─ (0x90), ALL: スペース
    // ※覚え方: 縦に2文字並ぶので縦線(│)、横に2文字並ぶので横線(─)
    let modeChar: number;
    switch (editMode) {
      case EditMode.SEPARATE:
        modeChar = X1_BOX_CHARS.CROSS;      // ┼
        break;
      case EditMode.VERTICAL:
        modeChar = X1_BOX_CHARS.VERTICAL;   // │ 縦2文字モード
        break;
      case EditMode.HORIZONTAL:
        modeChar = X1_BOX_CHARS.HORIZONTAL; // ─ 横2文字モード
        break;
      case EditMode.ALL:
      default:
        modeChar = 0x20;                     // スペース（白四角）
        break;
    }
    this.x1Renderer.drawChar(16 * CHAR_WIDTH, y, modeChar, X1_COLORS.RED, X1_COLORS.WHITE);

    // 空白で埋める（モード表示後の2文字分）
    this.x1Renderer.drawChar(17 * CHAR_WIDTH, y, 0x20, X1_COLORS.BLACK, X1_COLORS.BLACK);
    this.x1Renderer.drawChar(18 * CHAR_WIDTH, y, 0x20, X1_COLORS.BLACK, X1_COLORS.BLACK);

    // コロン区切り
    this.x1Renderer.drawText(19 * CHAR_WIDTH, y, ':', X1_COLORS.WHITE);

    this.x1Renderer.drawText(20 * CHAR_WIDTH, y, 'C....COLOR CHANGE', X1_COLORS.WHITE);
  }

  /**
   * メニュー3行目: EDIT CHR, SET CHR
   */
  private drawMenuLine3(row: number, charCodeHex: string): void {
    const y = row * CHAR_HEIGHT;

    // E.....EDIT CHR.(XX) 全体が水色（XXは黄色）
    this.x1Renderer.drawText(0 * CHAR_WIDTH, y, 'E.....EDIT CHR.(', X1_COLORS.CYAN);
    this.x1Renderer.drawText(16 * CHAR_WIDTH, y, charCodeHex, X1_COLORS.YELLOW);
    this.x1Renderer.drawText(18 * CHAR_WIDTH, y, ')', X1_COLORS.CYAN);

    // コロン区切り
    this.x1Renderer.drawText(19 * CHAR_WIDTH, y, ':', X1_COLORS.WHITE);

    // S....SET CHR. 全体が水色
    this.x1Renderer.drawText(20 * CHAR_WIDTH, y, 'S....SET CHR.', X1_COLORS.CYAN);
  }

  /**
   * メニュー4行目: CLS, END, ROTATION
   */
  private drawMenuLine4(row: number): void {
    const y = row * CHAR_HEIGHT;

    // CLR...CLS 全体が水色
    this.x1Renderer.drawText(0 * CHAR_WIDTH, y, 'CLR...CLS', X1_COLORS.CYAN);

    // 空白
    this.x1Renderer.drawText(9 * CHAR_WIDTH, y, '  ', X1_COLORS.BLACK);

    // !...END 全体が赤
    this.x1Renderer.drawText(11 * CHAR_WIDTH, y, '!...END', X1_COLORS.RED);

    // 空白
    this.x1Renderer.drawText(18 * CHAR_WIDTH, y, ' ', X1_COLORS.BLACK);

    // コロン区切り
    this.x1Renderer.drawText(19 * CHAR_WIDTH, y, ':', X1_COLORS.WHITE);

    // R....ROTATION 全体が水色
    this.x1Renderer.drawText(20 * CHAR_WIDTH, y, 'R....ROTATION', X1_COLORS.CYAN);
  }

  /**
   * メニュー5行目: PROGRAMMING, TRANSFER
   */
  private drawMenuLine5(row: number): void {
    const y = row * CHAR_HEIGHT;

    // P.....PROGRAMMING 全体が黄色
    this.x1Renderer.drawText(0 * CHAR_WIDTH, y, 'P.....PROGRAMMING', X1_COLORS.YELLOW);

    // 空白
    this.x1Renderer.drawText(17 * CHAR_WIDTH, y, '  ', X1_COLORS.BLACK);

    // コロン区切り
    this.x1Renderer.drawText(19 * CHAR_WIDTH, y, ':', X1_COLORS.WHITE);

    // T....TRANSFER 全体が黄色
    this.x1Renderer.drawText(20 * CHAR_WIDTH, y, 'T....TRANSFER', X1_COLORS.YELLOW);
  }

  /**
   * メニュー6行目: GRID, INPUT MODE, COLOR
   */
  private drawMenuLine6(row: number, currentColor: X1Color, inputDeviceMode: 'keyboard' | 'mouse'): void {
    const y = row * CHAR_HEIGHT;

    // G.....GRID 全体が緑
    this.x1Renderer.drawText(0 * CHAR_WIDTH, y, 'G.....GRID', X1_COLORS.GREEN);

    // 空白
    this.x1Renderer.drawText(10 * CHAR_WIDTH, y, '         ', X1_COLORS.BLACK);

    // コロン区切り
    this.x1Renderer.drawText(19 * CHAR_WIDTH, y, ':', X1_COLORS.WHITE);

    // K....INPUT=XX
    const modeStr = inputDeviceMode === 'keyboard' ? 'KB' : 'MS';
    this.x1Renderer.drawText(20 * CHAR_WIDTH, y, 'K....', X1_COLORS.GREEN);
    this.x1Renderer.drawText(25 * CHAR_WIDTH, y, modeStr, X1_COLORS.YELLOW);

    // COL=N（Nは現在の色の数字、色付き表示）
    this.x1Renderer.drawText(28 * CHAR_WIDTH, y, ' COL=', X1_COLORS.WHITE);
    // 色番号を該当の色で表示
    this.x1Renderer.drawText(33 * CHAR_WIDTH, y, currentColor.toString(), currentColor === X1_COLORS.BLACK ? X1_COLORS.WHITE : currentColor);
  }

  /**
   * メニューエリアをクリア（6行分）
   */
  clearMenuArea(): void {
    const ctx = this.x1Renderer.getBackContext();
    const y = LAYOUT.MENU_Y * CHAR_HEIGHT;
    const height = 6 * CHAR_HEIGHT;
    // WIDTH 40モードの幅（40文字 = 320px）
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, y, 320, height);
  }

  /**
   * ステータス行をクリア（1行）
   * @param row 行番号
   */
  clearStatusLine(row: number): void {
    const ctx = this.x1Renderer.getBackContext();
    const y = row * CHAR_HEIGHT;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, y, 320, CHAR_HEIGHT);
  }

  /**
   * 編集エリアの内部座標（ピクセル）を取得
   */
  getEditorAreaPixelOffset(): { x: number; y: number } {
    return {
      x: (LAYOUT.EDITOR_FRAME_X + 1) * CHAR_WIDTH,
      y: (LAYOUT.EDITOR_FRAME_Y + 1) * CHAR_HEIGHT
    };
  }

  /**
   * 定義エリアの内部座標（ピクセル）を取得
   */
  getDefinitionAreaPixelOffset(): { x: number; y: number } {
    return {
      x: (LAYOUT.DEF_FRAME_X + 1) * CHAR_WIDTH,
      y: (LAYOUT.DEF_FRAME_Y + 1) * CHAR_HEIGHT
    };
  }
}
