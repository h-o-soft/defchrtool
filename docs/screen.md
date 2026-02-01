# DEFCHR TOOL for Web 画面構成
```
    ***** Character maker *****
+----------------+  +0123456789ABCDEF+
|                |  0                0
|                |  1                1
|                |  2                2
|                |  3                3
|                |  4                4
|                |  5                5
|                |  6                6
|                |  7                7
|                |  8                8
|                |  9                9
|                |  A                A
|                |  B                B
|                |  C                C
|                |  D                D
|                |  E                E
|                |  F                F
+----------------+  +0123456789ABCDEF+
><^v..CURSOR MOVE   :0ｶﾗ7.POINT SET
M.....EDIT MODE=X   :C....COLOR CHANGE
E.....EDIT CHR.(??) :S....SET CHR.
CLR...CLS  !...END  :R....ROTATION
P.....PROGRAMMING   :T....TRANSFER
```
- 全体的に黒背景
- Character makerの文字は白
- 枠は水色。仮にASCII文字で描画したが実際はX1の罫線文字(特殊文字の項を参照)
- メニュー文字列の最初の二行は白文字
- E、S、CLR、Rのそれぞれは水色文字
- !...ENDは赤文字
- P、Tは黄色文字
- EDIT MODEのXのところはEDIT MODEにより白い四角が赤い線で区切られた画像になる


## 特殊文字

X1の特殊文字としては罫線と矢印が上記で使われている。それぞれの文字コードは下記である。

─ ... 0x90
│ ... 0x91
┐ ... 0x98
┘ ... 0x99
└ ... 0x9A
┌ ... 0x9B

→ ... 0x1C
← ... 0x1D
↑ ... 0x1E
↓ ... 0x1F

また、カナ文字はShiftJISのカタカナのコードを使う事(本ツールでは使われていない)。

