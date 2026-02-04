/**
 * エディタコマンド実行
 * 編集操作のロジックを担当（UI表示・保存は行わない）
 */

import { PCGData } from '../core/PCGData';
import { EditorState } from './EditorState';
import { X1Color, X1_COLORS, EditMode } from '../core/types';
import { RotationType } from '../input/InputEventTypes';
import { EditBufferTransform } from '../core/EditBufferTransform';
import { getEditArea, getCursorCharPos } from '../core/EditAreaCalculator';

/** コマンド実行に必要な最小限の依存 */
export interface CommandContext {
  pcgData: PCGData;
  editBuffer: PCGData;
  editorState: EditorState;
}

/** コマンドの実行結果 */
export interface CommandResult {
  success: boolean;
  message?: string;
  needsSave?: boolean;
  needsRender?: boolean;
}

/**
 * エディタコマンド実行クラス
 * - 純粋なロジックのみ
 * - UI表示・保存は行わない
 */
export class EditorCommands {
  private ctx: CommandContext;

  constructor(ctx: CommandContext) {
    this.ctx = ctx;
  }

  // === カーソル・描画 ===

  /** ドット描画（編集バッファに描画） */
  drawDot(color: X1Color): CommandResult {
    const { editBuffer, editorState } = this.ctx;

    const x = editorState.cursorX;
    const y = editorState.cursorY;
    const charX = Math.floor(x / 8);
    const charY = Math.floor(y / 8);
    const localX = x % 8;
    const localY = y % 8;
    const bufferCharCode = (charX + charY * 16) & 0xFF;

    editBuffer.setPixel(bufferCharCode, localX, localY, color);
    editorState.setColor(color);
    editorState.advanceCursor();

    return { success: true, needsSave: true };
  }

  /** トグル描画（Space） */
  toggleDraw(): CommandResult {
    const { editBuffer, editorState } = this.ctx;

    const x = editorState.cursorX;
    const y = editorState.cursorY;
    const charX = Math.floor(x / 8);
    const charY = Math.floor(y / 8);
    const localX = x % 8;
    const localY = y % 8;
    const bufferCharCode = (charX + charY * 16) & 0xFF;

    const currentPixelColor = editBuffer.getPixel(bufferCharCode, localX, localY);
    const newColor = currentPixelColor === X1_COLORS.BLACK
      ? editorState.currentColor
      : X1_COLORS.BLACK;

    editBuffer.setPixel(bufferCharCode, localX, localY, newColor);
    editorState.advanceCursor();

    return { success: true, needsSave: true };
  }

  /** マウスでドット描画 */
  mouseDraw(dotX: number, dotY: number): CommandResult {
    const { editBuffer, editorState } = this.ctx;

    const charX = Math.floor(dotX / 8);
    const charY = Math.floor(dotY / 8);
    const localX = dotX % 8;
    const localY = dotY % 8;
    const bufferCharCode = (charX + charY * 16) & 0xFF;

    editBuffer.setPixel(bufferCharCode, localX, localY, editorState.currentColor);
    editorState.setCursor(dotX, dotY);

    return { success: true, needsSave: true };
  }

  // === 編集操作 ===

  /** EDIT CHR.処理（定義エリアのキャラクタを選択） */
  editChr(charCode: number): CommandResult {
    const { editorState } = this.ctx;
    editorState.setCurrentCharCode(charCode);

    return {
      success: true,
      message: `Edit CHR: $${charCode.toString(16).toUpperCase().padStart(2, '0')}`,
      needsSave: true
    };
  }

  /** SET CHR.処理 */
  setChr(charCode: number): CommandResult {
    const { pcgData, editBuffer, editorState } = this.ctx;

    const charX = Math.floor(editorState.cursorX / 8);
    const charY = Math.floor(editorState.cursorY / 8);

    switch (editorState.editMode) {
      case EditMode.SEPARATE:
        {
          const srcBufferCode = charX + charY * 16;
          pcgData.setCharacter(charCode, new Uint8Array(editBuffer.getCharacter(srcBufferCode)));
        }
        break;
      case EditMode.VERTICAL:
        {
          const srcTop = charX;
          const srcBottom = charX + 16;
          pcgData.setCharacter(charCode, new Uint8Array(editBuffer.getCharacter(srcTop)));
          pcgData.setCharacter((charCode + 16) & 0xFF, new Uint8Array(editBuffer.getCharacter(srcBottom)));
        }
        break;
      case EditMode.HORIZONTAL:
        {
          const srcLeft = charY * 16;
          const srcRight = charY * 16 + 1;
          pcgData.setCharacter(charCode, new Uint8Array(editBuffer.getCharacter(srcLeft)));
          pcgData.setCharacter((charCode + 1) & 0xFF, new Uint8Array(editBuffer.getCharacter(srcRight)));
        }
        break;
      case EditMode.ALL:
        {
          pcgData.setCharacter(charCode, new Uint8Array(editBuffer.getCharacter(0)));
          pcgData.setCharacter((charCode + 1) & 0xFF, new Uint8Array(editBuffer.getCharacter(1)));
          pcgData.setCharacter((charCode + 16) & 0xFF, new Uint8Array(editBuffer.getCharacter(16)));
          pcgData.setCharacter((charCode + 17) & 0xFF, new Uint8Array(editBuffer.getCharacter(17)));
        }
        break;
    }

    return {
      success: true,
      message: `Set CHR: $${charCode.toString(16).toUpperCase().padStart(2, '0')}`,
      needsSave: true,
      needsRender: true
    };
  }

  /**
   * LOAD CHR.処理
   * @param source 'rom' または 'ram'
   * @param charCode 読み込む文字コード
   * @param getFontData ROMフォントデータ取得関数（source='rom'時に必要）
   */
  loadChr(
    source: 'rom' | 'ram',
    charCode: number,
    getFontData?: (code: number) => Uint8Array
  ): CommandResult {
    const { pcgData, editBuffer, editorState } = this.ctx;
    const srcName = source === 'rom' ? 'ROMCG' : 'RAMCG';

    const charX = Math.floor(editorState.cursorX / 8);
    const charY = Math.floor(editorState.cursorY / 8);

    editorState.setEditChrCode(charCode);

    const loadCharacter = (srcCode: number, dstBufferCode: number) => {
      if (source === 'rom' && getFontData) {
        const data = getFontData(srcCode);
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 8; x++) {
            const isSet = (data[y] & (0x80 >> x)) !== 0;
            editBuffer.setPixel(dstBufferCode, x, y, isSet ? X1_COLORS.WHITE : X1_COLORS.BLACK);
          }
        }
      } else {
        const srcData = pcgData.getCharacter(srcCode);
        editBuffer.setCharacter(dstBufferCode, new Uint8Array(srcData));
      }
    };

    switch (editorState.editMode) {
      case EditMode.SEPARATE:
        loadCharacter(charCode, charX + charY * 16);
        break;
      case EditMode.VERTICAL:
        loadCharacter(charCode, charX);
        loadCharacter((charCode + 16) & 0xFF, charX + 16);
        break;
      case EditMode.HORIZONTAL:
        loadCharacter(charCode, charY * 16);
        loadCharacter((charCode + 1) & 0xFF, charY * 16 + 1);
        break;
      case EditMode.ALL:
        loadCharacter(charCode, 0);
        loadCharacter((charCode + 1) & 0xFF, 1);
        loadCharacter((charCode + 16) & 0xFF, 16);
        loadCharacter((charCode + 17) & 0xFF, 17);
        break;
    }

    return {
      success: true,
      message: `Load ${srcName}: $${charCode.toString(16).toUpperCase().padStart(2, '0')}`,
      needsSave: true
    };
  }

  /** ROTATION処理 */
  rotation(rotationType: RotationType): CommandResult {
    const { editBuffer, editorState } = this.ctx;

    const success = EditBufferTransform.apply(
      editBuffer,
      editorState.editMode,
      editorState.cursorX,
      editorState.cursorY,
      rotationType
    );

    if (!success) {
      return { success: false, message: 'Invalid for this mode' };
    }

    return {
      success: true,
      message: EditBufferTransform.getTransformName(rotationType),
      needsSave: true
    };
  }

  /** CLEAR処理 */
  clear(): CommandResult {
    const { editBuffer, editorState } = this.ctx;
    const { charX, charY } = getCursorCharPos(editorState.cursorX, editorState.cursorY);
    const { charCodes } = getEditArea(editorState.editMode, charX, charY);

    for (const charCode of charCodes) {
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          editBuffer.setPixel(charCode, x, y, X1_COLORS.BLACK);
        }
      }
    }

    return { success: true, message: 'Cleared', needsSave: true };
  }

  /** COLOR CHANGE処理 */
  colorChange(colorMap: number[]): CommandResult {
    const { editBuffer, editorState } = this.ctx;
    const { charX, charY } = getCursorCharPos(editorState.cursorX, editorState.cursorY);
    const { charCodes } = getEditArea(editorState.editMode, charX, charY);

    for (const charCode of charCodes) {
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const currentColor = editBuffer.getPixel(charCode, x, y);
          const newColor = colorMap[currentColor] as X1Color;
          if (newColor !== currentColor) {
            editBuffer.setPixel(charCode, x, y, newColor);
          }
        }
      }
    }

    return { success: true, message: 'Color changed', needsSave: true };
  }

  /** TRANSFER処理 */
  transfer(start: number, end: number, target: number): CommandResult {
    const { pcgData } = this.ctx;
    const count = end - start + 1;

    if (count <= 0 || target + count > 256) {
      return { success: false, message: 'Invalid range' };
    }

    for (let i = 0; i < count; i++) {
      const srcData = pcgData.getCharacter(start + i);
      pcgData.setCharacter(target + i, new Uint8Array(srcData));
    }

    const msg = `Transfer: $${start.toString(16).toUpperCase().padStart(2, '0')}-$${end.toString(16).toUpperCase().padStart(2, '0')} -> $${target.toString(16).toUpperCase().padStart(2, '0')}`;
    return { success: true, message: msg, needsSave: true, needsRender: true };
  }
}
