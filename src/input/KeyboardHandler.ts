/**
 * キーボード入力ハンドラ
 */

export type KeyCallback = (key: string, event: KeyboardEvent) => void;

export class KeyboardHandler {
  private keyDownCallbacks: Set<KeyCallback> = new Set();
  private keyUpCallbacks: Set<KeyCallback> = new Set();

  /** 現在押されているキー */
  private pressedKeys: Set<string> = new Set();

  constructor() {
    this.setupListeners();
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
    // リピートは無視
    if (event.repeat) return;

    this.pressedKeys.add(event.key);
    this.keyDownCallbacks.forEach(cb => cb(event.key, event));
  }

  /**
   * キーアップイベント処理
   */
  private handleKeyUp(event: KeyboardEvent): void {
    this.pressedKeys.delete(event.key);
    this.keyUpCallbacks.forEach(cb => cb(event.key, event));
  }

  /**
   * キーダウンコールバックを登録
   */
  onKeyDown(callback: KeyCallback): void {
    this.keyDownCallbacks.add(callback);
  }

  /**
   * キーダウンコールバックを解除
   */
  offKeyDown(callback: KeyCallback): void {
    this.keyDownCallbacks.delete(callback);
  }

  /**
   * キーアップコールバックを登録
   */
  onKeyUp(callback: KeyCallback): void {
    this.keyUpCallbacks.add(callback);
  }

  /**
   * キーアップコールバックを解除
   */
  offKeyUp(callback: KeyCallback): void {
    this.keyUpCallbacks.delete(callback);
  }

  /**
   * 指定したキーが押されているか
   */
  isKeyPressed(key: string): boolean {
    return this.pressedKeys.has(key);
  }

  /**
   * 押されている全てのキーを取得
   */
  getPressedKeys(): Set<string> {
    return new Set(this.pressedKeys);
  }

  /**
   * リソースを解放
   */
  dispose(): void {
    this.keyDownCallbacks.clear();
    this.keyUpCallbacks.clear();
    this.pressedKeys.clear();
  }
}
