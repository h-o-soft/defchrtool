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
  | 'rotation'    // ROTATION機能
  | 'transfer'    // TRANSFER機能
  | 'clear'       // CLR機能（編集領域クリア）
  | 'color-change' // COLOR CHANGE機能
  | 'toggle-input-mode' // キーボード/マウスモード切り替え
  | 'mouse-draw'  // マウスで描画
  | 'file-save'   // ファイル保存
  | 'file-load'   // ファイル読み込み
  | 'toggle-width' // WIDTH 40/80切り替え
  | 'load-font'   // フォント読み込み（隠し機能）
  | 'home'
  | 'cancel';

/** 入力モード（キーボード/マウス） */
export type InputDeviceMode = 'keyboard' | 'mouse';

/** ファイルフォーマット */
export type FileFormat = 'image' | 'bin' | 'bin3' | 'bas';

/** 減色モード */
export type ColorReduceMode = 'none' | 'reduce' | 'dither' | 'edfs' | 'retro';

/** ROTATIONの種類 */
export type RotationType =
  | 'right'    // 0: 右（左に移動）
  | 'left'     // 1: 左（右に移動）
  | 'up'       // 2: 上に移動
  | 'down'     // 3: 下に移動
  | 'rot90'    // 4: 90度反時計回り
  | 'rot180'   // 5: 180度回転
  | 'flipH'    // 6: 上下フリップ
  | 'flipV';   // 7: 左右フリップ

/** BAS保存形式 */
export type BasSaveFormat = 'asc' | 'bin';

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
    rotationType?: RotationType;  // ROTATION用
    transfer?: { start: number; end: number; target: number };  // TRANSFER用
    file?: { format: FileFormat; start: number; end: number; basLoadMode?: 'start' | 'original'; reduceMode?: ColorReduceMode; basFormat?: BasSaveFormat };  // ファイル保存/読み込み用
    colorMap?: number[];  // COLOR CHANGE用（8要素の配列、各色の変換先）
    mousePos?: { dotX: number; dotY: number };  // マウス描画用（ドット座標）
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

  /** ROTATION UI要素 */
  private rotationArea: HTMLElement | null = null;
  private rotationField: HTMLInputElement | null = null;

  /** TRANSFER UI要素 */
  private transferArea: HTMLElement | null = null;
  private transferStart: HTMLInputElement | null = null;
  private transferEnd: HTMLInputElement | null = null;
  private transferTarget: HTMLInputElement | null = null;

  /** CLR UI要素 */
  private clearArea: HTMLElement | null = null;

  /** COLOR CHANGE UI要素 */
  private colorChangeArea: HTMLElement | null = null;
  private colorInputs: HTMLInputElement[] = [];

  /** 入力デバイスモード（キーボード/マウス） */
  private inputDeviceMode: InputDeviceMode = 'keyboard';

  /** マウス描画中フラグ */
  private isMouseDrawing: boolean = false;

  /** Canvas要素（マウスイベント用） */
  private canvas: HTMLCanvasElement | null = null;

  /** 編集エリアのオフセットとサイズ（マウス座標計算用） */
  private editorAreaInfo: {
    offsetX: number;
    offsetY: number;
    dotSize: number;
    scale: number;
  } = { offsetX: 8, offsetY: 16, dotSize: 8, scale: 2 };

  /** PROGRAMMING UI要素 */
  private programmingArea: HTMLElement | null = null;
  private progFormatRadios: NodeListOf<HTMLInputElement> | null = null;
  private progModeRadios: NodeListOf<HTMLInputElement> | null = null;
  private progModeLoadLabel: HTMLElement | null = null;
  private progModeLoadRadio: HTMLInputElement | null = null;
  private progRangeRow: HTMLElement | null = null;
  private progStartField: HTMLInputElement | null = null;
  private progEndField: HTMLInputElement | null = null;
  private progExecBtn: HTMLButtonElement | null = null;
  private progCancelBtn: HTMLButtonElement | null = null;
  private basLoadModeRow: HTMLElement | null = null;
  private basSaveFormatRow: HTMLElement | null = null;
  private basSaveFormatRadios: NodeListOf<HTMLInputElement> | null = null;
  private imageReduceModeRow: HTMLElement | null = null;
  private imageReduceModeRadios: NodeListOf<HTMLInputElement> | null = null;
  private basLoadModeRadios: NodeListOf<HTMLInputElement> | null = null;

  constructor() {
    this.setupListeners();
    this.setupInputUI();
    this.setupMouseListeners();
  }

  /**
   * 入力UIの初期化
   */
  private setupInputUI(): void {
    // 通常入力エリア
    this.inputArea = document.getElementById('input-area');
    this.inputLabel = document.getElementById('input-label');
    this.inputField = document.getElementById('input-field') as HTMLInputElement;

    if (this.inputField) {
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

    // ROTATION エリア
    this.rotationArea = document.getElementById('rotation-area');
    this.rotationField = document.getElementById('rotation-field') as HTMLInputElement;

    if (this.rotationField) {
      this.rotationField.addEventListener('keydown', (e) => {
        if (e.code === 'Enter') {
          e.preventDefault();
          this.completeRotation(this.rotationField!.value);
        } else if (e.code === 'Escape') {
          e.preventDefault();
          this.completeRotation(null);
        }
      });
    }

    // TRANSFER エリア
    this.transferArea = document.getElementById('transfer-area');
    this.transferStart = document.getElementById('transfer-start') as HTMLInputElement;
    this.transferEnd = document.getElementById('transfer-end') as HTMLInputElement;
    this.transferTarget = document.getElementById('transfer-target') as HTMLInputElement;

    const transferFields = [this.transferStart, this.transferEnd, this.transferTarget];
    transferFields.forEach((field, index) => {
      if (field) {
        field.addEventListener('keydown', (e) => {
          if (e.code === 'Enter') {
            e.preventDefault();
            this.completeTransfer();
          } else if (e.code === 'Escape') {
            e.preventDefault();
            this.cancelTransfer();
          } else if (e.code === 'Tab' && !e.shiftKey && index < 2) {
            // 次のフィールドへ（デフォルト動作に任せる）
          }
        });
      }
    });

    // CLR エリア
    this.clearArea = document.getElementById('clear-area');

    // COLOR CHANGE エリア
    this.colorChangeArea = document.getElementById('color-change-area');
    this.colorInputs = [];
    for (let i = 0; i < 8; i++) {
      const input = document.getElementById(`color-${i}`) as HTMLInputElement;
      if (input) {
        this.colorInputs.push(input);
        input.addEventListener('keydown', (e) => {
          if (e.code === 'Enter') {
            e.preventDefault();
            this.completeColorChange();
          } else if (e.code === 'Escape') {
            e.preventDefault();
            this.cancelColorChange();
          }
        });
      }
    }

    // PROGRAMMING エリア
    this.programmingArea = document.getElementById('programming-area');
    this.progFormatRadios = document.querySelectorAll('input[name="prog-format"]') as NodeListOf<HTMLInputElement>;
    this.progModeRadios = document.querySelectorAll('input[name="prog-mode"]') as NodeListOf<HTMLInputElement>;
    this.progModeLoadLabel = document.getElementById('mode-load-label');
    this.progModeLoadRadio = document.getElementById('mode-load') as HTMLInputElement;
    this.progRangeRow = document.getElementById('range-row');
    this.progStartField = document.getElementById('prog-start') as HTMLInputElement;
    this.progEndField = document.getElementById('prog-end') as HTMLInputElement;
    this.progExecBtn = document.getElementById('prog-exec-btn') as HTMLButtonElement;
    this.progCancelBtn = document.getElementById('prog-cancel-btn') as HTMLButtonElement;
    this.basLoadModeRow = document.getElementById('bas-load-mode-row');
    this.basLoadModeRadios = document.querySelectorAll('input[name="bas-load-mode"]') as NodeListOf<HTMLInputElement>;
    this.basSaveFormatRow = document.getElementById('bas-save-format-row');
    this.basSaveFormatRadios = document.querySelectorAll('input[name="bas-save-format"]') as NodeListOf<HTMLInputElement>;
    this.imageReduceModeRow = document.getElementById('image-reduce-mode-row');
    this.imageReduceModeRadios = document.querySelectorAll('input[name="image-reduce-mode"]') as NodeListOf<HTMLInputElement>;

    // フォーマット変更時の処理
    this.progFormatRadios?.forEach(radio => {
      radio.addEventListener('change', () => this.updateProgrammingUI());
    });

    // モード変更時の処理
    this.progModeRadios?.forEach(radio => {
      radio.addEventListener('change', () => this.updateProgrammingUI());
    });

    // EXECボタン
    this.progExecBtn?.addEventListener('click', () => this.executeProgramming());

    // CANCELボタン
    this.progCancelBtn?.addEventListener('click', () => this.cancelProgramming());
  }

  /**
   * 通常入力UIを表示
   */
  private showInputUI(label: string): void {
    this.hideAllPanels();
    if (this.inputArea && this.inputLabel && this.inputField) {
      this.inputLabel.textContent = label;
      this.inputField.value = '';
      this.inputArea.classList.add('visible');
      this.inputField.focus();
    }
  }

  /**
   * ROTATION UIを表示
   */
  private showRotationUI(): void {
    this.hideAllPanels();
    if (this.rotationArea && this.rotationField) {
      this.rotationField.value = '';
      this.rotationArea.classList.add('visible');
      this.rotationField.focus();
    }
  }

  /**
   * TRANSFER UIを表示
   */
  private showTransferUI(): void {
    this.hideAllPanels();
    if (this.transferArea && this.transferStart && this.transferEnd && this.transferTarget) {
      this.transferStart.value = '';
      this.transferEnd.value = '';
      this.transferTarget.value = '';
      this.transferArea.classList.add('visible');
      this.transferStart.focus();
    }
  }

  /**
   * CLR UIを表示
   */
  private showClearUI(): void {
    this.hideAllPanels();
    if (this.clearArea) {
      this.clearArea.classList.add('visible');
      // フォーカスをドキュメントに戻してキーイベントを受け取れるようにする
      (document.activeElement as HTMLElement)?.blur();
    }
  }

  /**
   * 全パネルを非表示
   */
  private hideAllPanels(): void {
    if (this.inputArea) this.inputArea.classList.remove('visible');
    if (this.rotationArea) this.rotationArea.classList.remove('visible');
    if (this.transferArea) this.transferArea.classList.remove('visible');
    if (this.clearArea) this.clearArea.classList.remove('visible');
    if (this.colorChangeArea) this.colorChangeArea.classList.remove('visible');
    if (this.programmingArea) this.programmingArea.classList.remove('visible');
  }

  /**
   * COLOR CHANGE UIを表示
   */
  private showColorChangeUI(): void {
    this.hideAllPanels();
    if (this.colorChangeArea) {
      // デフォルト値にリセット（0→0, 1→1, ... 7→7）
      this.colorInputs.forEach((input, i) => {
        input.value = i.toString();
      });
      this.colorChangeArea.classList.add('visible');
      // 最初の入力欄にフォーカス
      this.colorInputs[0]?.focus();
      this.colorInputs[0]?.select();
    }
  }

  /**
   * COLOR CHANGE完了処理
   */
  private completeColorChange(): void {
    // 各入力欄の値を取得（0〜7のみ有効）
    const colorMap: number[] = [];
    for (let i = 0; i < 8; i++) {
      const val = parseInt(this.colorInputs[i]?.value || i.toString(), 10);
      if (isNaN(val) || val < 0 || val > 7) {
        colorMap.push(i); // 無効な値はそのまま
      } else {
        colorMap.push(val);
      }
    }

    this.hideAllPanels();
    this.mode = 'edit';
    this.emit({ type: 'color-change', data: { colorMap } });
  }

  /**
   * COLOR CHANGEキャンセル処理
   */
  private cancelColorChange(): void {
    this.hideAllPanels();
    this.mode = 'edit';
    this.emit({ type: 'cancel' });
  }

  /**
   * PROGRAMMING UIを表示
   */
  private showProgrammingUI(): void {
    this.hideAllPanels();
    if (this.programmingArea) {
      // デフォルト値にリセット
      this.progFormatRadios?.forEach(radio => {
        radio.checked = radio.value === 'png';
      });
      this.progModeRadios?.forEach(radio => {
        radio.checked = radio.value === 'save';
      });
      if (this.progStartField) this.progStartField.value = '00';
      if (this.progEndField) this.progEndField.value = 'FF';

      this.updateProgrammingUI();
      this.programmingArea.classList.add('visible');
    }
  }

  /**
   * PROGRAMMING UIの状態を更新
   */
  private updateProgrammingUI(): void {
    // 現在選択されているフォーマットを取得
    const selectedFormat = this.getSelectedFormat();

    // 現在選択されているモードを取得
    const selectedMode = this.getSelectedMode();

    // 全フォーマットでLOADを有効化（BASも含む）
    if (this.progModeLoadRadio && this.progModeLoadLabel) {
      this.progModeLoadRadio.disabled = false;
      this.progModeLoadLabel.classList.remove('disabled');
    }

    // IMAGEの場合、範囲入力を非表示
    if (this.progRangeRow) {
      if (selectedFormat === 'image') {
        this.progRangeRow.classList.add('hidden');
      } else {
        this.progRangeRow.classList.remove('hidden');
      }
    }

    // LOADモードの場合、終了コードを無効化（BAS以外）
    // BASのLOAD時はE欄は使わないが、範囲表示は残す
    if (this.progEndField) {
      if (selectedMode === 'load') {
        this.progEndField.disabled = true;
      } else {
        this.progEndField.disabled = false;
      }
    }

    // BAS + SAVEの場合、BAS保存形式選択を表示
    if (this.basSaveFormatRow) {
      if (selectedFormat === 'bas' && selectedMode === 'save') {
        this.basSaveFormatRow.style.display = 'flex';
      } else {
        this.basSaveFormatRow.style.display = 'none';
      }
    }

    // BAS + LOADの場合、BASロードモード選択を表示
    if (this.basLoadModeRow) {
      if (selectedFormat === 'bas' && selectedMode === 'load') {
        this.basLoadModeRow.style.display = 'flex';
      } else {
        this.basLoadModeRow.style.display = 'none';
      }
    }

    // IMAGE + LOADの場合、減色モード選択を表示
    if (this.imageReduceModeRow) {
      if (selectedFormat === 'image' && selectedMode === 'load') {
        this.imageReduceModeRow.style.display = 'flex';
      } else {
        this.imageReduceModeRow.style.display = 'none';
      }
    }
  }

  /**
   * 選択されているフォーマットを取得
   */
  private getSelectedFormat(): FileFormat {
    let format: FileFormat = 'image';
    this.progFormatRadios?.forEach(radio => {
      if (radio.checked) format = radio.value as FileFormat;
    });
    return format;
  }

  /**
   * 選択されているモードを取得
   */
  private getSelectedMode(): 'save' | 'load' {
    let mode: 'save' | 'load' = 'save';
    this.progModeRadios?.forEach(radio => {
      if (radio.checked) mode = radio.value as 'save' | 'load';
    });
    return mode;
  }

  /**
   * PROGRAMMING実行
   */
  private executeProgramming(): void {
    // フォーマットを取得
    const format = this.getSelectedFormat();

    // モードを取得
    const mode = this.getSelectedMode();

    // 範囲を取得
    const startVal = this.progStartField?.value || '00';
    const endVal = this.progEndField?.value || 'FF';
    const start = parseInt(startVal, 16);
    const end = parseInt(endVal, 16);

    // バリデーション
    if (isNaN(start) || isNaN(end) || start < 0 || start > 255 || end < 0 || end > 255) {
      // 無効な値の場合は何もしない
      return;
    }

    // BASロードモードを取得
    let basLoadMode: 'start' | 'original' = 'start';
    this.basLoadModeRadios?.forEach(radio => {
      if (radio.checked) basLoadMode = radio.value as 'start' | 'original';
    });

    // BAS保存形式を取得
    let basFormat: BasSaveFormat = 'asc';
    this.basSaveFormatRadios?.forEach(radio => {
      if (radio.checked) basFormat = radio.value as BasSaveFormat;
    });

    // 画像減色モードを取得
    let reduceMode: ColorReduceMode = 'none';
    this.imageReduceModeRadios?.forEach(radio => {
      if (radio.checked) reduceMode = radio.value as ColorReduceMode;
    });

    this.hideAllPanels();
    this.mode = 'edit';

    // イベント発火
    if (mode === 'save') {
      this.emit({ type: 'file-save', data: { file: { format, start, end, basFormat } } });
    } else {
      this.emit({ type: 'file-load', data: { file: { format, start, end, basLoadMode, reduceMode } } });
    }
  }

  /**
   * PROGRAMMINGキャンセル
   */
  private cancelProgramming(): void {
    this.hideAllPanels();
    this.mode = 'edit';
    this.emit({ type: 'cancel' });
  }

  /**
   * PROGRAMMINGパネルが表示中か
   */
  private isProgrammingPanelVisible(): boolean {
    return this.programmingArea?.classList.contains('visible') || false;
  }

  /**
   * 入力完了処理
   */
  private completeInput(value: string | null): void {
    this.hideAllPanels();
    if (this.promptCallback) {
      this.promptCallback(value);
    }
  }

  /**
   * ROTATION完了処理
   */
  private completeRotation(value: string | null): void {
    this.hideAllPanels();
    this.mode = 'edit';

    if (value === null || value.trim() === '') {
      this.emit({ type: 'cancel' });
      return;
    }

    const num = parseInt(value, 10);
    const rotationTypes: RotationType[] = [
      'right', 'left', 'up', 'down', 'rot90', 'rot180', 'flipH', 'flipV'
    ];

    if (num >= 0 && num <= 7) {
      this.emit({ type: 'rotation', data: { rotationType: rotationTypes[num] } });
    } else {
      this.emit({ type: 'cancel' });
    }
  }

  /**
   * TRANSFER完了処理
   */
  private completeTransfer(): void {
    const startVal = this.transferStart?.value || '';
    const endVal = this.transferEnd?.value || '';
    const targetVal = this.transferTarget?.value || '';

    this.hideAllPanels();
    this.mode = 'edit';

    if (!startVal || !endVal || !targetVal) {
      this.emit({ type: 'cancel' });
      return;
    }

    const start = parseInt(startVal, 16);
    const end = parseInt(endVal, 16);
    const target = parseInt(targetVal, 16);

    if (isNaN(start) || isNaN(end) || isNaN(target) ||
        start < 0 || start > 255 || end < 0 || end > 255 || target < 0 || target > 255) {
      this.emit({ type: 'cancel' });
      return;
    }

    this.emit({ type: 'transfer', data: { transfer: { start, end, target } } });
  }

  /**
   * TRANSFERキャンセル処理
   */
  private cancelTransfer(): void {
    this.hideAllPanels();
    this.mode = 'edit';
    this.emit({ type: 'cancel' });
  }

  /**
   * CLRパネルが表示中か
   */
  private isClearPanelVisible(): boolean {
    return this.clearArea?.classList.contains('visible') || false;
  }

  /**
   * CLR機能の入力開始
   */
  private startClearInput(): void {
    this.mode = 'menu';
    this.showClearUI();
  }

  /**
   * CLR完了処理
   */
  private completeClear(): void {
    this.hideAllPanels();
    this.mode = 'edit';
    this.emit({ type: 'clear' });
  }

  /**
   * CLRキャンセル処理
   */
  private cancelClear(): void {
    this.hideAllPanels();
    this.mode = 'edit';
    this.emit({ type: 'cancel' });
  }

  /**
   * アクティブな入力フィールドがあるか
   */
  private hasActiveInput(): boolean {
    const activeElement = document.activeElement;
    return activeElement === this.inputField ||
           activeElement === this.rotationField ||
           activeElement === this.transferStart ||
           activeElement === this.transferEnd ||
           activeElement === this.transferTarget ||
           activeElement === this.progStartField ||
           activeElement === this.progEndField ||
           this.colorInputs.includes(activeElement as HTMLInputElement);
  }

  /**
   * COLOR CHANGEパネルが表示中か
   */
  private isColorChangePanelVisible(): boolean {
    return this.colorChangeArea?.classList.contains('visible') || false;
  }

  /**
   * キーボードイベントリスナーを設定
   */
  private setupListeners(): void {
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    window.addEventListener('keyup', (e) => this.handleKeyUp(e));
  }

  /**
   * マウスイベントリスナーを設定
   */
  private setupMouseListeners(): void {
    // Canvas要素を取得
    this.canvas = document.getElementById('main-canvas') as HTMLCanvasElement;
    if (!this.canvas) return;

    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup', () => this.handleMouseUp());
    this.canvas.addEventListener('mouseleave', () => this.handleMouseUp());
  }

  /**
   * 編集エリアの情報を設定（main.tsから呼び出す）
   */
  setEditorAreaInfo(offsetX: number, offsetY: number, dotSize: number, scale: number): void {
    this.editorAreaInfo = { offsetX, offsetY, dotSize, scale };
  }

  /**
   * マウス座標からドット座標を計算
   * @returns ドット座標（0-15）、範囲外の場合はnull
   */
  private getMouseDotPosition(e: MouseEvent): { dotX: number; dotY: number } | null {
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
    if (this.mode !== 'edit') return;
    // キーボードモードでも描画を許可（マウスモード時と同じ動作）

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
    if (this.mode !== 'edit') return;

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
   * 入力デバイスモードを取得
   */
  getInputDeviceMode(): InputDeviceMode {
    return this.inputDeviceMode;
  }

  /**
   * 入力デバイスモードをトグル
   */
  private toggleInputDeviceMode(): void {
    this.inputDeviceMode = this.inputDeviceMode === 'keyboard' ? 'mouse' : 'keyboard';
    this.emit({ type: 'toggle-input-mode' });
  }

  /**
   * 数字キー押下時の処理（モードによって動作を変える）
   */
  private emitColorKey(color: X1Color): void {
    if (this.inputDeviceMode === 'keyboard') {
      // キーボードモード: 描画
      this.emit({ type: 'draw-dot', data: { color } });
    } else {
      // マウスモード: 色選択のみ
      this.emit({ type: 'color-select', data: { color } });
    }
  }

  /**
   * キーダウンイベント処理
   */
  private handleKeyDown(event: KeyboardEvent): void {
    // IME入力中は無視
    if (event.isComposing) return;

    // CLRパネル表示中の処理
    if (this.isClearPanelVisible()) {
      if (event.code === 'Enter') {
        event.preventDefault();
        this.completeClear();
      } else if (event.code === 'Escape') {
        event.preventDefault();
        this.cancelClear();
      }
      return;
    }

    // PROGRAMMINGパネル表示中の処理
    if (this.isProgrammingPanelVisible()) {
      if (event.code === 'Escape') {
        event.preventDefault();
        this.cancelProgramming();
      }
      // 他のキーは入力フィールドやボタン操作のために通常通り処理
      return;
    }

    // COLOR CHANGEパネル表示中の処理
    if (this.isColorChangePanelVisible()) {
      if (event.code === 'Escape') {
        event.preventDefault();
        this.cancelColorChange();
      }
      // 他のキーは入力フィールド操作のために通常通り処理
      return;
    }

    // 入力欄にフォーカスがある場合は編集モードのキー処理をスキップ
    if (this.hasActiveInput()) {
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
    const isCtrl = event.ctrlKey || event.metaKey;

    // Ctrl+L: CLR（編集領域クリア）
    if (isCtrl && event.code === 'KeyL') {
      event.preventDefault();
      this.startClearInput();
      return;
    }

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

      // 数字キー（キーボードモード: 描画、マウスモード: 色選択のみ）
      case 'Digit0':
      case 'Numpad0':
        event.preventDefault();
        this.emitColorKey(0 as X1Color);
        break;
      case 'Digit1':
      case 'Numpad1':
        event.preventDefault();
        this.emitColorKey(1 as X1Color);
        break;
      case 'Digit2':
      case 'Numpad2':
        event.preventDefault();
        this.emitColorKey(2 as X1Color);
        break;
      case 'Digit3':
      case 'Numpad3':
        event.preventDefault();
        this.emitColorKey(3 as X1Color);
        break;
      case 'Digit4':
      case 'Numpad4':
        event.preventDefault();
        this.emitColorKey(4 as X1Color);
        break;
      case 'Digit5':
      case 'Numpad5':
        event.preventDefault();
        this.emitColorKey(5 as X1Color);
        break;
      case 'Digit6':
      case 'Numpad6':
        event.preventDefault();
        this.emitColorKey(6 as X1Color);
        break;
      case 'Digit7':
      case 'Numpad7':
        event.preventDefault();
        this.emitColorKey(7 as X1Color);
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

      // Cキー: COLOR CHANGE
      case 'KeyC':
        event.preventDefault();
        this.startColorChangeInput();
        break;

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

      // Rキー: ROTATION
      case 'KeyR':
        event.preventDefault();
        this.startRotationInput();
        break;

      // Tキー: TRANSFER
      case 'KeyT':
        event.preventDefault();
        this.startTransferInput();
        break;

      // Pキー: PROGRAMMING（ファイル保存/読み込み）
      case 'KeyP':
        event.preventDefault();
        this.startProgrammingInput();
        break;

      // Kキー: キーボード/マウスモード切り替え
      case 'KeyK':
        event.preventDefault();
        this.toggleInputDeviceMode();
        break;

      // Wキー: WIDTH 40/80切り替え（隠しキー）
      case 'KeyW':
        event.preventDefault();
        this.emit({ type: 'toggle-width' });
        break;

      // Lキー: フォント読み込み（隠しキー）
      case 'KeyL':
        event.preventDefault();
        this.emit({ type: 'load-font' });
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
   * ROTATION機能の入力開始
   */
  private startRotationInput(): void {
    this.mode = 'menu';
    this.showRotationUI();
  }

  /**
   * TRANSFER機能の入力開始
   */
  private startTransferInput(): void {
    this.mode = 'menu';
    this.showTransferUI();
  }

  /**
   * PROGRAMMING機能の入力開始
   */
  private startProgrammingInput(): void {
    this.mode = 'menu';
    this.showProgrammingUI();
  }

  /**
   * COLOR CHANGE機能の入力開始
   */
  private startColorChangeInput(): void {
    this.mode = 'menu';
    this.showColorChangeUI();
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
