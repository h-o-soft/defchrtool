/**
 * ローカルストレージサービス
 * PCGデータ、編集バッファ、エディタ状態を保存・復元する
 */

import { STORAGE_KEYS, AUTO_SAVE_DELAY } from '../core/constants';
import { EditMode, Direction, X1Color, X1_COLORS } from '../core/types';
import { uint8ArrayToBase64, base64ToUint8Array } from './Base64Util';

/** 保存されるエディタ状態 */
export interface SavedEditorState {
  editMode: EditMode;
  cursorPosition: { x: number; y: number };
  currentColor: X1Color;
  lastDirection: Direction;
  currentCharCode: number;
  editChrCode: number;
  gridVisible: boolean;
}

/** 保存データの完全な状態 */
export interface SavedState {
  pcgData: Uint8Array;
  editBuffer: Uint8Array;
  editorState: SavedEditorState;
  fontData?: Uint8Array;
}

/**
 * ローカルストレージ操作クラス
 */
export class LocalStorageService {
  private saveTimeout: number | null = null;

  /**
   * データを即座に保存
   */
  save(state: SavedState): void {
    try {
      // PCGデータをBase64エンコードして保存
      const pcgDataBase64 = uint8ArrayToBase64(state.pcgData);
      localStorage.setItem(STORAGE_KEYS.PCG_DATA, pcgDataBase64);

      // 編集バッファをBase64エンコードして保存
      const editBufferBase64 = uint8ArrayToBase64(state.editBuffer);
      localStorage.setItem(STORAGE_KEYS.EDIT_BUFFER, editBufferBase64);

      // エディタ状態をJSONで保存
      localStorage.setItem(STORAGE_KEYS.EDITOR_STATE, JSON.stringify(state.editorState));

      // フォントデータを保存（存在する場合のみ）
      if (state.fontData) {
        const fontDataBase64 = uint8ArrayToBase64(state.fontData);
        localStorage.setItem(STORAGE_KEYS.FONT_DATA, fontDataBase64);
      }

      console.log('[LocalStorageService] Data saved');
    } catch (e) {
      console.error('[LocalStorageService] Failed to save:', e);
    }
  }

  /**
   * データを読み込み
   * @returns 保存されたデータ、または null（データがない場合）
   */
  load(): SavedState | null {
    try {
      const pcgDataBase64 = localStorage.getItem(STORAGE_KEYS.PCG_DATA);
      const editBufferBase64 = localStorage.getItem(STORAGE_KEYS.EDIT_BUFFER);
      const stateJson = localStorage.getItem(STORAGE_KEYS.EDITOR_STATE);

      // どれか一つでもなければ読み込み失敗
      if (!pcgDataBase64 || !editBufferBase64 || !stateJson) {
        console.log('[LocalStorageService] No saved data found');
        return null;
      }

      // PCGデータを復元
      const pcgData = base64ToUint8Array(pcgDataBase64);

      // 編集バッファを復元
      const editBuffer = base64ToUint8Array(editBufferBase64);

      // エディタ状態を復元（デフォルト値でマージ）
      const savedState = JSON.parse(stateJson);
      const editorState: SavedEditorState = {
        editMode: savedState.editMode ?? EditMode.SEPARATE,
        cursorPosition: savedState.cursorPosition ?? { x: 0, y: 0 },
        currentColor: savedState.currentColor ?? X1_COLORS.WHITE,
        lastDirection: savedState.lastDirection ?? Direction.RIGHT,
        currentCharCode: savedState.currentCharCode ?? 0,
        editChrCode: savedState.editChrCode ?? 0,
        gridVisible: savedState.gridVisible ?? true
      };

      // フォントデータを復元（存在する場合のみ）
      let fontData: Uint8Array | undefined;
      const fontDataBase64 = localStorage.getItem(STORAGE_KEYS.FONT_DATA);
      if (fontDataBase64) {
        const fontDataArray = base64ToUint8Array(fontDataBase64);
        if (fontDataArray.length === 2048) {
          fontData = fontDataArray;
        }
      }

      console.log('[LocalStorageService] Data loaded');
      return { pcgData, editBuffer, editorState, fontData };
    } catch (e) {
      console.error('[LocalStorageService] Failed to load:', e);
      return null;
    }
  }

  /**
   * 遅延保存をスケジュール（デバウンス）
   */
  scheduleSave(state: SavedState): void {
    if (this.saveTimeout !== null) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = window.setTimeout(() => {
      this.save(state);
      this.saveTimeout = null;
    }, AUTO_SAVE_DELAY);
  }

  /**
   * 保留中の保存をキャンセル
   */
  cancelPendingSave(): void {
    if (this.saveTimeout !== null) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
  }

  /**
   * すべてのデータをクリア
   */
  clear(): void {
    localStorage.removeItem(STORAGE_KEYS.PCG_DATA);
    localStorage.removeItem(STORAGE_KEYS.EDIT_BUFFER);
    localStorage.removeItem(STORAGE_KEYS.EDITOR_STATE);
    localStorage.removeItem(STORAGE_KEYS.FONT_DATA);
    console.log('[LocalStorageService] Data cleared');
  }
}
