/**
 * キーボード入力ハンドラ
 * キーボードによる操作を処理
 */

import { X1Color } from '../core/types';
import { InputEvent, InputMode, InputDeviceMode } from './InputEventTypes';
import { InputPanelManager } from './InputPanelManager';
import { getActionFromKeyCode, isRepeatAllowed, Modifiers } from './KeyBindings';

/** イベント発火用コールバック */
type EmitCallback = (event: InputEvent) => void;

/** モード取得用コールバック */
type GetModeCallback = () => InputMode;

/** モード設定用コールバック */
type SetModeCallback = (mode: InputMode) => void;

/** 入力デバイスモード取得用コールバック */
type GetInputDeviceModeCallback = () => InputDeviceMode;

/** 入力デバイスモードトグル用コールバック */
type ToggleInputDeviceModeCallback = () => void;

/**
 * キーボード入力ハンドラクラス
 */
export class KeyboardInputHandler {
  /** 現在押されているキー */
  private pressedKeys: Set<string> = new Set();

  /** イベント発火コールバック */
  private emit: EmitCallback;

  /** モード取得コールバック */
  private getMode: GetModeCallback;

  /** モード設定コールバック */
  private setMode: SetModeCallback;

  /** 入力デバイスモード取得コールバック */
  private getInputDeviceMode: GetInputDeviceModeCallback;

  /** 入力デバイスモードトグルコールバック */
  private toggleInputDeviceMode: ToggleInputDeviceModeCallback;

  /** パネルマネージャ */
  private panelManager: InputPanelManager;

  /** プロンプトコールバック */
  private promptCallback: ((value: string | null) => void) | null = null;

  constructor(
    emit: EmitCallback,
    getMode: GetModeCallback,
    setMode: SetModeCallback,
    getInputDeviceMode: GetInputDeviceModeCallback,
    toggleInputDeviceMode: ToggleInputDeviceModeCallback,
    panelManager: InputPanelManager
  ) {
    this.emit = emit;
    this.getMode = getMode;
    this.setMode = setMode;
    this.getInputDeviceMode = getInputDeviceMode;
    this.toggleInputDeviceMode = toggleInputDeviceMode;
    this.panelManager = panelManager;
  }

  /**
   * キーボードイベントリスナーを設定
   */
  setup(): void {
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    window.addEventListener('keyup', (e) => this.handleKeyUp(e));
  }

  /**
   * キーダウンイベント処理
   */
  private handleKeyDown(event: KeyboardEvent): void {
    // IME入力中は無視
    if (event.isComposing) return;

    // CLRパネル表示中の処理
    if (this.panelManager.isClearPanelVisible()) {
      if (event.code === 'Enter') {
        event.preventDefault();
        this.panelManager.completeClear();
      } else if (event.code === 'Escape') {
        event.preventDefault();
        this.panelManager.cancelClear();
      }
      return;
    }

    // PROGRAMMINGパネル表示中の処理
    if (this.panelManager.isProgrammingPanelVisible()) {
      if (event.code === 'Escape') {
        event.preventDefault();
        this.panelManager.cancelProgramming();
      }
      return;
    }

    // COLOR CHANGEパネル表示中の処理
    if (this.panelManager.isColorChangePanelVisible()) {
      if (event.code === 'Escape') {
        event.preventDefault();
        this.panelManager.cancelColorChange();
      }
      return;
    }

    // 入力欄にフォーカスがある場合は編集モードのキー処理をスキップ
    if (this.panelManager.hasActiveInput()) {
      return;
    }

    // リピートは一部のキーのみ許可
    if (event.repeat && !isRepeatAllowed(event.code)) return;

    this.pressedKeys.add(event.code);

    // 入力モードによって処理を分岐
    switch (this.getMode()) {
      case 'edit':
        this.handleEditMode(event);
        break;
      case 'editchr':
      case 'setchr':
        this.handleCharCodeInput(event);
        break;
      case 'menu':
        this.handleMenuMode(event);
        break;
    }
  }

  /**
   * キーアップイベント処理
   */
  private handleKeyUp(event: KeyboardEvent): void {
    this.pressedKeys.delete(event.code);
  }

  /**
   * 通常編集モードのキー処理
   */
  private handleEditMode(event: KeyboardEvent): void {
    const modifiers: Modifiers = {
      shift: event.shiftKey,
      ctrl: event.ctrlKey || event.metaKey,
      alt: event.altKey
    };

    const keyAction = getActionFromKeyCode(event.code, modifiers);
    if (!keyAction) return;

    event.preventDefault();

    switch (keyAction.action) {
      case 'cursor-move':
        this.emit({
          type: 'cursor-move',
          data: { direction: keyAction.direction, fast: keyAction.fast }
        });
        break;

      case 'draw-color':
        this.emitColorKey(keyAction.color);
        break;

      case 'toggle-draw':
        this.emit({ type: 'toggle-draw' });
        break;

      case 'home':
        this.emit({ type: 'home' });
        break;

      case 'mode-change':
        this.emit({ type: 'mode-change' });
        break;

      case 'edit-chr':
        this.startEditChrInput();
        break;

      case 'color-change':
        this.startColorChangeInput();
        break;

      case 'set-chr':
        this.startCharCodeInput('setchr');
        break;

      case 'direction-change':
        this.emit({ type: 'direction-change' });
        break;

      case 'toggle-grid':
        this.emit({ type: 'toggle-grid' });
        break;

      case 'rotation':
        this.startRotationInput();
        break;

      case 'transfer':
        this.startTransferInput();
        break;

      case 'programming':
        this.startProgrammingInput();
        break;

      case 'toggle-input-mode':
        this.toggleInputDeviceMode();
        this.emit({ type: 'toggle-input-mode' });
        break;

      case 'toggle-width':
        this.emit({ type: 'toggle-width' });
        break;

      case 'load-font':
        this.emit({ type: 'load-font' });
        break;

      case 'cancel':
        this.emit({ type: 'cancel' });
        break;

      case 'clear':
        this.startClearInput();
        break;
    }
  }

  /**
   * 数字キー押下時の処理（モードによって動作を変える）
   */
  private emitColorKey(color: X1Color): void {
    if (this.getInputDeviceMode() === 'keyboard') {
      // キーボードモード: 描画
      this.emit({ type: 'draw-dot', data: { color } });
    } else {
      // マウスモード: 色選択のみ
      this.emit({ type: 'color-select', data: { color } });
    }
  }

  /**
   * 文字コード入力モードのキー処理
   */
  private handleCharCodeInput(event: KeyboardEvent): void {
    // Escapeでキャンセル
    if (event.code === 'Escape') {
      event.preventDefault();
      if (this.promptCallback) {
        this.promptCallback(null);
      }
      return;
    }
    // プロンプトが表示されている場合はブラウザに任せる
  }

  /**
   * メニューモードのキー処理
   */
  private handleMenuMode(event: KeyboardEvent): void {
    if (event.code === 'Escape') {
      event.preventDefault();
      this.setMode('edit');
      this.emit({ type: 'cancel' });
    }
  }

  // ==================== 入力開始メソッド ====================

  /**
   * 文字コード入力モードの開始
   */
  private startCharCodeInput(mode: 'editchr' | 'setchr'): void {
    this.setMode(mode);

    const promptMessage = mode === 'editchr'
      ? 'Edit character code=&h'
      : 'Set character code=&h';

    this.promptCallback = (value: string | null) => {
      this.setMode('edit');
      this.promptCallback = null;

      if (value !== null && value.trim() !== '') {
        const charCode = parseInt(value, 16);
        if (!isNaN(charCode) && charCode >= 0 && charCode <= 255) {
          if (mode === 'editchr') {
            this.emit({ type: 'edit-chr', data: { charCode } });
          } else {
            this.emit({ type: 'set-chr', data: { charCode } });
          }
        }
      } else {
        this.emit({ type: 'cancel' });
      }
    };

    this.panelManager.showInputUI(promptMessage, this.promptCallback);
  }

  /**
   * EDIT CHR.機能の入力開始
   */
  private startEditChrInput(): void {
    this.setMode('editchr');

    // Step 1: ROMCG/RAMCG選択
    this.promptCallback = (sourceInput: string | null) => {
      if (sourceInput === null || sourceInput.trim() === '') {
        this.setMode('edit');
        this.promptCallback = null;
        this.emit({ type: 'cancel' });
        return;
      }

      const sourceNum = parseInt(sourceInput, 10);
      if (sourceNum !== 0 && sourceNum !== 1) {
        this.setMode('edit');
        this.promptCallback = null;
        this.emit({ type: 'cancel' });
        return;
      }

      const source: 'rom' | 'ram' = sourceNum === 0 ? 'rom' : 'ram';

      // Step 2: 文字コード入力
      this.promptCallback = (charCodeInput: string | null) => {
        this.setMode('edit');
        this.promptCallback = null;

        if (charCodeInput === null || charCodeInput.trim() === '') {
          this.emit({ type: 'cancel' });
          return;
        }

        const charCode = parseInt(charCodeInput, 16);
        if (isNaN(charCode) || charCode < 0 || charCode > 255) {
          this.emit({ type: 'cancel' });
          return;
        }

        this.emit({ type: 'load-chr', data: { source, charCode } });
      };

      this.panelManager.showInputUI('Character code=&h', this.promptCallback);
    };

    this.panelManager.showInputUI('0..ROMCG  1..RAMCG', this.promptCallback);
  }

  /**
   * ROTATION機能の入力開始
   */
  private startRotationInput(): void {
    this.setMode('menu');
    this.panelManager.showRotationUI();
  }

  /**
   * TRANSFER機能の入力開始
   */
  private startTransferInput(): void {
    this.setMode('menu');
    this.panelManager.showTransferUI();
  }

  /**
   * PROGRAMMING機能の入力開始
   */
  private startProgrammingInput(): void {
    this.setMode('menu');
    this.panelManager.showProgrammingUI();
  }

  /**
   * COLOR CHANGE機能の入力開始
   */
  private startColorChangeInput(): void {
    this.setMode('menu');
    this.panelManager.showColorChangeUI();
  }

  /**
   * CLR機能の入力開始
   */
  private startClearInput(): void {
    this.setMode('menu');
    this.panelManager.showClearUI();
  }

  // ==================== ユーティリティ ====================

  /**
   * 指定したキーが押されているか
   */
  isKeyPressed(code: string): boolean {
    return this.pressedKeys.has(code);
  }

  /**
   * Shiftキーが押されているか
   */
  isShiftPressed(): boolean {
    return this.pressedKeys.has('ShiftLeft') || this.pressedKeys.has('ShiftRight');
  }

  /**
   * リソースを解放
   */
  dispose(): void {
    this.pressedKeys.clear();
    this.promptCallback = null;
  }
}
