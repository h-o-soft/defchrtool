# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

DEFCHR TOOL for Web は、1980年代の SHARP X1 用 PCG（Programmable Character Generator）エディタをWebブラウザで再現するプロジェクト。8x8ドット・8色のPCGキャラクター256文字を編集する。

## 開発コマンド

```bash
npm run dev      # 開発サーバー起動（Vite HMR）
npm run build    # 本番ビルド（TypeScriptコンパイル + Vite）
npm run preview  # ビルド後のプレビュー
```

## アーキテクチャ

### 描画システム
- **ダブルバッファリング方式**: `CanvasManager` がバックバッファ（640x200）とフロントバッファを管理
- **X1互換フォント**: `X1Renderer` が `public/assets/fonts/X1font.png`（16x16グリッド=256文字）からビットマップを抽出し描画
- WIDTH 40（320x200）とWIDTH 80（640x200）モードに対応

### PCGデータ構造
- 1文字 = 24バイト（B/R/Gプレーン各8バイト）
- 全256文字 = 6,144バイト
- `Uint8Array` でビットプレーン形式を保持（X1ネイティブ表現）

### 主要クラス

| クラス | 役割 |
|--------|------|
| `DEFCHRApp` (main.ts) | アプリケーションコントローラー、状態管理 |
| `PCGData` | 256文字のPCGデータ管理、ピクセル単位のget/set |
| `X1Renderer` | フォント読み込み、文字描画、PCG描画 |
| `CanvasManager` | ダブルバッファリング、画面モード管理 |
| `EditorRenderer` | 16x16編集エリアの描画 |
| `DefinitionRenderer` | 256文字一覧の描画 |
| `InputHandler` | キーボード入力→イベント変換 |

### 編集モード（EditMode）
- `SEPARATE`: 4文字を独立編集
- `VERTICAL`: 縦2文字を1組
- `HORIZONTAL`: 横2文字を1組
- `ALL`: 4文字を1つの16x16画像として編集

## 技術スタック

- TypeScript + Vite（フレームワークなしのVanilla JS）
- Canvas 2D API + `ImageData` によるピクセル操作
- `image-rendering: pixelated` でドット表現

## 注意点

- UIは全てCanvas描画（DOM要素なし）でX1画面を忠実に再現
- キーボード入力は `KeyboardEvent.code` を使用（言語非依存）
