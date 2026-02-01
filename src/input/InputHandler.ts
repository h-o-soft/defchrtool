/**
 * 統合入力ハンドラ
 * X1 DEFCHR TOOL の入力モードを管理
 */

import { Direction, X1Color } from '../core/types';

/** 入力モード */
export type InputMode =
  | 'edit'      // 通常編集モード
  | 'editchr'   // EDIT CHR.（文字コード入力待ち）
  | 'setchr'    // SET CHR.（文字コード入力待ち）
  | 'menu';     // メニュー表示中

/** 入力イベントタイプ */
export type InputEventType =
  | 'cursor-move'
  | 'draw-dot'
  | 'color-select'
  | 'toggle-draw'
  | 'toggle-grid'
  | 'mode-change'
  | 'direction-change'
  | 'edit-chr'
  | 'set-chr'
  | 'load-chr'    // EDIT CHR.機能（ROMCG/RAMCGからロード）
  | 'home'
  | 'cancel';

/** 入力イベントデータ */
export interface InputEvent {
  type: InputEventType;
  data?: {
    direction?: Direction;
    color?: X1Color;
    charCode?: number;
    x?: number;
    y?: number;
    fast?: boolean;  // 高速移動（Shift+矢印）
    source?: 'rom' | 'ram';  // EDIT CHR.用（ROMCG/RAMCG）
  };
}

export type InputEventCallback = (event: InputEvent) => void;

/**
 * 統合入力ハンドラクラス
 */
export class InputHandler {
  private mode: InputMode = 'edit';
  private callbacks: Set<InputEventCallback> = new Set();
  private promptCallback: ((value: string | null) => void) | null = null;

  /** 現在押されているキー */
  private pressedKeys: Set<string> = new Set();

  /** 入力UI要素 */
  private inputArea: HTMLElement | null = null;
  private inputLabel: HTMLElement | null = null;
  private inputField: HTMLInputElement | null = null;

  constructor() {
    this.setupListeners();
    this.setupInputUI();
  }

  /**
   * 入力UIの初期化
   */
  private setupInputUI(): void {
    this.inputArea = document.getElementById('input-area');
    this.inputLabel = document.getElementById('input-label');
    this.inputField = document.getElementById('input-field') as HTMLInputElement;

    if (this.inputField) {
      // Enterで確定
      this.inputField.addEventListener('keydown', (e) => {
        if (e.code === 'Enter') {
          e.preventDefault();
          this.completeInput(this.inputField!.value);
        } else if (e.code === 'Escape') {
          e.preventDefault();
          this.completeInput(null);
        }
      });
    }
  }

  /**
   * 入力UIを表示
   */
  private showInputUI(label: string): void {
    if (this.inputArea && this.inputLabel && this.inputField) {
      this.inputLabel.textContent = label;
      this.inputField.value = '';
      this.inputArea.classList.add('visible');
      this.inputField.focus();
    }
  }

  /**
   * 入力UIを非表示
   */
  private hideInputUI(): void {
    if (this.inputArea && this.inputField) {
      this.inputArea.classList.remove('visible');
      this.inputField.blur();
    }
  }

  /**
   * 入力完了処理
   */
  private completeInput(value: string | null): void {
    this.hideInputUI();
    if (this.promptCallback) {
      this.promptCallback(value);
    }
  }

  /**
   * キーボードイベントリスナーを設定
   */
  private setupListeners(): void {
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    window.addEventListener('keyup', (e) => this.handleKeyUp(e));
  }

  /**
   * キーダウンイベント処理
   */
  private handleKeyDown(event: KeyboardEvent): void {
    // IME入力中は無視
    if (event.isComposing) return;

    // 入力欄にフォーカスがある場合は編集モードのキー処理をスキップ
    if (document.activeElement === this.inputField) {
      return;
    }

    // リピートは一部のキー（矢印キー）のみ許可
    const allowRepeat = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    if (event.repeat && !allowRepeat.includes(event.code)) return;

    this.pressedKeys.add(event.code);

    // 入力モードによって処理を分岐
    switch (this.mode) {
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
    const isShift = event.shiftKey;

    switch (event.code) {
      // カーソル移動
      case 'ArrowUp':
        event.preventDefault();
        this.emit({ type: 'cursor-move', data: { direction: Direction.UP, fast: isShift } });
        break;
      case 'ArrowDown':
        event.preventDefault();
        this.emit({ type: 'cursor-move', data: { direction: Direction.DOWN, fast: isShift } });
        break;
      case 'ArrowLeft':
        event.preventDefault();
        this.emit({ type: 'cursor-move', data: { direction: Direction.LEFT, fast: isShift } });
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.emit({ type: 'cursor-move', data: { direction: Direction.RIGHT, fast: isShift } });
        break;

      // 数字キー（色選択・描画）
      case 'Digit0':
      case 'Numpad0':
        event.preventDefault();
        this.emit({ type: 'draw-dot', data: { color: 0 as X1Color } });
        break;
      case 'Digit1':
      case 'Numpad1':
        event.preventDefault();
        this.emit({ type: 'draw-dot', data: { color: 1 as X1Color } });
        break;
      case 'Digit2':
      case 'Numpad2':
        event.preventDefault();
        this.emit({ type: 'draw-dot', data: { color: 2 as X1Color } });
        break;
      case 'Digit3':
      case 'Numpad3':
        event.preventDefault();
        this.emit({ type: 'draw-dot', data: { color: 3 as X1Color } });
        break;
      case 'Digit4':
      case 'Numpad4':
        event.preventDefault();
        this.emit({ type: 'draw-dot', data: { color: 4 as X1Color } });
        break;
      case 'Digit5':
      case 'Numpad5':
        event.preventDefault();
        this.emit({ type: 'draw-dot', data: { color: 5 as X1Color } });
        break;
      case 'Digit6':
      case 'Numpad6':
        event.preventDefault();
        this.emit({ type: 'draw-dot', data: { color: 6 as X1Color } });
        break;
      case 'Digit7':
      case 'Numpad7':
        event.preventDefault();
        this.emit({ type: 'draw-dot', data: { color: 7 as X1Color } });
        break;

      // Spaceキー: トグル描画
      case 'Space':
        event.preventDefault();
        this.emit({ type: 'toggle-draw' });
        break;

      // Homeキー: ホーム位置に移動
      case 'Home':
        event.preventDefault();
        this.emit({ type: 'home' });
        break;

      // Mキー: EDIT MODE切り替え（0〜3のモード選択）
      case 'KeyM':
        event.preventDefault();
        this.emit({ type: 'mode-change' });
        break;

      // Eキー: EDIT CHR.機能（ROMCG/RAMCG選択→文字コード入力）
      case 'KeyE':
        event.preventDefault();
        this.startEditChrInput();
        break;

      // Cキー: COLOR CHANGE（将来実装予定、現在は無効）
      // case 'KeyC':
      //   event.preventDefault();
      //   this.startCharCodeInput('editchr');
      //   break;

      // Sキー: SET CHR.
      case 'KeyS':
        event.preventDefault();
        this.startCharCodeInput('setchr');
        break;

      // Dキー: DIRECTION切り替え
      case 'KeyD':
        event.preventDefault();
        this.emit({ type: 'direction-change' });
        break;

      // Gキー: GRID表示切り替え
      case 'KeyG':
        event.preventDefault();
        this.emit({ type: 'toggle-grid' });
        break;

      // Escapeキー: キャンセル
      case 'Escape':
        event.preventDefault();
        this.emit({ type: 'cancel' });
        break;
    }
  }

  /**
   * 文字コード入力モードの開始
   */
  private startCharCodeInput(mode: 'editchr' | 'setchr'): void {
    this.mode = mode;

    // プロンプト表示用のラベル
    const promptMessage = mode === 'editchr'
      ? 'Edit character code=&h'
      : 'Set character code=&h';

    // 入力完了時のコールバック
    this.promptCallback = (value: string | null) => {
      this.mode = 'edit';
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

    // カスタム入力UIを表示
    this.showInputUI(promptMessage);
  }

  /**
   * EDIT CHR.機能の入力開始
   * 1. ROMCG(0) または RAMCG(1) を選択
   * 2. 文字コードを入力
   */
  private startEditChrInput(): void {
    this.mode = 'editchr';

    // Step 1: ROMCG/RAMCG選択
    this.promptCallback = (sourceInput: string | null) => {
      if (sourceInput === null || sourceInput.trim() === '') {
        this.mode = 'edit';
        this.promptCallback = null;
        this.emit({ type: 'cancel' });
        return;
      }

      const sourceNum = parseInt(sourceInput, 10);
      if (sourceNum !== 0 && sourceNum !== 1) {
        this.mode = 'edit';
        this.promptCallback = null;
        this.emit({ type: 'cancel' });
        return;
      }

      const source: 'rom' | 'ram' = sourceNum === 0 ? 'rom' : 'ram';

      // Step 2: 文字コード入力
      this.promptCallback = (charCodeInput: string | null) => {
        this.mode = 'edit';
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

        // イベント発火
        this.emit({ type: 'load-chr', data: { source, charCode } });
      };

      // Step 2のUI表示
      this.showInputUI('Character code=&h');
    };

    // Step 1のUI表示
    this.showInputUI('0..ROMCG  1..RAMCG');
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
      this.mode = 'edit';
      this.emit({ type: 'cancel' });
    }
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
    this.callbacks.clear();
    this.pressedKeys.clear();
  }
}
