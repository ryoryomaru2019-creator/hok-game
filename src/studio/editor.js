// Interactive Vector SVG Canvas Editor: Pen tool, Curvature Pen tool, Handle manipulation, Pivot rigging

import { dist, pointsToSvgPath, computeCurvatureHandles, flipPointsHorizontally, flipPointsVertically } from './pathUtils.js';

export const TOOLS = {
  SELECT: 'select',
  DIRECT_SELECT: 'direct_select',
  MARQUEE: 'marquee',
  TRANSFORM: 'transform',
  PEN: 'pen',
  CURVATURE: 'curvature',
  EDIT_POINT: 'edit_point',
  EDIT_HANDLE: 'edit_handle',
  PIVOT: 'pivot',
  PAN: 'pan',
  ZOOM: 'zoom',
  RECT: 'rect',
  ELLIPSE: 'ellipse',
  TRIANGLE: 'triangle',
};

export class StudioEditor {
  constructor(containerEl, options = {}) {
    this.container = containerEl;
    this.character = null;
    this.selectedPartId = null;
    this.selectedPartIds = new Set(); // 複数パーツ選択セット (矩形選択・複数操作用)
    this.selectedPointIndex = -1;
    this.selectedPointIndices = new Set(); // 複数アンカーポイント選択セット (範囲選択・複数移動用)
    this.selectedHandleType = null; // 'in' or 'out'

    // スケール・自由変形モード (Ctrl+T)
    this.isTransformMode = false;
    this.transformInitialSnapshot = null;

    // 矩形選択（マーキーツール）状態
    this.isMarqueeSelecting = false;
    this.marqueeStart = null;
    this.marqueeEl = null;

    // ビューポート状態
    this.zoom = 1.6;
    this.panX = 0;
    this.panY = 0;
    this.isPanning = false;
    this.startPanPos = { x: 0, y: 0 };

    // キーボード修飾キーステート
    this.isSpacePressed = false;
    this.isAltPressed = false;
    this.isCtrlPressed = false;
    this.isShiftPressed = false;
    this.tempPanPreviousTool = null;

    // ツール
    this.currentTool = TOOLS.SELECT;
    this.snapToGrid = false;
    this.gridSize = 10;
    this.isSilhouetteMode = false;
    this.previewFacing = 1;
    this.layerSelectMode = 'all'; // 'all' (全レイヤー対象) or 'active' (指定したレイヤーのみ)

    // アニメーションプレビュー状態
    this.isPlayingAnim = false;
    this.currentAnimTime = 0;
    this.currentMotionId = 'swim';
    this.animTransforms = new Map();

    // 下絵トレース状態
    this.traceCharacter = null;
    this.traceOpacity = 0.35;
    this.traceForeground = false;

    // 履歴 (Undo/Redo)
    this.undoStack = [];
    this.redoStack = [];

    // シェイプ描画状態
    this.isDrawingShape = false;
    this.shapeStartPos = null;
    this.shapePreviewEl = null;

    // セグメント操作用
    this.hoverSegment = null;

    // 矩形選択 (Marquee Select) & 自由変形 (Transform Mode)
    this.selectedPartIds = new Set();
    this.isTransformMode = false;
    this.transformInitialSnapshot = null;
    this.isMarqueeSelecting = false;
    this.marqueeStart = null;
    this.marqueeCurrent = null;
    this.marqueeBoxEl = null;

    // イベント通知
    this.onSelectionChange = options.onSelectionChange || null;
    this.onCharacterChange = options.onCharacterChange || null;
    this.onTimeUpdate = options.onTimeUpdate || null;
    this.onToolChange = options.onToolChange || null;

    this.initDOM();
    this.bindEvents();
  }

  initDOM() {
    this.container.innerHTML = `
      <div class="studio-viewport-container">
        <svg class="studio-svg-canvas" id="studioSvg" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="studioGrid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255, 255, 255, 0.05)" stroke-width="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#studioGrid)" />
          
          <!-- ワールド変形グループ (Pan & Zoom) -->
          <g id="studioWorldGroup">
            <!-- 座標軸 -->
            <line x1="-500" y1="0" x2="500" y2="0" stroke="rgba(56, 189, 248, 0.2)" stroke-width="1" stroke-dasharray="4"/>
            <line x1="0" y1="-500" x2="0" y2="500" stroke="rgba(56, 189, 248, 0.2)" stroke-width="1" stroke-dasharray="4"/>

            <!-- 下絵トレースグループ (最背面・非インタラクティブ) -->
            <g id="studioTraceGroup" pointer-events="none"></g>

            <!-- キャラクターのパーツ描画グループ -->
            <g id="studioPartsGroup"></g>

            <!-- 下絵トレースグループ (最前面・非インタラクティブ) -->
            <g id="studioTraceForegroundGroup" pointer-events="none"></g>

            <!-- 編集用オーバーレイ（ハンドル・アンカー・ピボット） -->
            <g id="studioOverlayGroup"></g>
          </g>
        </svg>
      </div>
    `;

    this.svg = this.container.querySelector('#studioSvg');
    this.worldGroup = this.container.querySelector('#studioWorldGroup');
    this.traceGroup = this.container.querySelector('#studioTraceGroup');
    this.partsGroup = this.container.querySelector('#studioPartsGroup');
    this.traceForegroundGroup = this.container.querySelector('#studioTraceForegroundGroup');
    this.overlayGroup = this.container.querySelector('#studioOverlayGroup');

    this.centerViewport();

    // コンテナが可視化された際に自動でオブジェクト全体を中央フィット配置
    if (window.ResizeObserver && this.container) {
      this.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 50 && entry.contentRect.height > 50) {
            if (!this._initialFitDone) {
              this._initialFitDone = true;
              this.fitViewport();
            }
          }
        }
      });
      this.resizeObserver.observe(this.container);
    }
  }

  centerViewport() {
    const rect = this.svg ? this.svg.getBoundingClientRect() : this.container.getBoundingClientRect();
    let w = rect.width > 0 ? rect.width : (this.container.clientWidth || 0);
    let h = rect.height > 0 ? rect.height : (this.container.clientHeight || 0);
    if (w <= 0 || h <= 0) {
      w = window.innerWidth > 900 ? (window.innerWidth - 650) : 900;
      h = window.innerHeight > 600 ? (window.innerHeight - 200) : 560;
    }
    this.panX = w / 2;
    this.panY = h / 2;
    this.updateViewportTransform();
  }

  updateViewportTransform() {
    if (this.worldGroup) {
      this.worldGroup.setAttribute(
        'transform',
        `translate(${this.panX}, ${this.panY}) scale(${this.zoom * this.previewFacing}, ${this.zoom})`
      );
    }
    if (typeof this.onViewportChange === 'function') {
      this.onViewportChange();
    }
  }

  // ズームイン (Photoshop Ctrl++ / Zツール)
  zoomIn(factor = 1.25, centerClient = null) {
    this.applyZoom(this.zoom * factor, centerClient);
  }

  // ズームアウト (Photoshop Ctrl+- / Alt+Zツール)
  zoomOut(factor = 0.8, centerClient = null) {
    this.applyZoom(this.zoom * factor, centerClient);
  }

  // 100%等倍表示 (Photoshop Ctrl+1)
  resetZoom() {
    const rect = this.svg ? this.svg.getBoundingClientRect() : this.container.getBoundingClientRect();
    const cx = (rect.width || 900) / 2;
    const cy = (rect.height || 560) / 2;
    this.applyZoom(1.0, { clientX: (rect.left || 0) + cx, clientY: (rect.top || 0) + cy });
  }

  // 画面全体にフィット (Photoshop Ctrl+0) - オブジェクト全体とキャンバス中心を中央に配置
  fitViewport() {
    const rect = this.svg ? this.svg.getBoundingClientRect() : this.container.getBoundingClientRect();
    let w = rect.width > 0 ? rect.width : (this.container.clientWidth || 0);
    let h = rect.height > 0 ? rect.height : (this.container.clientHeight || 0);
    if (w <= 0 || h <= 0) {
      w = window.innerWidth > 900 ? (window.innerWidth - 650) : 900;
      h = window.innerHeight > 600 ? (window.innerHeight - 200) : 560;
    }

    if (!this.character || !this.character.parts || this.character.parts.length === 0) {
      this.zoom = 1.5;
      this.panX = w / 2;
      this.panY = h / 2;
      this.updateViewportTransform();
      return;
    }

    // 全パーツのバウンディングボックスを計算 (サブパスや装飾も包含)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const part of this.character.parts) {
      if (!part.visible) continue;
      if (part.points && part.points.length > 0) {
        for (const pt of part.points) {
          minX = Math.min(minX, pt.x);
          minY = Math.min(minY, pt.y);
          maxX = Math.max(maxX, pt.x);
          maxY = Math.max(maxY, pt.y);
        }
      }
      if (part.subPaths) {
        for (const sub of part.subPaths) {
          if (sub.cx !== undefined && sub.r !== undefined) {
            minX = Math.min(minX, sub.cx - sub.r);
            maxX = Math.max(maxX, sub.cx + sub.r);
            minY = Math.min(minY, sub.cy - sub.r);
            maxY = Math.max(maxY, sub.cy + sub.r);
          }
        }
      }
    }

    if (minX === Infinity || maxX === -Infinity) {
      minX = -90; maxX = 90; minY = -45; maxY = 45;
    }

    const bboxW = Math.max(40, maxX - minX);
    const bboxH = Math.max(40, maxY - minY);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    const margin = 120;
    const availW = Math.max(100, w - margin);
    const availH = Math.max(100, h - margin);

    const fitZoom = Math.min(availW / bboxW, availH / bboxH, 2.4);
    this.zoom = Math.max(0.4, fitZoom);
    this.panX = (w / 2) - midX * this.zoom * (this.previewFacing || 1);
    this.panY = (h / 2) - midY * this.zoom;

    this.updateViewportTransform();
    this.renderOverlay();
  }

  applyZoom(newZoom, centerClient = null) {
    newZoom = Math.max(0.1, Math.min(10, newZoom));
    if (centerClient) {
      const rect = this.svg.getBoundingClientRect();
      const mouseX = centerClient.clientX - rect.left;
      const mouseY = centerClient.clientY - rect.top;
      this.panX = mouseX - (mouseX - this.panX) * (newZoom / this.zoom);
      this.panY = mouseY - (mouseY - this.panY) * (newZoom / this.zoom);
    } else {
      const rect = this.svg.getBoundingClientRect();
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      this.panX = cx - (cx - this.panX) * (newZoom / this.zoom);
      this.panY = cy - (cy - this.panY) * (newZoom / this.zoom);
    }
    this.zoom = newZoom;
    this.updateViewportTransform();
    this.renderOverlay();
  }

  // 選択アンカーポイントの削除 (Delete / Backspace)
  deleteSelectedPoint() {
    const part = this.getSelectedPart();
    if (!part || part.locked) return;

    if (this.selectedPointIndices && this.selectedPointIndices.size > 0) {
      if (part.points.length - this.selectedPointIndices.size < 2) {
        alert('これ以上ポイントを削除できません（最低2点必要です）');
        return;
      }
      this.pushState();
      const sortedIndices = Array.from(this.selectedPointIndices).sort((a, b) => b - a);
      for (const idx of sortedIndices) {
        if (idx >= 0 && idx < part.points.length) {
          part.points.splice(idx, 1);
        }
      }
      this.selectedPointIndices.clear();
      this.selectedPointIndex = -1;
      if (this.currentTool === TOOLS.CURVATURE) {
        computeCurvatureHandles(part.points, part.closed);
      }
      this.render();
      if (this.onCharacterChange) this.onCharacterChange(this.character);
      if (this.onSelectionChange) this.onSelectionChange(part);
      return;
    }

    if (this.selectedPointIndex < 0 || !part.points[this.selectedPointIndex]) return;

    if (part.points.length <= 2) {
      alert('これ以上ポイントを削除できません（最低2点必要です）');
      return;
    }

    this.pushState();
    part.points.splice(this.selectedPointIndex, 1);
    this.selectedPointIndex = Math.min(this.selectedPointIndex, part.points.length - 1);
    if (this.currentTool === TOOLS.CURVATURE) {
      computeCurvatureHandles(part.points, part.closed);
    }
    this.render();
    if (this.onCharacterChange) this.onCharacterChange(this.character);
    if (this.onSelectionChange) this.onSelectionChange(part);
  }

  // 選択中パーツの削除 (Photoshop Delete / Backspace)
  deleteSelectedParts() {
    const parts = this.getSelectedParts();
    if (parts.length === 0 || !this.character || this.character.parts.length <= 1) return;
    this.pushState();
    const deleteIds = new Set(parts.map(p => p.id));
    this.character.parts = this.character.parts.filter(p => !deleteIds.has(p.id));
    if (this.character.parts.length === 0) {
      this.character.parts.push({
        id: 'part_1',
        name: 'パーツ 1',
        type: 'body',
        points: [],
        zIndex: 10,
        style: { fill: '#38bdf8', stroke: '#0284c7', strokeWidth: 2, opacity: 1 },
        closed: true,
        pivot: { x: 0, y: 0 }
      });
    }
    this.selectedPartIds.clear();
    this.selectedPartId = this.character.parts[0].id;
    this.selectedPartIds.add(this.selectedPartId);
    this.selectedPointIndex = -1;
    if (this.selectedPointIndices) this.selectedPointIndices.clear();
    this.render();
    if (this.onCharacterChange) this.onCharacterChange(this.character);
    if (this.onSelectionChange) this.onSelectionChange(this.getSelectedPart());
  }

  // 選択要素の微小移動 (矢印キー: 1px / Shift+矢印: 10px)
  nudgeSelected(dx, dy) {
    const part = this.getSelectedPart();
    if (!part || part.locked) return;

    this.pushState();
    if (this.selectedPointIndex >= 0 && part.points[this.selectedPointIndex]) {
      const pt = part.points[this.selectedPointIndex];
      pt.x += dx;
      pt.y += dy;
      if (pt.inHandle) { pt.inHandle.x += dx; pt.inHandle.y += dy; }
      if (pt.outHandle) { pt.outHandle.x += dx; pt.outHandle.y += dy; }
      if (this.currentTool === TOOLS.CURVATURE) {
        computeCurvatureHandles(part.points, part.closed);
      }
    } else {
      // パーツ全体をナッジ移動
      for (const pt of part.points) {
        pt.x += dx; pt.y += dy;
        if (pt.inHandle) { pt.inHandle.x += dx; pt.inHandle.y += dy; }
        if (pt.outHandle) { pt.outHandle.x += dx; pt.outHandle.y += dy; }
      }
      if (part.pivot) {
        part.pivot.x += dx;
        part.pivot.y += dy;
      }
    }

    this.render();
    if (this.onCharacterChange) this.onCharacterChange(this.character);
  }

  // 45度スナップ計算 (Shiftキー押下時)
  snapAngle45(originX, originY, targetX, targetY) {
    const dx = targetX - originX;
    const dy = targetY - originY;
    const len = Math.hypot(dx, dy);
    if (len < 1e-4) return { x: targetX, y: targetY };
    let angle = Math.atan2(dy, dx);
    const step = Math.PI / 4; // 45度
    angle = Math.round(angle / step) * step;
    return {
      x: originX + Math.cos(angle) * len,
      y: originY + Math.sin(angle) * len
    };
  }

  screenToWorld(clientX, clientY) {
    const rect = this.svg.getBoundingClientRect();
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;

    let worldX = (screenX - this.panX) / this.zoom;
    let worldY = (screenY - this.panY) / this.zoom;

    if (this.previewFacing === -1) {
      worldX = -worldX;
    }

    if (this.snapToGrid) {
      worldX = Math.round(worldX / this.gridSize) * this.gridSize;
      worldY = Math.round(worldY / this.gridSize) * this.gridSize;
    }

    return { x: worldX, y: worldY };
  }

  setCharacter(char) {
    this.character = char;
    this.selectedPartId = char.parts.length > 0 ? char.parts[0].id : null;
    this.selectedPartIds = new Set(this.selectedPartId ? [this.selectedPartId] : []);
    this.selectedPointIndex = -1;
    if (this.selectedPointIndices) this.selectedPointIndices.clear();
    this.isTransformMode = false;
    this.undoStack = [];
    this.redoStack = [];
    this.render();
    this.fitViewport();
    if (this.onSelectionChange) this.onSelectionChange(this.getSelectedPart());
  }

  getSelectedPart() {
    if (!this.character || !this.selectedPartId) return null;
    return this.character.parts.find(p => p.id === this.selectedPartId) || null;
  }

  // 複数選択パーツリストの取得
  getSelectedParts() {
    if (!this.character) return [];
    if (this.selectedPartIds.size === 0) {
      const single = this.getSelectedPart();
      return single ? [single] : [];
    }
    return this.character.parts.filter(p => this.selectedPartIds.has(p.id) || p.id === this.selectedPartId);
  }

  // パーツの選択切り替え
  selectPart(partId, isMulti = false) {
    if (!isMulti) {
      this.selectedPartIds.clear();
      if (partId) this.selectedPartIds.add(partId);
      this.selectedPartId = partId;
    } else {
      if (this.selectedPartIds.has(partId)) {
        this.selectedPartIds.delete(partId);
        if (this.selectedPartId === partId) {
          this.selectedPartId = this.selectedPartIds.size > 0 ? Array.from(this.selectedPartIds)[0] : null;
        }
      } else {
        this.selectedPartIds.add(partId);
        this.selectedPartId = partId;
      }
    }
    this.selectedPointIndex = -1;
    if (this.selectedPointIndices) this.selectedPointIndices.clear();
    this.renderOverlay();
    if (this.onSelectionChange) this.onSelectionChange(this.getSelectedPart());
  }

  // 全て選択 (Ctrl+A)
  selectAll() {
    if (!this.character) return;
    this.selectedPartIds.clear();
    for (const p of this.character.parts) {
      if (p.visible && !p.locked) {
        this.selectedPartIds.add(p.id);
      }
    }
    if (this.selectedPartIds.size > 0) {
      this.selectedPartId = Array.from(this.selectedPartIds)[0];
    }
    this.selectedPointIndex = -1;
    if (this.selectedPointIndices) this.selectedPointIndices.clear();
    this.renderOverlay();
    if (this.onSelectionChange) this.onSelectionChange(this.getSelectedPart());
  }

  // 選択解除 (Ctrl+D)
  deselectAll() {
    this.selectedPartIds.clear();
    this.selectedPartId = null;
    this.selectedPointIndex = -1;
    if (this.selectedPointIndices) this.selectedPointIndices.clear();
    if (this.isTransformMode) this.isTransformMode = false;
    this.renderOverlay();
    if (this.onSelectionChange) this.onSelectionChange(null);
  }

  // 自由変形 / スケールモードのトグル (Ctrl+T)
  toggleTransformMode(forceState = null) {
    if (forceState !== null) {
      this.isTransformMode = forceState;
    } else {
      this.isTransformMode = !this.isTransformMode;
    }
    if (this.isTransformMode) {
      // パーツ未選択の場合は第1パーツを自動選択
      if (this.selectedPartIds.size === 0 && this.selectedPartId) {
        this.selectedPartIds.add(this.selectedPartId);
      } else if (this.selectedPartIds.size === 0 && this.character && this.character.parts.length > 0) {
        this.selectedPartId = this.character.parts[0].id;
        this.selectedPartIds.add(this.selectedPartId);
      }
      this.transformInitialSnapshot = this.snapshotSelectedParts();

      // バウンディングボックスの判定
      const bbox = this.getSelectionBoundingBox();
      if (!bbox) {
        this.isTransformMode = false;
        this.transformInitialSnapshot = null;
      }
    } else {
      this.transformInitialSnapshot = null;
    }

    this.render();
    if (this.onTransformChange) this.onTransformChange(this.isTransformMode);
  }

  // 変形を確定 (Enter)
  commitTransform() {
    if (!this.isTransformMode) return;
    this.isTransformMode = false;
    this.transformInitialSnapshot = null;
    this.render();
    if (this.onTransformChange) this.onTransformChange(false);
  }

  // 変形をキャンセル (Esc)
  cancelTransform() {
    if (!this.isTransformMode) return;
    if (this.transformInitialSnapshot) {
      for (const [partId, snap] of this.transformInitialSnapshot.entries()) {
        const p = this.character?.parts?.find(part => part.id === partId);
        if (!p || !p.points) continue;
        for (let i = 0; i < p.points.length; i++) {
          const pt = p.points[i];
          const sPt = snap.points[i];
          if (!pt || !sPt) continue;
          pt.x = sPt.x;
          pt.y = sPt.y;
          if (sPt.inHandle && pt.inHandle) {
            pt.inHandle.x = sPt.inHandle.x;
            pt.inHandle.y = sPt.inHandle.y;
          }
          if (sPt.outHandle && pt.outHandle) {
            pt.outHandle.x = sPt.outHandle.x;
            pt.outHandle.y = sPt.outHandle.y;
          }
        }
        if (snap.pivot && p.pivot) {
          p.pivot.x = snap.pivot.x;
          p.pivot.y = snap.pivot.y;
        }
      }
    }
    this.isTransformMode = false;
    this.transformInitialSnapshot = null;
    this.render();
    if (this.onTransformChange) this.onTransformChange(false);
  }

  // 選択中パーツ群 または 選択中アンカーポイント群のバウンディングボックス計算 (Photoshop準拠)
  getSelectionBoundingBox() {
    // 1. アンカーポイント複数選択時 (ダイレクト・曲率ペン・矩形選択): 選択中のポイント群のみを対象としたバウンディングボックス
    if (this.selectedPointIndices && this.selectedPointIndices.size >= 1) {
      const part = this.getSelectedPart();
      if (part && part.points && part.points.length > 0) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const idx of this.selectedPointIndices) {
          const pt = part.points[idx];
          if (!pt) continue;
          minX = Math.min(minX, pt.x);
          minY = Math.min(minY, pt.y);
          maxX = Math.max(maxX, pt.x);
          maxY = Math.max(maxY, pt.y);
        }
        if (minX !== Infinity) {
          const w = Math.max(16, maxX - minX);
          const h = Math.max(16, maxY - minY);
          const cx = (minX + maxX) / 2;
          const cy = (minY + maxY) / 2;
          return {
            type: 'points',
            partId: part.id,
            pointIndices: new Set(this.selectedPointIndices),
            minX: cx - w / 2,
            minY: cy - h / 2,
            maxX: cx + w / 2,
            maxY: cy + h / 2,
            width: w,
            height: h,
            cx, cy
          };
        }
      }
    }

    // 2. オブジェクト選択時 (選択ツール・通常時): 選択パーツ全体を対象としたバウンディングボックス
    let parts = this.getSelectedParts();
    if (parts.length === 0 && this.character && this.character.parts.length > 0) {
      if (!this.selectedPartId) {
        this.selectedPartId = this.character.parts[0].id;
      }
      this.selectedPartIds.add(this.selectedPartId);
      parts = this.getSelectedParts();
    }
    if (parts.length === 0) return null;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of parts) {
      if (p.points && p.points.length > 0) {
        for (const pt of p.points) {
          minX = Math.min(minX, pt.x);
          minY = Math.min(minY, pt.y);
          maxX = Math.max(maxX, pt.x);
          maxY = Math.max(maxY, pt.y);
        }
      }
      if (p.subPaths && p.subPaths.length > 0) {
        for (const sp of p.subPaths) {
          if (sp.points) {
            for (const pt of sp.points) {
              minX = Math.min(minX, pt.x);
              minY = Math.min(minY, pt.y);
              maxX = Math.max(maxX, pt.x);
              maxY = Math.max(maxY, pt.y);
            }
          }
        }
      }
    }
    if (minX === Infinity) return null;
    return {
      type: 'objects',
      parts: parts.map(p => p.id),
      minX, minY, maxX, maxY,
      width: Math.max(10, maxX - minX),
      height: Math.max(10, maxY - minY),
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2
    };
  }

  // 変形用の初期座標スナップショット
  snapshotSelectedParts() {
    const map = new Map();
    const bbox = this.getSelectionBoundingBox();

    if (bbox && bbox.type === 'points') {
      const part = this.getSelectedPart();
      if (part && part.points) {
        map.set(part.id, {
          isPointsOnly: true,
          pointIndices: new Set(this.selectedPointIndices),
          points: part.points.map(pt => ({
            x: pt.x, y: pt.y,
            inHandle: pt.inHandle ? { ...pt.inHandle } : null,
            outHandle: pt.outHandle ? { ...pt.outHandle } : null
          })),
          pivot: part.pivot ? { ...part.pivot } : { x: 0, y: 0 }
        });
      }
      return map;
    }

    for (const p of this.getSelectedParts()) {
      map.set(p.id, {
        isPointsOnly: false,
        points: (p.points || []).map(pt => ({
          x: pt.x, y: pt.y,
          inHandle: pt.inHandle ? { ...pt.inHandle } : null,
          outHandle: pt.outHandle ? { ...pt.outHandle } : null
        })),
        pivot: p.pivot ? { ...p.pivot } : { x: 0, y: 0 }
      });
    }
    return map;
  }

  // 複数レイヤー結合 (Ctrl+E: 複数選択時は結合、単一選択時は下のレイヤーと結合)
  mergeSelectedLayers() {
    if (!this.character || this.character.parts.length < 2) return;
    const selected = this.getSelectedParts();
    if (selected.length === 0) return;

    this.pushState();

    if (selected.length >= 2) {
      // 複数レイヤー結合: zIndex最小の最背面レイヤーに他を統合
      selected.sort((a, b) => a.zIndex - b.zIndex);
      const target = selected[0];
      const others = selected.slice(1);

      for (const other of others) {
        if (!target.subPaths) target.subPaths = [];
        if (other.points && other.points.length > 0) {
          target.subPaths.push({
            type: 'polygon',
            fill: other.style?.fill || 'none',
            stroke: other.style?.stroke || 'none',
            strokeWidth: other.style?.strokeWidth || 1,
            points: other.points.map(p => ({ x: p.x, y: p.y }))
          });
        }
        if (other.subPaths) {
          target.subPaths.push(...other.subPaths);
        }
        const idx = this.character.parts.findIndex(p => p.id === other.id);
        if (idx !== -1) this.character.parts.splice(idx, 1);
      }

      target.name = `${target.name} (結合)`;
      this.selectedPartIds = new Set([target.id]);
      this.selectedPartId = target.id;
    } else {
      // 単一選択時: Photoshop準拠の「下のレイヤーと結合 (Merge Down)」
      const sorted = [...this.character.parts].sort((a, b) => b.zIndex - a.zIndex);
      const currIdx = sorted.findIndex(p => p.id === selected[0].id);
      if (currIdx === -1 || currIdx >= sorted.length - 1) {
        alert('直下に結合できるレイヤーがありません');
        return;
      }
      const above = sorted[currIdx];
      const below = sorted[currIdx + 1];

      if (!below.subPaths) below.subPaths = [];
      if (above.points && above.points.length > 0) {
        below.subPaths.push({
          type: 'polygon',
          fill: above.style?.fill || 'none',
          stroke: above.style?.stroke || 'none',
          strokeWidth: above.style?.strokeWidth || 1,
          points: above.points.map(p => ({ x: p.x, y: p.y }))
        });
      }
      if (above.subPaths) {
        below.subPaths.push(...above.subPaths);
      }
      const removeIdx = this.character.parts.findIndex(p => p.id === above.id);
      if (removeIdx !== -1) this.character.parts.splice(removeIdx, 1);

      below.name = `${below.name} + ${above.name}`;
      this.selectedPartIds = new Set([below.id]);
      this.selectedPartId = below.id;
    }

    this.render();
    if (this.onCharacterChange) this.onCharacterChange(this.character);
    if (this.onSelectionChange) this.onSelectionChange(this.getSelectedPart());
  }

  // 選択パーツの複製 (Ctrl+J)
  duplicateSelectedParts() {
    const parts = this.getSelectedParts();
    if (parts.length === 0) return;

    this.pushState();
    const newSelectedIds = new Set();
    for (const p of parts) {
      const cloned = JSON.parse(JSON.stringify(p));
      cloned.id = `part_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
      cloned.name = `${p.name} (コピー)`;
      cloned.zIndex = (p.zIndex || 0) + 0.1;
      // 10px オフセット
      for (const pt of cloned.points) {
        pt.x += 10; pt.y += 10;
        if (pt.inHandle) { pt.inHandle.x += 10; pt.inHandle.y += 10; }
        if (pt.outHandle) { pt.outHandle.x += 10; pt.outHandle.y += 10; }
      }
      if (cloned.pivot) {
        cloned.pivot.x += 10; cloned.pivot.y += 10;
      }
      this.character.parts.push(cloned);
      newSelectedIds.add(cloned.id);
    }
    this.selectedPartIds = newSelectedIds;
    this.selectedPartId = Array.from(newSelectedIds)[0];
    this.render();
    if (this.onCharacterChange) this.onCharacterChange(this.character);
    if (this.onSelectionChange) this.onSelectionChange(this.getSelectedPart());
  }

  // レイヤーのグループ化 (Ctrl+G)
  groupSelectedParts() {
    const parts = this.getSelectedParts();
    if (parts.length === 0) return;

    this.pushState();
    const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const groupPart = {
      id: groupId,
      name: '新規グループ',
      type: 'decoration',
      parentId: null,
      locked: false,
      visible: true,
      zIndex: Math.max(...parts.map(p => p.zIndex || 0)) + 0.1,
      points: [],
      style: { fill: 'none', stroke: 'none', strokeWidth: 0, opacity: 1 },
      pivot: { x: 0, y: 0 }
    };
    this.character.parts.push(groupPart);
    for (const p of parts) {
      p.parentId = groupId;
    }
    this.selectedPartIds = new Set([groupId]);
    this.selectedPartId = groupId;
    this.render();
    if (this.onCharacterChange) this.onCharacterChange(this.character);
    if (this.onSelectionChange) this.onSelectionChange(this.getSelectedPart());
  }

  // レイヤーのグループ解除 (Ctrl+Shift+G)
  ungroupSelectedParts() {
    const parts = this.getSelectedParts();
    if (parts.length === 0) return;

    this.pushState();
    for (const p of parts) {
      if (p.points.length === 0) {
        // グループ自身の場合: 子パーツの親をnullにしてグループを削除
        for (const child of this.character.parts) {
          if (child.parentId === p.id) child.parentId = null;
        }
        const idx = this.character.parts.findIndex(item => item.id === p.id);
        if (idx !== -1) this.character.parts.splice(idx, 1);
      } else {
        // 通常パーツの場合: 親設定を解除
        p.parentId = null;
      }
    }
    this.render();
    if (this.onCharacterChange) this.onCharacterChange(this.character);
    if (this.onSelectionChange) this.onSelectionChange(this.getSelectedPart());
  }

  setTool(tool) {
    if (tool === TOOLS.TRANSFORM) {
      if (!this.isTransformMode) {
        this.toggleTransformMode(true);
      }
      return;
    }
    if (this.isTransformMode && tool !== TOOLS.TRANSFORM) {
      this.commitTransform();
    }
    this.currentTool = tool;
    // SVG要素に tool-XX クラスを切り替えて CSS カーソルを適用
    const allTools = Object.values(TOOLS);
    allTools.forEach(t => this.svg.classList.remove(`tool-${t}`));
    this.svg.classList.add(`tool-${tool}`);
    this.renderOverlay();
    if (this.onToolChange) this.onToolChange(tool);
  }

  setFacing(facing) {
    this.previewFacing = facing;
    this.updateViewportTransform();
  }

  setSilhouetteMode(enabled) {
    this.isSilhouetteMode = enabled;
    this.render();
  }

  setLayerSelectMode(mode) {
    this.layerSelectMode = mode; // 'all' or 'active'
    this.renderOverlay();
  }

  pushState() {
    if (!this.character) return;
    this.undoStack.push(JSON.stringify(this.character));
    if (this.undoStack.length > 30) this.undoStack.shift();
    this.redoStack = [];
  }

  undo() {
    if (this.undoStack.length === 0) return;
    this.redoStack.push(JSON.stringify(this.character));
    const prev = JSON.parse(this.undoStack.pop());
    this.character = prev;
    this.render();
    if (this.onCharacterChange) this.onCharacterChange(this.character);
  }

  redo() {
    if (this.redoStack.length === 0) return;
    this.undoStack.push(JSON.stringify(this.character));
    const next = JSON.parse(this.redoStack.pop());
    this.character = next;
    this.render();
    if (this.onCharacterChange) this.onCharacterChange(this.character);
  }

  setTraceCharacter(character, opacity = 0.35) {
    this.traceCharacter = character;
    this.traceOpacity = opacity;
    this.render();
  }

  setTraceForeground(enabled) {
    this.traceForeground = !!enabled;
    this.renderTrace();
  }

  setTraceOpacity(opacity) {
    this.traceOpacity = opacity;
    if (this.traceGroup) {
      this.traceGroup.setAttribute('opacity', this.traceOpacity.toString());
    }
    if (this.traceForegroundGroup) {
      this.traceForegroundGroup.setAttribute('opacity', this.traceOpacity.toString());
    }
  }

  // ========================================================
  // レンダリング
  // ========================================================
  render() {
    this.renderTrace();
    this.renderParts();
    this.renderOverlay();
  }

  renderTrace() {
    if (!this.traceGroup) return;
    this.traceGroup.innerHTML = '';
    if (this.traceForegroundGroup) {
      this.traceForegroundGroup.innerHTML = '';
    }
    if (!this.traceCharacter || !this.traceCharacter.parts) return;

    this.traceGroup.setAttribute('opacity', this.traceOpacity.toString());
    if (this.traceForegroundGroup) {
      this.traceForegroundGroup.setAttribute('opacity', this.traceOpacity.toString());
    }

    const sorted = [...this.traceCharacter.parts].sort((a, b) => a.zIndex - b.zIndex);
    for (const part of sorted) {
      if (!part.visible) continue;
      if (part.type === 'text' || part.text) {
        const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.textContent = part.text || part.textLabel || '';
        textEl.setAttribute('x', '0');
        textEl.setAttribute('y', '0');
        textEl.setAttribute('text-anchor', 'middle');
        textEl.setAttribute('dominant-baseline', 'central');
        textEl.setAttribute('font-size', (part.fontSize || part.style?.fontSize || 80).toString());
        textEl.setAttribute('font-family', part.fontFamily || part.style?.fontFamily || '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif');
        textEl.setAttribute('font-weight', 'bold');
        textEl.setAttribute('fill', 'rgba(148, 163, 184, 0.4)');
        textEl.setAttribute('stroke', '#94a3b8');
        textEl.setAttribute('stroke-width', '1');
        textEl.setAttribute('stroke-dasharray', '4 3');
        this.traceGroup.appendChild(textEl);
        if (this.traceForeground && this.traceForegroundGroup) {
          this.traceForegroundGroup.appendChild(textEl.cloneNode(true));
        }
        continue;
      }
      if (!part.points || part.points.length < 2) continue;

      const d = pointsToSvgPath(part.points, part.closed);
      const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      pathEl.setAttribute('d', d);
      pathEl.setAttribute('fill', part.style.fill || 'rgba(148, 163, 184, 0.4)');
      pathEl.setAttribute('stroke', part.style.stroke || '#94a3b8');
      pathEl.setAttribute('stroke-width', (part.style.strokeWidth || 1.5).toString());
      pathEl.setAttribute('stroke-dasharray', '4 3'); // 下絵トレース用の破線
      this.traceGroup.appendChild(pathEl);
      if (this.traceForeground && this.traceForegroundGroup) {
        this.traceForegroundGroup.appendChild(pathEl.cloneNode(true));
      }

      if (part.subPaths) {
        for (const sub of part.subPaths) {
          if (sub.type === 'circle') {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', sub.cx);
            circle.setAttribute('cy', sub.cy);
            circle.setAttribute('r', sub.r);
            circle.setAttribute('fill', sub.fill);
            circle.setAttribute('stroke', sub.stroke || '#94a3b8');
            circle.setAttribute('stroke-width', (sub.strokeWidth || 1).toString());
            circle.setAttribute('stroke-dasharray', '2 2');
            this.traceGroup.appendChild(circle);
            if (this.traceForeground && this.traceForegroundGroup) {
              this.traceForegroundGroup.appendChild(circle.cloneNode(true));
            }
          } else if (sub.type === 'polygon' && sub.points) {
            const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            const ptStr = sub.points.map(p => `${p.x},${p.y}`).join(' ');
            poly.setAttribute('points', ptStr);
            poly.setAttribute('fill', sub.fill);
            this.traceGroup.appendChild(poly);
            if (this.traceForeground && this.traceForegroundGroup) {
              this.traceForegroundGroup.appendChild(poly.cloneNode(true));
            }
          }
        }
      }
    }
  }

  renderParts() {
    if (!this.partsGroup || !this.character) return;
    this.partsGroup.innerHTML = '';

    // zIndex 昇順でソートして描画
    const sorted = [...this.character.parts].sort((a, b) => a.zIndex - b.zIndex);

    for (const part of sorted) {
      if (!part.visible) continue;

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('id', `svg_part_${part.id}`);
      g.dataset.partId = part.id;

      // アニメーショントランスフォーム適用
      const transform = this.animTransforms.get(part.id);
      if (transform) {
        const piv = part.pivot || { x: 0, y: 0 };
        g.setAttribute(
          'transform',
          `translate(${transform.tx || 0}, ${transform.ty || 0}) translate(${piv.x}, ${piv.y}) rotate(${transform.rot || 0}) scale(${transform.sx || 1}, ${transform.sy || 1}) translate(${-piv.x}, ${-piv.y})`
        );
        if (transform.op !== undefined) {
          g.setAttribute('opacity', transform.op);
        }
      }

      if (part.type === 'text' || part.text) {
        const textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.textContent = part.text || part.textLabel || '';
        textEl.setAttribute('x', '0');
        textEl.setAttribute('y', '0');
        textEl.setAttribute('text-anchor', 'middle');
        textEl.setAttribute('dominant-baseline', 'central');
        textEl.setAttribute('font-size', (part.fontSize || part.style?.fontSize || 80).toString());
        textEl.setAttribute('font-family', part.fontFamily || part.style?.fontFamily || '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif');
        textEl.setAttribute('font-weight', 'bold');

        if (this.isSilhouetteMode) {
          const fill = part.style?.fill || '#ffffff';
          const hasFill = fill !== 'none' && fill !== 'transparent' && fill !== '';
          if (!hasFill) {
            textEl.setAttribute('fill', 'none');
            textEl.setAttribute('stroke', 'none');
            textEl.setAttribute('stroke-width', '0');
          } else {
            textEl.setAttribute('fill', '#0f172a');
            textEl.setAttribute('stroke', 'rgba(56, 189, 248, 0.3)');
            textEl.setAttribute('stroke-width', '1.5');
          }
        } else {
          textEl.setAttribute('fill', part.style?.fill || '#ffffff');
          const stroke = part.style?.stroke;
          const strokeWidth = part.style?.strokeWidth || 0;
          if (stroke && stroke !== 'none' && strokeWidth > 0) {
            textEl.setAttribute('stroke', stroke);
            textEl.setAttribute('stroke-width', (strokeWidth * 2).toString());
            textEl.setAttribute('paint-order', 'stroke fill');
          } else {
            textEl.setAttribute('stroke', 'none');
          }
        }
        textEl.style.cursor = 'pointer';
        g.appendChild(textEl);
      } else {
        // メインパス
        const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const d = pointsToSvgPath(part.points, part.closed);
        pathEl.setAttribute('d', d);

        if (this.isSilhouetteMode) {
          // 「塗り」が「なし」の場合はシルエットを透明に、「あり」のときは黒藍影でしっかり表示
          const fill = part.style?.fill || 'none';
          const hasFill = fill !== 'none' && fill !== 'transparent' && fill !== '';
          if (!hasFill) {
            pathEl.setAttribute('fill', 'none');
            pathEl.setAttribute('stroke', 'none');
            pathEl.setAttribute('stroke-width', '0');
          } else {
            pathEl.setAttribute('fill', '#0f172a');
            pathEl.setAttribute('stroke', 'rgba(56, 189, 248, 0.3)');
            pathEl.setAttribute('stroke-width', '1.5');
          }
        } else {
          const fill = part.style.fill || 'none';
          const stroke = part.style.stroke || 'none';
          const strokeWidth = stroke !== 'none' ? (part.style.strokeWidth ?? 0) : 0;
          const strokePos = part.style.strokePosition || 'center';

          pathEl.setAttribute('fill', fill);
          pathEl.setAttribute('stroke', stroke);
          pathEl.setAttribute('opacity', part.style.opacity ?? 1);

          if (stroke !== 'none' && strokeWidth > 0) {
            if (strokePos === 'inside') {
              pathEl.setAttribute('stroke-width', (strokeWidth * 2).toString());
              pathEl.style.clipPath = `path('${d}')`;
              pathEl.removeAttribute('paint-order');
            } else if (strokePos === 'outside') {
              pathEl.setAttribute('stroke-width', (strokeWidth * 2).toString());
              pathEl.setAttribute('paint-order', 'stroke fill');
              pathEl.style.clipPath = '';
            } else {
              pathEl.setAttribute('stroke-width', strokeWidth.toString());
              pathEl.removeAttribute('paint-order');
              pathEl.style.clipPath = '';
            }
          } else {
            pathEl.setAttribute('stroke', 'none');
            pathEl.setAttribute('stroke-width', '0');
            pathEl.style.clipPath = '';
          }
        }
        pathEl.style.cursor = 'pointer';
        g.appendChild(pathEl);
      }

      // サブパス（歯、斑点、目玉などの付帯グラフィクス）
      if (part.subPaths) {
        for (const sub of part.subPaths) {
          const hasSubFill = sub.fill && sub.fill !== 'none' && sub.fill !== 'transparent';
          if (this.isSilhouetteMode && !hasSubFill) {
            continue;
          }
          const fillVal = this.isSilhouetteMode ? '#0f172a' : sub.fill;
          if (sub.type === 'circle') {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', sub.cx);
            circle.setAttribute('cy', sub.cy);
            circle.setAttribute('r', sub.r);
            circle.setAttribute('fill', fillVal);
            if (!this.isSilhouetteMode) {
              if (sub.stroke) circle.setAttribute('stroke', sub.stroke);
              if (sub.strokeWidth) circle.setAttribute('stroke-width', sub.strokeWidth);
            }
            g.appendChild(circle);
          } else if (sub.type === 'polygon' && sub.points) {
            const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            const ptStr = sub.points.map(p => `${p.x},${p.y}`).join(' ');
            poly.setAttribute('points', ptStr);
            poly.setAttribute('fill', fillVal);
            g.appendChild(poly);
          }
        }
      }

      this.partsGroup.appendChild(g);
    }
  }

  // 自由変形・バウンディングボックス描画 (Photoshop風: 8方向ハンドル＋中心点＋角外側回転ゾーン)
  renderTransformUI(overlay, invZoom) {
    const bbox = this.getSelectionBoundingBox();
    if (!bbox) return;

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'transform-bounding-box-group');

    // 0. ポイント変形時 (ダイレクト・曲率ペン・矩形選択) はアンカーポイント本体も明示
    if (bbox.type === 'points') {
      const part = this.getSelectedPart();
      if (part && part.points) {
        for (let i = 0; i < part.points.length; i++) {
          const pt = part.points[i];
          const isSelected = bbox.pointIndices && bbox.pointIndices.has(i);
          const r = (isSelected ? 5 : 3.5) * invZoom;
          const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          circle.setAttribute('cx', pt.x);
          circle.setAttribute('cy', pt.y);
          circle.setAttribute('r', r);
          circle.setAttribute('fill', isSelected ? '#38bdf8' : 'rgba(255,255,255,0.4)');
          circle.setAttribute('stroke', '#0f172a');
          circle.setAttribute('stroke-width', (1.2 * invZoom).toFixed(2));
          circle.setAttribute('pointer-events', 'none');
          g.appendChild(circle);
        }
      }
    }

    // 1. バウンディングボックス外枠
    const box = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    box.setAttribute('x', bbox.minX);
    box.setAttribute('y', bbox.minY);
    box.setAttribute('width', bbox.width);
    box.setAttribute('height', bbox.height);
    box.setAttribute('fill', 'rgba(56, 189, 248, 0.08)');
    box.setAttribute('stroke', '#0284c7');
    box.setAttribute('stroke-width', (1.8 * invZoom).toFixed(2));
    box.setAttribute('stroke-dasharray', `${5 * invZoom},${3.5 * invZoom}`);
    box.setAttribute('cursor', 'move');
    box.setAttribute('data-transform-box', 'true');
    g.appendChild(box);

    // 2. 中心点マーク (ピボット / Center Pivot)
    const centerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    centerCircle.setAttribute('cx', bbox.cx);
    centerCircle.setAttribute('cy', bbox.cy);
    centerCircle.setAttribute('r', (4.5 * invZoom).toFixed(2));
    centerCircle.setAttribute('fill', '#ffffff');
    centerCircle.setAttribute('stroke', '#0284c7');
    centerCircle.setAttribute('stroke-width', (1.6 * invZoom).toFixed(2));
    centerCircle.setAttribute('pointer-events', 'none');
    g.appendChild(centerCircle);

    const crossArm = 6.5 * invZoom;
    const centerCross1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    centerCross1.setAttribute('x1', bbox.cx - crossArm);
    centerCross1.setAttribute('y1', bbox.cy);
    centerCross1.setAttribute('x2', bbox.cx + crossArm);
    centerCross1.setAttribute('y2', bbox.cy);
    centerCross1.setAttribute('stroke', '#0284c7');
    centerCross1.setAttribute('stroke-width', (1.2 * invZoom).toFixed(2));
    centerCross1.setAttribute('pointer-events', 'none');
    g.appendChild(centerCross1);

    const centerCross2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    centerCross2.setAttribute('x1', bbox.cx);
    centerCross2.setAttribute('y1', bbox.cy - crossArm);
    centerCross2.setAttribute('x2', bbox.cx);
    centerCross2.setAttribute('y2', bbox.cy + crossArm);
    centerCross2.setAttribute('stroke', '#0284c7');
    centerCross2.setAttribute('stroke-width', (1.2 * invZoom).toFixed(2));
    centerCross2.setAttribute('pointer-events', 'none');
    g.appendChild(centerCross2);

    // 3. 8方向ハンドル設定 (nw, n, ne, e, se, s, sw, w)
    const handles = [
      { id: 'nw', x: bbox.minX, y: bbox.minY, cursor: 'nwse-resize' },
      { id: 'n',  x: bbox.cx,   y: bbox.minY, cursor: 'ns-resize' },
      { id: 'ne', x: bbox.maxX, y: bbox.minY, cursor: 'nesw-resize' },
      { id: 'e',  x: bbox.maxX, y: bbox.cy,   cursor: 'ew-resize' },
      { id: 'se', x: bbox.maxX, y: bbox.maxY, cursor: 'nwse-resize' },
      { id: 's',  x: bbox.cx,   y: bbox.maxY, cursor: 'ns-resize' },
      { id: 'sw', x: bbox.minX, y: bbox.maxY, cursor: 'nesw-resize' },
      { id: 'w',  x: bbox.minX, y: bbox.cy,   cursor: 'ew-resize' }
    ];

    const hSize = 8.5 * invZoom;

    // 4. 四隅の回転ゾーン (角ハンドルのやや外側)
    // ユーザー要望:「バウンディングボックスやや外側にカーソルを合わせるとオブジェクトの回転が行えます。」
    const rotOffset = 12 * invZoom;
    const rotateOffsets = [
      { id: 'nw', x: bbox.minX - rotOffset, y: bbox.minY - rotOffset },
      { id: 'ne', x: bbox.maxX + rotOffset, y: bbox.minY - rotOffset },
      { id: 'se', x: bbox.maxX + rotOffset, y: bbox.maxY + rotOffset },
      { id: 'sw', x: bbox.minX - rotOffset, y: bbox.maxY + rotOffset }
    ];

    for (const rz of rotateOffsets) {
      const rotHit = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      rotHit.setAttribute('cx', rz.x);
      rotHit.setAttribute('cy', rz.y);
      rotHit.setAttribute('r', (16 * invZoom).toFixed(2));
      rotHit.setAttribute('fill', 'transparent');
      rotHit.setAttribute('cursor', 'crosshair');
      rotHit.setAttribute('data-transform-rotate', rz.id);
      g.appendChild(rotHit);
    }

    // 8方向の変形ハンドルを描画
    for (const h of handles) {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', h.x - hSize / 2);
      rect.setAttribute('y', h.y - hSize / 2);
      rect.setAttribute('width', hSize);
      rect.setAttribute('height', hSize);
      rect.setAttribute('fill', '#ffffff');
      rect.setAttribute('stroke', '#0284c7');
      rect.setAttribute('stroke-width', (1.6 * invZoom).toFixed(2));
      rect.setAttribute('cursor', h.cursor);
      rect.setAttribute('data-transform-handle', h.id);
      g.appendChild(rect);
    }

    overlay.appendChild(g);
  }

  renderOverlay() {
    if (!this.overlayGroup) return;
    this.overlayGroup.innerHTML = '';

    // アニメーション再生中はハンドルなどの編集UIを非表示にしてクリーンにプレビュー
    if (this.isPlayingAnim) return;

    const overlay = this.overlayGroup;
    const invZoom = 1 / Math.max(0.1, this.zoom);

    // (A) 自由変形 / スケールモード (Ctrl+T): 8方向ハンドル付きバウンディングボックスを描画
    if (this.isTransformMode) {
      this.renderTransformUI(overlay, invZoom);
      return;
    }

    // (B) 複数パーツ選択時: 選択されている全パーツの外枠を破線ハイライト
    const selectedParts = this.getSelectedParts();
    if (selectedParts.length > 1) {
      for (const p of selectedParts) {
        if (!p.points || p.points.length < 2) continue;
        const d = pointsToSvgPath(p.points, p.closed);
        const outline = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        outline.setAttribute('d', d);
        outline.setAttribute('fill', 'none');
        outline.setAttribute('stroke', '#38bdf8');
        outline.setAttribute('stroke-width', (1.5 * invZoom).toFixed(2));
        outline.setAttribute('stroke-dasharray', `${4 * invZoom},${3 * invZoom}`);
        outline.setAttribute('pointer-events', 'none');
        overlay.appendChild(outline);
      }
    }

    const part = this.getSelectedPart();
    if (!part) return;

    if (part.locked) {
      const piv = part.pivot || { x: 0, y: 0 };
      const lockText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      lockText.setAttribute('x', piv.x);
      lockText.setAttribute('y', piv.y - 12 * invZoom);
      lockText.setAttribute('text-anchor', 'middle');
      lockText.setAttribute('font-size', `${Math.max(12, 14 * invZoom)}px`);
      lockText.setAttribute('fill', '#f59e0b');
      lockText.setAttribute('font-weight', 'bold');
      lockText.textContent = '🔒 ロック中';
      overlay.appendChild(lockText);
      return;
    }

    // 1. 選択ツール (TOOLS.SELECT) 時: オブジェクトのみを対象とし、パスのポイントやハンドルは表示しない
    if (this.currentTool === TOOLS.SELECT) {
      if (part.points && part.points.length >= 2) {
        const d = pointsToSvgPath(part.points, part.closed);
        const outline = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        outline.setAttribute('d', d);
        outline.setAttribute('fill', 'none');
        outline.setAttribute('stroke', '#38bdf8');
        outline.setAttribute('stroke-width', (1.5 * invZoom).toFixed(2));
        outline.setAttribute('stroke-dasharray', `${4 * invZoom},${3 * invZoom}`);
        outline.setAttribute('pointer-events', 'none');
        overlay.appendChild(outline);
      }
      return;
    }

    // 2. 各アンカーポイントとベジェハンドルの描画
    if (part.points && part.points.length > 0) {
      for (let i = 0; i < part.points.length; i++) {
        const pt = part.points[i];
        const isSelected = (this.selectedPointIndices && this.selectedPointIndices.has(i)) || i === this.selectedPointIndex;

        // 【Photoshop / Illustrator 準拠のスマートハンドル表示】
        // 選択中のアンカーポイント、または曲率/ハンドル編集ツール時にハンドルアームを表示
        const shouldShowHandles = isSelected || this.currentTool === TOOLS.EDIT_HANDLE || this.currentTool === TOOLS.CURVATURE;

        if (shouldShowHandles) {
          if (pt.inHandle && (Math.abs(pt.inHandle.x - pt.x) > 0.5 || Math.abs(pt.inHandle.y - pt.y) > 0.5)) {
            this.createHandleUI(overlay, pt, pt.inHandle, i, 'in', invZoom);
          }
          if (pt.outHandle && (Math.abs(pt.outHandle.x - pt.x) > 0.5 || Math.abs(pt.outHandle.y - pt.y) > 0.5)) {
            this.createHandleUI(overlay, pt, pt.outHandle, i, 'out', invZoom);
          }
        }

        // アンカーポイント本体（四角=コーナー、丸=スムーズ）
        // ズームしても画面上で常にシャープな4px〜5pxに保つ
        if (pt.type === 'corner') {
          const size = 6.5 * invZoom;
          const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          rect.setAttribute('x', pt.x - size / 2);
          rect.setAttribute('y', pt.y - size / 2);
          rect.setAttribute('width', size);
          rect.setAttribute('height', size);
          rect.setAttribute('fill', isSelected ? '#38bdf8' : '#ffffff');
          rect.setAttribute('stroke', '#0f172a');
          rect.setAttribute('stroke-width', (1.2 * invZoom).toFixed(2));
          rect.style.cursor = 'move';
          rect.dataset.pointIndex = i;
          overlay.appendChild(rect);
        } else {
          const r = 3.6 * invZoom;
          const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          circle.setAttribute('cx', pt.x);
          circle.setAttribute('cy', pt.y);
          circle.setAttribute('r', r);
          circle.setAttribute('fill', isSelected ? '#f59e0b' : '#ffffff');
          circle.setAttribute('stroke', '#0f172a');
          circle.setAttribute('stroke-width', (1.2 * invZoom).toFixed(2));
          circle.style.cursor = 'move';
          circle.dataset.pointIndex = i;
          overlay.appendChild(circle);
        }
      }
    }

    // 2. ピボット（原点 / 回転中心）のクロスヘア可視化
    // ピボットツール選択中、またはユーザーが明示的に原点を設定したい時のみスマート表示
    const shouldShowPivot = (this.currentTool === TOOLS.PIVOT);
    if (shouldShowPivot) {
      const piv = part.pivot || { x: 0, y: 0 };
      const pivotG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      pivotG.setAttribute('id', 'pivotCrosshair');
      pivotG.dataset.action = 'pivot';
      pivotG.style.cursor = 'crosshair';

      // ピボット輪 (ズームによらず画面上で常に半径10px)
      const pCirc = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      pCirc.setAttribute('cx', piv.x);
      pCirc.setAttribute('cy', piv.y);
      pCirc.setAttribute('r', 9 * invZoom);
      pCirc.setAttribute('fill', 'rgba(239, 68, 68, 0.25)');
      pCirc.setAttribute('stroke', '#ef4444');
      pCirc.setAttribute('stroke-width', (1.5 * invZoom).toFixed(2));
      pivotG.appendChild(pCirc);

      // 十字線
      const l1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l1.setAttribute('x1', piv.x - 14 * invZoom); l1.setAttribute('y1', piv.y);
      l1.setAttribute('x2', piv.x + 14 * invZoom); l1.setAttribute('y2', piv.y);
      l1.setAttribute('stroke', '#ef4444'); l1.setAttribute('stroke-width', (1.2 * invZoom).toFixed(2));
      pivotG.appendChild(l1);

      const l2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l2.setAttribute('x1', piv.x); l2.setAttribute('y1', piv.y - 14 * invZoom);
      l2.setAttribute('x2', piv.x); l2.setAttribute('y2', piv.y + 14 * invZoom);
      l2.setAttribute('stroke', '#ef4444'); l2.setAttribute('stroke-width', (1.2 * invZoom).toFixed(2));
      pivotG.appendChild(l2);

      overlay.appendChild(pivotG);
    }
  }

  createHandleUI(overlay, anchor, handle, ptIndex, handleType, invZoom = 1) {
    // ハンドルアーム線
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', anchor.x);
    line.setAttribute('y1', anchor.y);
    line.setAttribute('x2', handle.x);
    line.setAttribute('y2', handle.y);
    line.setAttribute('stroke', 'rgba(56, 189, 248, 0.75)');
    line.setAttribute('stroke-width', (1 * invZoom).toFixed(2));
    overlay.appendChild(line);

    // ハンドル端点丸
    const circ = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circ.setAttribute('cx', handle.x);
    circ.setAttribute('cy', handle.y);
    circ.setAttribute('r', 3 * invZoom);
    circ.setAttribute('fill', '#38bdf8');
    circ.setAttribute('stroke', '#0f172a');
    circ.setAttribute('stroke-width', (1 * invZoom).toFixed(2));
    circ.style.cursor = 'pointer';
    circ.dataset.handlePtIndex = ptIndex;
    circ.dataset.handleType = handleType;
    overlay.appendChild(circ);
  }

  flipSelectedPartH() {
    const part = this.getSelectedPart();
    if (!part) return;
    this.pushState();
    flipPointsHorizontally(part.points, part.pivot ? part.pivot.x : 0);
    if (this.currentTool === TOOLS.CURVATURE) {
      computeCurvatureHandles(part.points, part.closed);
    }
    this.render();
    if (this.onCharacterChange) this.onCharacterChange(this.character);
  }

  flipSelectedPartV() {
    const part = this.getSelectedPart();
    if (!part) return;
    this.pushState();
    flipPointsVertically(part.points, part.pivot ? part.pivot.y : 0);
    if (this.currentTool === TOOLS.CURVATURE) {
      computeCurvatureHandles(part.points, part.closed);
    }
    this.render();
    if (this.onCharacterChange) this.onCharacterChange(this.character);
  }

  // ── 矩形選択 (Marquee Select) ボックス表示 ──
  updateMarquee(start, curr) {
    if (!this.overlayGroup) return;
    if (!this.marqueeBoxEl) {
      this.marqueeBoxEl = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      this.marqueeBoxEl.setAttribute('fill', 'rgba(14, 165, 233, 0.15)');
      this.marqueeBoxEl.setAttribute('stroke', '#0ea5e9');
      this.marqueeBoxEl.setAttribute('stroke-dasharray', '4 3');
      this.marqueeBoxEl.setAttribute('pointer-events', 'none');
      this.overlayGroup.appendChild(this.marqueeBoxEl);
    }
    const invZoom = 1 / Math.max(0.1, this.zoom);
    const x = Math.min(start.x, curr.x);
    const y = Math.min(start.y, curr.y);
    const w = Math.abs(curr.x - start.x);
    const h = Math.abs(curr.y - start.y);
    this.marqueeBoxEl.setAttribute('x', x);
    this.marqueeBoxEl.setAttribute('y', y);
    this.marqueeBoxEl.setAttribute('width', w);
    this.marqueeBoxEl.setAttribute('height', h);
    this.marqueeBoxEl.setAttribute('stroke-width', (1.5 * invZoom).toFixed(2));
    this.marqueeBoxEl.style.display = 'block';
  }

  clearMarquee() {
    if (this.marqueeBoxEl && this.marqueeBoxEl.parentNode) {
      this.marqueeBoxEl.parentNode.removeChild(this.marqueeBoxEl);
      this.marqueeBoxEl = null;
    }
  }

  // ========================================================
  // インタラクション・イベント制御 (Photoshop準拠のパス・キャンバス操作)
  // ========================================================
  bindEvents() {
    let isDragging = false;
    let dragTarget = null; // { type: 'point'|'handle'|'pivot'|'part'|'segment', index, handleType, ... }
    let dragStartPos = { x: 0, y: 0 };
    let initialPtPos = null;

    // ──────────────────────────────────────────────
    // 1. PointerDown: クリック＆ドラッグ開始判定
    // ──────────────────────────────────────────────
    this.svg.addEventListener('pointerdown', (e) => {
      const worldPos = this.screenToWorld(e.clientX, e.clientY);
      const target = e.target;
      const part = this.getSelectedPart();

      // (A) 中クリック or パンツール or スペースキー押下中: キャンバス移動
      if (e.button === 1 || this.currentTool === TOOLS.PAN || e.spaceKey || this.isSpacePressed) {
        this.isPanning = true;
        this.startPanPos = { x: e.clientX, y: e.clientY };
        return;
      }

      // (B) ズームツール: クリックでズームイン、Alt+クリックでズームアウト
      if (this.currentTool === TOOLS.ZOOM) {
        if (e.altKey || this.isAltPressed) {
          this.zoomOut(0.8, { clientX: e.clientX, clientY: e.clientY });
        } else {
          this.zoomIn(1.25, { clientX: e.clientX, clientY: e.clientY });
        }
        return;
      }

      // (A0) 自由変形モード (Ctrl+T / 拡大縮小ツール) での操作
      if (this.isTransformMode) {
        // 回転ゾーンのクリック＆ドラッグ
        if (target.dataset.transformRotate) {
          const bbox = this.getSelectionBoundingBox();
          if (bbox) {
            this.pushState();
            isDragging = true;
            dragTarget = {
              type: 'transform_rotate',
              initialBBox: bbox,
              startAngle: Math.atan2(worldPos.y - bbox.cy, worldPos.x - bbox.cx)
            };
            this.transformInitialSnapshot = this.snapshotSelectedParts();
            dragStartPos = worldPos;
            return;
          }
        }
        if (target.dataset.transformHandle) {
          const handle = target.dataset.transformHandle;
          const bbox = this.getSelectionBoundingBox();
          if (bbox) {
            this.pushState();
            isDragging = true;
            dragTarget = {
              type: 'transform_scale',
              handle: handle,
              initialBBox: bbox
            };
            this.transformInitialSnapshot = this.snapshotSelectedParts();
            dragStartPos = worldPos;
            return;
          }
        }
        // バウンディングボックス内をクリックしてドラッグ移動
        if (target.dataset.transformBox || target.closest('.transform-bounding-box-group')) {
          this.pushState();
          isDragging = true;
          dragTarget = { type: 'transform_move' };
          this.transformInitialSnapshot = this.snapshotSelectedParts();
          dragStartPos = worldPos;
          return;
        }

        // 変形モード中に別のパーツをクリックした場合は、現在の変形を確定してそのパーツを選択＆変形へ切替！
        const clickedPartEl = target.closest('[data-part-id]');
        if (clickedPartEl) {
          const clickedId = clickedPartEl.dataset.partId;
          const targetPart = this.character.parts.find(p => p.id === clickedId);
          if (targetPart && !targetPart.locked) {
            this.commitTransform();
            this.selectPart(clickedId, false);
            this.toggleTransformMode(true);
            return;
          }
        }

        // キャンバスの何もないところをクリックした場合は、変形を確定して全選択解除！
        this.commitTransform();
        this.deselectAll();
        return;
      }

      // (A1) 矩形選択ツール (M)
      if (this.currentTool === TOOLS.MARQUEE) {
        this.isMarqueeSelecting = true;
        this.marqueeStart = { ...worldPos };
        this.marqueeCurrent = { ...worldPos };
        this.updateMarquee(this.marqueeStart, this.marqueeCurrent);
        return;
      }

      // 選択ツール (TOOLS.SELECT) 時はアンカーポイント・ハンドル・セグメント・ピボットの直接操作を一切スキップ（オブジェクト単位の操作のみ）
      if (this.currentTool !== TOOLS.SELECT) {
        // ロック中パーツのポイント/ハンドル/セグメント/ピボット操作は禁止
        if (part && part.locked) {
          if (target.closest('#pivotCrosshair') || target.dataset.handlePtIndex !== undefined || target.dataset.pointIndex !== undefined) {
            return;
          }
        }

        // (C) ピボット操作
        if (target.closest('#pivotCrosshair') || this.currentTool === TOOLS.PIVOT) {
          if (part && part.locked) return;
          isDragging = true;
          dragTarget = { type: 'pivot' };
          this.pushState();
          return;
        }

        // (D) ベジェハンドルのドラッグ (Altキーで折り曲げ/連動復活)
        if (target.dataset.handlePtIndex !== undefined) {
          if (part && part.locked) return;
          const ptIdx = parseInt(target.dataset.handlePtIndex, 10);
          const handleType = target.dataset.handleType;
          const pt = part?.points[ptIdx];

          isDragging = true;
          dragTarget = {
            type: 'handle',
            index: ptIdx,
            handleType: handleType,
            isAlt: e.altKey || this.isAltPressed,
            initialBroken: pt ? !!pt.broken : false
          };
          this.pushState();
          return;
        }

        // (E) アンカーポイントのクリック / ドラッグ / 削除
        if (target.dataset.pointIndex !== undefined) {
          if (part && part.locked) return;
          const ptIdx = parseInt(target.dataset.pointIndex, 10);
          const isShift = e.shiftKey || this.isShiftPressed;

          if (isShift) {
            if (this.selectedPointIndices.has(ptIdx)) {
              this.selectedPointIndices.delete(ptIdx);
              this.selectedPointIndex = this.selectedPointIndices.size > 0 ? Array.from(this.selectedPointIndices)[0] : -1;
            } else {
              this.selectedPointIndices.add(ptIdx);
              this.selectedPointIndex = ptIdx;
            }
          } else {
            if (!this.selectedPointIndices.has(ptIdx)) {
              this.selectedPointIndices.clear();
              this.selectedPointIndices.add(ptIdx);
              this.selectedPointIndex = ptIdx;
            }
          }

          // ペンツール選択時:
          // - Altキーなしクリック → Photoshop仕様: 既存アンカーをクリックで削除！
          // - Altキーありクリック → 直線(corner)と曲線(smooth)の切り替え
          if (this.currentTool === TOOLS.PEN) {
            if (!e.altKey && !this.isAltPressed) {
              this.deleteSelectedPoint();
              return;
            }
          }

          // Altキーまたはダブルクリック: 直線(corner)と曲線(smooth)のトグル
          if (e.altKey || this.isAltPressed || e.detail === 2) {
            if (part && part.points[ptIdx]) {
              this.pushState();
              const pt = part.points[ptIdx];
              pt.type = pt.type === 'corner' ? 'smooth' : 'corner';
              if (pt.type === 'corner') {
                pt.inHandle = { x: pt.x, y: pt.y };
                pt.outHandle = { x: pt.x, y: pt.y };
                pt.broken = false;
              } else {
                computeCurvatureHandles(part.points, part.closed);
              }
              this.render();
              if (this.onCharacterChange) this.onCharacterChange(this.character);
              return;
            }
          }

          // 通常ドラッグ開始 (複数ポイント選択時は選択された全ポイントをドラッグ)
          isDragging = true;
          dragTarget = { type: 'point', index: ptIdx };
          dragStartPos = worldPos;
          if (part && part.points[ptIdx]) {
            initialPtPos = { ...part.points[ptIdx] };
          }
          this.pushState();
          this.renderOverlay();
          return;
        }

        // (F) パスセグメント上のクリック判定
        if (part && !part.locked && part.points && part.points.length >= 2) {
          const seg = this.findSegmentNear(part, worldPos, 12 / this.zoom);
          if (seg) {
            // ペンツール時のみ: パス線上に新しいアンカーポイントを挿入（※曲率ペンでは勝手に追加しない）
            if (this.currentTool === TOOLS.PEN) {
              this.pushState();
              const newPt = {
                x: Math.round(seg.x),
                y: Math.round(seg.y),
                type: 'smooth',
                inHandle: { x: Math.round(seg.x), y: Math.round(seg.y) },
                outHandle: { x: Math.round(seg.x), y: Math.round(seg.y) },
                broken: false
              };
              part.points.splice(seg.segIndex + 1, 0, newPt);
              this.selectedPointIndex = seg.segIndex + 1;
              this.selectedPointIndices.clear();
              this.selectedPointIndices.add(this.selectedPointIndex);
              computeCurvatureHandles(part.points, part.closed);
              this.render();
              if (this.onCharacterChange) this.onCharacterChange(this.character);
              return;
            }

            // ダイレクト選択ツールまたは曲率ペンツール時: セグメントを直接ドラッグ変形！
            if (this.currentTool === TOOLS.DIRECT_SELECT || this.currentTool === TOOLS.CURVATURE) {
              this.pushState();
              isDragging = true;
              dragTarget = {
                type: 'segment',
                segIndex: seg.segIndex,
                startPos: { ...worldPos },
                origP0Out: { ...seg.p0.outHandle },
                origP3In: { ...seg.p3.inHandle }
              };
              return;
            }
          }
        }
      } // end if (this.currentTool !== TOOLS.SELECT)

      // (G) シェイプツール描画開始
      const SHAPE_TOOLS = [TOOLS.RECT, TOOLS.ELLIPSE, TOOLS.TRIANGLE];
      if (SHAPE_TOOLS.includes(this.currentTool)) {
        this.isDrawingShape = true;
        this.shapeStartPos = { ...worldPos };
        this.shapePreviewEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        this.shapePreviewEl.setAttribute('fill', 'rgba(99,102,241,0.15)');
        this.shapePreviewEl.setAttribute('stroke', '#6366f1');
        this.shapePreviewEl.setAttribute('stroke-width', `${1.5 / this.zoom}`);
        this.shapePreviewEl.setAttribute('stroke-dasharray', `${4 / this.zoom},${3 / this.zoom}`);
        this.shapePreviewEl.setAttribute('pointer-events', 'none');
        this.overlayGroup.appendChild(this.shapePreviewEl);
        return;
      }

      // (H) ペンツールによる末尾アンカーポイント追加 (※曲率ペンでは勝手に追加しない)
      if (this.currentTool === TOOLS.PEN) {
        if (part && !part.locked) {
          this.pushState();
          const newPt = {
            x: worldPos.x,
            y: worldPos.y,
            type: 'corner',
            inHandle: { x: worldPos.x, y: worldPos.y },
            outHandle: { x: worldPos.x, y: worldPos.y },
            broken: false
          };

          part.points.push(newPt);
          this.selectedPointIndex = part.points.length - 1;
          this.selectedPointIndices.clear();
          this.selectedPointIndices.add(this.selectedPointIndex);

          isDragging = true;
          dragTarget = { type: 'new_pen_drag', index: this.selectedPointIndex };

          this.render();
          if (this.onCharacterChange) this.onCharacterChange(this.character);
          return;
        }
      }

      // (I) パーツの選択
      const partEl = target.closest('[data-part-id]');
      if (partEl) {
        const partId = partEl.dataset.partId;
        const targetPart = this.character.parts.find(p => p.id === partId);

        // ロック中パーツは選択・移動不可
        if (targetPart && targetPart.locked) {
          return;
        }

        // 「指定したレイヤーのみ」モードの場合、そのレイヤー内（自身またはその子パーツ）以外の選択切替をブロック
        if (this.layerSelectMode === 'active' && !this.isPartInActiveLayer(partId)) {
          return;
        }

        const isShift = e.shiftKey || this.isShiftPressed;

        if (isShift) {
          // Shift+クリック: 複数選択の追加/解除
          this.selectPart(partId, true);
          if (this.selectedPartIds.has(partId)) {
            isDragging = true;
            dragTarget = { type: 'part_multi' };
            dragStartPos = worldPos;
            this.pushState();
          }
          return;
        }

        // 複数パーツ選択済みで、そのうちの1つをクリックした場合は複数ドラッグ
        if (this.selectedPartIds.has(partId) && this.selectedPartIds.size > 1) {
          isDragging = true;
          dragTarget = { type: 'part_multi' };
          dragStartPos = worldPos;
          this.pushState();
          return;
        }

        // 単一選択
        this.selectPart(partId, false);

        if (this.currentTool === TOOLS.SELECT || this.currentTool === TOOLS.DIRECT_SELECT) {
          isDragging = true;
          dragTarget = { type: 'part', id: partId };
          dragStartPos = worldPos;
          this.pushState();
        }
        return;
      }

      // (J) 背景クリック: 矩形選択を開始、または選択解除
      // 「指定レイヤーのみ」モード時、または「ダイレクト選択」「曲率ペン」「矩形選択」「選択ツール」時はドラッグで矩形選択を開始！
      const canMarquee = this.layerSelectMode === 'active' ||
        this.currentTool === TOOLS.SELECT ||
        this.currentTool === TOOLS.MARQUEE ||
        this.currentTool === TOOLS.DIRECT_SELECT ||
        this.currentTool === TOOLS.CURVATURE;

      if (canMarquee) {
        this.isMarqueeSelecting = true;
        this.marqueeStart = { ...worldPos };
        this.marqueeCurrent = { ...worldPos };
        this.updateMarquee(this.marqueeStart, this.marqueeCurrent);
        return;
      }

      this.selectedPointIndex = -1;
      if (this.selectedPointIndices) this.selectedPointIndices.clear();
      this.renderOverlay();
    });

    // ──────────────────────────────────────────────
    // 2. PointerMove: ドラッグ中のリアルタイム変形
    // ──────────────────────────────────────────────
    window.addEventListener('pointermove', (e) => {
      // パンスクロール中
      if (this.isPanning) {
        const dx = e.clientX - this.startPanPos.x;
        const dy = e.clientY - this.startPanPos.y;
        this.panX += dx;
        this.panY += dy;
        this.startPanPos = { x: e.clientX, y: e.clientY };
        this.updateViewportTransform();
        return;
      }

      // 矩形選択中
      if (this.isMarqueeSelecting && this.marqueeStart) {
        this.marqueeCurrent = this.screenToWorld(e.clientX, e.clientY);
        this.updateMarquee(this.marqueeStart, this.marqueeCurrent);
        return;
      }

      // シェイププレビュー更新
      if (this.isDrawingShape && this.shapePreviewEl && this.shapeStartPos) {
        let worldPos = this.screenToWorld(e.clientX, e.clientY);
        // Shiftキーで正方形・真円・正三角形アスペクト比固定 (1:1)
        if (e.shiftKey || this.isShiftPressed) {
          const dx = worldPos.x - this.shapeStartPos.x;
          const dy = worldPos.y - this.shapeStartPos.y;
          const side = Math.max(Math.abs(dx), Math.abs(dy));
          worldPos.x = this.shapeStartPos.x + (dx >= 0 ? side : -side);
          worldPos.y = this.shapeStartPos.y + (dy >= 0 ? side : -side);
        }
        const pts = this.buildShapePoints(this.currentTool, this.shapeStartPos, worldPos);
        this.shapePreviewEl.setAttribute('d', this.shapePointsToPath(pts));
        return;
      }

      if (!isDragging || !dragTarget) return;

      let worldPos = this.screenToWorld(e.clientX, e.clientY);

      // ── (0-rot) 自由変形回転 (Transform Rotate: Shiftで15°刻み) ──
      if (dragTarget.type === 'transform_rotate' && this.transformInitialSnapshot) {
        const bbox = dragTarget.initialBBox;
        const isShift = e.shiftKey || this.isShiftPressed;

        const currentAngle = Math.atan2(worldPos.y - bbox.cy, worldPos.x - bbox.cx);
        let deltaAngle = currentAngle - dragTarget.startAngle;
        let deltaDeg = (deltaAngle * 180) / Math.PI;

        if (isShift) {
          // Shift押下時は15°刻みスナップ
          deltaDeg = Math.round(deltaDeg / 15) * 15;
          deltaAngle = (deltaDeg * Math.PI) / 180;
        }

        const cos = Math.cos(deltaAngle);
        const sin = Math.sin(deltaAngle);

        for (const [partId, snap] of this.transformInitialSnapshot.entries()) {
          const p = this.character.parts.find(part => part.id === partId);
          if (!p || !p.points) continue;
          const targetIndices = snap.isPointsOnly ? snap.pointIndices : null;

          for (let i = 0; i < p.points.length; i++) {
            if (targetIndices && !targetIndices.has(i)) continue;
            const pt = p.points[i];
            const sPt = snap.points[i];
            if (!sPt) continue;
            const dx = sPt.x - bbox.cx;
            const dy = sPt.y - bbox.cy;
            pt.x = bbox.cx + dx * cos - dy * sin;
            pt.y = bbox.cy + dx * sin + dy * cos;

            if (sPt.inHandle && pt.inHandle) {
              const hdx = sPt.inHandle.x - bbox.cx;
              const hdy = sPt.inHandle.y - bbox.cy;
              pt.inHandle.x = bbox.cx + hdx * cos - hdy * sin;
              pt.inHandle.y = bbox.cy + hdx * sin + hdy * cos;
            }
            if (sPt.outHandle && pt.outHandle) {
              const hdx = sPt.outHandle.x - bbox.cx;
              const hdy = sPt.outHandle.y - bbox.cy;
              pt.outHandle.x = bbox.cx + hdx * cos - hdy * sin;
              pt.outHandle.y = bbox.cy + hdx * sin + hdy * cos;
            }
          }
          if (!snap.isPointsOnly && snap.pivot && p.pivot) {
            const pdx = snap.pivot.x - bbox.cx;
            const pdy = snap.pivot.y - bbox.cy;
            p.pivot.x = bbox.cx + pdx * cos - pdy * sin;
            p.pivot.y = bbox.cy + pdx * sin + pdy * cos;
          }
        }
        this.render();
        return;
      }

      // ── (0) 自由変形スケール (Transform Scale: Ctrl+T / 拡大縮小ツール) ──
      if (dragTarget.type === 'transform_scale' && this.transformInitialSnapshot) {
        const bbox = dragTarget.initialBBox;
        const handle = dragTarget.handle;
        const isAlt = e.altKey || this.isAltPressed;
        const isShift = e.shiftKey || this.isShiftPressed;

        // 基準原点 (Center or Opposite corner/edge)
        let origin = { x: bbox.cx, y: bbox.cy };
        if (!isAlt) {
          if (handle === 'nw') origin = { x: bbox.maxX, y: bbox.maxY };
          else if (handle === 'n')  origin = { x: bbox.cx,   y: bbox.maxY };
          else if (handle === 'ne') origin = { x: bbox.minX, y: bbox.maxY };
          else if (handle === 'e')  origin = { x: bbox.minX, y: bbox.cy };
          else if (handle === 'se') origin = { x: bbox.minX, y: bbox.minY };
          else if (handle === 's')  origin = { x: bbox.cx,   y: bbox.minY };
          else if (handle === 'sw') origin = { x: bbox.maxX, y: bbox.minY };
          else if (handle === 'w')  origin = { x: bbox.maxX, y: bbox.cy };
        }

        let h0 = { x: bbox.cx, y: bbox.cy };
        if (handle === 'nw') h0 = { x: bbox.minX, y: bbox.minY };
        else if (handle === 'n')  h0 = { x: bbox.cx,   y: bbox.minY };
        else if (handle === 'ne') h0 = { x: bbox.maxX, y: bbox.minY };
        else if (handle === 'e')  h0 = { x: bbox.maxX, y: bbox.cy };
        else if (handle === 'se') h0 = { x: bbox.maxX, y: bbox.maxY };
        else if (handle === 's')  h0 = { x: bbox.cx,   y: bbox.maxY };
        else if (handle === 'sw') h0 = { x: bbox.minX, y: bbox.maxY };
        else if (handle === 'w')  h0 = { x: bbox.minX, y: bbox.cy };

        const v0x = h0.x - origin.x;
        const v0y = h0.y - origin.y;
        const v1x = worldPos.x - origin.x;
        const v1y = worldPos.y - origin.y;

        let sx = Math.abs(v0x) > 0.001 ? v1x / v0x : 1;
        let sy = Math.abs(v0y) > 0.001 ? v1y / v0y : 1;

        if (handle === 'e' || handle === 'w') {
          sy = 1;
        } else if (handle === 'n' || handle === 's') {
          sx = 1;
        } else if (isShift) {
          const s = Math.abs(sx) > Math.abs(sy) ? Math.abs(sx) : Math.abs(sy);
          sx = (sx < 0 ? -1 : 1) * s;
          sy = (sy < 0 ? -1 : 1) * s;
        }

        for (const [partId, snap] of this.transformInitialSnapshot.entries()) {
          const p = this.character.parts.find(part => part.id === partId);
          if (!p || !p.points) continue;
          const targetIndices = snap.isPointsOnly ? snap.pointIndices : null;

          for (let i = 0; i < p.points.length; i++) {
            if (targetIndices && !targetIndices.has(i)) continue;
            const pt = p.points[i];
            const sPt = snap.points[i];
            if (!sPt) continue;
            pt.x = origin.x + (sPt.x - origin.x) * sx;
            pt.y = origin.y + (sPt.y - origin.y) * sy;
            if (sPt.inHandle && pt.inHandle) {
              pt.inHandle.x = origin.x + (sPt.inHandle.x - origin.x) * sx;
              pt.inHandle.y = origin.y + (sPt.inHandle.y - origin.y) * sy;
            }
            if (sPt.outHandle && pt.outHandle) {
              pt.outHandle.x = origin.x + (sPt.outHandle.x - origin.x) * sx;
              pt.outHandle.y = origin.y + (sPt.outHandle.y - origin.y) * sy;
            }
          }
          if (!snap.isPointsOnly && snap.pivot && p.pivot) {
            p.pivot.x = origin.x + (snap.pivot.x - origin.x) * sx;
            p.pivot.y = origin.y + (snap.pivot.y - origin.y) * sy;
          }
        }
        this.render();
        return;
      }

      // ── (0-move) 自由変形ボックス全体の移動ドラッグ ──
      if (dragTarget.type === 'transform_move' && this.transformInitialSnapshot) {
        const dx = worldPos.x - dragStartPos.x;
        const dy = worldPos.y - dragStartPos.y;

        for (const [partId, snap] of this.transformInitialSnapshot.entries()) {
          const p = this.character.parts.find(part => part.id === partId);
          if (!p || !p.points) continue;
          const targetIndices = snap.isPointsOnly ? snap.pointIndices : null;

          for (let i = 0; i < p.points.length; i++) {
            if (targetIndices && !targetIndices.has(i)) continue;
            const pt = p.points[i];
            const sPt = snap.points[i];
            if (!sPt) continue;
            pt.x = sPt.x + dx;
            pt.y = sPt.y + dy;
            if (sPt.inHandle && pt.inHandle) {
              pt.inHandle.x = sPt.inHandle.x + dx;
              pt.inHandle.y = sPt.inHandle.y + dy;
            }
            if (sPt.outHandle && pt.outHandle) {
              pt.outHandle.x = sPt.outHandle.x + dx;
              pt.outHandle.y = sPt.outHandle.y + dy;
            }
          }
          if (!snap.isPointsOnly && snap.pivot && p.pivot) {
            p.pivot.x = snap.pivot.x + dx;
            p.pivot.y = snap.pivot.y + dy;
          }
        }
        this.render();
        return;
      }

      // ── (0b) 複数パーツ一括移動 ──
      if (dragTarget.type === 'part_multi') {
        const dx = worldPos.x - dragStartPos.x;
        const dy = worldPos.y - dragStartPos.y;
        dragStartPos = worldPos;
        for (const p of this.getSelectedParts()) {
          if (p.locked) continue;
          for (const pt of p.points) {
            pt.x += dx; pt.y += dy;
            if (pt.inHandle)  { pt.inHandle.x += dx;  pt.inHandle.y += dy; }
            if (pt.outHandle) { pt.outHandle.x += dx; pt.outHandle.y += dy; }
          }
          if (p.pivot) {
            p.pivot.x += dx;
            p.pivot.y += dy;
          }
        }
        this.render();
        return;
      }

      const part = this.getSelectedPart();
      if (!part) return;

      // ── (1) アンカーポイント移動 ──
      if (dragTarget.type === 'point') {
        const pt = part.points[dragTarget.index];
        if (!pt) return;

        // Shiftキーで 45度/垂直/水平 方向スナップ
        if ((e.shiftKey || this.isShiftPressed) && initialPtPos) {
          const snapped = this.snapAngle45(initialPtPos.x, initialPtPos.y, worldPos.x, worldPos.y);
          worldPos.x = snapped.x;
          worldPos.y = snapped.y;
        }

        const dx = worldPos.x - pt.x;
        const dy = worldPos.y - pt.y;

        // 複数選択されたアンカーポイントの一括移動
        if (this.selectedPointIndices && this.selectedPointIndices.size > 1 && this.selectedPointIndices.has(dragTarget.index)) {
          for (const idx of this.selectedPointIndices) {
            const p = part.points[idx];
            if (!p) continue;
            p.x += dx;
            p.y += dy;
            if (p.inHandle)  { p.inHandle.x += dx;  p.inHandle.y += dy; }
            if (p.outHandle) { p.outHandle.x += dx; p.outHandle.y += dy; }
          }
        } else {
          pt.x = worldPos.x;
          pt.y = worldPos.y;
          if (pt.inHandle)  { pt.inHandle.x += dx;  pt.inHandle.y += dy; }
          if (pt.outHandle) { pt.outHandle.x += dx; pt.outHandle.y += dy; }
        }

        if (this.currentTool === TOOLS.CURVATURE) {
          computeCurvatureHandles(part.points, part.closed);
        }
        this.render();
      }

      // ── (2) ベジェハンドルの編集 (Altキーで折り曲げ & 連動復活) ──
      else if (dragTarget.type === 'handle') {
        const pt = part.points[dragTarget.index];
        if (!pt) return;

        // Shiftキーでアンカーからの角度を45度単位にスナップ
        if (e.shiftKey || this.isShiftPressed) {
          const snapped = this.snapAngle45(pt.x, pt.y, worldPos.x, worldPos.y);
          worldPos.x = snapped.x;
          worldPos.y = snapped.y;
        }

        const isAlt = e.altKey || this.isAltPressed;

        if (isAlt) {
          // Altキーが押されている場合:
          // もし既に折り曲げられていたなら連動を復活 (broken = false)
          // まだ連動していたなら折り曲げる (broken = true)
          if (!dragTarget.hasToggledAlt) {
            pt.broken = !dragTarget.initialBroken;
            dragTarget.hasToggledAlt = true;
          }
        }

        if (dragTarget.handleType === 'in') {
          pt.inHandle = { x: worldPos.x, y: worldPos.y };
          // 連動モード (スムーズかつ非折り曲げ時)
          if (pt.type === 'smooth' && !pt.broken) {
            const hdx = pt.x - worldPos.x;
            const hdy = pt.y - worldPos.y;
            pt.outHandle = { x: pt.x + hdx, y: pt.y + hdy };
          }
        } else {
          pt.outHandle = { x: worldPos.x, y: worldPos.y };
          if (pt.type === 'smooth' && !pt.broken) {
            const hdx = pt.x - worldPos.x;
            const hdy = pt.y - worldPos.y;
            pt.inHandle = { x: pt.x + hdx, y: pt.y + hdy };
          }
        }
        this.render();
      }

      // ── (3) 新規ペンクリックからのドラッグ (ハンドル引き出し) ──
      else if (dragTarget.type === 'new_pen_drag') {
        const pt = part.points[dragTarget.index];
        if (!pt) return;

        if (e.shiftKey || this.isShiftPressed) {
          const snapped = this.snapAngle45(pt.x, pt.y, worldPos.x, worldPos.y);
          worldPos.x = snapped.x;
          worldPos.y = snapped.y;
        }

        pt.type = 'smooth';
        pt.broken = false;
        pt.outHandle = { x: worldPos.x, y: worldPos.y };
        const hdx = pt.x - worldPos.x;
        const hdy = pt.y - worldPos.y;
        pt.inHandle = { x: pt.x + hdx, y: pt.y + hdy };
        this.render();
      }

      // ── (4) セグメント直接ドラッグ (ベジェ曲線のふくらみ変形) ──
      else if (dragTarget.type === 'segment') {
        const pts = part.points;
        const p0 = pts[dragTarget.segIndex];
        const p3 = pts[(dragTarget.segIndex + 1) % pts.length];
        if (p0 && p3) {
          const dx = (worldPos.x - dragTarget.startPos.x) * 0.75;
          const dy = (worldPos.y - dragTarget.startPos.y) * 0.75;

          p0.outHandle = { x: dragTarget.origP0Out.x + dx, y: dragTarget.origP0Out.y + dy };
          p3.inHandle  = { x: dragTarget.origP3In.x + dx,  y: dragTarget.origP3In.y + dy };
          this.render();
        }
      }

      // ── (5) ピボット移動 ──
      else if (dragTarget.type === 'pivot') {
        part.pivot = { x: worldPos.x, y: worldPos.y };
        this.renderOverlay();
      }

      // ── (6) パーツ全体移動 ──
      else if (dragTarget.type === 'part') {
        const dx = worldPos.x - dragStartPos.x;
        const dy = worldPos.y - dragStartPos.y;
        dragStartPos = worldPos;
        for (const pt of part.points) {
          pt.x += dx; pt.y += dy;
          if (pt.inHandle)  { pt.inHandle.x += dx;  pt.inHandle.y += dy; }
          if (pt.outHandle) { pt.outHandle.x += dx; pt.outHandle.y += dy; }
        }
        if (part.pivot) {
          part.pivot.x += dx;
          part.pivot.y += dy;
        }
        this.render();
      }
    });

    // ──────────────────────────────────────────────
    // 3. PointerUp: 操作完了
    // ──────────────────────────────────────────────
    window.addEventListener('pointerup', (e) => {
      this.isPanning = false;
      isDragging = false;

      // 矩形選択コミット
      if (this.isMarqueeSelecting && this.marqueeStart && this.marqueeCurrent) {
        this.isMarqueeSelecting = false;
        const minX = Math.min(this.marqueeStart.x, this.marqueeCurrent.x);
        const maxX = Math.max(this.marqueeStart.x, this.marqueeCurrent.x);
        const minY = Math.min(this.marqueeStart.y, this.marqueeCurrent.y);
        const maxY = Math.max(this.marqueeStart.y, this.marqueeCurrent.y);

        this.clearMarquee();

        if ((maxX - minX) > 4 || (maxY - minY) > 4) {
          const isShift = e.shiftKey || this.isShiftPressed;

          // (1) 指定レイヤーのみモード、またはダイレクト選択/曲率ペンツール時:
          // アクティブなパーツの複数アンカーポイントを矩形範囲選択！
          if (this.layerSelectMode === 'active' || this.currentTool === TOOLS.DIRECT_SELECT || this.currentTool === TOOLS.CURVATURE) {
            const activePart = this.getSelectedPart();
            if (activePart && activePart.points && !activePart.locked) {
              if (!isShift) this.selectedPointIndices.clear();
              activePart.points.forEach((pt, idx) => {
                if (pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY) {
                  this.selectedPointIndices.add(idx);
                }
              });
              this.selectedPointIndex = this.selectedPointIndices.size > 0 ? Array.from(this.selectedPointIndices)[0] : -1;
              this.renderOverlay();
              return;
            }
          }

          // (2) 全レイヤーモード・通常選択ツール時: オブジェクト(パーツ)単位の範囲選択
          const matched = this.character.parts.filter(p => {
            if (!p.visible || p.locked || !p.points || p.points.length === 0) return false;
            return p.points.some(pt => pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY);
          });

          if (matched.length > 0) {
            if (!isShift) this.selectedPartIds.clear();
            for (const m of matched) this.selectedPartIds.add(m.id);
            this.selectedPartId = matched[0].id;
          } else if (!isShift) {
            this.deselectAll();
          }
          this.render();
          if (this.onSelectionChange) this.onSelectionChange(this.getSelectedPart());
        } else {
          // キャンバスの何もないところをクリックした場合は選択解除
          this.deselectAll();
        }
        return;
      }

      // シェイプコミット
      if (this.isDrawingShape && this.shapeStartPos) {
        let worldPos = this.screenToWorld(e.clientX, e.clientY);
        if (e.shiftKey || this.isShiftPressed) {
          const dx = worldPos.x - this.shapeStartPos.x;
          const dy = worldPos.y - this.shapeStartPos.y;
          const side = Math.max(Math.abs(dx), Math.abs(dy));
          worldPos.x = this.shapeStartPos.x + (dx >= 0 ? side : -side);
          worldPos.y = this.shapeStartPos.y + (dy >= 0 ? side : -side);
        }

        this.isDrawingShape = false;
        if (this.shapePreviewEl) { this.shapePreviewEl.remove(); this.shapePreviewEl = null; }
        this.commitShape(this.currentTool, this.shapeStartPos, worldPos);
        this.shapeStartPos = null;
        return;
      }

      if (dragTarget) {
        if (dragTarget.type === 'transform_scale') {
          this.transformInitialSnapshot = this.snapshotSelectedParts();
        }
        dragTarget = null;
        if (this.onCharacterChange) this.onCharacterChange(this.character);
      }
    });

    // ──────────────────────────────────────────────
    // 4. マウスホイール: カーソル位置中心の滑らかズーム (Photoshop互換)
    // ──────────────────────────────────────────────
    this.svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      this.applyZoom(this.zoom * zoomFactor, { clientX: e.clientX, clientY: e.clientY });
    }, { passive: false });

    // ──────────────────────────────────────────────
    // 5. キーボード修飾キー & 各種ショートカット
    // ──────────────────────────────────────────────
    window.addEventListener('keydown', (e) => {
      // 修飾キーステート追跡
      if (e.key === 'Alt') this.isAltPressed = true;
      if (e.key === 'Control' || e.key === 'Meta') this.isCtrlPressed = true;
      if (e.key === 'Shift') this.isShiftPressed = true;

      // 入力フォームでのタイピング中はショートカットを無効化
      const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT';

      // (A) スペースキー: 一時的な手のひらツール (どのツールからでもSpaceを押している間Pan)
      if (e.code === 'Space' && !isInput && !this.isSpacePressed) {
        e.preventDefault();
        this.isSpacePressed = true;
        this.tempPanPreviousTool = this.currentTool;
        this.setTool(TOOLS.PAN);
        return;
      }

      if (isInput) return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // (B) 自由変形 / スケールモード (Photoshop Ctrl+T)
      if (cmdOrCtrl && e.key.toLowerCase() === 't') {
        e.preventDefault();
        e.stopPropagation();
        if (this.isTransformMode) {
          this.commitTransform();
        } else {
          this.previousToolBeforeTransform = this.currentTool;
          this.toggleTransformMode(true);
        }
        return;
      }

      // (C) 複数レイヤー結合 / 下のレイヤーと結合 (Photoshop Ctrl+E)
      if (cmdOrCtrl && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) this.ungroupSelectedParts();
        else this.mergeSelectedLayers();
        return;
      }

      // (D) すべて選択 (Photoshop Ctrl+A)
      if (cmdOrCtrl && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        e.stopPropagation();
        this.selectAll();
        return;
      }

      // (E) 選択解除 (Photoshop Ctrl+D)
      if (cmdOrCtrl && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        e.stopPropagation();
        this.deselectAll();
        return;
      }

      // (F) レイヤーの複製 (Photoshop Ctrl+J)
      if (cmdOrCtrl && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        e.stopPropagation();
        this.duplicateSelectedParts();
        return;
      }

      // (G) レイヤーのグループ化 (Ctrl+G) / グループ解除 (Ctrl+Shift+G)
      if (cmdOrCtrl && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) this.ungroupSelectedParts();
        else this.groupSelectedParts();
        return;
      }

      // (H) 自由変形の確定 (Enter)
      if (e.key === 'Enter' && this.isTransformMode) {
        e.preventDefault();
        e.stopPropagation();
        this.commitTransform();
        return;
      }

      // (I) 自由変形のキャンセル (Escape)
      if (e.key === 'Escape' && this.isTransformMode) {
        e.preventDefault();
        e.stopPropagation();
        this.cancelTransform();
        return;
      }

      // (J) Ctrl+0: 画面全体フィット (Fit Viewport)
      if (cmdOrCtrl && e.key === '0') {
        e.preventDefault();
        this.fitViewport();
        return;
      }

      // (K) Ctrl+1: 100%等倍表示
      if (cmdOrCtrl && e.key === '1') {
        e.preventDefault();
        this.resetZoom();
        return;
      }

      // (L) Ctrl++ / Ctrl+=: ズームイン
      if (cmdOrCtrl && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        this.zoomIn();
        return;
      }

      // (M) Ctrl+-: ズームアウト
      if (cmdOrCtrl && e.key === '-') {
        e.preventDefault();
        this.zoomOut();
        return;
      }

      // (N) Delete / Backspace: 選択中キーフレーム、アンカーポイント、またはパーツの削除
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // キーフレームが選択されている場合はパーツ削除を行わず、タイムライン側に処理を委ねる
        if (this.hasSelectedKeyframes && this.hasSelectedKeyframes()) {
          return;
        }
        if ((this.selectedPointIndices && this.selectedPointIndices.size > 0) || this.selectedPointIndex >= 0) {
          e.preventDefault();
          this.deleteSelectedPoint();
          return;
        } else if (this.currentTool === TOOLS.SELECT || this.selectedPartId) {
          e.preventDefault();
          this.deleteSelectedParts();
          return;
        }
      }

      // (O) 矢印キー: 1px移動 (Shift併用で10px移動)
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        let dx = 0, dy = 0;
        if (e.key === 'ArrowUp') dy = -step;
        if (e.key === 'ArrowDown') dy = step;
        if (e.key === 'ArrowLeft') dx = -step;
        if (e.key === 'ArrowRight') dx = step;
        this.nudgeSelected(dx, dy);
        return;
      }

      // (P) Ctrl+Z (Undo) / Ctrl+Y or Ctrl+Shift+Z (Redo)
      if (cmdOrCtrl && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) this.redo();
        else this.undo();
        return;
      }
      if (cmdOrCtrl && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        e.stopPropagation();
        this.redo();
        return;
      }

      // (Q) Photoshop単体ツールショートカット (修飾キーなし時)
      if (!cmdOrCtrl && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === 'v') { this.setTool(TOOLS.SELECT); return; }
        if (k === 'a') { this.setTool(TOOLS.DIRECT_SELECT); return; }
        if (k === 'm') { this.setTool(TOOLS.MARQUEE); return; }
        if (k === 'p') { this.setTool(TOOLS.PEN); return; }
        if (k === 'c') { this.setTool(TOOLS.CURVATURE); return; }
        if (k === 'u' || k === 'r') { this.setTool(TOOLS.RECT); return; }
        if (k === 'h') { this.setTool(TOOLS.PAN); return; }
        if (k === 'z') { this.setTool(TOOLS.ZOOM); return; }
      }
    }, { capture: true });

    window.addEventListener('keyup', (e) => {
      if (e.key === 'Alt') this.isAltPressed = false;
      if (e.key === 'Control' || e.key === 'Meta') this.isCtrlPressed = false;
      if (e.key === 'Shift') this.isShiftPressed = false;

      // スペースキーを離したら元のツールに復帰
      if (e.code === 'Space') {
        this.isSpacePressed = false;
        if (this.tempPanPreviousTool) {
          this.setTool(this.tempPanPreviousTool);
          this.tempPanPreviousTool = null;
        }
      }
    });
  }

  // アニメーションフレーム適用
  setAnimationPose(transforms) {
    this.animTransforms = transforms;
    this.render();
  }

  // ── シェイプツール ヘルパー ──

  /** シェイプの種類と開始/終了座標からベジェ曲線点配列を生成 */
  buildShapePoints(type, s, e) {
    const x1 = Math.min(s.x, e.x);
    const y1 = Math.min(s.y, e.y);
    const x2 = Math.max(s.x, e.x);
    const y2 = Math.max(s.y, e.y);
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const rx = (x2 - x1) / 2;
    const ry = (y2 - y1) / 2;
    const k = 0.5522847;

    if (type === TOOLS.RECT) {
      return [
        { x: x1, y: y1, type: 'corner', inHandle: { x: x1, y: y1 }, outHandle: { x: x1, y: y1 } },
        { x: x2, y: y1, type: 'corner', inHandle: { x: x2, y: y1 }, outHandle: { x: x2, y: y1 } },
        { x: x2, y: y2, type: 'corner', inHandle: { x: x2, y: y2 }, outHandle: { x: x2, y: y2 } },
        { x: x1, y: y2, type: 'corner', inHandle: { x: x1, y: y2 }, outHandle: { x: x1, y: y2 } }
      ];
    }
    if (type === TOOLS.ELLIPSE) {
      return [
        { x: cx + rx, y: cy,      type: 'smooth', inHandle: { x: cx + rx, y: cy + ry * k }, outHandle: { x: cx + rx, y: cy - ry * k } },
        { x: cx,      y: cy - ry, type: 'smooth', inHandle: { x: cx + rx * k, y: cy - ry }, outHandle: { x: cx - rx * k, y: cy - ry } },
        { x: cx - rx, y: cy,      type: 'smooth', inHandle: { x: cx - rx, y: cy - ry * k }, outHandle: { x: cx - rx, y: cy + ry * k } },
        { x: cx,      y: cy + ry, type: 'smooth', inHandle: { x: cx - rx * k, y: cy + ry }, outHandle: { x: cx + rx * k, y: cy + ry } }
      ];
    }
    if (type === TOOLS.TRIANGLE) {
      return [
        { x: cx,  y: y1, type: 'corner', inHandle: { x: cx, y: y1 }, outHandle: { x: cx, y: y1 } },
        { x: x2, y: y2, type: 'corner', inHandle: { x: x2, y: y2 }, outHandle: { x: x2, y: y2 } },
        { x: x1, y: y2, type: 'corner', inHandle: { x: x1, y: y2 }, outHandle: { x: x1, y: y2 } }
      ];
    }
    return [];
  }

  /** ベジェ点配列をSVGパス文字列に変換 (シェイクプレビュー用) */
  shapePointsToPath(pts) {
    if (!pts || pts.length === 0) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      d += ` C ${prev.outHandle.x} ${prev.outHandle.y} ${curr.inHandle.x} ${curr.inHandle.y} ${curr.x} ${curr.y}`;
    }
    const last = pts[pts.length - 1];
    const first = pts[0];
    d += ` C ${last.outHandle.x} ${last.outHandle.y} ${first.inHandle.x} ${first.inHandle.y} ${first.x} ${first.y} Z`;
    return d;
  }

  /** 指定IDのパーツが現在選択中レイヤーまたはその子孫であるかを判定 */
  isPartInActiveLayer(partId) {
    if (!this.selectedPartId) return true;
    if (partId === this.selectedPartId) return true;
    if (!this.character || !this.character.parts) return true;
    let curr = this.character.parts.find(p => p.id === partId);
    while (curr && curr.parentId) {
      if (curr.parentId === this.selectedPartId) return true;
      curr = this.character.parts.find(p => p.id === curr.parentId);
    }
    return false;
  }

  /** シェイプを追加 (レイヤー選択中は強制新規レイヤーにせず、そのレイヤー内に追加) */
  commitShape(type, s, e) {
    const pts = this.buildShapePoints(type, s, e);
    if (pts.length === 0) return;

    const typeLabels = { rect: '長方形', ellipse: '楕円', triangle: '三角形' };
    const label = typeLabels[type] || type;
    const activePart = this.getSelectedPart();

    const cx = (s.x + e.x) / 2;
    const cy = (s.y + e.y) / 2;

    this.pushState();

    // 1. 選択中レイヤーが存在し、pointsが空の場合はそのレイヤー自体のシェイプとして設定
    if (activePart && !activePart.locked && (!activePart.points || activePart.points.length === 0)) {
      activePart.points = pts;
      activePart.closed = true;
      activePart.shapeType = type;
      activePart.pivot = { x: cx, y: cy };
      this.render();
      if (this.onCharacterChange) this.onCharacterChange(this.character);
      if (this.onSelectionChange) this.onSelectionChange(activePart);
      return;
    }

    // 2. 選択中レイヤーがある場合は、そのレイヤーを親(parentId)とする階層内シェイプとして追加
    //    選択中レイヤーがない場合はルートシェイプとして追加
    const parentId = (activePart && !activePart.locked) ? activePart.id : null;
    const parentName = activePart ? activePart.name : '';
    const existingCount = this.character.parts.filter(p => p.shapeType === type).length;
    const parentZ = activePart ? (activePart.zIndex || 0) : 0;
    const maxZ = Math.max(...this.character.parts.map(p => p.zIndex || 0), 0);

    const newPart = {
      id: `shape_${type}_${Date.now()}`,
      name: parentId ? `${parentName}の${label}` : `${label} ${existingCount + 1}`,
      type: 'shape',
      shapeType: type,
      parentId: parentId,
      visible: true,
      locked: false,
      pivot: { x: cx, y: cy },
      zIndex: parentId ? parentZ + 0.5 : maxZ + 1,
      style: activePart ? { ...activePart.style } : { fill: '#6366f1', stroke: '#4338ca', strokeWidth: 1.5, strokePosition: 'center', opacity: 1.0 },
      closed: true,
      points: pts,
      subPaths: []
    };

    if (activePart) {
      const idx = this.character.parts.indexOf(activePart);
      this.character.parts.splice(idx + 1, 0, newPart);
    } else {
      this.character.parts.push(newPart);
    }

    this.selectedPartId = newPart.id;
    this.render();
    if (this.onCharacterChange) this.onCharacterChange(this.character);
    if (this.onSelectionChange) this.onSelectionChange(newPart);
  }

  /** パス上の指定ワールド座標に近いセグメントを検出 (Photoshopのセグメントクリック/ドラッグ用) */
  findSegmentNear(part, worldPos, threshold = 12) {
    if (!part || !part.points || part.points.length < 2) return null;
    const pts = part.points;
    const n = part.closed ? pts.length : pts.length - 1;
    let closest = null;
    let minD = threshold;

    for (let i = 0; i < n; i++) {
      const p0 = pts[i];
      const p3 = pts[(i + 1) % pts.length];
      const p1 = p0.outHandle || p0;
      const p2 = p3.inHandle || p3;

      for (let step = 0; step <= 20; step++) {
        const t = step / 20;
        const mt = 1 - t;
        const bx = mt*mt*mt*p0.x + 3*mt*mt*t*p1.x + 3*mt*t*t*p2.x + t*t*t*p3.x;
        const by = mt*mt*mt*p0.y + 3*mt*mt*t*p1.y + 3*mt*t*t*p2.y + t*t*t*p3.y;
        const d = Math.hypot(worldPos.x - bx, worldPos.y - by);
        if (d < minD) {
          minD = d;
          closest = { segIndex: i, t, x: bx, y: by, p0, p3 };
        }
      }
    }
    return closest;
  }
}

