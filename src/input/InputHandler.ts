/**
 * 統合入力ハンドラ
 * キーボード、マウス、パネル入力を統合管理
 */

import {
  InputMode,
  InputDeviceMode,
  FileFormat,
  ColorReduceMode,
  RotationType,
  BasSaveFormat,
  InputEvent,
  InputEventCallback
} from './InputEventTypes';
import { KeyboardInputHandler } from './KeyboardInputHandler';
import { MouseInputHandler } from './MouseInputHandler';
import { InputPanelManager } from './InputPanelManager';

// 型の再エクスポート（既存コードとの互換性のため）
export type {
  InputMode,
  InputDeviceMode,
  FileFormat,
  ColorReduceMode,
  RotationType,
  BasSaveFormat,
  InputEvent,
  InputEventCallback
};

/**
 * 統合入力ハンドラクラス
 */
export class InputHandler {
  /** 現在の入力モード */
  private mode: InputMode = 'edit';

  /** イベントコールバック */
  private callbacks: Set<InputEventCallback> = new Set();

  /** 入力デバイスモード（キーボード/マウス） */
  private inputDeviceMode: InputDeviceMode = 'keyboard';

  /** パネルマネージャ */
  private panelManager: InputPanelManager;

  /** キーボード入力ハンドラ */
  private keyboardHandler: KeyboardInputHandler;

  /** マウス入力ハンドラ */
  private mouseHandler: MouseInputHandler;

  constructor() {
    // パネルマネージャを初期化
    this.panelManager = new InputPanelManager(
      (event) => this.emit(event),
      (mode) => { this.mode = mode; }
    );

    // キーボードハンドラを初期化
    this.keyboardHandler = new KeyboardInputHandler(
      (event) => this.emit(event),
      () => this.mode,
      (mode) => { this.mode = mode; },
      () => this.inputDeviceMode,
      () => this.toggleInputDeviceMode(),
      this.panelManager
    );

    // マウスハンドラを初期化
    this.mouseHandler = new MouseInputHandler(
      (event) => this.emit(event),
      () => this.mode
    );

    // 各ハンドラをセットアップ
    this.panelManager.setup();
    this.keyboardHandler.setup();
    this.mouseHandler.setup();
  }

  /**
   * 入力デバイスモードをトグル
   */
  private toggleInputDeviceMode(): void {
    this.inputDeviceMode = this.inputDeviceMode === 'keyboard' ? 'mouse' : 'keyboard';
  }

  /**
   * 編集エリアの情報を設定（main.tsから呼び出す）
   */
  setEditorAreaInfo(offsetX: number, offsetY: number, dotSize: number, scale: number): void {
    this.mouseHandler.setEditorAreaInfo(offsetX, offsetY, dotSize, scale);
  }

  /**
   * 入力デバイスモードを取得
   */
  getInputDeviceMode(): InputDeviceMode {
    return this.inputDeviceMode;
  }

  /**
   * イベントコールバックを登録
   */
  onInput(callback: InputEventCallback): void {
    this.callbacks.add(callback);
  }

  /**
   * イベントコールバックを解除
   */
  offInput(callback: InputEventCallback): void {
    this.callbacks.delete(callback);
  }

  /**
   * イベントを発火
   */
  private emit(event: InputEvent): void {
    this.callbacks.forEach(cb => cb(event));
  }

  /**
   * 現在の入力モードを取得
   */
  getMode(): InputMode {
    return this.mode;
  }

  /**
   * 入力モードを設定
   */
  setMode(mode: InputMode): void {
    this.mode = mode;
  }

  /**
   * 指定したキーが押されているか
   */
  isKeyPressed(code: string): boolean {
    return this.keyboardHandler.isKeyPressed(code);
  }

  /**
   * Shiftキーが押されているか
   */
  isShiftPressed(): boolean {
    return this.keyboardHandler.isShiftPressed();
  }

  /**
   * リソースを解放
   */
  dispose(): void {
    this.callbacks.clear();
    this.keyboardHandler.dispose();
    this.mouseHandler.dispose();
    this.panelManager.dispose();
  }
}
