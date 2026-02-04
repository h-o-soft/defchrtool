/**
 * X1 DEFCHR TOOL for Web - メインエントリポイント
 * Phase 6: DEFCHRApp責務分離
 */

import { CanvasManager } from './renderer/CanvasManager';
import { X1Renderer } from './renderer/X1Renderer';
import { EditorRenderer } from './renderer/EditorRenderer';
import { DefinitionRenderer } from './renderer/DefinitionRenderer';
import { ScreenLayout } from './renderer/ScreenLayout';
import { PCGData } from './core/PCGData';
import { InputHandler, InputEvent, ColorReduceMode, BasSaveFormat, FileFormat } from './input/InputHandler';
import { X1_COLORS, EditMode, X1Color } from './core/types';
import { STATUS_MESSAGE_DURATION } from './core/constants';
import { BinFormat, BasFormat, ImageFormat } from './io';
import { LocalStorageService } from './storage';
import { EditorState, EditorCommands, CommandResult } from './app';

class DEFCHRApp {
  private canvasManager: CanvasManager;
  private x1Renderer: X1Renderer;
  private editorRenderer: EditorRenderer;
  private definitionRenderer: DefinitionRenderer;
  private screenLayout: ScreenLayout;
  private pcgData: PCGData;
  private editBuffer: PCGData;  // 編集エリア専用バッファ
  private inputHandler: InputHandler;
  private storageService: LocalStorageService;

  /** エディタの状態 */
  private editorState: EditorState;

  /** エディタコマンド */
  private editorCommands: EditorCommands;

  /** アニメーションフレームID */
  private animationFrameId: number | null = null;

  /** ステータスメッセージ（一時表示用） */
  private statusMessage: string = '';
  private statusMessageTimeout: number | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvasManager = new CanvasManager(canvas);

    // WIDTH 40モードに設定（DEFCHR TOOLは320x200モード）
    this.canvasManager.setScreenMode('WIDTH40');

    this.x1Renderer = new X1Renderer(this.canvasManager);
    this.screenLayout = new ScreenLayout(this.x1Renderer);
    this.pcgData = new PCGData();
    this.editBuffer = new PCGData();  // 編集エリア専用バッファ
    this.editorRenderer = new EditorRenderer(this.canvasManager, this.editBuffer, this.x1Renderer);  // 編集バッファを使用
    this.definitionRenderer = new DefinitionRenderer(this.canvasManager, this.pcgData);
    this.inputHandler = new InputHandler();
    this.storageService = new LocalStorageService();

    // 初期状態
    this.editorState = new EditorState();

    // コマンド実行オブジェクト
    this.editorCommands = new EditorCommands({
      pcgData: this.pcgData,
      editBuffer: this.editBuffer,
      editorState: this.editorState
    });

    // レイアウト設定（ScreenLayoutの座標に合わせる）
    // 編集エリア: 枠の内側（1文字分内側）
    const editorOffset = this.screenLayout.getEditorAreaPixelOffset();
    this.editorRenderer.setOffset(editorOffset.x, editorOffset.y);

    // 定義エリア: 枠の内側（1文字分内側）
    const defOffset = this.screenLayout.getDefinitionAreaPixelOffset();
    this.definitionRenderer.setOffset(defOffset.x, defOffset.y);
  }

  /**
   * アプリケーションを初期化
   */
  async init(): Promise<void> {
    console.log('[DEFCHRApp] Initializing...');

    // X1フォントを読み込み
    await this.x1Renderer.loadFont(`${import.meta.env.BASE_URL}assets/fonts/X1font.png`);

    // 入力イベントハンドラを設定
    this.inputHandler.onInput((event) => this.handleInput(event));

    // 編集エリアの情報をInputHandlerに設定（マウス座標計算用）
    // 編集エリア: (1,2)文字目から16x16ドット、1ドット=8ピクセル、スケール2倍
    const editorOffset = this.screenLayout.getEditorAreaPixelOffset();
    this.inputHandler.setEditorAreaInfo(editorOffset.x, editorOffset.y, 8, 2);

    // ローカルストレージからデータを読み込み
    const loaded = this.loadFromLocalStorage();

    // データがなければサンプルPCGデータを設定
    if (!loaded) {
      this.initSamplePCGData();
      // デフォルトのグリッド状態を反映
      this.editorRenderer.setShowGrid(this.editorState.gridVisible);
    }

    console.log('[DEFCHRApp] Initialized successfully');
  }

  /**
   * サンプルPCGデータを初期化
   */
  private initSamplePCGData(): void {
    // サンプル1: チェッカーボード（白）
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if ((x + y) % 2 === 0) {
          this.pcgData.setPixel(0, x, y, X1_COLORS.WHITE);
        }
      }
    }

    // サンプル2: 斜め線（黄色）
    for (let i = 0; i < 8; i++) {
      this.pcgData.setPixel(1, i, i, X1_COLORS.YELLOW);
    }

    // サンプル3: 枠（シアン）
    for (let i = 0; i < 8; i++) {
      this.pcgData.setPixel(2, i, 0, X1_COLORS.CYAN);
      this.pcgData.setPixel(2, i, 7, X1_COLORS.CYAN);
      this.pcgData.setPixel(2, 0, i, X1_COLORS.CYAN);
      this.pcgData.setPixel(2, 7, i, X1_COLORS.CYAN);
    }

    // サンプル4: カラフルなグラデーション
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const color = ((x + y) % 8) as X1Color;
        this.pcgData.setPixel(3, x, y, color);
      }
    }

    // サンプル5: スマイルフェイス（緑）
    const smilePattern = [
      0b00111100,
      0b01000010,
      0b10100101,
      0b10000001,
      0b10100101,
      0b10011001,
      0b01000010,
      0b00111100
    ];
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        if (smilePattern[y] & (0x80 >> x)) {
          this.pcgData.setPixel(4, x, y, X1_COLORS.GREEN);
        }
      }
    }

    // 選択キャラクターを設定
    this.definitionRenderer.setSelectedChar(this.editorState.currentCharCode);
  }

  /**
   * 入力イベント処理（Discriminated Union型でタイプセーフ）
   */
  private handleInput(event: InputEvent): void {
    switch (event.type) {
      case 'cursor-move':
        this.editorState.moveCursor(event.data.direction, event.data.fast);
        this.scheduleSave();
        break;

      case 'draw-dot':
        this.handleCommandResult(this.editorCommands.drawDot(event.data.color));
        break;

      case 'toggle-draw':
        this.handleCommandResult(this.editorCommands.toggleDraw());
        break;

      case 'home':
        this.editorState.cursorHome();
        this.showStatusMessage('Cursor: HOME');
        break;

      case 'mode-change':
        this.handleModeChange();
        break;

      case 'direction-change':
        this.handleDirectionChange();
        break;

      case 'toggle-grid':
        this.handleToggleGrid();
        break;

      case 'color-select':
        this.editorState.setColor(event.data.color);
        this.showStatusMessage(`Color: ${event.data.color}`);
        break;

      case 'toggle-input-mode':
        this.showStatusMessage(`Input: ${this.inputHandler.getInputDeviceMode() === 'keyboard' ? 'Keyboard' : 'Mouse'}`);
        break;

      case 'toggle-width':
        this.toggleWidthMode();
        break;

      case 'load-font':
        this.handleLoadFont();
        break;

      case 'mouse-draw':
        this.handleCommandResult(this.editorCommands.mouseDraw(event.data.mousePos.dotX, event.data.mousePos.dotY));
        break;

      case 'edit-chr': {
        const result = this.editorCommands.editChr(event.data.charCode);
        this.definitionRenderer.setSelectedChar(event.data.charCode);
        this.handleCommandResult(result);
        break;
      }

      case 'set-chr':
        this.handleCommandResult(this.editorCommands.setChr(event.data.charCode));
        break;

      case 'load-chr': {
        const result = this.editorCommands.loadChr(
          event.data.source,
          event.data.charCode,
          (code) => this.x1Renderer.getFontData(code)
        );
        this.handleCommandResult(result);
        break;
      }

      case 'rotation':
        this.handleCommandResult(this.editorCommands.rotation(event.data.rotationType));
        break;

      case 'transfer':
        this.handleCommandResult(this.editorCommands.transfer(
          event.data.transfer.start,
          event.data.transfer.end,
          event.data.transfer.target
        ));
        break;

      case 'clear':
        this.handleCommandResult(this.editorCommands.clear());
        break;

      case 'color-change':
        this.handleCommandResult(this.editorCommands.colorChange(event.data.colorMap));
        break;

      case 'file-save':
        this.handleFileSave(event.data.file.format, event.data.file.start, event.data.file.end, event.data.file.basFormat);
        break;

      case 'file-load':
        this.handleFileLoad(
          event.data.file.format,
          event.data.file.start,
          event.data.file.basLoadMode,
          event.data.file.reduceMode
        );
        break;

      case 'cancel':
        this.showStatusMessage('Cancelled');
        break;
    }
  }

  /**
   * コマンド結果を処理
   */
  private handleCommandResult(result: CommandResult): void {
    if (result.message) {
      this.showStatusMessage(result.message);
    }
    if (result.needsRender) {
      this.definitionRenderer.render();
    }
    if (result.needsSave) {
      this.scheduleSave();
    }
  }

  /**
   * 編集モード切り替え（Mキー）
   */
  private handleModeChange(): void {
    const modeNames: Record<EditMode, string> = {
      [EditMode.SEPARATE]: '4Chr.ベツベツ',
      [EditMode.VERTICAL]: 'タテ2Chr.',
      [EditMode.HORIZONTAL]: 'ヨコ2Chr.',
      [EditMode.ALL]: '4Chr.スベテ'
    };
    const newMode = this.editorState.cycleEditMode();
    this.showStatusMessage(`Mode: ${modeNames[newMode]}`);
    this.scheduleSave();
  }

  /**
   * 方向切り替え（Dキー）
   */
  private handleDirectionChange(): void {
    const dirSymbols = { up: '^', down: 'v', left: '<', right: '>' };
    const newDir = this.editorState.cycleDirection();
    this.showStatusMessage(`Direction: ${dirSymbols[newDir]}`);
    this.scheduleSave();
  }

  /**
   * グリッド表示切り替え（Gキー）
   */
  private handleToggleGrid(): void {
    const visible = this.editorState.toggleGrid();
    this.editorRenderer.setShowGrid(visible);
    this.showStatusMessage(`Grid: ${visible ? 'ON' : 'OFF'}`);
    this.scheduleSave();
  }

  /**
   * WIDTH 40/80モード切り替え（Wキー - 隠しキー）
   */
  private toggleWidthMode(): void {
    const currentMode = this.canvasManager.getScreenMode();
    const newMode = currentMode === 'WIDTH40' ? 'WIDTH80' : 'WIDTH40';
    this.canvasManager.setScreenMode(newMode);
    this.showStatusMessage(`${newMode}`);
  }

  /**
   * フォント読み込み（Lキー - 隠しキー）
   * FNT0808.X1形式（2048バイト）のフォントデータを読み込む
   */
  private handleLoadFont(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.X1,.x1,.bin,.fnt';

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      try {
        const arrayBuffer = await file.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);

        if (this.x1Renderer.setFontDataFromBinary(data)) {
          this.showStatusMessage(`Font loaded: ${file.name}`);
          this.scheduleSave();
        } else {
          this.showStatusMessage('Font load failed: invalid size');
        }
      } catch (e) {
        console.error('[DEFCHRApp] Font load error:', e);
        this.showStatusMessage('Font load error');
      }
    };

    input.click();
  }

  /**
   * ファイル保存処理
   */
  private async handleFileSave(format: FileFormat, start: number, end: number, basFormat?: BasSaveFormat): Promise<void> {
    try {
      let blob: Blob;
      let fileName: string;

      switch (format) {
        case 'image':
          blob = await ImageFormat.savePng(this.pcgData);
          fileName = ImageFormat.getDefaultFileName();
          break;
        case 'bin':
          blob = BinFormat.save(this.pcgData, start, end, false);
          fileName = BinFormat.getDefaultFileName(false);
          break;
        case 'bin3':
          blob = BinFormat.save(this.pcgData, start, end, true);
          fileName = BinFormat.getDefaultFileName(true);
          break;
        case 'bas':
          if (basFormat === 'bin') {
            blob = BasFormat.saveBinary(this.pcgData, start, end);
            fileName = BasFormat.getDefaultFileName(true);
          } else {
            blob = BasFormat.saveAscii(this.pcgData, start, end);
            fileName = BasFormat.getDefaultFileName(false);
          }
          break;
        default:
          return;
      }

      // ダウンロード
      this.downloadBlob(blob, fileName);
      this.showStatusMessage(`Saved: ${fileName}`);
    } catch (e) {
      console.error('[DEFCHRApp] File save error:', e);
      this.showStatusMessage(e instanceof Error ? e.message : 'Save failed');
    }
  }

  /**
   * ファイル読み込み処理
   */
  private handleFileLoad(format: FileFormat, start: number, basLoadMode?: 'start' | 'original', reduceMode?: ColorReduceMode): void {
    const input = document.createElement('input');
    input.type = 'file';

    switch (format) {
      case 'image':
        input.accept = 'image/png,image/jpeg,image/gif,image/webp';
        break;
      case 'bin':
      case 'bin3':
        input.accept = '.bin';
        break;
      case 'bas':
        input.accept = '.bas,.asc,.txt,text/plain';
        break;
    }

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      try {
        let loadCount: number;

        switch (format) {
          case 'image':
            loadCount = await ImageFormat.loadImage(file, this.pcgData, reduceMode || 'none');
            this.showStatusMessage(`Loaded: ${file.name} (${reduceMode || 'none'})`);
            break;
          case 'bin':
          case 'bin3': {
            const buffer = await file.arrayBuffer();
            const data = new Uint8Array(buffer);
            loadCount = BinFormat.load(data, this.pcgData, start, format === 'bin3');
            this.showStatusMessage(`Loaded: ${loadCount} chars from ${file.name}`);
            break;
          }
          case 'bas': {
            const buffer = await file.arrayBuffer();
            const data = new Uint8Array(buffer);
            loadCount = BasFormat.load(data, this.pcgData, start, basLoadMode || 'start');
            this.showStatusMessage(`Loaded: ${loadCount} chars from ${file.name}`);
            break;
          }
          default:
            return;
        }

        // 定義エリアを更新
        this.definitionRenderer.render();
        this.scheduleSave();
      } catch (e) {
        console.error('[DEFCHRApp] File load error:', e);
        this.showStatusMessage(e instanceof Error ? e.message : 'Load failed');
      }
    };

    input.click();
  }

  /**
   * Blobをダウンロード
   */
  private downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * 自動保存をスケジュール
   */
  private scheduleSave(): void {
    this.storageService.scheduleSave(this.createSaveState());
  }

  /**
   * 保存用の状態を作成
   */
  private createSaveState() {
    return {
      pcgData: this.pcgData.getAllData(),
      editBuffer: this.editBuffer.getAllData(),
      editorState: this.editorState.toSaveData(),
      fontData: this.x1Renderer.getAllFontData() || undefined
    };
  }

  /**
   * ローカルストレージからデータを読み込み
   * @returns 読み込みに成功したかどうか
   */
  private loadFromLocalStorage(): boolean {
    const saved = this.storageService.load();
    if (!saved) {
      return false;
    }

    // PCGデータを復元
    this.pcgData.setAllData(saved.pcgData);

    // 編集バッファを復元
    this.editBuffer.setAllData(saved.editBuffer);

    // エディタ状態を復元
    this.editorState.fromSaveData(saved.editorState);

    // グリッド表示状態を反映
    this.editorRenderer.setShowGrid(this.editorState.gridVisible);

    // 選択中のキャラクターを反映
    this.definitionRenderer.setSelectedChar(this.editorState.currentCharCode);

    // フォントデータを復元（存在する場合のみ）
    if (saved.fontData) {
      this.x1Renderer.setFontDataFromBinary(saved.fontData);
      console.log('[DEFCHRApp] Custom font data restored');
    }

    return true;
  }

  /**
   * ステータスメッセージを表示（一定時間後に消える）
   */
  private showStatusMessage(message: string): void {
    this.statusMessage = message;

    if (this.statusMessageTimeout !== null) {
      clearTimeout(this.statusMessageTimeout);
    }

    this.statusMessageTimeout = window.setTimeout(() => {
      this.statusMessage = '';
      this.statusMessageTimeout = null;
    }, STATUS_MESSAGE_DURATION);
  }

  /**
   * 描画ループ開始
   */
  startRenderLoop(): void {
    const render = () => {
      this.render();
      this.animationFrameId = requestAnimationFrame(render);
    };
    render();
  }

  /**
   * 描画ループ停止
   */
  stopRenderLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * 描画処理
   */
  private render(): void {
    // 画面クリア
    this.x1Renderer.clear();

    // タイトル
    this.screenLayout.drawTitle();

    // 編集エリア枠
    this.screenLayout.drawEditorFrame();

    // カーソル位置をPosition形式で渡す
    const cursorPosition = { x: this.editorState.cursorX, y: this.editorState.cursorY };

    // 編集エリア描画（編集バッファは常にcharCode 0から）
    this.editorRenderer.render(
      0,  // 編集バッファのベースコードは常に0
      this.editorState.editMode,
      cursorPosition
    );

    // 定義エリア枠
    this.screenLayout.drawDefinitionFrame();

    // 定義エリア描画
    this.definitionRenderer.render();

    // メニュー表示
    this.screenLayout.drawMenu(
      this.editorState.editMode,
      this.editorState.currentCharCode,
      this.editorState.editChrCode,  // EDIT CHR.(XX)の表示用
      this.editorState.lastDirection,  // カーソル移動方向
      this.editorState.currentColor,   // カレントカラー
      this.inputHandler.getInputDeviceMode()  // 入力デバイスモード
    );

    // プレビュー表示（右下 座標35,22）
    // 編集中の画像をリアルタイムで表示（カーソル位置に応じた文字を表示）
    this.editorRenderer.renderActualSize(
      35 * 8,  // x = 280
      22 * 8,  // y = 176
      0,  // 編集バッファのベースコードは常に0
      this.editorState.editMode,
      cursorPosition
    );

    // ステータスメッセージ（一時表示）
    if (this.statusMessage) {
      this.x1Renderer.drawText(0, 26 * 8, this.statusMessage, X1_COLORS.WHITE, X1_COLORS.BLACK);
    }

    // フリップ
    this.x1Renderer.flip();
  }

}

// アプリケーション起動
async function main(): Promise<void> {
  const canvas = document.getElementById('main-canvas') as HTMLCanvasElement;
  const status = document.getElementById('status');

  if (!canvas) {
    console.error('Canvas element not found!');
    if (status) status.textContent = 'Error: Canvas not found';
    return;
  }

  const app = new DEFCHRApp(canvas);

  try {
    if (status) status.textContent = 'Loading font...';
    await app.init();
    app.startRenderLoop();
    if (status) {
      status.textContent = 'Ready - Keys: 0-7=draw, Arrows=move, Space=toggle, M=edit mode, E=edit chr., S=set chr., R=rotation, T=transfer, P=file, G=grid';
    }
    console.log('[Main] Application started successfully');
  } catch (error) {
    console.error('[Main] Failed to start application:', error);
    if (status) status.textContent = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

// DOMContentLoaded後に起動
document.addEventListener('DOMContentLoaded', main);
