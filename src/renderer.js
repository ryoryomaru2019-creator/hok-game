import { FISH_TYPES } from './fish.js';
import { pointsToSvgPath } from './studio/pathUtils.js';
import { resolveRigTransforms } from './studio/animator.js';
import { getAllBasePresets } from './studio/model.js';
import { t } from './i18n.js';

/**
 * キャラクタースタジオ製ベクターキャラクターの自然なバウンディングボックスを算出
 * パーツ構成から minX, maxX, minY, maxY を取得し、元のアスペクト比を維持して均等スケーリングできるようにする
 */
export function getCharacterNaturalSize(char) {
  if (!char) return { width: 130, height: 80, centerX: 0, centerY: 0 };
  if (char._naturalSize) return char._naturalSize;

  if (!char.parts || char.parts.length === 0) {
    char._naturalSize = { width: 130, height: 80, centerX: 0, centerY: 0 };
    return char._naturalSize;
  }

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const part of char.parts) {
    if (part.visible === false) continue;
    if (part.points && part.points.length > 0) {
      for (const pt of part.points) {
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.y > maxY) maxY = pt.y;
      }
    }
    if (part.subPaths && part.subPaths.length > 0) {
      for (const sp of part.subPaths) {
        if (sp.type === 'circle') {
          const r = sp.r || 5;
          if (sp.cx - r < minX) minX = sp.cx - r;
          if (sp.cx + r > maxX) maxX = sp.cx + r;
          if (sp.cy - r < minY) minY = sp.cy - r;
          if (sp.cy + r > maxY) maxY = sp.cy + r;
        } else if (sp.type === 'polygon' && sp.points) {
          for (const pt of sp.points) {
            if (pt.x < minX) minX = pt.x;
            if (pt.x > maxX) maxX = pt.x;
            if (pt.y < minY) minY = pt.y;
            if (pt.y > maxY) maxY = pt.y;
          }
        }
      }
    }
  }

  if (!isFinite(minX) || !isFinite(maxX) || maxX <= minX) { minX = -65; maxX = 65; }
  if (!isFinite(minY) || !isFinite(maxY) || maxY <= minY) { minY = -40; maxY = 40; }

  const width = Math.max(20, maxX - minX);
  const height = Math.max(20, maxY - minY);
  char._naturalSize = {
    width,
    height,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2
  };
  return char._naturalSize;
}

export class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    // 背景演出用
    this.bubbles = [];
    this.lightRays = [];
    this.flowParticles = [];
    this.sparkParticles = [];
    this.inkClouds = [];
    this.floatingTexts = [];
    this.particles = [];
    this.bgImageElement = null;
    this.bgImageLoadedSrc = '';
    
    // キャラクタースタジオ連携カスタムキャラクター (単体および全魚種ロスター)
    this.customCharacter = null;
    this.customCharacters = new Map();

    // 公式ベースプリセット（ヒラメ、カレイ、タコ、イカ、エイ、アジの開き、ウシノシタ）を全初期登録
    // これによりローカルストレージが空でも最初から100%キャラクタースタジオ通りのベクターモデル・斑点で描画される
    try {
      const presets = getAllBasePresets();
      for (const p of presets) {
        if (p && p.id) {
          this.customCharacters.set(p.id, p);
        }
      }
    } catch (err) {
      console.warn("Failed to pre-populate base presets into GameRenderer", err);
    }

    this.initBackgroundEffects();
  }

  setCustomCharacter(char) {
    this.customCharacter = char;
    if (char && char.id) {
      this.customCharacters.set(char.id, char);
    }
  }

  setCustomCharacters(roster) {
    if (!roster) return;
    if (Array.isArray(roster)) {
      roster.forEach(c => { if (c && c.id) this.customCharacters.set(c.id, c); });
    } else if (typeof roster === 'object') {
      Object.values(roster).forEach(c => { if (c && c.id) this.customCharacters.set(c.id, c); });
    }
  }

  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.initBackgroundEffects();
  }

  initBackgroundEffects() {
    const w = this.canvas.width || 600;
    const h = this.canvas.height || 800;
    
    // 泡
    this.bubbles = Array.from({ length: 30 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      size: 2 + Math.random() * 5,
      speed: 0.5 + Math.random() * 1.5,
      wobble: Math.random() * Math.PI * 2
    }));

    // 光の筋 (God rays)
    this.lightRays = Array.from({ length: 5 }, (_, i) => ({
      x: (w / 5) * i + Math.random() * 50,
      width: 40 + Math.random() * 60,
      alpha: 0.05 + Math.random() * 0.08,
      speed: 0.005 + Math.random() * 0.01,
      phase: Math.random() * Math.PI * 2
    }));

    // 横流れエフェクト (⬬ 楕円パーティクル)
    this.flowParticles = Array.from({ length: 20 }, () => ({
      x: Math.random() * (w + 100) - 50,
      y: Math.random() * (h * 0.85),
      rx: 12 + Math.random() * 25,
      ry: 1.5 + Math.random() * 3,
      speed: 1.2 + Math.random() * 2.5,
      alpha: 0.2 + Math.random() * 0.5
    }));

    // 浮遊微粒子/ダスト/星くず (Sparks & Dust)
    this.sparkParticles = Array.from({ length: 25 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      radius: 1.5 + Math.random() * 2.5,
      vx: (Math.random() - 0.5) * 0.5,
      vy: -0.2 - Math.random() * 0.6,
      twinkle: Math.random() * Math.PI * 2,
      twinkleSpeed: 0.03 + Math.random() * 0.05
    }));
  }

  addFloatingText(text, x, y, color = '#ffffff', fontSize = 24) {
    this.floatingTexts.push({
      text,
      x,
      y,
      vy: -1.8,
      alpha: 1.0,
      color,
      fontSize
    });
  }

  addInkCloud(x, y) {
    for (let i = 0; i < 12; i++) {
      this.inkClouds.push({
        x: x + (Math.random() - 0.5) * 30,
        y: y + (Math.random() - 0.5) * 30,
        radius: 25 + Math.random() * 35,
        alpha: 0.85,
        growth: 0.6 + Math.random() * 0.4
      });
    }
  }

  addSplash(x, y, color = '#7dd3fc') {
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 2 + Math.random() * 4,
        color,
        alpha: 1.0
      });
    }
  }

  render(gameState) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // 1. 背景グラデーション & 背景PNG画像
    this.renderOceanBackground(w, h, gameState);

    // 2. 光の筋 & 泡
    this.renderCausticsAndBubbles(w, h, gameState);

    // 3. 横流れエフェクト (⬬ 楕円パーティクル)
    this.renderFlowEffect(w, h, gameState);

    // 4. 浮遊微粒子/ダスト/星くず (Sparks & Dust)
    this.renderSparks(w, h, gameState);

    // 5. 地面の砂地/草 (下部UIと被らない安全領域)
    this.renderSeabed(w, h, gameState?.safeBottom, gameState);

    // 6. 背景の小魚（イワシ群）＆ 季節・カスタム演出
    this.renderAmbientFish(gameState?.ambientFishes, gameState);

    // 7. 撒かれた餌
    this.renderBaits(gameState?.baits);

    // 8. メインの魚たち (シルエットの魚は奥、通常表示の魚は最前面に優先描画)
    const fishes = gameState?.fishes || [];
    const sortedFishes = [...fishes].sort((a, b) => {
      const aSil = !!a.isSilhouetteActive || (a.depth > 0.55);
      const bSil = !!b.isSilhouetteActive || (b.depth > 0.55);
      if (aSil !== bSil) {
        return aSil ? -1 : 1; // シルエットが先（奥に描画）、鮮明な魚が後（手前に重ねて描画）
      }
      return b.depth - a.depth;
    });
    for (const fish of sortedFishes) {
      this.renderFish(fish);
    }

    // 9. タコの墨エフェクト
    this.renderInkClouds();

    // 10. パーティクル
    this.renderParticles();

    // 11. フローティングスコアテキスト (+10, -2, COMBO!)
    this.renderFloatingTexts();

    // 12. フィーバー演出（画面縁のゴールド・パルス発光 & カオスバナー）
    if (gameState?.isFeverTime) {
      ctx.save();
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.008);
      ctx.strokeStyle = `rgba(250, 204, 21, ${0.35 + 0.3 * pulse})`;
      ctx.lineWidth = 10 + 6 * pulse;
      ctx.strokeRect(0, 0, w, h);

      // 上部にミニバナー
      ctx.fillRect(0, 0, w, 28);
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fef08a';
      ctx.fillText('🔥 FEVER TIME! 大漁ラッシュ中！ 🔥', w * 0.5, 14);
      ctx.restore();
    }
  }

  _hexToRgba(hex, alpha = 1.0) {
    if (!hex) return `rgba(255, 255, 255, ${alpha})`;
    if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex;
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const num = parseInt(c, 16);
    if (isNaN(num)) return `rgba(255, 255, 255, ${alpha})`;
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  renderOceanBackground(w, h, gameState) {
    const ctx = this.ctx;
    const devCfg = gameState?.getActiveDevConfig ? gameState.getActiveDevConfig() : (gameState?.devConfig || {});
    const ambCfg = devCfg.ambientConfig || {};
    const gradCfg = ambCfg.gradient || {};

    // 1. グラデーション背景
    if (gradCfg.enabled !== false) {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, gradCfg.topColor || '#0284c7');
      grad.addColorStop(0.3, gradCfg.midColor || '#0369a1');
      grad.addColorStop(0.7, gradCfg.deepColor || '#075985');
      grad.addColorStop(1, gradCfg.bottomColor || '#0c2340');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.fillStyle = '#0c2340';
      ctx.fillRect(0, 0, w, h);
    }

    // 2. 背景PNG 1枚絵 (カスタム画像)
    const bgImgCfg = ambCfg.backgroundImage;
    if (bgImgCfg && bgImgCfg.enabled && bgImgCfg.dataUrl) {
      if (!this.bgImageElement || this.bgImageLoadedSrc !== bgImgCfg.dataUrl) {
        this.bgImageElement = new Image();
        this.bgImageElement.src = bgImgCfg.dataUrl;
        this.bgImageLoadedSrc = bgImgCfg.dataUrl;
      }
      if (this.bgImageElement.complete && this.bgImageElement.naturalWidth > 0) {
        ctx.save();
        ctx.globalAlpha = bgImgCfg.opacity ?? 0.85;
        const fit = bgImgCfg.fit || 'cover';
        const img = this.bgImageElement;
        const nw = img.naturalWidth;
        const nh = img.naturalHeight;

        if (fit === 'cover') {
          const scale = Math.max(w / nw, h / nh);
          const dw = nw * scale;
          const dh = nh * scale;
          const dx = (w - dw) / 2;
          const dy = (h - dh) / 2;
          ctx.drawImage(img, dx, dy, dw, dh);
        } else if (fit === 'contain') {
          const scale = Math.min(w / nw, h / nh);
          const dw = nw * scale;
          const dh = nh * scale;
          const dx = (w - dw) / 2;
          const dy = (h - dh) / 2;
          ctx.drawImage(img, dx, dy, dw, dh);
        } else {
          // stretch
          ctx.drawImage(img, 0, 0, w, h);
        }
        ctx.restore();
      }
    }
  }

  renderCausticsAndBubbles(w, h, gameState) {
    const ctx = this.ctx;
    const devCfg = gameState?.getActiveDevConfig ? gameState.getActiveDevConfig() : (gameState?.devConfig || {});
    const ambCfg = devCfg.ambientConfig || {};

    // 光芒
    const lightCfg = ambCfg.lightRays || { enabled: true, color: '#ffffff', intensity: 1.0 };
    if (lightCfg.enabled !== false && ambCfg.enabled !== false) {
      ctx.save();
      const rayBaseColor = lightCfg.color || '#ffffff';
      const intensity = lightCfg.intensity ?? 1.0;
      for (const ray of this.lightRays) {
        ray.phase += ray.speed;
        const curAlpha = Math.max(0, (ray.alpha + Math.sin(ray.phase) * 0.03) * intensity);
        const rGrad = ctx.createLinearGradient(ray.x, 0, ray.x + 30, h * 0.85);
        rGrad.addColorStop(0, this._hexToRgba(rayBaseColor, curAlpha * 1.5));
        rGrad.addColorStop(1, this._hexToRgba(rayBaseColor, 0));
        
        ctx.fillStyle = rGrad;
        ctx.beginPath();
        ctx.moveTo(ray.x, 0);
        ctx.lineTo(ray.x + ray.width, 0);
        ctx.lineTo(ray.x + ray.width * 2 + 50, h * 0.85);
        ctx.lineTo(ray.x - 30, h * 0.85);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // 泡 (管理コンソール設定 & キャラサージ反映)
    const bubblesCfg = ambCfg.bubbles || { enabled: true, count: 30, color: '#ffffff' };
    const surge = gameState?.ambientSurge;
    const isSurgeBubble = surge?.active && surge.targetPresets?.includes('bubbles');
    const surgeMult = isSurgeBubble ? (surge.multiplier || 1.0) : 1.0;

    if (bubblesCfg.enabled !== false && ambCfg.enabled !== false) {
      let baseCount = bubblesCfg.count;
      if (baseCount === 0 || baseCount === undefined) {
        baseCount = 30; // 0: ランダムデフォルト
      }
      const targetCount = Math.min(120, Math.max(0, Math.round(baseCount * surgeMult)));

      // バブル配列の要素数を同期
      while (this.bubbles.length < targetCount) {
        this.bubbles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          size: 2 + Math.random() * 5,
          speed: 0.5 + Math.random() * 1.5,
          wobble: Math.random() * Math.PI * 2
        });
      }

      const bubbleColor = bubblesCfg.color || '#ffffff';
      ctx.save();
      ctx.fillStyle = this._hexToRgba(bubbleColor, 0.4);
      ctx.strokeStyle = this._hexToRgba(bubbleColor, 0.7);
      ctx.lineWidth = 1;
      const countToDraw = Math.min(this.bubbles.length, targetCount);
      for (let i = 0; i < countToDraw; i++) {
        const b = this.bubbles[i];
        b.y -= b.speed * (isSurgeBubble ? 1.4 : 1.0);
        b.wobble += 0.05;
        const curX = b.x + Math.sin(b.wobble) * 3;
        if (b.y < -10) {
          b.y = h + 10;
          b.x = Math.random() * w;
        }
        ctx.beginPath();
        ctx.arc(curX, b.y, b.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  renderFlowEffect(w, h, gameState) {
    const ctx = this.ctx;
    const devCfg = gameState?.getActiveDevConfig ? gameState.getActiveDevConfig() : (gameState?.devConfig || {});
    const ambCfg = devCfg.ambientConfig || {};
    const flowCfg = ambCfg.flowEffect || { enabled: false, count: 20, color: '#38bdf8', speed: 1.0 };

    if (!flowCfg.enabled || ambCfg.enabled === false) return;

    const targetCount = Math.min(80, Math.max(0, flowCfg.count ?? 20));
    while (this.flowParticles.length < targetCount) {
      this.flowParticles.push({
        x: Math.random() * (w + 100) - 50,
        y: Math.random() * (h * 0.85),
        rx: 12 + Math.random() * 25,
        ry: 1.5 + Math.random() * 3,
        speed: 1.2 + Math.random() * 2.5,
        alpha: 0.2 + Math.random() * 0.5
      });
    }

    const flowColor = flowCfg.color || '#38bdf8';
    const speedMult = flowCfg.speed || 1.0;
    const countToDraw = Math.min(this.flowParticles.length, targetCount);

    ctx.save();
    for (let i = 0; i < countToDraw; i++) {
      const p = this.flowParticles[i];
      p.x += p.speed * speedMult;
      if (p.x > w + 60) {
        p.x = -60;
        p.y = Math.random() * (h * 0.85);
      }
      ctx.fillStyle = this._hexToRgba(flowColor, p.alpha);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  renderSparks(w, h, gameState) {
    const ctx = this.ctx;
    const devCfg = gameState?.getActiveDevConfig ? gameState.getActiveDevConfig() : (gameState?.devConfig || {});
    const ambCfg = devCfg.ambientConfig || {};
    const sparksCfg = ambCfg.sparks || { enabled: false, count: 25, color: '#fef08a', speed: 1.0 };

    if (!sparksCfg.enabled || ambCfg.enabled === false) return;

    const targetCount = Math.min(100, Math.max(0, sparksCfg.count ?? 25));
    while (this.sparkParticles.length < targetCount) {
      this.sparkParticles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        radius: 1.5 + Math.random() * 2.5,
        vx: (Math.random() - 0.5) * 0.5,
        vy: -0.2 - Math.random() * 0.6,
        twinkle: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.03 + Math.random() * 0.05
      });
    }

    const sparkColor = sparksCfg.color || '#fef08a';
    const speedMult = sparksCfg.speed || 1.0;
    const countToDraw = Math.min(this.sparkParticles.length, targetCount);

    ctx.save();
    for (let i = 0; i < countToDraw; i++) {
      const p = this.sparkParticles[i];
      p.x += p.vx * speedMult;
      p.y += p.vy * speedMult;
      p.twinkle += p.twinkleSpeed;
      if (p.y < -10) {
        p.y = h + 10;
        p.x = Math.random() * w;
      }
      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;

      const alpha = 0.3 + 0.6 * Math.abs(Math.sin(p.twinkle));
      ctx.fillStyle = this._hexToRgba(sparkColor, alpha);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();

      // キラッと光る十字グロー
      if (alpha > 0.6) {
        ctx.strokeStyle = this._hexToRgba(sparkColor, (alpha - 0.5) * 0.8);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x - p.radius * 2.2, p.y);
        ctx.lineTo(p.x + p.radius * 2.2, p.y);
        ctx.moveTo(p.x, p.y - p.radius * 2.2);
        ctx.lineTo(p.x, p.y + p.radius * 2.2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  renderSeabed(w, h, safeBottom, gameState) {
    const ctx = this.ctx;
    const devCfg = gameState?.getActiveDevConfig ? gameState.getActiveDevConfig() : (gameState?.devConfig || {});
    const ambCfg = devCfg.ambientConfig || {};
    const groundCfg = ambCfg.ground || { enabled: true, topColor: '#786047', bottomColor: '#3b2b1d', plantColor: '#15803d', showPlants: true };

    if (groundCfg.enabled === false || ambCfg.enabled === false) return;

    // 下部UIコンテナの上端と調和する海底/地面レベル
    const seabedY = safeBottom !== undefined ? (safeBottom - 25) : (h * 0.72);
    
    // 砂地/地面グラデーション
    const sandGrad = ctx.createLinearGradient(0, seabedY, 0, h);
    sandGrad.addColorStop(0, groundCfg.topColor || '#786047');
    sandGrad.addColorStop(1, groundCfg.bottomColor || '#3b2b1d');
    
    ctx.fillStyle = sandGrad;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, seabedY + 10);
    // なだらかな波
    ctx.bezierCurveTo(w * 0.25, seabedY - 12, w * 0.6, seabedY + 16, w, seabedY);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // 草/海草の揺らぎ
    if (groundCfg.showPlants !== false) {
      const time = Date.now() * 0.002;
      ctx.strokeStyle = groundCfg.plantColor || '#15803d';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      for (let x = 30; x < w; x += 85) {
        const sway = Math.sin(time + x) * 12;
        ctx.beginPath();
        ctx.moveTo(x, h);
        ctx.quadraticCurveTo(x + sway * 0.5, seabedY + 10, x + sway, seabedY - 35);
        ctx.stroke();
      }
    }
  }

  renderAmbientFish(ambientFishes, gameState) {
    const ctx = this.ctx;
    const devCfg = gameState?.getActiveDevConfig ? gameState.getActiveDevConfig() : (gameState?.devConfig || {});
    const ambCfg = devCfg.ambientConfig || {};
    const fishCfg = ambCfg.smallFish || { enabled: true, count: 15, color: '#e0f2fe' };
    const surge = gameState?.ambientSurge;
    const isSurgeFish = surge?.active && surge.targetPresets?.includes('small_fish');
    const surgeMult = isSurgeFish ? (surge.multiplier || 1.0) : 1.0;

    if (fishCfg.enabled !== false && ambCfg.enabled !== false) {
      let baseCount = fishCfg.count;
      if (baseCount === 0 || baseCount === undefined) {
        baseCount = 15; // 0: ランダムデフォルト
      }
      const targetCount = Math.min(60, Math.max(0, Math.round(baseCount * surgeMult)));

      const fishColor = fishCfg.color || '#e0f2fe';
      ctx.save();
      ctx.fillStyle = this._hexToRgba(fishColor, 0.7);
      const countToDraw = Math.min(ambientFishes ? ambientFishes.length : 0, targetCount);
      for (let i = 0; i < countToDraw; i++) {
        const af = ambientFishes[i];
        ctx.save();
        ctx.translate(af.x, af.y);
        ctx.rotate(af.angle);
        ctx.beginPath();
        ctx.ellipse(0, 0, af.size, af.size * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        // 尾びれ
        ctx.beginPath();
        ctx.moveTo(-af.size * 0.8, 0);
        ctx.lineTo(-af.size * 1.3, -af.size * 0.4);
        ctx.lineTo(-af.size * 1.3, af.size * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // 季節・カスタム背景プリセット (ハロウィン 🎃👻 やスタジオカスタムオブジェクト)
    this.renderCustomAmbientPresets(gameState, ambCfg, surge);
  }

  renderCustomAmbientPresets(gameState, ambCfg, surge) {
    if (!ambCfg || ambCfg.enabled === false) return;
    const presets = ambCfg.presets || [];
    const activePresets = presets.filter(p => p.enabled && p.type === 'custom');
    if (activePresets.length === 0) return;

    if (!this.customAmbientMap) this.customAmbientMap = {};
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    for (const p of activePresets) {
      const isSurge = surge?.active && surge.targetPresets?.includes(p.id);
      const mult = isSurge ? (surge.multiplier || 1.0) : 1.0;
      const targetCount = Math.max(1, Math.round((p.count || 5) * mult));

      if (!this.customAmbientMap[p.id]) {
        this.customAmbientMap[p.id] = [];
      }
      const list = this.customAmbientMap[p.id];
      while (list.length < targetCount) {
        list.push({
          x: Math.random() * w,
          y: Math.random() * (h * 0.7) + 50,
          vx: (Math.random() - 0.5) * 0.6 * (p.speed || 1.0),
          vy: -0.2 - Math.random() * 0.4 * (p.speed || 1.0),
          wobble: Math.random() * Math.PI * 2,
          size: p.icon ? 26 : 32
        });
      }

      ctx.save();
      const countToDraw = Math.min(list.length, targetCount);
      for (let i = 0; i < countToDraw; i++) {
        const obj = list[i];
        obj.x += obj.vx;
        obj.y += obj.vy;
        obj.wobble += 0.03;
        const curX = obj.x + Math.sin(obj.wobble) * 8;
        if (obj.y < -30) {
          obj.y = h * 0.75;
          obj.x = Math.random() * w;
        }
        if (obj.x < -40) obj.x = w + 40;
        if (obj.x > w + 40) obj.x = -40;

        ctx.save();
        ctx.globalAlpha = p.opacity || (p.isWhiteTranslucent ? 0.4 : 0.6);

        if (p.studioModel) {
          ctx.translate(curX, obj.y);
          if (p.isWhiteTranslucent) {
            ctx.filter = 'grayscale(100%) brightness(200%) opacity(50%)';
          }
          this.drawFishDetailed(ctx, {
            type: p.studioModel.id || 'custom',
            x: 0,
            y: 0,
            width: 36,
            height: 24,
            finCycle: obj.wobble,
            swimCycle: obj.wobble,
            heading: obj.vx >= 0 ? 1 : -1,
            depth: 0.8,
            isBlinkingAlert: false,
            studioOverride: p.studioModel
          }, 0.5);
        } else {
          ctx.font = `${obj.size}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          if (p.isWhiteTranslucent) {
            ctx.shadowColor = '#ffffff';
            ctx.shadowBlur = 10;
            ctx.filter = 'grayscale(100%) brightness(170%)';
          }
          ctx.fillText(p.icon || '👻', curX, obj.y);
        }
        ctx.restore();
      }
      ctx.restore();
    }
  }

  renderBaits(baits) {
    if (!baits || !baits.length) return;
    const ctx = this.ctx;
    for (const bait of baits) {
      if (bait.isFinished) continue;
      ctx.save();
      ctx.translate(bait.x, bait.y);
      if (bait.alpha !== undefined) {
        ctx.globalAlpha = Math.max(0, Math.min(1, bait.alpha));
      }
      if (bait.targetType === 'karei') {
        // カレイ用: ゴカイ (赤みのある波打つ虫)
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = -10; i <= 10; i += 4) {
          const yOff = Math.sin((Date.now() * 0.01) + i * 0.5) * 4;
          if (i === -10) ctx.moveTo(i, yOff);
          else ctx.lineTo(i, yOff);
        }
        ctx.stroke();
      } else {
        // ヒラメ用: 小魚 (青銀の獲物)
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.ellipse(0, 0, 10, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  renderFish(fish) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(fish.x, fish.y);

    // 餌捕食時の尾浮き斜め下向き姿勢演出 (添付画像4枚目)
    if (fish.tiltAngle) {
      ctx.rotate(fish.tiltAngle);
    }

    const char = this.customCharacters.get(fish.type) || (this.customCharacter && this.customCharacter.id === fish.type ? this.customCharacter : null);

    // 【ユーザー指定の向き・反転仕様】
    // ヒラメ・ウシノシタなどの左向き魚:
    //   左向き(heading === -1) = 正位置 scale(1, 1)
    //   右向き(heading === 1)  = 上下天地反転 scale(-1, -1) (ユーザー指定の仕様)
    // カレイなどの右向き魚:
    //   右向き(heading === 1)  = 正位置 scale(1, 1)
    //   左向き(heading === -1) = 上下天地反転 scale(-1, -1) (ユーザー指定の仕様)
    // その他の生き物（タコ、イカ、エイ、アジの開き、その他）:
    //   進行方向に向くよう水平反転
    const baseFacing = (char && char.facing) ? char.facing : (fish.type === FISH_TYPES.KAREI ? 1 : -1);
    const isFlatfish = (fish.type === FISH_TYPES.HIRAME || fish.type === FISH_TYPES.KAREI || fish.type === FISH_TYPES.SHITABIRAME);

    if (isFlatfish) {
      if (fish.heading === baseFacing) {
        ctx.scale(1, 1);
      } else {
        // 反対向き＝上下逆（天地反転）
        ctx.scale(-1, -1);
      }
    } else {
      if (baseFacing === -1) {
        ctx.scale(fish.heading === -1 ? 1 : -1, 1);
      } else {
        ctx.scale(fish.heading === 1 ? 1 : -1, 1);
      }
    }

    // シルエット演出によるスケール縮小 (1.0 -> 0.7 -> 1.0)
    const silScale = fish.silhouetteScaleFactor !== undefined ? fish.silhouetteScaleFactor : 1.0;
    if (silScale !== 1.0) {
      ctx.scale(silScale, silScale);
    }

    // 水深またはシルエット演出フラグによるシルエット効果
    // fish.isSilhouetteActive または depth > 0.55 でシルエット描画
    const isSilhouette = !!fish.isSilhouetteActive || (fish.depth > 0.55);
    const depthAlpha = fish.isSilhouetteActive ? Math.max(0.35, 0.7 * silScale) : Math.max(0.4, 1.0 - fish.depth * 0.5);

    // 初心者機能：ターゲット逃走2秒前の点滅表示
    if (fish.isBlinkingAlert) {
      const isFlash = Math.floor(Date.now() / 140) % 2 === 0;
      ctx.globalAlpha *= (isFlash ? 1.0 : 0.25);
    }

    if (isSilhouette) {
      // 海底・奥の黒いシルエット（影）
      this.drawFishSilhouette(ctx, fish, depthAlpha);
    } else {
      // 鮮明なカラーとディテール
      this.drawFishDetailed(ctx, fish, depthAlpha);
    }

    ctx.restore();

    // 初心者機能：逃走2秒前の警告パルスリング & 「⚠️ 逃走間近!」表示
    if (fish.isBlinkingAlert) {
      ctx.save();
      ctx.translate(fish.x, fish.y);
      const pulse = (Math.sin(Date.now() * 0.018) + 1) * 0.5;
      ctx.strokeStyle = `rgba(251, 191, 36, ${0.4 + pulse * 0.6})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.ellipse(0, 0, (fish.width * 0.55) + pulse * 6, (fish.height * 0.55) + pulse * 4, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.font = 'bold 12px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fde047';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 6;
      ctx.fillText(t('escapeWarning'), 0, -fish.height * 0.55 - 4);
      ctx.restore();
    }

    // 食事中（2秒停止）のチャンス演出
    if (fish.state === 'eating') {
      ctx.save();
      ctx.translate(fish.x, fish.y - fish.height * 0.75);
      const bounce = Math.sin(Date.now() * 0.015) * 4;
      ctx.font = 'bold 14px "M PLUS Rounded 1c", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      const eatingText = t('eatingChance');
      ctx.strokeText(eatingText, 0, bounce);
      ctx.fillText(eatingText, 0, bounce);
      ctx.restore();
    }
  }

  drawFishSilhouette(ctx, fish, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha * 0.85;

    // キャラクタースタジオ製キャラクター（全ベースプリセットまたはカスタム魚）があればそちらのベクターシルエットを描画
    const customChar = this.customCharacters.get(fish.type) || (this.customCharacter && this.customCharacter.id === fish.type ? this.customCharacter : null);
    if (customChar) {
      this.drawCustomCharacterSilhouette(ctx, fish, customChar);
      ctx.restore();
      return;
    }

    ctx.fillStyle = '#0f172a'; // 深い影の黒藍色
    
    // 影のシェイプを描画
    this.drawFishBodyShape(ctx, fish);
    ctx.fill();

    // 輪郭に少しだけ海底光のハイライト
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  }

  getCharacterNaturalSize(char) {
    return getCharacterNaturalSize(char);
  }

  /** キャラクタースタジオ製ベクターシルエット（深海の影）描画 */
  drawCustomCharacterSilhouette(ctx, fish, char = this.customCharacter) {
    if (!char || !char.parts) return;

    const clip = char.animations?.swim || Object.values(char.animations || {})[0];
    const cycle = (fish.finCycle || fish.swimCycle || 0) % (Math.PI * 2);
    const normTime = Math.max(0, Math.min(1, cycle / (Math.PI * 2)));

    const transforms = resolveRigTransforms(char.parts, clip, normTime);
    const sortedParts = [...char.parts].sort((a, b) => a.zIndex - b.zIndex);

    // キャラクタースタジオ座標系をゲーム内 fish.width / fish.height に等比スケーリング
    // これによりタコなど正方形に近いキャラも縦横比が歪まず正確に描画される
    const nat = getCharacterNaturalSize(char);
    const scale = Math.min(fish.width / nat.width, fish.height / nat.height);

    ctx.save();
    ctx.scale(scale, scale);

    for (const part of sortedParts) {
      // 「塗り」が「なし」の場合はシルエットを透明に、「あり」のときは黒藍影でしっかり表示
      const fill = part.style?.fill || part.fill || 'none';
      const hasFill = fill !== 'none' && fill !== 'transparent' && fill !== '';
      if (!hasFill) continue;

      if (part.type === 'text' || part.text) {
        const t = transforms.get(part.id) || { tx: 0, ty: 0, rot: 0, sx: 1, sy: 1, op: 1 };
        const px = part.pivot?.x || 0;
        const py = part.pivot?.y || 0;
        ctx.save();
        ctx.translate(t.tx || 0, t.ty || 0);
        ctx.translate(px, py);
        ctx.rotate(((t.rot || 0) * Math.PI) / 180);
        ctx.scale(t.sx || 1, t.sy || 1);
        ctx.translate(-px, -py);

        const text = part.text || part.textLabel || '';
        const fontSize = part.fontSize || part.style?.fontSize || 80;
        const fontFamily = part.fontFamily || part.style?.fontFamily || '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';
        ctx.font = `bold ${fontSize}px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#0f172a';
        ctx.fillText(text, 0, 0);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
        ctx.lineWidth = 1.5;
        ctx.strokeText(text, 0, 0);
        ctx.restore();
        continue;
      }

      if (!part.points || part.points.length < 2) continue;

      const t = transforms.get(part.id) || { tx: 0, ty: 0, rot: 0, sx: 1, sy: 1, op: 1 };
      const px = part.pivot?.x || 0;
      const py = part.pivot?.y || 0;

      ctx.save();
      ctx.translate(t.tx || 0, t.ty || 0);
      ctx.translate(px, py);
      ctx.rotate(((t.rot || 0) * Math.PI) / 180);
      ctx.scale(t.sx || 1, t.sy || 1);
      ctx.translate(-px, -py);

      const d = pointsToSvgPath(part.points, part.closed);
      const p2d = new Path2D(d);

      // 深い海底の黒影
      ctx.fillStyle = '#0f172a';
      ctx.fill(p2d);

      // 輪郭に淡い海底光のリムライト
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.stroke(p2d);

      ctx.restore();
    }

    ctx.restore();
  }

  drawFishDetailed(ctx, fish, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;

    // キャラクタースタジオで作成されたカスタムベクターキャラクター（魚種上書きまたは個別カスタム）があれば優先描画
    const customChar = this.customCharacters.get(fish.type) || (this.customCharacter && this.customCharacter.id === fish.type ? this.customCharacter : null);
    if (customChar) {
      this.drawCustomCharacter(ctx, fish, customChar);
      ctx.restore();
      return;
    }

    switch (fish.type) {
      case FISH_TYPES.HIRAME:
        this.drawHirameDetailed(ctx, fish);
        break;
      case FISH_TYPES.KAREI:
        this.drawKareiDetailed(ctx, fish);
        break;
      case FISH_TYPES.OCTOPUS:
        this.drawOctopusDetailed(ctx, fish);
        break;
      case FISH_TYPES.SQUID:
        this.drawSquidDetailed(ctx, fish);
        break;
      case FISH_TYPES.STINGRAY:
        this.drawStingrayDetailed(ctx, fish);
        break;
      case FISH_TYPES.AJI_OPEN:
        this.drawAjiOpenDetailed(ctx, fish);
        break;
      case FISH_TYPES.SHITABIRAME:
        this.drawShitabirameDetailed(ctx, fish);
        break;
    }

    ctx.restore();
  }

  /** キャラクタースタジオ製ベクターリグ＆アニメーション描画 */
  drawCustomCharacter(ctx, fish, char = this.customCharacter) {
    if (!char || !char.parts) return;

    const clip = char.animations?.swim || Object.values(char.animations || {})[0];
    const cycle = (fish.finCycle || fish.swimCycle || 0) % (Math.PI * 2);
    const normTime = Math.max(0, Math.min(1, cycle / (Math.PI * 2)));

    const transforms = resolveRigTransforms(char.parts, clip, normTime);
    const sortedParts = [...char.parts].sort((a, b) => a.zIndex - b.zIndex);

    // キャラクタースタジオ座標系をゲーム内 fish.width / fish.height に等比スケーリング
    // これによりタコなど正方形に近いキャラも縦横比が歪まず正確に描画される
    const nat = getCharacterNaturalSize(char);
    const scale = Math.min(fish.width / nat.width, fish.height / nat.height);

    ctx.save();
    ctx.scale(scale, scale);

    for (const part of sortedParts) {
      if (!part.visible) continue;
      const t = transforms.get(part.id) || { tx: 0, ty: 0, rot: 0, sx: 1, sy: 1, op: 1 };
      const px = part.pivot?.x || 0;
      const py = part.pivot?.y || 0;

      ctx.save();
      ctx.translate(t.tx || 0, t.ty || 0);
      ctx.translate(px, py);
      ctx.rotate(((t.rot || 0) * Math.PI) / 180);
      ctx.scale(t.sx || 1, t.sy || 1);
      ctx.translate(-px, -py);
      if (part.type === 'text' || part.text) {
        const text = part.text || part.textLabel || '';
        const fontSize = part.fontSize || part.style?.fontSize || 80;
        const fontFamily = part.fontFamily || part.style?.fontFamily || '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';
        const fill = part.style?.fill || '#ffffff';
        const stroke = part.style?.stroke;
        const strokeWidth = part.style?.strokeWidth || 0;

        ctx.font = `bold ${fontSize}px ${fontFamily}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (stroke && stroke !== 'none' && strokeWidth > 0) {
          ctx.strokeStyle = stroke;
          ctx.lineWidth = strokeWidth * 2;
          ctx.lineJoin = 'round';
          ctx.strokeText(text, 0, 0);
        }
        if (fill && fill !== 'none') {
          ctx.fillStyle = fill;
          ctx.fillText(text, 0, 0);
        }
      } else if (part.points && part.points.length >= 2) {
        const d = pointsToSvgPath(part.points, part.closed);
        const p2d = new Path2D(d);

        const fill = part.style.fill;
        const stroke = part.style.stroke;
        const strokeWidth = part.style.strokeWidth || 0;
        const strokePos = part.style.strokePosition || 'center';

        if (fill && fill !== 'none') {
          ctx.fillStyle = fill;
          ctx.fill(p2d);
        }

        if (stroke && stroke !== 'none' && strokeWidth > 0) {
          ctx.strokeStyle = stroke;
          if (strokePos === 'inside') {
            ctx.save();
            ctx.clip(p2d);
            ctx.lineWidth = strokeWidth * 2;
            ctx.stroke(p2d);
            ctx.restore();
          } else if (strokePos === 'outside') {
            ctx.save();
            ctx.lineWidth = strokeWidth * 2;
            ctx.stroke(p2d);
            if (fill && fill !== 'none') {
              ctx.fillStyle = fill;
              ctx.fill(p2d);
            }
            ctx.restore();
          } else {
            ctx.lineWidth = strokeWidth;
            ctx.stroke(p2d);
          }
        }
      }

      // サブパス (斑点・牙など)
      if (part.subPaths && part.subPaths.length > 0) {
        for (const sub of part.subPaths) {
          if (sub.type === 'circle') {
            ctx.beginPath();
            ctx.arc(sub.cx, sub.cy, sub.r, 0, Math.PI * 2);
            ctx.fillStyle = sub.fill;
            ctx.fill();
            if (sub.stroke && sub.stroke !== 'none') {
              ctx.strokeStyle = sub.stroke;
              ctx.lineWidth = sub.strokeWidth || 1;
              ctx.stroke();
            }
          } else if (sub.type === 'polygon' && sub.points) {
            ctx.beginPath();
            sub.points.forEach((pt, idx) => {
              if (idx === 0) ctx.moveTo(pt.x, pt.y);
              else ctx.lineTo(pt.x, pt.y);
            });
            ctx.closePath();
            ctx.fillStyle = sub.fill;
            ctx.fill();
            if (sub.stroke && sub.stroke !== 'none') {
              ctx.strokeStyle = sub.stroke;
              ctx.lineWidth = sub.strokeWidth || 1;
              ctx.stroke();
            }
          }
        }
      }

      ctx.restore();
    }

    ctx.restore();
  }

  drawFishBodyShape(ctx, fish) {
    const w = fish.width * 0.55;
    const h = fish.height * 0.55;
    const finWiggle = Math.sin(fish.finCycle) * 3;

    if (fish.type === FISH_TYPES.HIRAME) {
      // ヒラメのシルエット（頭が左・大きな受け口）
      ctx.beginPath();
      ctx.moveTo(-w * 0.7, -h * 0.2);
      ctx.lineTo(-w * 0.95, -h * 0.05); // 上顎
      ctx.lineTo(-w * 0.8, h * 0.1);    // 口の奥
      ctx.lineTo(-w * 1.05, h * 0.25);  // 突き出た下顎（大口受け口）
      ctx.lineTo(-w * 0.5, h * 0.6);
      ctx.lineTo(w * 0.2, h * 0.5);
      ctx.lineTo(w * 0.8, h * 0.1);
      // 尾びれ
      ctx.lineTo(w * 1.35, h * 0.6 + finWiggle);
      ctx.lineTo(w * 1.15, 0);
      ctx.lineTo(w * 1.35, -h * 0.6 + finWiggle);
      ctx.lineTo(w * 0.8, -h * 0.1);
      ctx.lineTo(w * 0.2, -h * 0.55);
      ctx.lineTo(-w * 0.5, -h * 0.55);
      ctx.closePath();
    } else if (fish.type === FISH_TYPES.KAREI) {
      // カレイのシルエット（添付画像２枚目: 右向き・キャメル色平魚・扇尾）
      ctx.beginPath();
      ctx.moveTo(w * 0.95, 0); // 嘴状の口先
      ctx.lineTo(w * 0.65, -h * 0.45);
      ctx.lineTo(0, -h * 0.85); // アーチ背ビレ
      ctx.lineTo(-w * 0.65, -h * 0.3);
      // 尾びれ
      ctx.lineTo(-w * 1.25, -h * 0.5 + finWiggle);
      ctx.lineTo(-w * 1.25, h * 0.5 + finWiggle);
      ctx.lineTo(-w * 0.65, h * 0.3);
      ctx.lineTo(0, h * 0.85); // 腹ビレ
      ctx.lineTo(w * 0.65, h * 0.4);
      ctx.closePath();
    } else if (fish.type === FISH_TYPES.SQUID) {
      // イカのシルエット（添付画像１枚目: 釣鐘型マントル＋外側跳ね触手＋垂れ足）
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.95);
      ctx.bezierCurveTo(w * 0.65, -h * 0.7, w * 0.75, -h * 0.1, w * 0.65, h * 0.05);
      ctx.lineTo(w * 0.38, h * 0.1);
      ctx.lineTo(w * 0.38, h * 0.5);
      ctx.lineTo(-w * 0.38, h * 0.5);
      ctx.lineTo(-w * 0.38, h * 0.1);
      ctx.lineTo(-w * 0.65, h * 0.05);
      ctx.bezierCurveTo(-w * 0.75, -h * 0.1, -w * 0.65, -h * 0.7, 0, -h * 0.95);
      ctx.closePath();
    } else if (fish.type === FISH_TYPES.OCTOPUS) {
      // タコ（添付画像２枚目: まん丸大頭＋跳ねる外側足＋下垂足）
      ctx.beginPath();
      ctx.arc(0, -h * 0.25, w * 0.62, 0, Math.PI * 2);
      ctx.fill();
      // 外側触手
      ctx.beginPath();
      ctx.moveTo(-w * 0.38, h * 0.12);
      ctx.bezierCurveTo(-w * 0.75, h * 0.05, -w * 0.95, -h * 0.1, -w * 0.9, -h * 0.18);
      ctx.bezierCurveTo(-w * 0.82, -h * 0.22, -w * 0.65, -h * 0.02, -w * 0.42, h * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(w * 0.38, h * 0.12);
      ctx.bezierCurveTo(w * 0.75, h * 0.05, w * 0.95, -h * 0.1, w * 0.9, -h * 0.18);
      ctx.bezierCurveTo(w * 0.82, -h * 0.22, w * 0.65, -h * 0.02, w * 0.42, h * 0.25);
      ctx.closePath();
      ctx.fill();
      // 下垂触手群
      for (let i = -2; i <= 2; i++) {
        const tx = i * (w * 0.16);
        ctx.beginPath();
        ctx.arc(tx, h * 0.6, w * 0.1, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (fish.type === FISH_TYPES.AJI_OPEN) {
      // アジの開き（添付画像１枚目: 開き身＋頭部＋二股尾）
      ctx.beginPath();
      ctx.moveTo(-w * 0.95, -h * 0.05);
      ctx.lineTo(-w * 0.5, -h * 0.8);
      ctx.lineTo(w * 0.6, -h * 0.4);
      ctx.lineTo(w * 1.25, -h * 0.45);
      ctx.lineTo(w * 1.05, 0);
      ctx.lineTo(w * 1.25, h * 0.45);
      ctx.lineTo(w * 0.6, h * 0.5);
      ctx.lineTo(-w * 0.45, h * 0.88);
      ctx.lineTo(-w * 0.75, h * 0.22);
      ctx.closePath();
    } else if (fish.type === FISH_TYPES.SHITABIRAME) {
      // ウシノシタ（添付画像３枚目: 鉤鼻＋靴底柳葉型＋細長尾）
      ctx.beginPath();
      ctx.moveTo(-w * 0.95, 0);
      ctx.bezierCurveTo(-w * 0.6, -h * 0.75, w * 0.3, -h * 0.55, w * 1.08, 0);
      ctx.bezierCurveTo(w * 0.3, h * 0.55, -w * 0.5, h * 0.75, -w * 0.95, 0);
      ctx.closePath();
    } else {
      ctx.beginPath();
      ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
    }
  }

  // --- ヒラメ（添付画像３枚目準拠: 左向き・マスタード黄金色・黄色斑点・白い境界線・黒ヒレ条・ピンクのほっぺ・開いた口） ---
  drawHirameDetailed(ctx, fish) {
    const w = fish.width * 0.58;
    const h = fish.height * 0.52;
    const finWiggle = Math.sin(fish.finCycle) * 2.8;

    ctx.save();

    // 1. 背ビレ & 腹ビレ (黄金色ベース ＋ くっきりとした黒のヒレ条)
    ctx.fillStyle = '#eab308';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;

    // 背ビレ (頭上から尾までアーチ状に広がる)
    ctx.beginPath();
    ctx.moveTo(-w * 0.55, -h * 0.4);
    ctx.quadraticCurveTo(-w * 0.1, -h * 1.15, w * 0.72, -h * 0.2);
    ctx.lineTo(w * 0.65, -h * 0.15);
    ctx.quadraticCurveTo(-w * 0.1, -h * 0.7, -w * 0.55, -h * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 背ビレの黒いヒレ条
    ctx.lineWidth = 2.2;
    for (let x = -w * 0.45; x <= w * 0.62; x += w * 0.1) {
      const topY = -h * 0.5 - (1 - Math.abs((x - w * 0.05) / (w * 0.65))) * h * 0.62;
      const baseY = -h * 0.35 - (1 - Math.abs((x - w * 0.05) / (w * 0.65))) * h * 0.35;
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.lineTo(x, topY);
      ctx.stroke();
    }

    // 腹ビレ (下側)
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-w * 0.35, h * 0.45);
    ctx.quadraticCurveTo(-w * 0.05, h * 1.15, w * 0.72, h * 0.2);
    ctx.lineTo(w * 0.65, h * 0.15);
    ctx.quadraticCurveTo(-w * 0.05, h * 0.7, -w * 0.35, h * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 腹ビレの黒いヒレ条
    ctx.lineWidth = 2.2;
    for (let x = -w * 0.28; x <= w * 0.62; x += w * 0.11) {
      const botY = h * 0.5 + (1 - Math.abs((x - w * 0.1) / (w * 0.65))) * h * 0.62;
      const baseY = h * 0.35 + (1 - Math.abs((x - w * 0.1) / (w * 0.65))) * h * 0.35;
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.lineTo(x, botY);
      ctx.stroke();
    }

    // 2. 尾びれ (右側・扇形 ＋ 黒ヒレ条 ＋ 外縁白アクセント)
    ctx.fillStyle = '#eab308';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(w * 0.68, -h * 0.12);
    ctx.lineTo(w * 1.3, -h * 0.55 + finWiggle);
    ctx.quadraticCurveTo(w * 1.38, finWiggle, w * 1.3, h * 0.55 + finWiggle);
    ctx.lineTo(w * 0.68, h * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 尾の白い外縁ハイライト
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(w * 1.28, -h * 0.5 + finWiggle);
    ctx.quadraticCurveTo(w * 1.36, finWiggle, w * 1.28, h * 0.5 + finWiggle);
    ctx.stroke();

    // 尾の黒ヒレ条
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    for (let r = -0.4; r <= 0.4; r += 0.16) {
      ctx.beginPath();
      ctx.moveTo(w * 0.75, r * h * 0.3);
      ctx.lineTo(w * 1.26, r * h * 1.15 + finWiggle);
      ctx.stroke();
    }

    // 3. 体幹とヒレを分ける★白い境界線 (添付画像３枚目の特徴！)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    // 背側白ストライプ
    ctx.moveTo(-w * 0.55, -h * 0.35);
    ctx.quadraticCurveTo(-w * 0.05, -h * 0.76, w * 0.68, -h * 0.15);
    ctx.stroke();
    // 腹側白ストライプ
    ctx.beginPath();
    ctx.moveTo(-w * 0.35, h * 0.38);
    ctx.quadraticCurveTo(-w * 0.05, h * 0.76, w * 0.68, h * 0.15);
    ctx.stroke();

    // 4. 体幹（リッチな黄金マスタードイエロー）
    ctx.fillStyle = '#bfa33a';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.5;

    ctx.beginPath();
    // 頭部（左端）: 開いた口と突き出た上下の唇
    ctx.moveTo(-w * 0.55, -h * 0.38);
    ctx.lineTo(-w * 0.8, -h * 0.22);
    ctx.lineTo(-w * 1.0, -h * 0.12); // 上唇の先端
    ctx.lineTo(-w * 0.82, -h * 0.02); // 口の切れ込み奥
    ctx.lineTo(-w * 0.95, h * 0.1);  // 下唇の先端
    ctx.lineTo(-w * 0.65, h * 0.4);  // エラ下顎
    ctx.lineTo(w * 0.15, h * 0.62);
    ctx.lineTo(w * 0.7, h * 0.15);   // 尾の付け根
    ctx.lineTo(w * 0.7, -h * 0.15);
    ctx.lineTo(w * 0.15, -h * 0.62);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 口の開き（赤茶色の口腔）
    ctx.fillStyle = '#7f1d1d';
    ctx.beginPath();
    ctx.moveTo(-w * 0.96, -h * 0.1);
    ctx.lineTo(-w * 0.82, -h * 0.02);
    ctx.lineTo(-w * 0.92, h * 0.08);
    ctx.closePath();
    ctx.fill();

    // 5. 明るい黄色の斑点ドット（添付画像３枚目の美しいスポット）
    ctx.fillStyle = '#fef08a';
    const hirameDots = [
      [-w * 0.35, -h * 0.15], [-w * 0.2, -h * 0.3], [-w * 0.02, -h * 0.38], [w * 0.2, -h * 0.28], [w * 0.45, -h * 0.12],
      [-w * 0.32, h * 0.15], [-w * 0.15, h * 0.3], [w * 0.05, h * 0.38], [w * 0.28, h * 0.28], [w * 0.48, h * 0.08],
      [-w * 0.18, 0], [w * 0.05, 0], [w * 0.25, -h * 0.05], [-w * 0.38, 0]
    ];
    for (const [dx, dy] of hirameDots) {
      ctx.beginPath();
      ctx.arc(dx, dy, w * 0.045, 0, Math.PI * 2);
      ctx.fill();
    }

    // 6. 中央の側線 (茶黒の細線)
    ctx.strokeStyle = '#422006';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-w * 0.2, h * 0.05);
    ctx.lineTo(w * 0.66, 0);
    ctx.stroke();

    // 7. エラ蓋ライン
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(-w * 0.45, h * 0.05, h * 0.32, -Math.PI * 0.35, Math.PI * 0.45);
    ctx.stroke();

    // 8. ★可愛いピンクのほっぺ (添付画像３枚目の特徴的なチーク！)
    ctx.fillStyle = '#f472b6';
    ctx.beginPath();
    ctx.ellipse(-w * 0.58, h * 0.05, w * 0.09, h * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();

    // 9. 胸ビレ & 腹ビレ (扇形・黒ヒレ条)
    ctx.fillStyle = '#eab308';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-w * 0.32, h * 0.02);
    ctx.lineTo(-w * 0.15, -h * 0.08);
    ctx.lineTo(-w * 0.12, h * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-w * 0.5, h * 0.38);
    ctx.lineTo(-w * 0.4, h * 0.65);
    ctx.lineTo(-w * 0.35, h * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 10. 左側上部に飛び出た大きな2つの目（白目＋黒瞳＋白ハイライト）
    const eye1X = -w * 0.72;
    const eye1Y = -h * 0.22;
    const eye2X = -w * 0.58;
    const eye2Y = -h * 0.36;

    // 目 1 (下側)
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(eye1X, eye1Y, w * 0.085, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // 黒瞳 1
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(eye1X - 1.5, eye1Y, w * 0.05, 0, Math.PI * 2);
    ctx.fill();
    // ハイライト 1
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(eye1X - 2.5, eye1Y - 1.5, w * 0.02, 0, Math.PI * 2);
    ctx.fill();

    // 目 2 (上側・背に飛び出ている)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(eye2X, eye2Y, w * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // 黒瞳 2
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(eye2X - 1.5, eye2Y, w * 0.048, 0, Math.PI * 2);
    ctx.fill();
    // ハイライト 2
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(eye2X - 2.5, eye2Y - 1.5, w * 0.02, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // --- カレイ（添付画像２枚目準拠: 右向き・キャメル色・白水玉・黒ヒレ条・扇尾・開いた嘴口・飛び出たとぼけ目） ---
  drawKareiDetailed(ctx, fish) {
    const w = fish.width * 0.58;
    const h = fish.height * 0.52;
    const finWiggle = Math.sin(fish.finCycle) * 2.5;

    ctx.save();

    // 1. 扇形の尾びれ (左端・キャメル地＋黒ヒレ条＋太い黒縁)
    ctx.fillStyle = '#caa062';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-w * 0.65, -h * 0.15);
    ctx.lineTo(-w * 1.25, -h * 0.48 + finWiggle);
    ctx.quadraticCurveTo(-w * 1.35, finWiggle, -w * 1.25, h * 0.48 + finWiggle);
    ctx.lineTo(-w * 0.65, h * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 尾びれの黒いヒレ条（放射状）
    ctx.lineWidth = 2.4;
    for (let r = -0.38; r <= 0.38; r += 0.12) {
      ctx.beginPath();
      ctx.moveTo(-w * 0.7, r * h * 0.3);
      ctx.lineTo(-w * 1.25, r * h * 1.15 + finWiggle);
      ctx.stroke();
    }

    // 2. 背ビレ (上側アーチ・キャメル色＋直線的な黒ヒレ条)
    ctx.fillStyle = '#caa062';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(w * 0.55, -h * 0.38);
    ctx.quadraticCurveTo(0, -h * 1.15, -w * 0.68, -h * 0.22);
    ctx.lineTo(-w * 0.62, -h * 0.12);
    ctx.quadraticCurveTo(0, -h * 0.75, w * 0.55, -h * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 背ビレの黒ヒレ条
    ctx.lineWidth = 2.4;
    for (let x = -w * 0.6; x <= w * 0.48; x += w * 0.1) {
      const arch = Math.sin(((x + w * 0.6) / (w * 1.08)) * Math.PI);
      const topY = -h * 0.35 - arch * h * 0.75;
      const baseY = -h * 0.18 - arch * h * 0.52;
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.lineTo(x, topY);
      ctx.stroke();
    }

    // 3. 腹ビレ (下側アーチ・キャメル色＋直線的な黒ヒレ条)
    ctx.beginPath();
    ctx.moveTo(-w * 0.68, h * 0.22);
    ctx.quadraticCurveTo(0, h * 1.12, w * 0.45, h * 0.42);
    ctx.lineTo(w * 0.45, h * 0.28);
    ctx.quadraticCurveTo(0, h * 0.72, -w * 0.62, h * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 腹ビレの黒ヒレ条
    for (let x = -w * 0.6; x <= w * 0.38; x += w * 0.11) {
      const arch = Math.sin(((x + w * 0.6) / (w * 0.98)) * Math.PI);
      const bottomY = h * 0.32 + arch * h * 0.75;
      const baseY = h * 0.18 + arch * h * 0.5;
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.lineTo(x, bottomY);
      ctx.stroke();
    }

    // 4. カレイ本体（キャメル黄褐色・太い黒輪郭）
    ctx.fillStyle = '#c89b5c';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    // 嘴状の開いた口先（右端）
    ctx.moveTo(w * 0.95, -h * 0.08); // 上嘴
    ctx.lineTo(w * 0.78, 0);          // 口の奥
    ctx.lineTo(w * 0.92, h * 0.18);  // 下嘴
    ctx.quadraticCurveTo(w * 0.65, h * 0.45, 0, h * 0.65); // 腹部
    ctx.lineTo(-w * 0.65, h * 0.15); // 尾柄下
    ctx.lineTo(-w * 0.65, -h * 0.15);// 尾柄上
    ctx.quadraticCurveTo(0, -h * 0.72, w * 0.65, -h * 0.45); // 背部
    ctx.quadraticCurveTo(w * 0.78, -h * 0.32, w * 0.95, -h * 0.08);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 5. 白いポルカドット模様（添付画像２枚目の丸い水玉群）
    ctx.fillStyle = '#ede0cc';
    const kareiDots = [
      [-w * 0.45, 0], [-w * 0.3, -h * 0.25], [-w * 0.12, -h * 0.35], [w * 0.1, -h * 0.38], [w * 0.4, -h * 0.28],
      [-w * 0.32, h * 0.22], [-w * 0.1, h * 0.35], [w * 0.15, h * 0.32], [w * 0.42, h * 0.18],
      [-w * 0.2, 0], [w * 0.02, 0], [w * 0.25, -h * 0.05], [-w * 0.05, -h * 0.18], [w * 0.18, h * 0.15],
      [w * 0.35, -h * 0.05], [-w * 0.38, -h * 0.1], [-w * 0.18, h * 0.18]
    ];
    for (const [dx, dy] of kareiDots) {
      ctx.beginPath();
      ctx.arc(dx, dy, w * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }

    // 6. エラ蓋の黒ライン
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(w * 0.48, h * 0.02, h * 0.36, Math.PI * 0.65, Math.PI * 1.35);
    ctx.stroke();

    // 7. 胸ビレ & 腹側小ビレ
    ctx.fillStyle = '#caa062';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w * 0.25, h * 0.05);
    ctx.lineTo(w * 0.45, -h * 0.05);
    ctx.lineTo(w * 0.48, h * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // 胸ビレの筋
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w * 0.28, h * 0.05);
    ctx.lineTo(w * 0.44, h * 0.05);
    ctx.moveTo(w * 0.28, h * 0.08);
    ctx.lineTo(w * 0.45, h * 0.12);
    ctx.stroke();

    // 腹側の小ビレ
    ctx.beginPath();
    ctx.moveTo(w * 0.62, h * 0.25);
    ctx.lineTo(w * 0.68, h * 0.45);
    ctx.lineTo(w * 0.58, h * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 8. ２つのとぼけた大きな飛び出し目（ヒラメと同デザイン・右向き対称）
    const eye1X = w * 0.72;
    const eye1Y = -h * 0.22;
    const eye2X = w * 0.58;
    const eye2Y = -h * 0.36;

    // 目 1 (下側・手前)
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(eye1X, eye1Y, w * 0.085, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // 黒瞳 1 (右を見る)
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(eye1X + 1.5, eye1Y, w * 0.05, 0, Math.PI * 2);
    ctx.fill();
    // ハイライト 1
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(eye1X + 2.5, eye1Y - 1.5, w * 0.02, 0, Math.PI * 2);
    ctx.fill();

    // 目 2 (上側・背に飛び出ている)
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(eye2X, eye2Y, w * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // 黒瞳 2 (右を見る)
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(eye2X + 1.2, eye2Y, w * 0.045, 0, Math.PI * 2);
    ctx.fill();
    // ハイライト 2
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(eye2X + 2.2, eye2Y - 1.5, w * 0.018, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // --- タコ（添付画像２枚目: まん丸大頭・おちょぼ口・8本足＋吸盤の可愛いマスコット） ---
  drawOctopusDetailed(ctx, fish) {
    const w = fish.width * 0.5;
    const h = fish.height * 0.5;
    const finWiggle = Math.sin(fish.finCycle) * 3.5;

    ctx.save();

    // 1. 8本の足 (2本は左右に跳ね上がり、6本は下に垂れる)
    ctx.fillStyle = '#dc2626';
    ctx.strokeStyle = '#b91c1c';
    ctx.lineWidth = 1.5;

    // 左外側の跳ねる足 (ウェーブ)
    ctx.beginPath();
    ctx.moveTo(-w * 0.35, h * 0.1);
    ctx.bezierCurveTo(-w * 0.7, h * 0.05, -w * 1.0, -h * 0.05 + finWiggle, -w * 0.88, -h * 0.18 + finWiggle);
    ctx.bezierCurveTo(-w * 0.78, -h * 0.22 + finWiggle, -w * 0.55, -h * 0.02, -w * 0.25, h * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 右外側の跳ねる足 (ウェーブ)
    ctx.beginPath();
    ctx.moveTo(w * 0.35, h * 0.1);
    ctx.bezierCurveTo(w * 0.7, h * 0.05, w * 1.0, -h * 0.05 - finWiggle, w * 0.88, -h * 0.18 - finWiggle);
    ctx.bezierCurveTo(w * 0.78, -h * 0.22 - finWiggle, w * 0.55, -h * 0.02, w * 0.25, h * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 外側足の吸盤 (温かみのあるオレンジ色の円)
    ctx.fillStyle = '#f97316';
    const leftSuction = [
      { x: -w * 0.82, y: -h * 0.12 + finWiggle, r: w * 0.05 },
      { x: -w * 0.65, y: -h * 0.02 + finWiggle * 0.6, r: w * 0.055 },
      { x: -w * 0.46, y: h * 0.1 + finWiggle * 0.3, r: w * 0.06 }
    ];
    for (const s of leftSuction) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    const rightSuction = [
      { x: w * 0.82, y: -h * 0.12 - finWiggle, r: w * 0.05 },
      { x: w * 0.65, y: -h * 0.02 - finWiggle * 0.6, r: w * 0.055 },
      { x: w * 0.46, y: h * 0.1 - finWiggle * 0.3, r: w * 0.06 }
    ];
    for (const s of rightSuction) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 中央6本の下垂足
    const tentacleAngles = [-0.5, -0.3, -0.1, 0.1, 0.3, 0.5];
    ctx.fillStyle = '#dc2626';
    for (let i = 0; i < 6; i++) {
      const angle = tentacleAngles[i];
      const bx = angle * w * 1.0;
      const wave = Math.sin(fish.finCycle + i * 0.8) * 3;
      const tipX = bx + angle * w * 0.3 + wave;
      const tipY = h * 0.68 + Math.abs(angle) * h * 0.15;
      const legWidth = w * 0.07;

      ctx.beginPath();
      ctx.moveTo(bx - legWidth, h * 0.2);
      ctx.quadraticCurveTo(bx - legWidth * 0.6, h * 0.45, tipX - legWidth * 0.8, tipY);
      ctx.arc(tipX, tipY, legWidth * 0.8, Math.PI, 0, true);
      ctx.quadraticCurveTo(bx + legWidth * 0.6, h * 0.45, bx + legWidth, h * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 各足の吸盤 (2つずつ)
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(bx + (tipX - bx) * 0.45, h * 0.38, w * 0.048, 0, Math.PI * 2);
      ctx.arc(tipX, tipY - h * 0.08, w * 0.044, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#dc2626';
    }

    // 2. まん丸の大きな赤い頭部 (添付画像準拠の赤丸ドーム)
    const headRadius = w * 0.58;
    const headCenterY = -h * 0.18;
    ctx.fillStyle = '#ea1d2d';
    ctx.beginPath();
    ctx.arc(0, headCenterY, headRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b91c1c';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 3. 2つのまん丸な黒目 (離れ気味・つぶらな瞳)
    const eyeOffsetX = w * 0.26;
    const eyeY = headCenterY + h * 0.12;
    const eyeRadius = w * 0.085;
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(-eyeOffsetX, eyeY, eyeRadius, 0, Math.PI * 2);
    ctx.arc(eyeOffsetX, eyeY, eyeRadius, 0, Math.PI * 2);
    ctx.fill();

    // 4. 薄く優しい眉毛 (目の上にほんのりカーブ)
    ctx.strokeStyle = '#991b1b';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    // 左眉
    ctx.arc(-eyeOffsetX, eyeY - h * 0.2, w * 0.09, -Math.PI * 0.75, -Math.PI * 0.25);
    ctx.stroke();
    ctx.beginPath();
    // 右眉
    ctx.arc(eyeOffsetX, eyeY - h * 0.2, w * 0.09, -Math.PI * 0.75, -Math.PI * 0.25);
    ctx.stroke();

    // 5. おちょぼ口 (中央のオレンジ丸リップ＋ダークな穴)
    const mouthY = headCenterY + h * 0.32;
    // オレンジの外唇リング
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.ellipse(0, mouthY, w * 0.14, h * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    // 暗赤色の口の穴
    ctx.fillStyle = '#7f1d1d';
    ctx.beginPath();
    ctx.ellipse(0, mouthY, w * 0.08, h * 0.095, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // --- イカ（添付画像１枚目準拠: パステルクリームイエロー・ベル型マントル・10本足・跳ね触手・つぶらな瞳） ---
  drawSquidDetailed(ctx, fish) {
    const w = fish.width * 0.52;
    const h = fish.height * 0.52;
    const finWiggle = Math.sin(fish.finCycle) * 3;

    ctx.save();

    const squidColor = '#fef08a';
    const squidOutline = '#221814';

    // 1. 外側2本の長い跳ね触手（上に向かってウェーブしながらスプーン状に広がる）
    ctx.fillStyle = squidColor;
    ctx.strokeStyle = squidOutline;
    ctx.lineWidth = 3.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // 左の跳ね触手
    ctx.beginPath();
    ctx.moveTo(-w * 0.35, h * 0.42);
    ctx.bezierCurveTo(-w * 0.75, h * 0.48, -w * 0.98, h * 0.25 - finWiggle, -w * 0.92, -h * 0.05 - finWiggle);
    ctx.bezierCurveTo(-w * 0.88, -h * 0.18 - finWiggle, -w * 0.72, -h * 0.08 - finWiggle, -w * 0.78, h * 0.12 - finWiggle);
    ctx.bezierCurveTo(-w * 0.78, h * 0.28, -w * 0.55, h * 0.35, -w * 0.3, h * 0.46);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 右の跳ね触手
    ctx.beginPath();
    ctx.moveTo(w * 0.35, h * 0.42);
    ctx.bezierCurveTo(w * 0.75, h * 0.48, w * 0.98, h * 0.25 + finWiggle, w * 0.92, -h * 0.05 + finWiggle);
    ctx.bezierCurveTo(w * 0.88, -h * 0.18 + finWiggle, w * 0.72, -h * 0.08 + finWiggle, w * 0.78, h * 0.12 + finWiggle);
    ctx.bezierCurveTo(w * 0.78, h * 0.28, w * 0.55, h * 0.35, w * 0.3, h * 0.46);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 2. 中央8本の下垂触手（襟下から等間隔に垂れ下がる）
    const innerLegPositions = [-0.35, -0.25, -0.15, -0.05, 0.05, 0.15, 0.25, 0.35];
    const legLengths = [h * 0.42, h * 0.52, h * 0.6, h * 0.64, h * 0.64, h * 0.6, h * 0.52, h * 0.42];

    for (let i = 0; i < innerLegPositions.length; i++) {
      const px = innerLegPositions[i] * w * 0.95;
      const legLen = legLengths[i];
      const legWave = Math.sin(fish.finCycle + i * 0.7) * 2.2;
      const legW = w * 0.065;

      ctx.beginPath();
      ctx.moveTo(px - legW, h * 0.42);
      ctx.quadraticCurveTo(px - legW + legWave * 0.5, h * 0.42 + legLen * 0.6, px - legW * 0.9 + legWave, h * 0.42 + legLen);
      ctx.arc(px + legWave, h * 0.42 + legLen, legW * 0.9, Math.PI, 0, true);
      ctx.quadraticCurveTo(px + legW + legWave * 0.5, h * 0.42 + legLen * 0.6, px + legW, h * 0.42);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // 3. マントル（釣鐘型・膨らんだ頬・くびれた首襟）
    ctx.fillStyle = squidColor;
    ctx.lineWidth = 3.8;
    ctx.beginPath();
    // 襟の左下
    ctx.moveTo(-w * 0.36, h * 0.46);
    // 襟の底
    ctx.lineTo(w * 0.36, h * 0.46);
    // 襟の右辺
    ctx.lineTo(w * 0.36, h * 0.02);
    // 右側の頬（横に膨らむ）
    ctx.lineTo(w * 0.62, h * 0.02);
    ctx.quadraticCurveTo(w * 0.68, -h * 0.2, w * 0.5, -h * 0.55);
    // 頭頂ドーム
    ctx.quadraticCurveTo(w * 0.28, -h * 0.95, 0, -h * 0.98);
    ctx.quadraticCurveTo(-w * 0.28, -h * 0.95, -w * 0.5, -h * 0.55);
    // 左側の頬
    ctx.quadraticCurveTo(-w * 0.68, -h * 0.2, -w * 0.62, h * 0.02);
    // 襟の左辺
    ctx.lineTo(-w * 0.36, h * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 4. つぶらな黒い縦長の目（添付画像１枚目の特徴的な瞳）
    ctx.fillStyle = squidOutline;
    const eyeDist = w * 0.18;
    const eyeY = h * 0.28;
    const eyeRadiusX = w * 0.035;
    const eyeRadiusY = h * 0.065;

    // 左目
    ctx.beginPath();
    ctx.ellipse(-eyeDist, eyeY, eyeRadiusX, eyeRadiusY, 0, 0, Math.PI * 2);
    ctx.fill();

    // 右目
    ctx.beginPath();
    ctx.ellipse(eyeDist, eyeY, eyeRadiusX, eyeRadiusY, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // --- エイ（巨大影） ---
  drawStingrayDetailed(ctx, fish) {
    const w = fish.width * 0.5;
    const h = fish.height * 0.5;
    ctx.fillStyle = '#334155';
    // 菱形ヒレ
    ctx.beginPath();
    ctx.moveTo(w * 0.9, 0);
    ctx.lineTo(0, -h * 0.95);
    ctx.lineTo(-w * 0.7, 0);
    ctx.lineTo(0, h * 0.95);
    ctx.closePath();
    ctx.fill();
    // 尾
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-w * 0.7, 0);
    ctx.lineTo(-w * 1.6, Math.sin(fish.finCycle) * 8);
    ctx.stroke();
  }

  // --- アジの開き（添付画像１枚目: 笹の葉の上の天日干し開きアジ・銀色の頭・琥珀色の開き身・背骨と繊細な小骨・二股尾） ---
  drawAjiOpenDetailed(ctx, fish) {
    const w = fish.width * 0.55;
    const h = fish.height * 0.52;
    const finWiggle = Math.sin(fish.finCycle) * 2;

    ctx.save();

    // 1. 二股の干物尾びれ (右端・深みのある飴色褐色)
    ctx.fillStyle = '#5c2d13';
    ctx.strokeStyle = '#3d1c08';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(w * 0.65, -h * 0.12);
    ctx.lineTo(w * 1.28, -h * 0.52 + finWiggle);
    ctx.lineTo(w * 1.12, -h * 0.1);
    ctx.lineTo(w * 0.96, 0); // V字ノッチ
    ctx.lineTo(w * 1.12, h * 0.1);
    ctx.lineTo(w * 1.28, h * 0.48 + finWiggle);
    ctx.lineTo(w * 0.65, h * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 尾の筋（放射状ヒレ条）
    ctx.strokeStyle = '#3d1c08';
    ctx.lineWidth = 1;
    for (let r = -0.35; r <= 0.35; r += 0.12) {
      ctx.beginPath();
      ctx.moveTo(w * 0.72, r * h * 0.3);
      ctx.lineTo(w * 1.2, r * h * 1.2 + finWiggle * (r > 0 ? 1 : -1));
      ctx.stroke();
    }

    // 2. 開かれた干物の身 (パカッと開いた琥珀色・オレンジの身)
    // 外皮の焼き色・焦げ茶フチ
    ctx.strokeStyle = '#4a250a';
    ctx.lineWidth = 2;

    // 開き身のグラデーション
    const fleshGrad = ctx.createRadialGradient(-w * 0.1, 0, 5, 0, 0, w);
    fleshGrad.addColorStop(0, '#fef08a'); // 身の中心（白みがかった脂）
    fleshGrad.addColorStop(0.35, '#fbbf24'); // 美しい琥珀色
    fleshGrad.addColorStop(0.7, '#ea8c1e'); // 干物のオレンジ
    fleshGrad.addColorStop(1, '#b45309');   // 皮付近の飴色
    ctx.fillStyle = fleshGrad;

    ctx.beginPath();
    // 頭の付け根から上身へ
    ctx.moveTo(-w * 0.45, -h * 0.22);
    ctx.bezierCurveTo(-w * 0.35, -h * 0.82, 0, -h * 0.95, w * 0.4, -h * 0.65);
    ctx.lineTo(w * 0.72, -h * 0.18);
    // 尾の付け根
    ctx.lineTo(w * 0.72, h * 0.18);
    // 下身（腹側のえぐれ・折り返しを再現）
    ctx.bezierCurveTo(w * 0.35, h * 0.78, 0, h * 0.92, -w * 0.35, h * 0.75);
    ctx.lineTo(-w * 0.45, h * 0.3);
    ctx.bezierCurveTo(-w * 0.48, h * 0.15, -w * 0.48, -h * 0.15, -w * 0.45, -h * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 3. 身の筋・繊維模様（琥珀色の放射状陰影）
    ctx.strokeStyle = 'rgba(180, 83, 9, 0.45)';
    ctx.lineWidth = 1.2;
    for (let x = -w * 0.3; x <= w * 0.55; x += w * 0.12) {
      // 上側の身の放射筋
      ctx.beginPath();
      ctx.moveTo(x, -h * 0.1);
      ctx.quadraticCurveTo(x + w * 0.05, -h * 0.45, x + w * 0.08, -h * 0.7);
      ctx.stroke();
      // 下側の身の放射筋
      ctx.beginPath();
      ctx.moveTo(x, h * 0.1);
      ctx.quadraticCurveTo(x + w * 0.05, h * 0.45, x + w * 0.08, h * 0.65);
      ctx.stroke();
    }

    // 4. 中央の太い背骨（脊椎・節のある骨）
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-w * 0.44, 0);
    ctx.lineTo(w * 0.72, 0);
    ctx.stroke();

    // 脊椎の白い骨芯
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-w * 0.42, 0);
    ctx.lineTo(w * 0.7, 0);
    ctx.stroke();

    // 脊椎の節（ダークな刻み）
    ctx.fillStyle = '#451a03';
    for (let bx = -w * 0.38; bx <= w * 0.65; bx += w * 0.07) {
      ctx.fillRect(bx - 1.5, -2.5, 3, 5);
    }

    // 5. 繊細な肋骨・小骨（上側＆下側に整然と並ぶ白骨）
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 1.3;
    // 上側肋骨（背骨から斜め後ろへ走る針骨）
    for (let rx = -w * 0.36; rx <= w * 0.58; rx += w * 0.07) {
      ctx.beginPath();
      ctx.moveTo(rx, -2);
      ctx.lineTo(rx + w * 0.07, -h * 0.48);
      ctx.stroke();
    }
    // 下側肋骨
    for (let rx = -w * 0.36; rx <= w * 0.52; rx += w * 0.075) {
      ctx.beginPath();
      ctx.moveTo(rx, 2);
      ctx.lineTo(rx + w * 0.06, h * 0.42);
      ctx.stroke();
    }

    // 6. 銀色の頭部（左端・添付画像準拠のシャープな頭骨）
    ctx.fillStyle = '#94a3b8';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-w * 0.45, -h * 0.32);
    ctx.lineTo(-w * 0.82, -h * 0.22);
    ctx.lineTo(-w * 1.05, -h * 0.04); // 尖った鼻先
    ctx.lineTo(-w * 0.88, h * 0.16);  // 下顎
    ctx.lineTo(-w * 0.58, h * 0.32);  // エラ蓋下
    ctx.lineTo(-w * 0.45, h * 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 頭骨の立体プレート（ハイライト＆エラ蓋カーブ）
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, -h * 0.26);
    ctx.lineTo(-w * 0.78, -h * 0.16);
    ctx.lineTo(-w * 0.95, -h * 0.03);
    ctx.lineTo(-w * 0.72, 0);
    ctx.lineTo(-w * 0.52, -h * 0.05);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(-w * 0.58, 0, h * 0.25, -Math.PI * 0.45, Math.PI * 0.45);
    ctx.stroke();

    // 7. アジの目（同心円状のリング・乾燥した眼球）
    const eyeX = -w * 0.76;
    const eyeY = -h * 0.08;
    // 外周ダークリング
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 5.5, 0, Math.PI * 2);
    ctx.fill();
    // 銀白の虹彩
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 4, 0, Math.PI * 2);
    ctx.fill();
    // 黒瞳
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 2.4, 0, Math.PI * 2);
    ctx.fill();
    // 白い光沢点
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(eyeX - 1, eyeY - 1, 1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // --- シタビラメ（ウシノシタ/添付画像３枚目: 鉤鼻・靴底柳葉型・外周を隙間なく縁取る微細ヒレ条・Velvetチョコ褐色・細小眼） ---
  drawShitabirameDetailed(ctx, fish) {
    const w = fish.width * 0.58;
    const h = fish.height * 0.44;
    const finWiggle = Math.sin(fish.finCycle) * 2.2;

    ctx.save();

    // 1. 全周を切れ目なく縁取る外周ヒレ（背鰭・臀鰭・尾鰭が一体化した砂褐色ヒレ）
    ctx.fillStyle = '#a89078';
    ctx.strokeStyle = '#6e5a47';
    ctx.lineWidth = 1;

    ctx.beginPath();
    // 鼻先上部から開始
    ctx.moveTo(-w * 0.95, -h * 0.15);
    // 背側の外周ヒレ
    ctx.bezierCurveTo(-w * 0.6, -h * 0.98, w * 0.4, -h * 0.75, w * 1.35, finWiggle); // 尖った尾先端
    // 腹側の外周ヒレ
    ctx.bezierCurveTo(w * 0.4, h * 0.75, -w * 0.6, h * 0.98, -w * 0.92, h * 0.28);
    // 鼻先へ戻る
    ctx.lineTo(-w * 0.95, -h * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 2. 密集した微細なヒレ条（添付画像の繊細なスリット状の筋）
    ctx.strokeStyle = '#5c4a38';
    ctx.lineWidth = 0.8;
    // 背ヒレ条
    for (let x = -w * 0.85; x <= w * 1.25; x += 3.5) {
      const topY = -h * 0.45 - (1 - Math.abs(x - w * 0.1) / (w * 1.2)) * h * 0.45;
      const innerY = -h * 0.35 - (1 - Math.abs(x - w * 0.1) / (w * 1.2)) * h * 0.3;
      ctx.beginPath();
      ctx.moveTo(x, innerY);
      ctx.lineTo(x, topY);
      ctx.stroke();
    }
    // 腹ヒレ条
    for (let x = -w * 0.82; x <= w * 1.25; x += 3.5) {
      const botY = h * 0.45 + (1 - Math.abs(x - w * 0.1) / (w * 1.2)) * h * 0.45;
      const innerY = h * 0.35 + (1 - Math.abs(x - w * 0.1) / (w * 1.2)) * h * 0.3;
      ctx.beginPath();
      ctx.moveTo(x, innerY);
      ctx.lineTo(x, botY);
      ctx.stroke();
    }

    // 3. ウシノシタの主胴体（滑らかな靴底・柳葉形状）
    const bodyGrad = ctx.createLinearGradient(0, -h * 0.7, 0, h * 0.7);
    bodyGrad.addColorStop(0, '#3a2e24'); // 上縁
    bodyGrad.addColorStop(0.35, '#544436'); // 中央稜線のハイライト
    bodyGrad.addColorStop(0.7, '#423429'); // 下側
    bodyGrad.addColorStop(1, '#2c221a'); // 下縁
    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = '#221913';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    // 鉤鼻（吻部が丸く突出し、下側に巻き込む特徴的なウシノシタの頭部）
    ctx.moveTo(-w * 0.85, -h * 0.35);
    ctx.bezierCurveTo(-w * 1.08, -h * 0.25, -w * 1.15, h * 0.08, -w * 1.04, h * 0.22); // 丸い鼻先
    ctx.lineTo(-w * 0.95, h * 0.16); // 巻き込んだ口元
    // 腹側ライン
    ctx.bezierCurveTo(-w * 0.5, h * 0.65, w * 0.4, h * 0.45, w * 1.28, finWiggle * 0.8);
    // 尾先端から背側ライン
    ctx.bezierCurveTo(w * 0.4, -h * 0.45, -w * 0.5, -h * 0.65, -w * 0.85, -h * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 4. 側線（中央をまっすぐ貫く細線）
    ctx.strokeStyle = '#221913';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-w * 0.45, 0);
    ctx.lineTo(w * 1.22, finWiggle * 0.8);
    ctx.stroke();
    // 側線ハイライト
    ctx.strokeStyle = 'rgba(168, 144, 120, 0.35)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-w * 0.45, -1);
    ctx.lineTo(w * 1.22, finWiggle * 0.8 - 1);
    ctx.stroke();

    // 5. 表面の微細な暗色斑点（添付画像に散らばる細かな斑点）
    ctx.fillStyle = 'rgba(28, 20, 14, 0.6)';
    const spots = [
      { x: -w * 0.2, y: -h * 0.22, r: 1.5 },
      { x: -w * 0.05, y: -h * 0.3, r: 1.8 },
      { x: w * 0.15, y: -h * 0.18, r: 1.4 },
      { x: w * 0.35, y: -h * 0.22, r: 1.6 },
      { x: w * 0.55, y: -h * 0.14, r: 1.3 },
      { x: -w * 0.3, y: h * 0.2, r: 1.6 },
      { x: -w * 0.1, y: h * 0.28, r: 1.5 },
      { x: w * 0.1, y: h * 0.18, r: 1.8 },
      { x: w * 0.3, y: h * 0.24, r: 1.4 },
      { x: w * 0.6, y: h * 0.12, r: 1.2 }
    ];
    for (const sp of spots) {
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 6. エラ蓋の境界線
    ctx.strokeStyle = '#261b14';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(-w * 0.62, h * 0.08, h * 0.28, -Math.PI * 0.4, Math.PI * 0.4);
    ctx.stroke();

    // 7. 背側縁に寄った小さな2つの目（添付画像準拠: 小さく光る金緑色の瞳）
    const eye1X = -w * 0.82;
    const eye1Y = -h * 0.12;
    const eye2X = -w * 0.74;
    const eye2Y = -h * 0.18;

    // 目 1
    ctx.fillStyle = '#657555'; // 金緑色の虹彩
    ctx.beginPath();
    ctx.arc(eye1X, eye1Y, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(eye1X, eye1Y, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(eye1X - 0.8, eye1Y - 0.8, 0.8, 0, Math.PI * 2);
    ctx.fill();

    // 目 2
    ctx.fillStyle = '#657555';
    ctx.beginPath();
    ctx.arc(eye2X, eye2Y, 3.0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(eye2X, eye2Y, 1.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(eye2X - 0.8, eye2Y - 0.8, 0.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // --- 墨エフェクト ---
  renderInkClouds() {
    const ctx = this.ctx;
    for (let i = this.inkClouds.length - 1; i >= 0; i--) {
      const ink = this.inkClouds[i];
      ink.radius += ink.growth;
      ink.alpha -= 0.006;
      if (ink.alpha <= 0) {
        this.inkClouds.splice(i, 1);
        continue;
      }
      ctx.save();
      const grad = ctx.createRadialGradient(ink.x, ink.y, 0, ink.x, ink.y, ink.radius);
      grad.addColorStop(0, `rgba(15, 23, 42, ${ink.alpha})`);
      grad.addColorStop(0.7, `rgba(15, 23, 42, ${ink.alpha * 0.8})`);
      grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(ink.x, ink.y, ink.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // --- パーティクル ---
  renderParticles() {
    const ctx = this.ctx;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.03;
      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // --- フローティングスコアテキスト (+10, -2, COMBO!) ---
  renderFloatingTexts() {
    const ctx = this.ctx;
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy;
      ft.alpha -= 0.025;
      if (ft.alpha <= 0) {
        this.floatingTexts.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.font = `bold ${ft.fontSize}px 'Outfit', 'Noto Sans JP', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // テキストのアウトライン
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 4;
      ctx.strokeText(ft.text, ft.x, ft.y);
      
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }
}

/**
 * キャラクターの目パーツ中心の相対座標 (x, y) を正確に計算
 * ・キャラクタースタジオ製ベクターリグ: type === 'eyes' のパーツ重心を算出
 * ・左向き魚 (ヒラメ・シタビラメ等): -X側にフォーカス (尾びれ誤ズームを完全解消)
 * ・右向き魚 (カレイ・ぶーちゃん等): +X側にフォーカス
 */
export function getFishEyeOffset(type, width, height, heading = 1, customChar = null) {
  if (!customChar) {
    try {
      const presets = getAllBasePresets();
      customChar = presets.find(p => p && p.id === type) || null;
    } catch (e) {}
  }

  // 1. キャラクタースタジオで作成されたベクターキャラクターの目パーツから検索
  if (customChar && customChar.parts) {
    const eyeParts = customChar.parts.filter(p => p.type === 'eyes' && p.visible !== false);
    if (eyeParts.length > 0) {
      let sumX = 0, sumY = 0, count = 0;
      for (const p of eyeParts) {
        if (p.cx !== undefined && p.cy !== undefined) {
          sumX += p.cx;
          sumY += p.cy;
          count++;
        } else if (p.pivot && (p.pivot.x !== undefined || p.pivot.y !== undefined)) {
          sumX += (p.pivot.x || 0);
          sumY += (p.pivot.y || 0);
          count++;
        } else if (p.points && p.points.length > 0) {
          const ptSumX = p.points.reduce((s, pt) => s + pt.x, 0) / p.points.length;
          const ptSumY = p.points.reduce((s, pt) => s + pt.y, 0) / p.points.length;
          sumX += ptSumX;
          sumY += ptSumY;
          count++;
        }
      }
      if (count > 0) {
        const avgX = sumX / count;
        const avgY = sumY / count;
        const nat = getCharacterNaturalSize(customChar);
        const scale = Math.min(width / nat.width, height / nat.height);
        return {
          x: avgX * scale,
          y: avgY * scale
        };
      }
    }
  }

  // 2. 組み込みキャラクター種別ごとの目位置 (原点はキャラクター中心)
  switch (type) {
    case 'hirame':
    case 'kanji_hirame':
    case 'shitabirame':
      // 左向き魚：左上（-X側）に2つの目
      return { x: -width * 0.35, y: -height * 0.16 };
    case 'karei':
    case 'kanji_karei_1':
    case 'kanji_karei_2':
      // 右向き魚：右上（+X側）に2つの目
      return { x: width * 0.35, y: -height * 0.16 };
    case 'boo_chan':
      // ぶーちゃん：左向き（-X側）に顔・目
      return { x: -width * 0.40, y: -height * 0.12 };
    case 'octopus':
      // タコ：頭部中央やや下の眼球位置
      return { x: 0, y: -height * 0.03 };
    case 'squid':
      // イカ：ドーム（上部）ではなく襟元・触手付け根の眼球位置（+Y側）
      return { x: 0, y: height * 0.15 };
    case 'stingray':
      return { x: -width * 0.14, y: -height * 0.08 };
    case 'aji_open':
      return { x: -width * 0.35, y: -height * 0.05 };
    default:
      return { x: (heading >= 0 ? 1 : -1) * width * 0.25, y: -height * 0.14 };
  }
}

