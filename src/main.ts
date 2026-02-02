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
import { InputHandler, InputEvent, RotationType, FileFormat, InputDeviceMode } from './input/InputHandler';
import {
  X1_COLORS,
  EditMode,
  Direction,
  EditorState,
  X1Color
} from './core/types';

/** ローカルストレージのキー */
const STORAGE_KEYS = {
  PCG_DATA: 'defchr-pcgdata',
  EDIT_BUFFER: 'defchr-editbuffer',
  EDITOR_STATE: 'defchr-state'
} as const;

class DEFCHRApp {
  private canvasManager: CanvasManager;
  private x1Renderer: X1Renderer;
  private editorRenderer: EditorRenderer;
  private definitionRenderer: DefinitionRenderer;
  private screenLayout: ScreenLayout;
  private pcgData: PCGData;
  private editBuffer: PCGData;  // 編集エリア専用バッファ
  private inputHandler: InputHandler;

  /** エディタの状態 */
  private editorState: EditorState;

  /** アニメーションフレームID */
  private animationFrameId: number | null = null;

  /** ステータスメッセージ（一時表示用） */
  private statusMessage: string = '';
  private statusMessageTimeout: number | null = null;

  /** 自動保存用のデバウンスタイマー */
  private saveTimeout: number | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvasManager = new CanvasManager(canvas);

    // WIDTH 40モードに設定（DEFCHR TOOLは320x200モード）
    this.canvasManager.setScreenMode('WIDTH40');

    this.x1Renderer = new X1Renderer(this.canvasManager);
    this.screenLayout = new ScreenLayout(this.x1Renderer);
    this.pcgData = new PCGData();
    this.editBuffer = new PCGData();  // 編集エリア専用バッファ
    this.editorRenderer = new EditorRenderer(this.canvasManager, this.editBuffer);  // 編集バッファを使用
    this.definitionRenderer = new DefinitionRenderer(this.canvasManager, this.pcgData);
    this.inputHandler = new InputHandler();

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
   * 入力イベント処理
   */
  private handleInput(event: InputEvent): void {
    switch (event.type) {
      case 'cursor-move':
        this.handleCursorMove(event.data!.direction!, event.data!.fast || false);
        break;

      case 'draw-dot':
        this.handleDrawDot(event.data!.color!);
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
        this.handleColorSelect(event.data!.color!);
        break;

      case 'toggle-input-mode':
        this.toggleInputDeviceMode();
        break;

      case 'mouse-draw':
        this.handleMouseDraw(event.data!.mousePos!.dotX, event.data!.mousePos!.dotY);
        break;

      case 'edit-chr':
        this.handleEditChr(event.data!.charCode!);
        break;

      case 'set-chr':
        this.handleSetChr(event.data!.charCode!);
        break;

      case 'load-chr':
        this.handleLoadChr(event.data!.source!, event.data!.charCode!);
        break;

      case 'rotation':
        this.handleRotation(event.data!.rotationType!);
        break;

      case 'transfer':
        this.handleTransfer(event.data!.transfer!);
        break;

      case 'clear':
        this.handleClear();
        break;

      case 'color-change':
        this.handleColorChange(event.data!.colorMap!);
        break;

      case 'file-save':
        this.handleFileSave(event.data!.file!.format, event.data!.file!.start, event.data!.file!.end);
        break;

      case 'file-load':
        this.handleFileLoad(
          event.data!.file!.format,
          event.data!.file!.start,
          event.data!.file!.basLoadMode
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
    const charX = Math.floor(cursorPos.x / 8);
    const charY = Math.floor(cursorPos.y / 8);

    // 編集モードに応じた対象エリアを取得
    const { startX, startY, width, height, charCodes } = this.getEditArea(charX, charY);

    // 90度/180度回転はタテ2Chr.やヨコ2Chr.では無効
    if ((rotationType === 'rot90' || rotationType === 'rot180') &&
        (this.editorState.editMode === EditMode.VERTICAL ||
         this.editorState.editMode === EditMode.HORIZONTAL)) {
      this.showStatusMessage('Invalid for this mode');
      return;
    }

    // 対象エリアのピクセルデータを取得
    const pixels = this.getAreaPixels(startX, startY, width, height, charCodes);

    // 変換を適用
    const transformed = this.applyTransformation(pixels, width, height, rotationType);

    // 結果を書き戻す
    this.setAreaPixels(startX, startY, width, height, charCodes, transformed);

    const rotationNames: Record<RotationType, string> = {
      'right': 'Move Right',
      'left': 'Move Left',
      'up': 'Move Up',
      'down': 'Move Down',
      'rot90': 'Rotate 90°',
      'rot180': 'Rotate 180°',
      'flipH': 'Flip H',
      'flipV': 'Flip V'
    };
    this.showStatusMessage(rotationNames[rotationType]);
    this.scheduleSave();
  }

  /**
   * 編集モードとカーソル位置から対象エリアを取得
   */
  private getEditArea(charX: number, charY: number): {
    startX: number; startY: number; width: number; height: number;
    charCodes: number[];
  } {
    switch (this.editorState.editMode) {
      case EditMode.SEPARATE:
        // 1文字のみ
        return {
          startX: charX * 8, startY: charY * 8, width: 8, height: 8,
          charCodes: [charX + charY * 16]
        };
      case EditMode.VERTICAL:
        // 縦2文字
        return {
          startX: charX * 8, startY: 0, width: 8, height: 16,
          charCodes: [charX, charX + 16]
        };
      case EditMode.HORIZONTAL:
        // 横2文字
        return {
          startX: 0, startY: charY * 8, width: 16, height: 8,
          charCodes: [charY * 16, charY * 16 + 1]
        };
      case EditMode.ALL:
      default:
        // 4文字すべて
        return {
          startX: 0, startY: 0, width: 16, height: 16,
          charCodes: [0, 1, 16, 17]
        };
    }
  }

  /**
   * 指定エリアのピクセルを取得
   */
  private getAreaPixels(
    _startX: number, _startY: number, width: number, height: number,
    charCodes: number[]
  ): X1Color[][] {
    const pixels: X1Color[][] = [];
    for (let y = 0; y < height; y++) {
      pixels[y] = [];
      for (let x = 0; x < width; x++) {
        const charIdx = Math.floor(x / 8) + Math.floor(y / 8) * (width > 8 ? 2 : 1);
        const charCode = charCodes[charIdx] || charCodes[0];
        const localX = x % 8;
        const localY = y % 8;
        pixels[y][x] = this.editBuffer.getPixel(charCode, localX, localY);
      }
    }
    return pixels;
  }

  /**
   * ピクセルを指定エリアに書き戻す
   */
  private setAreaPixels(
    _startX: number, _startY: number, width: number, height: number,
    charCodes: number[], pixels: X1Color[][]
  ): void {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const charIdx = Math.floor(x / 8) + Math.floor(y / 8) * (width > 8 ? 2 : 1);
        const charCode = charCodes[charIdx] || charCodes[0];
        const localX = x % 8;
        const localY = y % 8;
        this.editBuffer.setPixel(charCode, localX, localY, pixels[y][x]);
      }
    }
  }

  /**
   * 変換を適用
   */
  private applyTransformation(
    pixels: X1Color[][], width: number, height: number, type: RotationType
  ): X1Color[][] {
    const result: X1Color[][] = [];

    switch (type) {
      case 'right':
        // 左に移動（左端が右端に折り返し）
        for (let y = 0; y < height; y++) {
          result[y] = [];
          for (let x = 0; x < width; x++) {
            result[y][x] = pixels[y][(x + 1) % width];
          }
        }
        break;

      case 'left':
        // 右に移動（右端が左端に折り返し）
        for (let y = 0; y < height; y++) {
          result[y] = [];
          for (let x = 0; x < width; x++) {
            result[y][x] = pixels[y][(x - 1 + width) % width];
          }
        }
        break;

      case 'up':
        // 上に移動（上端が下端に折り返し）
        for (let y = 0; y < height; y++) {
          result[y] = [];
          for (let x = 0; x < width; x++) {
            result[y][x] = pixels[(y + 1) % height][x];
          }
        }
        break;

      case 'down':
        // 下に移動（下端が上端に折り返し）
        for (let y = 0; y < height; y++) {
          result[y] = [];
          for (let x = 0; x < width; x++) {
            result[y][x] = pixels[(y - 1 + height) % height][x];
          }
        }
        break;

      case 'rot90':
        // 90度反時計回り: (x,y) -> (y, width-1-x)
        for (let y = 0; y < width; y++) {
          result[y] = [];
          for (let x = 0; x < height; x++) {
            result[y][x] = pixels[x][width - 1 - y];
          }
        }
        break;

      case 'rot180':
        // 180度: (x,y) -> (width-1-x, height-1-y)
        for (let y = 0; y < height; y++) {
          result[y] = [];
          for (let x = 0; x < width; x++) {
            result[y][x] = pixels[height - 1 - y][width - 1 - x];
          }
        }
        break;

      case 'flipH':
        // 上下フリップ: (x,y) -> (x, height-1-y)
        for (let y = 0; y < height; y++) {
          result[y] = [];
          for (let x = 0; x < width; x++) {
            result[y][x] = pixels[height - 1 - y][x];
          }
        }
        break;

      case 'flipV':
        // 左右フリップ: (x,y) -> (width-1-x, y)
        for (let y = 0; y < height; y++) {
          result[y] = [];
          for (let x = 0; x < width; x++) {
            result[y][x] = pixels[y][width - 1 - x];
          }
        }
        break;
    }

    return result;
  }

  /**
   * CLEAR処理
   * 編集バッファの対象エリアを黒（0）でクリア
   */
  private handleClear(): void {
    const cursorPos = this.editorState.cursorPosition;
    const charX = Math.floor(cursorPos.x / 8);
    const charY = Math.floor(cursorPos.y / 8);

    // 編集モードに応じた対象エリアを取得
    const { charCodes } = this.getEditArea(charX, charY);

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
    const charX = Math.floor(cursorPos.x / 8);
    const charY = Math.floor(cursorPos.y / 8);

    // 編集モードに応じた対象エリアを取得
    const { charCodes } = this.getEditArea(charX, charY);

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
  private handleFileSave(format: FileFormat, start: number, end: number): void {
    switch (format) {
      case 'png':
        this.savePng();
        break;
      case 'bin':
        this.saveBin(start, end, false);
        break;
      case 'bin3':
        this.saveBin(start, end, true);
        break;
      case 'bas':
        this.saveBas(start, end);
        break;
    }
  }

  /**
   * ファイル読み込み処理
   */
  private handleFileLoad(format: FileFormat, start: number, basLoadMode?: 'start' | 'original'): void {
    switch (format) {
      case 'png':
        this.loadPng();
        break;
      case 'bin':
        this.loadBin(start, false);
        break;
      case 'bin3':
        this.loadBin(start, true);
        break;
      case 'bas':
        this.loadBas(start, basLoadMode || 'start');
        break;
    }
  }

  /**
   * PNG形式で保存（全256文字を128x128画像として）
   */
  private savePng(): void {
    // 128x128のオフスクリーンキャンバスを作成
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // 黒で塗りつぶし
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 128, 128);

    // X1の8色パレット
    const palette: [number, number, number][] = [
      [0, 0, 0],       // 0: 黒
      [0, 0, 255],     // 1: 青
      [255, 0, 0],     // 2: 赤
      [255, 0, 255],   // 3: マゼンタ
      [0, 255, 0],     // 4: 緑
      [0, 255, 255],   // 5: シアン
      [255, 255, 0],   // 6: 黄
      [255, 255, 255], // 7: 白
    ];

    // 256文字を描画
    for (let charCode = 0; charCode < 256; charCode++) {
      const charX = (charCode % 16) * 8;
      const charY = Math.floor(charCode / 16) * 8;

      for (let py = 0; py < 8; py++) {
        for (let px = 0; px < 8; px++) {
          const color = this.pcgData.getPixel(charCode, px, py);
          if (color !== 0) {
            const [r, g, b] = palette[color];
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.fillRect(charX + px, charY + py, 1, 1);
          }
        }
      }
    }

    // PNGとしてダウンロード
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'pcg.png';
        a.click();
        URL.revokeObjectURL(url);
        this.showStatusMessage('Saved: pcg.png');
      }
    }, 'image/png');
  }

  /**
   * PNG形式で読み込み
   */
  private loadPng(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png';

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      const img = new Image();
      img.onload = () => {
        // 128x128以外のサイズは警告（ただし処理は続行）
        if (img.width !== 128 || img.height !== 128) {
          console.warn(`Image size is ${img.width}x${img.height}, expected 128x128`);
        }

        // 画像をキャンバスに描画してピクセルデータを取得
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, 128, 128);
        const imageData = ctx.getImageData(0, 0, 128, 128);
        const data = imageData.data;

        // X1の8色に変換するための閾値
        const threshold = 128;

        // 256文字を読み込み
        for (let charCode = 0; charCode < 256; charCode++) {
          const charX = (charCode % 16) * 8;
          const charY = Math.floor(charCode / 16) * 8;

          for (let py = 0; py < 8; py++) {
            for (let px = 0; px < 8; px++) {
              const i = ((charY + py) * 128 + (charX + px)) * 4;
              const r = data[i] >= threshold ? 1 : 0;
              const g = data[i + 1] >= threshold ? 1 : 0;
              const b = data[i + 2] >= threshold ? 1 : 0;

              // X1色に変換（bit0=B, bit1=R, bit2=G）
              const color = (b | (r << 1) | (g << 2)) as X1Color;
              this.pcgData.setPixel(charCode, px, py, color);
            }
          }
        }

        // 定義エリアを更新
        this.definitionRenderer.render();
        this.showStatusMessage(`Loaded: ${file.name}`);
        this.scheduleSave();
      };

      img.src = URL.createObjectURL(file);
    };

    input.click();
  }

  /**
   * BIN形式で保存
   * @param start 開始文字コード
   * @param end 終了文字コード
   * @param x3mode 三倍速定義モード
   */
  private saveBin(start: number, end: number, x3mode: boolean): void {
    const count = end - start + 1;
    if (count <= 0) {
      this.showStatusMessage('Invalid range');
      return;
    }

    let data: Uint8Array;

    if (x3mode) {
      // 三倍速定義モード: B0,R0,G0, B1,R1,G1, ... の形式（行ごとにインターリーブ）
      // 1文字 = 8行 x 3プレーン = 24バイト
      data = new Uint8Array(count * 24);
      let offset = 0;
      for (let i = 0; i < count; i++) {
        const charData = this.pcgData.getCharacter(start + i);
        // 行ごとにB, R, Gをインターリーブ
        for (let row = 0; row < 8; row++) {
          data[offset++] = charData[row];      // B
          data[offset++] = charData[8 + row];  // R
          data[offset++] = charData[16 + row]; // G
        }
      }
    } else {
      // 通常モード: 各文字のデータをそのまま連結（B[8], R[8], G[8]）
      data = new Uint8Array(count * 24);
      let offset = 0;
      for (let i = 0; i < count; i++) {
        const charData = this.pcgData.getCharacter(start + i);
        data.set(charData, offset);
        offset += 24;
      }
    }

    // BINとしてダウンロード
    const blob = new Blob([data.buffer as ArrayBuffer], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = x3mode ? 'pcg_x3.bin' : 'pcg.bin';
    a.click();
    URL.revokeObjectURL(url);
    this.showStatusMessage(`Saved: ${a.download}`);
  }

  /**
   * BIN形式で読み込み
   * @param start 開始文字コード
   * @param x3mode 三倍速定義モード
   */
  private loadBin(start: number, x3mode: boolean): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.bin';

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      const buffer = await file.arrayBuffer();
      const data = new Uint8Array(buffer);

      // 文字数を計算
      const bytesPerChar = 24;
      const charCount = Math.floor(data.length / bytesPerChar);

      if (charCount === 0) {
        this.showStatusMessage('File too small');
        return;
      }

      // 範囲チェック
      if (start + charCount > 256) {
        this.showStatusMessage('Data exceeds 256 chars');
        return;
      }

      // 読み込み
      for (let i = 0; i < charCount; i++) {
        const charCode = start + i;
        const charData = new Uint8Array(24);

        if (x3mode) {
          // 三倍速定義モード: 行ごとにB, R, Gがインターリーブされている
          const srcOffset = i * 24;
          for (let row = 0; row < 8; row++) {
            charData[row] = data[srcOffset + row * 3];      // B
            charData[8 + row] = data[srcOffset + row * 3 + 1];  // R
            charData[16 + row] = data[srcOffset + row * 3 + 2]; // G
          }
        } else {
          // 通常モード: そのままコピー
          charData.set(data.slice(i * 24, (i + 1) * 24));
        }

        this.pcgData.setCharacter(charCode, charData);
      }

      // 定義エリアを更新
      this.definitionRenderer.render();
      this.showStatusMessage(`Loaded: ${charCount} chars from ${file.name}`);
      this.scheduleSave();
    };

    input.click();
  }

  /**
   * BAS形式で保存（BASIC ASCII形式）
   * @param start 開始文字コード
   * @param end 終了文字コード
   */
  private saveBas(start: number, end: number): void {
    const count = end - start + 1;
    if (count <= 0) {
      this.showStatusMessage('Invalid range');
      return;
    }

    // 行番号の開始（仕様書より60960から）
    const lineStart = 60960;
    const lines: string[] = [];

    for (let i = 0; i < count; i++) {
      const charCode = start + i;
      const charData = this.pcgData.getCharacter(charCode);

      // B[8], R[8], G[8] を16進文字列に変換
      let hexStr = '';
      for (let j = 0; j < 24; j++) {
        hexStr += charData[j].toString(16).toUpperCase().padStart(2, '0');
      }

      // DEFCHR$(code)=HEXCHR$("...")
      const lineNum = lineStart + i * 10;
      lines.push(`${lineNum} DEFCHR$(${charCode})=HEXCHR$("${hexStr}")`);
    }

    // BASファイルとしてダウンロード
    const content = lines.join('\r\n') + '\r\n';
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pcg.bas';
    a.click();
    URL.revokeObjectURL(url);
    this.showStatusMessage('Saved: pcg.bas');
  }

  /**
   * BAS形式で読み込み
   * @param start 開始文字コード（'start'モード時のみ使用）
   * @param mode 'start': STARTから連続読み込み, 'original': ファイル内のコードをそのまま使用
   */
  private loadBas(start: number, mode: 'start' | 'original'): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.bas,.txt';

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      const text = await file.text();
      const lines = text.split(/\r?\n/);

      // DEFCHR$パターン: 行番号 DEFCHR$(コード)=HEXCHR$("16進文字列")
      // コードは10進数
      const defchrPattern = /DEFCHR\$\s*\(\s*(\d+)\s*\)\s*=\s*HEXCHR\$\s*\(\s*"([0-9A-Fa-f]+)"\s*\)/i;

      let loadCount = 0;
      let currentCode = start;

      for (const line of lines) {
        const match = line.match(defchrPattern);
        if (!match) continue;

        const originalCode = parseInt(match[1], 10);
        const hexStr = match[2];

        // 48文字（24バイト x 2）でない場合はスキップ
        if (hexStr.length !== 48) {
          console.warn(`Invalid hex length for code ${originalCode}: ${hexStr.length}`);
          continue;
        }

        // 16進文字列をバイト配列に変換
        const charData = new Uint8Array(24);
        for (let i = 0; i < 24; i++) {
          charData[i] = parseInt(hexStr.substr(i * 2, 2), 16);
        }

        // 書き込み先コードを決定
        const targetCode = mode === 'original' ? originalCode : currentCode;

        // 範囲チェック
        if (targetCode < 0 || targetCode > 255) {
          console.warn(`Code out of range: ${targetCode}`);
          if (mode === 'start') currentCode++;
          continue;
        }

        this.pcgData.setCharacter(targetCode, charData);
        loadCount++;

        if (mode === 'start') {
          currentCode++;
          if (currentCode > 255) break;
        }
      }

      // 定義エリアを更新
      this.definitionRenderer.render();
      this.showStatusMessage(`Loaded: ${loadCount} chars from ${file.name}`);
      this.scheduleSave();
    };

    input.click();
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
   * 自動保存をスケジュール（デバウンス：500ms後に保存）
   */
  private scheduleSave(): void {
    if (this.saveTimeout !== null) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = window.setTimeout(() => {
      this.saveToLocalStorage();
      this.saveTimeout = null;
    }, 500);
  }

  /**
   * ローカルストレージにデータを保存
   */
  private saveToLocalStorage(): void {
    try {
      // PCGデータをBase64エンコードして保存
      const pcgDataArray = this.pcgData.getAllData();
      const pcgDataBase64 = this.uint8ArrayToBase64(pcgDataArray);
      localStorage.setItem(STORAGE_KEYS.PCG_DATA, pcgDataBase64);

      // 編集バッファをBase64エンコードして保存
      const editBufferArray = this.editBuffer.getAllData();
      const editBufferBase64 = this.uint8ArrayToBase64(editBufferArray);
      localStorage.setItem(STORAGE_KEYS.EDIT_BUFFER, editBufferBase64);

      // エディタ状態をJSONで保存
      const stateToSave = {
        editMode: this.editorState.editMode,
        cursorPosition: this.editorState.cursorPosition,
        currentColor: this.editorState.currentColor,
        lastDirection: this.editorState.lastDirection,
        currentCharCode: this.editorState.currentCharCode,
        editChrCode: this.editorState.editChrCode,
        gridVisible: this.gridVisible
      };
      localStorage.setItem(STORAGE_KEYS.EDITOR_STATE, JSON.stringify(stateToSave));

      console.log('[DEFCHRApp] Data saved to localStorage');
    } catch (e) {
      console.error('[DEFCHRApp] Failed to save to localStorage:', e);
    }
  }

  /**
   * ローカルストレージからデータを読み込み
   * @returns 読み込みに成功したかどうか
   */
  private loadFromLocalStorage(): boolean {
    try {
      const pcgDataBase64 = localStorage.getItem(STORAGE_KEYS.PCG_DATA);
      const editBufferBase64 = localStorage.getItem(STORAGE_KEYS.EDIT_BUFFER);
      const stateJson = localStorage.getItem(STORAGE_KEYS.EDITOR_STATE);

      // どれか一つでもなければ読み込み失敗
      if (!pcgDataBase64 || !editBufferBase64 || !stateJson) {
        console.log('[DEFCHRApp] No saved data found in localStorage');
        return false;
      }

      // PCGデータを復元
      const pcgDataArray = this.base64ToUint8Array(pcgDataBase64);
      this.pcgData.setAllData(pcgDataArray);

      // 編集バッファを復元
      const editBufferArray = this.base64ToUint8Array(editBufferBase64);
      this.editBuffer.setAllData(editBufferArray);

      // エディタ状態を復元
      const savedState = JSON.parse(stateJson);
      this.editorState.editMode = savedState.editMode ?? EditMode.SEPARATE;
      this.editorState.cursorPosition = savedState.cursorPosition ?? { x: 0, y: 0 };
      this.editorState.currentColor = savedState.currentColor ?? X1_COLORS.WHITE;
      this.editorState.lastDirection = savedState.lastDirection ?? Direction.RIGHT;
      this.editorState.currentCharCode = savedState.currentCharCode ?? 0;
      this.editorState.editChrCode = savedState.editChrCode ?? 0;
      this.gridVisible = savedState.gridVisible ?? true;

      // グリッド表示状態を反映
      this.editorRenderer.setShowGrid(this.gridVisible);

      // 選択中のキャラクターを反映
      this.definitionRenderer.setSelectedChar(this.editorState.currentCharCode);

      console.log('[DEFCHRApp] Data loaded from localStorage');
      return true;
    } catch (e) {
      console.error('[DEFCHRApp] Failed to load from localStorage:', e);
      return false;
    }
  }

  /**
   * Uint8ArrayをBase64文字列に変換
   */
  private uint8ArrayToBase64(array: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < array.length; i++) {
      binary += String.fromCharCode(array[i]);
    }
    return btoa(binary);
  }

  /**
   * Base64文字列をUint8Arrayに変換
   */
  private base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      array[i] = binary.charCodeAt(i);
    }
    return array;
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
    }, 2000);
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
