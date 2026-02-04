/**
 * X1 DEFCHR TOOL for Web - メインエントリポイント
 * Phase 4: 入力・操作の拡張
 */

import { CanvasManager } from './renderer/CanvasManager';
import { X1Renderer } from './renderer/X1Renderer';
import { EditorRenderer } from './renderer/EditorRenderer';
import { DefinitionRenderer } from './renderer/DefinitionRenderer';
import { ScreenLayout } from './renderer/ScreenLayout';
import { PCGData } from './core/PCGData';
import { InputHandler, InputEvent, RotationType, InputDeviceMode, ColorReduceMode, BasSaveFormat, FileFormat } from './input/InputHandler';
import {
  X1_COLORS,
  EditMode,
  Direction,
  EditorState,
  X1Color
} from './core/types';
import { STATUS_MESSAGE_DURATION } from './core/constants';
import { BinFormat, BasFormat, ImageFormat } from './io';
import { LocalStorageService } from './storage';
import { EditBufferTransform } from './core/EditBufferTransform';
import { getEditArea, getCursorCharPos } from './core/EditAreaCalculator';

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

    // 初期状態（EDIT MODEはデフォルトでALL）
    this.editorState = {
      editMode: EditMode.ALL,
      cursorPosition: { x: 0, y: 0 },
      currentColor: X1_COLORS.WHITE,
      lastDirection: Direction.RIGHT,
      currentCharCode: 0,
      mouseMode: false,
      editChrCode: 0
    };

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

    // 注意: PCGデータ変更時のリアルタイム反映は無効化
    // 定義エリアへの反映は SET CHR. 実行時のみ行う（handleSetChr内）
    // this.pcgData.on('pcg-updated', (data) => {
    //   const { code } = data as { code: number };
    //   if (code >= 0) {
    //     this.definitionRenderer.renderCharacter(code);
    //   }
    // });

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
      this.editorRenderer.setShowGrid(this.gridVisible);
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
        this.handleCursorMove(event.data.direction, event.data.fast);
        break;

      case 'draw-dot':
        this.handleDrawDot(event.data.color);
        break;

      case 'toggle-draw':
        this.handleToggleDraw();
        break;

      case 'home':
        this.handleHome();
        break;

      case 'mode-change':
        this.cycleEditMode();
        break;

      case 'direction-change':
        this.cycleDirection();
        break;

      case 'toggle-grid':
        this.toggleGrid();
        break;

      case 'color-select':
        this.handleColorSelect(event.data.color);
        break;

      case 'toggle-input-mode':
        this.toggleInputDeviceMode();
        break;

      case 'toggle-width':
        this.toggleWidthMode();
        break;

      case 'load-font':
        this.handleLoadFont();
        break;

      case 'mouse-draw':
        this.handleMouseDraw(event.data.mousePos.dotX, event.data.mousePos.dotY);
        break;

      case 'edit-chr':
        this.handleEditChr(event.data.charCode);
        break;

      case 'set-chr':
        this.handleSetChr(event.data.charCode);
        break;

      case 'load-chr':
        this.handleLoadChr(event.data.source, event.data.charCode);
        break;

      case 'rotation':
        this.handleRotation(event.data.rotationType);
        break;

      case 'transfer':
        this.handleTransfer(event.data.transfer);
        break;

      case 'clear':
        this.handleClear();
        break;

      case 'color-change':
        this.handleColorChange(event.data.colorMap);
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
   * カーソル移動処理
   */
  private handleCursorMove(direction: Direction, fast: boolean): void {
    const pos = this.editorState.cursorPosition;
    const maxPos = 15;
    const step = fast ? 2 : 1;  // Shift押下時は2ドット単位

    switch (direction) {
      case Direction.UP:
        pos.y = Math.max(0, pos.y - step);
        break;
      case Direction.DOWN:
        pos.y = Math.min(maxPos, pos.y + step);
        break;
      case Direction.LEFT:
        pos.x = Math.max(0, pos.x - step);
        break;
      case Direction.RIGHT:
        pos.x = Math.min(maxPos, pos.x + step);
        break;
    }

    this.editorState.lastDirection = direction;
    this.scheduleSave();
  }

  /**
   * ドット描画処理
   */
  private handleDrawDot(color: X1Color): void {
    const pos = this.editorState.cursorPosition;
    this.editorState.currentColor = color;
    this.drawDot(pos.x, pos.y, color);
    this.moveCursorInDirection();
  }

  /**
   * トグル描画処理（Space）
   */
  private handleToggleDraw(): void {
    const pos = this.editorState.cursorPosition;

    // 現在のドットの色を取得（編集バッファから）
    const charX = Math.floor(pos.x / 8);
    const charY = Math.floor(pos.y / 8);
    const localX = pos.x % 8;
    const localY = pos.y % 8;
    // 編集バッファは常にcharCode 0-3を使用
    const bufferCharCode = (charX + charY * 16) & 0xFF;

    const currentPixelColor = this.editBuffer.getPixel(bufferCharCode, localX, localY);

    // トグル: 色があれば消す、なければ現在の選択色で描画
    if (currentPixelColor === X1_COLORS.BLACK) {
      this.drawDot(pos.x, pos.y, this.editorState.currentColor);
    } else {
      this.drawDot(pos.x, pos.y, X1_COLORS.BLACK);
    }

    this.moveCursorInDirection();
  }

  /**
   * ホーム位置に移動（Home）
   */
  private handleHome(): void {
    this.editorState.cursorPosition = { x: 0, y: 0 };
    this.showStatusMessage('Cursor: HOME');
  }

  /**
   * 方向切り替え（Dキー）
   */
  private cycleDirection(): void {
    const directions = [Direction.RIGHT, Direction.DOWN, Direction.LEFT, Direction.UP];
    const dirSymbols: Record<Direction, string> = {
      [Direction.UP]: '^',
      [Direction.DOWN]: 'v',
      [Direction.LEFT]: '<',
      [Direction.RIGHT]: '>'
    };
    const currentIndex = directions.indexOf(this.editorState.lastDirection);
    this.editorState.lastDirection = directions[(currentIndex + 1) % directions.length];
    this.showStatusMessage(`Direction: ${dirSymbols[this.editorState.lastDirection]}`);
    this.scheduleSave();
  }

  /** グリッド表示状態（デフォルトは非表示） */
  private gridVisible: boolean = false;

  /** 入力デバイスモード */
  private inputDeviceMode: InputDeviceMode = 'keyboard';

  /**
   * グリッド表示切り替え（Gキー）
   */
  private toggleGrid(): void {
    this.gridVisible = !this.gridVisible;
    this.editorRenderer.setShowGrid(this.gridVisible);
    this.showStatusMessage(`Grid: ${this.gridVisible ? 'ON' : 'OFF'}`);
    this.scheduleSave();
  }

  /**
   * 色選択（マウスモード時の数字キー）
   */
  private handleColorSelect(color: X1Color): void {
    this.editorState.currentColor = color;
    this.showStatusMessage(`Color: ${color}`);
  }

  /**
   * 入力デバイスモード切り替え（Kキー）
   */
  private toggleInputDeviceMode(): void {
    this.inputDeviceMode = this.inputHandler.getInputDeviceMode();
    this.showStatusMessage(`Input: ${this.inputDeviceMode === 'keyboard' ? 'Keyboard' : 'Mouse'}`);
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
   * マウスでドット描画
   */
  private handleMouseDraw(dotX: number, dotY: number): void {
    this.drawDot(dotX, dotY, this.editorState.currentColor);
    // カーソル位置も更新
    this.editorState.cursorPosition = { x: dotX, y: dotY };
  }

  /**
   * EDIT CHR.処理（Cキー - 文字コード選択）
   */
  private handleEditChr(charCode: number): void {
    this.editorState.currentCharCode = charCode;
    this.definitionRenderer.setSelectedChar(charCode);
    this.showStatusMessage(`Edit CHR: $${charCode.toString(16).toUpperCase().padStart(2, '0')}`);
    this.scheduleSave();
  }

  /**
   * LOAD CHR.処理（Eキー - ROMCG/RAMCGからロード）
   * 編集バッファにのみ書き込み、定義エリア（pcgData）は変更しない
   * @param source 'rom' = ROMフォント、'ram' = PCGデータ
   * @param charCode 読み込む文字コード
   */
  private handleLoadChr(source: 'rom' | 'ram', charCode: number): void {
    const cursorPos = this.editorState.cursorPosition;
    const srcName = source === 'rom' ? 'ROMCG' : 'RAMCG';

    // カーソル位置から文字オフセットを計算（0-1, 0-1）
    const charX = Math.floor(cursorPos.x / 8);
    const charY = Math.floor(cursorPos.y / 8);

    // EDIT CHR.(XX)の表示用に文字コードを保存
    this.editorState.editChrCode = charCode;

    // 編集バッファに書き込む関数（pcgDataは変更しない）
    const loadCharacter = (srcCode: number, dstBufferCode: number) => {
      if (source === 'rom') {
        // ROMフォントからロード（モノクロ→白色）
        const fontData = this.x1Renderer.getFontData(srcCode);
        for (let y = 0; y < 8; y++) {
          for (let x = 0; x < 8; x++) {
            const isSet = (fontData[y] & (0x80 >> x)) !== 0;
            this.editBuffer.setPixel(dstBufferCode, x, y, isSet ? X1_COLORS.WHITE : X1_COLORS.BLACK);
          }
        }
      } else {
        // RAMCGからロード（pcgDataから編集バッファにコピー）
        const srcData = this.pcgData.getCharacter(srcCode);
        this.editBuffer.setCharacter(dstBufferCode, new Uint8Array(srcData));
      }
    };

    // 編集モードとカーソル位置に応じて編集バッファに書き込む
    switch (this.editorState.editMode) {
      case EditMode.SEPARATE:
        // 1文字モード: カーソル位置の1文字エリアに反映
        // 編集バッファのcharCode = charX + charY * 16
        loadCharacter(charCode, charX + charY * 16);
        break;

      case EditMode.HORIZONTAL:
        // 横2文字モード: カーソル位置を含む横2文字エリアに反映
        // 編集バッファの左(0 or 16)と右(1 or 17)に書き込む
        loadCharacter(charCode, charY * 16);
        loadCharacter((charCode + 1) & 0xFF, charY * 16 + 1);
        break;

      case EditMode.VERTICAL:
        // 縦2文字モード: カーソル位置を含む縦2文字エリアに反映
        // 編集バッファの上(0 or 1)と下(16 or 17)に書き込む
        loadCharacter(charCode, charX);
        loadCharacter((charCode + 16) & 0xFF, charX + 16);
        break;

      case EditMode.ALL:
        // 4文字モード: 全4文字エリアに反映
        loadCharacter(charCode, 0);
        loadCharacter((charCode + 1) & 0xFF, 1);
        loadCharacter((charCode + 16) & 0xFF, 16);
        loadCharacter((charCode + 17) & 0xFF, 17);
        break;
    }

    this.showStatusMessage(`Load ${srcName}: $${charCode.toString(16).toUpperCase().padStart(2, '0')}`);
    this.scheduleSave();
  }

  /**
   * SET CHR.処理
   * カーソル位置に応じた編集バッファの内容を指定キャラクターコードに転送する
   */
  private handleSetChr(charCode: number): void {
    const cursorPos = this.editorState.cursorPosition;

    // カーソル位置から文字オフセットを計算（0-1, 0-1）
    const charX = Math.floor(cursorPos.x / 8);
    const charY = Math.floor(cursorPos.y / 8);

    // 編集バッファからpcgDataにコピー
    switch (this.editorState.editMode) {
      case EditMode.SEPARATE:
        // 1文字モード: カーソル位置の1文字だけコピー
        // 編集バッファのcharX + charY * 16 → pcgDataのcharCode
        {
          const srcBufferCode = charX + charY * 16;
          this.pcgData.setCharacter(charCode, new Uint8Array(this.editBuffer.getCharacter(srcBufferCode)));
        }
        break;

      case EditMode.VERTICAL:
        // 縦2文字モード: カーソルがある列の縦2文字をコピー
        // 編集バッファの上(charX)と下(charX+16) → pcgDataのcharCodeとcharCode+16
        {
          const srcTop = charX;
          const srcBottom = charX + 16;
          this.pcgData.setCharacter(charCode, new Uint8Array(this.editBuffer.getCharacter(srcTop)));
          this.pcgData.setCharacter((charCode + 16) & 0xFF, new Uint8Array(this.editBuffer.getCharacter(srcBottom)));
        }
        break;

      case EditMode.HORIZONTAL:
        // 横2文字モード: カーソルがある行の横2文字をコピー
        // 編集バッファの左(charY*16)と右(charY*16+1) → pcgDataのcharCodeとcharCode+1
        {
          const srcLeft = charY * 16;
          const srcRight = charY * 16 + 1;
          this.pcgData.setCharacter(charCode, new Uint8Array(this.editBuffer.getCharacter(srcLeft)));
          this.pcgData.setCharacter((charCode + 1) & 0xFF, new Uint8Array(this.editBuffer.getCharacter(srcRight)));
        }
        break;

      case EditMode.ALL:
        // 4文字モード: 全4文字をコピー
        // 編集バッファの0,1,16,17 → pcgDataのcharCode,+1,+16,+17
        {
          this.pcgData.setCharacter(charCode, new Uint8Array(this.editBuffer.getCharacter(0)));
          this.pcgData.setCharacter((charCode + 1) & 0xFF, new Uint8Array(this.editBuffer.getCharacter(1)));
          this.pcgData.setCharacter((charCode + 16) & 0xFF, new Uint8Array(this.editBuffer.getCharacter(16)));
          this.pcgData.setCharacter((charCode + 17) & 0xFF, new Uint8Array(this.editBuffer.getCharacter(17)));
        }
        break;
    }

    // 定義エリアを更新（SET CHR.実行時のみ）
    this.definitionRenderer.render();

    this.showStatusMessage(`Set CHR: $${charCode.toString(16).toUpperCase().padStart(2, '0')}`);
    this.scheduleSave();
  }

  /**
   * ROTATION処理
   * 編集バッファの対象エリアを回転・移動・フリップする
   */
  private handleRotation(rotationType: RotationType): void {
    const cursorPos = this.editorState.cursorPosition;

    const success = EditBufferTransform.apply(
      this.editBuffer,
      this.editorState.editMode,
      cursorPos.x,
      cursorPos.y,
      rotationType
    );

    if (!success) {
      this.showStatusMessage('Invalid for this mode');
      return;
    }

    this.showStatusMessage(EditBufferTransform.getTransformName(rotationType));
    this.scheduleSave();
  }

  /**
   * CLEAR処理
   * 編集バッファの対象エリアを黒（0）でクリア
   */
  private handleClear(): void {
    const cursorPos = this.editorState.cursorPosition;
    const { charX, charY } = getCursorCharPos(cursorPos.x, cursorPos.y);

    // 編集モードに応じた対象エリアを取得
    const { charCodes } = getEditArea(this.editorState.editMode, charX, charY);

    // 対象エリアのすべてのピクセルを黒でクリア
    for (const charCode of charCodes) {
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          this.editBuffer.setPixel(charCode, x, y, X1_COLORS.BLACK);
        }
      }
    }

    this.showStatusMessage('Cleared');
    this.scheduleSave();
  }

  /**
   * COLOR CHANGE処理
   * 編集バッファの対象エリアの色を変換する
   * @param colorMap 8要素の配列。colorMap[i]は色iを色colorMap[i]に変換する
   */
  private handleColorChange(colorMap: number[]): void {
    const cursorPos = this.editorState.cursorPosition;
    const { charX, charY } = getCursorCharPos(cursorPos.x, cursorPos.y);

    // 編集モードに応じた対象エリアを取得
    const { charCodes } = getEditArea(this.editorState.editMode, charX, charY);

    // 対象エリアの各ピクセルの色を変換
    for (const charCode of charCodes) {
      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 8; x++) {
          const currentColor = this.editBuffer.getPixel(charCode, x, y);
          const newColor = colorMap[currentColor] as X1Color;
          if (newColor !== currentColor) {
            this.editBuffer.setPixel(charCode, x, y, newColor);
          }
        }
      }
    }

    this.showStatusMessage('Color changed');
    this.scheduleSave();
  }

  /**
   * TRANSFER処理
   * 定義エリア（pcgData）の文字をコピー
   */
  private handleTransfer(transfer: { start: number; end: number; target: number }): void {
    const { start, end, target } = transfer;
    const count = end - start + 1;

    if (count <= 0 || target + count > 256) {
      this.showStatusMessage('Invalid range');
      return;
    }

    // コピー実行
    for (let i = 0; i < count; i++) {
      const srcData = this.pcgData.getCharacter(start + i);
      this.pcgData.setCharacter(target + i, new Uint8Array(srcData));
    }

    // 定義エリアを更新
    this.definitionRenderer.render();

    this.showStatusMessage(`Transfer: $${start.toString(16).toUpperCase().padStart(2, '0')}-$${end.toString(16).toUpperCase().padStart(2, '0')} -> $${target.toString(16).toUpperCase().padStart(2, '0')}`);
    this.scheduleSave();
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
   * ドットを描画（編集バッファに描画）
   */
  private drawDot(x: number, y: number, color: X1Color): void {
    const charX = Math.floor(x / 8);
    const charY = Math.floor(y / 8);
    const localX = x % 8;
    const localY = y % 8;

    // 編集バッファは常にcharCode 0-3を使用（左上=0, 右上=1, 左下=16, 右下=17）
    const bufferCharCode = (charX + charY * 16) & 0xFF;
    this.editBuffer.setPixel(bufferCharCode, localX, localY, color);
    this.scheduleSave();
  }

  /**
   * カーソルを最後の移動方向に進める
   */
  private moveCursorInDirection(): void {
    const pos = this.editorState.cursorPosition;
    const maxPos = 15;

    switch (this.editorState.lastDirection) {
      case Direction.UP:
        if (pos.y > 0) pos.y--;
        break;
      case Direction.DOWN:
        if (pos.y < maxPos) pos.y++;
        break;
      case Direction.LEFT:
        if (pos.x > 0) pos.x--;
        break;
      case Direction.RIGHT:
        if (pos.x < maxPos) pos.x++;
        break;
    }
  }

  /**
   * 編集モードを切り替え
   */
  private cycleEditMode(): void {
    const modes = [EditMode.SEPARATE, EditMode.VERTICAL, EditMode.HORIZONTAL, EditMode.ALL];
    const modeNames: Record<EditMode, string> = {
      [EditMode.SEPARATE]: '4Chr.ベツベツ',
      [EditMode.VERTICAL]: 'タテ2Chr.',
      [EditMode.HORIZONTAL]: 'ヨコ2Chr.',
      [EditMode.ALL]: '4Chr.スベテ'
    };
    const currentIndex = modes.indexOf(this.editorState.editMode);
    this.editorState.editMode = modes[(currentIndex + 1) % modes.length];
    this.showStatusMessage(`Mode: ${modeNames[this.editorState.editMode]}`);
    this.scheduleSave();
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
      editorState: {
        editMode: this.editorState.editMode,
        cursorPosition: this.editorState.cursorPosition,
        currentColor: this.editorState.currentColor,
        lastDirection: this.editorState.lastDirection,
        currentCharCode: this.editorState.currentCharCode,
        editChrCode: this.editorState.editChrCode,
        gridVisible: this.gridVisible
      },
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
    this.editorState.editMode = saved.editorState.editMode;
    this.editorState.cursorPosition = saved.editorState.cursorPosition;
    this.editorState.currentColor = saved.editorState.currentColor;
    this.editorState.lastDirection = saved.editorState.lastDirection;
    this.editorState.currentCharCode = saved.editorState.currentCharCode;
    this.editorState.editChrCode = saved.editorState.editChrCode;
    this.gridVisible = saved.editorState.gridVisible;

    // グリッド表示状態を反映
    this.editorRenderer.setShowGrid(this.gridVisible);

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

    // 編集エリア描画（編集バッファは常にcharCode 0から）
    this.editorRenderer.render(
      0,  // 編集バッファのベースコードは常に0
      this.editorState.editMode,
      this.editorState.cursorPosition
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
      this.inputDeviceMode             // 入力デバイスモード
    );

    // プレビュー表示（右下 座標35,22）
    // 編集中の画像をリアルタイムで表示（カーソル位置に応じた文字を表示）
    this.editorRenderer.renderActualSize(
      35 * 8,  // x = 280
      22 * 8,  // y = 176
      0,  // 編集バッファのベースコードは常に0
      this.editorState.editMode,
      this.editorState.cursorPosition
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
