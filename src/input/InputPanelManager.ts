/**
 * 入力パネルマネージャ
 * 各種入力UIパネルの表示/非表示、値の取得を管理
 */

import {
  InputEvent,
  FileFormat,
  ColorReduceMode,
  BasSaveFormat
} from './InputEventTypes';
import { getRotationTypeFromNumber } from './KeyBindings';

/** プロンプトコールバック */
type PromptCallback = (value: string | null) => void;

/** イベント発火用コールバック */
type EmitCallback = (event: InputEvent) => void;

/** モード変更コールバック */
type SetModeCallback = (mode: 'edit' | 'menu' | 'editchr' | 'setchr') => void;

/**
 * 入力パネルマネージャクラス
 */
export class InputPanelManager {
  // 通常入力エリア
  private inputArea: HTMLElement | null = null;
  private inputLabel: HTMLElement | null = null;
  private inputField: HTMLInputElement | null = null;

  // ROTATION エリア
  private rotationArea: HTMLElement | null = null;
  private rotationField: HTMLInputElement | null = null;

  // TRANSFER エリア
  private transferArea: HTMLElement | null = null;
  private transferStart: HTMLInputElement | null = null;
  private transferEnd: HTMLInputElement | null = null;
  private transferTarget: HTMLInputElement | null = null;

  // CLR エリア
  private clearArea: HTMLElement | null = null;

  // COLOR CHANGE エリア
  private colorChangeArea: HTMLElement | null = null;
  private colorInputs: HTMLInputElement[] = [];

  // PROGRAMMING エリア
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

  // コールバック
  private promptCallback: PromptCallback | null = null;
  private emit: EmitCallback;
  private setMode: SetModeCallback;

  /** イベントリスナー解除用AbortController */
  private abortController: AbortController | null = null;

  constructor(emit: EmitCallback, setMode: SetModeCallback) {
    this.emit = emit;
    this.setMode = setMode;
  }

  /**
   * 入力UIの初期化
   */
  setup(): void {
    // 既存のリスナーを解除
    this.abortController?.abort();
    this.abortController = new AbortController();

    this.setupInputArea();
    this.setupRotationArea();
    this.setupTransferArea();
    this.setupClearArea();
    this.setupColorChangeArea();
    this.setupProgrammingArea();
  }

  /**
   * 通常入力エリアの初期化
   */
  private setupInputArea(): void {
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
      }, { signal: this.abortController!.signal });
    }
  }

  /**
   * ROTATIONエリアの初期化
   */
  private setupRotationArea(): void {
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
      }, { signal: this.abortController!.signal });
    }
  }

  /**
   * TRANSFERエリアの初期化
   */
  private setupTransferArea(): void {
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
        }, { signal: this.abortController!.signal });
      }
    });
  }

  /**
   * CLRエリアの初期化
   */
  private setupClearArea(): void {
    this.clearArea = document.getElementById('clear-area');
  }

  /**
   * COLOR CHANGEエリアの初期化
   */
  private setupColorChangeArea(): void {
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
        }, { signal: this.abortController!.signal });
      }
    }
  }

  /**
   * PROGRAMMINGエリアの初期化
   */
  private setupProgrammingArea(): void {
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
      radio.addEventListener('change', () => this.updateProgrammingUI(), { signal: this.abortController!.signal });
    });

    // モード変更時の処理
    this.progModeRadios?.forEach(radio => {
      radio.addEventListener('change', () => this.updateProgrammingUI(), { signal: this.abortController!.signal });
    });

    // EXECボタン
    this.progExecBtn?.addEventListener('click', () => this.executeProgramming(), { signal: this.abortController!.signal });

    // CANCELボタン
    this.progCancelBtn?.addEventListener('click', () => this.cancelProgramming(), { signal: this.abortController!.signal });
  }

  // ==================== 表示/非表示 ====================

  /**
   * 全パネルを非表示
   */
  hideAllPanels(): void {
    if (this.inputArea) this.inputArea.classList.remove('visible');
    if (this.rotationArea) this.rotationArea.classList.remove('visible');
    if (this.transferArea) this.transferArea.classList.remove('visible');
    if (this.clearArea) this.clearArea.classList.remove('visible');
    if (this.colorChangeArea) this.colorChangeArea.classList.remove('visible');
    if (this.programmingArea) this.programmingArea.classList.remove('visible');
  }

  /**
   * 通常入力UIを表示
   */
  showInputUI(label: string, callback: PromptCallback): void {
    this.hideAllPanels();
    this.promptCallback = callback;

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
  showRotationUI(): void {
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
  showTransferUI(): void {
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
  showClearUI(): void {
    this.hideAllPanels();
    if (this.clearArea) {
      this.clearArea.classList.add('visible');
      // フォーカスをドキュメントに戻してキーイベントを受け取れるようにする
      (document.activeElement as HTMLElement)?.blur();
    }
  }

  /**
   * COLOR CHANGE UIを表示
   */
  showColorChangeUI(): void {
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
   * PROGRAMMING UIを表示
   */
  showProgrammingUI(): void {
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

  // ==================== パネル状態チェック ====================

  /**
   * CLRパネルが表示中か
   */
  isClearPanelVisible(): boolean {
    return this.clearArea?.classList.contains('visible') || false;
  }

  /**
   * PROGRAMMINGパネルが表示中か
   */
  isProgrammingPanelVisible(): boolean {
    return this.programmingArea?.classList.contains('visible') || false;
  }

  /**
   * COLOR CHANGEパネルが表示中か
   */
  isColorChangePanelVisible(): boolean {
    return this.colorChangeArea?.classList.contains('visible') || false;
  }

  /**
   * アクティブな入力フィールドがあるか
   */
  hasActiveInput(): boolean {
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

  // ==================== PROGRAMMING UI 状態更新 ====================

  /**
   * PROGRAMMING UIの状態を更新
   */
  private updateProgrammingUI(): void {
    const selectedFormat = this.getSelectedFormat();
    const selectedMode = this.getSelectedMode();

    // 全フォーマットでLOADを有効化
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

    // LOADモードの場合、終了コードを無効化
    if (this.progEndField) {
      this.progEndField.disabled = selectedMode === 'load';
    }

    // BAS + SAVEの場合、BAS保存形式選択を表示
    if (this.basSaveFormatRow) {
      this.basSaveFormatRow.style.display =
        (selectedFormat === 'bas' && selectedMode === 'save') ? 'flex' : 'none';
    }

    // BAS + LOADの場合、BASロードモード選択を表示
    if (this.basLoadModeRow) {
      this.basLoadModeRow.style.display =
        (selectedFormat === 'bas' && selectedMode === 'load') ? 'flex' : 'none';
    }

    // IMAGE + LOADの場合、減色モード選択を表示
    if (this.imageReduceModeRow) {
      this.imageReduceModeRow.style.display =
        (selectedFormat === 'image' && selectedMode === 'load') ? 'flex' : 'none';
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

  // ==================== 完了/キャンセル処理 ====================

  /**
   * 入力完了処理
   */
  private completeInput(value: string | null): void {
    this.hideAllPanels();
    if (this.promptCallback) {
      const callback = this.promptCallback;
      this.promptCallback = null;
      callback(value);
    }
  }

  /**
   * ROTATION完了処理
   */
  private completeRotation(value: string | null): void {
    this.hideAllPanels();
    this.setMode('edit');

    if (value === null || value.trim() === '') {
      this.emit({ type: 'cancel' });
      return;
    }

    const num = parseInt(value, 10);
    const rotationType = getRotationTypeFromNumber(num);

    if (rotationType) {
      this.emit({ type: 'rotation', data: { rotationType } });
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
    this.setMode('edit');

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
    this.setMode('edit');
    this.emit({ type: 'cancel' });
  }

  /**
   * CLR完了処理
   */
  completeClear(): void {
    this.hideAllPanels();
    this.setMode('edit');
    this.emit({ type: 'clear' });
  }

  /**
   * CLRキャンセル処理
   */
  cancelClear(): void {
    this.hideAllPanels();
    this.setMode('edit');
    this.emit({ type: 'cancel' });
  }

  /**
   * COLOR CHANGE完了処理
   */
  private completeColorChange(): void {
    const colorMap: number[] = [];
    for (let i = 0; i < 8; i++) {
      const val = parseInt(this.colorInputs[i]?.value || i.toString(), 10);
      if (isNaN(val) || val < 0 || val > 7) {
        colorMap.push(i);
      } else {
        colorMap.push(val);
      }
    }

    this.hideAllPanels();
    this.setMode('edit');
    this.emit({ type: 'color-change', data: { colorMap } });
  }

  /**
   * COLOR CHANGEキャンセル処理
   */
  cancelColorChange(): void {
    this.hideAllPanels();
    this.setMode('edit');
    this.emit({ type: 'cancel' });
  }

  /**
   * PROGRAMMING実行
   */
  private executeProgramming(): void {
    const format = this.getSelectedFormat();
    const mode = this.getSelectedMode();

    const startVal = this.progStartField?.value || '00';
    const endVal = this.progEndField?.value || 'FF';
    const start = parseInt(startVal, 16);
    const end = parseInt(endVal, 16);

    // バリデーション
    if (isNaN(start) || isNaN(end) || start < 0 || start > 255 || end < 0 || end > 255) {
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
    this.setMode('edit');

    if (mode === 'save') {
      this.emit({ type: 'file-save', data: { file: { format, start, end, basFormat } } });
    } else {
      this.emit({ type: 'file-load', data: { file: { format, start, end, basLoadMode, reduceMode } } });
    }
  }

  /**
   * PROGRAMMINGキャンセル
   */
  cancelProgramming(): void {
    this.hideAllPanels();
    this.setMode('edit');
    this.emit({ type: 'cancel' });
  }

  /**
   * リソースを解放
   */
  dispose(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.promptCallback = null;
  }
}
