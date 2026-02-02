/**
 * Canvas管理クラス
 * ダブルバッファリングを使用した描画管理
 */

import { X1_WIDTH, X1_HEIGHT, ScreenMode } from '../core/types';

export class CanvasManager {
  /** フロントバッファ（表示用Canvas） */
  private frontCanvas: HTMLCanvasElement;
  private frontCtx: CanvasRenderingContext2D;

  /** バックバッファ（描画用Canvas） */
  private backCanvas: HTMLCanvasElement;
  private backCtx: CanvasRenderingContext2D;

  /** 現在の画面モード */
  private screenMode: ScreenMode = 'WIDTH40';

  /** 表示スケール */
  private scale: number = 2;

  constructor(canvas: HTMLCanvasElement) {
    this.frontCanvas = canvas;

    const frontCtx = canvas.getContext('2d');
    if (!frontCtx) {
      throw new Error('Failed to get 2D context');
    }
    this.frontCtx = frontCtx;

    // バックバッファを作成
    this.backCanvas = document.createElement('canvas');
    this.backCanvas.width = X1_WIDTH;
    this.backCanvas.height = X1_HEIGHT;

    const backCtx = this.backCanvas.getContext('2d');
    if (!backCtx) {
      throw new Error('Failed to get back buffer context');
    }
    this.backCtx = backCtx;

    // ピクセルパーフェクトな描画設定
    this.backCtx.imageSmoothingEnabled = false;
    this.frontCtx.imageSmoothingEnabled = false;

    // 初期サイズ設定
    this.resize();

    // リサイズ対応
    window.addEventListener('resize', () => this.resize());
  }

  /**
   * 画面モードを設定
   */
  setScreenMode(mode: ScreenMode): void {
    this.screenMode = mode;
    this.resize();
  }

  /**
   * 表示スケールを設定
   */
  setScale(scale: number): void {
    this.scale = Math.max(1, Math.min(4, scale));
    this.resize();
  }

  /**
   * キャンバスサイズを調整
   */
  private resize(): void {
    // WIDTH40は正方形ドット、WIDTH80は横半分（縦長ドット）
    const effectiveWidth = this.screenMode === 'WIDTH80' ? X1_WIDTH / 2 : X1_WIDTH;

    this.frontCanvas.width = effectiveWidth * this.scale;
    this.frontCanvas.height = X1_HEIGHT * this.scale;

    // スケーリング後もピクセルパーフェクト
    this.frontCtx.imageSmoothingEnabled = false;
  }

  /**
   * バックバッファの2Dコンテキストを取得
   */
  getBackContext(): CanvasRenderingContext2D {
    return this.backCtx;
  }

  /**
   * バックバッファをクリア
   */
  clear(color: string = '#000000'): void {
    this.backCtx.fillStyle = color;
    this.backCtx.fillRect(0, 0, X1_WIDTH, X1_HEIGHT);
  }

  /**
   * バックバッファをフロントバッファに転送
   */
  flip(): void {
    // 描画領域は変わらず、表示幅だけ変わる
    // WIDTH80では横半分に縮んで縦長ドットになる
    this.frontCtx.drawImage(
      this.backCanvas,
      0, 0, X1_WIDTH, X1_HEIGHT,
      0, 0, this.frontCanvas.width, this.frontCanvas.height
    );
  }

  /**
   * バックバッファのImageDataを取得
   */
  getImageData(): ImageData {
    return this.backCtx.getImageData(0, 0, X1_WIDTH, X1_HEIGHT);
  }

  /**
   * バックバッファにImageDataを設定
   */
  putImageData(imageData: ImageData): void {
    this.backCtx.putImageData(imageData, 0, 0);
  }

  /**
   * 現在の画面モードを取得
   */
  getScreenMode(): ScreenMode {
    return this.screenMode;
  }

  /**
   * 現在のスケールを取得
   */
  getScale(): number {
    return this.scale;
  }
}
