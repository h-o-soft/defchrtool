/**
 * 減色処理モジュール
 * x1pcgconvの減色ロジックをTypeScriptに移植
 */

import { X1Color } from './types';

/** 減色モード */
export type ColorReduceMode = 'none' | 'reduce' | 'dither' | 'edfs' | 'retro';

/** X1の8色パレット (RGB) */
const X1_PALETTE: [number, number, number][] = [
  [0, 0, 0],       // 0: 黒
  [0, 0, 255],     // 1: 青
  [255, 0, 0],     // 2: 赤
  [255, 0, 255],   // 3: マゼンタ
  [0, 255, 0],     // 4: 緑
  [0, 255, 255],   // 5: シアン
  [255, 255, 0],   // 6: 黄
  [255, 255, 255], // 7: 白
];

/** 4x4 ディザリングパターン (Bayer matrix) */
const DITHER_MATRIX = [
  [1,  9,  3,  11],
  [13, 5,  15, 7],
  [4,  12, 2,  10],
  [16, 8,  14, 6]
];

/**
 * RGB値からX1の色インデックスに変換
 * 色インデックス = B + R*2 + G*4
 */
function rgbToX1Color(r: number, g: number, b: number, threshold: number = 128): X1Color {
  const rBit = r >= threshold ? 1 : 0;
  const gBit = g >= threshold ? 1 : 0;
  const bBit = b >= threshold ? 1 : 0;
  return (bBit + rBit * 2 + gBit * 4) as X1Color;
}

/**
 * シグモイダルコントラスト調整
 */
function sigmoidalContrast(value: number, gain: number, midpoint: number): number {
  const normalized = value / 255;
  // シグモイド関数
  const sigmoid = (x: number) => 1 / (1 + Math.exp(-gain * (x - midpoint)));
  const result = sigmoid(normalized);
  // 正規化（0-255にマップ）
  const minVal = sigmoid(0);
  const maxVal = sigmoid(1);
  return Math.round(((result - minVal) / (maxVal - minVal)) * 255);
}

/**
 * 彩度を増強
 */
function enhanceSaturation(r: number, g: number, b: number, factor: number): [number, number, number] {
  // RGB to HSL
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;

  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (Math.max(r, g, b)) {
      case r:
        h = ((g - b) / 255 / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / 255 / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / 255 / d + 4) / 6;
        break;
    }
  }

  // 彩度を増強
  s = Math.min(1, s * factor);

  // HSL to RGB
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };

  let newR: number, newG: number, newB: number;
  if (s === 0) {
    newR = newG = newB = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    newR = hue2rgb(p, q, h + 1/3);
    newG = hue2rgb(p, q, h);
    newB = hue2rgb(p, q, h - 1/3);
  }

  return [
    Math.round(Math.max(0, Math.min(255, newR * 255))),
    Math.round(Math.max(0, Math.min(255, newG * 255))),
    Math.round(Math.max(0, Math.min(255, newB * 255)))
  ];
}

/**
 * reduce モード: 閾値128で単純二値化
 */
function reduceMode(imageData: ImageData): X1Color[][] {
  const result: X1Color[][] = [];
  const { width, height, data } = imageData;

  for (let y = 0; y < height; y++) {
    const row: X1Color[] = [];
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      row.push(rgbToX1Color(r, g, b, 128));
    }
    result.push(row);
  }
  return result;
}

/**
 * dither モード: 4x4順序付きディザリング
 */
function ditherMode(imageData: ImageData): X1Color[][] {
  const result: X1Color[][] = [];
  const { width, height, data } = imageData;

  for (let y = 0; y < height; y++) {
    const row: X1Color[] = [];
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // ディザリング閾値を計算（0-255の範囲にマップ）
      const threshold = (DITHER_MATRIX[y % 4][x % 4] / 17) * 255;

      row.push(rgbToX1Color(r, g, b, threshold));
    }
    result.push(row);
  }
  return result;
}

/**
 * edfs モード: Floyd-Steinberg誤差拡散法
 */
function edfsMode(imageData: ImageData): X1Color[][] {
  const { width, height, data } = imageData;

  // 作業用バッファ（誤差を含むので浮動小数点）
  const buffer: [number, number, number][][] = [];
  for (let y = 0; y < height; y++) {
    const row: [number, number, number][] = [];
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      row.push([data[idx], data[idx + 1], data[idx + 2]]);
    }
    buffer.push(row);
  }

  const result: X1Color[][] = [];

  for (let y = 0; y < height; y++) {
    const row: X1Color[] = [];
    // バイディレクショナル（偶数行は左→右、奇数行は右→左）
    const leftToRight = y % 2 === 0;
    const startX = leftToRight ? 0 : width - 1;
    const endX = leftToRight ? width : -1;
    const stepX = leftToRight ? 1 : -1;

    for (let x = startX; x !== endX; x += stepX) {
      const [r, g, b] = buffer[y][x];

      // 閾値で量子化
      const newR = r >= 128 ? 255 : 0;
      const newG = g >= 128 ? 255 : 0;
      const newB = b >= 128 ? 255 : 0;

      // 誤差計算
      const errR = r - newR;
      const errG = g - newG;
      const errB = b - newB;

      // 誤差拡散（Floyd-Steinberg係数）
      const diffuse = (dx: number, dy: number, weight: number) => {
        const nx = x + dx * stepX;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          buffer[ny][nx][0] += errR * weight;
          buffer[ny][nx][1] += errG * weight;
          buffer[ny][nx][2] += errB * weight;
        }
      };

      diffuse(1, 0, 7/16);   // 右
      diffuse(-1, 1, 3/16);  // 左下
      diffuse(0, 1, 5/16);   // 下
      diffuse(1, 1, 1/16);   // 右下

      // X1色に変換
      const color = rgbToX1Color(newR, newG, newB, 128);

      if (leftToRight) {
        row.push(color);
      } else {
        row.unshift(color);
      }
    }
    result.push(row);
  }

  return result;
}

/**
 * retro モード: シグモイダルコントラスト + 彩度増強 + ディザリング
 */
function retroMode(imageData: ImageData): X1Color[][] {
  const { width, height, data } = imageData;

  // 前処理済みデータを作成
  const processed = new Uint8ClampedArray(data.length);

  for (let i = 0; i < data.length; i += 4) {
    // シグモイダルコントラスト調整（ゲイン-8、中点0.5）
    let r = sigmoidalContrast(data[i], -8, 0.5);
    let g = sigmoidalContrast(data[i + 1], -8, 0.5);
    let b = sigmoidalContrast(data[i + 2], -8, 0.5);

    // 彩度増強（2.0倍）
    [r, g, b] = enhanceSaturation(r, g, b, 2.0);

    processed[i] = r;
    processed[i + 1] = g;
    processed[i + 2] = b;
    processed[i + 3] = 255;
  }

  // 9段階ディザリング用の修正パターン
  const result: X1Color[][] = [];

  for (let y = 0; y < height; y++) {
    const row: X1Color[] = [];
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = processed[idx];
      const g = processed[idx + 1];
      const b = processed[idx + 2];

      // 9段階に調整したディザリング閾値
      const ditherValue = DITHER_MATRIX[y % 4][x % 4];
      const threshold = 28 + (ditherValue / 17) * 200; // 28-228の範囲

      row.push(rgbToX1Color(r, g, b, threshold));
    }
    result.push(row);
  }

  return result;
}

/**
 * 画像を減色してX1の8色に変換
 * @param imageData 入力画像データ
 * @param mode 減色モード
 * @returns X1色の2次元配列
 */
export function reduceColors(imageData: ImageData, mode: ColorReduceMode): X1Color[][] {
  switch (mode) {
    case 'reduce':
      return reduceMode(imageData);
    case 'dither':
      return ditherMode(imageData);
    case 'edfs':
      return edfsMode(imageData);
    case 'retro':
      return retroMode(imageData);
    case 'none':
    default:
      // 直接変換（厳密な8色のみ対応）
      return reduceMode(imageData);
  }
}

/**
 * 画像がX1の8色のみで構成されているかチェック
 */
export function isExactX1Colors(imageData: ImageData): boolean {
  const { width, height, data } = imageData;

  for (let i = 0; i < width * height * 4; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // X1パレットに完全一致するか確認
    const isX1Color = X1_PALETTE.some(([pr, pg, pb]) =>
      r === pr && g === pg && b === pb
    );

    if (!isX1Color) {
      return false;
    }
  }

  return true;
}
