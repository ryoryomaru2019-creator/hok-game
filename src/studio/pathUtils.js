// Path utilities: Bezier math, curvature pen interpolation, SVG string conversion, hit-tests

/**
 * 点の距離
 */
export function dist(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * 2つのベクトル間の角度（度）
 */
export function angleDeg(from, to) {
  return Math.atan2(to.y - from.y, to.x - from.x) * (180 / Math.PI);
}

/**
 * Catmull-Rom スプラインから 3次ベジェ曲線ハンドルへの変換（曲率ペン用）
 * 与えられた通過点配列から自動的に滑らかなベジェハンドルを計算する
 */
export function computeCurvatureHandles(points, isClosed = true, tension = 0.5) {
  const n = points.length;
  if (n < 2) return;

  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];

    if (p1.type === 'corner') {
      p1.inHandle = { x: p1.x, y: p1.y };
      p1.outHandle = { x: p1.x, y: p1.y };
      continue;
    }

    // Catmull-Rom tangents
    let tx1, ty1, tx2, ty2;

    if (!isClosed && i === 0) {
      tx1 = (p2.x - p1.x) * tension;
      ty1 = (p2.y - p1.y) * tension;
    } else {
      tx1 = (p2.x - p0.x) * (tension * 0.5);
      ty1 = (p2.y - p0.y) * (tension * 0.5);
    }

    if (!isClosed && i === n - 1) {
      tx2 = (p1.x - p0.x) * tension;
      ty2 = (p1.y - p0.y) * tension;
    } else {
      tx2 = (p3.x - p1.x) * (tension * 0.5);
      ty2 = (p3.y - p1.y) * (tension * 0.5);
    }

    p1.outHandle = {
      x: Math.round((p1.x + tx1 / 3) * 10) / 10,
      y: Math.round((p1.y + ty1 / 3) * 10) / 10
    };
    p1.inHandle = {
      x: Math.round((p1.x - tx1 / 3) * 10) / 10,
      y: Math.round((p1.y - ty1 / 3) * 10) / 10
    };
  }
}

/**
 * ポイント配列からSVGの 'd' 属性文字列を生成する
 */
export function pointsToSvgPath(points, isClosed = true) {
  if (!points || points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

  for (let i = 0; i < points.length - 1; i++) {
    const cur = points[i];
    const next = points[i + 1];

    const cp1 = cur.outHandle || cur;
    const cp2 = next.inHandle || next;

    d += ` C ${cp1.x.toFixed(1)} ${cp1.y.toFixed(1)}, ${cp2.x.toFixed(1)} ${cp2.y.toFixed(1)}, ${next.x.toFixed(1)} ${next.y.toFixed(1)}`;
  }

  if (isClosed && points.length > 2) {
    const last = points[points.length - 1];
    const first = points[0];
    const cp1 = last.outHandle || last;
    const cp2 = first.inHandle || first;

    d += ` C ${cp1.x.toFixed(1)} ${cp1.y.toFixed(1)}, ${cp2.x.toFixed(1)} ${cp2.y.toFixed(1)}, ${first.x.toFixed(1)} ${first.y.toFixed(1)} Z`;
  }

  return d;
}

/**
 * 線分上の最近接点
 */
export function closestPointOnSegment(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const abLen2 = abx * abx + aby * aby;
  if (abLen2 === 0) return a;
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLen2));
  return { x: a.x + t * abx, y: a.y + t * aby, t };
}

/**
 * バウンディングボックスの計算
 */
export function computeBounds(points) {
  if (!points || points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const pt of points) {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
    if (pt.inHandle) {
      if (pt.inHandle.x < minX) minX = pt.inHandle.x;
      if (pt.inHandle.x > maxX) maxX = pt.inHandle.x;
      if (pt.inHandle.y < minY) minY = pt.inHandle.y;
      if (pt.inHandle.y > maxY) maxY = pt.inHandle.y;
    }
    if (pt.outHandle) {
      if (pt.outHandle.x < minX) minX = pt.outHandle.x;
      if (pt.outHandle.x > maxX) maxX = pt.outHandle.x;
      if (pt.outHandle.y < minY) minY = pt.outHandle.y;
      if (pt.outHandle.y > maxY) maxY = pt.outHandle.y;
    }
  }
  return {
    minX, minY, maxX, maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2
  };
}

/**
 * ピボットを中心とした水平左右反転
 */
export function flipPointsHorizontally(points, pivotX = 0) {
  if (!points) return;
  for (const pt of points) {
    pt.x = 2 * pivotX - pt.x;
    if (pt.inHandle) pt.inHandle.x = 2 * pivotX - pt.inHandle.x;
    if (pt.outHandle) pt.outHandle.x = 2 * pivotX - pt.outHandle.x;
    // 反転時は in と out の役目が逆転する
    const tmp = pt.inHandle;
    pt.inHandle = pt.outHandle;
    pt.outHandle = tmp;
  }
}

/**
 * ピボットを中心とした垂直上下反転
 */
export function flipPointsVertically(points, pivotY = 0) {
  if (!points) return;
  for (const pt of points) {
    pt.y = 2 * pivotY - pt.y;
    if (pt.inHandle) pt.inHandle.y = 2 * pivotY - pt.inHandle.y;
    if (pt.outHandle) pt.outHandle.y = 2 * pivotY - pt.outHandle.y;
    const tmp = pt.inHandle;
    pt.inHandle = pt.outHandle;
    pt.outHandle = tmp;
  }
}

/**
 * パーツのディープクローン
 */
export function clonePart(part, newId = null, newName = null) {
  const cloned = JSON.parse(JSON.stringify(part));
  cloned.id = newId || `part_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  cloned.name = newName || `${part.name} のコピー`;
  // 少しオフセット
  for (const pt of cloned.points) {
    pt.x += 10;
    pt.y += 10;
    if (pt.inHandle) { pt.inHandle.x += 10; pt.inHandle.y += 10; }
    if (pt.outHandle) { pt.outHandle.x += 10; pt.outHandle.y += 10; }
  }
  if (cloned.pivot) {
    cloned.pivot.x += 10;
    cloned.pivot.y += 10;
  }
  return cloned;
}
