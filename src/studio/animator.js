// Animator engine: Keyframe interpolation, easing equations, hierarchical transform resolver

export const EASING_FUNCTIONS = {
  linear: t => t,
  easeInQuad: t => t * t,
  easeOutQuad: t => t * (2 - t),
  easeInOutQuad: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  bounce: t => {
    if (t < (1 / 2.75)) return 7.5625 * t * t;
    if (t < (2 / 2.75)) return 7.5625 * (t -= (1.5 / 2.75)) * t + 0.75;
    if (t < (2.5 / 2.75)) return 7.5625 * (t -= (2.25 / 2.75)) * t + 0.9375;
    return 7.5625 * (t -= (2.625 / 2.75)) * t + 0.984375;
  }
};

/**
 * 3次ベジェ曲線のイージング計算 (After Effects / CSS cubic-bezier 準拠)
 * @param {Number} t 0〜1の進行時間
 * @param {Number} p1x 第1制御点X (0〜1)
 * @param {Number} p1y 第1制御点Y
 * @param {Number} p2x 第2制御点X (0〜1)
 * @param {Number} p2y 第2制御点Y
 */
export function solveCubicBezier(t, p1x = 0.42, p1y = 0.0, p2x = 0.58, p2y = 1.0) {
  // ニュートン法または二分法で X(u) = t となるパラメータ u を求める
  if (t <= 0) return 0;
  if (t >= 1) return 1;

  let u = t;
  for (let i = 0; i < 8; i++) {
    // 3rd order bezier X(u) = 3*(1-u)^2*u*p1x + 3*(1-u)*u^2*p2x + u^3
    const currentX = 3 * (1 - u) * (1 - u) * u * p1x + 3 * (1 - u) * u * u * p2x + u * u * u;
    const diff = currentX - t;
    if (Math.abs(diff) < 0.001) break;
    // dX/du
    const dX = 3 * (1 - u) * (1 - u) * p1x + 6 * (1 - u) * u * (p2x - p1x) + 3 * u * u * (1 - p2x);
    if (Math.abs(dX) < 1e-6) break;
    u -= diff / dX;
    u = Math.max(0, Math.min(1, u));
  }

  // Y(u) = 3*(1-u)^2*u*p1y + 3*(1-u)*u^2*p2y + u^3
  return 3 * (1 - u) * (1 - u) * u * p1y + 3 * (1 - u) * u * u * p2y + u * u * u;
}

/**
 * 2つの数値の線形補間
 */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * 単一チャンネル（数値または2Dベクトル）のキーフレーム補間ヘルパー
 */
function evaluateChannel(keyframes, timeNorm, getVal, defaultVal, defaultEasing = 'easeInOutQuad') {
  if (!keyframes || keyframes.length === 0) return defaultVal;
  if (keyframes.length === 1) return getVal(keyframes[0]);

  const t = Math.max(0, Math.min(1, timeNorm));
  let prev = keyframes[0];
  let next = keyframes[keyframes.length - 1];

  for (let i = 0; i < keyframes.length - 1; i++) {
    if (t >= keyframes[i].time && t <= keyframes[i + 1].time) {
      prev = keyframes[i];
      next = keyframes[i + 1];
      break;
    }
  }

  const span = next.time - prev.time;
  const localT = span <= 0 ? 0 : (t - prev.time) / span;

  let eased = localT;
  if (prev.bezier && Array.isArray(prev.bezier) && prev.bezier.length === 4) {
    eased = solveCubicBezier(localT, prev.bezier[0], prev.bezier[1], prev.bezier[2], prev.bezier[3]);
  } else {
    const easeFn = EASING_FUNCTIONS[prev.easing || defaultEasing] || EASING_FUNCTIONS.easeInOutQuad;
    eased = easeFn(localT);
  }

  const v1 = getVal(prev);
  const v2 = getVal(next);
  if (typeof v1 === 'number') {
    return lerp(v1, v2, eased);
  }
  return {
    x: lerp(v1.x, v2.x, eased),
    y: lerp(v1.y, v2.y, eased)
  };
}

/**
 * トラック内のキーフレームから指定時間 t (0〜1) でのローカルトランスフォームを算出
 * 位置(pos)、回転(rot)、スケール(scale)、不透明度(opacity)を独立補間
 */
export function evaluateTrack(keyframes, timeNorm, defaultEasing = 'easeInOutQuad') {
  if (!keyframes || keyframes.length === 0) {
    return { tx: 0, ty: 0, rot: 0, sx: 1, sy: 1, op: 1 };
  }

  // プロパティごとのキーフレームに分類 (prop 未定義のレガシーキーは全プロパティ有効)
  const posKfs = keyframes.filter(k => !k.prop || k.prop === 'pos');
  const rotKfs = keyframes.filter(k => !k.prop || k.prop === 'rot');
  const scaleKfs = keyframes.filter(k => !k.prop || k.prop === 'scale');
  const opKfs = keyframes.filter(k => !k.prop || k.prop === 'opacity');

  const pos = evaluateChannel(posKfs, timeNorm, k => ({ x: k.tx ?? 0, y: k.ty ?? 0 }), { x: 0, y: 0 }, defaultEasing);
  const rot = evaluateChannel(rotKfs, timeNorm, k => (k.rot ?? 0), 0, defaultEasing);
  const scale = evaluateChannel(scaleKfs, timeNorm, k => ({ x: k.sx !== undefined ? k.sx : 1, y: k.sy !== undefined ? k.sy : 1 }), { x: 1, y: 1 }, defaultEasing);
  const op = evaluateChannel(opKfs, timeNorm, k => (k.op !== undefined ? k.op : 1), 1, defaultEasing);

  return {
    tx: pos.x,
    ty: pos.y,
    rot: rot,
    sx: scale.x,
    sy: scale.y,
    op: op
  };
}

/**
 * 階層リグ（親子関係）に基づくワールドトランスフォームの解決
 * @param {Array} parts キャラクターのパーツ一覧
 * @param {Object} animationClip 現在のアニメーション
 * @param {Number} timeNorm 0〜1の進行度
 * @returns {Map} partId -> { tx, ty, rot, sx, sy, op, pivot, matrix }
 */
export function resolveRigTransforms(parts, animationClip, timeNorm) {
  const localMap = new Map();
  const worldMap = new Map();

  // 1. 各パーツのローカル評価
  for (const part of parts) {
    const kfs = animationClip?.tracks?.[part.id];
    const local = evaluateTrack(kfs, timeNorm);
    localMap.set(part.id, {
      ...local,
      pivot: part.pivot || { x: 0, y: 0 }
    });
  }

  // 2. 階層の再帰的解決
  const partById = new Map(parts.map(p => [p.id, p]));

  function computeWorld(partId, visited = new Set()) {
    if (worldMap.has(partId)) return worldMap.get(partId);
    if (visited.has(partId)) return localMap.get(partId); // 循環参照防止
    visited.add(partId);

    const part = partById.get(partId);
    const local = localMap.get(partId) || { tx: 0, ty: 0, rot: 0, sx: 1, sy: 1, op: 1, pivot: { x: 0, y: 0 } };

    // トラック設定で「単体で動かす（親連動をカット）」が有効な場合
    const isIsolated = animationClip?.trackOptions?.[partId]?.isolated ?? false;

    if (!part || !part.parentId || !partById.has(part.parentId) || isIsolated) {
      worldMap.set(partId, local);
      return local;
    }

    const parentWorld = computeWorld(part.parentId, visited);

    // 親のワールド回転と位置を継承
    const rad = (parentWorld.rot || 0) * (Math.PI / 180);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    // 親ピボットからの相対位置回転
    const relX = local.tx;
    const relY = local.ty;
    const rotX = relX * cos - relY * sin;
    const rotY = relX * sin + relY * cos;

    const combined = {
      tx: (parentWorld.tx || 0) + rotX,
      ty: (parentWorld.ty || 0) + rotY,
      rot: (parentWorld.rot || 0) + (local.rot || 0),
      sx: (parentWorld.sx || 1) * (local.sx || 1),
      sy: (parentWorld.sy || 1) * (local.sy || 1),
      op: (parentWorld.op !== undefined ? parentWorld.op : 1) * (local.op !== undefined ? local.op : 1),
      pivot: local.pivot
    };

    worldMap.set(partId, combined);
    return combined;
  }

  for (const part of parts) {
    computeWorld(part.id);
  }

  return worldMap;
}
