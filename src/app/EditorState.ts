/**
 * エディタ状態管理
 * カーソル位置、編集モード、色などの状態を管理
 */

import { EditMode, Direction, X1Color, X1_COLORS } from '../core/types';

/** 保存用の状態データ（LocalStorageServiceと互換） */
export interface EditorStateSaveData {
  editMode: EditMode;
  cursorPosition: { x: number; y: number };
  currentColor: X1Color;
  lastDirection: Direction;
  currentCharCode: number;
  editChrCode: number;
  gridVisible: boolean;
}

/**
 * エディタ状態管理クラス
 * - 状態の変更は必ずメソッド経由
 * - getter はプリミティブ値を返す
 */
export class EditorState {
  private _editMode: EditMode = EditMode.ALL;
  private _cursorX: number = 0;
  private _cursorY: number = 0;
  private _currentColor: X1Color = X1_COLORS.WHITE;
  private _lastDirection: Direction = Direction.RIGHT;
  private _currentCharCode: number = 0;
  private _editChrCode: number = 0;
  private _gridVisible: boolean = false;

  // === Getters（プリミティブ値のみ） ===
  get editMode(): EditMode { return this._editMode; }
  get cursorX(): number { return this._cursorX; }
  get cursorY(): number { return this._cursorY; }
  get currentColor(): X1Color { return this._currentColor; }
  get lastDirection(): Direction { return this._lastDirection; }
  get currentCharCode(): number { return this._currentCharCode; }
  get editChrCode(): number { return this._editChrCode; }
  get gridVisible(): boolean { return this._gridVisible; }

  // === カーソル操作メソッド ===

  /** カーソルを移動（境界チェック付き） */
  moveCursor(direction: Direction, fast: boolean): void {
    const step = fast ? 2 : 1;
    const maxPos = 15;

    switch (direction) {
      case Direction.UP:
        this._cursorY = Math.max(0, this._cursorY - step);
        break;
      case Direction.DOWN:
        this._cursorY = Math.min(maxPos, this._cursorY + step);
        break;
      case Direction.LEFT:
        this._cursorX = Math.max(0, this._cursorX - step);
        break;
      case Direction.RIGHT:
        this._cursorX = Math.min(maxPos, this._cursorX + step);
        break;
    }
    this._lastDirection = direction;
  }

  /** カーソルを直接設定 */
  setCursor(x: number, y: number): void {
    this._cursorX = Math.max(0, Math.min(15, x));
    this._cursorY = Math.max(0, Math.min(15, y));
  }

  /** カーソルをホーム位置に移動 */
  cursorHome(): void {
    this._cursorX = 0;
    this._cursorY = 0;
  }

  /** カーソルを最後の移動方向に進める */
  advanceCursor(): void {
    const maxPos = 15;
    switch (this._lastDirection) {
      case Direction.UP:
        if (this._cursorY > 0) this._cursorY--;
        break;
      case Direction.DOWN:
        if (this._cursorY < maxPos) this._cursorY++;
        break;
      case Direction.LEFT:
        if (this._cursorX > 0) this._cursorX--;
        break;
      case Direction.RIGHT:
        if (this._cursorX < maxPos) this._cursorX++;
        break;
    }
  }

  // === 状態変更メソッド ===

  setColor(color: X1Color): void {
    this._currentColor = color;
  }

  setCurrentCharCode(code: number): void {
    this._currentCharCode = code;
  }

  setEditChrCode(code: number): void {
    this._editChrCode = code;
  }

  setGridVisible(visible: boolean): void {
    this._gridVisible = visible;
  }

  /** 編集モードを次に切り替え */
  cycleEditMode(): EditMode {
    const modes = [EditMode.SEPARATE, EditMode.VERTICAL, EditMode.HORIZONTAL, EditMode.ALL];
    const currentIndex = modes.indexOf(this._editMode);
    this._editMode = modes[(currentIndex + 1) % modes.length];
    return this._editMode;
  }

  /** 方向を次に切り替え */
  cycleDirection(): Direction {
    const directions = [Direction.RIGHT, Direction.DOWN, Direction.LEFT, Direction.UP];
    const currentIndex = directions.indexOf(this._lastDirection);
    this._lastDirection = directions[(currentIndex + 1) % directions.length];
    return this._lastDirection;
  }

  /** グリッド表示を切り替え */
  toggleGrid(): boolean {
    this._gridVisible = !this._gridVisible;
    return this._gridVisible;
  }

  // === シリアライズ ===

  toSaveData(): EditorStateSaveData {
    return {
      editMode: this._editMode,
      cursorPosition: { x: this._cursorX, y: this._cursorY },
      currentColor: this._currentColor,
      lastDirection: this._lastDirection,
      currentCharCode: this._currentCharCode,
      editChrCode: this._editChrCode,
      gridVisible: this._gridVisible
    };
  }

  /**
   * 保存データから状態を復元
   * - 各フィールドにデフォルト値を適用（後方互換性維持）
   */
  fromSaveData(data: Partial<EditorStateSaveData>): void {
    this._editMode = data.editMode ?? EditMode.ALL;
    this._cursorX = data.cursorPosition?.x ?? 0;
    this._cursorY = data.cursorPosition?.y ?? 0;
    this._currentColor = data.currentColor ?? X1_COLORS.WHITE;
    this._lastDirection = data.lastDirection ?? Direction.RIGHT;
    this._currentCharCode = data.currentCharCode ?? 0;
    this._editChrCode = data.editChrCode ?? 0;
    this._gridVisible = data.gridVisible ?? true;
  }
}
