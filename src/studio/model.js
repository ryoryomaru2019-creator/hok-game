// Data Models & High-Fidelity Character Presets for Character Studio

import { computeCurvatureHandles } from './pathUtils.js';

/**
 * パーツ（レイヤー）の基本定義
 */
export function createPart(options = {}) {
  const points = options.points || [];
  if (options.useCurvature) {
    computeCurvatureHandles(points, options.closed !== false);
  }

  return {
    id: options.id || `part_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    name: options.name || '新規パーツ',
    type: options.type || 'body', // 'body_front', 'body_mid', 'body_back', 'fin_tail', 'fin_dorsal', 'fin_ventral', 'fin_pectoral', 'eyes', 'mouth', 'decoration', 'text'
    parentId: options.parentId || null, // 親パーツのID (階層リグ)
    locked: options.locked || false, // レイヤーロック
    pivot: options.pivot || { x: 0, y: 0 }, // 回転・拡縮の中心点
    zIndex: options.zIndex || 0,
    visible: options.visible !== false,
    closed: options.closed !== false,
    points: points, // [ { x, y, type: 'corner'|'smooth', inHandle: {x,y}, outHandle: {x,y} } ]
    text: options.text || options.textLabel || '',
    fontFamily: options.fontFamily || options.style?.fontFamily || '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif',
    fontSize: options.fontSize || options.style?.fontSize || 80,
    style: {
      fill: options.fill || (options.style && options.style.fill) || '#38bdf8',
      stroke: options.stroke || (options.style && options.style.stroke) || '#0f172a',
      strokeWidth: options.strokeWidth !== undefined ? options.strokeWidth : (options.style?.strokeWidth ?? 2),
      opacity: options.opacity !== undefined ? options.opacity : (options.style?.opacity ?? 1.0),
      strokePosition: options.strokePosition || (options.style?.strokePosition || 'center'),
      fontSize: options.fontSize || options.style?.fontSize || 80,
      fontFamily: options.fontFamily || options.style?.fontFamily || '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif'
    },
    subPaths: options.subPaths || [], // 付帯ベクター
    shapeType: options.shapeType || null, // 'rect' | 'ellipse' | 'triangle' | null
    textLabel: options.textLabel || options.text || null, // テキストラベル
  };
}

/**
 * 円形パーツを4点ベジェ曲線で近似して生成する
 * Photoshop と同じ k=0.5522847 の曲率でほぼ真円になる
 */
export function createCirclePart(options = {}) {
  const k = 0.5522847;
  const cx = options.cx || 0;
  const cy = options.cy || 0;
  const r  = options.r  || 10;
  return createPart({
    ...options,
    closed: true,
    pivot: options.pivot || { x: cx, y: cy },
    points: [
      { x: cx + r, y: cy,     type: 'smooth',
        inHandle:  { x: cx + r, y: cy + r * k }, outHandle: { x: cx + r, y: cy - r * k } },
      { x: cx,     y: cy - r, type: 'smooth',
        inHandle:  { x: cx + r * k, y: cy - r }, outHandle: { x: cx - r * k, y: cy - r } },
      { x: cx - r, y: cy,     type: 'smooth',
        inHandle:  { x: cx - r, y: cy - r * k }, outHandle: { x: cx - r, y: cy + r * k } },
      { x: cx,     y: cy + r, type: 'smooth',
        inHandle:  { x: cx - r * k, y: cy + r }, outHandle: { x: cx + r * k, y: cy + r } }
    ]
  });
}

/**
 * 部位構成・パーツ構成から自動的に高品質モーション (swim/idle/flee/angry) を生成する
 */
export function generateDefaultRigAnimations(parts = [], species = 'fish') {
  if (!parts || parts.length === 0) return {};

  const tracksSwim = {};
  const tracksIdle = {};
  const tracksFlee = {};
  const tracksAngry = {};

  for (const p of parts) {
    const id = p.id;
    const type = (p.type || '').toLowerCase();
    const name = (p.name || '').toLowerCase();

    // 1. 尾びれ・尻尾
    if (type.includes('tail') || name.includes('尾') || name.includes('tail') || name.includes('尻尾')) {
      tracksSwim[id] = [
        { time: 0.0, rot: 0, tx: 0, ty: 0 },
        { time: 0.25, rot: 16, tx: -1, ty: 2 },
        { time: 0.5, rot: 0, tx: 0, ty: 0 },
        { time: 0.75, rot: -16, tx: -1, ty: -2 },
        { time: 1.0, rot: 0, tx: 0, ty: 0 }
      ];
      tracksIdle[id] = [
        { time: 0.0, rot: 0 },
        { time: 0.5, rot: -6 },
        { time: 1.0, rot: 0 }
      ];
      tracksFlee[id] = [
        { time: 0.0, rot: 0 },
        { time: 0.25, rot: 26 },
        { time: 0.5, rot: 0 },
        { time: 0.75, rot: -26 },
        { time: 1.0, rot: 0 }
      ];
      tracksAngry[id] = [
        { time: 0.0, rot: 0 },
        { time: 0.25, rot: 10 },
        { time: 0.75, rot: -10 },
        { time: 1.0, rot: 0 }
      ];
    }
    // 2. 胴体・本体後部
    else if (type.includes('body_back') || name.includes('後部') || name.includes('腰')) {
      tracksSwim[id] = [
        { time: 0.0, rot: 0, tx: 0, ty: 0 },
        { time: 0.25, rot: -7, tx: 0, ty: -1 },
        { time: 0.5, rot: 0, tx: 0, ty: 0 },
        { time: 0.75, rot: 7, tx: 0, ty: 1 },
        { time: 1.0, rot: 0, tx: 0, ty: 0 }
      ];
      tracksIdle[id] = [
        { time: 0.0, ty: 0 },
        { time: 0.5, ty: -2 },
        { time: 1.0, ty: 0 }
      ];
      tracksFlee[id] = [
        { time: 0.0, rot: 0 },
        { time: 0.25, rot: -12 },
        { time: 0.5, rot: 0 },
        { time: 0.75, rot: 12 },
        { time: 1.0, rot: 0 }
      ];
    }
    // 3. 胴体中央・本体
    else if (type.includes('body_mid') || (type.includes('body') && !type.includes('front')) || name.includes('胴体') || name.includes('体') || name.includes('body')) {
      tracksSwim[id] = [
        { time: 0.0, rot: 0, tx: 0, ty: 0 },
        { time: 0.25, rot: -4, tx: 0, ty: -2 },
        { time: 0.5, rot: 0, tx: 0, ty: 0 },
        { time: 0.75, rot: 4, tx: 0, ty: 2 },
        { time: 1.0, rot: 0, tx: 0, ty: 0 }
      ];
      tracksIdle[id] = [
        { time: 0.0, ty: 0 },
        { time: 0.5, ty: -3 },
        { time: 1.0, ty: 0 }
      ];
      tracksFlee[id] = [
        { time: 0.0, rot: 0, ty: 0 },
        { time: 0.25, rot: -6, ty: -4 },
        { time: 0.5, rot: 0, ty: 0 },
        { time: 0.75, rot: 6, ty: 4 },
        { time: 1.0, rot: 0, ty: 0 }
      ];
    }
    // 4. 胸ビレ・ヒレ・翼・前足
    else if (type.includes('fin_pectoral') || type.includes('flipper') || type.includes('wing') || type.includes('arm') || name.includes('胸びれ') || name.includes('ヒレ') || name.includes('翼') || name.includes('手')) {
      tracksSwim[id] = [
        { time: 0.0, rot: 0, sx: 1 },
        { time: 0.5, rot: -16, sx: 0.85 },
        { time: 1.0, rot: 0, sx: 1 }
      ];
      tracksIdle[id] = [
        { time: 0.0, rot: 0 },
        { time: 0.5, rot: -6 },
        { time: 1.0, rot: 0 }
      ];
      tracksFlee[id] = [
        { time: 0.0, rot: 0 },
        { time: 0.5, rot: -24 },
        { time: 1.0, rot: 0 }
      ];
    }
    // 5. 背びれ・腹びれ
    else if (type.includes('fin_dorsal') || type.includes('fin_ventral') || name.includes('背びれ') || name.includes('腹びれ')) {
      tracksSwim[id] = [
        { time: 0.0, rot: 0, sy: 1 },
        { time: 0.5, rot: 4, sy: 0.92 },
        { time: 1.0, rot: 0, sy: 1 }
      ];
      tracksFlee[id] = [
        { time: 0.0, rot: 0 },
        { time: 0.5, rot: 8 },
        { time: 1.0, rot: 0 }
      ];
    }
    // 6. 頭部・顔
    else if (type.includes('head') || type.includes('body_front') || name.includes('頭') || name.includes('顔')) {
      tracksSwim[id] = [
        { time: 0.0, rot: 0, ty: 0 },
        { time: 0.3, rot: -2, ty: -1.5 },
        { time: 0.7, rot: 2, ty: 1.5 },
        { time: 1.0, rot: 0, ty: 0 }
      ];
      tracksIdle[id] = [
        { time: 0.0, rot: 0, ty: 0 },
        { time: 0.5, rot: 2, ty: -3 },
        { time: 1.0, rot: 0, ty: 0 }
      ];
      tracksAngry[id] = [
        { time: 0.0, rot: 0, sx: 1, sy: 1 },
        { time: 0.25, rot: -7, sx: 1.06, sy: 0.94 },
        { time: 0.5, rot: 7, sx: 0.95, sy: 1.05 },
        { time: 0.75, rot: -5, sx: 1.04, sy: 0.96 },
        { time: 1.0, rot: 0, sx: 1, sy: 1 }
      ];
    }
    // 7. 口・顎
    else if (type.includes('mouth') || name.includes('口') || name.includes('顎') || name.includes('jaw')) {
      tracksSwim[id] = [
        { time: 0.0, rot: 0 },
        { time: 0.5, rot: 6 },
        { time: 1.0, rot: 0 }
      ];
      tracksAngry[id] = [
        { time: 0.0, rot: 0 },
        { time: 0.3, rot: 14 },
        { time: 0.7, rot: 10 },
        { time: 1.0, rot: 0 }
      ];
    }
    // 8. チョンマゲ・ツノ・触手・装飾
    else if (name.includes('チョンマゲ') || name.includes('髪') || name.includes('触手') || name.includes('ツノ')) {
      tracksSwim[id] = [
        { time: 0.0, rot: 0 },
        { time: 0.35, rot: -10 },
        { time: 0.7, rot: 8 },
        { time: 1.0, rot: 0 }
      ];
      tracksIdle[id] = [
        { time: 0.0, rot: 0 },
        { time: 0.5, rot: -5 },
        { time: 1.0, rot: 0 }
      ];
      tracksFlee[id] = [
        { time: 0.0, rot: 0 },
        { time: 0.5, rot: -18 },
        { time: 1.0, rot: 0 }
      ];
      tracksAngry[id] = [
        { time: 0.0, rot: 0 },
        { time: 0.25, rot: 15 },
        { time: 0.5, rot: -15 },
        { time: 1.0, rot: 0 }
      ];
    }
  }

  // もし1つもトラックが作られなかった場合のフォールバック（ルートパーツを揺らす）
  if (Object.keys(tracksSwim).length === 0 && parts.length > 0) {
    const rootPart = parts.find(p => !p.parentId) || parts[0];
    tracksSwim[rootPart.id] = [
      { time: 0.0, rot: 0, ty: 0 },
      { time: 0.25, rot: -5, ty: -3 },
      { time: 0.5, rot: 0, ty: 0 },
      { time: 0.75, rot: 5, ty: 3 },
      { time: 1.0, rot: 0, ty: 0 }
    ];
    tracksIdle[rootPart.id] = [
      { time: 0.0, ty: 0 },
      { time: 0.5, ty: -3 },
      { time: 1.0, ty: 0 }
    ];
  }

  return {
    swim: { id: 'swim', name: '通常遊泳 (Swim)', duration: 1.0, loop: true, tracks: tracksSwim },
    idle: { id: 'idle', name: '待機・浮遊 (Idle)', duration: 1.8, loop: true, tracks: tracksIdle },
    flee: { id: 'flee', name: '高速逃走 (Flee)', duration: 0.5, loop: true, tracks: tracksFlee },
    angry: { id: 'angry', name: '怒り・威嚇 (Angry)', duration: 0.5, loop: true, tracks: tracksAngry }
  };
}

/**
 * キャラクター構造体
 */
export function createCharacter(options = {}) {
  const parts = options.parts || [];
  let anims = options.animations;
  // アニメーションが指定されていない、または空の場合はパーツ構成から自動生成して搭載
  if (!anims || Object.keys(anims).length === 0) {
    anims = generateDefaultRigAnimations(parts, options.species);
  }

  return {
    id: options.id || 'hirame',
    name: options.name || 'ヒラメ',
    species: options.species || 'fish', // 'fish', 'octopus', 'squid', 'ray', 'dried'
    facing: options.facing || -1, // -1: 左向き(ヒラメ), 1: 右向き(カレイ)
    parts: parts,
    animations: anims,
    reactions: options.reactions || {
      touchCorrect: 'happy',
      touchWrong: 'flee',
      alertDistance: 120,
      angerStages: 3,
      fleeSpeedMultiplier: 2.2,
      silhouetteDepthThreshold: 0.55
    }
  };
}

// ========================================================
// 高クオリティ初期プリセット定義（ゲーム本編と完全合致）
// ========================================================

/**
 * 1. ヒラメ（Hirame）プリセット
 * - 左向き正位置、カレイと同形・同サイズの身体（本体中央、本体後部、背びれ、腹びれ、尾びれ）を左右反転で完全共有
 * - 添付画像準拠: 暗オリーブ褐色ベース、淡いクリーム色のヒレ、大きく突出した受け口、鋭い白い牙
 */
export function getHiramePreset() {
  const HIRAME_BODY = '#453d33';
  const HIRAME_FIN = '#d5ceb8';
  const HIRAME_FIN_OUTLINE = '#383226';
  const HIRAME_OUTLINE = '#1c1814';
  const HIRAME_TAIL = '#3d352b';
  const HIRAME_DOT_DARK = '#2b251e';
  const HIRAME_DOT_LIGHT = '#5c5446';

  const parts = [
    // 1. 扇形の尾びれ (右側・カレイ尾びれの左右反転・同形同サイズ)
    createPart({
      id: 'hirame_tail',
      name: '尾びれ (扇形)',
      type: 'fin_tail',
      parentId: 'hirame_body_back',
      pivot: { x: 45, y: 0 },
      zIndex: 1,
      fill: HIRAME_TAIL,
      stroke: HIRAME_OUTLINE,
      strokeWidth: 2.8,
      closed: true,
      points: [
        { x: 45, y: -8, type: 'corner', inHandle: { x: 45, y: -8 }, outHandle: { x: 58, y: -18 } },
        { x: 85, y: -26, type: 'corner', inHandle: { x: 75, y: -24 }, outHandle: { x: 88, y: -10 } },
        { x: 90, y: 0, type: 'smooth', inHandle: { x: 88, y: -10 }, outHandle: { x: 88, y: 10 } },
        { x: 85, y: 26, type: 'corner', inHandle: { x: 88, y: 10 }, outHandle: { x: 75, y: 24 } },
        { x: 45, y: 8, type: 'corner', inHandle: { x: 58, y: 18 }, outHandle: { x: 45, y: 8 } }
      ]
    }),

    // 2. アーチ状背ビレ (上側・カレイ背びれの左右反転・同形同サイズ・淡いクリーム色)
    createPart({
      id: 'hirame_dorsal',
      name: '背びれ (上側アーチ)',
      type: 'fin_dorsal',
      parentId: 'hirame_body_mid',
      pivot: { x: 0, y: -20 },
      zIndex: 2,
      fill: HIRAME_FIN,
      stroke: HIRAME_FIN_OUTLINE,
      strokeWidth: 2.8,
      closed: true,
      points: [
        { x: 42, y: -10, type: 'corner', inHandle: { x: 42, y: -10 }, outHandle: { x: 20, y: -35 } },
        { x: -5, y: -40, type: 'smooth', inHandle: { x: 15, y: -40 }, outHandle: { x: -25, y: -30 } },
        { x: -42, y: -18, type: 'corner', inHandle: { x: -35, y: -25 }, outHandle: { x: -42, y: -18 } },
        { x: -32, y: -12, type: 'corner', inHandle: { x: -32, y: -12 }, outHandle: { x: -15, y: -22 } },
        { x: 25, y: -8, type: 'smooth', inHandle: { x: 0, y: -18 }, outHandle: { x: 35, y: -8 } }
      ]
    }),

    // 3. アーチ状腹ビレ (下側・カレイ腹びれの左右反転・同形同サイズ・淡いクリーム色)
    createPart({
      id: 'hirame_ventral',
      name: '腹びれ (下側アーチ)',
      type: 'fin_ventral',
      parentId: 'hirame_body_mid',
      pivot: { x: 0, y: 20 },
      zIndex: 2,
      fill: HIRAME_FIN,
      stroke: HIRAME_FIN_OUTLINE,
      strokeWidth: 2.8,
      closed: true,
      points: [
        { x: 42, y: 10, type: 'corner', inHandle: { x: 42, y: 10 }, outHandle: { x: 20, y: 35 } },
        { x: 0, y: 42, type: 'smooth', inHandle: { x: 18, y: 38 }, outHandle: { x: -20, y: 36 } },
        { x: -36, y: 18, type: 'corner', inHandle: { x: -28, y: 26 }, outHandle: { x: -36, y: 18 } },
        { x: -25, y: 12, type: 'corner', inHandle: { x: -25, y: 12 }, outHandle: { x: 0, y: 20 } },
        { x: 25, y: 8, type: 'smooth', inHandle: { x: 10, y: 16 }, outHandle: { x: 35, y: 8 } }
      ]
    }),

    // 4. 本体後部 (カレイ本体後部の左右反転・同形同サイズ)
    createPart({
      id: 'hirame_body_back',
      name: '本体後部',
      type: 'body_back',
      parentId: 'hirame_body_mid',
      pivot: { x: 15, y: 0 },
      zIndex: 3,
      fill: HIRAME_BODY,
      stroke: HIRAME_OUTLINE,
      strokeWidth: 2.8,
      closed: true,
      points: [
        { x: 15, y: -18, type: 'smooth', inHandle: { x: 8, y: -18 }, outHandle: { x: 32, y: -12 } },
        { x: 45, y: -8, type: 'corner', inHandle: { x: 38, y: -10 }, outHandle: { x: 45, y: 0 } },
        { x: 45, y: 8, type: 'corner', inHandle: { x: 45, y: 0 }, outHandle: { x: 38, y: 10 } },
        { x: 15, y: 18, type: 'smooth', inHandle: { x: 32, y: 12 }, outHandle: { x: 8, y: 18 } }
      ]
    }),

    // 5. 本体中央 (カレイ本体中央の左右反転・同形同サイズ・暗オリーブ褐色)
    createPart({
      id: 'hirame_body_mid',
      name: '本体中央 (胴体)',
      type: 'body_mid',
      parentId: 'hirame_head',
      pivot: { x: -15, y: 0 },
      zIndex: 4,
      fill: HIRAME_BODY,
      stroke: HIRAME_OUTLINE,
      strokeWidth: 3,
      closed: true,
      points: [
        { x: -30, y: -16, type: 'smooth', inHandle: { x: -35, y: -12 }, outHandle: { x: -10, y: -26 } },
        { x: -5, y: -28, type: 'smooth', inHandle: { x: -15, y: -28 }, outHandle: { x: 15, y: -20 } },
        { x: 20, y: 0, type: 'smooth', inHandle: { x: 18, y: -12 }, outHandle: { x: 18, y: 12 } },
        { x: 0, y: 28, type: 'smooth', inHandle: { x: 15, y: 22 }, outHandle: { x: -15, y: 28 } },
        { x: -30, y: 16, type: 'smooth', inHandle: { x: -15, y: 26 }, outHandle: { x: -35, y: 12 } }
      ]
    }),

    // ── ヒラメの斑点模様 (暗色と明色の斑点) ──
    createCirclePart({ id: 'hirame_spot_1', name: '斑点 1 (前上)', type: 'decoration', parentId: 'hirame_body_mid', cx: -15, cy: -8, r: 3.8, zIndex: 4.2, fill: HIRAME_DOT_DARK, stroke: 'none', strokeWidth: 0 }),
    createCirclePart({ id: 'hirame_spot_2', name: '斑点 2 (背頂)', type: 'decoration', parentId: 'hirame_body_mid', cx: 0, cy: -14, r: 4.2, zIndex: 4.2, fill: HIRAME_DOT_LIGHT, stroke: 'none', strokeWidth: 0 }),
    createCirclePart({ id: 'hirame_spot_3', name: '斑点 3 (後上)', type: 'decoration', parentId: 'hirame_body_mid', cx: 15, cy: -8, r: 3.5, zIndex: 4.2, fill: HIRAME_DOT_DARK, stroke: 'none', strokeWidth: 0 }),
    createCirclePart({ id: 'hirame_spot_4', name: '斑点 4 (前下)', type: 'decoration', parentId: 'hirame_body_mid', cx: -18, cy: 8, r: 4.0, zIndex: 4.2, fill: HIRAME_DOT_LIGHT, stroke: 'none', strokeWidth: 0 }),
    createCirclePart({ id: 'hirame_spot_5', name: '斑点 5 (腹頂)', type: 'decoration', parentId: 'hirame_body_mid', cx: -4, cy: 14, r: 4.2, zIndex: 4.2, fill: HIRAME_DOT_DARK, stroke: 'none', strokeWidth: 0 }),
    createCirclePart({ id: 'hirame_spot_6', name: '斑点 6 (後下)', type: 'decoration', parentId: 'hirame_body_mid', cx: 10, cy: 10, r: 3.5, zIndex: 4.2, fill: HIRAME_DOT_LIGHT, stroke: 'none', strokeWidth: 0 }),
    createCirclePart({ id: 'hirame_spot_7', name: '斑点 7 (中心)', type: 'decoration', parentId: 'hirame_body_mid', cx: 0, cy: -1, r: 3.8, zIndex: 4.2, fill: HIRAME_DOT_DARK, stroke: 'none', strokeWidth: 0 }),

    // 6. 頭部・上顎 (添付画像準拠: 大きく開いた口・力強い顎ライン)
    createPart({
      id: 'hirame_head',
      name: '本体前 (頭部・上顎)',
      type: 'body_front',
      parentId: null,
      pivot: { x: -30, y: 0 },
      zIndex: 5,
      fill: HIRAME_BODY,
      stroke: HIRAME_OUTLINE,
      strokeWidth: 3,
      closed: true,
      points: [
        { x: -30, y: -16, type: 'corner', inHandle: { x: -30, y: -16 }, outHandle: { x: -44, y: -12 } },
        { x: -56, y: -6, type: 'corner', inHandle: { x: -48, y: -10 }, outHandle: { x: -56, y: -6 } }, // 上顎先端
        { x: -44, y: 2, type: 'corner', inHandle: { x: -50, y: 0 }, outHandle: { x: -44, y: 2 } },    // 口の奥
        { x: -64, y: 9, type: 'corner', inHandle: { x: -52, y: 4 }, outHandle: { x: -64, y: 9 } },   // 下顎先端
        { x: -50, y: 15, type: 'corner', inHandle: { x: -58, y: 14 }, outHandle: { x: -42, y: 16 } },
        { x: -30, y: 16, type: 'corner', inHandle: { x: -38, y: 15 }, outHandle: { x: -30, y: 16 } }
      ]
    }),

    // 7. エラ蓋ライン
    createPart({
      id: 'hirame_gill',
      name: 'エラ蓋',
      type: 'decoration',
      parentId: 'hirame_head',
      pivot: { x: -35, y: 0 },
      zIndex: 5.5,
      fill: 'none',
      stroke: HIRAME_OUTLINE,
      strokeWidth: 2.2,
      closed: false,
      points: [
        { x: -38, y: -14, type: 'corner', inHandle: { x: -38, y: -14 }, outHandle: { x: -42, y: -5 } },
        { x: -40, y: 2, type: 'smooth', inHandle: { x: -42, y: -5 }, outHandle: { x: -40, y: 8 } },
        { x: -34, y: 14, type: 'corner', inHandle: { x: -38, y: 10 }, outHandle: { x: -34, y: 14 } }
      ]
    }),

    // 8. ── 口の中 (赤い口腔) ──
    createPart({
      id: 'hirame_mouth_inside',
      name: '口の中 (暗赤色口腔)',
      type: 'mouth',
      parentId: 'hirame_head',
      pivot: { x: -50, y: 2 },
      zIndex: 5.2,
      fill: '#4a0e0e',
      stroke: '#200505',
      strokeWidth: 1,
      closed: true,
      points: [
        { x: -56, y: -5, type: 'corner', inHandle: { x: -56, y: -5 }, outHandle: { x: -48, y: -2 } },
        { x: -44, y: 2, type: 'corner', inHandle: { x: -46, y: 1 }, outHandle: { x: -48, y: 5 } },
        { x: -64, y: 9, type: 'corner', inHandle: { x: -54, y: 6 }, outHandle: { x: -64, y: 9 } }
      ]
    }),

    // 9. ── 突出した下顎 (受け口フォルム) ──
    createPart({
      id: 'hirame_jaw',
      name: '口 (受け口下顎)',
      type: 'mouth',
      parentId: 'hirame_head',
      pivot: { x: -44, y: 2 },
      zIndex: 5.8,
      fill: HIRAME_BODY,
      stroke: HIRAME_OUTLINE,
      strokeWidth: 2.5,
      closed: true,
      points: [
        { x: -44, y: 2, type: 'corner', inHandle: { x: -44, y: 2 }, outHandle: { x: -52, y: 5 } },
        { x: -64, y: 9, type: 'corner', inHandle: { x: -58, y: 8 }, outHandle: { x: -62, y: 14 } }, // 突出下顎先端！
        { x: -50, y: 15, type: 'smooth', inHandle: { x: -58, y: 14 }, outHandle: { x: -42, y: 16 } },
        { x: -38, y: 10, type: 'corner', inHandle: { x: -40, y: 12 }, outHandle: { x: -44, y: 2 } }
      ]
    }),

    // 10. ── 上顎の鋭い牙群 ──
    createPart({
      id: 'hirame_teeth_upper',
      name: '牙 (上顎の白い牙)',
      type: 'decoration',
      parentId: 'hirame_head',
      pivot: { x: -50, y: -2 },
      zIndex: 6.2,
      fill: '#ffffff',
      stroke: '#1c1814',
      strokeWidth: 0.8,
      closed: true,
      points: [
        { x: -55, y: -5, type: 'corner', inHandle: { x: -55, y: -5 }, outHandle: { x: -55, y: -5 } },
        { x: -53, y: 0, type: 'corner', inHandle: { x: -53, y: 0 }, outHandle: { x: -53, y: 0 } },
        { x: -51, y: -4, type: 'corner', inHandle: { x: -51, y: -4 }, outHandle: { x: -51, y: -4 } },
        { x: -49, y: 1, type: 'corner', inHandle: { x: -49, y: 1 }, outHandle: { x: -49, y: 1 } },
        { x: -47, y: -2, type: 'corner', inHandle: { x: -47, y: -2 }, outHandle: { x: -47, y: -2 } }
      ]
    }),

    // 11. ── 下顎の鋭い牙群 ──
    createPart({
      id: 'hirame_teeth_lower',
      name: '牙 (下顎の白い牙)',
      type: 'decoration',
      parentId: 'hirame_jaw',
      pivot: { x: -56, y: 6 },
      zIndex: 6.3,
      fill: '#ffffff',
      stroke: '#1c1814',
      strokeWidth: 0.8,
      closed: true,
      points: [
        { x: -61, y: 8, type: 'corner', inHandle: { x: -61, y: 8 }, outHandle: { x: -61, y: 8 } },
        { x: -58, y: 3, type: 'corner', inHandle: { x: -58, y: 3 }, outHandle: { x: -58, y: 3 } },
        { x: -55, y: 7, type: 'corner', inHandle: { x: -55, y: 7 }, outHandle: { x: -55, y: 7 } },
        { x: -51, y: 3, type: 'corner', inHandle: { x: -51, y: 3 }, outHandle: { x: -51, y: 3 } },
        { x: -47, y: 5, type: 'corner', inHandle: { x: -47, y: 5 }, outHandle: { x: -47, y: 5 } }
      ]
    }),

    // 12. ── 目グループ (頭部上端の２つの目: 背側＆手前) ──
    // 目1 (背側・上部に突き出た目)
    createCirclePart({
      id: 'hirame_eye_socket_1',
      name: '眼窩 1 (背側ダークリング)',
      type: 'eyes',
      parentId: 'hirame_head',
      cx: -37, cy: -15, r: 6.0,
      pivot: { x: -37, y: -15 },
      zIndex: 6.8,
      fill: HIRAME_BODY,
      stroke: HIRAME_OUTLINE,
      strokeWidth: 1.5
    }),
    createCirclePart({
      id: 'hirame_eye_white_1',
      name: '白目 1 (背側)',
      type: 'eyes',
      parentId: 'hirame_head',
      cx: -37, cy: -15, r: 4.6,
      pivot: { x: -37, y: -15 },
      zIndex: 7.0,
      fill: '#ffffff',
      stroke: '#0f172a',
      strokeWidth: 1.2
    }),
    createCirclePart({
      id: 'hirame_pupil_1',
      name: '黒目 1 (背側・左を見据える瞳)',
      type: 'eyes',
      parentId: 'hirame_head',
      cx: -38.5, cy: -15, r: 2.4,
      pivot: { x: -38.5, y: -15 },
      zIndex: 7.2,
      fill: '#0f172a',
      stroke: 'none',
      strokeWidth: 0
    }),
    // 目2 (手前・前下側の目)
    createCirclePart({
      id: 'hirame_eye_socket_2',
      name: '眼窩 2 (手前ダークリング)',
      type: 'eyes',
      parentId: 'hirame_head',
      cx: -31, cy: -9, r: 5.5,
      pivot: { x: -31, y: -9 },
      zIndex: 6.9,
      fill: HIRAME_BODY,
      stroke: HIRAME_OUTLINE,
      strokeWidth: 1.5
    }),
    createCirclePart({
      id: 'hirame_eye_white_2',
      name: '白目 2 (手前)',
      type: 'eyes',
      parentId: 'hirame_head',
      cx: -31, cy: -9, r: 4.2,
      pivot: { x: -31, y: -9 },
      zIndex: 7.1,
      fill: '#ffffff',
      stroke: '#0f172a',
      strokeWidth: 1.2
    }),
    createCirclePart({
      id: 'hirame_pupil_2',
      name: '黒目 2 (手前・左を見据える瞳)',
      type: 'eyes',
      parentId: 'hirame_head',
      cx: -32.5, cy: -9, r: 2.2,
      pivot: { x: -32.5, y: -9 },
      zIndex: 7.3,
      fill: '#0f172a',
      stroke: 'none',
      strokeWidth: 0
    }),

    // 13. 胸ビレ (カレイ胸ビレの左右反転)
    createPart({
      id: 'hirame_pectoral',
      name: '胸びれ',
      type: 'fin_pectoral',
      parentId: 'hirame_body_mid',
      pivot: { x: -15, y: 0 },
      zIndex: 8,
      fill: HIRAME_FIN,
      stroke: HIRAME_FIN_OUTLINE,
      strokeWidth: 1.8,
      closed: true,
      points: [
        { x: -12, y: -6, type: 'corner', inHandle: { x: -12, y: -6 }, outHandle: { x: -6, y: -14 } },
        { x: 4, y: -8, type: 'smooth', inHandle: { x: -2, y: -12 }, outHandle: { x: 8, y: -4 } },
        { x: 0, y: 8, type: 'smooth', inHandle: { x: 6, y: 2 }, outHandle: { x: -6, y: 8 } },
        { x: -10, y: 4, type: 'corner', inHandle: { x: -8, y: 6 }, outHandle: { x: -12, y: -6 } }
      ]
    })
  ];

  const animations = {
    swim: {
      id: 'swim',
      name: '通常遊泳',
      duration: 1.0,
      loop: true,
      tracks: {
        hirame_tail: [
          { time: 0.0, rot: 0, tx: 0, ty: 0 },
          { time: 0.25, rot: 16, tx: -1, ty: 2 },
          { time: 0.5, rot: 0, tx: 0, ty: 0 },
          { time: 0.75, rot: -16, tx: -1, ty: -2 },
          { time: 1.0, rot: 0, tx: 0, ty: 0 }
        ],
        hirame_body_back: [
          { time: 0.0, rot: 0, tx: 0, ty: 0 },
          { time: 0.25, rot: -7, tx: 0, ty: -1 },
          { time: 0.5, rot: 0, tx: 0, ty: 0 },
          { time: 0.75, rot: 7, tx: 0, ty: 1 },
          { time: 1.0, rot: 0, tx: 0, ty: 0 }
        ],
        hirame_jaw: [
          { time: 0.0, rot: 0 },
          { time: 0.5, rot: 6 }, // 捕食の口パク
          { time: 1.0, rot: 0 }
        ],
        hirame_pectoral: [
          { time: 0.0, rot: 0, sx: 1 },
          { time: 0.5, rot: -18, sx: 0.8 },
          { time: 1.0, rot: 0, sx: 1 }
        ]
      }
    },
    flee: {
      id: 'flee',
      name: '高速逃走 (パニック)',
      duration: 0.4,
      loop: true,
      tracks: {
        hirame_tail: [
          { time: 0.0, rot: 0 },
          { time: 0.25, rot: 28 },
          { time: 0.5, rot: 0 },
          { time: 0.75, rot: -28 },
          { time: 1.0, rot: 0 }
        ],
        hirame_jaw: [
          { time: 0.0, rot: 12 },
          { time: 0.5, rot: 4 },
          { time: 1.0, rot: 12 }
        ]
      }
    },
    angry: {
      id: 'angry',
      name: '怒る (威嚇)',
      duration: 0.6,
      loop: true,
      tracks: {
        hirame_jaw: [
          { time: 0.0, rot: 15 },
          { time: 0.3, rot: 22 },
          { time: 0.6, rot: 15 }
        ],
        hirame_tail: [
          { time: 0.0, rot: -5 },
          { time: 0.3, rot: 8 },
          { time: 0.6, rot: -5 }
        ]
      }
    },
    idle: {
      id: 'idle',
      name: '待機 (海底潜伏)',
      duration: 2.0,
      loop: true,
      tracks: {
        hirame_tail: [
          { time: 0.0, rot: 0 },
          { time: 0.5, rot: 4 },
          { time: 1.0, rot: 0 },
          { time: 1.5, rot: -4 },
          { time: 2.0, rot: 0 }
        ],
        hirame_head: [
          { time: 0.0, ty: 0 },
          { time: 1.0, ty: -2 },
          { time: 2.0, ty: 0 }
        ]
      }
    }
  };

  return createCharacter({
    id: 'hirame',
    name: 'ヒラメ (凶暴牙・左向き)',
    species: 'fish',
    facing: -1,
    parts,
    animations
  });
}

/**
 * 2. カレイ（Karei）プリセット
 * - 添付画像２枚目準拠: 右向き・キャメル色・白水玉・扇尾・開いた嘴口・飛び出たとぼけ目
 */
export function getKareiPreset() {
  const KAREI_BODY = '#ba8551';
  const KAREI_FIN = '#8b4b2a';
  const KAREI_OUTLINE = '#382013';
  const KAREI_DOT = '#e5be90';

  const parts = [
    // 1. 扇形の尾びれ (左側・放射状ヒレ条)
    createPart({
      id: 'karei_tail',
      name: '尾びれ (扇形)',
      type: 'fin_tail',
      parentId: 'karei_body_back',
      pivot: { x: -45, y: 0 },
      zIndex: 1,
      fill: KAREI_FIN,
      stroke: KAREI_OUTLINE,
      strokeWidth: 2.8,
      closed: true,
      points: [
        { x: -45, y: -8, type: 'corner', inHandle: { x: -45, y: -8 }, outHandle: { x: -58, y: -18 } },
        { x: -85, y: -26, type: 'corner', inHandle: { x: -75, y: -24 }, outHandle: { x: -88, y: -10 } },
        { x: -90, y: 0, type: 'smooth', inHandle: { x: -88, y: -10 }, outHandle: { x: -88, y: 10 } },
        { x: -85, y: 26, type: 'corner', inHandle: { x: -88, y: 10 }, outHandle: { x: -75, y: 24 } },
        { x: -45, y: 8, type: 'corner', inHandle: { x: -58, y: 18 }, outHandle: { x: -45, y: 8 } }
      ]
    }),

    // 2. アーチ状背ビレ (上側・直線的な黒ヒレ条)
    createPart({
      id: 'karei_dorsal',
      name: '背びれ (上側アーチ)',
      type: 'fin_dorsal',
      parentId: 'karei_body_mid',
      pivot: { x: 0, y: -20 },
      zIndex: 2,
      fill: KAREI_FIN,
      stroke: KAREI_OUTLINE,
      strokeWidth: 2.8,
      closed: true,
      points: [
        { x: -42, y: -10, type: 'corner', inHandle: { x: -42, y: -10 }, outHandle: { x: -20, y: -35 } },
        { x: 5, y: -40, type: 'smooth', inHandle: { x: -15, y: -40 }, outHandle: { x: 25, y: -30 } },
        { x: 42, y: -18, type: 'corner', inHandle: { x: 35, y: -25 }, outHandle: { x: 42, y: -18 } },
        { x: 32, y: -12, type: 'corner', inHandle: { x: 32, y: -12 }, outHandle: { x: 15, y: -22 } },
        { x: -25, y: -8, type: 'smooth', inHandle: { x: 0, y: -18 }, outHandle: { x: -35, y: -8 } }
      ]
    }),

    // 3. アーチ状腹ビレ (下側・直線的な黒ヒレ条)
    createPart({
      id: 'karei_ventral',
      name: '腹びれ (下側アーチ)',
      type: 'fin_ventral',
      parentId: 'karei_body_mid',
      pivot: { x: 0, y: 20 },
      zIndex: 2,
      fill: KAREI_FIN,
      stroke: KAREI_OUTLINE,
      strokeWidth: 2.8,
      closed: true,
      points: [
        { x: -42, y: 10, type: 'corner', inHandle: { x: -42, y: 10 }, outHandle: { x: -20, y: 35 } },
        { x: 0, y: 42, type: 'smooth', inHandle: { x: -18, y: 38 }, outHandle: { x: 20, y: 36 } },
        { x: 36, y: 18, type: 'corner', inHandle: { x: 28, y: 26 }, outHandle: { x: 36, y: 18 } },
        { x: 25, y: 12, type: 'corner', inHandle: { x: 25, y: 12 }, outHandle: { x: 0, y: 20 } },
        { x: -25, y: 8, type: 'smooth', inHandle: { x: -10, y: 16 }, outHandle: { x: -35, y: 8 } }
      ]
    }),

    // 4. 本体後部
    createPart({
      id: 'karei_body_back',
      name: '本体後部',
      type: 'body_back',
      parentId: 'karei_body_mid',
      pivot: { x: -15, y: 0 },
      zIndex: 3,
      fill: KAREI_BODY,
      stroke: KAREI_OUTLINE,
      strokeWidth: 2.8,
      closed: true,
      points: [
        { x: -15, y: -18, type: 'smooth', inHandle: { x: -8, y: -18 }, outHandle: { x: -32, y: -12 } },
        { x: -45, y: -8, type: 'corner', inHandle: { x: -38, y: -10 }, outHandle: { x: -45, y: 0 } },
        { x: -45, y: 8, type: 'corner', inHandle: { x: -45, y: 0 }, outHandle: { x: -38, y: 10 } },
        { x: -15, y: 18, type: 'smooth', inHandle: { x: -32, y: 12 }, outHandle: { x: -8, y: 18 } }
      ]
    }),

    // 5. 本体中央 (キャメル色胴体)
    createPart({
      id: 'karei_body_mid',
      name: '本体中央 (胴体)',
      type: 'body_mid',
      parentId: 'karei_head',
      pivot: { x: 15, y: 0 },
      zIndex: 4,
      fill: KAREI_BODY,
      stroke: KAREI_OUTLINE,
      strokeWidth: 3,
      closed: true,
      points: [
        { x: 30, y: -16, type: 'smooth', inHandle: { x: 35, y: -12 }, outHandle: { x: 10, y: -26 } },
        { x: 5, y: -28, type: 'smooth', inHandle: { x: 15, y: -28 }, outHandle: { x: -15, y: -20 } },
        { x: -20, y: 0, type: 'smooth', inHandle: { x: -18, y: -12 }, outHandle: { x: -18, y: 12 } },
        { x: 0, y: 28, type: 'smooth', inHandle: { x: -15, y: 22 }, outHandle: { x: 15, y: 28 } },
        { x: 30, y: 16, type: 'smooth', inHandle: { x: 15, y: 26 }, outHandle: { x: 35, y: 12 } }
      ]
    }),

    // ── カレイの丸い白水玉ポルカドット (独立パス) ──
    createCirclePart({ id: 'karei_spot_1', name: '水玉 1 (前上)', type: 'decoration', parentId: 'karei_body_mid', cx: 15, cy: -8, r: 3.8, zIndex: 4.2, fill: KAREI_DOT, stroke: 'none', strokeWidth: 0 }),
    createCirclePart({ id: 'karei_spot_2', name: '水玉 2 (背頂)', type: 'decoration', parentId: 'karei_body_mid', cx: 0, cy: -14, r: 4.2, zIndex: 4.2, fill: KAREI_DOT, stroke: 'none', strokeWidth: 0 }),
    createCirclePart({ id: 'karei_spot_3', name: '水玉 3 (後上)', type: 'decoration', parentId: 'karei_body_mid', cx: -15, cy: -8, r: 3.5, zIndex: 4.2, fill: KAREI_DOT, stroke: 'none', strokeWidth: 0 }),
    createCirclePart({ id: 'karei_spot_4', name: '水玉 4 (前下)', type: 'decoration', parentId: 'karei_body_mid', cx: 18, cy: 8, r: 4.0, zIndex: 4.2, fill: KAREI_DOT, stroke: 'none', strokeWidth: 0 }),
    createCirclePart({ id: 'karei_spot_5', name: '水玉 5 (腹頂)', type: 'decoration', parentId: 'karei_body_mid', cx: 4, cy: 14, r: 4.2, zIndex: 4.2, fill: KAREI_DOT, stroke: 'none', strokeWidth: 0 }),
    createCirclePart({ id: 'karei_spot_6', name: '水玉 6 (後下)', type: 'decoration', parentId: 'karei_body_mid', cx: -10, cy: 10, r: 3.5, zIndex: 4.2, fill: KAREI_DOT, stroke: 'none', strokeWidth: 0 }),
    createCirclePart({ id: 'karei_spot_7', name: '水玉 7 (中心)', type: 'decoration', parentId: 'karei_body_mid', cx: 0, cy: -1, r: 3.8, zIndex: 4.2, fill: KAREI_DOT, stroke: 'none', strokeWidth: 0 }),

    // 6. 頭部・開いた嘴状の口先 (右側先端)
    createPart({
      id: 'karei_head',
      name: '本体前 (頭部・開いた嘴口)',
      type: 'body_front',
      parentId: null,
      pivot: { x: 30, y: 0 },
      zIndex: 5,
      fill: KAREI_BODY,
      stroke: KAREI_OUTLINE,
      strokeWidth: 3,
      closed: true,
      points: [
        { x: 30, y: -16, type: 'corner', inHandle: { x: 30, y: -16 }, outHandle: { x: 45, y: -10 } },
        { x: 62, y: -5, type: 'corner', inHandle: { x: 50, y: -8 }, outHandle: { x: 62, y: -5 } }, // 上嘴先端
        { x: 50, y: 0, type: 'corner', inHandle: { x: 56, y: -2 }, outHandle: { x: 56, y: 4 } },   // 口の奥
        { x: 60, y: 10, type: 'corner', inHandle: { x: 50, y: 0 }, outHandle: { x: 60, y: 10 } },  // 下嘴先端
        { x: 48, y: 12, type: 'corner', inHandle: { x: 55, y: 11 }, outHandle: { x: 42, y: 15 } },
        { x: 30, y: 16, type: 'corner', inHandle: { x: 40, y: 14 }, outHandle: { x: 30, y: 16 } }
      ]
    }),

    // 7. エラ蓋ライン
    createPart({
      id: 'karei_gill',
      name: 'エラ蓋',
      type: 'decoration',
      parentId: 'karei_head',
      pivot: { x: 35, y: 0 },
      zIndex: 5.5,
      fill: 'none',
      stroke: KAREI_OUTLINE,
      strokeWidth: 2.5,
      closed: false,
      points: [
        { x: 38, y: -14, type: 'corner', inHandle: { x: 38, y: -14 }, outHandle: { x: 42, y: -5 } },
        { x: 40, y: 2, type: 'smooth', inHandle: { x: 42, y: -5 }, outHandle: { x: 40, y: 8 } },
        { x: 34, y: 14, type: 'corner', inHandle: { x: 38, y: 10 }, outHandle: { x: 34, y: 14 } }
      ]
    }),

    // 8. ── 目グループ (頭部上端の２つの目: ヒラメと同デザイン・右向き対称) ──
    // 目1 (前上側・背輪郭から飛び出たメインの目)
    createCirclePart({
      id: 'karei_eye_socket_1',
      name: '眼窩 1 (前上ダークリング)',
      type: 'eyes',
      parentId: 'karei_head',
      cx: 48, cy: -14, r: 6.0,
      pivot: { x: 48, y: -14 },
      zIndex: 6.8,
      fill: KAREI_BODY,
      stroke: KAREI_OUTLINE,
      strokeWidth: 1.5
    }),
    createCirclePart({
      id: 'karei_eye_white_1',
      name: '白目 1 (前上)',
      type: 'eyes',
      parentId: 'karei_head',
      cx: 48, cy: -14, r: 4.6,
      pivot: { x: 48, y: -14 },
      zIndex: 7.0,
      fill: '#ffffff',
      stroke: '#0f172a',
      strokeWidth: 1.2
    }),
    createCirclePart({
      id: 'karei_pupil_1',
      name: '黒目 1 (前上・右を見据える瞳)',
      type: 'eyes',
      parentId: 'karei_head',
      cx: 49.5, cy: -14, r: 2.4,
      pivot: { x: 49.5, y: -14 },
      zIndex: 7.2,
      fill: '#0f172a',
      stroke: 'none',
      strokeWidth: 0
    }),
    // 目2 (手前・顔側の目)
    createCirclePart({
      id: 'karei_eye_socket_2',
      name: '眼窩 2 (顔側ダークリング)',
      type: 'eyes',
      parentId: 'karei_head',
      cx: 40, cy: -9, r: 5.5,
      pivot: { x: 40, y: -9 },
      zIndex: 6.9,
      fill: KAREI_BODY,
      stroke: KAREI_OUTLINE,
      strokeWidth: 1.5
    }),
    createCirclePart({
      id: 'karei_eye_white_2',
      name: '白目 2 (顔側)',
      type: 'eyes',
      parentId: 'karei_head',
      cx: 40, cy: -9, r: 4.2,
      pivot: { x: 40, y: -9 },
      zIndex: 7.1,
      fill: '#ffffff',
      stroke: '#0f172a',
      strokeWidth: 1.2
    }),
    createCirclePart({
      id: 'karei_pupil_2',
      name: '黒目 2 (顔側・右を見据える瞳)',
      type: 'eyes',
      parentId: 'karei_head',
      cx: 41.5, cy: -9, r: 2.2,
      pivot: { x: 41.5, y: -9 },
      zIndex: 7.3,
      fill: '#0f172a',
      stroke: 'none',
      strokeWidth: 0
    }),

    // 9. 胸ビレ & 腹側小ビレ
    createPart({
      id: 'karei_pectoral',
      name: '胸びれ',
      type: 'fin_pectoral',
      parentId: 'karei_body_mid',
      pivot: { x: 22, y: 2 },
      zIndex: 8,
      fill: KAREI_FIN,
      stroke: KAREI_OUTLINE,
      strokeWidth: 2.2,
      closed: true,
      points: [
        { x: 22, y: 2, type: 'corner', inHandle: { x: 22, y: 2 }, outHandle: { x: 34, y: -4 } },
        { x: 38, y: 10, type: 'smooth', inHandle: { x: 36, y: 4 }, outHandle: { x: 28, y: 12 } },
        { x: 22, y: 8, type: 'corner', inHandle: { x: 25, y: 10 }, outHandle: { x: 22, y: 8 } }
      ]
    })
  ];

  const animations = {
    swim: {
      id: 'swim',
      name: '通常遊泳',
      duration: 1.0,
      loop: true,
      tracks: {
        karei_tail: [
          { time: 0.0, rot: 0 },
          { time: 0.25, rot: -16 },
          { time: 0.5, rot: 0 },
          { time: 0.75, rot: 16 },
          { time: 1.0, rot: 0 }
        ],
        karei_body_back: [
          { time: 0.0, rot: 0 },
          { time: 0.25, rot: 6 },
          { time: 0.5, rot: 0 },
          { time: 0.75, rot: -6 },
          { time: 1.0, rot: 0 }
        ],
        karei_mouth: [
          { time: 0.0, sx: 1, sy: 1 },
          { time: 0.5, sx: 1.3, sy: 0.8 }, // おちょぼ口をすぼめる可愛い動き
          { time: 1.0, sx: 1, sy: 1 }
        ],
        karei_pectoral: [
          { time: 0.0, rot: 0 },
          { time: 0.5, rot: 18 },
          { time: 1.0, rot: 0 }
        ]
      }
    },
    flee: {
      id: 'flee',
      name: '逃走',
      duration: 0.4,
      loop: true,
      tracks: {
        karei_tail: [
          { time: 0.0, rot: 0 },
          { time: 0.25, rot: -28 },
          { time: 0.5, rot: 0 },
          { time: 0.75, rot: 28 },
          { time: 1.0, rot: 0 }
        ],
        karei_eyes: [
          { time: 0.0, sx: 1.3, sy: 1.3 },
          { time: 1.0, sx: 1.3, sy: 1.3 }
        ]
      }
    },
    angry: {
      id: 'angry',
      name: '怒り',
      duration: 0.5,
      loop: true,
      tracks: {
        karei_tail: [
          { time: 0.0, rot: -8 },
          { time: 0.25, rot: 8 },
          { time: 0.5, rot: -8 }
        ]
      }
    },
    idle: {
      id: 'idle',
      name: '待機',
      duration: 1.8,
      loop: true,
      tracks: {
        karei_tail: [
          { time: 0.0, rot: 0 },
          { time: 0.5, rot: -4 },
          { time: 1.0, rot: 0 },
          { time: 1.5, rot: 4 },
          { time: 2.0, rot: 0 }
        ]
      }
    }
  };

  return createCharacter({
    id: 'karei',
    name: 'カレイ (おちょぼ口・水玉・右向き)',
    species: 'fish',
    facing: 1,
    parts,
    animations
  });
}

/**
 * 3. タコ（Octopus）プリセット
 * - 墨吐き邪魔キャラ、赤い大頭、うねる6本足、墨吐き漏斗
 */
export function getOctopusPreset() {
  const parts = [
    // 触手 1 (左外側・上向きウェーブ足)
    createPart({
      id: 'octopus_tentacle_1', name: '触手 1 (左外側・跳ね足)', type: 'fin_tail', parentId: 'octopus_head', pivot: { x: -14, y: 6 }, zIndex: 1,
      fill: '#ea1d2d', stroke: '#b91c1c', strokeWidth: 1.5, closed: true,
      points: [
        { x: -14, y: 4, type: 'corner', inHandle: { x: -14, y: 4 }, outHandle: { x: -26, y: 2 } },
        { x: -42, y: -4, type: 'smooth', inHandle: { x: -34, y: 2 }, outHandle: { x: -46, y: -10 } },
        { x: -40, y: -12, type: 'corner', inHandle: { x: -44, y: -12 }, outHandle: { x: -36, y: -8 } },
        { x: -24, y: 0, type: 'smooth', inHandle: { x: -32, y: -4 }, outHandle: { x: -16, y: 6 } },
        { x: -10, y: 10, type: 'corner', inHandle: { x: -16, y: 6 }, outHandle: { x: -10, y: 10 } }
      ],
      subPaths: [
        { type: 'circle', cx: -36, cy: -5, r: 2.2, fill: '#f97316' },
        { type: 'circle', cx: -28, cy: 0, r: 2.5, fill: '#f97316' },
        { type: 'circle', cx: -18, cy: 5, r: 2.7, fill: '#f97316' }
      ]
    }),

    // 触手 8 (右外側・上向きウェーブ足)
    createPart({
      id: 'octopus_tentacle_8', name: '触手 8 (右外側・跳ね足)', type: 'fin_tail', parentId: 'octopus_head', pivot: { x: 14, y: 6 }, zIndex: 1,
      fill: '#ea1d2d', stroke: '#b91c1c', strokeWidth: 1.5, closed: true,
      points: [
        { x: 10, y: 10, type: 'corner', inHandle: { x: 10, y: 10 }, outHandle: { x: 16, y: 6 } },
        { x: 24, y: 0, type: 'smooth', inHandle: { x: 16, y: 6 }, outHandle: { x: 32, y: -4 } },
        { x: 40, y: -12, type: 'corner', inHandle: { x: 36, y: -8 }, outHandle: { x: 44, y: -12 } },
        { x: 42, y: -4, type: 'smooth', inHandle: { x: 46, y: -10 }, outHandle: { x: 34, y: 2 } },
        { x: 14, y: 4, type: 'corner', inHandle: { x: 26, y: 2 }, outHandle: { x: 14, y: 4 } }
      ],
      subPaths: [
        { type: 'circle', cx: 36, cy: -5, r: 2.2, fill: '#f97316' },
        { type: 'circle', cx: 28, cy: 0, r: 2.5, fill: '#f97316' },
        { type: 'circle', cx: 18, cy: 5, r: 2.7, fill: '#f97316' }
      ]
    }),

    // 中央6本の下垂足 (左から順に 2〜7)
    createPart({
      id: 'octopus_tentacle_2', name: '触手 2 (左外中)', type: 'fin_tail', parentId: 'octopus_head', pivot: { x: -15, y: 8 }, zIndex: 2,
      fill: '#dc2626', stroke: '#b91c1c', strokeWidth: 1.5, closed: true,
      points: [
        { x: -18, y: 6, type: 'corner', inHandle: { x: -18, y: 6 }, outHandle: { x: -20, y: 14 } },
        { x: -22, y: 22, type: 'smooth', inHandle: { x: -24, y: 18 }, outHandle: { x: -20, y: 26 } },
        { x: -15, y: 26, type: 'smooth', inHandle: { x: -18, y: 27 }, outHandle: { x: -13, y: 24 } },
        { x: -14, y: 16, type: 'smooth', inHandle: { x: -13, y: 22 }, outHandle: { x: -14, y: 10 } },
        { x: -13, y: 7, type: 'corner', inHandle: { x: -13, y: 10 }, outHandle: { x: -13, y: 7 } }
      ],
      subPaths: [
        { type: 'circle', cx: -18, cy: 16, r: 2.2, fill: '#f97316' },
        { type: 'circle', cx: -16, cy: 22, r: 2.0, fill: '#f97316' }
      ]
    }),

    createPart({
      id: 'octopus_tentacle_3', name: '触手 3 (左内中)', type: 'fin_tail', parentId: 'octopus_head', pivot: { x: -9, y: 9 }, zIndex: 3,
      fill: '#ea1d2d', stroke: '#b91c1c', strokeWidth: 1.5, closed: true,
      points: [
        { x: -12, y: 7, type: 'corner', inHandle: { x: -12, y: 7 }, outHandle: { x: -13, y: 16 } },
        { x: -13, y: 26, type: 'smooth', inHandle: { x: -15, y: 22 }, outHandle: { x: -11, y: 30 } },
        { x: -6, y: 29, type: 'smooth', inHandle: { x: -10, y: 31 }, outHandle: { x: -4, y: 27 } },
        { x: -6, y: 18, type: 'smooth', inHandle: { x: -5, y: 24 }, outHandle: { x: -6, y: 12 } },
        { x: -6, y: 8, type: 'corner', inHandle: { x: -6, y: 12 }, outHandle: { x: -6, y: 8 } }
      ],
      subPaths: [
        { type: 'circle', cx: -9, cy: 17, r: 2.3, fill: '#f97316' },
        { type: 'circle', cx: -8, cy: 24, r: 2.1, fill: '#f97316' }
      ]
    }),

    createPart({
      id: 'octopus_tentacle_4', name: '触手 4 (中央左)', type: 'fin_tail', parentId: 'octopus_head', pivot: { x: -3, y: 10 }, zIndex: 4,
      fill: '#dc2626', stroke: '#b91c1c', strokeWidth: 1.5, closed: true,
      points: [
        { x: -5, y: 8, type: 'corner', inHandle: { x: -5, y: 8 }, outHandle: { x: -6, y: 18 } },
        { x: -5, y: 29, type: 'smooth', inHandle: { x: -7, y: 24 }, outHandle: { x: -3, y: 33 } },
        { x: 1, y: 32, type: 'smooth', inHandle: { x: -3, y: 34 }, outHandle: { x: 3, y: 29 } },
        { x: 1, y: 19, type: 'smooth', inHandle: { x: 2, y: 25 }, outHandle: { x: 1, y: 13 } },
        { x: 0, y: 9, type: 'corner', inHandle: { x: 1, y: 13 }, outHandle: { x: 0, y: 9 } }
      ],
      subPaths: [
        { type: 'circle', cx: -2, cy: 18, r: 2.4, fill: '#f97316' },
        { type: 'circle', cx: -1, cy: 26, r: 2.2, fill: '#f97316' }
      ]
    }),

    createPart({
      id: 'octopus_tentacle_5', name: '触手 5 (中央右)', type: 'fin_tail', parentId: 'octopus_head', pivot: { x: 3, y: 10 }, zIndex: 4,
      fill: '#ea1d2d', stroke: '#b91c1c', strokeWidth: 1.5, closed: true,
      points: [
        { x: 0, y: 9, type: 'corner', inHandle: { x: 0, y: 9 }, outHandle: { x: -1, y: 13 } },
        { x: -1, y: 19, type: 'smooth', inHandle: { x: -1, y: 13 }, outHandle: { x: -2, y: 25 } },
        { x: -1, y: 32, type: 'smooth', inHandle: { x: -3, y: 29 }, outHandle: { x: 3, y: 34 } },
        { x: 5, y: 29, type: 'smooth', inHandle: { x: 3, y: 33 }, outHandle: { x: 7, y: 24 } },
        { x: 5, y: 8, type: 'corner', inHandle: { x: 6, y: 18 }, outHandle: { x: 5, y: 8 } }
      ],
      subPaths: [
        { type: 'circle', cx: 2, cy: 18, r: 2.4, fill: '#f97316' },
        { type: 'circle', cx: 1, cy: 26, r: 2.2, fill: '#f97316' }
      ]
    }),

    createPart({
      id: 'octopus_tentacle_6', name: '触手 6 (右内中)', type: 'fin_tail', parentId: 'octopus_head', pivot: { x: 9, y: 9 }, zIndex: 3,
      fill: '#dc2626', stroke: '#b91c1c', strokeWidth: 1.5, closed: true,
      points: [
        { x: 6, y: 8, type: 'corner', inHandle: { x: 6, y: 8 }, outHandle: { x: 6, y: 12 } },
        { x: 6, y: 18, type: 'smooth', inHandle: { x: 6, y: 12 }, outHandle: { x: 5, y: 24 } },
        { x: 6, y: 29, type: 'smooth', inHandle: { x: 4, y: 27 }, outHandle: { x: 10, y: 31 } },
        { x: 13, y: 26, type: 'smooth', inHandle: { x: 11, y: 30 }, outHandle: { x: 15, y: 22 } },
        { x: 12, y: 7, type: 'corner', inHandle: { x: 13, y: 16 }, outHandle: { x: 12, y: 7 } }
      ],
      subPaths: [
        { type: 'circle', cx: 9, cy: 17, r: 2.3, fill: '#f97316' },
        { type: 'circle', cx: 8, cy: 24, r: 2.1, fill: '#f97316' }
      ]
    }),

    createPart({
      id: 'octopus_tentacle_7', name: '触手 7 (右外中)', type: 'fin_tail', parentId: 'octopus_head', pivot: { x: 15, y: 8 }, zIndex: 2,
      fill: '#ea1d2d', stroke: '#b91c1c', strokeWidth: 1.5, closed: true,
      points: [
        { x: 13, y: 7, type: 'corner', inHandle: { x: 13, y: 7 }, outHandle: { x: 13, y: 10 } },
        { x: 14, y: 16, type: 'smooth', inHandle: { x: 14, y: 10 }, outHandle: { x: 13, y: 22 } },
        { x: 15, y: 26, type: 'smooth', inHandle: { x: 13, y: 24 }, outHandle: { x: 18, y: 27 } },
        { x: 22, y: 22, type: 'smooth', inHandle: { x: 20, y: 26 }, outHandle: { x: 24, y: 18 } },
        { x: 18, y: 6, type: 'corner', inHandle: { x: 20, y: 14 }, outHandle: { x: 18, y: 6 } }
      ],
      subPaths: [
        { type: 'circle', cx: 18, cy: 16, r: 2.2, fill: '#f97316' },
        { type: 'circle', cx: 16, cy: 22, r: 2.0, fill: '#f97316' }
      ]
    }),

    // タコ頭部 (赤いまん丸大頭ドーム)
    createCirclePart({
      id: 'octopus_head', name: 'タコ頭部 (丸い赤頭)', type: 'body_front', parentId: null,
      cx: 0, cy: -8, r: 26, pivot: { x: 0, y: 0 }, zIndex: 5,
      fill: '#ea1d2d', stroke: '#be123c', strokeWidth: 2
    }),

    // 眉毛 (優しい薄赤の細いアーチ)
    createPart({
      id: 'octopus_brow_left', name: '眉毛 (左)', type: 'decoration', parentId: 'octopus_head', pivot: { x: -10, y: -12 }, zIndex: 6,
      fill: 'none', stroke: '#991b1b', strokeWidth: 1.6, closed: false,
      points: [
        { x: -14, y: -11, type: 'corner', inHandle: { x: -14, y: -11 }, outHandle: { x: -12, y: -13 } },
        { x: -10, y: -13, type: 'smooth', inHandle: { x: -12, y: -13 }, outHandle: { x: -8, y: -13 } },
        { x: -6, y: -11, type: 'corner', inHandle: { x: -8, y: -13 }, outHandle: { x: -6, y: -11 } }
      ]
    }),
    createPart({
      id: 'octopus_brow_right', name: '眉毛 (右)', type: 'decoration', parentId: 'octopus_head', pivot: { x: 10, y: -12 }, zIndex: 6,
      fill: 'none', stroke: '#991b1b', strokeWidth: 1.6, closed: false,
      points: [
        { x: 6, y: -11, type: 'corner', inHandle: { x: 6, y: -11 }, outHandle: { x: 8, y: -13 } },
        { x: 10, y: -13, type: 'smooth', inHandle: { x: 8, y: -13 }, outHandle: { x: 12, y: -13 } },
        { x: 14, y: -11, type: 'corner', inHandle: { x: 12, y: -13 }, outHandle: { x: 14, y: -11 } }
      ]
    }),

    // まん丸黒目 (つぶらな瞳)
    createCirclePart({
      id: 'octopus_eye_left', name: '目 (左)', type: 'eyes', parentId: 'octopus_head',
      cx: -10, cy: -5, r: 3.8, zIndex: 7, fill: '#1e293b', stroke: 'none', strokeWidth: 0
    }),
    createCirclePart({
      id: 'octopus_eye_right', name: '目 (右)', type: 'eyes', parentId: 'octopus_head',
      cx: 10, cy: -5, r: 3.8, zIndex: 7, fill: '#1e293b', stroke: 'none', strokeWidth: 0
    }),

    // おちょぼ口 (オレンジ外輪リップ＋暗赤色キャビティ)
    createCirclePart({
      id: 'octopus_mouth_lip', name: 'おちょぼ口 (外輪リップ)', type: 'mouth', parentId: 'octopus_head',
      cx: 0, cy: 3, r: 6.2, zIndex: 8, fill: '#f97316', stroke: '#ea580c', strokeWidth: 1.2
    }),
    createCirclePart({
      id: 'octopus_mouth_hole', name: '口の穴 (キャビティ)', type: 'mouth', parentId: 'octopus_mouth_lip',
      cx: 0, cy: 3, r: 3.4, zIndex: 9, fill: '#7f1d1d', stroke: 'none', strokeWidth: 0
    })
  ];

  const animations = {
    swim: {
      id: 'swim', name: 'ふわふわ遊泳', duration: 1.2, loop: true,
      tracks: {
        octopus_head: [
          { time: 0.0, ty: 0, sx: 1, sy: 1 },
          { time: 0.4, ty: -6, sx: 1.04, sy: 0.96 },
          { time: 0.8, ty: 3, sx: 0.96, sy: 1.04 },
          { time: 1.2, ty: 0, sx: 1, sy: 1 }
        ],
        octopus_tentacle_1: [{ time: 0.0, rot: 0 }, { time: 0.6, rot: -14 }, { time: 1.2, rot: 0 }],
        octopus_tentacle_8: [{ time: 0.0, rot: 0 }, { time: 0.6, rot: 14 }, { time: 1.2, rot: 0 }],
        octopus_tentacle_2: [{ time: 0.0, rot: 0 }, { time: 0.6, rot: -8 }, { time: 1.2, rot: 0 }],
        octopus_tentacle_3: [{ time: 0.0, rot: 0 }, { time: 0.6, rot: 6 }, { time: 1.2, rot: 0 }],
        octopus_tentacle_4: [{ time: 0.0, rot: 0 }, { time: 0.6, rot: -6 }, { time: 1.2, rot: 0 }],
        octopus_tentacle_5: [{ time: 0.0, rot: 0 }, { time: 0.6, rot: 6 }, { time: 1.2, rot: 0 }],
        octopus_tentacle_6: [{ time: 0.0, rot: 0 }, { time: 0.6, rot: -6 }, { time: 1.2, rot: 0 }],
        octopus_tentacle_7: [{ time: 0.0, rot: 0 }, { time: 0.6, rot: 8 }, { time: 1.2, rot: 0 }]
      }
    },
    angry: {
      id: 'angry', name: '墨吐き (怒り)', duration: 0.6, loop: true,
      tracks: {
        octopus_head: [{ time: 0.0, sx: 1, sy: 1 }, { time: 0.3, sx: 1.2, sy: 0.88 }, { time: 0.6, sx: 1, sy: 1 }],
        octopus_mouth_lip: [{ time: 0.0, sx: 1, sy: 1 }, { time: 0.3, sx: 1.5, sy: 1.5 }, { time: 0.6, sx: 1, sy: 1 }]
      }
    },
    flee: {
      id: 'flee', name: '高速退避', duration: 0.4, loop: true,
      tracks: {
        octopus_head: [{ time: 0.0, ty: 0 }, { time: 0.2, ty: -16 }, { time: 0.4, ty: 0 }]
      }
    },
    idle: {
      id: 'idle', name: '待機', duration: 2.0, loop: true,
      tracks: {
        octopus_head: [{ time: 0.0, ty: 0 }, { time: 1.0, ty: -3 }, { time: 2.0, ty: 0 }]
      }
    }
  };

  return createCharacter({ id: 'octopus', name: 'タコ (墨吐き可愛いマスコット)', species: 'octopus', facing: 1, parts, animations });
}

/**
 * 4. イカ（Squid）プリセット
 * - 添付画像１枚目準拠: パステルクリームイエロー・ベル型マントル・10本足・跳ね触手・つぶらな瞳・墨吐きアニメ
 */
export function getSquidPreset() {
  const SQUID_COLOR = '#fef08a';
  const SQUID_OUTLINE = '#221814';

  const parts = [
    // 1. 左の跳ね触手 (外側から上へウェーブしながら広がるスプーン状の腕)
    createPart({
      id: 'squid_arm_left',
      name: '左触腕 (跳ね触手)',
      type: 'fin_tail',
      parentId: 'squid_mantle',
      pivot: { x: -18, y: 22 },
      zIndex: 1,
      fill: SQUID_COLOR,
      stroke: SQUID_OUTLINE,
      strokeWidth: 2.8,
      closed: true,
      points: [
        { x: -18, y: 20, type: 'corner', inHandle: { x: -18, y: 20 }, outHandle: { x: -32, y: 22 } },
        { x: -48, y: 14, type: 'smooth', inHandle: { x: -40, y: 20 }, outHandle: { x: -52, y: 0 } },
        { x: -48, y: -6, type: 'smooth', inHandle: { x: -52, y: -12 }, outHandle: { x: -40, y: -8 } }, // スプーン先端
        { x: -42, y: 2, type: 'smooth', inHandle: { x: -38, y: -4 }, outHandle: { x: -42, y: 12 } },
        { x: -30, y: 18, type: 'smooth', inHandle: { x: -38, y: 14 }, outHandle: { x: -18, y: 24 } },
        { x: -15, y: 22, type: 'corner', inHandle: { x: -18, y: 24 }, outHandle: { x: -15, y: 22 } }
      ]
    }),

    // 2. 右の跳ね触手 (外側から上へウェーブしながら広がるスプーン状の腕)
    createPart({
      id: 'squid_arm_right',
      name: '右触腕 (跳ね触手)',
      type: 'fin_tail',
      parentId: 'squid_mantle',
      pivot: { x: 18, y: 22 },
      zIndex: 1,
      fill: SQUID_COLOR,
      stroke: SQUID_OUTLINE,
      strokeWidth: 2.8,
      closed: true,
      points: [
        { x: 15, y: 22, type: 'corner', inHandle: { x: 15, y: 22 }, outHandle: { x: 18, y: 24 } },
        { x: 30, y: 18, type: 'smooth', inHandle: { x: 18, y: 24 }, outHandle: { x: 38, y: 14 } },
        { x: 42, y: 2, type: 'smooth', inHandle: { x: 42, y: 12 }, outHandle: { x: 38, y: -4 } },
        { x: 48, y: -6, type: 'smooth', inHandle: { x: 40, y: -8 }, outHandle: { x: 52, y: -12 } }, // スプーン先端
        { x: 48, y: 14, type: 'smooth', inHandle: { x: 52, y: 0 }, outHandle: { x: 40, y: 20 } },
        { x: 18, y: 20, type: 'corner', inHandle: { x: 32, y: 22 }, outHandle: { x: 18, y: 20 } }
      ]
    }),

    // 3. 中央8本の下垂触手 (左から順に leg_1 〜 leg_8)
    ...[-18, -13, -8, -3, 3, 8, 13, 18].map((x, idx) => {
      const len = 16 + (3.5 - Math.abs(idx - 3.5)) * 4;
      const legW = 2.4;
      return createPart({
        id: `squid_leg_${idx + 1}`,
        name: `ゲソ ${idx + 1}`,
        type: 'fin_tail',
        parentId: 'squid_mantle',
        pivot: { x: x, y: 22 },
        zIndex: 2,
        fill: SQUID_COLOR,
        stroke: SQUID_OUTLINE,
        strokeWidth: 2.2,
        closed: true,
        points: [
          { x: x - legW, y: 22, type: 'corner', inHandle: { x: x - legW, y: 22 }, outHandle: { x: x - legW, y: 22 + len * 0.6 } },
          { x: x - legW * 0.8, y: 22 + len, type: 'smooth', inHandle: { x: x - legW, y: 22 + len * 0.8 }, outHandle: { x: x, y: 22 + len + 1.5 } },
          { x: x + legW * 0.8, y: 22 + len, type: 'smooth', inHandle: { x: x, y: 22 + len + 1.5 }, outHandle: { x: x + legW, y: 22 + len * 0.8 } },
          { x: x + legW, y: 22, type: 'corner', inHandle: { x: x + legW, y: 22 + len * 0.6 }, outHandle: { x: x + legW, y: 22 } }
        ]
      });
    }),

    // 4. マントル（外套膜・釣鐘型・横に膨らむ頬と首襟）
    createPart({
      id: 'squid_mantle',
      name: '外套膜 (頭部・胴体)',
      type: 'body_front',
      parentId: null,
      pivot: { x: 0, y: 0 },
      zIndex: 4,
      fill: SQUID_COLOR,
      stroke: SQUID_OUTLINE,
      strokeWidth: 3.2,
      closed: true,
      points: [
        { x: -18, y: 22, type: 'corner', inHandle: { x: -18, y: 22 }, outHandle: { x: -18, y: 22 } },
        { x: 18, y: 22, type: 'corner', inHandle: { x: 18, y: 22 }, outHandle: { x: 18, y: 22 } },
        { x: 18, y: 1, type: 'corner', inHandle: { x: 18, y: 22 }, outHandle: { x: 18, y: 1 } },
        { x: 32, y: 1, type: 'smooth', inHandle: { x: 18, y: 1 }, outHandle: { x: 36, y: -10 } }, // 右頬
        { x: 26, y: -26, type: 'smooth', inHandle: { x: 34, y: -18 }, outHandle: { x: 14, y: -45 } },
        { x: 0, y: -48, type: 'smooth', inHandle: { x: 8, y: -48 }, outHandle: { x: -8, y: -48 } }, // 頭頂ドーム
        { x: -26, y: -26, type: 'smooth', inHandle: { x: -14, y: -45 }, outHandle: { x: -34, y: -18 } },
        { x: -32, y: 1, type: 'smooth', inHandle: { x: -36, y: -10 }, outHandle: { x: -18, y: 1 } }, // 左頬
        { x: -18, y: 1, type: 'corner', inHandle: { x: -18, y: 1 }, outHandle: { x: -18, y: 22 } }
      ]
    }),

    // 5. つぶらな目（縦長オーバル）
    createPart({
      id: 'squid_eye_left',
      name: '左目 (縦長つぶら瞳)',
      type: 'eyes',
      parentId: 'squid_mantle',
      pivot: { x: -10, y: 13 },
      zIndex: 5,
      fill: SQUID_OUTLINE,
      stroke: 'none',
      strokeWidth: 0,
      closed: true,
      points: [
        { x: -10, y: 10, type: 'smooth', inHandle: { x: -11.5, y: 10 }, outHandle: { x: -8.5, y: 10 } },
        { x: -8.5, y: 13, type: 'smooth', inHandle: { x: -8.5, y: 11.5 }, outHandle: { x: -8.5, y: 14.5 } },
        { x: -10, y: 16, type: 'smooth', inHandle: { x: -8.5, y: 16 }, outHandle: { x: -11.5, y: 16 } },
        { x: -11.5, y: 13, type: 'smooth', inHandle: { x: -11.5, y: 14.5 }, outHandle: { x: -11.5, y: 11.5 } }
      ]
    }),
    createPart({
      id: 'squid_eye_right',
      name: '右目 (縦長つぶら瞳)',
      type: 'eyes',
      parentId: 'squid_mantle',
      pivot: { x: 10, y: 13 },
      zIndex: 5,
      fill: SQUID_OUTLINE,
      stroke: 'none',
      strokeWidth: 0,
      closed: true,
      points: [
        { x: 10, y: 10, type: 'smooth', inHandle: { x: 8.5, y: 10 }, outHandle: { x: 11.5, y: 10 } },
        { x: 11.5, y: 13, type: 'smooth', inHandle: { x: 11.5, y: 11.5 }, outHandle: { x: 11.5, y: 14.5 } },
        { x: 10, y: 16, type: 'smooth', inHandle: { x: 11.5, y: 16 }, outHandle: { x: 8.5, y: 16 } },
        { x: 8.5, y: 13, type: 'smooth', inHandle: { x: 8.5, y: 14.5 }, outHandle: { x: 8.5, y: 11.5 } }
      ]
    })
  ];

  const animations = {
    swim: {
      id: 'swim',
      name: '通常遊泳 (ふわふわウェーブ)',
      duration: 1.0,
      loop: true,
      tracks: {
        squid_mantle: [
          { time: 0.0, tx: 0, ty: 0, sx: 1.0, sy: 1.0 },
          { time: 0.25, tx: 0, ty: -3, sx: 0.96, sy: 1.05 },
          { time: 0.5, tx: 0, ty: 0, sx: 1.05, sy: 0.95 },
          { time: 0.75, tx: 0, ty: 2, sx: 0.98, sy: 1.02 },
          { time: 1.0, tx: 0, ty: 0, sx: 1.0, sy: 1.0 }
        ],
        squid_arm_left: [
          { time: 0.0, rot: 0 },
          { time: 0.25, rot: -8 },
          { time: 0.5, rot: 0 },
          { time: 0.75, rot: 6 },
          { time: 1.0, rot: 0 }
        ],
        squid_arm_right: [
          { time: 0.0, rot: 0 },
          { time: 0.25, rot: 8 },
          { time: 0.5, rot: 0 },
          { time: 0.75, rot: -6 },
          { time: 1.0, rot: 0 }
        ],
        squid_leg_1: [{ time: 0.0, rot: 0 }, { time: 0.5, rot: -10 }, { time: 1.0, rot: 0 }],
        squid_leg_8: [{ time: 0.0, rot: 0 }, { time: 0.5, rot: 10 }, { time: 1.0, rot: 0 }]
      }
    },
    angry: {
      id: 'angry',
      name: 'イカスミ噴射 (怒り・墨吐き)',
      duration: 0.8,
      loop: false,
      tracks: {
        squid_mantle: [
          { time: 0.0, sx: 1.0, sy: 1.0, rot: 0 },
          { time: 0.15, sx: 1.25, sy: 0.8, rot: 0 }, // 墨溜め吸気
          { time: 0.35, sx: 0.8, sy: 1.3, rot: 0, ty: -8 }, // 激しくスミ発射！
          { time: 0.6, sx: 1.1, sy: 0.9, rot: 0, ty: -4 },
          { time: 0.8, sx: 1.0, sy: 1.0, rot: 0, ty: 0 }
        ],
        squid_arm_left: [
          { time: 0.0, rot: 0 },
          { time: 0.15, rot: 25 },
          { time: 0.35, rot: -30 },
          { time: 0.8, rot: 0 }
        ],
        squid_arm_right: [
          { time: 0.0, rot: 0 },
          { time: 0.15, rot: -25 },
          { time: 0.35, rot: 30 },
          { time: 0.8, rot: 0 }
        ],
        squid_leg_4: [
          { time: 0.0, rot: 0 },
          { time: 0.35, rot: -20 },
          { time: 0.8, rot: 0 }
        ],
        squid_leg_5: [
          { time: 0.0, rot: 0 },
          { time: 0.35, rot: 20 },
          { time: 0.8, rot: 0 }
        ]
      }
    },
    flee: {
      id: 'flee',
      name: '高速ジェット逃走',
      duration: 0.35,
      loop: true,
      tracks: {
        squid_mantle: [
          { time: 0.0, ty: 0, sx: 1.0, sy: 1.0 },
          { time: 0.15, ty: -16, sx: 0.75, sy: 1.35 },
          { time: 0.35, ty: 0, sx: 1.0, sy: 1.0 }
        ],
        squid_arm_left: [{ time: 0.0, rot: 0 }, { time: 0.15, rot: -20 }, { time: 0.35, rot: 0 }],
        squid_arm_right: [{ time: 0.0, rot: 0 }, { time: 0.15, rot: 20 }, { time: 0.35, rot: 0 }]
      }
    },
    idle: {
      id: 'idle',
      name: '漂流待機',
      duration: 1.6,
      loop: true,
      tracks: {
        squid_mantle: [
          { time: 0.0, ty: 0 },
          { time: 0.8, ty: -4 },
          { time: 1.6, ty: 0 }
        ],
        squid_arm_left: [{ time: 0.0, rot: 0 }, { time: 0.8, rot: -6 }, { time: 1.6, rot: 0 }],
        squid_arm_right: [{ time: 0.0, rot: 0 }, { time: 0.8, rot: 6 }, { time: 1.6, rot: 0 }]
      }
    }
  };

  return createCharacter({
    id: 'squid',
    name: 'イカ (クリームイエロー・ベル型・10本足)',
    species: 'squid',
    facing: 1,
    parts,
    animations,
    reactions: {
      touchCorrect: 'happy',
      touchWrong: 'angry', // 触ると怒ってスミを吐く！
      alertDistance: 130,
      angerStages: 3,
      fleeSpeedMultiplier: 2.8,
      silhouetteDepthThreshold: 0.55
    }
  });
}

/**
 * 5. エイ（Stingray）プリセット
 * - 巨大な影、羽ばたく菱形ボディ、長い毒針ムチ尾
 */
export function getStingrayPreset() {
  const parts = [
    // 尾 (長いムチ尾)
    createPart({
      id: 'ray_tail', name: '毒針ムチ尾', type: 'fin_tail', parentId: 'ray_body', pivot: { x: 30, y: 0 }, zIndex: 1,
      fill: '#1e293b', stroke: '#0f172a', strokeWidth: 1.5, closed: true,
      points: [
        { x: 30, y: -2, type: 'corner', inHandle: { x: 30, y: -2 }, outHandle: { x: 50, y: -1 } },
        { x: 85, y: 0, type: 'corner', inHandle: { x: 70, y: 0 }, outHandle: { x: 85, y: 0 } },
        { x: 30, y: 2, type: 'corner', inHandle: { x: 50, y: 1 }, outHandle: { x: 30, y: 2 } }
      ]
    }),

    // 左胸ビレ (上翼)
    createPart({
      id: 'ray_wing_left', name: '胸びれ翼 (上翼)', type: 'fin_dorsal', parentId: 'ray_body', pivot: { x: 0, y: -20 }, zIndex: 2,
      fill: '#475569', stroke: '#1e293b', strokeWidth: 1.5, closed: true,
      points: [
        { x: -35, y: -5, type: 'corner', inHandle: { x: -35, y: -5 }, outHandle: { x: -20, y: -25 } },
        { x: 0, y: -45, type: 'smooth', inHandle: { x: -12, y: -42 }, outHandle: { x: 12, y: -42 } },
        { x: 32, y: -8, type: 'corner', inHandle: { x: 22, y: -25 }, outHandle: { x: 32, y: -8 } },
        { x: 0, y: -15, type: 'smooth', inHandle: { x: 15, y: -15 }, outHandle: { x: -15, y: -15 } }
      ]
    }),

    // 右胸ビレ (下翼)
    createPart({
      id: 'ray_wing_right', name: '胸びれ翼 (下翼)', type: 'fin_ventral', parentId: 'ray_body', pivot: { x: 0, y: 20 }, zIndex: 2,
      fill: '#475569', stroke: '#1e293b', strokeWidth: 1.5, closed: true,
      points: [
        { x: -35, y: 5, type: 'corner', inHandle: { x: -35, y: 5 }, outHandle: { x: -20, y: 25 } },
        { x: 0, y: 45, type: 'smooth', inHandle: { x: -12, y: 42 }, outHandle: { x: 12, y: 42 } },
        { x: 32, y: 8, type: 'corner', inHandle: { x: 22, y: 25 }, outHandle: { x: 32, y: 8 } },
        { x: 0, y: 15, type: 'smooth', inHandle: { x: 15, y: 15 }, outHandle: { x: -15, y: 15 } }
      ]
    }),

    // エイ本体 (巨大な菱形ボディ)
    createPart({
      id: 'ray_body', name: 'エイ主胴体 (菱形)', type: 'body_front', parentId: null, pivot: { x: 0, y: 0 }, zIndex: 3,
      fill: '#334155', stroke: '#0f172a', strokeWidth: 2, closed: true,
      points: [
        { x: -45, y: 0, type: 'corner', inHandle: { x: -40, y: -10 }, outHandle: { x: -40, y: 10 } },
        { x: 0, y: 35, type: 'smooth', inHandle: { x: -20, y: 30 }, outHandle: { x: 15, y: 25 } },
        { x: 35, y: 0, type: 'corner', inHandle: { x: 25, y: 5 }, outHandle: { x: 25, y: -5 } },
        { x: 0, y: -35, type: 'smooth', inHandle: { x: 15, y: -25 }, outHandle: { x: -20, y: -30 } }
      ]
    }),

    // 目 (背面の小さな目)
    createCirclePart({ id: 'ray_eye_left', name: '目 (左)', type: 'eyes', parentId: 'ray_body', cx: -15, cy: -6, r: 2.5, zIndex: 4, fill: '#f8fafc', stroke: '#0f172a', strokeWidth: 1 }),
    createCirclePart({ id: 'ray_eye_right', name: '目 (右)', type: 'eyes', parentId: 'ray_body', cx: -15, cy: 6, r: 2.5, zIndex: 4, fill: '#f8fafc', stroke: '#0f172a', strokeWidth: 1 })
  ];

  const animations = {
    swim: {
      id: 'swim', name: '羽ばたき遊泳 (波打つ翼)', duration: 1.4, loop: true,
      tracks: {
        ray_wing_left: [{ time: 0.0, rot: 0 }, { time: 0.35, rot: 15 }, { time: 0.7, rot: 0 }, { time: 1.05, rot: -15 }, { time: 1.4, rot: 0 }],
        ray_wing_right: [{ time: 0.0, rot: 0 }, { time: 0.35, rot: -15 }, { time: 0.7, rot: 0 }, { time: 1.05, rot: 15 }, { time: 1.4, rot: 0 }],
        ray_tail: [{ time: 0.0, rot: 0 }, { time: 0.7, rot: 10 }, { time: 1.4, rot: 0 }]
      }
    },
    flee: {
      id: 'flee', name: '急速潜行', duration: 0.5, loop: true,
      tracks: {
        ray_body: [{ time: 0.0, sx: 1 }, { time: 0.25, sx: 1.15 }, { time: 0.5, sx: 1 }]
      }
    },
    idle: {
      id: 'idle', name: '海底ホバリング', duration: 2.0, loop: true,
      tracks: {
        ray_body: [{ time: 0.0, ty: 0 }, { time: 1.0, ty: 3 }, { time: 2.0, ty: 0 }]
      }
    }
  };

  return createCharacter({ id: 'stingray', name: 'エイ (巨大影)', species: 'ray', facing: -1, parts, animations });
}

/**
 * 6. アジの開き（Dried Horse Mackerel）プリセット
 * - 添付画像１枚目: 笹の葉の上の天日干し開きアジ・銀色の頭骨・琥珀色の開き身・太い背骨と繊細な小骨・二股尾
 */
export function getAjiOpenPreset() {
  const parts = [
    // 二股の干物尾びれ (右端・深みのある飴色褐色)
    createPart({
      id: 'aji_tail', name: '干物の尾びれ (二股)', type: 'fin_tail', parentId: 'aji_flesh', pivot: { x: 38, y: 0 }, zIndex: 1,
      fill: '#5c2d13', stroke: '#3d1c08', strokeWidth: 1.5, closed: true,
      points: [
        { x: 36, y: -6, type: 'corner', inHandle: { x: 36, y: -6 }, outHandle: { x: 48, y: -18 } },
        { x: 65, y: -22, type: 'corner', inHandle: { x: 55, y: -18 }, outHandle: { x: 55, y: -6 } },
        { x: 50, y: 0, type: 'corner', inHandle: { x: 52, y: -3 }, outHandle: { x: 52, y: 3 } }, // V字ノッチ
        { x: 65, y: 22, type: 'corner', inHandle: { x: 55, y: 6 }, outHandle: { x: 55, y: 18 } },
        { x: 36, y: 6, type: 'corner', inHandle: { x: 48, y: 18 }, outHandle: { x: 36, y: 6 } }
      ]
    }),

    // 開かれた干物の身 (パカッと開いた琥珀色・オレンジの身)
    createPart({
      id: 'aji_flesh', name: '開き身 (琥珀色の肉質)', type: 'body_front', parentId: null, pivot: { x: 0, y: 0 }, zIndex: 2,
      fill: '#ea8c1e', stroke: '#4a250a', strokeWidth: 2, closed: true,
      points: [
        { x: -24, y: -10, type: 'corner', inHandle: { x: -24, y: -10 }, outHandle: { x: -18, y: -28 } },
        { x: 5, y: -32, type: 'smooth', inHandle: { x: -10, y: -32 }, outHandle: { x: 22, y: -22 } },
        { x: 38, y: -8, type: 'corner', inHandle: { x: 30, y: -14 }, outHandle: { x: 38, y: 0 } },
        { x: 38, y: 8, type: 'corner', inHandle: { x: 38, y: 0 }, outHandle: { x: 30, y: 14 } },
        { x: 5, y: 30, type: 'smooth', inHandle: { x: 22, y: 22 }, outHandle: { x: -10, y: 30 } },
        { x: -18, y: 24, type: 'smooth', inHandle: { x: -14, y: 28 }, outHandle: { x: -24, y: 14 } }, // 腹側のえぐれ
        { x: -24, y: 10, type: 'corner', inHandle: { x: -24, y: 14 }, outHandle: { x: -24, y: 10 } }
      ],
      subPaths: [
        // 身の放射状繊維・筋
        { type: 'polygon', fill: '#fbbf24', points: [{ x: -16, y: -8 }, { x: 4, y: -24 }, { x: 24, y: -8 }, { x: 18, y: 0 }, { x: -10, y: 0 }] },
        { type: 'polygon', fill: '#f59e0b', points: [{ x: -14, y: 8 }, { x: 4, y: 22 }, { x: 24, y: 8 }, { x: 18, y: 0 }, { x: -10, y: 0 }] }
      ]
    }),

    // 中央の太い背骨（脊椎・白い骨芯と節）
    createPart({
      id: 'aji_spine', name: '魚の背骨 (白い主骨)', type: 'decoration', parentId: 'aji_flesh', pivot: { x: 0, y: 0 }, zIndex: 3,
      fill: 'none', stroke: '#451a03', strokeWidth: 3.5, closed: false,
      points: [
        { x: -24, y: 0, type: 'corner', inHandle: { x: -24, y: 0 }, outHandle: { x: 0, y: 0 } },
        { x: 38, y: 0, type: 'corner', inHandle: { x: 15, y: 0 }, outHandle: { x: 38, y: 0 } }
      ]
    }),
    createPart({
      id: 'aji_spine_core', name: '背骨の白芯', type: 'decoration', parentId: 'aji_spine', pivot: { x: 0, y: 0 }, zIndex: 4,
      fill: 'none', stroke: '#ffffff', strokeWidth: 1.8, closed: false,
      points: [
        { x: -22, y: 0, type: 'corner', inHandle: { x: -22, y: 0 }, outHandle: { x: 0, y: 0 } },
        { x: 36, y: 0, type: 'corner', inHandle: { x: 15, y: 0 }, outHandle: { x: 36, y: 0 } }
      ]
    }),

    // 上側肋骨 (背骨から放射状に伸びる繊細な針骨)
    createPart({
      id: 'aji_ribs_upper', name: '小骨群 (上側肋骨)', type: 'decoration', parentId: 'aji_flesh', pivot: { x: 0, y: -6 }, zIndex: 5,
      fill: 'none', stroke: 'rgba(255, 255, 255, 0.9)', strokeWidth: 1.4, closed: false,
      points: [
        { x: -16, y: -18, type: 'corner', inHandle: { x: -16, y: -18 }, outHandle: { x: -18, y: -2 } },
        { x: -18, y: -2, type: 'corner', inHandle: { x: -18, y: -2 }, outHandle: { x: -10, y: -20 } },
        { x: -10, y: -20, type: 'corner', inHandle: { x: -10, y: -20 }, outHandle: { x: -12, y: -2 } },
        { x: -12, y: -2, type: 'corner', inHandle: { x: -12, y: -2 }, outHandle: { x: -4, y: -22 } },
        { x: -4, y: -22, type: 'corner', inHandle: { x: -4, y: -22 }, outHandle: { x: -6, y: -2 } },
        { x: -6, y: -2, type: 'corner', inHandle: { x: -6, y: -2 }, outHandle: { x: 2, y: -22 } },
        { x: 2, y: -22, type: 'corner', inHandle: { x: 2, y: -22 }, outHandle: { x: 0, y: -2 } },
        { x: 0, y: -2, type: 'corner', inHandle: { x: 0, y: -2 }, outHandle: { x: 8, y: -20 } },
        { x: 8, y: -20, type: 'corner', inHandle: { x: 8, y: -20 }, outHandle: { x: 6, y: -2 } },
        { x: 6, y: -2, type: 'corner', inHandle: { x: 6, y: -2 }, outHandle: { x: 14, y: -16 } },
        { x: 14, y: -16, type: 'corner', inHandle: { x: 14, y: -16 }, outHandle: { x: 12, y: -2 } },
        { x: 12, y: -2, type: 'corner', inHandle: { x: 12, y: -2 }, outHandle: { x: 20, y: -12 } },
        { x: 20, y: -12, type: 'corner', inHandle: { x: 20, y: -12 }, outHandle: { x: 20, y: -12 } }
      ]
    }),

    // 下側肋骨
    createPart({
      id: 'aji_ribs_lower', name: '小骨群 (下側肋骨)', type: 'decoration', parentId: 'aji_flesh', pivot: { x: 0, y: 6 }, zIndex: 5,
      fill: 'none', stroke: 'rgba(255, 255, 255, 0.9)', strokeWidth: 1.4, closed: false,
      points: [
        { x: -16, y: 16, type: 'corner', inHandle: { x: -16, y: 16 }, outHandle: { x: -18, y: 2 } },
        { x: -18, y: 2, type: 'corner', inHandle: { x: -18, y: 2 }, outHandle: { x: -10, y: 18 } },
        { x: -10, y: 18, type: 'corner', inHandle: { x: -10, y: 18 }, outHandle: { x: -12, y: 2 } },
        { x: -12, y: 2, type: 'corner', inHandle: { x: -12, y: 2 }, outHandle: { x: -4, y: 20 } },
        { x: -4, y: 20, type: 'corner', inHandle: { x: -4, y: 20 }, outHandle: { x: -6, y: 2 } },
        { x: -6, y: 2, type: 'corner', inHandle: { x: -6, y: 2 }, outHandle: { x: 2, y: 18 } },
        { x: 2, y: 18, type: 'corner', inHandle: { x: 2, y: 18 }, outHandle: { x: 0, y: 2 } },
        { x: 0, y: 2, type: 'corner', inHandle: { x: 0, y: 2 }, outHandle: { x: 8, y: 16 } },
        { x: 8, y: 16, type: 'corner', inHandle: { x: 8, y: 16 }, outHandle: { x: 6, y: 2 } },
        { x: 6, y: 2, type: 'corner', inHandle: { x: 6, y: 2 }, outHandle: { x: 14, y: 12 } },
        { x: 14, y: 12, type: 'corner', inHandle: { x: 14, y: 12 }, outHandle: { x: 14, y: 12 } }
      ]
    }),

    // 銀色の頭骨 (左側・シャープな骨板)
    createPart({
      id: 'aji_head', name: 'アジ頭部 (銀色の頭骨)', type: 'body_mid', parentId: null, pivot: { x: -30, y: 0 }, zIndex: 6,
      fill: '#94a3b8', stroke: '#334155', strokeWidth: 1.8, closed: true,
      points: [
        { x: -24, y: -14, type: 'corner', inHandle: { x: -24, y: -14 }, outHandle: { x: -38, y: -10 } },
        { x: -48, y: -3, type: 'corner', inHandle: { x: -42, y: -8 }, outHandle: { x: -44, y: 4 } }, // 尖った鼻先
        { x: -40, y: 8, type: 'corner', inHandle: { x: -44, y: 4 }, outHandle: { x: -34, y: 14 } },
        { x: -24, y: 12, type: 'corner', inHandle: { x: -30, y: 14 }, outHandle: { x: -24, y: 12 } }
      ],
      subPaths: [
        // 頭骨のハイライトプレート
        { type: 'polygon', fill: '#cbd5e1', points: [{ x: -26, y: -12 }, { x: -38, y: -8 }, { x: -44, y: -2 }, { x: -34, y: 0 }, { x: -26, y: -3 }] }
      ]
    }),

    // アジの目 (同心円状の乾燥した眼球)
    createCirclePart({ id: 'aji_eye_socket', name: '眼窩 (ダークリング)', type: 'eyes', parentId: 'aji_head', cx: -36, cy: -3, r: 4.8, zIndex: 7, fill: '#1e293b', stroke: '#0f172a', strokeWidth: 1 }),
    createCirclePart({ id: 'aji_eye_iris', name: '虹彩 (銀白)', type: 'eyes', parentId: 'aji_eye_socket', cx: -36, cy: -3, r: 3.5, zIndex: 8, fill: '#cbd5e1', stroke: 'none', strokeWidth: 0 }),
    createCirclePart({ id: 'aji_eye_pupil', name: '瞳孔 (黒)', type: 'eyes', parentId: 'aji_eye_iris', cx: -36, cy: -3, r: 2.0, zIndex: 9, fill: '#0f172a', stroke: 'none', strokeWidth: 0 })
  ];

  const animations = {
    swim: {
      id: 'swim', name: '平らな干物遊泳', duration: 1.0, loop: true,
      tracks: {
        aji_tail: [{ time: 0.0, rot: 0 }, { time: 0.25, rot: -12 }, { time: 0.5, rot: 0 }, { time: 0.75, rot: 12 }, { time: 1.0, rot: 0 }],
        aji_flesh: [{ time: 0.0, rot: 0, ty: 0 }, { time: 0.5, rot: 2.5, ty: 2 }, { time: 1.0, rot: 0, ty: 0 }]
      }
    },
    flee: {
      id: 'flee', name: 'パタパタ回転逃走', duration: 0.4, loop: true,
      tracks: {
        aji_flesh: [{ time: 0.0, rot: 0 }, { time: 0.2, rot: 15 }, { time: 0.4, rot: 0 }]
      }
    },
    idle: {
      id: 'idle', name: '干物漂流', duration: 2.0, loop: true,
      tracks: {
        aji_flesh: [{ time: 0.0, ty: 0 }, { time: 1.0, ty: -3 }, { time: 2.0, ty: 0 }]
      }
    }
  };

  return createCharacter({ id: 'aji_open', name: 'アジの開き (干物・罠魚)', species: 'dried', facing: -1, parts, animations });
}

/**
 * 7. ウシノシタ（Tongue Sole / Shitabirame）プリセット
 * - 添付画像３枚目: 鉤鼻・靴底柳葉型・外周を隙間なく縁取る微細ヒレ条・Velvetチョコ褐色・細小眼
 */
export function getUshinositaPreset() {
  const parts = [
    // 全周を隙間なく縁取る外周ヒレ (背鰭・臀鰭・尾鰭一体型)
    createPart({
      id: 'ushi_fin', name: '外周ヒレ (全身を縁取る砂褐色ヒレ)', type: 'fin_dorsal', parentId: 'ushi_body', pivot: { x: 0, y: 0 }, zIndex: 1,
      fill: '#a89078', stroke: '#6e5a47', strokeWidth: 1.2, closed: true,
      points: [
        { x: -52, y: -7, type: 'corner', inHandle: { x: -52, y: -7 }, outHandle: { x: -28, y: -26 } },
        { x: 12, y: -24, type: 'smooth', inHandle: { x: -10, y: -26 }, outHandle: { x: 38, y: -18 } },
        { x: 62, y: 0, type: 'corner', inHandle: { x: 52, y: -8 }, outHandle: { x: 52, y: 8 } }, // 尖った尾端
        { x: 12, y: 24, type: 'smooth', inHandle: { x: 38, y: 18 }, outHandle: { x: -10, y: 26 } },
        { x: -50, y: 12, type: 'corner', inHandle: { x: -28, y: 26 }, outHandle: { x: -52, y: -7 } }
      ]
    }),

    // ウシノシタ主胴体 (靴底形状・鉤鼻の滑らかな柳葉型)
    createPart({
      id: 'ushi_body', name: 'ウシノシタ胴体 (Velvetチョコ褐色)', type: 'body_front', parentId: null, pivot: { x: 0, y: 0 }, zIndex: 2,
      fill: '#423429', stroke: '#221913', strokeWidth: 1.8, closed: true,
      points: [
        { x: -44, y: -14, type: 'corner', inHandle: { x: -35, y: -16 }, outHandle: { x: -52, y: -10 } },
        { x: -54, y: 4, type: 'smooth', inHandle: { x: -55, y: -3 }, outHandle: { x: -50, y: 9 } }, // 丸い鼻先
        { x: -46, y: 7, type: 'corner', inHandle: { x: -49, y: 8 }, outHandle: { x: -20, y: 18 } }, // 巻き込んだ鉤鼻口元
        { x: 15, y: 14, type: 'smooth', inHandle: { x: -8, y: 18 }, outHandle: { x: 40, y: 8 } },
        { x: 58, y: 0, type: 'corner', inHandle: { x: 52, y: 4 }, outHandle: { x: 52, y: -4 } }, // 尖った尾
        { x: 15, y: -14, type: 'smooth', inHandle: { x: 40, y: -8 }, outHandle: { x: -8, y: -18 } },
        { x: -24, y: -16, type: 'smooth', inHandle: { x: -8, y: -18 }, outHandle: { x: -35, y: -16 } }
      ],
      subPaths: [
        // 表面の暗色微細斑点
        { type: 'circle', cx: -15, cy: -7, r: 1.4, fill: 'rgba(28, 20, 14, 0.7)' },
        { type: 'circle', cx: 0, cy: -9, r: 1.5, fill: 'rgba(28, 20, 14, 0.7)' },
        { type: 'circle', cx: 18, cy: -6, r: 1.3, fill: 'rgba(28, 20, 14, 0.7)' },
        { type: 'circle', cx: 34, cy: -4, r: 1.2, fill: 'rgba(28, 20, 14, 0.7)' },
        { type: 'circle', cx: -10, cy: 7, r: 1.4, fill: 'rgba(28, 20, 14, 0.7)' },
        { type: 'circle', cx: 10, cy: 6, r: 1.5, fill: 'rgba(28, 20, 14, 0.7)' },
        { type: 'circle', cx: 28, cy: 4, r: 1.2, fill: 'rgba(28, 20, 14, 0.7)' }
      ]
    }),

    // 側線 (中央を走る細線)
    createPart({
      id: 'ushi_lateral_line', name: '側線', type: 'decoration', parentId: 'ushi_body', pivot: { x: 0, y: 0 }, zIndex: 3,
      fill: 'none', stroke: '#221913', strokeWidth: 1.2, closed: false,
      points: [
        { x: -28, y: 0, type: 'corner', inHandle: { x: -28, y: 0 }, outHandle: { x: 0, y: 0 } },
        { x: 54, y: 0, type: 'corner', inHandle: { x: 25, y: 0 }, outHandle: { x: 54, y: 0 } }
      ]
    }),

    // 目 (背側縁に寄った小さな2つの目・金緑色の瞳)
    createCirclePart({ id: 'ushi_eye_1', name: '目 1 (上)', type: 'eyes', parentId: 'ushi_body', cx: -42, cy: -5, r: 2.8, zIndex: 4, fill: '#657555', stroke: '#0f172a', strokeWidth: 0.8 }),
    createCirclePart({ id: 'ushi_pupil_1', name: '黒瞳 1', type: 'eyes', parentId: 'ushi_eye_1', cx: -42, cy: -5, r: 1.5, zIndex: 5, fill: '#0f172a', stroke: 'none', strokeWidth: 0 }),
    createCirclePart({ id: 'ushi_eye_2', name: '目 2 (下)', type: 'eyes', parentId: 'ushi_body', cx: -36, cy: -8, r: 2.6, zIndex: 4, fill: '#657555', stroke: '#0f172a', strokeWidth: 0.8 }),
    createCirclePart({ id: 'ushi_pupil_2', name: '黒瞳 2', type: 'eyes', parentId: 'ushi_eye_2', cx: -36, cy: -8, r: 1.4, zIndex: 5, fill: '#0f172a', stroke: 'none', strokeWidth: 0 })
  ];

  const animations = {
    swim: {
      id: 'swim', name: 'うねうね波打つ遊泳', duration: 1.1, loop: true,
      tracks: {
        ushi_body: [
          { time: 0.0, rot: 0, ty: 0 },
          { time: 0.27, rot: -4, ty: -2 },
          { time: 0.55, rot: 0, ty: 0 },
          { time: 0.82, rot: 4, ty: 2 },
          { time: 1.1, rot: 0, ty: 0 }
        ],
        ushi_fin: [
          { time: 0.0, sy: 1 },
          { time: 0.55, sy: 1.12 },
          { time: 1.1, sy: 1 }
        ]
      }
    },
    flee: {
      id: 'flee', name: '砂煙逃走', duration: 0.4, loop: true,
      tracks: {
        ushi_body: [{ time: 0.0, rot: 0 }, { time: 0.2, rot: -10 }, { time: 0.4, rot: 0 }]
      }
    },
    idle: {
      id: 'idle', name: '砂底擬態', duration: 2.0, loop: true,
      tracks: {
        ushi_body: [{ time: 0.0, ty: 0 }, { time: 1.0, ty: 1 }, { time: 2.0, ty: 0 }]
      }
    }
  };

  return createCharacter({ id: 'shitabirame', name: 'ウシノシタ (舌平目・ひっかけ魚)', species: 'fish', facing: -1, parts, animations });
}

/**
 * 8. 人間（Human）プリセット
 * - 頭部、胴体、両腕（上腕/前腕/手）、両脚（太もも/すね/足）、目・口・髪
 * - 親子階層リグ: 胴体 -> 頭部 -> 目/口/髪, 胴体 -> 腕 -> 前腕, 胴体 -> 脚 -> すね
 * - アニメーション: walk (腕振りと脚の交差歩行), idle (呼吸), tap (万歳ジャンプ)
 */
export function getHumanPreset() {
  const parts = [
    // 胴体 (ベース)
    createPart({
      id: 'human_torso', name: '胴体 (シャツ)', type: 'body', parentId: null, pivot: { x: 0, y: -5 }, zIndex: 10,
      fill: '#0284c7', stroke: '#0f172a', strokeWidth: 2.8, closed: true,
      points: [
        { x: -16, y: -26, type: 'corner' },
        { x: 16, y: -26, type: 'corner' },
        { x: 14, y: 14, type: 'corner' },
        { x: -14, y: 14, type: 'corner' }
      ]
    }),
    // 頭部
    createPart({
      id: 'human_head', name: '頭部 (顔)', type: 'head', parentId: 'human_torso', pivot: { x: 0, y: -34 }, zIndex: 12,
      fill: '#fed7aa', stroke: '#0f172a', strokeWidth: 2.8, closed: true,
      points: [
        { x: 0, y: -58, type: 'smooth' },
        { x: 16, y: -45, type: 'smooth' },
        { x: 14, y: -28, type: 'smooth' },
        { x: 0, y: -25, type: 'smooth' },
        { x: -14, y: -28, type: 'smooth' },
        { x: -16, y: -45, type: 'smooth' }
      ]
    }),
    // 髪の毛
    createPart({
      id: 'human_hair', name: '髪の毛', type: 'decoration', parentId: 'human_head', pivot: { x: 0, y: -48 }, zIndex: 15,
      fill: '#451a03', stroke: '#0f172a', strokeWidth: 2.8, closed: true,
      points: [
        { x: -18, y: -40, type: 'corner' },
        { x: -18, y: -58, type: 'smooth' },
        { x: 0, y: -64, type: 'smooth' },
        { x: 18, y: -58, type: 'smooth' },
        { x: 18, y: -40, type: 'corner' },
        { x: 10, y: -48, type: 'corner' },
        { x: 0, y: -44, type: 'corner' },
        { x: -10, y: -48, type: 'corner' }
      ]
    }),
    // 目玉 (左・右)
    createCirclePart({ id: 'human_eye_l', name: '左目', type: 'eyes', parentId: 'human_head', cx: -6, cy: -38, r: 3.5, fill: '#0f172a', stroke: 'none', zIndex: 14 }),
    createCirclePart({ id: 'human_eye_r', name: '右目', type: 'eyes', parentId: 'human_head', cx: 6, cy: -38, r: 3.5, fill: '#0f172a', stroke: 'none', zIndex: 14 }),
    // 口
    createPart({
      id: 'human_mouth', name: 'にっこり口', type: 'mouth', parentId: 'human_head', pivot: { x: 0, y: -30 }, zIndex: 14,
      fill: 'none', stroke: '#e11d48', strokeWidth: 2.2, closed: false,
      points: [
        { x: -4, y: -30, type: 'corner' },
        { x: 0, y: -27, type: 'smooth' },
        { x: 4, y: -30, type: 'corner' }
      ]
    }),
    // 左腕 (奥)
    createPart({
      id: 'human_arm_l_upper', name: '左上腕', type: 'arm', parentId: 'human_torso', pivot: { x: -16, y: -22 }, zIndex: 8,
      fill: '#0369a1', stroke: '#0f172a', strokeWidth: 2.5, closed: true,
      points: [
        { x: -14, y: -24, type: 'corner' },
        { x: -20, y: -22, type: 'corner' },
        { x: -24, y: -2, type: 'corner' },
        { x: -18, y: -2, type: 'corner' }
      ]
    }),
    createPart({
      id: 'human_arm_l_lower', name: '左前腕・手', type: 'arm', parentId: 'human_arm_l_upper', pivot: { x: -21, y: -2 }, zIndex: 8,
      fill: '#fed7aa', stroke: '#0f172a', strokeWidth: 2.5, closed: true,
      points: [
        { x: -18, y: -2, type: 'corner' },
        { x: -24, y: -2, type: 'corner' },
        { x: -26, y: 16, type: 'corner' },
        { x: -18, y: 16, type: 'corner' }
      ]
    }),
    // 右腕 (手前)
    createPart({
      id: 'human_arm_r_upper', name: '右上腕', type: 'arm', parentId: 'human_torso', pivot: { x: 16, y: -22 }, zIndex: 13,
      fill: '#38bdf8', stroke: '#0f172a', strokeWidth: 2.5, closed: true,
      points: [
        { x: 14, y: -24, type: 'corner' },
        { x: 20, y: -22, type: 'corner' },
        { x: 24, y: -2, type: 'corner' },
        { x: 18, y: -2, type: 'corner' }
      ]
    }),
    createPart({
      id: 'human_arm_r_lower', name: '右前腕・手', type: 'arm', parentId: 'human_arm_r_upper', pivot: { x: 21, y: -2 }, zIndex: 13,
      fill: '#fed7aa', stroke: '#0f172a', strokeWidth: 2.5, closed: true,
      points: [
        { x: 18, y: -2, type: 'corner' },
        { x: 24, y: -2, type: 'corner' },
        { x: 26, y: 16, type: 'corner' },
        { x: 18, y: 16, type: 'corner' }
      ]
    }),
    // 左脚 (奥)
    createPart({
      id: 'human_leg_l_upper', name: '左太もも', type: 'leg', parentId: 'human_torso', pivot: { x: -8, y: 14 }, zIndex: 6,
      fill: '#1e293b', stroke: '#0f172a', strokeWidth: 2.5, closed: true,
      points: [
        { x: -13, y: 14, type: 'corner' },
        { x: -3, y: 14, type: 'corner' },
        { x: -4, y: 36, type: 'corner' },
        { x: -12, y: 36, type: 'corner' }
      ]
    }),
    createPart({
      id: 'human_leg_l_lower', name: '左すね・靴', type: 'leg', parentId: 'human_leg_l_upper', pivot: { x: -8, y: 36 }, zIndex: 6,
      fill: '#475569', stroke: '#0f172a', strokeWidth: 2.5, closed: true,
      points: [
        { x: -12, y: 36, type: 'corner' },
        { x: -4, y: 36, type: 'corner' },
        { x: -4, y: 56, type: 'corner' },
        { x: -16, y: 56, type: 'corner' }
      ]
    }),
    // 右脚 (手前)
    createPart({
      id: 'human_leg_r_upper', name: '右太もも', type: 'leg', parentId: 'human_torso', pivot: { x: 8, y: 14 }, zIndex: 9,
      fill: '#334155', stroke: '#0f172a', strokeWidth: 2.5, closed: true,
      points: [
        { x: 3, y: 14, type: 'corner' },
        { x: 13, y: 14, type: 'corner' },
        { x: 12, y: 36, type: 'corner' },
        { x: 4, y: 36, type: 'corner' }
      ]
    }),
    createPart({
      id: 'human_leg_r_lower', name: '右すね・靴', type: 'leg', parentId: 'human_leg_r_upper', pivot: { x: 8, y: 36 }, zIndex: 9,
      fill: '#64748b', stroke: '#0f172a', strokeWidth: 2.5, closed: true,
      points: [
        { x: 4, y: 36, type: 'corner' },
        { x: 12, y: 36, type: 'corner' },
        { x: 16, y: 56, type: 'corner' },
        { x: 4, y: 56, type: 'corner' }
      ]
    })
  ];

  const animations = {
    swim: {
      id: 'swim', name: '通常優勢 (2足歩行)', duration: 0.8, loop: true,
      tracks: {
        human_torso: [{ time: 0.0, ty: 0 }, { time: 0.2, ty: -3 }, { time: 0.4, ty: 0 }, { time: 0.6, ty: -3 }, { time: 0.8, ty: 0 }],
        human_head: [{ time: 0.0, rot: 0 }, { time: 0.4, rot: 2 }, { time: 0.8, rot: 0 }],
        human_arm_l_upper: [{ time: 0.0, rot: -25 }, { time: 0.4, rot: 25 }, { time: 0.8, rot: -25 }],
        human_arm_l_lower: [{ time: 0.0, rot: -10 }, { time: 0.4, rot: 30 }, { time: 0.8, rot: -10 }],
        human_arm_r_upper: [{ time: 0.0, rot: 25 }, { time: 0.4, rot: -25 }, { time: 0.8, rot: 25 }],
        human_arm_r_lower: [{ time: 0.0, rot: 30 }, { time: 0.4, rot: -10 }, { time: 0.8, rot: 30 }],
        human_leg_l_upper: [{ time: 0.0, rot: 30 }, { time: 0.4, rot: -25 }, { time: 0.8, rot: 30 }],
        human_leg_l_lower: [{ time: 0.0, rot: 10 }, { time: 0.4, rot: 40 }, { time: 0.8, rot: 10 }],
        human_leg_r_upper: [{ time: 0.0, rot: -25 }, { time: 0.4, rot: 30 }, { time: 0.8, rot: -25 }],
        human_leg_r_lower: [{ time: 0.0, rot: 40 }, { time: 0.4, rot: 10 }, { time: 0.8, rot: 40 }]
      }
    },
    idle: {
      id: 'idle', name: '待機 (呼吸待機)', duration: 1.6, loop: true,
      tracks: {
        human_torso: [{ time: 0.0, ty: 0, sy: 1.0 }, { time: 0.8, ty: -2, sy: 1.03 }, { time: 1.6, ty: 0, sy: 1.0 }],
        human_head: [{ time: 0.0, rot: 0 }, { time: 0.8, rot: -1.5 }, { time: 1.6, rot: 0 }],
        human_arm_l_upper: [{ time: 0.0, rot: 0 }, { time: 0.8, rot: 3 }, { time: 1.6, rot: 0 }],
        human_arm_r_upper: [{ time: 0.0, rot: 0 }, { time: 0.8, rot: -3 }, { time: 1.6, rot: 0 }]
      }
    },
    flee: {
      id: 'flee', name: '逃走 (全力疾走ダッシュ)', duration: 0.4, loop: true,
      tracks: {
        human_torso: [{ time: 0.0, ty: 0, rot: 12 }, { time: 0.1, ty: -5, rot: 15 }, { time: 0.2, ty: 0, rot: 12 }, { time: 0.3, ty: -5, rot: 15 }, { time: 0.4, ty: 0, rot: 12 }],
        human_head: [{ time: 0.0, rot: 10 }, { time: 0.2, rot: 14 }, { time: 0.4, rot: 10 }],
        human_arm_l_upper: [{ time: 0.0, rot: -50 }, { time: 0.2, rot: 50 }, { time: 0.4, rot: -50 }],
        human_arm_r_upper: [{ time: 0.0, rot: 50 }, { time: 0.2, rot: -50 }, { time: 0.4, rot: 50 }],
        human_leg_l_upper: [{ time: 0.0, rot: 60 }, { time: 0.2, rot: -50 }, { time: 0.4, rot: 60 }],
        human_leg_r_upper: [{ time: 0.0, rot: -50 }, { time: 0.2, rot: 60 }, { time: 0.4, rot: -50 }]
      }
    },
    angry: {
      id: 'angry', name: '怒る (地団駄・威嚇)', duration: 0.5, loop: true,
      tracks: {
        human_torso: [{ time: 0.0, ty: 0, sx: 1 }, { time: 0.25, ty: 2, sx: 1.05 }, { time: 0.5, ty: 0, sx: 1 }],
        human_head: [{ time: 0.0, rot: -5 }, { time: 0.25, rot: 5 }, { time: 0.5, rot: -5 }],
        human_arm_l_upper: [{ time: 0.0, rot: -90 }, { time: 0.25, rot: -70 }, { time: 0.5, rot: -90 }],
        human_arm_r_upper: [{ time: 0.0, rot: 90 }, { time: 0.25, rot: 70 }, { time: 0.5, rot: 90 }]
      }
    },
    tap: {
      id: 'tap', name: '万歳ジャンプ', duration: 0.6, loop: false,
      tracks: {
        human_torso: [{ time: 0.0, ty: 0 }, { time: 0.3, ty: -24 }, { time: 0.6, ty: 0 }],
        human_head: [{ time: 0.0, rot: 0 }, { time: 0.3, rot: -8 }, { time: 0.6, rot: 0 }],
        human_arm_l_upper: [{ time: 0.0, rot: 0 }, { time: 0.3, rot: -140 }, { time: 0.6, rot: 0 }],
        human_arm_r_upper: [{ time: 0.0, rot: 0 }, { time: 0.3, rot: 140 }, { time: 0.6, rot: 0 }],
        human_leg_l_upper: [{ time: 0.0, rot: 0 }, { time: 0.3, rot: 20 }, { time: 0.6, rot: 0 }],
        human_leg_r_upper: [{ time: 0.0, rot: 0 }, { time: 0.3, rot: -20 }, { time: 0.6, rot: 0 }]
      }
    }
  };

  return createCharacter({ id: 'human', name: '人間 (2足歩行・人型リグ)', species: 'human', facing: 1, parts, animations });
}

/**
 * 9. ４足歩行（Quadruped: 犬・猫・ライオン・馬）プリセット
 * - 胴体、首、頭部、耳、目、鼻口、尻尾、前肢2本、後肢2本
 * - アニメーション: walk (対角斜め歩行トロット), idle (しっぽ振り), tap (跳ね起き)
 */
export function getQuadrupedPreset() {
  const parts = [
    // 胴体
    createPart({
      id: 'quad_body', name: '胴体', type: 'body', parentId: null, pivot: { x: 0, y: 0 }, zIndex: 10,
      fill: '#f59e0b', stroke: '#0f172a', strokeWidth: 2.8, closed: true,
      points: [
        { x: -30, y: -14, type: 'smooth' },
        { x: 30, y: -12, type: 'smooth' },
        { x: 34, y: 8, type: 'smooth' },
        { x: -28, y: 10, type: 'smooth' }
      ]
    }),
    // 首
    createPart({
      id: 'quad_neck', name: '首', type: 'neck', parentId: 'quad_body', pivot: { x: -26, y: -8 }, zIndex: 11,
      fill: '#d97706', stroke: '#0f172a', strokeWidth: 2.8, closed: true,
      points: [
        { x: -20, y: -14, type: 'corner' },
        { x: -38, y: -28, type: 'corner' },
        { x: -44, y: -18, type: 'corner' },
        { x: -28, y: 0, type: 'corner' }
      ]
    }),
    // 頭部
    createPart({
      id: 'quad_head', name: '頭部', type: 'head', parentId: 'quad_neck', pivot: { x: -42, y: -24 }, zIndex: 12,
      fill: '#f59e0b', stroke: '#0f172a', strokeWidth: 2.8, closed: true,
      points: [
        { x: -34, y: -34, type: 'smooth' },
        { x: -54, y: -30, type: 'smooth' },
        { x: -62, y: -18, type: 'smooth' },
        { x: -44, y: -14, type: 'smooth' }
      ]
    }),
    // 耳 (左・右)
    createPart({
      id: 'quad_ear_l', name: '左耳', type: 'decoration', parentId: 'quad_head', pivot: { x: -38, y: -32 }, zIndex: 13,
      fill: '#b45309', stroke: '#0f172a', strokeWidth: 2.2, closed: true,
      points: [{ x: -38, y: -32, type: 'corner' }, { x: -34, y: -48, type: 'corner' }, { x: -44, y: -36, type: 'corner' }]
    }),
    createPart({
      id: 'quad_ear_r', name: '右耳', type: 'decoration', parentId: 'quad_head', pivot: { x: -48, y: -30 }, zIndex: 13,
      fill: '#b45309', stroke: '#0f172a', strokeWidth: 2.2, closed: true,
      points: [{ x: -46, y: -30, type: 'corner' }, { x: -44, y: -46, type: 'corner' }, { x: -52, y: -34, type: 'corner' }]
    }),
    // 目玉
    createCirclePart({ id: 'quad_eye', name: '目玉', type: 'eyes', parentId: 'quad_head', cx: -50, cy: -24, r: 3.5, fill: '#0f172a', stroke: 'none', zIndex: 14 }),
    // 鼻口
    createCirclePart({ id: 'quad_nose', name: '鼻', type: 'decoration', parentId: 'quad_head', cx: -60, cy: -18, r: 2.5, fill: '#1e293b', stroke: 'none', zIndex: 14 }),
    // 尻尾
    createPart({
      id: 'quad_tail', name: '尻尾', type: 'tail', parentId: 'quad_body', pivot: { x: 30, y: -6 }, zIndex: 9,
      fill: '#d97706', stroke: '#0f172a', strokeWidth: 2.5, closed: true,
      points: [
        { x: 30, y: -6, type: 'corner' },
        { x: 52, y: -20, type: 'smooth' },
        { x: 58, y: -16, type: 'smooth' },
        { x: 34, y: 0, type: 'corner' }
      ]
    }),
    // 前左脚 (奥)
    createPart({
      id: 'quad_leg_fl', name: '前左脚 (奥)', type: 'leg', parentId: 'quad_body', pivot: { x: -22, y: 8 }, zIndex: 7,
      fill: '#b45309', stroke: '#0f172a', strokeWidth: 2.5, closed: true,
      points: [{ x: -26, y: 8, type: 'corner' }, { x: -18, y: 8, type: 'corner' }, { x: -18, y: 38, type: 'corner' }, { x: -26, y: 38, type: 'corner' }]
    }),
    // 前右脚 (手前)
    createPart({
      id: 'quad_leg_fr', name: '前右脚 (手前)', type: 'leg', parentId: 'quad_body', pivot: { x: -14, y: 10 }, zIndex: 12,
      fill: '#f59e0b', stroke: '#0f172a', strokeWidth: 2.5, closed: true,
      points: [{ x: -18, y: 10, type: 'corner' }, { x: -10, y: 10, type: 'corner' }, { x: -10, y: 40, type: 'corner' }, { x: -18, y: 40, type: 'corner' }]
    }),
    // 後左脚 (奥)
    createPart({
      id: 'quad_leg_bl', name: '後左脚 (奥)', type: 'leg', parentId: 'quad_body', pivot: { x: 22, y: 6 }, zIndex: 7,
      fill: '#b45309', stroke: '#0f172a', strokeWidth: 2.5, closed: true,
      points: [{ x: 18, y: 6, type: 'corner' }, { x: 26, y: 6, type: 'corner' }, { x: 26, y: 38, type: 'corner' }, { x: 18, y: 38, type: 'corner' }]
    }),
    // 後右脚 (手前)
    createPart({
      id: 'quad_leg_br', name: '後右脚 (手前)', type: 'leg', parentId: 'quad_body', pivot: { x: 28, y: 8 }, zIndex: 12,
      fill: '#f59e0b', stroke: '#0f172a', strokeWidth: 2.5, closed: true,
      points: [{ x: 24, y: 8, type: 'corner' }, { x: 32, y: 8, type: 'corner' }, { x: 32, y: 40, type: 'corner' }, { x: 24, y: 40, type: 'corner' }]
    })
  ];

  const animations = {
    swim: {
      id: 'swim', name: '通常優勢 (4足トロット歩行)', duration: 0.7, loop: true,
      tracks: {
        quad_body: [{ time: 0.0, ty: 0 }, { time: 0.175, ty: -2 }, { time: 0.35, ty: 0 }, { time: 0.525, ty: -2 }, { time: 0.7, ty: 0 }],
        quad_head: [{ time: 0.0, rot: 0 }, { time: 0.35, rot: 3 }, { time: 0.7, rot: 0 }],
        quad_tail: [{ time: 0.0, rot: -15 }, { time: 0.35, rot: 15 }, { time: 0.7, rot: -15 }],
        quad_leg_fl: [{ time: 0.0, rot: 25 }, { time: 0.35, rot: -25 }, { time: 0.7, rot: 25 }],
        quad_leg_br: [{ time: 0.0, rot: 25 }, { time: 0.35, rot: -25 }, { time: 0.7, rot: 25 }],
        quad_leg_fr: [{ time: 0.0, rot: -25 }, { time: 0.35, rot: 25 }, { time: 0.7, rot: -25 }],
        quad_leg_bl: [{ time: 0.0, rot: -25 }, { time: 0.35, rot: 25 }, { time: 0.7, rot: -25 }]
      }
    },
    idle: {
      id: 'idle', name: '待機 (尻尾フリフリ待機)', duration: 1.2, loop: true,
      tracks: {
        quad_body: [{ time: 0.0, ty: 0 }, { time: 0.6, ty: 1 }, { time: 1.2, ty: 0 }],
        quad_head: [{ time: 0.0, rot: 0 }, { time: 0.6, rot: -2 }, { time: 1.2, rot: 0 }],
        quad_tail: [{ time: 0.0, rot: -20 }, { time: 0.3, rot: 20 }, { time: 0.6, rot: -20 }, { time: 0.9, rot: 20 }, { time: 1.2, rot: -20 }]
      }
    },
    flee: {
      id: 'flee', name: '逃走 (全力ギャロップ疾走)', duration: 0.35, loop: true,
      tracks: {
        quad_body: [{ time: 0.0, ty: 0, rot: -5 }, { time: 0.175, ty: -8, rot: 8 }, { time: 0.35, ty: 0, rot: -5 }],
        quad_head: [{ time: 0.0, rot: -8 }, { time: 0.175, rot: 8 }, { time: 0.35, rot: -8 }],
        quad_tail: [{ time: 0.0, rot: -30 }, { time: 0.175, rot: 20 }, { time: 0.35, rot: -30 }],
        quad_leg_fl: [{ time: 0.0, rot: 50 }, { time: 0.175, rot: -45 }, { time: 0.35, rot: 50 }],
        quad_leg_fr: [{ time: 0.0, rot: 40 }, { time: 0.175, rot: -50 }, { time: 0.35, rot: 40 }],
        quad_leg_bl: [{ time: 0.0, rot: -45 }, { time: 0.175, rot: 55 }, { time: 0.35, rot: -45 }],
        quad_leg_br: [{ time: 0.0, rot: -50 }, { time: 0.175, rot: 45 }, { time: 0.35, rot: -50 }]
      }
    },
    angry: {
      id: 'angry', name: '怒る (唸り・低姿勢威嚇)', duration: 0.6, loop: true,
      tracks: {
        quad_body: [{ time: 0.0, ty: 2, rot: -4 }, { time: 0.3, ty: 4, rot: -2 }, { time: 0.6, ty: 2, rot: -4 }],
        quad_head: [{ time: 0.0, rot: 10 }, { time: 0.3, rot: 16 }, { time: 0.6, rot: 10 }],
        quad_tail: [{ time: 0.0, rot: -35 }, { time: 0.3, rot: -45 }, { time: 0.6, rot: -35 }],
        quad_ear_l: [{ time: 0.0, rot: 20 }, { time: 0.3, rot: 30 }, { time: 0.6, rot: 20 }],
        quad_ear_r: [{ time: 0.0, rot: 20 }, { time: 0.3, rot: 30 }, { time: 0.6, rot: 20 }]
      }
    },
    tap: {
      id: 'tap', name: '元気なジャンプ', duration: 0.5, loop: false,
      tracks: {
        quad_body: [{ time: 0.0, ty: 0, rot: 0 }, { time: 0.25, ty: -20, rot: -10 }, { time: 0.5, ty: 0, rot: 0 }],
        quad_head: [{ time: 0.0, rot: 0 }, { time: 0.25, rot: -15 }, { time: 0.5, rot: 0 }],
        quad_tail: [{ time: 0.0, rot: 0 }, { time: 0.25, rot: 40 }, { time: 0.5, rot: 0 }]
      }
    }
  };

  return createCharacter({ id: 'quadruped', name: '４足歩行 (犬猫動物・トロット歩行)', species: 'beast', facing: -1, parts, animations });
}

/**
 * 10. ２足歩行（Biped: 恐竜・怪獣・メカ型）プリセット
 * - 骨盤、前傾胸部、大きな頭部、開閉する下顎、大尻尾、小さな前肢、強靭な太もも・すね
 * - アニメーション: walk (ドッシリ歩行), idle (咆哮待機), tap (大口を開けて咆哮)
 */
export function getBipedPreset() {
  const parts = [
    // 骨盤/中心
    createPart({
      id: 'biped_pelvis', name: '骨盤・腰', type: 'body', parentId: null, pivot: { x: 0, y: 0 }, zIndex: 10,
      fill: '#10b981', stroke: '#064e3b', strokeWidth: 2.8, closed: true,
      points: [
        { x: -16, y: -12, type: 'corner' },
        { x: 18, y: -8, type: 'corner' },
        { x: 20, y: 14, type: 'smooth' },
        { x: -14, y: 16, type: 'smooth' }
      ]
    }),
    // 前傾胸部
    createPart({
      id: 'biped_torso', name: '前傾胸部', type: 'body', parentId: 'biped_pelvis', pivot: { x: -14, y: -6 }, zIndex: 11,
      fill: '#059669', stroke: '#064e3b', strokeWidth: 2.8, closed: true,
      points: [
        { x: -10, y: -10, type: 'corner' },
        { x: -32, y: -22, type: 'corner' },
        { x: -38, y: -6, type: 'smooth' },
        { x: -14, y: 10, type: 'corner' }
      ]
    }),
    // 頭部
    createPart({
      id: 'biped_head', name: '恐竜頭部', type: 'head', parentId: 'biped_torso', pivot: { x: -32, y: -20 }, zIndex: 13,
      fill: '#10b981', stroke: '#064e3b', strokeWidth: 2.8, closed: true,
      points: [
        { x: -28, y: -34, type: 'corner' },
        { x: -56, y: -30, type: 'smooth' },
        { x: -62, y: -18, type: 'corner' },
        { x: -34, y: -16, type: 'corner' }
      ]
    }),
    // 開閉する下顎
    createPart({
      id: 'biped_jaw', name: '開閉下顎', type: 'mouth', parentId: 'biped_head', pivot: { x: -36, y: -16 }, zIndex: 12,
      fill: '#047857', stroke: '#064e3b', strokeWidth: 2.2, closed: true,
      points: [
        { x: -34, y: -16, type: 'corner' },
        { x: -60, y: -16, type: 'corner' },
        { x: -56, y: -8, type: 'smooth' },
        { x: -34, y: -10, type: 'corner' }
      ]
    }),
    // 目玉
    createCirclePart({ id: 'biped_eye', name: '目玉', type: 'eyes', parentId: 'biped_head', cx: -46, cy: -26, r: 4, fill: '#facc15', stroke: '#0f172a', zIndex: 14 }),
    // 大尻尾 根元
    createPart({
      id: 'biped_tail_1', name: '大尻尾 (根元)', type: 'tail', parentId: 'biped_pelvis', pivot: { x: 16, y: 0 }, zIndex: 8,
      fill: '#059669', stroke: '#064e3b', strokeWidth: 2.8, closed: true,
      points: [
        { x: 16, y: -8, type: 'corner' },
        { x: 44, y: -4, type: 'smooth' },
        { x: 42, y: 10, type: 'smooth' },
        { x: 18, y: 14, type: 'corner' }
      ]
    }),
    // 大尻尾 先端
    createPart({
      id: 'biped_tail_2', name: '大尻尾 (先端)', type: 'tail', parentId: 'biped_tail_1', pivot: { x: 42, y: 2 }, zIndex: 8,
      fill: '#10b981', stroke: '#064e3b', strokeWidth: 2.5, closed: true,
      points: [
        { x: 42, y: -4, type: 'corner' },
        { x: 74, y: -2, type: 'corner' },
        { x: 42, y: 8, type: 'corner' }
      ]
    }),
    // 前肢
    createPart({
      id: 'biped_arm', name: '小さな前肢', type: 'arm', parentId: 'biped_torso', pivot: { x: -28, y: -4 }, zIndex: 14,
      fill: '#059669', stroke: '#064e3b', strokeWidth: 2.2, closed: true,
      points: [{ x: -28, y: -4, type: 'corner' }, { x: -36, y: 6, type: 'corner' }, { x: -32, y: 10, type: 'corner' }]
    }),
    // 左脚 (奥)
    createPart({
      id: 'biped_leg_l', name: '左脚 (奥)', type: 'leg', parentId: 'biped_pelvis', pivot: { x: -4, y: 8 }, zIndex: 6,
      fill: '#047857', stroke: '#064e3b', strokeWidth: 2.8, closed: true,
      points: [{ x: -12, y: 8, type: 'corner' }, { x: 4, y: 8, type: 'corner' }, { x: 0, y: 44, type: 'corner' }, { x: -16, y: 44, type: 'corner' }]
    }),
    // 右脚 (手前)
    createPart({
      id: 'biped_leg_r', name: '右脚 (手前)', type: 'leg', parentId: 'biped_pelvis', pivot: { x: 8, y: 10 }, zIndex: 12,
      fill: '#10b981', stroke: '#064e3b', strokeWidth: 2.8, closed: true,
      points: [{ x: 0, y: 10, type: 'corner' }, { x: 16, y: 10, type: 'corner' }, { x: 12, y: 46, type: 'corner' }, { x: -4, y: 46, type: 'corner' }]
    })
  ];

  const animations = {
    swim: {
      id: 'swim', name: '通常優勢 (重量級2足歩行)', duration: 0.9, loop: true,
      tracks: {
        biped_pelvis: [{ time: 0.0, ty: 0, rot: 0 }, { time: 0.225, ty: -3, rot: -3 }, { time: 0.45, ty: 0, rot: 0 }, { time: 0.675, ty: -3, rot: 3 }, { time: 0.9, ty: 0, rot: 0 }],
        biped_torso: [{ time: 0.0, rot: 0 }, { time: 0.45, rot: 4 }, { time: 0.9, rot: 0 }],
        biped_head: [{ time: 0.0, rot: 0 }, { time: 0.45, rot: -3 }, { time: 0.9, rot: 0 }],
        biped_tail_1: [{ time: 0.0, rot: -10 }, { time: 0.45, rot: 10 }, { time: 0.9, rot: -10 }],
        biped_tail_2: [{ time: 0.0, rot: -15 }, { time: 0.45, rot: 15 }, { time: 0.9, rot: -15 }],
        biped_arm: [{ time: 0.0, rot: 15 }, { time: 0.45, rot: -15 }, { time: 0.9, rot: 15 }],
        biped_leg_l: [{ time: 0.0, rot: 25 }, { time: 0.45, rot: -25 }, { time: 0.9, rot: 25 }],
        biped_leg_r: [{ time: 0.0, rot: -25 }, { time: 0.45, rot: 25 }, { time: 0.9, rot: -25 }]
      }
    },
    idle: {
      id: 'idle', name: '待機 (威嚇呼吸待機)', duration: 1.8, loop: true,
      tracks: {
        biped_pelvis: [{ time: 0.0, ty: 0 }, { time: 0.9, ty: 2 }, { time: 1.8, ty: 0 }],
        biped_head: [{ time: 0.0, rot: 0 }, { time: 0.9, rot: -3 }, { time: 1.8, rot: 0 }],
        biped_tail_1: [{ time: 0.0, rot: 0 }, { time: 0.9, rot: -6 }, { time: 1.8, rot: 0 }]
      }
    },
    flee: {
      id: 'flee', name: '逃走 (パニック突進)', duration: 0.45, loop: true,
      tracks: {
        biped_pelvis: [{ time: 0.0, ty: 0, rot: 10 }, { time: 0.225, ty: -6, rot: 15 }, { time: 0.45, ty: 0, rot: 10 }],
        biped_torso: [{ time: 0.0, rot: 15 }, { time: 0.225, rot: 20 }, { time: 0.45, rot: 15 }],
        biped_head: [{ time: 0.0, rot: -10 }, { time: 0.225, rot: -5 }, { time: 0.45, rot: -10 }],
        biped_tail_1: [{ time: 0.0, rot: 25 }, { time: 0.225, rot: -25 }, { time: 0.45, rot: 25 }],
        biped_leg_l: [{ time: 0.0, rot: 45 }, { time: 0.225, rot: -45 }, { time: 0.45, rot: 45 }],
        biped_leg_r: [{ time: 0.0, rot: -45 }, { time: 0.225, rot: 45 }, { time: 0.45, rot: -45 }]
      }
    },
    angry: {
      id: 'angry', name: '怒る (地響き咆哮)', duration: 0.6, loop: true,
      tracks: {
        biped_head: [{ time: 0.0, rot: 0 }, { time: 0.3, rot: -30 }, { time: 0.6, rot: 0 }],
        biped_jaw: [{ time: 0.0, rot: 0 }, { time: 0.3, rot: 40 }, { time: 0.6, rot: 0 }],
        biped_torso: [{ time: 0.0, rot: 0 }, { time: 0.3, rot: -10 }, { time: 0.6, rot: 0 }],
        biped_tail_1: [{ time: 0.0, rot: 0 }, { time: 0.3, rot: 25 }, { time: 0.6, rot: 0 }]
      }
    },
    tap: {
      id: 'tap', name: '大咆哮 (Roar)', duration: 0.6, loop: false,
      tracks: {
        biped_head: [{ time: 0.0, rot: 0 }, { time: 0.3, rot: -25 }, { time: 0.6, rot: 0 }],
        biped_jaw: [{ time: 0.0, rot: 0 }, { time: 0.3, rot: 35 }, { time: 0.6, rot: 0 }],
        biped_tail_1: [{ time: 0.0, rot: 0 }, { time: 0.3, rot: 20 }, { time: 0.6, rot: 0 }]
      }
    }
  };

  return createCharacter({ id: 'biped', name: '２足歩行 (恐竜・怪獣・メカ)', species: 'monster', facing: -1, parts, animations });
}

/**
 * 11. 昆虫（Insect: カブトムシ・ハチ・セミ・バッタ）プリセット
 * - 胸部、頭部、触角/角、複眼、腹部、透明羽2枚、6本脚
 * - アニメーション: fly (超高速羽ばたき), walk (6脚トライポッド歩行), tap (角威嚇)
 */
export function getInsectPreset() {
  const BEETLE_BODY = '#242426';
  const BEETLE_CHEST = '#1c1c1e';
  const BEETLE_HORN = '#121214';
  const BEETLE_OUTLINE = '#09090a';
  const BEETLE_LEG = '#161618';

  const parts = [
    // 1. 腹部・上翅 (Elytra: 左右の甲殻と中心スプリットライン)
    createPart({
      id: 'insect_abdomen', name: '腹部 (硬い上翅甲殻)', type: 'body', parentId: 'insect_thorax', pivot: { x: 0, y: 10 }, zIndex: 8,
      fill: BEETLE_BODY, stroke: BEETLE_OUTLINE, strokeWidth: 2.8, closed: true,
      points: [
        { x: -28, y: 10, type: 'corner', inHandle: { x: -28, y: 10 }, outHandle: { x: -30, y: 35 } },
        { x: -22, y: 62, type: 'smooth', inHandle: { x: -28, y: 50 }, outHandle: { x: -10, y: 72 } },
        { x: 0, y: 74, type: 'smooth', inHandle: { x: -8, y: 74 }, outHandle: { x: 8, y: 74 } },
        { x: 22, y: 62, type: 'smooth', inHandle: { x: 10, y: 72 }, outHandle: { x: 28, y: 50 } },
        { x: 28, y: 10, type: 'corner', inHandle: { x: 30, y: 35 }, outHandle: { x: 28, y: 10 } }
      ],
      subPaths: [
        // 左右の羽を分ける中央シームスプリット線
        { type: 'polygon', fill: '#0a0a0c', points: [{ x: -1.2, y: 10 }, { x: 1.2, y: 10 }, { x: 1.2, y: 73 }, { x: -1.2, y: 73 }] },
        // Y字の胸部接合ライン
        { type: 'polygon', fill: '#0a0a0c', points: [{ x: -16, y: 12 }, { x: 0, y: 22 }, { x: 16, y: 12 }, { x: 14, y: 14 }, { x: 0, y: 24 }, { x: -14, y: 14 }] }
      ]
    }),

    // 2. 胸部 (Pronotum 前胸背板)
    createPart({
      id: 'insect_thorax', name: '前胸背板 (胸部甲板)', type: 'body', parentId: null, pivot: { x: 0, y: 0 }, zIndex: 10,
      fill: BEETLE_CHEST, stroke: BEETLE_OUTLINE, strokeWidth: 2.8, closed: true,
      points: [
        { x: -24, y: -12, type: 'smooth', inHandle: { x: -15, y: -14 }, outHandle: { x: -28, y: 0 } },
        { x: -26, y: 10, type: 'smooth', inHandle: { x: -28, y: 0 }, outHandle: { x: -15, y: 12 } },
        { x: 26, y: 10, type: 'smooth', inHandle: { x: 15, y: 12 }, outHandle: { x: 28, y: 0 } },
        { x: 24, y: -12, type: 'smooth', inHandle: { x: 28, y: 0 }, outHandle: { x: 15, y: -14 } }
      ]
    }),

    // 3. 頭部 (Head plate)
    createPart({
      id: 'insect_head', name: '頭部', type: 'head', parentId: 'insect_thorax', pivot: { x: 0, y: -12 }, zIndex: 12,
      fill: BEETLE_CHEST, stroke: BEETLE_OUTLINE, strokeWidth: 2.8, closed: true,
      points: [
        { x: -22, y: -26, type: 'smooth', inHandle: { x: -15, y: -28 }, outHandle: { x: -24, y: -18 } },
        { x: -20, y: -12, type: 'corner', inHandle: { x: -22, y: -15 }, outHandle: { x: 0, y: -10 } },
        { x: 20, y: -12, type: 'corner', inHandle: { x: 0, y: -10 }, outHandle: { x: 22, y: -15 } },
        { x: 22, y: -26, type: 'smooth', inHandle: { x: 24, y: -18 }, outHandle: { x: 15, y: -28 } }
      ]
    }),

    // 4. クワガタの大顎 (左)
    createPart({
      id: 'insect_mandible_left', name: '大顎 (左ハサミ)', type: 'mouth', parentId: 'insect_head', pivot: { x: -12, y: -24 }, zIndex: 13,
      fill: BEETLE_HORN, stroke: BEETLE_OUTLINE, strokeWidth: 2.4, closed: true,
      points: [
        { x: -8, y: -24, type: 'corner' },
        { x: -24, y: -45, type: 'smooth', inHandle: { x: -18, y: -34 }, outHandle: { x: -24, y: -58 } },
        { x: -10, y: -68, type: 'corner', inHandle: { x: -20, y: -66 }, outHandle: { x: -6, y: -64 } },
        { x: -4, y: -56, type: 'corner' },
        { x: -12, y: -54, type: 'corner' },
        { x: -6, y: -44, type: 'corner' },
        { x: -12, y: -42, type: 'corner' },
        { x: -4, y: -24, type: 'corner' }
      ]
    }),

    // 5. クワガタの大顎 (右)
    createPart({
      id: 'insect_mandible_right', name: '大顎 (右ハサミ)', type: 'mouth', parentId: 'insect_head', pivot: { x: 12, y: -24 }, zIndex: 13,
      fill: BEETLE_HORN, stroke: BEETLE_OUTLINE, strokeWidth: 2.4, closed: true,
      points: [
        { x: 4, y: -24, type: 'corner' },
        { x: 12, y: -42, type: 'corner' },
        { x: 6, y: -44, type: 'corner' },
        { x: 12, y: -54, type: 'corner' },
        { x: 4, y: -56, type: 'corner' },
        { x: 6, y: -64, type: 'corner' },
        { x: 10, y: -68, type: 'corner', inHandle: { x: 6, y: -64 }, outHandle: { x: 20, y: -66 } },
        { x: 24, y: -45, type: 'smooth', inHandle: { x: 24, y: -58 }, outHandle: { x: 18, y: -34 } },
        { x: 8, y: -24, type: 'corner' }
      ]
    }),

    // 6. 白目＋黒目のつぶらな目玉（イラスト3枚目準拠）
    createCirclePart({ id: 'insect_eye_white_l', name: '白目 (左)', type: 'eyes', parentId: 'insect_head', cx: -18, cy: -20, r: 5.5, fill: '#ffffff', stroke: BEETLE_OUTLINE, strokeWidth: 1.5, zIndex: 14 }),
    createCirclePart({ id: 'insect_eye_pupil_l', name: '瞳 (左)', type: 'eyes', parentId: 'insect_head', cx: -18, cy: -20, r: 3.2, fill: '#0a0a0c', stroke: 'none', strokeWidth: 0, zIndex: 15 }),
    createCirclePart({ id: 'insect_eye_white_r', name: '白目 (右)', type: 'eyes', parentId: 'insect_head', cx: 18, cy: -20, r: 5.5, fill: '#ffffff', stroke: BEETLE_OUTLINE, strokeWidth: 1.5, zIndex: 14 }),
    createCirclePart({ id: 'insect_eye_pupil_r', name: '瞳 (右)', type: 'eyes', parentId: 'insect_head', cx: 18, cy: -20, r: 3.2, fill: '#0a0a0c', stroke: 'none', strokeWidth: 0, zIndex: 15 }),

    // 7. 6本の屈折した昆虫の脚 (前肢・中肢・後肢)
    createPart({ id: 'insect_leg_fl', name: '前脚 (左)', type: 'leg', parentId: 'insect_thorax', pivot: { x: -20, y: -8 }, zIndex: 7, fill: 'none', stroke: BEETLE_LEG, strokeWidth: 2.8, closed: false, points: [{ x: -20, y: -8, type: 'corner' }, { x: -38, y: -30, type: 'corner' }, { x: -32, y: -48, type: 'corner' }] }),
    createPart({ id: 'insect_leg_fr', name: '前脚 (右)', type: 'leg', parentId: 'insect_thorax', pivot: { x: 20, y: -8 }, zIndex: 7, fill: 'none', stroke: BEETLE_LEG, strokeWidth: 2.8, closed: false, points: [{ x: 20, y: -8, type: 'corner' }, { x: 38, y: -30, type: 'corner' }, { x: 32, y: -48, type: 'corner' }] }),
    createPart({ id: 'insect_leg_ml', name: '中脚 (左)', type: 'leg', parentId: 'insect_thorax', pivot: { x: -22, y: 6 }, zIndex: 7, fill: 'none', stroke: BEETLE_LEG, strokeWidth: 2.8, closed: false, points: [{ x: -22, y: 6, type: 'corner' }, { x: -44, y: 16, type: 'corner' }, { x: -56, y: 16, type: 'corner' }] }),
    createPart({ id: 'insect_leg_mr', name: '中脚 (右)', type: 'leg', parentId: 'insect_thorax', pivot: { x: 22, y: 6 }, zIndex: 7, fill: 'none', stroke: BEETLE_LEG, strokeWidth: 2.8, closed: false, points: [{ x: 22, y: 6, type: 'corner' }, { x: 44, y: 16, type: 'corner' }, { x: 56, y: 16, type: 'corner' }] }),
    createPart({ id: 'insect_leg_bl', name: '後脚 (左)', type: 'leg', parentId: 'insect_abdomen', pivot: { x: -18, y: 28 }, zIndex: 7, fill: 'none', stroke: BEETLE_LEG, strokeWidth: 2.8, closed: false, points: [{ x: -18, y: 28, type: 'corner' }, { x: -40, y: 44, type: 'corner' }, { x: -36, y: 78, type: 'corner' }] }),
    createPart({ id: 'insect_leg_br', name: '後脚 (右)', type: 'leg', parentId: 'insect_abdomen', pivot: { x: 18, y: 28 }, zIndex: 7, fill: 'none', stroke: BEETLE_LEG, strokeWidth: 2.8, closed: false, points: [{ x: 18, y: 28, type: 'corner' }, { x: 40, y: 44, type: 'corner' }, { x: 36, y: 78, type: 'corner' }] })
  ];

  const animations = {
    swim: {
      id: 'swim', name: '通常優勢 (6脚歩行クワガタ)', duration: 0.6, loop: true,
      tracks: {
        insect_thorax: [{ time: 0.0, ty: 0 }, { time: 0.3, ty: -2 }, { time: 0.6, ty: 0 }],
        insect_mandible_left: [{ time: 0.0, rot: -2 }, { time: 0.3, rot: 4 }, { time: 0.6, rot: -2 }],
        insect_mandible_right: [{ time: 0.0, rot: 2 }, { time: 0.3, rot: -4 }, { time: 0.6, rot: 2 }],
        insect_leg_fl: [{ time: 0.0, rot: 15 }, { time: 0.3, rot: -15 }, { time: 0.6, rot: 15 }],
        insect_leg_fr: [{ time: 0.0, rot: -15 }, { time: 0.3, rot: 15 }, { time: 0.6, rot: -15 }],
        insect_leg_ml: [{ time: 0.0, rot: -15 }, { time: 0.3, rot: 15 }, { time: 0.6, rot: -15 }],
        insect_leg_mr: [{ time: 0.0, rot: 15 }, { time: 0.3, rot: -15 }, { time: 0.6, rot: 15 }],
        insect_leg_bl: [{ time: 0.0, rot: 15 }, { time: 0.3, rot: -15 }, { time: 0.6, rot: 15 }],
        insect_leg_br: [{ time: 0.0, rot: -15 }, { time: 0.3, rot: 15 }, { time: 0.6, rot: -15 }]
      }
    },
    idle: {
      id: 'idle', name: '待機 (大アゴ開閉・周囲警戒)', duration: 1.4, loop: true,
      tracks: {
        insect_mandible_left: [{ time: 0.0, rot: 0 }, { time: 0.7, rot: -8 }, { time: 1.4, rot: 0 }],
        insect_mandible_right: [{ time: 0.0, rot: 0 }, { time: 0.7, rot: 8 }, { time: 1.4, rot: 0 }],
        insect_head: [{ time: 0.0, ty: 0 }, { time: 0.7, ty: -1.5 }, { time: 1.4, ty: 0 }]
      }
    },
    flee: {
      id: 'flee', name: '逃走 (超高速スクランブル)', duration: 0.25, loop: true,
      tracks: {
        insect_thorax: [{ time: 0.0, ty: 0 }, { time: 0.125, ty: -4 }, { time: 0.25, ty: 0 }],
        insect_leg_fl: [{ time: 0.0, rot: 35 }, { time: 0.125, rot: -35 }, { time: 0.25, rot: 35 }],
        insect_leg_fr: [{ time: 0.0, rot: -35 }, { time: 0.125, rot: 35 }, { time: 0.25, rot: -35 }],
        insect_leg_ml: [{ time: 0.0, rot: -35 }, { time: 0.125, rot: 35 }, { time: 0.25, rot: -35 }],
        insect_leg_mr: [{ time: 0.0, rot: 35 }, { time: 0.125, rot: -35 }, { time: 0.25, rot: 35 }],
        insect_leg_bl: [{ time: 0.0, rot: 35 }, { time: 0.125, rot: -35 }, { time: 0.25, rot: 35 }],
        insect_leg_br: [{ time: 0.0, rot: -35 }, { time: 0.125, rot: 35 }, { time: 0.25, rot: -35 }]
      }
    },
    angry: {
      id: 'angry', name: '怒る (大アゴ挟み威嚇)', duration: 0.5, loop: true,
      tracks: {
        insect_mandible_left: [{ time: 0.0, rot: -15 }, { time: 0.25, rot: 12 }, { time: 0.5, rot: -15 }],
        insect_mandible_right: [{ time: 0.0, rot: 15 }, { time: 0.25, rot: -12 }, { time: 0.5, rot: 15 }],
        insect_head: [{ time: 0.0, rot: -4 }, { time: 0.25, rot: 4 }, { time: 0.5, rot: -4 }]
      }
    },
    tap: {
      id: 'tap', name: '大アゴ挟みアタック', duration: 0.4, loop: false,
      tracks: {
        insect_mandible_left: [{ time: 0.0, rot: -20 }, { time: 0.2, rot: 18 }, { time: 0.4, rot: 0 }],
        insect_mandible_right: [{ time: 0.0, rot: 20 }, { time: 0.2, rot: -18 }, { time: 0.4, rot: 0 }],
        insect_head: [{ time: 0.0, ty: 0 }, { time: 0.2, ty: -8 }, { time: 0.4, ty: 0 }]
      }
    }
  };

  return createCharacter({ id: 'insect', name: '昆虫 (クワガタ・大顎リグ)', species: 'insect', facing: -1, parts, animations });
}

/**
 * 12. 蜘蛛（Spider: 8本脚・タランチュラ型）プリセット
 * - 頭胸部、巨大腹部、鋭い毒牙、8つの目、8本の長大な脚
 * - アニメーション: crawl (波状8脚這い), idle (低姿勢待機), tap (威嚇バンザイ)
 */
export function getSpiderPreset() {
  const SPIDER_BODY = '#45494f';
  const SPIDER_CHEST = '#383b40';
  const SPIDER_COLLAR = '#8b929a';
  const SPIDER_BLACK = '#111215';

  const parts = [
    // 1. 巨大な腹部 (Teardrop卵形・2本の太い黒帯ストライプ)
    createPart({
      id: 'spider_abdomen', name: '腹部 (卵形甲殻)', type: 'body', parentId: 'spider_collar', pivot: { x: 0, y: 15 }, zIndex: 8,
      fill: SPIDER_BODY, stroke: SPIDER_BLACK, strokeWidth: 3.2, closed: true,
      points: [
        { x: -24, y: 5, type: 'corner', inHandle: { x: -24, y: 5 }, outHandle: { x: -28, y: 35 } },
        { x: -18, y: 55, type: 'smooth', inHandle: { x: -24, y: 45 }, outHandle: { x: -6, y: 68 } },
        { x: 0, y: 72, type: 'smooth', inHandle: { x: -4, y: 72 }, outHandle: { x: 4, y: 72 } },
        { x: 18, y: 55, type: 'smooth', inHandle: { x: 6, y: 68 }, outHandle: { x: 24, y: 45 } },
        { x: 24, y: 5, type: 'corner', inHandle: { x: 28, y: 35 }, outHandle: { x: 24, y: 5 } }
      ],
      subPaths: [
        // 添付画像1枚目: 腹部の2本の太い水平黒ストライプ
        { type: 'polygon', fill: SPIDER_BLACK, points: [{ x: -18, y: 26 }, { x: 18, y: 26 }, { x: 18, y: 32 }, { x: -18, y: 32 }] },
        { type: 'polygon', fill: SPIDER_BLACK, points: [{ x: -14, y: 44 }, { x: 14, y: 44 }, { x: 14, y: 50 }, { x: -14, y: 50 }] }
      ]
    }),

    // 2. 胸部カラー帯 (明るいグレーの中胸カラー)
    createPart({
      id: 'spider_collar', name: '中胸部カラー', type: 'body', parentId: null, pivot: { x: 0, y: 0 }, zIndex: 9,
      fill: SPIDER_COLLAR, stroke: SPIDER_BLACK, strokeWidth: 3.0, closed: true,
      points: [
        { x: -18, y: -2, type: 'smooth', inHandle: { x: -12, y: -4 }, outHandle: { x: -18, y: 8 } },
        { x: 0, y: 12, type: 'smooth', inHandle: { x: -12, y: 12 }, outHandle: { x: 12, y: 12 } },
        { x: 18, y: -2, type: 'smooth', inHandle: { x: 18, y: 8 }, outHandle: { x: 12, y: -4 } },
        { x: 0, y: -6, type: 'smooth', inHandle: { x: 12, y: -6 }, outHandle: { x: -12, y: -6 } }
      ]
    }),

    // 3. 頭部 (円形・2つの三日月状ハイライト目)
    createPart({
      id: 'spider_head', name: '頭部 (丸頭)', type: 'head', parentId: 'spider_collar', pivot: { x: 0, y: -16 }, zIndex: 11,
      fill: SPIDER_CHEST, stroke: SPIDER_BLACK, strokeWidth: 3.0, closed: true,
      points: [
        { x: -16, y: -16, type: 'smooth', inHandle: { x: -16, y: -7 }, outHandle: { x: -16, y: -25 } },
        { x: 0, y: -30, type: 'smooth', inHandle: { x: -10, y: -30 }, outHandle: { x: 10, y: -30 } },
        { x: 16, y: -16, type: 'smooth', inHandle: { x: 16, y: -25 }, outHandle: { x: 16, y: -7 } },
        { x: 0, y: -2, type: 'smooth', inHandle: { x: 10, y: -2 }, outHandle: { x: -10, y: -2 } }
      ],
      subPaths: [
        // 頭部の三日月状の白い模様/目
        { type: 'polygon', fill: '#d1d5db', points: [{ x: -13, y: -22 }, { x: -9, y: -16 }, { x: -12, y: -10 }, { x: -15, y: -16 }] },
        { type: 'polygon', fill: '#d1d5db', points: [{ x: 13, y: -22 }, { x: 9, y: -16 }, { x: 12, y: -10 }, { x: 15, y: -16 }] }
      ]
    }),

    // 4. 頭頂の2本の湾曲した鋭い毒牙 (Chelicerae)
    createPart({
      id: 'spider_fang_left', name: '毒牙 (左)', type: 'mouth', parentId: 'spider_head', pivot: { x: -6, y: -28 }, zIndex: 12,
      fill: SPIDER_BLACK, stroke: SPIDER_BLACK, strokeWidth: 1.5, closed: true,
      points: [
        { x: -9, y: -28, type: 'corner' },
        { x: -10, y: -40, type: 'corner' },
        { x: -3, y: -36, type: 'corner' },
        { x: -5, y: -28, type: 'corner' }
      ]
    }),
    createPart({
      id: 'spider_fang_right', name: '毒牙 (右)', type: 'mouth', parentId: 'spider_head', pivot: { x: 6, y: -28 }, zIndex: 12,
      fill: SPIDER_BLACK, stroke: SPIDER_BLACK, strokeWidth: 1.5, closed: true,
      points: [
        { x: 9, y: -28, type: 'corner' },
        { x: 10, y: -40, type: 'corner' },
        { x: 3, y: -36, type: 'corner' },
        { x: 5, y: -28, type: 'corner' }
      ]
    }),

    // 5. 8本の屈折した長い蜘蛛脚
    createPart({ id: 'spider_leg_l1', name: '第1脚 (左前)', type: 'leg', parentId: 'spider_collar', pivot: { x: -14, y: -6 }, zIndex: 7, fill: 'none', stroke: SPIDER_BLACK, strokeWidth: 3.2, closed: false, points: [{ x: -14, y: -6, type: 'corner' }, { x: -48, y: 4, type: 'corner' }, { x: -44, y: -52, type: 'corner' }, { x: -32, y: -74, type: 'corner' }] }),
    createPart({ id: 'spider_leg_l2', name: '第2脚 (左前中)', type: 'leg', parentId: 'spider_collar', pivot: { x: -16, y: -1 }, zIndex: 7, fill: 'none', stroke: SPIDER_BLACK, strokeWidth: 3.2, closed: false, points: [{ x: -16, y: -1, type: 'corner' }, { x: -60, y: -6, type: 'corner' }, { x: -74, y: -40, type: 'corner' }, { x: -70, y: -60, type: 'corner' }] }),
    createPart({ id: 'spider_leg_l3', name: '第3脚 (左後中)', type: 'leg', parentId: 'spider_collar', pivot: { x: -16, y: 5 }, zIndex: 7, fill: 'none', stroke: SPIDER_BLACK, strokeWidth: 3.2, closed: false, points: [{ x: -16, y: 5, type: 'corner' }, { x: -58, y: 8, type: 'corner' }, { x: -70, y: 22, type: 'corner' }, { x: -64, y: 58, type: 'corner' }] }),
    createPart({ id: 'spider_leg_l4', name: '第4脚 (左後)', type: 'leg', parentId: 'spider_collar', pivot: { x: -14, y: 10 }, zIndex: 7, fill: 'none', stroke: SPIDER_BLACK, strokeWidth: 3.2, closed: false, points: [{ x: -14, y: 10, type: 'corner' }, { x: -46, y: 22, type: 'corner' }, { x: -54, y: 56, type: 'corner' }, { x: -48, y: 86, type: 'corner' }] }),

    createPart({ id: 'spider_leg_r1', name: '第1脚 (右前)', type: 'leg', parentId: 'spider_collar', pivot: { x: 14, y: -6 }, zIndex: 7, fill: 'none', stroke: SPIDER_BLACK, strokeWidth: 3.2, closed: false, points: [{ x: 14, y: -6, type: 'corner' }, { x: 48, y: 4, type: 'corner' }, { x: 44, y: -52, type: 'corner' }, { x: 32, y: -74, type: 'corner' }] }),
    createPart({ id: 'spider_leg_r2', name: '第2脚 (右前中)', type: 'leg', parentId: 'spider_collar', pivot: { x: 16, y: -1 }, zIndex: 7, fill: 'none', stroke: SPIDER_BLACK, strokeWidth: 3.2, closed: false, points: [{ x: 16, y: -1, type: 'corner' }, { x: 60, y: -6, type: 'corner' }, { x: 74, y: -40, type: 'corner' }, { x: 70, y: -60, type: 'corner' }] }),
    createPart({ id: 'spider_leg_r3', name: '第3脚 (右後中)', type: 'leg', parentId: 'spider_collar', pivot: { x: 16, y: 5 }, zIndex: 7, fill: 'none', stroke: SPIDER_BLACK, strokeWidth: 3.2, closed: false, points: [{ x: 16, y: 5, type: 'corner' }, { x: 58, y: 8, type: 'corner' }, { x: 70, y: 22, type: 'corner' }, { x: 64, y: 58, type: 'corner' }] }),
    createPart({ id: 'spider_leg_r4', name: '第4脚 (右後)', type: 'leg', parentId: 'spider_collar', pivot: { x: 14, y: 10 }, zIndex: 7, fill: 'none', stroke: SPIDER_BLACK, strokeWidth: 3.2, closed: false, points: [{ x: 14, y: 10, type: 'corner' }, { x: 46, y: 22, type: 'corner' }, { x: 54, y: 56, type: 'corner' }, { x: 48, y: 86, type: 'corner' }] })
  ];

  const animations = {
    swim: {
      id: 'swim', name: '通常優勢 (波状8脚クモ歩行)', duration: 0.8, loop: true,
      tracks: {
        spider_collar: [{ time: 0.0, ty: 0 }, { time: 0.2, ty: -2 }, { time: 0.4, ty: 0 }, { time: 0.6, ty: -2 }, { time: 0.8, ty: 0 }],
        spider_head: [{ time: 0.0, rot: 0 }, { time: 0.4, rot: 3 }, { time: 0.8, rot: 0 }],
        spider_leg_l1: [{ time: 0.0, rot: 15 }, { time: 0.4, rot: -15 }, { time: 0.8, rot: 15 }],
        spider_leg_l2: [{ time: 0.0, rot: -15 }, { time: 0.4, rot: 15 }, { time: 0.8, rot: -15 }],
        spider_leg_l3: [{ time: 0.0, rot: 15 }, { time: 0.4, rot: -15 }, { time: 0.8, rot: 15 }],
        spider_leg_l4: [{ time: 0.0, rot: -15 }, { time: 0.4, rot: 15 }, { time: 0.8, rot: -15 }],
        spider_leg_r1: [{ time: 0.0, rot: -15 }, { time: 0.4, rot: 15 }, { time: 0.8, rot: -15 }],
        spider_leg_r2: [{ time: 0.0, rot: 15 }, { time: 0.4, rot: -15 }, { time: 0.8, rot: 15 }],
        spider_leg_r3: [{ time: 0.0, rot: -15 }, { time: 0.4, rot: 15 }, { time: 0.8, rot: -15 }],
        spider_leg_r4: [{ time: 0.0, rot: 15 }, { time: 0.4, rot: -15 }, { time: 0.8, rot: 15 }]
      }
    },
    idle: {
      id: 'idle', name: '待機 (低姿勢腹部呼吸)', duration: 1.6, loop: true,
      tracks: {
        spider_abdomen: [{ time: 0.0, ty: 0, sx: 1 }, { time: 0.8, ty: -2, sx: 1.05 }, { time: 1.6, ty: 0, sx: 1 }],
        spider_fang_left: [{ time: 0.0, rot: 0 }, { time: 0.8, rot: -6 }, { time: 1.6, rot: 0 }],
        spider_fang_right: [{ time: 0.0, rot: 0 }, { time: 0.8, rot: 6 }, { time: 1.6, rot: 0 }]
      }
    },
    flee: {
      id: 'flee', name: '逃走 (超高速8脚パニック疾走)', duration: 0.3, loop: true,
      tracks: {
        spider_collar: [{ time: 0.0, ty: 0 }, { time: 0.15, ty: -4 }, { time: 0.3, ty: 0 }],
        spider_leg_l1: [{ time: 0.0, rot: 30 }, { time: 0.15, rot: -30 }, { time: 0.3, rot: 30 }],
        spider_leg_l2: [{ time: 0.0, rot: -30 }, { time: 0.15, rot: 30 }, { time: 0.3, rot: -30 }],
        spider_leg_l3: [{ time: 0.0, rot: 30 }, { time: 0.15, rot: -30 }, { time: 0.3, rot: 30 }],
        spider_leg_l4: [{ time: 0.0, rot: -30 }, { time: 0.15, rot: 30 }, { time: 0.3, rot: -30 }],
        spider_leg_r1: [{ time: 0.0, rot: -30 }, { time: 0.15, rot: 30 }, { time: 0.3, rot: -30 }],
        spider_leg_r2: [{ time: 0.0, rot: 30 }, { time: 0.15, rot: -30 }, { time: 0.3, rot: 30 }],
        spider_leg_r3: [{ time: 0.0, rot: -30 }, { time: 0.15, rot: 30 }, { time: 0.3, rot: -30 }],
        spider_leg_r4: [{ time: 0.0, rot: 30 }, { time: 0.15, rot: -30 }, { time: 0.3, rot: 30 }]
      }
    },
    angry: {
      id: 'angry', name: '怒る (前脚リフト・毒牙威嚇)', duration: 0.6, loop: true,
      tracks: {
        spider_leg_l1: [{ time: 0.0, rot: -35 }, { time: 0.3, rot: -55 }, { time: 0.6, rot: -35 }],
        spider_leg_r1: [{ time: 0.0, rot: 35 }, { time: 0.3, rot: 55 }, { time: 0.6, rot: 35 }],
        spider_fang_left: [{ time: 0.0, rot: -10 }, { time: 0.3, rot: 15 }, { time: 0.6, rot: -10 }],
        spider_fang_right: [{ time: 0.0, rot: 10 }, { time: 0.3, rot: -15 }, { time: 0.6, rot: 10 }],
        spider_head: [{ time: 0.0, ty: 0 }, { time: 0.3, ty: -5 }, { time: 0.6, ty: 0 }]
      }
    },
    tap: {
      id: 'tap', name: '毒牙バイトアタック', duration: 0.4, loop: false,
      tracks: {
        spider_head: [{ time: 0.0, ty: 0 }, { time: 0.2, ty: -10 }, { time: 0.4, ty: 0 }],
        spider_fang_left: [{ time: 0.0, rot: 0 }, { time: 0.2, rot: 25 }, { time: 0.4, rot: 0 }],
        spider_fang_right: [{ time: 0.0, rot: 0 }, { time: 0.2, rot: -25 }, { time: 0.4, rot: 0 }]
      }
    }
  };

  return createCharacter({ id: 'spider', name: '蜘蛛 (8脚オオグモ・リアルリグ)', species: 'spider', facing: -1, parts, animations });
}

/**
 * 13. 鳥（Bird: カモメ・ワシ・インコ・ツバメ）プリセット
 * - 流線型胴体、頭部、くちばし、目、広大な翼（奥・手前）、扇状尾羽、足
 * - アニメーション: fly (優雅な大羽ばたき), glide (気流滑空), tap (宙返り急降下)
 */
export function getBirdPreset() {
  const BIRD_BODY = '#58bdf6';
  const BIRD_WING = '#9de4fb';
  const BIRD_BEAK = '#facc15';
  const BIRD_EYE = '#0f172a';

  const parts = [
    // 1. 青い小鳥の流線型ボディ (頭・胴体・上向き尾羽が一体成型)
    createPart({
      id: 'bird_body', name: '小鳥ボディ (水色)', type: 'body', parentId: null, pivot: { x: 0, y: 0 }, zIndex: 10,
      fill: BIRD_BODY, stroke: 'none', strokeWidth: 0, closed: true,
      points: [
        // 頭頂〜背中
        { x: -28, y: -20, type: 'smooth', inHandle: { x: -38, y: -14 }, outHandle: { x: -14, y: -24 } },
        { x: 10, y: -14, type: 'smooth', inHandle: { x: -4, y: -20 }, outHandle: { x: 26, y: -4 } },
        // 上向きに跳ねる可愛い小尾
        { x: 48, y: -6, type: 'corner', inHandle: { x: 38, y: -8 }, outHandle: { x: 44, y: 4 } },
        { x: 36, y: 6, type: 'smooth', inHandle: { x: 44, y: 4 }, outHandle: { x: 22, y: 18 } },
        // まるまる太ったお腹
        { x: -2, y: 24, type: 'smooth', inHandle: { x: 16, y: 24 }, outHandle: { x: -22, y: 22 } },
        // 喉元〜顔
        { x: -38, y: 4, type: 'smooth', inHandle: { x: -32, y: 16 }, outHandle: { x: -42, y: -8 } }
      ]
    }),

    // 2. 黄色い三角くちばし (左向き)
    createPart({
      id: 'bird_beak', name: 'くちばし (黄)', type: 'mouth', parentId: 'bird_body', pivot: { x: -40, y: -6 }, zIndex: 9,
      fill: BIRD_BEAK, stroke: 'none', strokeWidth: 0, closed: true,
      points: [
        { x: -38, y: -12, type: 'corner' },
        { x: -54, y: -6, type: 'corner' },
        { x: -38, y: 0, type: 'corner' }
      ]
    }),

    // 3. つぶらな黒い瞳
    createCirclePart({
      id: 'bird_eye', name: 'つぶらな瞳', type: 'eyes', parentId: 'bird_body',
      cx: -26, cy: -10, r: 4.2, fill: BIRD_EYE, stroke: 'none', strokeWidth: 0, zIndex: 14
    }),

    // 4. 明るいパステルブルーの翼 (奥・控えめ)
    createPart({
      id: 'bird_wing_far', name: '翼 (奥)', type: 'fin_dorsal', parentId: 'bird_body', pivot: { x: -8, y: -8 }, zIndex: 8,
      fill: '#7dd3fc', stroke: 'none', strokeWidth: 0, closed: true,
      points: [
        { x: -8, y: -8, type: 'corner', inHandle: { x: -8, y: -8 }, outHandle: { x: -14, y: -30 } },
        { x: 6, y: -40, type: 'smooth', inHandle: { x: -6, y: -38 }, outHandle: { x: 28, y: -36 } },
        { x: 44, y: -24, type: 'corner', inHandle: { x: 38, y: -28 }, outHandle: { x: 26, y: -12 } },
        { x: 10, y: -4, type: 'smooth', inHandle: { x: 22, y: -8 }, outHandle: { x: -2, y: -4 } }
      ]
    }),

    // 5. 明るいパステルブルーの翼 (手前)
    createPart({
      id: 'bird_wing_near', name: '翼 (手前)', type: 'fin_pectoral', parentId: 'bird_body', pivot: { x: -6, y: -4 }, zIndex: 15,
      fill: BIRD_WING, stroke: 'none', strokeWidth: 0, closed: true,
      points: [
        { x: -6, y: -4, type: 'corner', inHandle: { x: -6, y: -4 }, outHandle: { x: -12, y: -28 } },
        { x: 10, y: -36, type: 'smooth', inHandle: { x: -2, y: -34 }, outHandle: { x: 30, y: -30 } },
        { x: 46, y: -18, type: 'corner', inHandle: { x: 40, y: -24 }, outHandle: { x: 28, y: -6 } },
        { x: 14, y: 0, type: 'smooth', inHandle: { x: 24, y: -2 }, outHandle: { x: 0, y: 0 } }
      ]
    })
  ];

  const animations = {
    swim: {
      id: 'swim', name: '通常優勢 (大空羽ばたき飛行)', duration: 0.8, loop: true,
      tracks: {
        bird_body: [{ time: 0.0, ty: 0 }, { time: 0.4, ty: -5 }, { time: 0.8, ty: 0 }],
        bird_wing_near: [{ time: 0.0, rot: -35 }, { time: 0.4, rot: 40 }, { time: 0.8, rot: -35 }],
        bird_wing_far: [{ time: 0.0, rot: -30 }, { time: 0.4, rot: 35 }, { time: 0.8, rot: -30 }]
      }
    },
    idle: {
      id: 'idle', name: '待機 (ふわふわ浮遊待機)', duration: 1.6, loop: true,
      tracks: {
        bird_body: [{ time: 0.0, ty: 0, rot: -2 }, { time: 0.8, ty: 3, rot: 2 }, { time: 1.6, ty: 0, rot: -2 }],
        bird_wing_near: [{ time: 0.0, rot: -8 }, { time: 0.8, rot: -2 }, { time: 1.6, rot: -8 }],
        bird_wing_far: [{ time: 0.0, rot: -8 }, { time: 0.8, rot: -2 }, { time: 1.6, rot: -8 }]
      }
    },
    flee: {
      id: 'flee', name: '逃走 (超高速パニック飛行)', duration: 0.25, loop: true,
      tracks: {
        bird_body: [{ time: 0.0, ty: 0, rot: 10 }, { time: 0.125, ty: -8, rot: 15 }, { time: 0.25, ty: 0, rot: 10 }],
        bird_wing_near: [{ time: 0.0, rot: -60 }, { time: 0.125, rot: 60 }, { time: 0.25, rot: -60 }],
        bird_wing_far: [{ time: 0.0, rot: -55 }, { time: 0.125, rot: 55 }, { time: 0.25, rot: -55 }]
      }
    },
    angry: {
      id: 'angry', name: '怒る (急上昇威嚇・翼バタバタ)', duration: 0.5, loop: true,
      tracks: {
        bird_body: [{ time: 0.0, ty: 0, rot: -15 }, { time: 0.25, ty: -8, rot: -5 }, { time: 0.5, ty: 0, rot: -15 }],
        bird_wing_near: [{ time: 0.0, rot: 30 }, { time: 0.25, rot: -45 }, { time: 0.5, rot: 30 }],
        bird_wing_far: [{ time: 0.0, rot: 25 }, { time: 0.25, rot: -40 }, { time: 0.5, rot: 25 }]
      }
    },
    tap: {
      id: 'tap', name: 'アクロバット宙返り', duration: 0.6, loop: false,
      tracks: {
        bird_body: [{ time: 0.0, ty: 0, rot: 0 }, { time: 0.3, ty: -25, rot: -180 }, { time: 0.6, ty: 0, rot: -360 }],
        bird_wing_near: [{ time: 0.0, rot: 0 }, { time: 0.3, rot: -80 }, { time: 0.6, rot: 0 }],
        bird_wing_far: [{ time: 0.0, rot: 0 }, { time: 0.3, rot: -80 }, { time: 0.6, rot: 0 }]
      }
    }
  };

  return createCharacter({ id: 'bird', name: '鳥 (青い鳥・イラスト準拠)', species: 'bird', facing: -1, parts, animations });
}

/**
 * 14. 漢字・鮃（Hirame Kanji）プリセット
 */
export function getKanjiHiramePreset() {
  const parts = [
    createPart({
      id: 'kanji_body',
      name: '漢字文字「鮃」',
      type: 'text',
      parentId: null,
      pivot: { x: 0, y: 0 },
      zIndex: 10,
      fill: '#fbbf24',
      stroke: '#0f172a',
      strokeWidth: 4,
      text: '鮃',
      fontSize: 82,
      fontFamily: '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif',
      closed: true,
      points: [
        { x: -35, y: -35, type: 'corner' },
        { x: 35, y: -35, type: 'corner' },
        { x: 35, y: 35, type: 'corner' },
        { x: -35, y: 35, type: 'corner' }
      ]
    })
  ];

  const animations = {
    swim: {
      id: 'swim', name: '通常優勢 (漢字スライド遊泳)', duration: 0.8, loop: true,
      tracks: {
        kanji_body: [
          { time: 0.0, ty: 0, rot: 0 },
          { time: 0.25, ty: -4, rot: -5 },
          { time: 0.5, ty: 0, rot: 0 },
          { time: 0.75, ty: 4, rot: 5 },
          { time: 1.0, ty: 0, rot: 0 }
        ]
      }
    },
    idle: {
      id: 'idle', name: '待機 (呼吸伸縮)', duration: 1.6, loop: true,
      tracks: {
        kanji_body: [
          { time: 0.0, sx: 1.0, sy: 1.0 },
          { time: 0.8, sx: 0.94, sy: 1.08 },
          { time: 1.6, sx: 1.0, sy: 1.0 }
        ]
      }
    },
    flee: {
      id: 'flee', name: '逃走 (パニック高速スピン)', duration: 0.3, loop: true,
      tracks: {
        kanji_body: [
          { time: 0.0, rot: 0, ty: 0 },
          { time: 0.15, rot: 15, ty: -6 },
          { time: 0.3, rot: 0, ty: 0 }
        ]
      }
    },
    angry: {
      id: 'angry', name: '怒る (巨大化威嚇)', duration: 0.5, loop: true,
      tracks: {
        kanji_body: [
          { time: 0.0, sx: 1.0, sy: 1.0, rot: 0 },
          { time: 0.25, sx: 1.25, sy: 1.25, rot: -8 },
          { time: 0.5, sx: 1.0, sy: 1.0, rot: 0 }
        ]
      }
    },
    tap: {
      id: 'tap', name: '跳ね起き', duration: 0.4, loop: false,
      tracks: {
        kanji_body: [
          { time: 0.0, ty: 0, rot: 0 },
          { time: 0.2, ty: -24, rot: 12 },
          { time: 0.4, ty: 0, rot: 0 }
        ]
      }
    }
  };

  return createCharacter({ id: 'kanji_hirame', name: '漢字・鮃 (ヒラメ)', species: 'fish', facing: -1, parts, animations });
}

/**
 * 15. 漢字・鰈（Karei Kanji 1）プリセット
 */
export function getKanjiKarei1Preset() {
  const parts = [
    createPart({
      id: 'kanji_body',
      name: '漢字文字「鰈」',
      type: 'text',
      parentId: null,
      pivot: { x: 0, y: 0 },
      zIndex: 10,
      fill: '#ba8551',
      stroke: '#382013',
      strokeWidth: 4,
      text: '鰈',
      fontSize: 82,
      fontFamily: '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif',
      closed: true,
      points: [
        { x: -35, y: -35, type: 'corner' },
        { x: 35, y: -35, type: 'corner' },
        { x: 35, y: 35, type: 'corner' },
        { x: -35, y: 35, type: 'corner' }
      ]
    })
  ];

  const animations = {
    swim: {
      id: 'swim', name: '通常優勢 (漢字スライド遊泳)', duration: 0.8, loop: true,
      tracks: {
        kanji_body: [
          { time: 0.0, ty: 0, rot: 0 },
          { time: 0.25, ty: -4, rot: 5 },
          { time: 0.5, ty: 0, rot: 0 },
          { time: 0.75, ty: 4, rot: -5 },
          { time: 1.0, ty: 0, rot: 0 }
        ]
      }
    },
    idle: {
      id: 'idle', name: '待機 (呼吸伸縮)', duration: 1.6, loop: true,
      tracks: {
        kanji_body: [
          { time: 0.0, sx: 1.0, sy: 1.0 },
          { time: 0.8, sx: 0.94, sy: 1.08 },
          { time: 1.6, sx: 1.0, sy: 1.0 }
        ]
      }
    },
    flee: {
      id: 'flee', name: '逃走 (パニック高速スピン)', duration: 0.3, loop: true,
      tracks: {
        kanji_body: [
          { time: 0.0, rot: 0, ty: 0 },
          { time: 0.15, rot: -15, ty: -6 },
          { time: 0.3, rot: 0, ty: 0 }
        ]
      }
    },
    angry: {
      id: 'angry', name: '怒る (巨大化威嚇)', duration: 0.5, loop: true,
      tracks: {
        kanji_body: [
          { time: 0.0, sx: 1.0, sy: 1.0, rot: 0 },
          { time: 0.25, sx: 1.25, sy: 1.25, rot: 8 },
          { time: 0.5, sx: 1.0, sy: 1.0, rot: 0 }
        ]
      }
    },
    tap: {
      id: 'tap', name: '跳ね起き', duration: 0.4, loop: false,
      tracks: {
        kanji_body: [
          { time: 0.0, ty: 0, rot: 0 },
          { time: 0.2, ty: -24, rot: -12 },
          { time: 0.4, ty: 0, rot: 0 }
        ]
      }
    }
  };

  return createCharacter({ id: 'kanji_karei_1', name: '漢字・鰈 (カレイ)', species: 'fish', facing: 1, parts, animations });
}

/**
 * 16. 漢字・魪（Karei Kanji 2）プリセット
 */
export function getKanjiKarei2Preset() {
  const parts = [
    createPart({
      id: 'kanji_body',
      name: '漢字文字「魪」',
      type: 'text',
      parentId: null,
      pivot: { x: 0, y: 0 },
      zIndex: 10,
      fill: '#f97316',
      stroke: '#431407',
      strokeWidth: 4,
      text: '魪',
      fontSize: 82,
      fontFamily: '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif',
      closed: true,
      points: [
        { x: -35, y: -35, type: 'corner' },
        { x: 35, y: -35, type: 'corner' },
        { x: 35, y: 35, type: 'corner' },
        { x: -35, y: 35, type: 'corner' }
      ]
    })
  ];

  const animations = {
    swim: {
      id: 'swim', name: '通常優勢 (漢字スライド遊泳)', duration: 0.8, loop: true,
      tracks: {
        kanji_body: [
          { time: 0.0, ty: 0, rot: 0 },
          { time: 0.25, ty: -4, rot: 5 },
          { time: 0.5, ty: 0, rot: 0 },
          { time: 0.75, ty: 4, rot: -5 },
          { time: 1.0, ty: 0, rot: 0 }
        ]
      }
    },
    idle: {
      id: 'idle', name: '待機 (呼吸伸縮)', duration: 1.6, loop: true,
      tracks: {
        kanji_body: [
          { time: 0.0, sx: 1.0, sy: 1.0 },
          { time: 0.8, sx: 0.94, sy: 1.08 },
          { time: 1.6, sx: 1.0, sy: 1.0 }
        ]
      }
    },
    flee: {
      id: 'flee', name: '逃走 (パニック高速スピン)', duration: 0.3, loop: true,
      tracks: {
        kanji_body: [
          { time: 0.0, rot: 0, ty: 0 },
          { time: 0.15, rot: -15, ty: -6 },
          { time: 0.3, rot: 0, ty: 0 }
        ]
      }
    },
    angry: {
      id: 'angry', name: '怒る (巨大化威嚇)', duration: 0.5, loop: true,
      tracks: {
        kanji_body: [
          { time: 0.0, sx: 1.0, sy: 1.0, rot: 0 },
          { time: 0.25, sx: 1.25, sy: 1.25, rot: 8 },
          { time: 0.5, sx: 1.0, sy: 1.0, rot: 0 }
        ]
      }
    },
    tap: {
      id: 'tap', name: '跳ね起き', duration: 0.4, loop: false,
      tracks: {
        kanji_body: [
          { time: 0.0, ty: 0, rot: 0 },
          { time: 0.2, ty: -24, rot: -12 },
          { time: 0.4, ty: 0, rot: 0 }
        ]
      }
    }
  };

  return createCharacter({ id: 'kanji_karei_2', name: '漢字・魪 (カレイ・魪)', species: 'fish', facing: 1, parts, animations });
}

// ── 18. スペシャルキャラ: ぶーちゃん (豚顔イルカ・人魚スタイル) ──
export function getBoochanPreset() {
  const PIG_PINK = '#f472b6';
  const PIG_PINK_SHADOW = '#ec4899';
  const PIG_BELLY = '#fdf2f8';
  const PIG_SNOUT = '#fb7185';
  const PIG_NOSTRIL = '#4c0519';
  const PIG_EAR_INNER = '#fbcfe8';
  const PIG_OUTLINE = '#831843';
  const CHONMAGE_HAIR = '#262626';
  const CHONMAGE_CORD = '#e2e8f0';

  const parts = [
    // 1. イルカ尾びれ (三日月状の美しいドルフィンフルーク)
    createPart({
      id: 'boo_tail',
      name: 'イルカ尾びれ',
      type: 'fin_tail',
      parentId: 'boo_body',
      pivot: { x: 45, y: 0 },
      zIndex: 1,
      fill: PIG_PINK_SHADOW,
      stroke: PIG_OUTLINE,
      strokeWidth: 2.8,
      closed: true,
      points: [
        { x: 44, y: -6, type: 'corner', inHandle: { x: 44, y: -6 }, outHandle: { x: 56, y: -16 } },
        { x: 80, y: -24, type: 'corner', inHandle: { x: 68, y: -24 }, outHandle: { x: 74, y: -10 } },
        { x: 68, y: 0, type: 'smooth', inHandle: { x: 72, y: -8 }, outHandle: { x: 72, y: 8 } },
        { x: 80, y: 24, type: 'corner', inHandle: { x: 74, y: 10 }, outHandle: { x: 68, y: 24 } },
        { x: 44, y: 6, type: 'corner', inHandle: { x: 56, y: 16 }, outHandle: { x: 44, y: 6 } }
      ]
    }),

    // 2. 背びれ (滑らかなイルカ背びれ)
    createPart({
      id: 'boo_dorsal',
      name: 'イルカ背びれ',
      type: 'fin_dorsal',
      parentId: 'boo_body',
      pivot: { x: 6, y: -18 },
      zIndex: 2,
      fill: PIG_PINK_SHADOW,
      stroke: PIG_OUTLINE,
      strokeWidth: 2.6,
      closed: true,
      points: [
        { x: -6, y: -18, type: 'corner', inHandle: { x: -6, y: -18 }, outHandle: { x: 2, y: -36 } },
        { x: 12, y: -38, type: 'smooth', inHandle: { x: 5, y: -38 }, outHandle: { x: 18, y: -30 } },
        { x: 22, y: -14, type: 'corner', inHandle: { x: 16, y: -22 }, outHandle: { x: 22, y: -14 } }
      ]
    }),

    // 3. イルカボディ (アーチ状の美しい流線型胴体)
    createPart({
      id: 'boo_body',
      name: 'イルカ胴体 (ピンク)',
      type: 'body_mid',
      parentId: 'boo_head',
      pivot: { x: -25, y: 0 },
      zIndex: 3,
      fill: PIG_PINK,
      stroke: PIG_OUTLINE,
      strokeWidth: 3,
      closed: true,
      points: [
        { x: -32, y: -18, type: 'smooth', inHandle: { x: -36, y: -12 }, outHandle: { x: -10, y: -24 } },
        { x: 10, y: -20, type: 'smooth', inHandle: { x: -5, y: -22 }, outHandle: { x: 30, y: -14 } },
        { x: 46, y: -6, type: 'corner', inHandle: { x: 38, y: -10 }, outHandle: { x: 46, y: 0 } },
        { x: 46, y: 6, type: 'corner', inHandle: { x: 46, y: 0 }, outHandle: { x: 38, y: 10 } },
        { x: 12, y: 22, type: 'smooth', inHandle: { x: 30, y: 16 }, outHandle: { x: -8, y: 24 } },
        { x: -32, y: 18, type: 'smooth', inHandle: { x: -16, y: 22 }, outHandle: { x: -36, y: 10 } }
      ]
    }),

    // 4. 腹部ライン (イルカ特有の淡いピンクホワイト腹面)
    createPart({
      id: 'boo_belly',
      name: 'お腹 (ホワイトピンク)',
      type: 'body_back',
      parentId: 'boo_body',
      pivot: { x: 0, y: 15 },
      zIndex: 4,
      fill: PIG_BELLY,
      stroke: PIG_OUTLINE,
      strokeWidth: 1.8,
      closed: true,
      points: [
        { x: -30, y: 6, type: 'smooth', inHandle: { x: -30, y: 6 }, outHandle: { x: -10, y: 8 } },
        { x: 14, y: 10, type: 'smooth', inHandle: { x: -4, y: 8 }, outHandle: { x: 32, y: 6 } },
        { x: 44, y: 5, type: 'corner', inHandle: { x: 38, y: 6 }, outHandle: { x: 44, y: 5 } },
        { x: 44, y: 6, type: 'corner', inHandle: { x: 44, y: 6 }, outHandle: { x: 38, y: 10 } },
        { x: 12, y: 22, type: 'smooth', inHandle: { x: 30, y: 16 }, outHandle: { x: -8, y: 24 } },
        { x: -30, y: 17, type: 'corner', inHandle: { x: -16, y: 22 }, outHandle: { x: -30, y: 17 } }
      ]
    }),

    // 5. 胸びれ (側面のパドルヒレ)
    createPart({
      id: 'boo_flipper',
      name: '胸びれ',
      type: 'fin_pectoral',
      parentId: 'boo_body',
      pivot: { x: -10, y: 8 },
      zIndex: 5,
      fill: PIG_PINK_SHADOW,
      stroke: PIG_OUTLINE,
      strokeWidth: 2.4,
      closed: true,
      points: [
        { x: -14, y: 6, type: 'corner', inHandle: { x: -14, y: 6 }, outHandle: { x: -4, y: 4 } },
        { x: 8, y: 10, type: 'corner', inHandle: { x: 0, y: 8 }, outHandle: { x: 4, y: 18 } },
        { x: -6, y: 22, type: 'smooth', inHandle: { x: 2, y: 22 }, outHandle: { x: -12, y: 18 } },
        { x: -15, y: 12, type: 'corner', inHandle: { x: -15, y: 16 }, outHandle: { x: -15, y: 12 } }
      ]
    }),

    // 6. 奥の豚耳 (右耳)
    createPart({
      id: 'boo_ear_right',
      name: '豚耳 (右・奥)',
      type: 'decoration',
      parentId: 'boo_head',
      pivot: { x: -35, y: -24 },
      zIndex: 5.5,
      fill: PIG_PINK,
      stroke: PIG_OUTLINE,
      strokeWidth: 2.4,
      closed: true,
      points: [
        { x: -44, y: -24, type: 'corner', inHandle: { x: -44, y: -24 }, outHandle: { x: -38, y: -38 } },
        { x: -28, y: -44, type: 'smooth', inHandle: { x: -34, y: -44 }, outHandle: { x: -22, y: -38 } },
        { x: -24, y: -26, type: 'corner', inHandle: { x: -22, y: -34 }, outHandle: { x: -30, y: -24 } }
      ]
    }),
    createPart({
      id: 'boo_ear_inner_right',
      name: '豚耳内側 (右・奥)',
      type: 'decoration',
      parentId: 'boo_ear_right',
      pivot: { x: -32, y: -31 },
      zIndex: 5.6,
      fill: PIG_EAR_INNER,
      stroke: 'none',
      strokeWidth: 0,
      closed: true,
      points: [
        { x: -40, y: -26, type: 'corner', inHandle: { x: -40, y: -26 }, outHandle: { x: -29, y: -40 } },
        { x: -29, y: -40, type: 'corner', inHandle: { x: -29, y: -40 }, outHandle: { x: -26, y: -27 } },
        { x: -26, y: -27, type: 'corner', inHandle: { x: -26, y: -27 }, outHandle: { x: -40, y: -26 } }
      ]
    }),

    // 7. 豚ヘッド (丸っこく愛らしい豚の顔)
    createPart({
      id: 'boo_head',
      name: '豚頭部',
      type: 'body_front',
      parentId: null,
      pivot: { x: -50, y: 0 },
      zIndex: 6,
      fill: PIG_PINK,
      stroke: PIG_OUTLINE,
      strokeWidth: 3,
      closed: true,
      points: [
        { x: -30, y: -18, type: 'smooth', inHandle: { x: -26, y: -10 }, outHandle: { x: -38, y: -28 } },
        { x: -54, y: -32, type: 'smooth', inHandle: { x: -44, y: -32 }, outHandle: { x: -68, y: -28 } },
        { x: -78, y: -14, type: 'smooth', inHandle: { x: -76, y: -24 }, outHandle: { x: -84, y: 0 } },
        { x: -82, y: 12, type: 'smooth', inHandle: { x: -84, y: 4 }, outHandle: { x: -74, y: 24 } },
        { x: -54, y: 26, type: 'smooth', inHandle: { x: -66, y: 26 }, outHandle: { x: -40, y: 24 } },
        { x: -30, y: 16, type: 'smooth', inHandle: { x: -36, y: 20 }, outHandle: { x: -26, y: 8 } }
      ]
    }),

    // 8. チョンマゲ (添付画像1参考: 頭頂部からピンと立つちょんまげ＆包帯結び紐)
    createPart({
      id: 'boo_chonmage',
      name: 'チョンマゲ (侍結び髪)',
      type: 'decoration',
      parentId: 'boo_head',
      pivot: { x: -54, y: -32 },
      zIndex: 6.8,
      fill: CHONMAGE_HAIR,
      stroke: PIG_OUTLINE,
      strokeWidth: 2.2,
      closed: true,
      points: [
        { x: -58, y: -32, type: 'corner', inHandle: { x: -58, y: -32 }, outHandle: { x: -58, y: -45 } },
        { x: -56, y: -58, type: 'smooth', inHandle: { x: -60, y: -50 }, outHandle: { x: -52, y: -68 } },
        { x: -48, y: -68, type: 'corner', inHandle: { x: -50, y: -70 }, outHandle: { x: -44, y: -62 } },
        { x: -48, y: -48, type: 'smooth', inHandle: { x: -44, y: -56 }, outHandle: { x: -50, y: -38 } },
        { x: -50, y: -32, type: 'corner', inHandle: { x: -50, y: -36 }, outHandle: { x: -58, y: -32 } }
      ]
    }),
    createPart({
      id: 'boo_chonmage_cord_1',
      name: 'チョンマゲ結び紐 1 (下)',
      type: 'decoration',
      parentId: 'boo_chonmage',
      pivot: { x: -53, y: -44 },
      zIndex: 6.85,
      fill: CHONMAGE_CORD,
      stroke: PIG_OUTLINE,
      strokeWidth: 1.2,
      closed: true,
      points: [
        { x: -58, y: -44, type: 'corner', inHandle: { x: -58, y: -44 }, outHandle: { x: -48, y: -42 } },
        { x: -48, y: -42, type: 'corner', inHandle: { x: -48, y: -42 }, outHandle: { x: -49, y: -47 } },
        { x: -49, y: -47, type: 'corner', inHandle: { x: -49, y: -47 }, outHandle: { x: -57, y: -49 } },
        { x: -57, y: -49, type: 'corner', inHandle: { x: -57, y: -49 }, outHandle: { x: -58, y: -44 } }
      ]
    }),
    createPart({
      id: 'boo_chonmage_cord_2',
      name: 'チョンマゲ結び紐 2 (上)',
      type: 'decoration',
      parentId: 'boo_chonmage',
      pivot: { x: -53, y: -50 },
      zIndex: 6.86,
      fill: CHONMAGE_CORD,
      stroke: PIG_OUTLINE,
      strokeWidth: 1.2,
      closed: true,
      points: [
        { x: -57, y: -50, type: 'corner', inHandle: { x: -57, y: -50 }, outHandle: { x: -49, y: -48 } },
        { x: -49, y: -48, type: 'corner', inHandle: { x: -49, y: -48 }, outHandle: { x: -50, y: -53 } },
        { x: -50, y: -53, type: 'corner', inHandle: { x: -50, y: -53 }, outHandle: { x: -56, y: -55 } },
        { x: -56, y: -55, type: 'corner', inHandle: { x: -56, y: -55 }, outHandle: { x: -57, y: -50 } }
      ]
    }),

    // 9. 手前の豚耳 (左耳・垂れ耳)
    createPart({
      id: 'boo_ear_left',
      name: '豚耳 (左・手前)',
      type: 'decoration',
      parentId: 'boo_head',
      pivot: { x: -65, y: -25 },
      zIndex: 7.2,
      fill: PIG_PINK,
      stroke: PIG_OUTLINE,
      strokeWidth: 2.6,
      closed: true,
      points: [
        { x: -72, y: -22, type: 'corner', inHandle: { x: -72, y: -22 }, outHandle: { x: -78, y: -36 } },
        { x: -66, y: -46, type: 'smooth', inHandle: { x: -74, y: -44 }, outHandle: { x: -56, y: -44 } },
        { x: -54, y: -28, type: 'corner', inHandle: { x: -54, y: -38 }, outHandle: { x: -62, y: -24 } }
      ]
    }),
    createPart({
      id: 'boo_ear_inner_left',
      name: '豚耳内側 (左・手前)',
      type: 'decoration',
      parentId: 'boo_ear_left',
      pivot: { x: -65, y: -33 },
      zIndex: 7.25,
      fill: PIG_EAR_INNER,
      stroke: 'none',
      strokeWidth: 0,
      closed: true,
      points: [
        { x: -70, y: -26, type: 'corner', inHandle: { x: -70, y: -26 }, outHandle: { x: -66, y: -42 } },
        { x: -66, y: -42, type: 'corner', inHandle: { x: -66, y: -42 }, outHandle: { x: -58, y: -30 } },
        { x: -58, y: -30, type: 'corner', inHandle: { x: -58, y: -30 }, outHandle: { x: -70, y: -26 } }
      ]
    }),

    // 10. 豚鼻 (チャームポイントの大きな楕円スナウト ＆ 2つの鼻の穴)
    createPart({
      id: 'boo_snout',
      name: '豚の鼻 (スナウト)',
      type: 'decoration',
      parentId: 'boo_head',
      pivot: { x: -74, y: 4 },
      zIndex: 8,
      fill: PIG_SNOUT,
      stroke: PIG_OUTLINE,
      strokeWidth: 2.6,
      closed: true,
      points: [
        { x: -88, y: 3, type: 'smooth', inHandle: { x: -88, y: -4 }, outHandle: { x: -88, y: 10 } },
        { x: -75, y: 12, type: 'smooth', inHandle: { x: -82, y: 12 }, outHandle: { x: -67, y: 12 } },
        { x: -61, y: 3, type: 'smooth', inHandle: { x: -61, y: 10 }, outHandle: { x: -61, y: -4 } },
        { x: -75, y: -5, type: 'smooth', inHandle: { x: -67, y: -5 }, outHandle: { x: -82, y: -5 } }
      ]
    }),
    createCirclePart({
      id: 'boo_nostril_left',
      name: '鼻の穴 (左)',
      type: 'decoration',
      parentId: 'boo_snout',
      cx: -79,
      cy: 3.5,
      r: 3.2,
      zIndex: 8.05,
      fill: PIG_NOSTRIL,
      stroke: 'none',
      strokeWidth: 0
    }),
    createCirclePart({
      id: 'boo_nostril_right',
      name: '鼻の穴 (右)',
      type: 'decoration',
      parentId: 'boo_snout',
      cx: -69,
      cy: 3.5,
      r: 3.2,
      zIndex: 8.06,
      fill: PIG_NOSTRIL,
      stroke: 'none',
      strokeWidth: 0
    }),

    // 11. チーク (ぽっと赤らむピンクほっぺ)
    createCirclePart({
      id: 'boo_cheek_left',
      name: 'ほっぺチーク',
      type: 'decoration',
      parentId: 'boo_head',
      cx: -48,
      cy: 8,
      r: 6.5,
      zIndex: 8.1,
      fill: '#fb7185',
      stroke: 'none',
      strokeWidth: 0,
      opacity: 0.8
    }),

    // 12. 豚の目 (添付画像1の幸せそうなにっこり閉じた弧状の目)
    createPart({
      id: 'boo_eye',
      name: 'にっこり目 (閉眼アーチ)',
      type: 'eyes',
      parentId: 'boo_head',
      pivot: { x: -56, y: -10 },
      zIndex: 8.3,
      fill: 'none',
      stroke: PIG_OUTLINE,
      strokeWidth: 3.2,
      closed: false,
      points: [
        { x: -64, y: -8, type: 'corner', inHandle: { x: -64, y: -8 }, outHandle: { x: -60, y: -16 } },
        { x: -56, y: -15, type: 'smooth', inHandle: { x: -60, y: -16 }, outHandle: { x: -52, y: -16 } },
        { x: -48, y: -7, type: 'corner', inHandle: { x: -52, y: -16 }, outHandle: { x: -48, y: -7 } }
      ]
    }),

    // 13. にっこり口
    createPart({
      id: 'boo_mouth',
      name: 'にっこり口',
      type: 'mouth',
      parentId: 'boo_head',
      pivot: { x: -70, y: 18 },
      zIndex: 8.4,
      fill: 'none',
      stroke: PIG_OUTLINE,
      strokeWidth: 2.4,
      closed: false,
      points: [
        { x: -76, y: 16, type: 'corner', inHandle: { x: -76, y: 16 }, outHandle: { x: -72, y: 22 } },
        { x: -66, y: 19, type: 'smooth', inHandle: { x: -70, y: 22 }, outHandle: { x: -62, y: 18 } }
      ]
    })
  ];

  const animations = generateDefaultRigAnimations(parts, 'special');

  return createCharacter({
    id: 'boo_chan',
    name: 'ぶーちゃん (豚顔イルカ・スペシャル)',
    species: 'special',
    facing: -1,
    parts,
    animations
  });
}

// ── 全プリセット辞書 ＆ 一括取得ヘルパー ──
export const BASE_PRESETS = {
  hirame: getHiramePreset,
  karei: getKareiPreset,
  boo_chan: getBoochanPreset,
  octopus: getOctopusPreset,
  squid: getSquidPreset,
  stingray: getStingrayPreset,
  aji_open: getAjiOpenPreset,
  shitabirame: getUshinositaPreset,
  human: getHumanPreset,
  quadruped: getQuadrupedPreset,
  biped: getBipedPreset,
  insect: getInsectPreset,
  spider: getSpiderPreset,
  bird: getBirdPreset,
  kanji_hirame: getKanjiHiramePreset,
  kanji_karei_1: getKanjiKarei1Preset,
  kanji_karei_2: getKanjiKarei2Preset
};

export function getAllBasePresets() {
  return [
    getHiramePreset(),
    getKareiPreset(),
    getBoochanPreset(),
    getOctopusPreset(),
    getSquidPreset(),
    getStingrayPreset(),
    getAjiOpenPreset(),
    getUshinositaPreset(),
    getHumanPreset(),
    getQuadrupedPreset(),
    getBipedPreset(),
    getInsectPreset(),
    getSpiderPreset(),
    getBirdPreset(),
    getKanjiHiramePreset(),
    getKanjiKarei1Preset(),
    getKanjiKarei2Preset()
  ];
}


