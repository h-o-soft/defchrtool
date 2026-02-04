/**
 * マウス入力ハンドラ
 * マウスによる描画操作を処理
 */

import { InputEvent, InputMode } from './InputEventTypes';

/** 編集エリアの情報（座標計算用） */
export interface EditorAreaInfo {
  offsetX: number;
  offsetY: number;
  dotSize: number;
  scale: number;
}

/** マウスドット座標 */
export interface MouseDotPosition {
  dotX: number;
  dotY: number;
}

/** イベント発火用コールバック */
type EmitCallback = (event: InputEvent) => void;

/** モード取得用コールバック */
type GetModeCallback = () => InputMode;

/**
 * マウス入力ハンドラクラス
 */
export class MouseInputHandler {
  /** Canvas要素 */
  private canvas: HTMLCanvasElement | null = null;

  /** マウス描画中フラグ */
  private isMouseDrawing: boolean = false;

  /** 編集エリア情報 */
  private editorAreaInfo: EditorAreaInfo = {
    offsetX: 8,
    offsetY: 16,
    dotSize: 8,
    scale: 2
  };

  /** イベント発火コールバック */
  private emit: EmitCallback;

  /** モード取得コールバック */
  private getMode: GetModeCallback;

  /** バインドされたイベントハンドラ（removeEventListener用） */
  private boundHandleMouseDown: (e: MouseEvent) => void;
  private boundHandleMouseMove: (e: MouseEvent) => void;
  private boundHandleMouseUp: () => void;

  constructor(emit: EmitCallback, getMode: GetModeCallback) {
    this.emit = emit;
    this.getMode = getMode;

    // バインドされたハンドラを作成（removeEventListener用）
    this.boundHandleMouseDown = (e: MouseEvent) => this.handleMouseDown(e);
    this.boundHandleMouseMove = (e: MouseEvent) => this.handleMouseMove(e);
    this.boundHandleMouseUp = () => this.handleMouseUp();
  }

  /**
   * マウスイベントリスナーを設定
   */
  setup(): void {
    this.canvas = document.getElementById('main-canvas') as HTMLCanvasElement;
    if (!this.canvas) return;

    this.canvas.addEventListener('mousedown', this.boundHandleMouseDown);
    this.canvas.addEventListener('mousemove', this.boundHandleMouseMove);
    this.canvas.addEventListener('mouseup', this.boundHandleMouseUp);
    this.canvas.addEventListener('mouseleave', this.boundHandleMouseUp);
  }

  /**
   * 編集エリアの情報を設定
   */
  setEditorAreaInfo(offsetX: number, offsetY: number, dotSize: number, scale: number): void {
    this.editorAreaInfo = { offsetX, offsetY, dotSize, scale };
  }

  /**
   * マウス座標からドット座標を計算
   * @returns ドット座標（0-15）、範囲外の場合はnull
   */
  private getMouseDotPosition(e: MouseEvent): MouseDotPosition | null {
    if (!this.canvas) return null;

    const rect = this.canvas.getBoundingClientRect();
    const { offsetX, offsetY, dotSize, scale } = this.editorAreaInfo;

    // キャンバス上の座標を計算（スケールを考慮）
    const canvasX = (e.clientX - rect.left) / scale;
    const canvasY = (e.clientY - rect.top) / scale;

    // 編集エリア内の座標を計算
    const localX = canvasX - offsetX;
    const localY = canvasY - offsetY;

    // ドット座標に変換
    const dotX = Math.floor(localX / dotSize);
    const dotY = Math.floor(localY / dotSize);

    // 範囲チェック（0-15）
    if (dotX < 0 || dotX > 15 || dotY < 0 || dotY > 15) {
      return null;
    }

    return { dotX, dotY };
  }

  /**
   * マウスダウンイベント処理
   */
  private handleMouseDown(e: MouseEvent): void {
    // メニューモードやパネル表示中は無視
    if (this.getMode() !== 'edit') return;

    const pos = this.getMouseDotPosition(e);
    if (pos) {
      this.isMouseDrawing = true;
      this.emit({ type: 'mouse-draw', data: { mousePos: pos } });
    }
  }

  /**
   * マウスムーブイベント処理
   */
  private handleMouseMove(e: MouseEvent): void {
    if (!this.isMouseDrawing) return;
    if (this.getMode() !== 'edit') return;

    const pos = this.getMouseDotPosition(e);
    if (pos) {
      this.emit({ type: 'mouse-draw', data: { mousePos: pos } });
    }
  }

  /**
   * マウスアップイベント処理
   */
  private handleMouseUp(): void {
    this.isMouseDrawing = false;
  }

  /**
   * マウス描画中かどうか
   */
  isDrawing(): boolean {
    return this.isMouseDrawing;
  }

  /**
   * リソースを解放
   */
  dispose(): void {
    if (this.canvas) {
      this.canvas.removeEventListener('mousedown', this.boundHandleMouseDown);
      this.canvas.removeEventListener('mousemove', this.boundHandleMouseMove);
      this.canvas.removeEventListener('mouseup', this.boundHandleMouseUp);
      this.canvas.removeEventListener('mouseleave', this.boundHandleMouseUp);
    }
    this.isMouseDrawing = false;
    this.canvas = null;
  }
}
