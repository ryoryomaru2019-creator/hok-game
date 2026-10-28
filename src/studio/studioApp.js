// Character Studio Master Application: Coordinates Editor, Rigging, Timeline, and Game Export

import { StudioEditor, TOOLS } from './editor.js';
import {
  BASE_PRESETS,
  getAllBasePresets,
  getHiramePreset,
  getKareiPreset,
  getOctopusPreset,
  getSquidPreset,
  getStingrayPreset,
  getAjiOpenPreset,
  getUshinositaPreset,
  createPart,
  createCirclePart
} from './model.js';
import { resolveRigTransforms, solveCubicBezier, EASING_FUNCTIONS, evaluateTrack } from './animator.js';
import { flipPointsHorizontally, flipPointsVertically, clonePart, pointsToSvgPath } from './pathUtils.js';
import { AiCharacterGenerator } from './aiGenerator.js';

// ========================================================
// Photoshop仕様 ツール定義 & グループ化
// ========================================================
export const STUDIO_TOOLBOX_GROUPS = [
  {
    groupId: 'select_group',
    defaultTool: 'select',
    tools: [
      { id: 'select', name: '選択', fullName: '選択ツール', icon: '↖', shortcut: 'V', desc: 'オブジェクトをクリックまたはドラッグして選択・移動します' },
      { id: 'direct_select', name: 'ダイレクト選択', fullName: 'ダイレクト選択ツール', icon: '↗', shortcut: 'A', desc: 'パスのアンカーポイント・制御ハンドルを個別に編集します' },
      { id: 'marquee', name: '矩形選択', fullName: '矩形選択ツール', icon: '🔲', shortcut: 'M', desc: 'ドラッグした矩形範囲内の複数オブジェクトを一括選択します' }
    ]
  },
  {
    groupId: 'transform_group',
    defaultTool: 'transform',
    tools: [
      { id: 'transform', name: '自由変形', fullName: '自由変形ツール', icon: '⤢', shortcut: 'Ctrl+T', desc: 'バウンディングボックスのドラッグで拡大縮小・回転します' },
      { id: 'pivot', name: '原点設定', fullName: '原点・ピボット設定ツール', icon: '🎯', shortcut: 'O', desc: '回転・ボーンアニメーションの基準原点を設定します' }
    ]
  },
  {
    groupId: 'pen_group',
    defaultTool: 'pen',
    tools: [
      { id: 'pen', name: 'ペン', fullName: 'ベジェペンツール', icon: '✒', shortcut: 'P', desc: 'クリックで直線、ドラッグで滑らかなベジェ曲線を描画します' },
      { id: 'curvature', name: '湾曲ペン', fullName: '湾曲・曲率ペンツール', icon: '∿', shortcut: 'C', desc: '自然な円弧・曲線を直感的に作成・調整します' }
    ]
  },
  {
    groupId: 'shape_group',
    defaultTool: 'rect',
    tools: [
      { id: 'rect', name: '長方形', fullName: '長方形シェイプツール', icon: '▭', shortcut: 'R', desc: '長方形・正方形のベクターシェイプを作成します' },
      { id: 'ellipse', name: '楕円', fullName: '楕円シェイプツール', icon: '⬭', shortcut: 'E', desc: '楕円・正円のベクターシェイプを作成します' },
      { id: 'triangle', name: '三角形', fullName: '三角形シェイプツール', icon: '△', shortcut: 'T', desc: '三角形のベクターシェイプを作成します' }
    ]
  },
  {
    groupId: 'view_group',
    defaultTool: 'pan',
    tools: [
      { id: 'pan', name: '手のひら', fullName: '手のひらツール', icon: '✋', shortcut: 'H / Space', desc: 'キャンバスの表示領域をドラッグしてスクロールします' },
      { id: 'zoom', name: 'ズーム', fullName: 'ズームツール', icon: '🔍', shortcut: 'Z', desc: 'クリックまたはドラッグでキャンバス表示を拡大・縮小します' }
    ]
  }
];

export const ALL_TOOLS_MAP = {};
STUDIO_TOOLBOX_GROUPS.forEach(g => {
  g.tools.forEach(t => {
    ALL_TOOLS_MAP[t.id] = { ...t, groupId: g.groupId };
  });
});

// ========================================================
// Premiere仕様 ビン (Bins) 初期フォルダ構造
// ========================================================
export const DEFAULT_BINS = [
  {
    id: 'bin_aquatic',
    name: '水生生物 (公式)',
    isOpen: true,
    charIds: ['hirame', 'karei', 'octopus', 'squid', 'stingray', 'aji_open', 'shitabirame']
  },
  {
    id: 'bin_creatures',
    name: '多様体・新骨格',
    isOpen: true,
    charIds: ['human', 'quadruped', 'biped', 'insect', 'spider', 'bird']
  },
  {
    id: 'bin_special',
    name: 'スペシャルキャラクター',
    isOpen: true,
    charIds: ['boo_chan']
  },
  {
    id: 'bin_kanji',
    name: '漢字キャラクター',
    isOpen: false,
    charIds: ['kanji_hirame', 'kanji_karei_1', 'kanji_karei_2']
  },
  {
    id: 'bin_custom',
    name: 'マイカスタム',
    isOpen: true,
    charIds: []
  }
];

export function getPresetLabel(id, roster = {}) {
  if (roster && roster[id]) {
    return {
      id,
      name: roster[id].name || id,
      icon: '✨',
      isCustom: true
    };
  }
  const official = {
    hirame: { id: 'hirame', name: 'ヒラメ (左向き・受け口・鋭い牙)', icon: '🐟' },
    karei: { id: 'karei', name: 'カレイ (右向き・おちょぼ口・水玉)', icon: '🐟' },
    octopus: { id: 'octopus', name: 'タコ (邪魔キャラ・墨吐き)', icon: '🐙' },
    squid: { id: 'squid', name: 'イカ (邪魔キャラ・高速ジェット)', icon: '🦑' },
    stingray: { id: 'stingray', name: 'エイ (巨大影・大翼)', icon: '🌊' },
    aji_open: { id: 'aji_open', name: 'アジの開き (罠・干物ボーン)', icon: '🐟' },
    shitabirame: { id: 'shitabirame', name: 'ウシノシタ (舌平目・靴底型)', icon: '👞' },
    human: { id: 'human', name: '人間 (頭部・手足・歩行サイクル)', icon: '🧍' },
    quadruped: { id: 'quadruped', name: '４足歩行 (首・胴・4足トロット)', icon: '🐕' },
    biped: { id: 'biped', name: '２足歩行 (頭部・大顎・強靭脚)', icon: '🦖' },
    insect: { id: 'insect', name: '昆虫 (クワガタ・大顎・6本足)', icon: '🪲' },
    spider: { id: 'spider', name: '蜘蛛 (8脚オオグモ・毒牙)', icon: '🕷️' },
    bird: { id: 'bird', name: '鳥 (青い鳥・羽ばたき)', icon: '🦅' },
    boo_chan: { id: 'boo_chan', name: 'ぶーちゃん (豚顔イルカ・スペシャル)', icon: '🐷' },
    kanji_hirame: { id: 'kanji_hirame', name: '漢字・鮃 (ヒラメ)', icon: '鮃' },
    kanji_karei_1: { id: 'kanji_karei_1', name: '漢字・鰈 (カレイ)', icon: '鰈' },
    kanji_karei_2: { id: 'kanji_karei_2', name: '漢字・魪 (カレイ・魪)', icon: '魪' }
  };
  return official[id] || { id, name: id, icon: '🐟', isCustom: false };
}

/**
 * After Effects風 回転表記フォーマッタ (+: 時計回り, -: 反時計回り, 360度で1回転, 例: 0x+45.0°, 1x+30.0°)
 */
export function formatAeRotation(deg) {
  const d = Math.round((deg || 0) * 10) / 10;
  const turns = Math.trunc(d / 360);
  const rem = Math.round((d % 360) * 10) / 10;
  const sign = (d >= 0 || rem === 0) ? '+' : '';
  return `${turns}x ${sign}${rem.toFixed(1)}°`;
}

/**
 * After Effects風 回転入力パーサー ("1x+30", "45", "-90", "1x + 45°" 等に対応)
 */
export function parseAeRotation(str) {
  if (typeof str === 'number') return str;
  if (!str) return 0;
  const clean = String(str).replace(/°/g, '').trim();
  const match = clean.match(/^([+-]?\d+)\s*x\s*([+-]?\s*\d+(?:\.\d+)?)/i);
  if (match) {
    const turns = parseInt(match[1], 10) || 0;
    const deg = parseFloat(match[2].replace(/\s+/g, '')) || 0;
    return turns * 360 + deg;
  }
  const val = parseFloat(clean);
  return isNaN(val) ? 0 : val;
}

export class StudioApp {
  constructor(containerEl) {
    this.container = containerEl;
    this.editor = null;
    this.character = null;
    this.aiGenerator = null;

    // Photoshopツールボックス状態
    this.activeStudioTool = 'select';
    this.slotActiveTools = {
      select_group: 'select',
      transform_group: 'transform',
      pen_group: 'pen',
      shape_group: 'rect',
      view_group: 'pan'
    };

    // Premiereビン管理状態
    this.bins = [];
    this.activeSidebarTab = 'bins'; // 'bins' | 'layers'
    this.activeInspectorTab = 'general'; // 'general' | 'style' | 'anchor' | 'reaction'

    // タイムライン再生状態 (60F基準)
    this.isPlaying = false;
    this.currentFrame = 0; // 0 〜 60F
    this.totalFrames = 60; // 60F = 1.0秒
    this.currentMotion = 'swim';
    this.animRafId = null;
    this.lastFrameTimestamp = 0;

    // タイムライン表示モード: 'dopesheet' | 'graph'
    this.timelineMode = 'dopesheet';
    this.selectedGraphProperty = 'rot'; // 'tx' | 'ty' | 'rot'

    // 自動キーフレーム (Auto-Keyframe: 'A' ボタン)
    this.isAutoKeyframe = true;
    this.timelineLeftPaneWidth = 380; // 左側トランスフォームパネルの横幅 (リサイズ可能)

    // After Effects風 タイムライン折りたたみ・展開状態 (部位 / トランスフォーム / 縦横比固定)
    this.expandedTimelineParts = new Set(); // 開いているパーツID
    this.expandedTimelineTransforms = new Set(); // 開いているトランスフォーム (partId)
    this.timelineAspectLocked = new Map(); // partId -> boolean (縦横比固定)

    // プレビュー表示設定 (プロパティ上部)
    this.previewZoom = 1.0;

    // レイヤー折りたたみ状態 (parentId -> boolean)
    this.collapsedParts = new Set();
    this.draggedPartId = null;

    // キーフレーム選択 (単体および範囲選択)
    this.selectedKeyframe = null; // 後方互換用 { partId, prop, kf }
    this.selectedKeyframes = []; // [ { partId, prop, kf }, ... ]
    this.clipboardKeyframe = null; // { ...kf }

    // プロパティごとのストップウォッチON/OFF状態 (partId:prop -> boolean)
    this.stopwatchState = new Map();

    // プロパティごとのインライングラフ表示状態 (Set of partId:prop)
    this.inlineGraphProps = new Set();

    // プロパティ行のカスタム高さ (partId:prop -> number)
    this.propRowHeights = new Map();

    // タイムライン ズーム & 時間ナビゲーター (After Effects仕様)
    this.timelineZoom = 1.0; // 1.0 (全体表示: 60F) 〜 10.0 (詳細表示)
    this.timelinePanOffset = 0; // 0.0 〜 1.0 (表示開始位置の正規化オフセット)
    this.selectedGraphKeyframe = null; // グラフエディタで選択中のキーフレーム情報 { partId, prop, kf }

    // タイムライン表示フィルター ('only': 選択パーツのみ・デフォルト / 'all': 全パーツ)
    this.timelineFilterMode = 'only';
    // 長押しでベジェハンドルが表示されたキーフレームセット (partId:prop:frame)
    this.activeBezierHandles = new Set();

    this.initLayout();
    this.initBins();
    this.initToolbox();
    this.initEditor();
    this.loadInitialPreset();
    this.bindControls();
    this.initAiGenerator();
  }

  get currentTime() {
    return (this.currentFrame / this.totalFrames) * this.currentDuration;
  }

  get currentDuration() {
    const clip = this.character?.animations?.[this.currentMotion];
    return clip ? clip.duration : 1.0;
  }

  initLayout() {
    this.container.innerHTML = `
      <div class="studio-workstation">
        <!-- 1. トップメニューバー (Photoshop仕様メニューバー ＆ クイックアクセス) -->
        <nav class="studio-menu-bar" id="studioMenuBar">
          <div class="studio-app-brand">
            <span>🐟 HIRAME</span> STUDIO
          </div>
          <div class="menu-bar-nav">
            <!-- ファイル -->
            <div class="menu-item-root" data-menu="file">
              <button class="menu-btn-root" type="button">ファイル (<u>F</u>) ▾</button>
              <div class="menu-dropdown">
                <button class="menu-sub-btn" type="button" id="menuItemNewChar"><span>➕ 新規作成...</span><span class="menu-hotkey">Ctrl+N</span></button>
                <button class="menu-sub-btn" type="button" id="menuItemImportJson"><span>📂 単体キャラJSON読込...</span><span class="menu-hotkey">Ctrl+O</span></button>
                <button class="menu-sub-btn" type="button" id="menuItemImportPackJson"><span>📥 全キャラ一括読込...</span></button>
                <div class="menu-separator"></div>
                <button class="menu-sub-btn" type="button" id="menuItemOverwrite"><span>💾 上書き保存</span><span class="menu-hotkey">Ctrl+S</span></button>
                <button class="menu-sub-btn" type="button" id="menuItemRegisterNew"><span>✨ 別名で新規登録...</span><span class="menu-hotkey">Ctrl+Shift+S</span></button>
                <button class="menu-sub-btn" type="button" id="menuItemExportPackJson"><span>📦 全キャラ一括書き出し...</span></button>
                <button class="menu-sub-btn" type="button" id="menuItemExportJson"><span>💾 単体JSON書き出し...</span></button>
                <button class="menu-sub-btn" type="button" id="menuItemExportSvg"><span>🖼️ SVG画像出力...</span></button>
                <div class="menu-separator"></div>
                <button class="menu-sub-btn" type="button" id="menuItemRegisterAmbient"><span>🫧 背景演出に登録...</span></button>
              </div>
            </div>

            <!-- 編集 -->
            <div class="menu-item-root" data-menu="edit">
              <button class="menu-btn-root" type="button">編集 (<u>E</u>) ▾</button>
              <div class="menu-dropdown">
                <button class="menu-sub-btn" type="button" id="menuItemUndo"><span>↩ 元に戻す</span><span class="menu-hotkey">Ctrl+Z</span></button>
                <button class="menu-sub-btn" type="button" id="menuItemRedo"><span>↪ やり直し</span><span class="menu-hotkey">Ctrl+Y</span></button>
                <div class="menu-separator"></div>
                <button class="menu-sub-btn" type="button" id="menuItemDuplicatePart"><span>📋 選択パーツを複製</span><span class="menu-hotkey">Ctrl+D</span></button>
                <button class="menu-sub-btn" type="button" id="menuItemDeletePart"><span>🗑️ 選択パーツを削除</span><span class="menu-hotkey">Delete</span></button>
                <div class="menu-separator"></div>
                <button class="menu-sub-btn" type="button" id="menuItemDeleteChar"><span>🗑️ 現在のキャラクターを削除...</span></button>
                <div class="menu-separator"></div>
                <button class="menu-sub-btn" type="button" id="menuItemResetSwatches"><span>🎨 スウォッチをデフォルトに戻す</span></button>
                <button class="menu-sub-btn" type="button" id="menuItemImportSwatches"><span>📥 スウォッチを読み込む...</span></button>
                <button class="menu-sub-btn" type="button" id="menuItemExportSwatches"><span>📤 スウォッチを書き出す...</span></button>
              </div>
            </div>

            <!-- 画像・リグ -->
            <div class="menu-item-root" data-menu="image">
              <button class="menu-btn-root" type="button">画像・リグ (<u>I</u>) ▾</button>
              <div class="menu-dropdown">
                <button class="menu-sub-btn" type="button" id="menuItemFlipH"><span>↔️ 左右水平反転</span></button>
                <button class="menu-sub-btn" type="button" id="menuItemFlipV"><span>↕️ 上下垂直反転</span></button>
                <button class="menu-sub-btn" type="button" id="menuItemAddPart"><span>➕ 新規部位パーツ追加</span></button>
                <div class="menu-separator"></div>
                <button class="menu-sub-btn" type="button" id="menuItemOpenAi"><span>🪄 AIキャラ自動生成 (Gemini)...</span></button>
              </div>
            </div>

            <!-- 表示 -->
            <div class="menu-item-root" data-menu="view">
              <button class="menu-btn-root" type="button">表示 (<u>V</u>) ▾</button>
              <div class="menu-dropdown">
                <button class="menu-sub-btn" type="button" id="menuItemZoomIn"><span>🔍 ズームイン</span><span class="menu-hotkey">Ctrl++</span></button>
                <button class="menu-sub-btn" type="button" id="menuItemZoomOut"><span>🔍 ズームアウト</span><span class="menu-hotkey">Ctrl+-</span></button>
                <button class="menu-sub-btn" type="button" id="menuItemFitView"><span>🎯 全体を表示 (中央フィット)</span><span class="menu-hotkey">Ctrl+0</span></button>
                <div class="menu-separator"></div>
                <button class="menu-sub-btn" type="button" id="menuItemToggleSnap"><span>🧲 グリッドスナップ切替</span></button>
                <button class="menu-sub-btn" type="button" id="menuItemToggleSil"><span>🌑 シルエット表示切替</span></button>
              </div>
            </div>

            <!-- ウィンドウ -->
            <div class="menu-item-root" data-menu="window">
              <button class="menu-btn-root" type="button">ウィンドウ (<u>W</u>) ▾</button>
              <div class="menu-dropdown">
                <button class="menu-sub-btn" type="button" id="menuItemShowBins"><span>📁 プリセット (ビン)</span></button>
                <button class="menu-sub-btn" type="button" id="menuItemShowLayers"><span>🧬 パーツ (レイヤー)</span></button>
                <button class="menu-sub-btn" type="button" id="menuItemShowNav"><span>🧭 ナビゲーター</span></button>
                <button class="menu-sub-btn" type="button" id="menuItemShowSwatches"><span>🎨 スウォッチパレット</span></button>
                <div class="menu-separator"></div>
                <button class="menu-sub-btn" type="button" id="menuItemShortcuts"><span>⌨️ ショートカットキー一覧</span><span class="menu-hotkey">F1</span></button>
              </div>
            </div>
          </div>

          <!-- よく使う項目 (Quick Access Group) -->
          <div class="quick-access-group">
            <span style="font-size:10px; color:#94a3b8; font-weight:700;">よく使う項目:</span>
            <select id="studioPresetSelect" class="studio-select-char" title="編集するキャラクターを選択"></select>
            <button class="btn-action-ai" id="btnOpenAiGenerator" title="Gemini AIを使って画像やテキストから新キャラクターを自動生成">🪄 AIキャラ生成</button>
            <button class="btn-action-primary" id="btnStudioNewChar" title="新しいキャラクターを新規追加">➕ 新規追加</button>
            <button class="btn-action-secondary" id="btnStudioOverwrite" title="現在編集中の内容を現在のキャラに上書き保存＆ゲーム適用">💾 上書き保存</button>
            <!-- 常時表示される「ゲームに適用」ボタン -->
            <button class="btn-action-primary btn-apply-permanent" id="btnApplyToGame" title="既存キャラへの上書きまたは新規キャラ登録してゲームに反映">🎮 ゲームに適用</button>
          </div>
        </nav>

        <!-- サブツールバー (下絵トレース・Undo/Redo・各種補助) -->
        <header class="studio-toolbar">
          <!-- アクティブキャラクターのビン・ブレッドクラム -->
          <div class="toolbar-group active-char-breadcrumb" id="activeBinBreadcrumb" title="クリックでビン一覧を開く">
            <span class="breadcrumb-icon">📁</span>
            <span class="breadcrumb-bin" id="breadcrumbBinName">水生生物</span>
            <span class="breadcrumb-sep">/</span>
            <span class="breadcrumb-char" id="breadcrumbCharName">🐟 ヒラメ</span>
          </div>

          <div class="toolbar-separator"></div>

          <!-- ツールグループ: 下絵トレース表示 (他キャラクターの下絵 ＆ 透明度) -->
          <div class="toolbar-group collapsible" id="toolGroupTrace">
            <button class="group-toggle" data-target="toolGroupTrace" title="折りたたみ">▾</button>
            <span class="tool-label">下絵トレース:</span>
            <select id="tracePresetSelect" class="studio-select-sm" title="キャンバスにトレース用下絵として別キャラクターを表示">
              <option value="">(下絵なし)</option>
              <optgroup label="🐟 水生生物">
                <option value="hirame">🐟 ヒラメ (左向き)</option>
                <option value="karei">🐟 カレイ (右向き)</option>
                <option value="octopus">🐙 タコ (墨吐き)</option>
                <option value="squid">🦑 イカ (ジェット)</option>
                <option value="stingray">🌊 エイ (巨大影)</option>
                <option value="aji_open">🐟 アジの開き</option>
                <option value="shitabirame">👞 ウシノシタ</option>
              </optgroup>
              <optgroup label="🧬 多様体・新骨格">
                <option value="human">🧍 人間 (頭部・手足)</option>
                <option value="quadruped">🐕 ４足歩行 (トロット)</option>
                <option value="biped">🦖 ２足歩行 (大顎・恐竜)</option>
                <option value="insect">🪲 昆虫 (翅羽ばたき)</option>
                <option value="spider">🕷️ 蜘蛛 (8脚)</option>
                <option value="bird">🦅 鳥 (大羽ばたき)</option>
              </optgroup>
              <optgroup label="🔤 漢字キャラクター">
                <option value="kanji_hirame">鮃 漢字・鮃 (ヒラメ)</option>
                <option value="kanji_karei_1">鰈 漢字・鰈 (カレイ)</option>
                <option value="kanji_karei_2">魪 漢字・魪 (カレイ)</option>
              </optgroup>
            </select>
            <div class="trace-opacity-wrap" style="display:inline-flex; align-items:center; gap:4px; margin-left:4px;">
              <span style="font-size:11px; color:#94a3b8;">透明度:</span>
              <input type="range" id="traceOpacitySlider" min="5" max="100" step="1" value="35" class="studio-slider-sm" style="width:55px;" title="下絵トレースの透明度">
              <input type="number" id="traceOpacityNum" min="0" max="100" step="1" value="35" class="prop-number-input" style="width:46px; padding:2px 4px; font-size:10px;" title="直接入力 (%)">
              <span style="font-size:10px; color:#94a3b8;">%</span>
            </div>
            <label class="trace-fg-label" style="display:inline-flex; align-items:center; gap:4px; margin-left:8px; font-size:11px; color:#cbd5e1; cursor:pointer;" title="チェックを入れるとオブジェクトの最前面にも下絵を表示します（操作不可・描画のみ）">
              <input type="checkbox" id="traceForegroundCheck" style="cursor:pointer; accent-color:#38bdf8;">
              最前面にも表示
            </label>
          </div>

          <div class="toolbar-separator"></div>

          <div class="toolbar-group">
            <button class="tool-btn" id="btnUndo" title="元に戻す (Ctrl+Z)">↩ Undo</button>
            <button class="tool-btn" id="btnRedo" title="やり直し (Ctrl+Y)">↪ Redo</button>
            <button class="tool-btn" id="btnResetView" title="表示リセット (Ctrl+0)">🔍 リセット</button>
            <button class="tool-btn btn-shortcuts-highlight" id="btnOpenShortcuts" title="操作・ショートカットキー一覧 (F1 / ?)">⌨️ ショートカット (F1)</button>
          </div>

          <!-- 隠し保持用ボタン (従来のイベントハンドラーとの完全互換性を保持) -->
          <div style="display:none;">
            <button id="btnStudioRegisterNew"></button>
            <button id="btnStudioDeleteChar"></button>
            <button id="btnRegisterAmbientPreset"></button>
            <button id="btnExportPackJson"></button>
            <button id="btnImportPackJson"></button>
            <button id="btnExportJson"></button>
            <button id="btnImportJson"></button>
            <button id="btnExportSvg"></button>
          </div>
        </header>

        <!-- メイン作業領域 (左サイドバー、ツールボックス、中央キャンバス、右インスペクター) -->
        <div class="studio-body">
          <!-- 左パネル: タブナビゲーション (Premiere ビン vs パーツ レイヤー) -->
          <aside class="studio-sidebar left-sidebar" id="leftSidebar">
            <!-- オブジェクトエディット ヘッダー -->
            <div class="sidebar-main-header">
              <span class="sidebar-main-title">📦 オブジェクトエディット</span>
            </div>
            <div class="sidebar-tab-nav">
              <button class="sidebar-tab-btn active" id="tabSidebarBins" data-tab="bins" title="プリセット整理・ビン管理">
                📁 プリセット (ビン)
              </button>
              <button class="sidebar-tab-btn" id="tabSidebarLayers" data-tab="layers" title="現在編集中のパーツ構造">
                🧬 パーツ (レイヤー)
              </button>
            </div>

            <!-- パネル 1: プリセット・ビン管理 (Premiere仕様) -->
            <div class="sidebar-tab-panel" id="panelSidebarBins">
              <div class="bin-toolbar">
                <button class="btn-bin-action" id="btnAddNewBin" title="新規ビン（グループフォルダ）を作成">➕ 新規ビン</button>
                <button class="btn-bin-action" id="btnToggleAllBins" title="すべてのビンを開く/閉じる">⤹ 展開/折畳</button>
                <div class="bin-menu-wrap" style="position:relative; display:inline-block;">
                  <button class="btn-bin-action" id="btnBinMenuTrigger" title="選択項目に対する操作メニューを開く">メニュー ▾</button>
                  <div class="bin-dropdown-menu hidden" id="binDropdownMenu">
                    <div class="bin-menu-status" id="binMenuStatus">項目を選択してください</div>
                    <button class="bin-menu-item" id="binMenuEdit" disabled>✏️ 編集 (開く)</button>
                    <button class="bin-menu-item" id="binMenuDuplicate" disabled>📋 コピーして新規作成</button>
                    <button class="bin-menu-item" id="binMenuMove" disabled>📂 別のビンへ移動</button>
                    <div class="bin-menu-divider"></div>
                    <button class="bin-menu-item danger" id="binMenuDelete" disabled>🗑️ 削除 (新規プリセットのみ)</button>
                  </div>
                </div>
                <input type="text" id="binSearchInput" class="bin-search-input" placeholder="🔍 検索..." title="キャラクター名またはIDでリアルタイム絞り込み">
              </div>
              <div class="bin-tree-container" id="binTreeContainer">
                <!-- 動的にビンおよびキャラクター行を描画 -->
              </div>
            </div>

            <!-- パネル 2: パーツ階層 & レイヤー管理 (既存) -->
            <div class="sidebar-tab-panel hidden" id="panelSidebarLayers">
              <div class="sidebar-header">
                <h3>🧬 パーツ構造 (レイヤー)</h3>
                <div class="header-tools">
                  <button id="btnAddPart" class="btn-icon" title="新規部位追加">➕</button>
                  <button id="btnDuplicatePart" class="btn-icon" title="選択パーツを複製">📋</button>
                  <button id="btnFlipHPart" class="btn-icon" title="左右水平反転">↔️</button>
                  <button id="btnFlipVPart" class="btn-icon" title="上下垂直反転">↕️</button>
                  <button id="btnDeletePart" class="btn-icon" title="パーツ削除">🗑️</button>
                </div>
              </div>

              <!-- レイヤー選択対象モード切替バー (全レイヤー対象 vs 指定レイヤーのみ) -->
              <div class="layer-mode-bar">
                <span class="mode-label">選択対象:</span>
                <button id="btnLayerSelectModeAll" class="btn-mode-toggle active" title="キャンバス上の全レイヤー・オブジェクトを選択可能">🌐 全レイヤー</button>
                <button id="btnLayerSelectModeActive" class="btn-mode-toggle" title="現在選択中のレイヤー内オブジェクトのみ選択可能">🎯 指定レイヤーのみ</button>
              </div>

              <!-- レイヤー順序クイックバー -->
              <div class="layer-order-bar">
                <span class="order-label">レイヤー順:</span>
                <button id="btnLayerTop" class="btn-order" title="最前面へ移動">⏫ 最前面</button>
                <button id="btnLayerUp" class="btn-order" title="前面へ移動">🔼 前へ</button>
                <button id="btnLayerDown" class="btn-order" title="背面へ移動">🔽 後へ</button>
                <button id="btnLayerBottom" class="btn-order" title="最背面へ移動">⏬ 最背面</button>
              </div>

              <!-- ドラッグ＆ドロップ対応レイヤーリスト -->
              <div class="layer-tree-container" id="layerTreeList"></div>
            </div>
          </aside>

          <!-- 左パネルリサイザー -->
          <div class="panel-resizer vertical" id="resizerLeft" title="ドラッグで幅を変更"></div>

          <!-- Photoshop-Style ツールボックス (アイコンのみ・長押し/右クリックで関連ツール展開) -->
          <aside class="ps-toolbox" id="psToolbox">
            <div class="ps-toolbox-slots" id="psToolboxSlots">
              <!-- JSで動的にSTUDIO_TOOLBOX_GROUPSからスロット展開 -->
            </div>
            <div class="ps-toolbox-divider"></div>
            <div class="ps-toolbox-utilities">
              <button class="ps-tool-btn" id="btnTransformToggle" title="自由変形 (Ctrl+T)"><span class="ps-tool-icon">📐</span></button>
              <button class="ps-tool-btn" id="btnMergeLayers" title="複数レイヤー結合 / 下のレイヤーと結合 (Ctrl+E)"><span class="ps-tool-icon">🔗</span></button>
              <button class="ps-tool-btn" id="btnSnapToggle" title="グリッドスナップ切替"><span class="ps-tool-icon">🧲</span></button>
              <button class="ps-tool-btn" id="btnSilhouetteToggle" title="深海シルエット（影）モード切替"><span class="ps-tool-icon">🌑</span></button>
              <button class="ps-tool-btn" id="btnFacingToggle" title="左右向き反転プレビュー"><span class="ps-tool-icon">↔️</span></button>
              <button class="ps-tool-btn" id="btnClosePathToggle" title="パス閉鎖 / 開放"><span class="ps-tool-icon">⭕</span></button>
            </div>
          </aside>

          <!-- 中央: ベクターキャンバス ＆ ステータスバー -->
          <div class="studio-canvas-container" id="studioCanvasContainer">
            <div class="studio-canvas-stage" id="studioCanvasStage"></div>
            <footer class="studio-canvas-status-bar" id="studioCanvasStatusBar">
              <div class="status-left">
                <span class="status-tool-badge" id="statusActiveToolName">↖ 選択</span>
                <span class="status-tool-desc" id="statusActiveToolDesc">オブジェクトをクリックまたはドラッグして選択・移動します (V)</span>
              </div>
              <div class="status-right">
                <span class="status-coords" id="statusCanvasCoords">X: 0, Y: 0</span>
                <span class="status-zoom" id="statusCanvasZoom">100%</span>
              </div>
            </footer>
          </div>

          <!-- 右パネルリサイザー -->
          <div class="panel-resizer vertical" id="resizerRight" title="ドラッグで幅を変更"></div>

          <!-- 右パネル: プレビュー & プロパティインスペクター -->
          <aside class="studio-sidebar right-sidebar" id="rightSidebar">
            <!-- Photoshop-Style ナビゲーター (完成形プレビュー & 連動ナビゲーション) -->
            <div class="ps-navigator-card" id="psNavigatorCard">
              <div class="ps-nav-tabs-bar">
                <div class="ps-nav-tab active" id="tabNavMain">ナビゲーター</div>
                <div class="ps-nav-tab" id="tabNavColor" title="カラーパレット">カラー</div>
                <div class="ps-nav-tab" id="tabNavSwatch" title="スウォッチ">スウォッチ</div>
                <div class="ps-nav-tab-actions">
                  <span class="ps-nav-action-btn" id="btnNavCollapse" title="折りたたみ">«</span>
                </div>
              </div>

              <!-- Tab 1: ナビゲーター (ビューポート & ズーム) -->
              <div class="ps-nav-panel-wrap" id="panelNavMain">
                <div class="ps-nav-viewport-wrap">
                  <div class="ps-nav-stage" id="inspectorPreviewStage" title="ドラッグでキャンバス移動、クリックで中心配置">
                    <!-- SVGプレビュー + 赤い枠線 (<rect id="navRedBox">) -->
                  </div>
                </div>
                <div class="ps-nav-bottom-bar">
                  <button type="button" class="btn-nav-fit" id="btnNavFitView" title="全体を表示 (編集中のオブジェクトをキャンバス中央に収まるサイズに調整・Ctrl+0)">🎯 全体を表示</button>
                  <div class="ps-nav-percent-box">
                    <input type="text" id="navZoomPercentInput" class="ps-nav-percent-input" value="100%" title="表示倍率 (直接入力可)">
                  </div>
                  <button type="button" class="ps-nav-mountain-btn small" id="btnNavZoomOut" title="縮小 (ズームアウト)">
                    <svg viewBox="0 0 16 12" width="14" height="11" fill="currentColor">
                      <polygon points="1,11 6,3 10,9 12,6 15,11" />
                    </svg>
                  </button>
                  <div class="ps-nav-slider-box">
                    <input type="range" id="navZoomSlider" class="ps-nav-slider" min="20" max="400" step="1" value="100" title="ズームスライダー (Photoshop形式)">
                  </div>
                  <button type="button" class="ps-nav-mountain-btn large" id="btnNavZoomIn" title="拡大 (ズームイン)">
                    <svg viewBox="0 0 20 14" width="18" height="13" fill="currentColor">
                      <polygon points="1,13 8,2 13,9 15,6 19,13" />
                    </svg>
                  </button>
                </div>
              </div>

              <!-- Tab 2: カラー (Photoshop形式 カラーピッカー) -->
              <div class="ps-nav-panel-wrap hidden" id="panelNavColor">
                <div class="ps-color-panel">
                  <div class="ps-color-chips-row">
                    <div class="ps-dual-chips-container">
                      <div class="ps-chip ps-chip-fill active" id="psChipFill" title="塗り色 (Fill) - クリックで選択">
                        <span class="ps-chip-preview" id="psChipFillPreview"></span>
                        <span class="ps-chip-label">塗り</span>
                      </div>
                      <button type="button" class="ps-chip-swap-btn" id="btnSwapFillStroke" title="塗り色と線色を入れ替え (Xキー)">⇄</button>
                      <div class="ps-chip ps-chip-stroke" id="psChipStroke" title="線色 (Stroke) - クリックで選択">
                        <span class="ps-chip-preview stroke-ring" id="psChipStrokePreview"></span>
                        <span class="ps-chip-label">線</span>
                      </div>
                    </div>
                    <div class="ps-color-quick-actions">
                      <button type="button" class="ps-color-btn-sm" id="btnColorDefault" title="デフォルト色 (白塗り/黒線)">🔲 リセット</button>
                      <button type="button" class="ps-color-btn-sm" id="btnColorNone" title="透明 / なし に設定">🚫 なし</button>
                    </div>
                  </div>

                  <div class="ps-color-controls">
                    <div class="ps-color-native-row">
                      <input type="color" id="psColorNativePicker" class="ps-color-native-input" value="#ff4488">
                      <div class="ps-hex-input-box">
                        <label>HEX:</label>
                        <input type="text" id="psColorHexInput" class="ps-color-hex" value="#ff4488" maxlength="9">
                      </div>
                    </div>

                    <div class="ps-rgb-sliders">
                      <div class="ps-slider-row">
                        <span class="rgb-lbl r">R</span>
                        <input type="range" id="psColorSliderR" min="0" max="255" value="255">
                        <span class="rgb-val" id="psColorValR">255</span>
                      </div>
                      <div class="ps-slider-row">
                        <span class="rgb-lbl g">G</span>
                        <input type="range" id="psColorSliderG" min="0" max="255" value="68">
                        <span class="rgb-val" id="psColorValG">68</span>
                      </div>
                      <div class="ps-slider-row">
                        <span class="rgb-lbl b">B</span>
                        <input type="range" id="psColorSliderB" min="0" max="255" value="136">
                        <span class="rgb-val" id="psColorValB">136</span>
                      </div>
                      <div class="ps-slider-row">
                        <span class="rgb-lbl a">不透明度</span>
                        <input type="range" id="psColorSliderA" min="0" max="100" value="100">
                        <span class="rgb-val" id="psColorValA">100%</span>
                      </div>
                    </div>

                    <div class="ps-slider-row ps-stroke-width-row">
                      <span class="rgb-lbl">線幅</span>
                      <input type="range" id="psStrokeWidthSlider" min="0" max="30" value="4">
                      <span class="rgb-val" id="psStrokeWidthVal">4px</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Tab 3: スウォッチ (パレットグリッド & マイカラー管理) -->
              <div class="ps-nav-panel-wrap hidden" id="panelNavSwatch">
                <div class="ps-swatch-panel">
                  <div class="ps-swatch-toolbar">
                    <button class="swatch-tool-btn" type="button" id="btnSwatchAddNewGroup" title="新しいスウォッチグループ（プリセット）を作成">➕ 新規プリセット</button>
                    <button class="swatch-tool-btn" type="button" id="btnSwatchImport" title="スウォッチJSONを読み込み">📥 読込</button>
                    <button class="swatch-tool-btn" type="button" id="btnSwatchExport" title="全スウォッチをJSON書き出し">📤 保存</button>
                    <button class="swatch-tool-btn" type="button" id="btnSwatchDeleteSelected" title="チェックしたプリセットを一括削除">🗑️ 選択削除</button>
                    <button class="swatch-tool-btn" type="button" id="btnSwatchResetDefault" title="スウォッチを初期状態に戻す">🔄 初期化</button>
                    <input type="file" id="swatchFileInput" accept=".json" style="display:none;">
                  </div>

                  <div class="ps-swatch-section-title">キャラクター使用色</div>
                  <div class="ps-swatch-grid" id="swatchUsedColorsGrid"></div>

                  <div class="ps-swatch-section-title">基本・海洋プリセット</div>
                  <div class="ps-swatch-grid" id="swatchPresetColorsGrid"></div>

                  <div class="ps-swatch-section-title">マイカラー (最大32色・自動増設)</div>
                  <div id="swatchCustomGroupsContainer">
                    <!-- 動的にマイカラー1, 2... のカード群を描画 -->
                  </div>
                </div>
              </div>
            </div>

            <!-- ナビゲーター・プロパティ上下リサイザー -->
            <div class="panel-resizer horizontal" id="resizerNavVertical" title="ドラッグで上下の高さを変更"></div>

            <div class="sidebar-header">
              <h3>⚙️ プロパティ</h3>
            </div>
            <!-- プロパティ タブ切替バー -->
            <div class="inspector-tab-nav" id="inspectorTabNav">
              <button class="inspector-tab-btn active" data-tab="general" title="パーツ基本属性（名前・親パーツ・原点・テキスト）">基本属性</button>
              <button class="inspector-tab-btn" data-tab="style" title="塗り・線・不透明度スタイル">塗り＆線</button>
              <button class="inspector-tab-btn" data-tab="anchor" title="選択アンカーポイント詳細">アンカー</button>
              <button class="inspector-tab-btn" data-tab="reaction" title="ゲーム内タップリアクション設定">リアクション</button>
            </div>
            <div class="inspector-content" id="inspectorContent">
              <!-- 動的生成 -->
            </div>
          </aside>
        </div>

        <!-- タイムラインリサイザー -->
        <div class="panel-resizer horizontal" id="resizerTimeline" title="ドラッグで高さを変更"></div>

        <!-- 下部: タイムライン & モーション (60Fベジェ曲線エディタ) -->
        <footer class="studio-timeline" id="studioTimeline">
          <div class="timeline-controls">
            <div class="motion-picker-group">
              <label>モーションエディター:</label>
              <select id="motionSelect" class="studio-select-sm">
                <option value="swim">🏊 通常遊泳 (Swim)</option>
                <option value="idle">💤 待機 (Idle)</option>
                <option value="flee">⚡ 逃走 (Flee)</option>
                <option value="angry">💢 怒る (Angry)</option>
              </select>
            </div>

            <button id="btnPlayPause" class="btn-play">▶ 再生</button>
            <span class="timeline-time-val" id="timelineTimeVal">
              <span class="tl-frame-scrub" id="tlFrameScrub" title="左右ドラッグでフレームシーク / クリックで手入力">0F</span>
              <span class="tl-sec-disp" id="tlSecDisp">(0.00s) / 60F</span>
            </span>

            <div class="timeline-view-tabs">
              <button id="tabDopeSheet" class="timeline-tab active">🎞️ タイムライン表示</button>
              <button id="tabGraphEditor" class="timeline-tab" title="キーフレーム表示と60Fベジェ曲線グラフ表示を切り替え">📈 グラフ表示</button>
            </div>

            <!-- 自動キーフレーム (Auto-Keyframe: Aボタン) -->
            <button id="btnAutoKeyframe" class="btn-tool-toggle active" title="自動キーフレーム (Auto-Keyframe): 数値変更時に現在フレームに自動でキーフレームを打つ/更新 (ショートカット: A)">🅰️ 自動キー</button>

            <!-- After Effects風 タイムライン ズームコントロール -->
            <div class="ae-zoom-control" title="タイムライン幅のズームイン／アウト (After Effects仕様: 小山〜大山)">
              <span class="ae-zoom-mountain small" id="btnZoomOut" title="ズームアウト (全体表示)">⛰️</span>
              <input type="range" id="tlZoomSlider" min="1" max="10" step="0.1" value="1" class="ae-zoom-slider" title="タイムラインズーム倍率 (100%〜1000%)">
              <span class="ae-zoom-mountain large" id="btnZoomIn" title="ズームイン (詳細表示)">🏔️</span>
              <span id="tlZoomValue" class="ae-zoom-val">100%</span>
            </div>

            <div class="timeline-spacer"></div>

            <button id="btnAddKeyframe" class="btn-secondary-sm">➕ キーフレーム追加 (現在F)</button>
            <button id="btnDeleteKeyframe" class="btn-secondary-sm">➖ キーフレーム削除</button>
          </div>

          <!-- Premiere Pro風 タイムライン (左右分割: 左側トラックヘッダー / 右側ルーラー＆キーフレーム / 最右端: 独立外側スクロールバー) -->
          <div class="timeline-view-area">
            <div id="timelineDopeSheetView" class="premiere-timeline-split">
              <!-- 左側ペイン: トラック名・部位情報 (幅リサイズ対応) -->
              <div class="tl-left-pane" id="tlLeftPane" style="width: 420px;">
                <div class="ae-nav-left-spacer"></div>
                <div class="tl-left-top-bar">
                  <span class="tl-pane-title">🎬 部位 / プロパティ</span>
                  <div class="tl-filter-toggle-group">
                    <button id="btnTlFilterOnly" class="tl-filter-btn active" title="選択中のパーツのみ表示 (複数選択対応)">Only</button>
                    <button id="btnTlFilterAll" class="tl-filter-btn" title="すべてのパーツを表示">ALL</button>
                  </div>
                  <span style="font-size: 10px; color: #64748b;" title="境界線を左右ドラッグして幅を自由に変更可能">↔ 項目幅伸縮可</span>
                </div>
                <div class="tl-headers-list" id="tlHeadersList"></div>
              </div>
              <!-- 左右分割リサイザー (ドラッグで左パネル幅を変更) -->
              <div class="tl-split-resizer" id="tlSplitResizer" title="左右ドラッグでトランスフォーム項目の横幅を変更"></div>
              <!-- 右側ペイン: ルーラー ＆ キーフレームトラック (左右幅・目盛・位置が100%完全一致) -->
              <div class="tl-right-pane" id="tlRightPane">
                <!-- After Effects仕様: 時間ナビゲーター (全体ミニマップ & ズーム・パン調整) -->
                <div class="ae-time-navigator-wrap" id="aeTimeNavigatorWrap" title="時間ナビゲーター (After Effects仕様): バー全体ドラッグでパン、左右の端をドラッグでズームイン/アウト">
                  <div class="ae-time-nav-track" id="aeTimeNavTrack">
                    <div class="ae-time-nav-bar" id="aeTimeNavBar">
                      <div class="ae-nav-bracket left" id="aeNavBracketLeft" title="ドラッグして表示開始フレームを変更"></div>
                      <div class="ae-nav-bar-body" id="aeNavBody" title="ドラッグして表示領域を左右にスクロール(パン)"></div>
                      <div class="ae-nav-bracket right" id="aeNavBracketRight" title="ドラッグして表示終了フレームを変更"></div>
                    </div>
                  </div>
                </div>
                <!-- 上部: タイムルーラー & CTIヘッド (中身のtlRulerContentがズーム幅に連動) -->
                <div class="tl-ruler-track" id="timelineRulerBar">
                  <div class="tl-ruler-content" id="tlRulerContent"></div>
                </div>
                <!-- 下部: トラックリスト & 縦貫通プレイヘッドライン & マーキー範囲選択枠 -->
                <div class="tl-tracks-scroll" id="tlTracksScroll">
                  <div class="tl-marquee-selection" id="tlMarqueeSelection" style="display:none;"></div>
                  <div class="tl-tracks-list" id="tlTracksList">
                    <div class="tl-playhead-line" id="tlPlayheadLine"></div>
                  </div>
                </div>
              </div>
              <!-- 独立した外側スクロールバー (コンテナの外側に配置してトラック幅への干渉を完全防止) -->
              <div class="tl-ext-scrollbar" id="tlExtScrollbar">
                <div class="tl-ext-scroll-dummy" id="tlExtScrollDummy"></div>
              </div>
            </div>
            <!-- 互換用hidden scrubber -->
            <input type="range" id="timelineScrubber" min="0" max="60" step="1" value="0" style="display:none;">

            <!-- 2. 60Fベジェ曲線グラフエディタ -->
            <div id="timelineGraphView" class="timeline-graph-container" style="display:none;">
              <div class="graph-toolbar">
                <span class="graph-prop-label">編集対象:</span>
                <select id="graphPropertySelect" class="studio-select-sm">
                  <option value="rot">🔄 回転角度 (Rotation)</option>
                  <option value="tx">↔️ X方向移動 (Translate X)</option>
                  <option value="ty">↕️ Y方向移動 (Translate Y)</option>
                </select>

                <div class="graph-preset-group">
                  <span class="preset-label">イージング曲線:</span>
                  <button class="btn-preset-curve" data-ease="easeIn">Ease In</button>
                  <button class="btn-preset-curve" data-ease="easeOut">Ease Out</button>
                  <button class="btn-preset-curve" data-ease="easeInOut">Ease In-Out</button>
                  <button class="btn-preset-curve" data-ease="fastStart">急加速</button>
                  <button class="btn-preset-curve" data-ease="linear">リニア(直線)</button>
                </div>
              </div>
              <div class="graph-canvas-box" id="graphCanvasBox">
                <!-- SVGベジェグラフ -->
              </div>
            </div>
          </div>
          <!-- タイムライン下端リサイザー (下方向へ自由に縦幅を拡大) -->
          <div class="timeline-resizer-bottom" id="resizerTimelineBottom" title="ドラッグしてタイムラインを下方向に広げる"></div>
        </footer>

        <!-- ショートカット一覧モーダル (別窓/ポップアップ対応) -->
        <div id="shortcutsModal" class="studio-modal-backdrop hidden">
          <div class="studio-modal-card">
            <div class="studio-modal-header">
              <div class="modal-title-wrap">
                <span class="modal-title">⌨️ 操作 ＆ ショートカットキー一覧</span>
                <span class="badge-photoshop">Photoshop準拠</span>
              </div>
              <div class="modal-actions">
                <button id="btnOpenNewWindow" class="btn-modal-action" title="独立した別ブラウザウィンドウで開く">↗ 別窓で開く</button>
                <button id="btnCloseShortcuts" class="btn-modal-close" title="閉じる (Esc)">✕</button>
              </div>
            </div>
            <div class="studio-modal-body">
              <iframe src="/shortcuts.html" class="shortcuts-iframe" title="ショートカット一覧"></iframe>
            </div>
          </div>
        </div>

        <!-- 💾 キャラクター保存 ＆ ゲーム適用ダイアログ (既存上書き or 新規登録) -->
        <div id="saveCharacterModal" class="studio-modal-backdrop hidden">
          <div class="studio-modal-card save-dialog-card">
            <div class="studio-modal-header">
              <div class="modal-title-wrap">
                <span class="modal-title">💾 キャラクターの保存とゲーム適用</span>
                <span class="badge-photoshop">ゲーム連携</span>
              </div>
              <button id="btnCloseSaveModal" class="btn-modal-close" title="閉じる (Esc)">✕</button>
            </div>
            <div class="studio-modal-body save-dialog-body">
              <p class="save-desc">カスタマイズしたキャラクターの保存・登録方法を選択してください：</p>
              
              <div class="save-option-list">
                <!-- 選択肢 1: 既存魚種への上書き -->
                <label class="save-option-row">
                  <input type="radio" name="saveModeRadio" value="overwrite" checked>
                  <div class="save-option-details">
                    <span class="save-option-title">既存キャラクターに上書き保存</span>
                    <span class="save-option-sub">対象魚種のグラフィックとアニメーションをゲーム内で置き換えます。</span>
                    <div class="save-select-wrap">
                      <label>上書き対象の魚種:</label>
                      <select id="saveOverwriteTargetSelect" class="studio-select save-select">
                        <optgroup label="🐟 水生生物">
                          <option value="hirame">🐟 ヒラメ (ターゲット・左向き)</option>
                          <option value="karei">🐟 カレイ (ターゲット・右向き)</option>
                          <option value="octopus">🐙 タコ (邪魔キャラ・墨吐き)</option>
                          <option value="squid">🦑 イカ (邪魔キャラ・高速ジェット)</option>
                          <option value="stingray">🌊 エイ (邪魔キャラ・巨大影)</option>
                          <option value="aji_open">🐟 アジの開き (罠・干物ボーン)</option>
                          <option value="shitabirame">👞 ウシノシタ (舌平目・靴底型)</option>
                        </optgroup>
                        <optgroup label="🧬 多様体・新骨格">
                          <option value="human">🧍 人間 (頭部・胴体・手足)</option>
                          <option value="quadruped">🐕 ４足歩行 (トロット・尻尾)</option>
                          <option value="biped">🦖 ２足歩行 (大顎・強靭脚)</option>
                          <option value="insect">🪲 昆虫 (翅羽ばたき・6本足)</option>
                          <option value="spider">🕷️ 蜘蛛 (8眼・8足波状歩行)</option>
                          <option value="bird">🦅 鳥 (大羽ばたき・滑空)</option>
                        </optgroup>
                      </select>
                    </div>
                  </div>
                </label>

                <!-- 選択肢 2: 新規キャラとして登録 -->
                <label class="save-option-row">
                  <input type="radio" name="saveModeRadio" value="new">
                  <div class="save-option-details">
                    <span class="save-option-title">新規キャラクターとして登録</span>
                    <span class="save-option-sub">新しいオリジナルキャラとして登録し、プリセット選択肢に自動追加します。</span>
                    <div class="save-input-wrap">
                      <label>新規キャラクター名:</label>
                      <input type="text" id="saveNewCharName" class="studio-input" placeholder="例: 黄金のヒラメ王" value="">
                    </div>
                  </div>
                </label>
              </div>
            </div>
            <div class="studio-modal-footer">
              <button id="btnCancelSave" class="tool-btn">キャンセル</button>
              <button id="btnConfirmSave" class="btn-action-primary">💾 保存してゲームに適用</button>
            </div>
          </div>
        </div>

        <!-- ➕ 新規キャラクター作成（ベース骨格プリセット選択モーダル） -->
        <div id="presetPickerModal" class="studio-modal-backdrop hidden">
          <div class="studio-modal-card preset-picker-dialog">
            <div class="studio-modal-header">
              <div class="modal-title-wrap">
                <span class="modal-title">➕ 新規キャラクター作成（ベース骨格・アニメーション選択）</span>
                <span class="badge-photoshop">13種リグ搭載</span>
              </div>
              <button id="btnClosePresetPicker" class="btn-modal-close" title="閉じる (Esc)">✕</button>
            </div>
            <div class="studio-modal-body" style="padding: 16px; overflow-y: auto;">
              <p class="save-desc" style="margin-bottom:12px;">作成したいキャラクターのベース骨格・パーツ・アニメーションのプリセットを選択してください。<br>選択した骨格のパーツ構造・親子階層リグ・アニメーションが自動セットアップされ、すぐにカスタマイズできます。</p>
              <div class="preset-picker-grid">
                <!-- 13 Base Presets + Blank -->
                <div class="preset-card" data-preset="hirame">
                  <div class="preset-card-header">
                    <span class="preset-card-icon">🐟</span>
                    <span class="preset-card-badge">ターゲット魚</span>
                  </div>
                  <div class="preset-card-title">ヒラメ (左向き)</div>
                  <div class="preset-card-desc">左向き魚類ベース。大きく突出した受け口と鋭いキバ、波打つ背びれ・腹びれ・尾びれリグ。</div>
                  <div class="preset-card-meta">
                    <span class="preset-meta-tag">水泳アニメ</span>
                    <span class="preset-meta-tag">階層リグ</span>
                  </div>
                </div>

                <div class="preset-card" data-preset="karei">
                  <div class="preset-card-header">
                    <span class="preset-card-icon">🐟</span>
                    <span class="preset-card-badge">ターゲット魚</span>
                  </div>
                  <div class="preset-card-title">カレイ (右向き)</div>
                  <div class="preset-card-desc">右向き魚類ベース。おちょぼ口と2つの目玉、波打つ背びれ・腹びれ・尾びれリグ。</div>
                  <div class="preset-card-meta">
                    <span class="preset-meta-tag">水泳アニメ</span>
                    <span class="preset-meta-tag">2眼ソケット</span>
                  </div>
                </div>

                <div class="preset-card" data-preset="octopus">
                  <div class="preset-card-header">
                    <span class="preset-card-icon">🐙</span>
                    <span class="preset-card-badge">邪魔キャラ</span>
                  </div>
                  <div class="preset-card-title">タコ (触手型)</div>
                  <div class="preset-card-desc">丸い頭部と8本のうねる触手リグ。タコスミ噴射アクション＆吸盤模様パーツ。</div>
                  <div class="preset-card-meta">
                    <span class="preset-meta-tag">触手うねり</span>
                    <span class="preset-meta-tag">スミ噴射</span>
                  </div>
                </div>

                <div class="preset-card" data-preset="squid">
                  <div class="preset-card-header">
                    <span class="preset-card-icon">🦑</span>
                    <span class="preset-card-badge">邪魔キャラ</span>
                  </div>
                  <div class="preset-card-title">イカ (高速ロケット型)</div>
                  <div class="preset-card-desc">三角エンペラと流線型ボディ、推進触腕リグ。高速ジェット脱出＆スミ煙アニメ。</div>
                  <div class="preset-card-meta">
                    <span class="preset-meta-tag">高速ジェット</span>
                    <span class="preset-meta-tag">イカスミ</span>
                  </div>
                </div>

                <div class="preset-card" data-preset="stingray">
                  <div class="preset-card-header">
                    <span class="preset-card-icon">🌊</span>
                    <span class="preset-card-badge">邪魔キャラ</span>
                  </div>
                  <div class="preset-card-title">エイ (大ヒレ波打ち型)</div>
                  <div class="preset-card-desc">巨大な菱形扁平ボディと長い尾針リグ。両翼ヒレの雄大な波打ちアニメーション。</div>
                  <div class="preset-card-meta">
                    <span class="preset-meta-tag">ヒレ波打ち</span>
                    <span class="preset-meta-tag">巨大シルエット</span>
                  </div>
                </div>

                <div class="preset-card" data-preset="aji_open">
                  <div class="preset-card-header">
                    <span class="preset-card-icon">🐟</span>
                    <span class="preset-card-badge">ひっかけ罠</span>
                  </div>
                  <div class="preset-card-title">アジの開き (干物型)</div>
                  <div class="preset-card-desc">左右に開いた身と白い背骨芯、繊細な放射状肋骨リグ。干物特有のユラユラアニメ。</div>
                  <div class="preset-card-meta">
                    <span class="preset-meta-tag">干物骨格</span>
                    <span class="preset-meta-tag">小骨階層</span>
                  </div>
                </div>

                <div class="preset-card" data-preset="shitabirame">
                  <div class="preset-card-header">
                    <span class="preset-card-icon">👞</span>
                    <span class="preset-card-badge">ひっかけ罠</span>
                  </div>
                  <div class="preset-card-title">ウシノシタ (舌平目・靴底型)</div>
                  <div class="preset-card-desc">靴底のような細長い楕円ボディと全周ヒレリグ。海底砂底を這うような遊泳アニメ。</div>
                  <div class="preset-card-meta">
                    <span class="preset-meta-tag">砂底這い</span>
                    <span class="preset-meta-tag">靴底フォルム</span>
                  </div>
                </div>

                <div class="preset-card" data-preset="human">
                  <div class="preset-card-header">
                    <span class="preset-card-icon">🚶</span>
                    <span class="preset-card-badge">新骨格リグ</span>
                  </div>
                  <div class="preset-card-title">人間 (2足歩行・人型)</div>
                  <div class="preset-card-desc">頭部・胴体・両腕(上腕/前腕/手)・両脚(太もも/すね/足)の全身IK対応フルリグ。腕振りと膝曲げ歩行サイクル。</div>
                  <div class="preset-card-meta">
                    <span class="preset-meta-tag">2足歩行</span>
                    <span class="preset-meta-tag">四肢リグ</span>
                  </div>
                </div>

                <div class="preset-card" data-preset="quadruped">
                  <div class="preset-card-header">
                    <span class="preset-card-icon">🐕</span>
                    <span class="preset-card-badge">新骨格リグ</span>
                  </div>
                  <div class="preset-card-title">４足歩行 (犬猫動物型)</div>
                  <div class="preset-card-desc">胴体・首・頭部・尻尾・4本の肢リグ。対角の脚が連動するリアルなトロット歩行サイクル＆しっぽ振り。</div>
                  <div class="preset-card-meta">
                    <span class="preset-meta-tag">4足トロット</span>
                    <span class="preset-meta-tag">しっぽ振り</span>
                  </div>
                </div>

                <div class="preset-card" data-preset="biped">
                  <div class="preset-card-header">
                    <span class="preset-card-icon">🦖</span>
                    <span class="preset-card-badge">新骨格リグ</span>
                  </div>
                  <div class="preset-card-title">２足歩行 (恐竜・怪獣型)</div>
                  <div class="preset-card-desc">前傾胸部・大頭部・開閉下顎・2段大尻尾・強靭な太ももリグ。重量感あふれるドッシリ歩行＆咆哮アニメ。</div>
                  <div class="preset-card-meta">
                    <span class="preset-meta-tag">怪獣ストンプ</span>
                    <span class="preset-meta-tag">大顎開閉</span>
                  </div>
                </div>

                <div class="preset-card" data-preset="insect">
                  <div class="preset-card-header">
                    <span class="preset-card-icon">🪲</span>
                    <span class="preset-card-badge">画像準拠</span>
                  </div>
                  <div class="preset-card-title">昆虫 (クワガタ・大顎)</div>
                  <div class="preset-card-desc">湾曲した大顎ハサミ、可愛い白黒目、前胸甲殻と上翅スプリット、6本の屈折脚リグ。大顎威嚇＆6脚歩行。</div>
                  <div class="preset-card-meta">
                    <span class="preset-meta-tag">大顎開閉</span>
                    <span class="preset-meta-tag">6脚歩行</span>
                  </div>
                </div>

                <div class="preset-card" data-preset="spider">
                  <div class="preset-card-header">
                    <span class="preset-card-icon">🕷️</span>
                    <span class="preset-card-badge">画像準拠</span>
                  </div>
                  <div class="preset-card-title">蜘蛛 (8脚オオグモ・黒甲殻)</div>
                  <div class="preset-card-desc">黒光りする甲殻、腹部の2本黒ストライプ、中胸カラー、三日月斑紋、2本の毒牙、8本の屈折長脚リグ。</div>
                  <div class="preset-card-meta">
                    <span class="preset-meta-tag">8脚波状歩行</span>
                    <span class="preset-meta-tag">毒牙威嚇</span>
                  </div>
                </div>

                <div class="preset-card" data-preset="bird">
                  <div class="preset-card-header">
                    <span class="preset-card-icon">🐦</span>
                    <span class="preset-card-badge">画像準拠</span>
                  </div>
                  <div class="preset-card-title">鳥 (青い鳥・フラットベクター)</div>
                  <div class="preset-card-desc">水色の流線型ボディ、パステルブルーの跳ね翼、黄色い三角くちばし、つぶらな瞳。優雅な羽ばたき＆宙返り。</div>
                  <div class="preset-card-meta">
                    <span class="preset-meta-tag">大空羽ばたき</span>
                    <span class="preset-meta-tag">宙返り</span>
                  </div>
                </div>

                <div class="preset-card" data-preset="kanji_hirame">
                  <div class="preset-card-header">
                    <span class="preset-card-icon">鮃</span>
                    <span class="preset-card-badge">フォントキャラ</span>
                  </div>
                  <div class="preset-card-title">漢字「鮃」 (ヒラメ)</div>
                  <div class="preset-card-desc">「鮃」のフォント文字がキャラクターとして生き生きと泳ぐ！通常移動・待機・逃走・怒るアニメーション完全対応。</div>
                  <div class="preset-card-meta">
                    <span class="preset-meta-tag">左向き魚</span>
                    <span class="preset-meta-tag">文字リグ</span>
                  </div>
                </div>

                <div class="preset-card" data-preset="kanji_karei_1">
                  <div class="preset-card-header">
                    <span class="preset-card-icon">鰈</span>
                    <span class="preset-card-badge">フォントキャラ</span>
                  </div>
                  <div class="preset-card-title">漢字「鰈」 (カレイ)</div>
                  <div class="preset-card-desc">「鰈」の文字が右向きカレイとして海底をスライド遊泳！通常移動・待機・逃走・怒るアニメーション完備。</div>
                  <div class="preset-card-meta">
                    <span class="preset-meta-tag">右向き魚</span>
                    <span class="preset-meta-tag">文字リグ</span>
                  </div>
                </div>

                <div class="preset-card" data-preset="kanji_karei_2">
                  <div class="preset-card-header">
                    <span class="preset-card-icon">魪</span>
                    <span class="preset-card-badge">フォントキャラ</span>
                  </div>
                  <div class="preset-card-title">漢字「魪」 (カレイ・魪)</div>
                  <div class="preset-card-desc">「魪」の文字が右向きカレイとして登場！通常移動・待機・逃走・怒るアニメーション完備。</div>
                  <div class="preset-card-meta">
                    <span class="preset-meta-tag">右向き魚</span>
                    <span class="preset-meta-tag">文字リグ</span>
                  </div>
                </div>

                <div class="preset-card" data-preset="blank">
                  <div class="preset-card-header">
                    <span class="preset-card-icon">📄</span>
                    <span class="preset-card-badge">白紙</span>
                  </div>
                  <div class="preset-card-title">空白から作成</div>
                  <div class="preset-card-desc">ベースなしの白紙状態から、ペンツールや図形ツールを使って完全に自由なパーツをゼロから構築します。</div>
                  <div class="preset-card-meta">
                    <span class="preset-meta-tag">自由描画</span>
                    <span class="preset-meta-tag">白紙キャンバス</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="studio-modal-footer">
              <button id="btnCancelPresetPicker" class="tool-btn">キャンセル</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  initAiGenerator() {
    this.aiGenerator = new AiCharacterGenerator(this);
    this.aiGenerator.init();
    this.container.querySelector('#btnOpenAiGenerator')?.addEventListener('click', () => {
      this.aiGenerator.open();
    });
  }

  // ========================================================
  // Photoshop仕様 ツールボックス初期化 & イベント制御
  // ========================================================
  initToolbox() {
    const slotsContainer = this.container.querySelector('#psToolboxSlots');
    if (!slotsContainer) return;

    slotsContainer.innerHTML = STUDIO_TOOLBOX_GROUPS.map(g => {
      const activeToolId = this.slotActiveTools[g.groupId] || g.defaultTool;
      const activeTool = ALL_TOOLS_MAP[activeToolId] || ALL_TOOLS_MAP[g.defaultTool];
      const hasSubTools = g.tools.length > 1;

      const flyoutHtml = hasSubTools ? `
        <div class="ps-tool-flyout">
          ${g.tools.map(t => `
            <div class="ps-flyout-item ${t.id === activeToolId ? 'active' : ''}" data-tool="${t.id}" title="${t.fullName} (${t.shortcut})">
              <span class="flyout-icon">${t.icon}</span>
              <span class="flyout-name">${t.fullName}</span>
              <span class="flyout-shortcut">${t.shortcut}</span>
            </div>
          `).join('')}
        </div>
      ` : '';

      return `
        <div class="ps-tool-slot ${g.groupId === ALL_TOOLS_MAP[this.activeStudioTool]?.groupId ? 'active' : ''}" data-group="${g.groupId}">
          <button class="ps-tool-btn ${this.activeStudioTool === activeToolId ? 'active' : ''}" data-tool="${activeToolId}" title="${activeTool.fullName} (${activeTool.shortcut}) - 長押し・右クリックで切替">
            <span class="ps-tool-icon">${activeTool.icon}</span>
            ${hasSubTools ? '<span class="ps-tool-triangle">◢</span>' : ''}
          </button>
          ${flyoutHtml}
        </div>
      `;
    }).join('');

    this.bindToolboxEvents();
    this.updateCanvasStatusBar();
  }

  bindToolboxEvents() {
    const slots = this.container.querySelectorAll('.ps-tool-slot');
    const closeAllFlyouts = () => {
      this.container.querySelectorAll('.ps-tool-flyout.open').forEach(f => f.classList.remove('open'));
    };

    slots.forEach(slot => {
      const btn = slot.querySelector('.ps-tool-btn');
      const flyout = slot.querySelector('.ps-tool-flyout');
      let pressTimer = null;
      let isLongPress = false;
      let suppressNextClick = false;

      const openFlyout = () => {
        if (!flyout) return;
        closeAllFlyouts();
        flyout.classList.add('open');
      };

      if (btn) {
        btn.addEventListener('mousedown', (e) => {
          if (e.button === 0) { // 左クリック
            isLongPress = false;
            suppressNextClick = false;
            pressTimer = setTimeout(() => {
              isLongPress = true;
              suppressNextClick = true;
              openFlyout();
            }, 260); // 260ms長押しでフライアウトメニュー展開
          }
        });

        btn.addEventListener('mouseup', (e) => {
          if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
          }
          if (e.button === 0) {
            if (isLongPress) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            if (flyout && flyout.classList.contains('open')) {
              closeAllFlyouts();
            } else {
              this.selectStudioTool(btn.dataset.tool);
            }
          }
        });

        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (suppressNextClick) {
            suppressNextClick = false;
            return;
          }
        });

        btn.addEventListener('mouseleave', () => {
          if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
          }
        });

        btn.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (pressTimer) clearTimeout(pressTimer);
          if (flyout) {
            openFlyout();
          } else {
            this.selectStudioTool(btn.dataset.tool);
          }
        });
      }

      if (flyout) {
        flyout.querySelectorAll('.ps-flyout-item').forEach(item => {
          const chooseItem = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const toolId = item.dataset.tool;
            if (toolId) {
              this.selectStudioTool(toolId);
            }
            closeAllFlyouts();
          };

          // 通常クリックでの選択
          item.addEventListener('click', chooseItem);

          // 長押しドラッグでアイテム上でマウスを離した際の選択
          item.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
              chooseItem(e);
            }
          });
        });
      }
    });

    // ドキュメントクリックでフライアウトを閉じる
    window.addEventListener('click', (e) => {
      if (!e.target.closest('.ps-tool-slot')) {
        closeAllFlyouts();
      }
    });

    // ステータスバーのインジケータークリック連動
    const snapInd = this.container.querySelector('#statusSnapIndicator');
    snapInd?.addEventListener('click', () => {
      const btn = this.container.querySelector('#btnSnapToggle');
      btn?.click();
    });

    const silInd = this.container.querySelector('#statusSilIndicator');
    silInd?.addEventListener('click', () => {
      const btn = this.container.querySelector('#btnSilhouetteToggle');
      btn?.click();
    });

    const facingInd = this.container.querySelector('#statusFacingIndicator');
    facingInd?.addEventListener('click', () => {
      const btn = this.container.querySelector('#btnFacingToggle');
      btn?.click();
    });

    // キャンバス上のマウス移動でリアルタイム座標更新
    const stage = this.container.querySelector('#studioCanvasStage');
    stage?.addEventListener('mousemove', (e) => {
      const coordsEl = this.container.querySelector('#statusCanvasCoords');
      if (!coordsEl || !this.editor) return;
      const rect = stage.getBoundingClientRect();
      const rawX = e.clientX - rect.left - (this.editor.panX || 0);
      const rawY = e.clientY - rect.top - (this.editor.panY || 0);
      const zoom = this.editor.zoom || 1.0;
      const x = Math.round(rawX / zoom);
      const y = Math.round(rawY / zoom);
      coordsEl.textContent = `X: ${x}, Y: ${y}`;
    });
  }

  selectStudioTool(toolName) {
    const toolInfo = ALL_TOOLS_MAP[toolName];
    if (!toolInfo) return;
    if (this._isSelectingTool) return;
    this._isSelectingTool = true;

    try {
      // 1. 他ツール選択時は自由変形モードを確実に終了
      if (this.editor.isTransformMode && toolName !== 'transform') {
        this.editor.isTransformMode = false;
        this.editor.transformInitialSnapshot = null;
        this.editor.renderOverlay();
        const btnTransform = this.container.querySelector('#btnTransformToggle');
        btnTransform?.classList.remove('active');
      }

      // 2. 自由変形ツールのトグル処理
      if (toolName === 'transform') {
        if (this.editor.isTransformMode) {
          this.editor.isTransformMode = false;
          this.editor.transformInitialSnapshot = null;
          this.editor.renderOverlay();
          const prev = this.editor.previousToolBeforeTransform || 'select';
          this.selectStudioTool(prev);
          return;
        } else {
          this.editor.previousToolBeforeTransform = this.editor.currentTool || 'select';
          this.editor.toggleTransformMode(true);
        }
      } else {
        this.editor.setTool(toolName);
      }

      // 3. アクティブツール状態の更新
      this.activeStudioTool = toolName;
      this.slotActiveTools[toolInfo.groupId] = toolName;
      this.updateToolboxActiveStates();
      this.updateCanvasStatusBar(toolName);
    } finally {
      this._isSelectingTool = false;
    }
  }

  updateToolboxActiveStates() {
    const curTool = this.activeStudioTool;
    const toolInfo = ALL_TOOLS_MAP[curTool];
    if (!toolInfo) return;

    STUDIO_TOOLBOX_GROUPS.forEach(g => {
      const slotEl = this.container.querySelector(`.ps-tool-slot[data-group="${g.groupId}"]`);
      if (!slotEl) return;
      const activeSubTool = this.slotActiveTools[g.groupId] || g.defaultTool;
      const subToolInfo = ALL_TOOLS_MAP[activeSubTool] || ALL_TOOLS_MAP[g.defaultTool];

      const isGroupActive = (g.groupId === toolInfo.groupId);
      slotEl.classList.toggle('active', isGroupActive);

      const btn = slotEl.querySelector('.ps-tool-btn');
      if (btn) {
        btn.dataset.tool = activeSubTool;
        btn.title = `${subToolInfo.fullName} (${subToolInfo.shortcut}) - 長押し・右クリックで切替`;
        btn.classList.toggle('active', isGroupActive);
        const iconSpan = btn.querySelector('.ps-tool-icon');
        if (iconSpan) iconSpan.textContent = subToolInfo.icon;
      }

      slotEl.querySelectorAll('.ps-flyout-item').forEach(item => {
        // ★フライアウト内のアクティブは、現在選択中のツール（curTool）そのものに完全一致！
        item.classList.toggle('active', item.dataset.tool === curTool);
      });
    });

    const btnTransform = this.container.querySelector('#btnTransformToggle');
    if (btnTransform) btnTransform.classList.toggle('active', curTool === 'transform' || !!this.editor?.isTransformMode);

    const btnSnap = this.container.querySelector('#btnSnapToggle');
    if (btnSnap) btnSnap.classList.toggle('active', !!this.editor?.snapToGrid);

    const btnSil = this.container.querySelector('#btnSilhouetteToggle');
    if (btnSil) btnSil.classList.toggle('active', !!this.editor?.isSilhouetteMode);
  }


  updateCanvasStatusBar(toolName = this.activeStudioTool) {
    const toolInfo = ALL_TOOLS_MAP[toolName];
    const nameEl = this.container.querySelector('#statusActiveToolName');
    const descEl = this.container.querySelector('#statusActiveToolDesc');
    const snapEl = this.container.querySelector('#statusSnapIndicator');
    const silEl = this.container.querySelector('#statusSilIndicator');
    const facingEl = this.container.querySelector('#statusFacingIndicator');

    if (toolInfo) {
      if (nameEl) nameEl.textContent = `${toolInfo.icon} ${toolInfo.name}`;
      if (descEl) descEl.textContent = `${toolInfo.desc} (${toolInfo.shortcut})`;
    }

    if (snapEl) {
      const isSnap = !!this.editor?.snapToGrid;
      snapEl.textContent = `🧲 スナップ: ${isSnap ? 'ON' : 'OFF'}`;
      snapEl.classList.toggle('active', isSnap);
    }

    if (silEl) {
      const isSil = !!this.editor?.isSilhouetteMode;
      silEl.textContent = `🌑 シルエット: ${isSil ? 'ON' : 'OFF'}`;
      silEl.classList.toggle('active', isSil);
    }

    if (facingEl) {
      const facing = this.editor?.previewFacing || 1;
      facingEl.textContent = `↔️ 向き: ${facing === -1 ? '反転中' : '通常'}`;
      facingEl.classList.toggle('active', facing === -1);
    }
  }

  // ========================================================
  // Premiere仕様 ビン (Bins) 管理システム
  // ========================================================
  initBins() {
    this.bins = this.getBins();

    // タブ切替
    const tabBins = this.container.querySelector('#tabSidebarBins');
    const tabLayers = this.container.querySelector('#tabSidebarLayers');
    const panelBins = this.container.querySelector('#panelSidebarBins');
    const panelLayers = this.container.querySelector('#panelSidebarLayers');

    const switchTab = (tab) => {
      this.activeSidebarTab = tab;
      tabBins?.classList.toggle('active', tab === 'bins');
      tabLayers?.classList.toggle('active', tab === 'layers');
      panelBins?.classList.toggle('hidden', tab !== 'bins');
      panelLayers?.classList.toggle('hidden', tab !== 'layers');
    };

    tabBins?.addEventListener('click', () => switchTab('bins'));
    tabLayers?.addEventListener('click', () => switchTab('layers'));

    // 新規ビン追加ボタン
    this.container.querySelector('#btnAddNewBin')?.addEventListener('click', () => {
      this.addBin();
    });

    // 展開 / 折畳トグル
    this.container.querySelector('#btnToggleAllBins')?.addEventListener('click', () => {
      const anyClosed = this.bins.some(b => !b.isOpen);
      this.bins.forEach(b => { b.isOpen = anyClosed; });
      this.saveBins(this.bins);
      this.renderBinTree();
    });

    // 検索入力
    const searchInput = this.container.querySelector('#binSearchInput');
    searchInput?.addEventListener('input', (e) => {
      this.renderBinTree(e.target.value);
    });

    // ── メニューバー (メニュー ▾) ドロップダウン制御 ──
    this.selectedBinItems = []; // 選択中のプリセット/ビン { type: 'preset'|'bin', id, binId, name, isCustom }

    const menuTrigger = this.container.querySelector('#btnBinMenuTrigger');
    const menuDropdown = this.container.querySelector('#binDropdownMenu');

    menuTrigger?.addEventListener('click', (e) => {
      e.stopPropagation();
      menuDropdown?.classList.toggle('hidden');
      this.updateBinMenuState();
    });

    // ドキュメントクリックでドロップダウンを閉じる
    window.addEventListener('click', (e) => {
      if (!e.target.closest('.bin-menu-wrap')) {
        menuDropdown?.classList.add('hidden');
      }
    });

    // メニュー: 編集
    this.container.querySelector('#binMenuEdit')?.addEventListener('click', () => {
      menuDropdown?.classList.add('hidden');
      const presetItem = this.selectedBinItems.find(it => it.type === 'preset');
      if (presetItem) {
        this.loadPresetById(presetItem.id);
      }
    });

    // メニュー: コピーして新規作成
    this.container.querySelector('#binMenuDuplicate')?.addEventListener('click', () => {
      menuDropdown?.classList.add('hidden');
      const presetItems = this.selectedBinItems.filter(it => it.type === 'preset');
      if (presetItems.length > 0) {
        presetItems.forEach(it => this.duplicateCharacterQuick(it.id));
      }
    });

    // メニュー: 別のビンへ移動
    this.container.querySelector('#binMenuMove')?.addEventListener('click', () => {
      menuDropdown?.classList.add('hidden');
      const presetItems = this.selectedBinItems.filter(it => it.type === 'preset');
      if (presetItems.length === 1) {
        this.promptMoveCharacter(presetItems[0].id, presetItems[0].binId);
      } else if (presetItems.length > 1) {
        this.promptMoveMultipleCharacters(presetItems.map(it => it.id));
      }
    });

    // メニュー: 削除 (※新規作成プリセットに限り削除可能)
    this.container.querySelector('#binMenuDelete')?.addEventListener('click', () => {
      menuDropdown?.classList.add('hidden');
      this.deleteSelectedPresets();
    });

    // トップバーのブレッドクラムクリックでビン一覧へジャンプ
    this.container.querySelector('#activeBinBreadcrumb')?.addEventListener('click', () => {
      switchTab('bins');
      const curId = this.character?.id;
      if (curId) {
        const curBin = this.bins.find(b => b.charIds?.includes(curId));
        if (curBin && !curBin.isOpen) {
          curBin.isOpen = true;
          this.saveBins(this.bins);
          this.renderBinTree();
        }
        const activeItem = this.container.querySelector(`.bin-char-item[data-char-id="${curId}"]`);
        activeItem?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    this.renderBinTree();
  }

  getBins() {
    let bins = null;
    try {
      const saved = localStorage.getItem('hirame_studio_bins');
      if (saved) bins = JSON.parse(saved);
    } catch (e) {
      console.warn("Failed to read bins", e);
    }
    if (!bins || !Array.isArray(bins) || bins.length === 0) {
      bins = JSON.parse(JSON.stringify(DEFAULT_BINS));
    }

    const allAssignedIds = new Set();
    bins.forEach(b => {
      if (Array.isArray(b.charIds)) {
        b.charIds.forEach(id => allAssignedIds.add(id));
      } else {
        b.charIds = [];
      }
    });

    // 公式ベースプリセットの漏れチェック
    Object.keys(BASE_PRESETS).forEach(id => {
      if (!allAssignedIds.has(id)) {
        const aquatic = bins.find(b => b.id === 'bin_aquatic');
        if (aquatic) aquatic.charIds.push(id);
        allAssignedIds.add(id);
      }
    });

    // カスタムキャラの漏れチェック
    const roster = this.getRoster();
    const customKeys = Object.keys(roster).filter(k => !BASE_PRESETS[k]);
    let customBin = bins.find(b => b.id === 'bin_custom');
    if (!customBin && customKeys.length > 0) {
      customBin = { id: 'bin_custom', name: 'マイカスタム', isOpen: true, charIds: [] };
      bins.push(customBin);
    }
    customKeys.forEach(k => {
      if (!allAssignedIds.has(k)) {
        customBin.charIds.push(k);
        allAssignedIds.add(k);
      }
    });

    return bins;
  }

  saveBins(bins) {
    try {
      localStorage.setItem('hirame_studio_bins', JSON.stringify(bins));
    } catch (e) {
      console.warn("Failed to save bins", e);
    }
  }

  renderBinTree(searchQuery = '') {
    const container = this.container.querySelector('#binTreeContainer');
    if (!container) return;

    container.innerHTML = '';
    const q = (searchQuery || '').trim().toLowerCase();
    const roster = this.getRoster();
    const curCharId = this.character?.id;

    this.bins.forEach((bin, binIndex) => {
      let filteredCharIds = bin.charIds || [];
      if (q) {
        filteredCharIds = filteredCharIds.filter(id => {
          const info = getPresetLabel(id, roster);
          return id.toLowerCase().includes(q) || info.name.toLowerCase().includes(q);
        });
        if (filteredCharIds.length === 0 && !bin.name.toLowerCase().includes(q)) {
          return;
        }
      }

      const isOpen = q ? true : !!bin.isOpen;
      const binGroup = document.createElement('div');
      binGroup.className = 'bin-group';
      binGroup.dataset.binId = bin.id;

      const headerRow = document.createElement('div');
      headerRow.className = 'bin-header-row';
      headerRow.title = `ビン: ${bin.name} (ドラッグ＆ドロップでキャラクター移動可能)`;

      headerRow.innerHTML = `
        <div class="bin-header-left">
          <span class="bin-toggle-icon">${isOpen ? '📂' : '📁'}</span>
          <span class="bin-title" title="${bin.name}">${bin.name}</span>
          <span class="bin-count">(${filteredCharIds.length})</span>
        </div>
        <div class="bin-header-actions">
          <button class="btn-bin-mini btn-bin-up" title="ビンを上に移動" ${binIndex === 0 ? 'disabled style="opacity:0.3;"' : ''}>▲</button>
          <button class="btn-bin-mini btn-bin-down" title="ビンを下に移動" ${binIndex === this.bins.length - 1 ? 'disabled style="opacity:0.3;"' : ''}>▼</button>
          <button class="btn-bin-mini btn-bin-rename" title="ビン名変更">✏️</button>
          <button class="btn-bin-mini btn-bin-delete" title="ビン削除">🗑️</button>
        </div>
      `;

      headerRow.addEventListener('click', (e) => {
        if (e.target.closest('.btn-bin-mini')) return;
        bin.isOpen = !bin.isOpen;
        this.saveBins(this.bins);
        this.renderBinTree(searchQuery);
      });

      headerRow.querySelector('.btn-bin-up')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.moveBin(bin.id, -1);
      });
      headerRow.querySelector('.btn-bin-down')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.moveBin(bin.id, 1);
      });
      headerRow.querySelector('.btn-bin-rename')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.renameBin(bin.id);
      });
      headerRow.querySelector('.btn-bin-delete')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteBin(bin.id);
      });

      headerRow.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        headerRow.classList.add('drag-over');
      });
      headerRow.addEventListener('dragleave', () => {
        headerRow.classList.remove('drag-over');
      });
      headerRow.addEventListener('drop', (e) => {
        e.preventDefault();
        headerRow.classList.remove('drag-over');
        try {
          const raw = e.dataTransfer.getData('text/plain');
          if (raw) {
            const data = JSON.parse(raw);
            if (data.charId && data.fromBinId) {
              this.moveCharacterToBin(data.charId, data.fromBinId, bin.id);
            }
          }
        } catch (err) {
          console.warn('Drop error', err);
        }
      });

      binGroup.appendChild(headerRow);

      if (isOpen) {
        const listEl = document.createElement('div');
        listEl.className = 'bin-char-list';

        if (filteredCharIds.length === 0) {
          const emptyEl = document.createElement('div');
          emptyEl.className = 'bin-empty-hint';
          emptyEl.textContent = '(プリセットなし)';
          listEl.appendChild(emptyEl);
        } else {
          filteredCharIds.forEach(charId => {
            const info = getPresetLabel(charId, roster);
            const isCustom = !!info.isCustom;
            const isSelected = this.selectedBinItems.some(it => it.type === 'preset' && it.id === charId);

            const itemEl = document.createElement('div');
            itemEl.className = `bin-char-item ${isSelected ? 'selected' : ''} ${charId === curCharId ? 'active' : ''}`;
            itemEl.draggable = true;
            itemEl.dataset.charId = charId;
            itemEl.dataset.binId = bin.id;
            itemEl.title = `選択: クリック (Ctrl/Cmdで複数選択)\nロード: ダブルクリック\n${info.name} [${isCustom ? '新規作成プリセット' : 'ビルトイン'}]`;

            itemEl.innerHTML = `
              <div class="bin-char-left" style="display:flex; align-items:center; gap:6px; flex:1; min-width:0;">
                <span class="bin-char-icon" style="font-size:14px; flex-shrink:0;">${info.icon}</span>
                <span class="bin-char-name" style="font-size:11px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:#f1f5f9;">${info.name}</span>
                ${charId === curCharId ? '<span class="bin-active-pill" style="font-size:9px; background:rgba(56,189,248,0.2); color:#38bdf8; border:1px solid rgba(56,189,248,0.4); padding:1px 4px; border-radius:3px; flex-shrink:0;">編集中</span>' : ''}
                ${isCustom ? '<span style="font-size:9px; background:rgba(34,197,94,0.15); color:#4ade80; border:1px solid rgba(34,197,94,0.3); padding:1px 4px; border-radius:3px; flex-shrink:0;">カスタム</span>' : ''}
              </div>
            `;

            // クリックで単一選択 / 複数選択 (Ctrl/Cmd)
            itemEl.addEventListener('click', (e) => {
              if (e.ctrlKey || e.metaKey) {
                // 複数選択トグル
                const idx = this.selectedBinItems.findIndex(it => it.type === 'preset' && it.id === charId);
                if (idx >= 0) {
                  this.selectedBinItems.splice(idx, 1);
                } else {
                  this.selectedBinItems.push({ type: 'preset', id: charId, binId: bin.id, name: info.name, isCustom });
                }
              } else {
                // 単一選択
                this.selectedBinItems = [{ type: 'preset', id: charId, binId: bin.id, name: info.name, isCustom }];
              }
              // ビンツリーの全アイテムの選択クラスを同期
              container.querySelectorAll('.bin-char-item').forEach(el => {
                const elId = el.dataset.charId;
                el.classList.toggle('selected', this.selectedBinItems.some(it => it.type === 'preset' && it.id === elId));
              });
              this.updateBinMenuState();
            });

            // ダブルクリックでロード (編集開始)
            itemEl.addEventListener('dblclick', () => {
              this.loadPresetById(charId);
            });

            itemEl.addEventListener('dragstart', (e) => {
              e.dataTransfer.setData('text/plain', JSON.stringify({ charId, fromBinId: bin.id }));
              e.dataTransfer.effectAllowed = 'move';
              itemEl.classList.add('dragging');
            });
            itemEl.addEventListener('dragend', () => {
              itemEl.classList.remove('dragging');
            });

            listEl.appendChild(itemEl);
          });
        }
        binGroup.appendChild(listEl);
      }

      container.appendChild(binGroup);
    });
  }

  updateBinMenuState() {
    const statusEl = this.container.querySelector('#binMenuStatus');
    const btnEdit = this.container.querySelector('#binMenuEdit');
    const btnDup = this.container.querySelector('#binMenuDuplicate');
    const btnMove = this.container.querySelector('#binMenuMove');
    const btnDelete = this.container.querySelector('#binMenuDelete');

    const presets = this.selectedBinItems.filter(it => it.type === 'preset');
    const customPresets = presets.filter(it => it.isCustom);
    const count = presets.length;

    if (count === 0) {
      if (statusEl) statusEl.textContent = '項目を選択してください';
      if (btnEdit) btnEdit.disabled = true;
      if (btnDup) btnDup.disabled = true;
      if (btnMove) btnMove.disabled = true;
      if (btnDelete) {
        btnDelete.disabled = true;
        btnDelete.title = '新規作成プリセットを選択すると削除できます';
      }
    } else if (count === 1) {
      const p = presets[0];
      if (statusEl) statusEl.textContent = `選択中: ${p.name}`;
      if (btnEdit) btnEdit.disabled = false;
      if (btnDup) btnDup.disabled = false;
      if (btnMove) btnMove.disabled = false;
      if (btnDelete) {
        btnDelete.disabled = !p.isCustom;
        btnDelete.title = p.isCustom ? 'この新規作成プリセットを削除' : '※公式ビルトインプリセットは削除できません';
      }
    } else {
      if (statusEl) statusEl.textContent = `${count}件選択中`;
      if (btnEdit) btnEdit.disabled = true; // 編集は1件のみ
      if (btnDup) btnDup.disabled = false;
      if (btnMove) btnMove.disabled = false;
      if (btnDelete) {
        btnDelete.disabled = customPresets.length === 0;
        btnDelete.title = customPresets.length > 0 
          ? `選択中の新規作成プリセット (${customPresets.length}件) を削除`
          : '※公式ビルトインプリセットは削除できません';
      }
    }
  }

  deleteSelectedPresets() {
    const customPresets = this.selectedBinItems.filter(it => it.type === 'preset' && it.isCustom);
    if (customPresets.length === 0) {
      window.alert('削除できるのは新規作成したプリセットのみです。\nビルトインプリセット（標準プリセット）は保護されています。');
      return;
    }

    const names = customPresets.map(it => `「${it.name}」`).join('、');
    const confirmMsg = customPresets.length === 1
      ? `新規作成プリセット ${names} を完全に削除しますか？\n（この操作は取り消せません）`
      : `選択された ${customPresets.length} 件の新規作成プリセット（${names}）を完全に削除しますか？\n（この操作は取り消せません）`;

    if (!window.confirm(confirmMsg)) return;

    const roster = this.getRoster();
    let curDeleted = false;

    customPresets.forEach(it => {
      const charId = it.id;
      delete roster[charId];
      // 全ビンからIDを除去
      this.bins.forEach(b => {
        if (Array.isArray(b.charIds)) {
          b.charIds = b.charIds.filter(id => id !== charId);
        }
      });
      if (this.character && this.character.id === charId) {
        curDeleted = true;
      }
    });

    this.saveRoster(roster);
    this.saveBins(this.bins);

    // 削除対象が現在編集中のキャラクターだった場合、ビルトイン標準プリセットに安全に戻す
    if (curDeleted) {
      const fallbackId = Object.keys(BASE_PRESETS)[0] || 'hirame_standard';
      this.loadPresetById(fallbackId);
    }

    this.selectedBinItems = [];
    this.renderBinTree();
    this.updateBinMenuState();
  }

  promptMoveMultipleCharacters(charIds) {
    if (!charIds || charIds.length === 0) return;
    if (this.bins.length <= 1) {
      window.alert('移動先の別のビンがありません。「➕ 新規ビン」でビンを作成してください。');
      return;
    }

    const options = this.bins.map((b, i) => `${i + 1}: ${b.name}`).join('\n');
    const ans = window.prompt(`選択された ${charIds.length} 件を移動するビンの番号を入力してください:\n${options}`, '1');
    if (!ans) return;

    const idx = parseInt(ans, 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= this.bins.length) {
      window.alert('無効な番号です。');
      return;
    }

    const targetBin = this.bins[idx];
    charIds.forEach(charId => {
      this.bins.forEach(b => {
        if (Array.isArray(b.charIds)) {
          b.charIds = b.charIds.filter(id => id !== charId);
        }
      });
      if (!targetBin.charIds.includes(charId)) {
        targetBin.charIds.push(charId);
      }
    });

    targetBin.isOpen = true;
    this.saveBins(this.bins);
    this.renderBinTree();
    this.updateActiveBinBreadcrumb();
  }

  addBin() {
    const name = window.prompt('新しいビンの名前を入力してください:', '新規グループ');
    if (!name || !name.trim()) return;
    const newBin = {
      id: 'bin_' + Date.now(),
      name: name.trim(),
      isOpen: true,
      charIds: []
    };
    this.bins.push(newBin);
    this.saveBins(this.bins);
    this.renderBinTree();
  }

  renameBin(binId) {
    const bin = this.bins.find(b => b.id === binId);
    if (!bin) return;
    const newName = window.prompt('ビンの新しい名前を入力してください:', bin.name);
    if (!newName || !newName.trim()) return;
    bin.name = newName.trim();
    this.saveBins(this.bins);
    this.renderBinTree();
    this.updateActiveBinBreadcrumb();
  }

  deleteBin(binId) {
    if (this.bins.length <= 1) {
      window.alert('最後のビンは削除できません。');
      return;
    }
    const binIndex = this.bins.findIndex(b => b.id === binId);
    if (binIndex === -1) return;
    const bin = this.bins[binIndex];

    if (bin.charIds && bin.charIds.length > 0) {
      const targetBin = this.bins.find(b => b.id !== binId);
      const ok = window.confirm(`ビン「${bin.name}」には${bin.charIds.length}個のプリセットが含まれています。\n「${targetBin.name}」に移動してビンを削除しますか？`);
      if (!ok) return;
      targetBin.charIds.push(...bin.charIds);
    } else {
      const ok = window.confirm(`ビン「${bin.name}」を削除しますか？`);
      if (!ok) return;
    }

    this.bins.splice(binIndex, 1);
    this.saveBins(this.bins);
    this.renderBinTree();
    this.updateActiveBinBreadcrumb();
  }

  moveBin(binId, delta) {
    const idx = this.bins.findIndex(b => b.id === binId);
    if (idx === -1) return;
    const targetIdx = idx + delta;
    if (targetIdx < 0 || targetIdx >= this.bins.length) return;
    const [b] = this.bins.splice(idx, 1);
    this.bins.splice(targetIdx, 0, b);
    this.saveBins(this.bins);
    this.renderBinTree();
  }

  moveCharacterToBin(charId, fromBinId, toBinId) {
    if (fromBinId === toBinId) return;
    const fromBin = this.bins.find(b => b.id === fromBinId);
    const toBin = this.bins.find(b => b.id === toBinId);
    if (!toBin) return;
    if (fromBin && fromBin.charIds) {
      fromBin.charIds = fromBin.charIds.filter(id => id !== charId);
    }
    if (!toBin.charIds) toBin.charIds = [];
    if (!toBin.charIds.includes(charId)) {
      toBin.charIds.push(charId);
    }
    this.saveBins(this.bins);
    this.renderBinTree();
    this.updateActiveBinBreadcrumb();
  }

  promptMoveCharacter(charId, currentBinId) {
    const roster = this.getRoster();
    const info = getPresetLabel(charId, roster);
    const options = this.bins.map((b, i) => `${i + 1}: ${b.name}`).join('\n');
    const input = window.prompt(`「${info.name}」の移動先ビン番号を入力してください:\n${options}`, '1');
    if (!input) return;
    const num = parseInt(input, 10);
    if (isNaN(num) || num < 1 || num > this.bins.length) {
      window.alert('無効な番号です。');
      return;
    }
    const targetBin = this.bins[num - 1];
    this.moveCharacterToBin(charId, currentBinId, targetBin.id);
  }

  switchSidebarTab(tab) {
    this.activeSidebarTab = tab;
    const tabBins = this.container.querySelector('#tabSidebarBins');
    const tabLayers = this.container.querySelector('#tabSidebarLayers');
    const panelBins = this.container.querySelector('#panelSidebarBins');
    const panelLayers = this.container.querySelector('#panelSidebarLayers');

    tabBins?.classList.toggle('active', tab === 'bins');
    tabLayers?.classList.toggle('active', tab === 'layers');
    panelBins?.classList.toggle('hidden', tab !== 'bins');
    panelLayers?.classList.toggle('hidden', tab !== 'layers');
  }

  registerToCustomBin(charId) {
    if (!this.bins) this.bins = this.getBins();
    let customBin = this.bins.find(b => b.id === 'bin_custom');
    if (!customBin) {
      customBin = { id: 'bin_custom', name: 'マイカスタム', isOpen: true, charIds: [] };
      this.bins.push(customBin);
    }
    if (!customBin.charIds) customBin.charIds = [];
    if (!customBin.charIds.includes(charId)) {
      customBin.charIds.push(charId);
    }
    customBin.isOpen = true;
    this.saveBins(this.bins);
    this.renderBinTree();
  }

  duplicateCharacterQuick(charId) {
    const roster = this.getRoster();
    let baseChar = roster[charId];
    if (!baseChar && BASE_PRESETS && BASE_PRESETS[charId]) {
      baseChar = BASE_PRESETS[charId]();
    }
    if (!baseChar) {
      baseChar = this.character ? JSON.parse(JSON.stringify(this.character)) : getHiramePreset();
    }
    const newChar = JSON.parse(JSON.stringify(baseChar));
    const newId = `custom_${Date.now()}`;
    newChar.id = newId;
    const info = getPresetLabel(charId, roster);
    const origName = baseChar.name || info.name || 'キャラクター';
    newChar.name = `${origName} (コピー)`;

    roster[newId] = newChar;
    this.saveRoster(roster);

    // マイカスタムビンへ自動登録
    this.registerToCustomBin(newId);

    // 新規作成されたキャラを直ちにロードして編集開始
    this.loadPresetById(newId);
    this.updatePresetSelectOptions();
    this.updateActiveBinBreadcrumb();

    // プリセット（ビン）タブを前面にして開く
    this.switchSidebarTab('bins');

    alert(`「${newChar.name}」を新規作成し、マイカスタムに登録しました！`);
  }

  updateActiveBinBreadcrumb() {
    const curId = this.character?.id;
    if (!curId) return;
    const roster = this.getRoster();
    const info = getPresetLabel(curId, roster);
    const containingBin = this.bins.find(b => b.charIds?.includes(curId));
    const binNameEl = this.container.querySelector('#breadcrumbBinName');
    const charNameEl = this.container.querySelector('#breadcrumbCharName');
    if (binNameEl) binNameEl.textContent = containingBin ? containingBin.name : 'プリセット';
    if (charNameEl) charNameEl.textContent = `${info.icon} ${info.name}`;
  }

  initEditor() {
    const stage = this.container.querySelector('#studioCanvasStage');
    this.editor = new StudioEditor(stage, {
      onSelectionChange: (part) => {
        this.renderLayerTree();
        this.renderInspector();
        this.renderTimeline();
        this.updateInspectorPreview();
        this.syncNavigatorColorChips();
      },
      onTransformModeChange: (isTransform) => {
        if (this._isSelectingTool) return;
        const btnTransform = this.container.querySelector('#btnTransformToggle');
        btnTransform?.classList.toggle('active', isTransform);
        if (isTransform) {
          this.activeStudioTool = 'transform';
          this.slotActiveTools['transform_group'] = 'transform';
        } else {
          const restoreTool = this.editor.previousToolBeforeTransform || 'select';
          this.activeStudioTool = restoreTool;
          const info = ALL_TOOLS_MAP[restoreTool];
          if (info) this.slotActiveTools[info.groupId] = restoreTool;
        }
        this.updateToolboxActiveStates();
        this.updateCanvasStatusBar();
      },
      onTransformChange: (isTransform) => {
        if (this._isSelectingTool) return;
        const btnTransform = this.container.querySelector('#btnTransformToggle');
        btnTransform?.classList.toggle('active', isTransform);
        if (isTransform) {
          this.activeStudioTool = 'transform';
          this.slotActiveTools['transform_group'] = 'transform';
        } else {
          const restoreTool = this.editor.previousToolBeforeTransform || 'select';
          this.activeStudioTool = restoreTool;
          const info = ALL_TOOLS_MAP[restoreTool];
          if (info) this.slotActiveTools[info.groupId] = restoreTool;
        }
        this.updateToolboxActiveStates();
        this.updateCanvasStatusBar();
      },
      onCharacterChange: (char) => {
        this.character = char;
        this.renderLayerTree();
        this.renderInspector();
        this.renderTimeline();
        this.updateInspectorPreview();
        this.syncNavigatorColorChips();
        this.updateActiveBinBreadcrumb();
      },
      onToolChange: (tool) => {
        if (this.activeStudioTool !== tool) {
          this.selectStudioTool(tool);
        }
      }
    });

    // ビューポート移動・ズーム時にナビゲーターの赤枠＆スライダー＆キャンバスステータスを即時同期
    this.editor.onViewportChange = () => {
      this.syncNavigator();
      const zoomEl = this.container.querySelector('#statusCanvasZoom');
      if (zoomEl) {
        zoomEl.textContent = `${Math.round((this.editor.zoom || 1.0) * 100)}%`;
      }
    };

    // キーフレーム選択状態をエディター側へ伝達 (Deleteキーによるパーツ誤削除防止)
    this.editor.hasSelectedKeyframes = () => {
      return (this.selectedKeyframes && this.selectedKeyframes.length > 0) ||
             (this.selectedKeyframe && this.selectedKeyframe.kf) ||
             (this.selectedGraphKeyframe && this.selectedGraphKeyframe.kf);
    };
  }

  getRoster() {
    try {
      const data = localStorage.getItem('hirame_custom_roster');
      return data ? JSON.parse(data) : {};
    } catch (e) {
      return {};
    }
  }

  saveRoster(roster) {
    try {
      localStorage.setItem('hirame_custom_roster', JSON.stringify(roster));
      try {
        const ch = new BroadcastChannel('hirame_admin_channel');
        ch.postMessage({ type: 'UPDATE_CUSTOM_ROSTER', roster, activeCharacter: this.character });
      } catch (err) {}
      window.dispatchEvent(new CustomEvent('hirame_custom_roster_updated', { detail: { roster, activeCharacter: this.character } }));
    } catch (e) {
      console.warn("Failed to save roster", e);
    }
  }

  updatePresetSelectOptions() {
    const sel = this.container.querySelector('#studioPresetSelect');
    if (!sel) return;
    const roster = this.getRoster();
    const curVal = this.character ? this.character.id : sel.value;

    let html = `
      <optgroup label="🐟 水生生物プリセット">
        <option value="hirame">🐟 ヒラメ (左向き・受け口・鋭い牙)</option>
        <option value="karei">🐟 カレイ (右向き・おちょぼ口・水玉)</option>
        <option value="octopus">🐙 タコ (邪魔キャラ・墨吐き)</option>
        <option value="squid">🦑 イカ (邪魔キャラ・高速ジェット)</option>
        <option value="stingray">🌊 エイ (巨大影・大翼)</option>
        <option value="aji_open">🐟 アジの開き (罠・干物ボーン)</option>
        <option value="shitabirame">👞 ウシノシタ (舌平目・靴底型)</option>
      </optgroup>
      <optgroup label="🧬 多様体・新骨格プリセット">
        <option value="human">🧍 人間 (頭部・胴体・手足・歩行サイクル)</option>
        <option value="quadruped">🐕 ４足歩行 (首・胴・4足トロット・尻尾)</option>
        <option value="biped">🦖 ２足歩行 (頭部・大顎・強靭脚・大尾)</option>
        <option value="insect">🪲 昆虫 (クワガタ・大顎・6本足)</option>
        <option value="spider">🕷️ 蜘蛛 (8脚オオグモ・毒牙・波状歩行)</option>
        <option value="bird">🦅 鳥 (青い鳥・翼手前/奥・羽ばたき)</option>
      </optgroup>
      <optgroup label="🌟 スペシャルキャラクター">
        <option value="boo_chan">🐷 ぶーちゃん (豚顔イルカ・スペシャル)</option>
      </optgroup>
      <optgroup label="🔤 漢字キャラクター">
        <option value="kanji_hirame">鮃 漢字・鮃 (ヒラメ)</option>
        <option value="kanji_karei_1">鰈 漢字・鰈 (カレイ)</option>
        <option value="kanji_karei_2">魪 漢字・魪 (カレイ・魪)</option>
      </optgroup>
    `;

    const baseKeys = Object.keys(BASE_PRESETS);
    const customKeys = Object.keys(roster).filter(k => !baseKeys.includes(k));
    if (customKeys.length > 0) {
      html += `<optgroup label="✨ カスタム登録キャラ">`;
      for (const k of customKeys) {
        const c = roster[k];
        html += `<option value="${k}">✨ ${c.name || k}</option>`;
      }
      html += `</optgroup>`;
    }

    this.container.querySelectorAll('#studioPresetSelect').forEach(selEl => {
      selEl.innerHTML = html;
      if (curVal && (BASE_PRESETS[curVal] || roster[curVal])) {
        selEl.value = curVal;
      }
    });
  }

  loadInitialPreset() {
    const roster = this.getRoster();
    if (roster && roster['hirame']) {
      this.character = roster['hirame'];
    } else {
      this.character = getHiramePreset();
    }
    this.editor.setCharacter(this.character);
    this.updatePresetSelectOptions();
    this.updateActiveBinBreadcrumb();
    this.renderBinTree();
    this.renderLayerTree();
    this.renderInspector();
    this.renderTimeline();
    this.updateInspectorPreview();
  }

  loadPresetById(presetId) {
    const roster = this.getRoster();
    if (presetId === 'karei' && roster && roster['karei']) {
      // カレイの目玉が古い（最新の2つの目玉パーツがない）場合は最新プリセットに自動更新
      const hasDualEyes = roster['karei'].parts?.some(p => p.id === 'karei_eye_socket_2' || p.id === 'karei_eye_white_2');
      if (!hasDualEyes) {
        roster['karei'] = getKareiPreset();
        this.saveRoster(roster);
      }
    }
    if (roster && roster[presetId]) {
      this.character = JSON.parse(JSON.stringify(roster[presetId]));
    } else if (BASE_PRESETS[presetId]) {
      this.character = BASE_PRESETS[presetId]();
    } else {
      console.warn("Preset not found", presetId);
      return;
    }
    this.editor.setCharacter(this.character);
    this.updatePresetSelectOptions();
    this.updateActiveBinBreadcrumb();
    this.renderBinTree();
    this.renderLayerTree();
    this.renderInspector();
    this.renderTimeline();
    this.updateInspectorPreview();
  }

  exportAllCharactersPack() {
    const roster = this.getRoster();
    const baseList = getAllBasePresets();
    const allCharacters = [];

    // 公式ベースプリセット（カスタム保存があればそちらを適用、なければデフォルト）
    for (const base of baseList) {
      if (roster[base.id]) {
        allCharacters.push(roster[base.id]);
      } else {
        allCharacters.push(base);
      }
    }

    // 追加で登録された新規カスタムキャラ
    const baseKeys = Object.keys(BASE_PRESETS);
    for (const [id, char] of Object.entries(roster)) {
      if (!baseKeys.includes(id)) {
        allCharacters.push(char);
      }
    }

    const pack = {
      format: 'hirame_character_pack',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      count: allCharacters.length,
      characters: allCharacters
    };

    const str = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(pack, null, 2));
    const a = document.createElement('a');
    a.href = str;
    a.download = `hirame_all_characters_pack_${Date.now()}.json`;
    a.click();
  }

  importCharactersJson(data) {
    let importedList = [];
    if (data.characters && Array.isArray(data.characters)) {
      importedList = data.characters;
    } else if (Array.isArray(data)) {
      importedList = data;
    } else if (data.parts && data.id) {
      importedList = [data];
    } else {
      throw new Error("無効なキャラクターデータ形式です");
    }

    const roster = this.getRoster();
    for (const char of importedList) {
      if (char && char.id) {
        roster[char.id] = char;
      }
    }

    this.saveRoster(roster);
    this.updatePresetSelectOptions();

    // 読み込んだ最初のキャラをエディタに展開
    if (importedList.length > 0) {
      this.character = JSON.parse(JSON.stringify(importedList[0]));
      this.editor.setCharacter(this.character);
      this.renderLayerTree();
      this.renderInspector();
      this.renderTimeline();
      this.updateInspectorPreview();
    }

    alert(`キャラクターデータ（計 ${importedList.length} 体）を正常に読み込み、プリセットに登録しました！`);
  }

  // ========================================================
  // 1. プロパティ上部「ナビゲーター (完成形プレビュー)」レンダリング
  // ========================================================
  updateInspectorPreview() {
    const stage = this.container.querySelector('#inspectorPreviewStage');
    if (!stage || !this.character) return;

    const clip = this.character.animations?.[this.currentMotion];
    const norm = Math.max(0, Math.min(1, this.currentFrame / this.totalFrames));
    let transforms = new Map();
    try {
      if (clip) {
        transforms = resolveRigTransforms(this.character.parts, clip, norm);
      }
    } catch (e) {
      console.warn('resolveRigTransforms preview failed:', e);
    }

    const sortedParts = [...this.character.parts].sort((a, b) => a.zIndex - b.zIndex);

    let partsHtml = '';
    for (const part of sortedParts) {
      if (!part.visible) continue;

      const d = pointsToSvgPath(part.points, part.closed);
      const t = transforms.get(part.id) || { tx: 0, ty: 0, rot: 0, sx: 1, sy: 1, op: 1 };
      const px = part.pivot?.x || 0;
      const py = part.pivot?.y || 0;
      const transformAttr = `translate(${t.tx || 0},${t.ty || 0}) translate(${px},${py}) rotate(${t.rot || 0}) scale(${t.sx || 1},${t.sy || 1}) translate(${-px},${-py})`;
      const partOp = (part.style.opacity ?? 1) * (t.op ?? 1);

      // テキストパーツまたは通常メインパス
      if (part.type === 'text' || part.text) {
        const text = part.text || part.textLabel || '';
        const fontSize = part.fontSize || part.style?.fontSize || 80;
        const fontFamily = part.fontFamily || part.style?.fontFamily || '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';
        const fill = part.style.fill || '#ffffff';
        const stroke = part.style.stroke && part.style.stroke !== 'none' ? part.style.stroke : 'none';
        const strokeWidth = stroke !== 'none' ? (part.style.strokeWidth ?? 0) : 0;
        let strokeAttr = '';
        if (stroke !== 'none' && strokeWidth > 0) {
          strokeAttr = `stroke="${stroke}" stroke-width="${strokeWidth * 2}" paint-order="stroke fill"`;
        }
        partsHtml += `<text transform="${transformAttr}" x="0" y="0" text-anchor="middle" dominant-baseline="central" font-size="${fontSize}" font-family='${fontFamily}' font-weight="bold" fill="${fill}" ${strokeAttr} opacity="${partOp}">${text}</text>`;
      } else if (part.points && part.points.length >= 2) {
        const fill = part.style.fill || 'none';
        const stroke = part.style.stroke && part.style.stroke !== 'none' ? part.style.stroke : 'none';
        const strokeWidth = stroke !== 'none' ? (part.style.strokeWidth ?? 0) : 0;
        const strokePos = part.style.strokePosition || 'center';

        let extraAttrs = '';
        let actualWidth = strokeWidth;
        if (stroke !== 'none' && strokeWidth > 0) {
          if (strokePos === 'inside') {
            actualWidth = strokeWidth * 2;
            extraAttrs = `style="clip-path: path('${d}');"`;
          } else if (strokePos === 'outside') {
            actualWidth = strokeWidth * 2;
            extraAttrs = `paint-order="stroke fill"`;
          }
        }

        partsHtml += `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${actualWidth}" opacity="${partOp}" transform="${transformAttr}" ${extraAttrs}/>`;
      }

      // サブパス (歯・斑点・目玉など)
      if (part.subPaths && part.subPaths.length > 0) {
        for (const sub of part.subPaths) {
          if (sub.type === 'circle') {
            const subStroke = sub.stroke && sub.stroke !== 'none' ? `stroke="${sub.stroke}" stroke-width="${sub.strokeWidth || 0}"` : '';
            partsHtml += `<circle transform="${transformAttr}" cx="${sub.cx}" cy="${sub.cy}" r="${sub.r}" fill="${sub.fill}" ${subStroke} opacity="${partOp}"/>`;
          } else if (sub.type === 'polygon' && sub.points) {
            const ptStr = sub.points.map(p => `${p.x},${p.y}`).join(' ');
            partsHtml += `<polygon transform="${transformAttr}" points="${ptStr}" fill="${sub.fill}" opacity="${partOp}"/>`;
          }
        }
      }
    }

    // 全パーツのバウンディングボックスを計算 (Photoshopナビゲーターと同様、全体が綺麗に収まる固定ViewBox)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    if (this.character && this.character.parts) {
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
    }
    if (minX === Infinity || maxX === -Infinity) {
      minX = -90; maxX = 90; minY = -45; maxY = 45;
    }

    const marginX = Math.max(30, (maxX - minX) * 0.2);
    const marginY = Math.max(25, (maxY - minY) * 0.2);
    const navVBX = (minX - marginX).toFixed(1);
    const navVBY = (minY - marginY).toFixed(1);
    const navVBW = ((maxX - minX) + marginX * 2).toFixed(1);
    const navVBH = ((maxY - minY) + marginY * 2).toFixed(1);
    this.navViewBox = { x: parseFloat(navVBX), y: parseFloat(navVBY), width: parseFloat(navVBW), height: parseFloat(navVBH) };

    stage.innerHTML = `
      <svg class="preview-svg-canvas ps-nav-svg" id="psNavSvg" viewBox="${navVBX} ${navVBY} ${navVBW} ${navVBH}" preserveAspectRatio="xMidYMid meet">
        <!-- 背景クリックキャッチャー -->
        <rect id="navClickCatcher" x="${navVBX}" y="${navVBY}" width="${navVBW}" height="${navVBH}" fill="transparent" pointer-events="all"></rect>
        <g id="navPartsGroup">${partsHtml}</g>
        <!-- Photoshop ナビゲーター 赤い枠線 (連動ビューポート) -->
        <rect id="navRedBox" class="ps-nav-red-box" x="0" y="0" width="0" height="0" />
      </svg>
    `;

    this.syncNavigator();
  }

  // ========================================================
  // Photoshop-Style ナビゲーター 同期 & インタラクション
  // ========================================================
  syncNavigator() {
    this.syncNavigatorRedBox();
    this.syncNavigatorControls();
  }

  syncNavigatorRedBox() {
    const redBox = this.container.querySelector('#navRedBox');
    if (!redBox || !this.editor || !this.editor.svg) return;

    const mainRect = this.editor.svg.getBoundingClientRect();
    const mainW = mainRect.width > 0 ? mainRect.width : (this.editor.container?.clientWidth || 900);
    const mainH = mainRect.height > 0 ? mainRect.height : (this.editor.container?.clientHeight || 560);

    const zoom = this.editor.zoom || 1.0;
    const facing = this.editor.previewFacing || 1;
    const panX = this.editor.panX || 0;
    const panY = this.editor.panY || 0;

    // メインキャンバスの可視領域をワールド座標系に逆算
    // screenX = panX + worldX * zoom * facing  =>  worldX = (screenX - panX) / (zoom * facing)
    const w1 = (0 - panX) / (zoom * facing);
    const w2 = (mainW - panX) / (zoom * facing);
    const h1 = (0 - panY) / zoom;
    const h2 = (mainH - panY) / zoom;

    const vMinX = Math.min(w1, w2);
    const vMaxX = Math.max(w1, w2);
    const vMinY = Math.min(h1, h2);
    const vMaxY = Math.max(h1, h2);

    const vWidth = Math.max(2, vMaxX - vMinX);
    const vHeight = Math.max(2, vMaxY - vMinY);

    redBox.setAttribute('x', vMinX.toFixed(2));
    redBox.setAttribute('y', vMinY.toFixed(2));
    redBox.setAttribute('width', vWidth.toFixed(2));
    redBox.setAttribute('height', vHeight.toFixed(2));
  }

  syncNavigatorControls() {
    if (!this.editor) return;
    const currentPercent = Math.round(this.editor.zoom * 100);

    const percentInput = this.container.querySelector('#navZoomPercentInput');
    if (percentInput && document.activeElement !== percentInput) {
      percentInput.value = `${currentPercent}%`;
    }

    const slider = this.container.querySelector('#navZoomSlider');
    if (slider && document.activeElement !== slider) {
      slider.value = currentPercent;
    }
  }

  attachNavigatorEvents() {
    const stage = this.container.querySelector('#inspectorPreviewStage');
    if (!stage) return;

    let isDragging = false;
    let startPoint = null;
    let startPanX = 0;
    let startPanY = 0;

    const getPreviewSvgPoint = (e, svg) => {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const ctm = svg.getScreenCTM();
      if (ctm) {
        return pt.matrixTransform(ctm.inverse());
      }
      return { x: 0, y: 0 };
    };

    stage.addEventListener('pointerdown', (e) => {
      const svg = stage.querySelector('svg');
      const redBox = stage.querySelector('#navRedBox');
      if (!svg || !this.editor) return;

      const mainRect = this.editor.svg.getBoundingClientRect();
      const mainW = mainRect.width > 0 ? mainRect.width : (this.editor.container?.clientWidth || 900);
      const mainH = mainRect.height > 0 ? mainRect.height : (this.editor.container?.clientHeight || 560);
      const zoom = this.editor.zoom || 1.0;
      const facing = this.editor.previewFacing || 1;

      // 赤枠のドラッグ判定
      if (e.target === redBox || e.target.closest('#navRedBox')) {
        isDragging = true;
        try { redBox.setPointerCapture(e.pointerId); } catch (_) {}
        startPoint = getPreviewSvgPoint(e, svg);
        startPanX = this.editor.panX;
        startPanY = this.editor.panY;
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // 赤枠外のクリック: その地点がメインキャンバス中央に来るようパン移動
      const clickPt = getPreviewSvgPoint(e, svg);
      this.editor.panX = (mainW / 2) - clickPt.x * zoom * facing;
      this.editor.panY = (mainH / 2) - clickPt.y * zoom;
      this.editor.updateViewportTransform();
      this.syncNavigatorRedBox();

      // そのままドラッグに移行可能
      isDragging = true;
      startPoint = clickPt;
      startPanX = this.editor.panX;
      startPanY = this.editor.panY;
      e.preventDefault();
    });

    stage.addEventListener('pointermove', (e) => {
      if (!isDragging || !startPoint || !this.editor) return;
      const svg = stage.querySelector('svg');
      if (!svg) return;

      const currentPt = getPreviewSvgPoint(e, svg);
      const deltaX = currentPt.x - startPoint.x;
      const deltaY = currentPt.y - startPoint.y;

      const zoom = this.editor.zoom || 1.0;
      const facing = this.editor.previewFacing || 1;

      this.editor.panX = startPanX - deltaX * zoom * facing;
      this.editor.panY = startPanY - deltaY * zoom;
      this.editor.updateViewportTransform();
      this.syncNavigatorRedBox();
    });

    const stopDrag = (e) => {
      if (isDragging) {
        isDragging = false;
        startPoint = null;
        const redBox = stage.querySelector('#navRedBox');
        if (redBox && redBox.hasPointerCapture && e.pointerId && redBox.hasPointerCapture(e.pointerId)) {
          try { redBox.releasePointerCapture(e.pointerId); } catch (_) {}
        }
      }
    };

    stage.addEventListener('pointerup', stopDrag);
    stage.addEventListener('pointercancel', stopDrag);

    // ナビゲーター・カラー・スウォッチタブの初期化
    this.setupNavigatorTabs();
  }

  // ========================================================
  // Photoshop-Style ナビゲーター / カラー / スウォッチ タブ制御
  // ========================================================
  setupNavigatorTabs() {
    const tabMain = this.container.querySelector('#tabNavMain');
    const tabColor = this.container.querySelector('#tabNavColor');
    const tabSwatch = this.container.querySelector('#tabNavSwatch');
    const btnCollapse = this.container.querySelector('#btnNavCollapse');
    const card = this.container.querySelector('#psNavigatorCard');

    const panelMain = this.container.querySelector('#panelNavMain');
    const panelColor = this.container.querySelector('#panelNavColor');
    const panelSwatch = this.container.querySelector('#panelNavSwatch');

    const selectTab = (tab) => {
      tabMain?.classList.toggle('active', tab === 'main');
      tabColor?.classList.toggle('active', tab === 'color');
      tabSwatch?.classList.toggle('active', tab === 'swatch');

      panelMain?.classList.toggle('hidden', tab !== 'main');
      panelColor?.classList.toggle('hidden', tab !== 'color');
      panelSwatch?.classList.toggle('hidden', tab !== 'swatch');

      if (tab === 'main') {
        this.syncNavigator();
      } else if (tab === 'color') {
        this.syncNavigatorColorChips();
      } else if (tab === 'swatch') {
        this.renderSwatches();
      }
    };
    this.selectNavTab = selectTab;

    tabMain?.addEventListener('click', () => selectTab('main'));
    tabColor?.addEventListener('click', () => selectTab('color'));
    tabSwatch?.addEventListener('click', () => selectTab('swatch'));

    // 全体を表示 (Fit to Canvas)
    this.container.querySelector('#btnNavFitView')?.addEventListener('click', () => {
      this.fitToCanvas();
    });

    if (btnCollapse) {
      btnCollapse.addEventListener('click', () => {
        const isCollapsed = card?.classList.toggle('collapsed');
        btnCollapse.innerText = isCollapsed ? '»' : '«';
      });
    }

    // ── カラーパネル イベント ──
    this.activeColorMode = 'fill'; // 'fill' または 'stroke'

    const chipFill = this.container.querySelector('#psChipFill');
    const chipStroke = this.container.querySelector('#psChipStroke');
    const btnSwap = this.container.querySelector('#btnSwapFillStroke');
    const btnDefault = this.container.querySelector('#btnColorDefault');
    const btnNone = this.container.querySelector('#btnColorNone');

    const nativePicker = this.container.querySelector('#psColorNativePicker');
    const hexInput = this.container.querySelector('#psColorHexInput');
    const sliderR = this.container.querySelector('#psColorSliderR');
    const sliderG = this.container.querySelector('#psColorSliderG');
    const sliderB = this.container.querySelector('#psColorSliderB');
    const sliderA = this.container.querySelector('#psColorSliderA');
    const strokeWidthSlider = this.container.querySelector('#psStrokeWidthSlider');

    const valR = this.container.querySelector('#psColorValR');
    const valG = this.container.querySelector('#psColorValG');
    const valB = this.container.querySelector('#psColorValB');
    const valA = this.container.querySelector('#psColorValA');
    const strokeWidthVal = this.container.querySelector('#psStrokeWidthVal');

    const setColorMode = (mode) => {
      this.activeColorMode = mode;
      chipFill?.classList.toggle('active', mode === 'fill');
      chipStroke?.classList.toggle('active', mode === 'stroke');
      this.syncNavigatorColorChips();
    };

    chipFill?.addEventListener('click', () => setColorMode('fill'));
    chipStroke?.addEventListener('click', () => setColorMode('stroke'));

    // 塗り・線 入れ替え (Photoshop Xキー相当)
    btnSwap?.addEventListener('click', () => {
      const part = this.editor.getSelectedPart();
      if (part) {
        this.editor.pushState();
        const oldFill = part.style.fill;
        part.style.fill = part.style.stroke;
        part.style.stroke = oldFill;
        this.editor.render();
        try { this.updateInspectorPreview(); } catch (_) {}
        this.renderInspector();
        this.syncNavigatorColorChips();
      }
    });

    // デフォルト白塗り/黒線 (Photoshop Dキー相当)
    btnDefault?.addEventListener('click', () => {
      const part = this.editor.getSelectedPart();
      if (part) {
        this.editor.pushState();
        part.style.fill = '#ffffff';
        part.style.stroke = '#000000';
        part.style.strokeWidth = 2;
        this.editor.render();
        try { this.updateInspectorPreview(); } catch (_) {}
        this.renderInspector();
        this.syncNavigatorColorChips();
      }
    });

    // なし (透明) 設定
    btnNone?.addEventListener('click', () => {
      const part = this.editor.getSelectedPart();
      if (part) {
        this.editor.pushState();
        if (this.activeColorMode === 'fill') {
          part.style.fill = 'none';
        } else {
          part.style.stroke = 'none';
        }
        this.editor.render();
        try { this.updateInspectorPreview(); } catch (_) {}
        this.renderInspector();
        this.syncNavigatorColorChips();
      }
    });

    // 選択中パーツへ色を適用
    const applyColorToPart = (color) => {
      const part = this.editor.getSelectedPart();
      if (part) {
        this.editor.pushState();
        if (this.activeColorMode === 'fill') {
          part.style.fill = color;
        } else {
          part.style.stroke = color;
          if (part.style.strokeWidth === 0) part.style.strokeWidth = 2;
        }
        this.editor.render();
        try { this.updateInspectorPreview(); } catch (_) {}
        this.renderInspector();
        this.syncNavigatorColorChips();
      }
    };

    // ネイティブカラーピッカー
    nativePicker?.addEventListener('input', (e) => {
      const color = e.target.value;
      if (hexInput) hexInput.value = color;
      const rgb = this.hexToRgb(color);
      if (sliderR) { sliderR.value = rgb.r; valR.innerText = rgb.r; }
      if (sliderG) { sliderG.value = rgb.g; valG.innerText = rgb.g; }
      if (sliderB) { sliderB.value = rgb.b; valB.innerText = rgb.b; }
      applyColorToPart(color);
    });

    // HEX入力
    const commitHex = () => {
      if (!hexInput) return;
      let val = hexInput.value.trim();
      if (!val.startsWith('#')) val = '#' + val;
      if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
        if (nativePicker) nativePicker.value = val;
        const rgb = this.hexToRgb(val);
        if (sliderR) { sliderR.value = rgb.r; valR.innerText = rgb.r; }
        if (sliderG) { sliderG.value = rgb.g; valG.innerText = rgb.g; }
        if (sliderB) { sliderB.value = rgb.b; valB.innerText = rgb.b; }
        applyColorToPart(val);
      }
    };
    hexInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        commitHex();
        hexInput.blur();
      }
    });
    hexInput?.addEventListener('blur', commitHex);

    // RGB スライダー
    const updateFromRgbSliders = () => {
      const r = parseInt(sliderR?.value || '0', 10);
      const g = parseInt(sliderG?.value || '0', 10);
      const b = parseInt(sliderB?.value || '0', 10);
      if (valR) valR.innerText = r;
      if (valG) valG.innerText = g;
      if (valB) valB.innerText = b;
      const hex = this.rgbToHex(r, g, b);
      if (nativePicker) nativePicker.value = hex;
      if (hexInput) hexInput.value = hex;
      applyColorToPart(hex);
    };

    sliderR?.addEventListener('input', updateFromRgbSliders);
    sliderG?.addEventListener('input', updateFromRgbSliders);
    sliderB?.addEventListener('input', updateFromRgbSliders);

    // 不透明度スライダー
    sliderA?.addEventListener('input', (e) => {
      const num = parseInt(e.target.value, 10);
      if (valA) valA.innerText = `${num}%`;
      const part = this.editor.getSelectedPart();
      if (part) {
        this.editor.pushState();
        part.style.opacity = Math.max(0, Math.min(1, num / 100));
        this.editor.render();
        try { this.updateInspectorPreview(); } catch (_) {}
        this.renderInspector();
      }
    });

    // 線幅スライダー
    strokeWidthSlider?.addEventListener('input', (e) => {
      const w = parseInt(e.target.value, 10);
      if (strokeWidthVal) strokeWidthVal.innerText = `${w}px`;
      const part = this.editor.getSelectedPart();
      if (part) {
        this.editor.pushState();
        part.style.strokeWidth = w;
        this.editor.render();
        try { this.updateInspectorPreview(); } catch (_) {}
        this.renderInspector();
      }
    });

    this.renderSwatches();
    this.syncNavigatorColorChips();
  }

  // 選択中パーツとカラーチップ・インプットの同期
  syncNavigatorColorChips() {
    const part = this.editor ? this.editor.getSelectedPart() : null;
    const previewFill = this.container.querySelector('#psChipFillPreview');
    const previewStroke = this.container.querySelector('#psChipStrokePreview');

    const fill = part?.style?.fill ?? '#ff4488';
    const stroke = part?.style?.stroke ?? '#000000';
    const strokeWidth = part?.style?.strokeWidth ?? 2;
    const opacity = part?.style?.opacity ?? 1;

    if (previewFill) {
      if (!fill || fill === 'none') {
        previewFill.classList.add('is-none');
        previewFill.style.backgroundColor = 'transparent';
      } else {
        previewFill.classList.remove('is-none');
        previewFill.style.backgroundColor = fill;
      }
    }

    if (previewStroke) {
      if (!stroke || stroke === 'none') {
        previewStroke.classList.add('is-none');
        previewStroke.style.borderColor = 'transparent';
      } else {
        previewStroke.classList.remove('is-none');
        previewStroke.style.borderColor = stroke;
      }
    }

    const curColor = (this.activeColorMode === 'fill' ? fill : stroke) || '#ff4488';
    const nativePicker = this.container.querySelector('#psColorNativePicker');
    const hexInput = this.container.querySelector('#psColorHexInput');
    const sliderR = this.container.querySelector('#psColorSliderR');
    const sliderG = this.container.querySelector('#psColorSliderG');
    const sliderB = this.container.querySelector('#psColorSliderB');
    const sliderA = this.container.querySelector('#psColorSliderA');
    const strokeWidthSlider = this.container.querySelector('#psStrokeWidthSlider');

    const valR = this.container.querySelector('#psColorValR');
    const valG = this.container.querySelector('#psColorValG');
    const valB = this.container.querySelector('#psColorValB');
    const valA = this.container.querySelector('#psColorValA');
    const strokeWidthVal = this.container.querySelector('#psStrokeWidthVal');

    if (curColor && curColor !== 'none' && /^#[0-9A-Fa-f]{6}$/.test(curColor)) {
      if (nativePicker) nativePicker.value = curColor;
      if (hexInput && document.activeElement !== hexInput) hexInput.value = curColor;
      const rgb = this.hexToRgb(curColor);
      if (sliderR) { sliderR.value = rgb.r; valR.innerText = rgb.r; }
      if (sliderG) { sliderG.value = rgb.g; valG.innerText = rgb.g; }
      if (sliderB) { sliderB.value = rgb.b; valB.innerText = rgb.b; }
    }

    if (sliderA) {
      const aPct = Math.round(opacity * 100);
      sliderA.value = aPct;
      if (valA) valA.innerText = `${aPct}%`;
    }

    if (strokeWidthSlider) {
      strokeWidthSlider.value = strokeWidth;
      if (strokeWidthVal) strokeWidthVal.innerText = `${strokeWidth}px`;
    }
  }

  // ========================================================
  // スウォッチシステム拡張: マイカラー (32色自動増設 & 管理)
  // ========================================================
  initSwatches() {
    const saved = localStorage.getItem('hirame_studio_swatches');
    if (saved) {
      try {
        this.swatchGroups = JSON.parse(saved);
      } catch (e) {
        this.swatchGroups = null;
      }
    }
    if (!this.swatchGroups || !Array.isArray(this.swatchGroups) || this.swatchGroups.length === 0) {
      this.swatchGroups = [
        {
          id: 'swatch_my_1',
          name: 'マイカラー',
          canDelete: false,
          colors: ['#38bdf8', '#0284c7', '#0f172a', '#f97316', '#10b981', '#facc15', '#ef4444', '#ffffff']
        }
      ];
      this.saveSwatches(this.swatchGroups);
    }
  }

  saveSwatches(groups) {
    this.swatchGroups = groups;
    try {
      localStorage.setItem('hirame_studio_swatches', JSON.stringify(groups));
    } catch (e) {}
  }

  registerSwatchColor(hex) {
    if (!hex || hex === 'none') {
      alert('「なし」はスウォッチに登録できません。有効なカラーコードを選択してください。');
      return;
    }
    hex = hex.toLowerCase();
    this.initSwatches();

    // 既に同じ色が登録済みかチェック（登録済みの場合はその位置を上書き）
    let foundGroup = null;
    let foundIndex = -1;
    for (const g of this.swatchGroups) {
      const idx = g.colors.indexOf(hex);
      if (idx !== -1) {
        foundGroup = g;
        foundIndex = idx;
        break;
      }
    }

    if (foundGroup) {
      foundGroup.colors[foundIndex] = hex;
      this.saveSwatches(this.swatchGroups);
      this.renderSwatches();
      this.selectNavTab?.('swatch');
      alert(`「${foundGroup.name}」の登録色（${hex}）を上書き更新しました！`);
      return;
    }

    // 未登録の場合: 最後の「マイカラー」グループを探す
    let targetGroup = this.swatchGroups[this.swatchGroups.length - 1];
    if (!targetGroup || targetGroup.colors.length >= 32) {
      // 32色を超えたら自動的にマイカラー2, 3... を追加
      const myCount = this.swatchGroups.filter(g => g.name.startsWith('マイカラー')).length;
      targetGroup = {
        id: `swatch_my_${Date.now()}`,
        name: `マイカラー${myCount + 1}`,
        canDelete: true,
        colors: []
      };
      this.swatchGroups.push(targetGroup);
    }

    targetGroup.colors.push(hex);
    this.saveSwatches(this.swatchGroups);
    this.renderSwatches();
    this.selectNavTab?.('swatch');
    alert(`スウォッチ「${targetGroup.name}」にカラー（${hex}）を追加登録しました！ (${targetGroup.colors.length}/32色)`);
  }

  addSwatchGroup(initialName = null) {
    this.initSwatches();
    const myCount = this.swatchGroups.length;
    const name = initialName || window.prompt('新しいスウォッチプリセット名を入力してください:', `マイカラー${myCount + 1}`);
    if (!name || !name.trim()) return;
    const newGroup = {
      id: `swatch_grp_${Date.now()}`,
      name: name.trim(),
      canDelete: true,
      colors: []
    };
    this.swatchGroups.push(newGroup);
    this.saveSwatches(this.swatchGroups);
    this.renderSwatches();
  }

  renameSwatchGroup(groupId) {
    this.initSwatches();
    const g = this.swatchGroups.find(x => x.id === groupId);
    if (!g) return;
    const newName = window.prompt('スウォッチプリセットの名前を入力してください:', g.name);
    if (!newName || !newName.trim()) return;
    g.name = newName.trim();
    this.saveSwatches(this.swatchGroups);
    this.renderSwatches();
  }

  deleteSwatchGroup(groupId) {
    this.initSwatches();
    if (this.swatchGroups.length <= 1) {
      alert('最後のスウォッチプリセットは削除できません。');
      return;
    }
    const idx = this.swatchGroups.findIndex(x => x.id === groupId);
    if (idx === -1) return;
    const g = this.swatchGroups[idx];
    if (!confirm(`スウォッチプリセット「${g.name}」を削除しますか？`)) return;
    this.swatchGroups.splice(idx, 1);
    this.saveSwatches(this.swatchGroups);
    this.renderSwatches();
  }

  moveSwatchGroup(groupId, delta) {
    this.initSwatches();
    const idx = this.swatchGroups.findIndex(x => x.id === groupId);
    if (idx === -1) return;
    const targetIdx = idx + delta;
    if (targetIdx < 0 || targetIdx >= this.swatchGroups.length) return;
    const [item] = this.swatchGroups.splice(idx, 1);
    this.swatchGroups.splice(targetIdx, 0, item);
    this.saveSwatches(this.swatchGroups);
    this.renderSwatches();
  }

  deleteSelectedSwatchGroups() {
    this.initSwatches();
    const checks = Array.from(this.container.querySelectorAll('.swatch-group-check:checked'));
    if (checks.length === 0) {
      alert('削除したいプリセットのチェックボックスを選択してください。');
      return;
    }
    if (checks.length >= this.swatchGroups.length) {
      alert('すべてのプリセットを同時に削除することはできません。少なくとも1つ残してください。');
      return;
    }
    if (!confirm(`選択された${checks.length}件のプリセットを削除しますか？`)) return;
    const selectedIds = new Set(checks.map(c => c.dataset.groupId));
    this.swatchGroups = this.swatchGroups.filter(g => !selectedIds.has(g.id));
    this.saveSwatches(this.swatchGroups);
    this.renderSwatches();
  }

  exportSwatchesJson() {
    this.initSwatches();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.swatchGroups, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `hirame_swatches_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  importSwatchesJson(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].colors) {
          this.saveSwatches(parsed);
          this.renderSwatches();
          alert(`スウォッチプリセット（${parsed.length}グループ）を正常に読み込みました！`);
        } else {
          alert('スウォッチJSONの形式が正しくありません。');
        }
      } catch (err) {
        alert('読み込みに失敗しました: ' + (err.message || err));
      }
    };
    reader.readAsText(file);
  }

  resetSwatchesToDefault() {
    if (!confirm('スウォッチをデフォルト初期設定に戻しますか？')) return;
    localStorage.removeItem('hirame_studio_swatches');
    this.swatchGroups = null;
    this.initSwatches();
    this.renderSwatches();
    alert('スウォッチをデフォルトに戻しました！');
  }

  // スウォッチパレットの描画
  renderSwatches() {
    const usedGrid = this.container.querySelector('#swatchUsedColorsGrid');
    const presetGrid = this.container.querySelector('#swatchPresetColorsGrid');
    if (!usedGrid || !presetGrid) return;

    // キャラクター使用色を収集
    const usedSet = new Set();
    if (this.character && this.character.parts) {
      for (const p of this.character.parts) {
        if (p.style?.fill && p.style.fill !== 'none') usedSet.add(p.style.fill.toLowerCase());
        if (p.style?.stroke && p.style.stroke !== 'none') usedSet.add(p.style.stroke.toLowerCase());
      }
    }
    const usedColors = Array.from(usedSet);

    usedGrid.innerHTML = '';
    if (usedColors.length === 0) {
      usedGrid.innerHTML = '<span style="grid-column: 1/-1; font-size: 10px; color: #71717a;">使用色なし</span>';
    } else {
      for (const c of usedColors) {
        const cell = document.createElement('div');
        cell.className = 'ps-swatch-cell';
        cell.style.backgroundColor = c;
        cell.title = c;
        cell.addEventListener('click', () => {
          this.applySwatchColor(c);
        });
        usedGrid.appendChild(cell);
      }
    }

    // 基本・海洋・キャラクタープリセットカラー
    const presetColors = [
      'none', '#000000', '#ffffff', '#e2e8f0', '#94a3b8', '#64748b', '#334155', '#1e293b',
      '#dc2626', '#ef4444', '#f87171', '#ea580c', '#f97316', '#fb923c', '#f59e0b', '#fef08a',
      '#84cc16', '#10b981', '#059669', '#0d9488', '#06b6d4', '#0284c7', '#38bdf8', '#2563eb',
      '#4f46e5', '#7c3aed', '#9333ea', '#c026d3', '#ec4899', '#f472b6', '#fda4af', '#78350f'
    ];

    presetGrid.innerHTML = '';
    for (const c of presetColors) {
      const cell = document.createElement('div');
      cell.className = 'ps-swatch-cell' + (c === 'none' ? ' none-swatch' : '');
      if (c !== 'none') cell.style.backgroundColor = c;
      cell.title = c === 'none' ? 'なし (透明)' : c;
      cell.addEventListener('click', () => {
        this.applySwatchColor(c);
      });
      presetGrid.appendChild(cell);
    }

    // マイカラー 動的グループ (最大32色・自動増設 & 管理)
    const customContainer = this.container.querySelector('#swatchCustomGroupsContainer');
    if (customContainer) {
      this.initSwatches();
      customContainer.innerHTML = '';

      this.swatchGroups.forEach((g, gIdx) => {
        const card = document.createElement('div');
        card.className = 'swatch-group-card';
        card.dataset.groupId = g.id;

        card.innerHTML = `
          <div class="swatch-group-header">
            <div class="swatch-group-left">
              <input type="checkbox" class="swatch-group-check" data-group-id="${g.id}">
              <span class="swatch-group-name" title="クリックで名前変更">${g.name}</span>
              <span class="swatch-group-count">(${g.colors.length}/32)</span>
            </div>
            <div class="swatch-group-actions">
              <button class="swatch-mini-btn btn-swatch-up" title="上に移動" ${gIdx === 0 ? 'disabled style="opacity:0.3;"' : ''}>▲</button>
              <button class="swatch-mini-btn btn-swatch-down" title="下に移動" ${gIdx === this.swatchGroups.length - 1 ? 'disabled style="opacity:0.3;"' : ''}>▼</button>
              <button class="swatch-mini-btn btn-swatch-rename" title="名前変更">✏️</button>
              <button class="swatch-mini-btn btn-swatch-delete" title="プリセット削除">🗑️</button>
            </div>
          </div>
          <div class="ps-swatch-grid-32"></div>
        `;

        const grid32 = card.querySelector('.ps-swatch-grid-32');
        for (let i = 0; i < 32; i++) {
          const slot = document.createElement('div');
          if (i < g.colors.length) {
            const c = g.colors[i];
            slot.className = 'ps-swatch-slot';
            slot.style.backgroundColor = c;
            slot.title = `${c} (クリックで適用、右クリックで削除)`;
            slot.addEventListener('click', () => {
              this.applySwatchColor(c);
            });
            slot.addEventListener('contextmenu', (e) => {
              e.preventDefault();
              if (confirm(`スウォッチからカラー「${c}」を削除しますか？`)) {
                g.colors.splice(i, 1);
                this.saveSwatches(this.swatchGroups);
                this.renderSwatches();
              }
            });
          } else {
            slot.className = 'ps-swatch-slot empty';
            slot.title = `空きスロット (${i + 1}/32)`;
          }
          grid32.appendChild(slot);
        }

        // イベントバインド
        card.querySelector('.swatch-group-name')?.addEventListener('click', () => this.renameSwatchGroup(g.id));
        card.querySelector('.btn-swatch-rename')?.addEventListener('click', () => this.renameSwatchGroup(g.id));
        card.querySelector('.btn-swatch-delete')?.addEventListener('click', () => this.deleteSwatchGroup(g.id));
        card.querySelector('.btn-swatch-up')?.addEventListener('click', () => this.moveSwatchGroup(g.id, -1));
        card.querySelector('.btn-swatch-down')?.addEventListener('click', () => this.moveSwatchGroup(g.id, 1));

        customContainer.appendChild(card);
      });
    }

    // スウォッチツールバーのイベント設定
    this.container.querySelector('#btnSwatchAddNewGroup')?.addEventListener('click', () => this.addSwatchGroup());
    this.container.querySelector('#btnSwatchImport')?.addEventListener('click', () => {
      this.container.querySelector('#swatchFileInput')?.click();
    });
    this.container.querySelector('#btnSwatchExport')?.addEventListener('click', () => this.exportSwatchesJson());
    this.container.querySelector('#btnSwatchDeleteSelected')?.addEventListener('click', () => this.deleteSelectedSwatchGroups());
    this.container.querySelector('#btnSwatchResetDefault')?.addEventListener('click', () => this.resetSwatchesToDefault());

    const fileInp = this.container.querySelector('#swatchFileInput');
    if (fileInp && !fileInp._bound) {
      fileInp._bound = true;
      fileInp.addEventListener('change', (e) => {
        const f = e.target.files[0];
        if (f) this.importSwatchesJson(f);
        fileInp.value = '';
      });
    }
  }

  applySwatchColor(color) {
    const part = this.editor ? this.editor.getSelectedPart() : null;
    if (part) {
      this.editor.pushState();
      if (this.activeColorMode === 'fill') {
        part.style.fill = color;
      } else {
        part.style.stroke = color;
        if (color !== 'none' && (!part.style.strokeWidth || part.style.strokeWidth === 0)) {
          part.style.strokeWidth = 2;
        }
      }
      this.editor.render();
      try { this.updateInspectorPreview(); } catch (_) {}
      this.renderInspector();
      this.syncNavigatorColorChips();
    }
  }

  // ========================================================
  // ナビゲーター: 「全体を表示」 (Fit to Canvas)
  // ========================================================
  fitToCanvas() {
    if (!this.editor || !this.character || !this.character.parts || this.character.parts.length === 0) return;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let hasPoints = false;

    for (const part of this.character.parts) {
      if (part.visible === false) continue;
      if (part.points && part.points.length > 0) {
        for (const pt of part.points) {
          hasPoints = true;
          if (pt.x < minX) minX = pt.x;
          if (pt.x > maxX) maxX = pt.x;
          if (pt.y < minY) minY = pt.y;
          if (pt.y > maxY) maxY = pt.y;
        }
      }
    }

    if (!hasPoints) {
      minX = -120; maxX = 120; minY = -70; maxY = 70;
    }

    const charW = Math.max(40, maxX - minX);
    const charH = Math.max(40, maxY - minY);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    const stageRect = this.editor.container ? this.editor.container.getBoundingClientRect() : null;
    const stageW = (stageRect && stageRect.width > 0) ? stageRect.width : 900;
    const stageH = (stageRect && stageRect.height > 0) ? stageRect.height : 560;

    const availW = Math.max(100, stageW - 140);
    const availH = Math.max(100, stageH - 140);

    const fitZoom = Math.max(0.2, Math.min(3.5, Math.min(availW / charW, availH / charH)));
    const facing = this.editor.previewFacing || 1;

    this.editor.zoom = fitZoom;
    this.editor.panX = (stageW / 2) - cx * fitZoom * facing;
    this.editor.panY = (stageH / 2) - cy * fitZoom;

    this.editor.updateViewportTransform();
    this.syncNavigator();
    this.updateCanvasStatusBar();
  }

  rgbToHex(r, g, b) {
    const toH = (n) => {
      const h = Math.max(0, Math.min(255, Math.round(n))).toString(16);
      return h.length === 1 ? '0' + h : h;
    };
    return `#${toH(r)}${toH(g)}${toH(b)}`;
  }

  hexToRgb(hex) {
    if (!hex || hex === 'none') return { r: 255, g: 255, b: 255 };
    let c = hex.replace('#', '');
    if (c.length === 3) {
      c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    }
    const num = parseInt(c, 16);
    if (isNaN(num)) return { r: 255, g: 255, b: 255 };
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  }


  // ========================================================
  // 2. レイヤーパネル (左) & ドラッグ＆ドロップ & 階層開閉
  // ========================================================
  renderLayerTree() {
    const list = this.container.querySelector('#layerTreeList');
    if (!list || !this.character) return;

    list.innerHTML = '';

    // 上部にリグ仕様の解説バナーを配置
    const banner = document.createElement('div');
    banner.className = 'rig-info-banner';
    banner.innerHTML = `<span class="rig-info-icon">🦴</span><span><strong>リグ構造 (連動システム):</strong> 親を動かすとぶら下がる子パーツ（🔗）が自動で追従します。</span>`;
    list.appendChild(banner);

    const partMap = new Map();
    for (const p of this.character.parts) {
      partMap.set(p.id, p);
    }

    // 子マップ (parentId -> array of children parts)
    const childMap = new Map();
    for (const p of this.character.parts) {
      if (p.parentId && partMap.has(p.parentId)) {
        if (!childMap.has(p.parentId)) childMap.set(p.parentId, []);
        childMap.get(p.parentId).push(p);
      }
    }

    // ルートパーツ (親がいないか、存在しない親IDを持つパーツ)
    const rootParts = this.character.parts
      .filter(p => !p.parentId || !partMap.has(p.parentId))
      .sort((a, b) => b.zIndex - a.zIndex);

    // 再帰的に子孫IDを取得するヘルパー
    const getDescendantIds = (parentId) => {
      const ids = [];
      const stack = [...(childMap.get(parentId) || []).map(c => c.id)];
      while (stack.length > 0) {
        const id = stack.pop();
        ids.push(id);
        const nextChildren = childMap.get(id) || [];
        for (const nc of nextChildren) stack.push(nc.id);
      }
      return ids;
    };

    const renderNode = (part, depth = 0, isLast = true, ancestorLines = '') => {
      // 親が折りたたまれている場合は非表示
      if (part.parentId && this.isAncestorCollapsed(part.parentId)) {
        return;
      }

      const isSelected = this.editor.selectedPartIds?.has(part.id) || part.id === this.editor.selectedPartId;
      const children = (childMap.get(part.id) || []).sort((a, b) => b.zIndex - a.zIndex);
      const hasChildren = children.length > 0;
      const isCollapsed = this.collapsedParts.has(part.id);

      const item = document.createElement('div');
      item.className = `layer-item rig-node-row ${isSelected ? 'active' : ''}`;
      item.dataset.partId = part.id;
      item.draggable = true;

      // アイコン
      let icon = '🔹';
      if (part.type.includes('tail')) icon = '🎏';
      else if (part.type.includes('fin')) icon = '🪶';
      else if (part.type === 'eyes') icon = '👀';
      else if (part.type === 'mouth') icon = '👄';
      else if (part.type === 'body_front') icon = '🐟';

      // ツリー枝記号 (Autodesk Outliner / Rig 仕様)
      let branchSymbol = '';
      if (depth > 0) {
        branchSymbol = ancestorLines + (isLast ? '└── ' : '├── ');
      }

      // 連動バッジ
      let badgeHtml = '';
      if (depth === 0) {
        if (hasChildren) {
          badgeHtml = `<span class="rig-bone-badge parent" title="子パーツを統括する親ボーン">🦴 親 [連動:${children.length}]</span>`;
        } else {
          badgeHtml = `<span class="rig-bone-badge root" title="最上位の独立パーツ">⚓ ルート</span>`;
        }
      } else {
        const parentName = partMap.get(part.parentId)?.name || '親';
        if (hasChildren) {
          badgeHtml = `<span class="rig-bone-badge parent" title="親「${parentName}」に連動しつつ自身も子を持つ">🦴 連動親 [連動:${children.length}]</span>`;
        } else {
          badgeHtml = `<span class="rig-bone-badge child" title="親「${parentName}」に連動して移動・回転">🔗 連動 [親: ${parentName}]</span>`;
        }
      }

      item.innerHTML = `
        <div class="layer-item-left rig-node-left">
          ${hasChildren ? `<button class="layer-collapse-btn" title="子パーツ折りたたみ">${isCollapsed ? '▶' : '▼'}</button>` : '<span class="collapse-spacer"></span>'}
          <button class="layer-eye-btn" title="表示/非表示">${part.visible !== false ? '👁️' : '🙈'}</button>
          <button class="layer-lock-btn ${part.locked ? 'locked' : ''}" title="${part.locked ? 'ロック解除' : '編集ロック (キャンバス操作不可)'}">${part.locked ? '🔒' : '🔏'}</button>
          ${depth > 0 ? `<span class="rig-tree-branch">${branchSymbol}</span>` : ''}
          <span class="layer-icon">${icon}</span>
          <span class="layer-name" title="ダブルクリックで名前編集">${part.name}</span>
          ${badgeHtml}
        </div>
        <div class="layer-item-actions">
          <button class="layer-mini-btn btn-rename-part" title="部位名を変更">✏️</button>
          <button class="layer-mini-btn btn-clone-this" title="複製">📋</button>
          ${part.parentId ? `<button class="layer-mini-btn btn-unparent-this" title="親から解除してルートへ移動">⏏️</button>` : ''}
        </div>
      `;

      // ホバーで連動する子パーツを視覚的に強調表示
      item.addEventListener('mouseenter', () => {
        const descendantIds = getDescendantIds(part.id);
        descendantIds.forEach(id => {
          const el = list.querySelector(`.layer-item[data-part-id="${id}"]`);
          el?.classList.add('branch-highlight');
        });
      });
      item.addEventListener('mouseleave', () => {
        list.querySelectorAll('.branch-highlight').forEach(el => el.classList.remove('branch-highlight'));
      });

      // クリックで選択 (ShiftキーまたはCtrlキー同時押しで複数選択)
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('layer-eye-btn')) {
          e.stopPropagation();
          part.visible = !part.visible;
          this.editor.render();
          try { this.updateInspectorPreview(); } catch (_) {}
          this.renderLayerTree();
          return;
        }

        if (e.target.classList.contains('layer-lock-btn')) {
          e.stopPropagation();
          part.locked = !part.locked;
          this.editor.render();
          this.renderLayerTree();
          return;
        }

        if (e.target.classList.contains('layer-collapse-btn')) {
          e.stopPropagation();
          if (this.collapsedParts.has(part.id)) {
            this.collapsedParts.delete(part.id);
          } else {
            this.collapsedParts.add(part.id);
          }
          this.renderLayerTree();
          return;
        }

        if (e.target.classList.contains('btn-unparent-this')) {
          e.stopPropagation();
          this.unparentLayer(part.id);
          return;
        }

        if (e.target.classList.contains('btn-rename-part') || e.target.classList.contains('layer-name')) {
          if (e.detail === 2 || e.target.classList.contains('btn-rename-part')) {
            e.stopPropagation();
            this.startInlineRename(part, item);
            return;
          }
        }

        if (e.target.classList.contains('btn-clone-this')) {
          e.stopPropagation();
          this.duplicatePart(part.id);
          return;
        }

        const isShiftOrCtrl = e.shiftKey || e.ctrlKey || e.metaKey;
        if (isShiftOrCtrl) {
          if (!this.editor.selectedPartIds) {
            this.editor.selectedPartIds = new Set();
          }
          if (this.editor.selectedPartId && this.editor.selectedPartIds.size === 0) {
            this.editor.selectedPartIds.add(this.editor.selectedPartId);
          }
          if (this.editor.selectedPartIds.has(part.id)) {
            this.editor.selectedPartIds.delete(part.id);
            if (this.editor.selectedPartId === part.id) {
              this.editor.selectedPartId = this.editor.selectedPartIds.size > 0 ? Array.from(this.editor.selectedPartIds)[0] : null;
            }
          } else {
            this.editor.selectedPartIds.add(part.id);
            this.editor.selectedPartId = part.id;
          }
        } else {
          if (!this.editor.selectedPartIds) {
            this.editor.selectedPartIds = new Set();
          }
          this.editor.selectedPartIds.clear();
          this.editor.selectedPartIds.add(part.id);
          this.editor.selectedPartId = part.id;
        }

        this.editor.selectedPointIndex = -1;
        this.editor.render();
        this.renderLayerTree();
        this.renderInspector();
        this.renderTimeline();
      });

      // HTML5 Drag and Drop によるレイヤー並び替え ＆ 親子付け
      item.addEventListener('dragstart', (e) => {
        this.draggedPartId = part.id;
        e.dataTransfer.effectAllowed = 'move';
        item.classList.add('dragging');
      });

      item.addEventListener('dragend', () => {
        this.draggedPartId = null;
        item.classList.remove('dragging');
        this.container.querySelectorAll('.layer-item').forEach(el => el.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-inside'));
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const rect = item.getBoundingClientRect();
        const relY = e.clientY - rect.top;
        const h = rect.height;

        item.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-inside');

        if (relY < h * 0.25) {
          item.classList.add('drag-over-top');
        } else if (relY > h * 0.75) {
          item.classList.add('drag-over-bottom');
        } else {
          item.classList.add('drag-over-inside');
        }
      });

      item.addEventListener('dragleave', () => {
        item.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-inside');
      });

      item.addEventListener('drop', (e) => {
        e.preventDefault();
        const wasInside = item.classList.contains('drag-over-inside');
        item.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-inside');
        if (!this.draggedPartId || this.draggedPartId === part.id) return;

        const rect = item.getBoundingClientRect();
        const relY = e.clientY - rect.top;
        const h = rect.height;

        if (wasInside || (relY >= h * 0.25 && relY <= h * 0.75)) {
          this.makeChildLayerByDrop(this.draggedPartId, part.id);
        } else {
          const dropAbove = relY < h * 0.5;
          this.reorderLayerByDrop(this.draggedPartId, part.id, dropAbove);
        }
      });

      list.appendChild(item);

      // 子パーツの描画（展開されている場合）
      if (!isCollapsed && hasChildren) {
        const nextAncestorLines = ancestorLines + (isLast ? '&nbsp;&nbsp;&nbsp;&nbsp;' : '│&nbsp;&nbsp;&nbsp;');
        children.forEach((child, idx) => {
          renderNode(child, depth + 1, idx === children.length - 1, nextAncestorLines);
        });
      }
    };

    // ルートパーツから順に再帰描画
    rootParts.forEach((rootPart, idx) => {
      renderNode(rootPart, 0, idx === rootParts.length - 1, '');
    });
  }

  // レイヤーを親に重ねて話した時の自動子レイヤー化
  // レイヤーを親に重ねて離した時の自動子レイヤー化
  makeChildLayerByDrop(draggedId, targetParentId) {
    if (!draggedId || !targetParentId || draggedId === targetParentId) return;

    // 循環親子チェック (自身の子孫を親にはできない)
    const isDescendant = (childId, ancestorId) => {
      let curr = this.character.parts.find(p => p.id === childId);
      while (curr && curr.parentId) {
        if (curr.parentId === ancestorId) return true;
        curr = this.character.parts.find(p => p.id === curr.parentId);
      }
      return false;
    };

    if (isDescendant(targetParentId, draggedId)) {
      alert('自身の子孫レイヤーを親に設定することはできません');
      return;
    }

    const draggedPart = this.character.parts.find(p => p.id === draggedId);
    const targetParent = this.character.parts.find(p => p.id === targetParentId);
    if (!draggedPart || !targetParent) return;

    this.editor.pushState();

    draggedPart.parentId = targetParentId;
    // 親が折りたたまれていたら自動展開
    this.collapsedParts.delete(targetParentId);

    // zIndex降順リスト (先頭が最前面)
    const list = [...this.character.parts].sort((a, b) => b.zIndex - a.zIndex);
    const draggedIdx = list.findIndex(p => p.id === draggedId);
    if (draggedIdx !== -1) {
      list.splice(draggedIdx, 1);
      const targetIdx = list.findIndex(p => p.id === targetParentId);
      // 親の直前（前面）に配置
      list.splice(Math.max(0, targetIdx), 0, draggedPart);
    }

    // zIndex 再採番 (先頭が最前面)
    const total = list.length;
    list.forEach((p, i) => {
      p.zIndex = (total - i) * 10;
    });
    this.character.parts = list;

    this.editor.render();
    try { this.updateInspectorPreview(); } catch (_) {}
    this.renderLayerTree();
    this.renderInspector();
  }

  // 親レイヤーから解除（ルートに戻す）
  unparentLayer(partId) {
    const part = this.character.parts.find(p => p.id === partId);
    if (!part || !part.parentId) return;
    this.editor.pushState();
    part.parentId = null;
    this.editor.render();
    try { this.updateInspectorPreview(); } catch (_) {}
    this.renderLayerTree();
    this.renderInspector();
  }

  isAncestorCollapsed(parentId) {
    if (!parentId) return false;
    if (this.collapsedParts.has(parentId)) return true;
    const parent = this.character.parts.find(p => p.id === parentId);
    return parent ? this.isAncestorCollapsed(parent.parentId) : false;
  }

  startInlineRename(part, itemEl) {
    const nameEl = itemEl.querySelector('.layer-name');
    if (!nameEl) return;
    const currentName = part.name;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'studio-input-inline';
    input.value = currentName;

    const commit = () => {
      const newName = input.value.trim();
      if (newName) part.name = newName;
      this.renderLayerTree();
      this.renderInspector();
    };

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        input.removeEventListener('blur', commit);
        commit();
      } else if (e.key === 'Escape') {
        this.renderLayerTree();
      }
    });

    nameEl.replaceWith(input);
    input.focus();
    input.select();
  }

  // ドラッグ＆ドロップによるレイヤー順序変更と zIndex の再計算
  reorderLayerByDrop(draggedId, targetId, dropAbove) {
    if (!draggedId || !targetId || draggedId === targetId) return;
    const draggedPart = this.character.parts.find(p => p.id === draggedId);
    const targetPart = this.character.parts.find(p => p.id === targetId);
    if (!draggedPart || !targetPart) return;

    this.editor.pushState();

    // 兄弟階層化: 移動先と同じ親を持たせる
    draggedPart.parentId = targetPart.parentId || null;

    // zIndex降順リスト (先頭が最前面)
    const list = [...this.character.parts].sort((a, b) => b.zIndex - a.zIndex);
    const draggedIdx = list.findIndex(p => p.id === draggedId);
    if (draggedIdx < 0) return;
    list.splice(draggedIdx, 1);

    const targetIdx = list.findIndex(p => p.id === targetId);
    if (targetIdx < 0) {
      list.push(draggedPart);
    } else {
      // 降順リストでは dropAbove（上側）はインデックスが前
      const insertIdx = dropAbove ? targetIdx : targetIdx + 1;
      list.splice(insertIdx, 0, draggedPart);
    }

    const total = list.length;
    list.forEach((p, i) => {
      p.zIndex = (total - i) * 10;
    });
    this.character.parts = list;

    this.editor.render();
    try { this.updateInspectorPreview(); } catch (_) {}
    this.renderLayerTree();
    this.renderInspector();
  }

  // レイヤー順序操作ボタン (最前面, 前面, 背面, 最背面)
  moveLayerOrder(direction) {
    const part = this.editor.getSelectedPart();
    if (!part) return;

    this.editor.pushState();

    // zIndex降順リスト (0: 最前面, N-1: 最背面)
    const list = [...this.character.parts].sort((a, b) => b.zIndex - a.zIndex);
    const idx = list.findIndex(p => p.id === part.id);
    if (idx < 0) return;

    if (direction === 'top') {
      if (idx === 0) return;
      list.splice(idx, 1);
      list.unshift(part);
    } else if (direction === 'bottom') {
      if (idx === list.length - 1) return;
      list.splice(idx, 1);
      list.push(part);
    } else if (direction === 'up') {
      if (idx === 0) return;
      const prev = list[idx - 1];
      list[idx - 1] = part;
      list[idx] = prev;
    } else if (direction === 'down') {
      if (idx === list.length - 1) return;
      const next = list[idx + 1];
      list[idx + 1] = part;
      list[idx] = next;
    }

    const total = list.length;
    list.forEach((p, i) => {
      p.zIndex = (total - i) * 10;
    });
    this.character.parts = list;

    this.editor.render();
    try { this.updateInspectorPreview(); } catch (_) {}
    this.renderLayerTree();
    this.renderInspector();
  }

  copySelectedLayers() {
    const parts = this.editor.getSelectedParts();
    if (!parts || parts.length === 0) return false;
    this.clipboardLayers = parts.map(p => JSON.parse(JSON.stringify(p)));
    return true;
  }

  pasteLayers() {
    if (!this.clipboardLayers || this.clipboardLayers.length === 0) return false;
    this.editor.pushState();

    const maxZ = Math.max(...this.character.parts.map(p => p.zIndex || 0), 0);
    const newSelectedIds = new Set();
    const idMap = new Map();

    // 1パス目: IDの生成
    this.clipboardLayers.forEach((cp, idx) => {
      const newId = `${cp.id}_copy_${Date.now().toString().slice(-4)}_${idx}`;
      idMap.set(cp.id, newId);
    });

    // 2パス目: クローンして座標を少しずらして追加
    this.clipboardLayers.forEach((cp, idx) => {
      const cloned = clonePart(cp);
      cloned.id = idMap.get(cp.id);
      cloned.name = `${cp.name} (コピー)`;
      cloned.zIndex = maxZ + (idx + 1) * 10;

      if (cloned.parentId && idMap.has(cloned.parentId)) {
        cloned.parentId = idMap.get(cloned.parentId);
      }

      // 視覚的に貼り付けられたことがわかるように +15px, +15px ずらす
      if (cloned.pivot) {
        cloned.pivot.x += 15;
        cloned.pivot.y += 15;
      }
      if (cloned.points && Array.isArray(cloned.points)) {
        cloned.points.forEach(pt => {
          pt.x += 15;
          pt.y += 15;
          if (pt.inHandle) { pt.inHandle.x += 15; pt.inHandle.y += 15; }
          if (pt.outHandle) { pt.outHandle.x += 15; pt.outHandle.y += 15; }
        });
      }
      if (cloned.subPaths && Array.isArray(cloned.subPaths)) {
        cloned.subPaths.forEach(sub => {
          if (sub.type === 'circle') {
            sub.cx += 15;
            sub.cy += 15;
          } else if (sub.points) {
            sub.points.forEach(p => { p.x += 15; p.y += 15; });
          }
        });
      }

      this.character.parts.push(cloned);
      newSelectedIds.add(cloned.id);
    });

    this.editor.selectedPartIds = newSelectedIds;
    this.editor.selectedPartId = Array.from(newSelectedIds)[0];

    this.editor.render();
    this.renderLayerTree();
    this.renderInspector();
    this.renderTimeline();
    this.updateInspectorPreview();
    return true;
  }

  duplicatePart(partId = null) {
    if (partId) {
      const target = this.character.parts.find(p => p.id === partId);
      if (!target) return;
      this.clipboardLayers = [JSON.parse(JSON.stringify(target))];
      this.pasteLayers();
      return;
    }

    if (this.copySelectedLayers()) {
      this.pasteLayers();
    }
  }

  // ========================================================
  // 3. インスペクターパネル (右)
  // ========================================================
  renderInspector() {
    const insp = this.container.querySelector('#inspectorContent');
    const tabNav = this.container.querySelector('#inspectorTabNav');
    const part = this.editor.getSelectedPart();
    if (!insp) return;

    // タブナビゲーションのアクティブ状態を同期
    if (tabNav) {
      tabNav.querySelectorAll('.inspector-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === this.activeInspectorTab);
      });
    }

    const presetHeaderHtml = `
      <div class="insp-section preset-header-section" style="border-bottom: 2px solid rgba(56, 189, 248, 0.25); margin-bottom: 12px; padding-bottom: 10px;">
        <div class="insp-title" style="color: #38bdf8; display:flex; align-items:center; justify-content:space-between;">
          <span>🏷️ プリセット名 (キャラクター名)</span>
          <span style="font-size:10px; color:#94a3b8; font-weight:normal;">[${this.character?.id || ''}]</span>
        </div>
        <div class="form-row">
          <label>プリセット名:</label>
          <input type="text" id="propPresetName" value="${(this.character?.name || '').replace(/"/g, '&quot;')}" class="studio-input" placeholder="例: 漢字「魬」てすと">
        </div>
      </div>
    `;

    if (!part) {
      insp.innerHTML = `
        ${presetHeaderHtml}
        <div class="empty-inspector">パーツを選択すると詳細プロパティ（塗りと線、アンカー等）を編集できます</div>
      `;
      this.bindPresetNameEvent();
      return;
    }

    const isDescendant = (childId, ancestorId) => {
      let curr = this.character.parts.find(p => p.id === childId);
      while (curr && curr.parentId) {
        if (curr.parentId === ancestorId) return true;
        curr = this.character.parts.find(p => p.id === curr.parentId);
      }
      return false;
    };

    const parentOptions = this.character.parts
      .filter(p => p.id !== part.id && !isDescendant(p.id, part.id))
      .map(p => `<option value="${p.id}" ${part.parentId === p.id ? 'selected' : ''}>${p.name}</option>`)
      .join('');

    let sectionHtml = '';

    if (this.activeInspectorTab === 'general') {
      // 1. プリセット名 ＆ パーツ基本属性
      sectionHtml = `
        ${presetHeaderHtml}
        <div class="insp-section">
          <div class="insp-title">パーツ基本属性</div>
          <div class="form-row">
            <label>名前:</label>
            <input type="text" id="propPartName" value="${part.name}" class="studio-input">
          </div>
          <div class="form-row">
            <label>親パーツ (階層リグ):</label>
            <select id="propParentId" class="studio-select">
              <option value="">(なし: ルート)</option>
              ${parentOptions}
            </select>
          </div>
          <div class="form-row-dual">
            <div>
              <label>原点X (Pivot):</label>
              <input type="number" id="propPivotX" value="${Math.round(part.pivot.x)}" class="studio-input">
            </div>
            <div>
              <label>原点Y (Pivot):</label>
              <input type="number" id="propPivotY" value="${Math.round(part.pivot.y)}" class="studio-input">
            </div>
          </div>
        </div>

        ${(part.type === 'text' || part.text) ? `
        <!-- フォント・テキスト属性 -->
        <div class="insp-section">
          <div class="insp-title">🔤 フォント・文字設定</div>
          <div class="form-row">
            <label>表示テキスト (文字):</label>
            <input type="text" id="propPartText" value="${part.text || ''}" class="studio-input" placeholder="例: 鰈, 鮃, 魚">
          </div>
          <div class="form-row">
            <label>文字サイズ (px):</label>
            <div class="prop-slider-number-row">
              <input type="range" id="propFontSize" min="10" max="300" step="1" value="${part.fontSize || part.style?.fontSize || 80}" class="studio-slider">
              <input type="number" id="propFontSizeNum" min="10" max="300" step="1" value="${part.fontSize || part.style?.fontSize || 80}" class="prop-number-input">
              <span class="prop-number-unit">px</span>
            </div>
          </div>
          <div class="form-row">
            <label>フォント書体:</label>
            <select id="propFontFamily" class="studio-select">
              <option value='"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif' ${(part.fontFamily || '').includes('Mincho') ? 'selected' : ''}>明朝体 (格調高い筆文字)</option>
              <option value='"Hiragino Kaku Gothic ProN", "Yu Gothic", "Noto Sans JP", sans-serif' ${(part.fontFamily || '').includes('Gothic') ? 'selected' : ''}>ゴシック体 (力強い太字)</option>
              <option value='"HGSGyoshotai", "KouzanGyousho", cursive, serif' ${(part.fontFamily || '').includes('cursive') ? 'selected' : ''}>行書体・毛筆調</option>
            </select>
          </div>
        </div>
        ` : ''}
      `;
    } else if (this.activeInspectorTab === 'style') {
      // 2. 塗り＆線 (スタイル)
      sectionHtml = `
        <div class="insp-section">
          <div class="insp-title">塗り & 線 (スタイル)</div>

          <!-- 塗り -->
          <div class="form-row">
            <label>塗り (Fill):</label>
            <div class="color-toggle-row">
              <div class="color-input-wrap">
                <input type="color" id="propFillColor" value="${part.style.fill !== 'none' ? part.style.fill : '#38bdf8'}" class="studio-color" ${part.style.fill === 'none' ? 'disabled' : ''}>
                <input type="text" id="propFillColorHex" class="color-hex-input studio-input" value="${part.style.fill !== 'none' ? part.style.fill : 'none'}" placeholder="#000000" maxlength="7" spellcheck="false" title="カラーコード (Hex) コピペ・入力可能" ${part.style.fill === 'none' ? 'disabled' : ''}>
              </div>
              <button id="btnToggleFillNone" class="btn-none-toggle ${part.style.fill === 'none' ? 'active' : ''}" title="塗りをなしにする">なし</button>
              <button id="btnRegisterFillSwatch" class="btn-register-swatch" title="現在の塗り色をスウォッチに登録">🎨 スウォッチ登録</button>
            </div>
          </div>

          <!-- 線 -->
          <div class="form-row">
            <label>線 (Stroke):</label>
            <div class="color-toggle-row">
              <div class="color-input-wrap">
                <input type="color" id="propStrokeColor" value="${part.style.stroke !== 'none' ? part.style.stroke : '#0f172a'}" class="studio-color" ${part.style.stroke === 'none' ? 'disabled' : ''}>
                <input type="text" id="propStrokeColorHex" class="color-hex-input studio-input" value="${part.style.stroke !== 'none' ? part.style.stroke : 'none'}" placeholder="#000000" maxlength="7" spellcheck="false" title="カラーコード (Hex) コピペ・入力可能" ${part.style.stroke === 'none' ? 'disabled' : ''}>
              </div>
              <button id="btnToggleStrokeNone" class="btn-none-toggle ${part.style.stroke === 'none' ? 'active' : ''}" title="線をなしにする">なし</button>
              <button id="btnRegisterStrokeSwatch" class="btn-register-swatch" title="現在の線色をスウォッチに登録">🎨 スウォッチ登録</button>
            </div>
          </div>

          <div class="form-row">
            <label>線幅 (px):</label>
            <div class="prop-slider-number-row">
              <input type="range" id="propStrokeWidth" min="0" max="50" step="0.5" value="${part.style.stroke !== 'none' ? (part.style.strokeWidth ?? 2) : 0}" class="studio-slider" ${part.style.stroke === 'none' ? 'disabled' : ''}>
              <input type="number" id="propStrokeWidthNum" min="0" max="50" step="0.5" value="${part.style.stroke !== 'none' ? (part.style.strokeWidth ?? 2) : 0}" class="prop-number-input" ${part.style.stroke === 'none' ? 'disabled' : ''}>
              <span class="prop-number-unit">px</span>
            </div>
          </div>

          <!-- 線の位置 (中央・内側・外側) -->
          <div class="form-row">
            <label>線の位置:</label>
            <div class="stroke-position-group">
              <button class="btn-stroke-pos ${(part.style.strokePosition || 'center') === 'center' ? 'active' : ''}" data-pos="center" title="線を中心に配置">中央</button>
              <button class="btn-stroke-pos ${part.style.strokePosition === 'inside' ? 'active' : ''}" data-pos="inside" title="線をパスの内側に配置">内側</button>
              <button class="btn-stroke-pos ${part.style.strokePosition === 'outside' ? 'active' : ''}" data-pos="outside" title="線をパスの外側に配置">外側</button>
            </div>
          </div>

          <div class="form-row">
            <label>不透明度 (%):</label>
            <div class="prop-slider-number-row">
              <input type="range" id="propOpacity" min="0" max="100" step="1" value="${Math.round((part.style.opacity ?? 1) * 100)}" class="studio-slider">
              <input type="number" id="propOpacityNum" min="0" max="100" step="1" value="${Math.round((part.style.opacity ?? 1) * 100)}" class="prop-number-input">
              <span class="prop-number-unit">%</span>
            </div>
          </div>
        </div>
      `;
    } else if (this.activeInspectorTab === 'anchor') {
      // 3. アンカーポイント
      sectionHtml = `
        <div class="insp-section">
          <div class="insp-title">アンカーポイント (${this.editor.selectedPointIndex >= 0 ? `No.${this.editor.selectedPointIndex}` : '未選択'})</div>
          ${this.renderPointInspector(part)}
        </div>
      `;
    } else if (this.activeInspectorTab === 'reaction') {
      // 4. ゲームリアクション設定
      sectionHtml = `
        <div class="insp-section">
          <div class="insp-title">ゲームリアクション設定</div>
          <div class="form-row">
            <label>タップ時の反応:</label>
            <select id="propReaction" class="studio-select">
              <option value="flee" ${this.character.reactions.touchWrong === 'flee' ? 'selected' : ''}>逃走 (高速ダッシュ)</option>
              <option value="angry" ${this.character.reactions.touchWrong === 'angry' ? 'selected' : ''}>怒る (威嚇・大口)</option>
              <option value="surprise" ${this.character.reactions.touchWrong === 'surprise' ? 'selected' : ''}>驚く (跳ねる)</option>
            </select>
          </div>
          <div class="form-row">
            <label>逃走速度倍率:</label>
            <div class="prop-slider-number-row">
              <input type="range" id="propFleeSpd" min="0.5" max="10.0" step="0.1" value="${this.character.reactions.fleeSpeedMultiplier}" class="studio-slider">
              <input type="number" id="propFleeSpdNum" min="0.5" max="10.0" step="0.1" value="${this.character.reactions.fleeSpeedMultiplier}" class="prop-number-input">
              <span class="prop-number-unit">倍</span>
            </div>
          </div>
        </div>
      `;
    }

    insp.innerHTML = sectionHtml;
    this.bindInspectorEvents(part);
  }

  renderPointInspector(part) {
    if (this.editor.selectedPointIndex < 0 || !part.points[this.editor.selectedPointIndex]) {
      return `<p class="desc-text">キャンバス上のアンカーポイントをクリックすると座標や直線/スムーズの切り替えが可能です。</p>`;
    }

    const pt = part.points[this.editor.selectedPointIndex];
    return `
      <div class="form-row-dual">
        <div>
          <label>X座標:</label>
          <input type="number" id="propPointX" value="${Math.round(pt.x)}" class="studio-input">
        </div>
        <div>
          <label>Y座標:</label>
          <input type="number" id="propPointY" value="${Math.round(pt.y)}" class="studio-input">
        </div>
      </div>
      <div class="form-row">
        <label>ポイント種別:</label>
        <div class="btn-toggle-pair">
          <button id="btnSetCorner" class="pill-btn ${pt.type === 'corner' ? 'active' : ''}">直線 (角)</button>
          <button id="btnSetSmooth" class="pill-btn ${pt.type === 'smooth' ? 'active' : ''}">スムーズ (曲線)</button>
        </div>
      </div>
      <button id="btnDeletePt" class="btn-danger-sm">このポイントを削除</button>
    `;
  }

  bindPresetNameEvent() {
    const insp = this.container.querySelector('#inspectorContent');
    if (!insp || !this.character) return;
    const presetInput = insp.querySelector('#propPresetName');
    if (!presetInput || presetInput._bound) return;
    presetInput._bound = true;

    presetInput.addEventListener('input', (e) => {
      const newName = e.target.value;
      this.character.name = newName;

      // rosterに保存して左側ビンツリーやブレッドクラムに即時連動
      const roster = this.getRoster();
      if (roster && this.character.id) {
        if (!roster[this.character.id]) {
          roster[this.character.id] = JSON.parse(JSON.stringify(this.character));
        } else {
          roster[this.character.id].name = newName;
        }
        this.saveRoster(roster);
      }
      this.renderBinTree();
      this.updatePresetSelectOptions();
      this.updateActiveBinBreadcrumb();
    });
  }

  bindInspectorEvents(part) {
    const insp = this.container.querySelector('#inspectorContent');
    if (!insp || !part) return;

    this.bindPresetNameEvent();

    insp.querySelector('#propPartName')?.addEventListener('input', (e) => {
      const newPartName = e.target.value;
      part.name = newPartName;
      this.renderLayerTree();

      // 「プロパティ」のパーツ基本属性の「名前」の変更も連動
      // ユーザー要望：パーツ基本属性の名前を変更した際、単一パーツやメイン文字パーツ等でプリセット名・左側一覧も即座に同期連動
      const isSinglePart = !this.character.parts || this.character.parts.length <= 1;
      const presetInput = insp.querySelector('#propPresetName');
      if (isSinglePart || (presetInput && (!this.character.name || this.character.name === 'キャラクター' || this.character.name.startsWith('新規') || isSinglePart))) {
        this.character.name = newPartName;
        if (presetInput) presetInput.value = newPartName;

        const roster = this.getRoster();
        if (roster && this.character.id) {
          if (!roster[this.character.id]) {
            roster[this.character.id] = JSON.parse(JSON.stringify(this.character));
          } else {
            roster[this.character.id].name = newPartName;
          }
          this.saveRoster(roster);
        }
        this.renderBinTree();
        this.updatePresetSelectOptions();
        this.updateActiveBinBreadcrumb();
      }

      // 親パーツ選択セレクトボックスのテキストも同期
      insp.querySelectorAll('#propParentId option').forEach(opt => {
        if (opt.value === part.id) opt.textContent = newPartName;
      });
    });

    if (part.type === 'text' || part.text) {
      insp.querySelector('#propPartText')?.addEventListener('input', (e) => {
        const newText = e.target.value;
        part.text = newText;
        part.textLabel = newText;

        // 文字が変更された際、もしパーツ名が「漢字文字「〇」」のような形式ならパーツ名・プリセット名も連動
        const partNameInput = insp.querySelector('#propPartName');
        if (partNameInput && (part.name.startsWith('漢字文字') || part.name.startsWith('文字') || part.name.startsWith('漢字'))) {
          const autoName = `漢字文字「${newText || '空'}」`;
          part.name = autoName;
          partNameInput.value = autoName;
          this.renderLayerTree();

          if (!this.character.parts || this.character.parts.length <= 1) {
            this.character.name = `漢字「${newText || '空'}」`;
            const presetInput = insp.querySelector('#propPresetName');
            if (presetInput) presetInput.value = this.character.name;

            const roster = this.getRoster();
            if (roster && this.character.id) {
              if (roster[this.character.id]) roster[this.character.id].name = this.character.name;
              this.saveRoster(roster);
            }
            this.renderBinTree();
            this.updatePresetSelectOptions();
            this.updateActiveBinBreadcrumb();
          }
        }

        this.editor.render();
        this.updateInspectorPreview();
        this.renderLayerTree();
      });
      const updateFontSize = (val) => {
        const sz = Math.max(10, Math.min(300, parseInt(val, 10) || 80));
        part.fontSize = sz;
        if (!part.style) part.style = {};
        part.style.fontSize = sz;
        const slider = insp.querySelector('#propFontSize');
        const numInput = insp.querySelector('#propFontSizeNum');
        if (slider && parseInt(slider.value, 10) !== sz) slider.value = sz;
        if (numInput && parseInt(numInput.value, 10) !== sz) numInput.value = sz;
        this.editor.render();
        this.updateInspectorPreview();
      };
      insp.querySelector('#propFontSize')?.addEventListener('input', (e) => updateFontSize(e.target.value));
      insp.querySelector('#propFontSizeNum')?.addEventListener('input', (e) => updateFontSize(e.target.value));
      insp.querySelector('#propFontFamily')?.addEventListener('change', (e) => {
        part.fontFamily = e.target.value;
        if (!part.style) part.style = {};
        part.style.fontFamily = e.target.value;
        this.editor.render();
        this.updateInspectorPreview();
      });
    }

    insp.querySelector('#propParentId')?.addEventListener('change', (e) => {
      part.parentId = e.target.value || null;
      this.renderLayerTree();
      this.renderTimeline();
    });

    insp.querySelector('#propPivotX')?.addEventListener('input', (e) => {
      part.pivot.x = parseFloat(e.target.value) || 0;
      this.editor.renderOverlay();
      this.updateInspectorPreview();
    });
    insp.querySelector('#propPivotY')?.addEventListener('input', (e) => {
      part.pivot.y = parseFloat(e.target.value) || 0;
      this.editor.renderOverlay();
      this.updateInspectorPreview();
    });

    // 塗り色 & 塗りHex & 塗りなしトグル & スウォッチ登録
    insp.querySelector('#propFillColor')?.addEventListener('input', (e) => {
      part.style.fill = e.target.value;
      const hexInput = insp.querySelector('#propFillColorHex');
      if (hexInput) hexInput.value = part.style.fill;
      this.editor.renderParts();
      this.updateInspectorPreview();
      this.syncNavigatorColorChips();
    });

    const handleFillHex = (e) => {
      let val = e.target.value.trim();
      if (val.length === 6 && !val.startsWith('#')) val = '#' + val;
      if (/^#[0-9a-fA-F]{6}$/i.test(val)) {
        part.style.fill = val;
        const picker = insp.querySelector('#propFillColor');
        if (picker) picker.value = val;
        this.editor.renderParts();
        this.updateInspectorPreview();
        this.syncNavigatorColorChips();
      }
    };
    insp.querySelector('#propFillColorHex')?.addEventListener('input', handleFillHex);
    insp.querySelector('#propFillColorHex')?.addEventListener('change', handleFillHex);

    insp.querySelector('#btnRegisterFillSwatch')?.addEventListener('click', () => {
      this.registerSwatchColor(part.style.fill);
    });

    insp.querySelector('#btnToggleFillNone')?.addEventListener('click', () => {
      if (part.style.fill === 'none') {
        const picker = insp.querySelector('#propFillColor');
        part.style.fill = picker ? picker.value : '#38bdf8';
      } else {
        part.style.fill = 'none';
      }
      this.renderInspector();
      this.editor.renderParts();
      this.updateInspectorPreview();
      this.syncNavigatorColorChips();
    });

    // 線色 & 線Hex & 線なしトグル & スウォッチ登録
    insp.querySelector('#propStrokeColor')?.addEventListener('input', (e) => {
      part.style.stroke = e.target.value;
      const hexInput = insp.querySelector('#propStrokeColorHex');
      if (hexInput) hexInput.value = part.style.stroke;
      this.editor.renderParts();
      this.updateInspectorPreview();
      this.syncNavigatorColorChips();
    });

    const handleStrokeHex = (e) => {
      let val = e.target.value.trim();
      if (val.length === 6 && !val.startsWith('#')) val = '#' + val;
      if (/^#[0-9a-fA-F]{6}$/i.test(val)) {
        part.style.stroke = val;
        const picker = insp.querySelector('#propStrokeColor');
        if (picker) picker.value = val;
        this.editor.renderParts();
        this.updateInspectorPreview();
        this.syncNavigatorColorChips();
      }
    };
    insp.querySelector('#propStrokeColorHex')?.addEventListener('input', handleStrokeHex);
    insp.querySelector('#propStrokeColorHex')?.addEventListener('change', handleStrokeHex);

    insp.querySelector('#btnRegisterStrokeSwatch')?.addEventListener('click', () => {
      this.registerSwatchColor(part.style.stroke);
    });

    insp.querySelector('#btnToggleStrokeNone')?.addEventListener('click', () => {
      if (part.style.stroke === 'none') {
        const picker = insp.querySelector('#propStrokeColor');
        part.style.stroke = picker ? picker.value : '#0f172a';
        if (!part.style.strokeWidth || part.style.strokeWidth === 0) {
          part.style.strokeWidth = 2;
        }
      } else {
        part.style.stroke = 'none';
      }
      this.renderInspector();
      this.editor.renderParts();
      this.updateInspectorPreview();
      this.syncNavigatorColorChips();
    });

    // 線幅 (スライダー & 数値直接入力の双方向連動)
    const updateStrokeWidth = (val) => {
      const w = Math.max(0, Math.min(50, parseFloat(val) || 0));
      part.style.strokeWidth = w;
      const slider = insp.querySelector('#propStrokeWidth');
      const numInput = insp.querySelector('#propStrokeWidthNum');
      if (slider && parseFloat(slider.value) !== w) slider.value = w;
      if (numInput && parseFloat(numInput.value) !== w) numInput.value = w;
      this.editor.renderParts();
      this.updateInspectorPreview();
    };
    insp.querySelector('#propStrokeWidth')?.addEventListener('input', (e) => updateStrokeWidth(e.target.value));
    insp.querySelector('#propStrokeWidthNum')?.addEventListener('input', (e) => updateStrokeWidth(e.target.value));

    // 線の位置 (中央・内側・外側)
    insp.querySelectorAll('.btn-stroke-pos').forEach(btn => {
      btn.addEventListener('click', () => {
        const pos = btn.dataset.pos;
        part.style.strokePosition = pos;
        insp.querySelectorAll('.btn-stroke-pos').forEach(b => b.classList.toggle('active', b === btn));
        this.editor.renderParts();
        this.updateInspectorPreview();
      });
    });

    // 不透明度 (スライダー & 数値直接入力 0〜100% の双方向連動)
    const updateOpacity = (val) => {
      const pct = Math.max(0, Math.min(100, parseFloat(val) || 0));
      part.style.opacity = pct / 100;
      const slider = insp.querySelector('#propOpacity');
      const numInput = insp.querySelector('#propOpacityNum');
      if (slider && parseFloat(slider.value) !== pct) slider.value = pct;
      if (numInput && parseFloat(numInput.value) !== pct) numInput.value = pct;
      this.editor.renderParts();
      this.updateInspectorPreview();
    };
    insp.querySelector('#propOpacity')?.addEventListener('input', (e) => updateOpacity(e.target.value));
    insp.querySelector('#propOpacityNum')?.addEventListener('input', (e) => updateOpacity(e.target.value));

    // アンカーポイント
    if (this.editor.selectedPointIndex >= 0 && part.points[this.editor.selectedPointIndex]) {
      const pt = part.points[this.editor.selectedPointIndex];
      insp.querySelector('#propPointX')?.addEventListener('input', (e) => {
        pt.x = parseFloat(e.target.value) || 0;
        this.editor.render();
        this.updateInspectorPreview();
      });
      insp.querySelector('#propPointY')?.addEventListener('input', (e) => {
        pt.y = parseFloat(e.target.value) || 0;
        this.editor.render();
        this.updateInspectorPreview();
      });
      insp.querySelector('#btnSetCorner')?.addEventListener('click', () => {
        pt.type = 'corner';
        pt.inHandle = { x: pt.x, y: pt.y };
        pt.outHandle = { x: pt.x, y: pt.y };
        this.editor.render();
        this.updateInspectorPreview();
        this.renderInspector();
      });
      insp.querySelector('#btnSetSmooth')?.addEventListener('click', () => {
        pt.type = 'smooth';
        this.editor.render();
        this.updateInspectorPreview();
        this.renderInspector();
      });
      insp.querySelector('#btnDeletePt')?.addEventListener('click', () => {
        if (part.points.length > 2) {
          part.points.splice(this.editor.selectedPointIndex, 1);
          this.editor.selectedPointIndex = Math.min(this.editor.selectedPointIndex, part.points.length - 1);
          this.editor.render();
          this.updateInspectorPreview();
          this.renderInspector();
        }
      });
    }

    insp.querySelector('#propReaction')?.addEventListener('change', (e) => {
      this.character.reactions.touchWrong = e.target.value;
    });

    // 逃走速度倍率 (スライダー & 数値直接入力の双方向連動)
    const updateFleeSpd = (val) => {
      const v = Math.max(0.5, Math.min(10.0, parseFloat(val) || 1.0));
      this.character.reactions.fleeSpeedMultiplier = v;
      const slider = insp.querySelector('#propFleeSpd');
      const numInput = insp.querySelector('#propFleeSpdNum');
      if (slider && parseFloat(slider.value) !== v) slider.value = v;
      if (numInput && parseFloat(numInput.value) !== v) numInput.value = v;
    };
    insp.querySelector('#propFleeSpd')?.addEventListener('input', (e) => updateFleeSpd(e.target.value));
    insp.querySelector('#propFleeSpdNum')?.addEventListener('input', (e) => updateFleeSpd(e.target.value));
  }

  // ========================================================
  // 4. タイムライン & モーション (マルチトラック & 60Fベジェ曲線)
  // ========================================================
  renderTimeline() {
    if (this.timelineMode === 'dopesheet') {
      this.renderDopeSheet();
    } else {
      this.renderGraphEditor();
    }
  }

  // 選択中キーフレームの削除 (単一・複数・グラフ選択対応)
  deleteSelectedKeyframes() {
    const clip = this.character?.animations?.[this.currentMotion];
    if (!clip || !clip.tracks) return false;

    let deleted = false;
    // 1. 複数選択キーフレーム
    if (this.selectedKeyframes && this.selectedKeyframes.length > 0) {
      this.selectedKeyframes.forEach(item => {
        const tList = clip.tracks[item.partId];
        if (tList) {
          const idx = tList.indexOf(item.kf);
          if (idx >= 0) {
            tList.splice(idx, 1);
            deleted = true;
          }
        }
      });
      this.selectedKeyframes = [];
      this.selectedKeyframe = null;
    } else if (this.selectedKeyframe && this.selectedKeyframe.kf) {
      // 2. 単一選択キーフレーム
      const tList = clip.tracks[this.selectedKeyframe.partId];
      if (tList) {
        const idx = tList.indexOf(this.selectedKeyframe.kf);
        if (idx >= 0) {
          tList.splice(idx, 1);
          deleted = true;
        }
      }
      this.selectedKeyframe = null;
    } else if (this.selectedGraphKeyframe && this.selectedGraphKeyframe.kf) {
      // 3. グラフ上の選択キーフレーム
      const tList = clip.tracks[this.selectedGraphKeyframe.partId];
      if (tList) {
        const idx = tList.indexOf(this.selectedGraphKeyframe.kf);
        if (idx >= 0) {
          tList.splice(idx, 1);
          deleted = true;
        }
      }
      this.selectedGraphKeyframe = null;
    }

    if (deleted) {
      this.updateAnimationFrame();
      this.renderTimeline();
      return true;
    }
    return false;
  }

  // 複合キーフレームがあれば独立した個別プロパティキーフレームに分離
  ensureIndependentTracks(clip) {
    if (!clip || !clip.tracks) return;
    for (const partId in clip.tracks) {
      const kfs = clip.tracks[partId];
      if (!Array.isArray(kfs)) continue;

      const newKfs = [];
      let hasCompound = false;

      for (const k of kfs) {
        if (k.prop) {
          newKfs.push(k);
        } else {
          hasCompound = true;
          if (k.tx !== undefined || k.ty !== undefined) {
            newKfs.push({
              time: k.time,
              prop: 'pos',
              tx: k.tx ?? 0,
              ty: k.ty ?? 0,
              easing: k.easing || 'easeInOutQuad',
              bezier: k.bezier ? [...k.bezier] : undefined
            });
          }
          if (k.sx !== undefined || k.sy !== undefined) {
            newKfs.push({
              time: k.time,
              prop: 'scale',
              sx: k.sx ?? 1,
              sy: k.sy ?? 1,
              easing: k.easing || 'easeInOutQuad',
              bezier: k.bezier ? [...k.bezier] : undefined
            });
          }
          if (k.rot !== undefined) {
            newKfs.push({
              time: k.time,
              prop: 'rot',
              rot: k.rot ?? 0,
              easing: k.easing || 'easeInOutQuad',
              bezier: k.bezier ? [...k.bezier] : undefined
            });
          }
          if (k.op !== undefined) {
            newKfs.push({
              time: k.time,
              prop: 'opacity',
              op: k.op ?? 1,
              easing: k.easing || 'easeInOutQuad',
              bezier: k.bezier ? [...k.bezier] : undefined
            });
          }
          if (k.tx === undefined && k.ty === undefined && k.sx === undefined && k.sy === undefined && k.rot === undefined && k.op === undefined) {
            newKfs.push(k);
          }
        }
      }

      if (hasCompound) {
        newKfs.sort((a, b) => a.time - b.time);
        clip.tracks[partId] = newKfs;
      }
    }
  }

  // 部位ごとのマルチトラック (ドープシート: Premiere Pro風 左右完全同期)
  // ========================================================
  // 部位ごとのマルチトラック (After Effects風 タイムライン & スクラバー)
  // ========================================================
  renderDopeSheet() {
    const headersList = this.container.querySelector('#tlHeadersList');
    const tracksList = this.container.querySelector('#tlTracksList');
    const tracksScroll = this.container.querySelector('#tlTracksScroll');
    const rulerBar = this.container.querySelector('#timelineRulerBar');
    if (!headersList || !tracksList || !this.character) return;

    headersList.innerHTML = '';
    tracksList.innerHTML = '';

    // 縦貫通プレイヘッドラインを tracksList の直下に配置 (ズーム幅を完全共有して1ピクセルもズレない)
    let playheadLine = document.createElement('div');
    playheadLine.className = 'tl-playhead-line';
    playheadLine.id = 'tlPlayheadLine';
    playheadLine.style.left = `${(this.currentFrame / 60) * 100}%`;
    tracksList.appendChild(playheadLine);

    // ルーラー描画 (フレーム目盛 & CTI三角マーカー)
    if (rulerBar) {
      let rulerContent = rulerBar.querySelector('#tlRulerContent');
      if (!rulerContent) {
        rulerBar.innerHTML = '';
        rulerContent = document.createElement('div');
        rulerContent.className = 'tl-ruler-content';
        rulerContent.id = 'tlRulerContent';
        rulerBar.appendChild(rulerContent);
      } else {
        rulerContent.innerHTML = '';
      }

      for (let f = 0; f <= 60; f++) {
        const tick = document.createElement('div');
        tick.className = 'tl-ruler-tick';
        tick.style.left = `${(f / 60) * 100}%`;
        if (f % 10 === 0) {
          tick.classList.add('major');
          const label = document.createElement('span');
          label.className = 'tl-ruler-num';
          label.textContent = `${f}F`;
          tick.appendChild(label);
        } else if (f % 5 === 0) {
          tick.classList.add('mid');
        }
        rulerContent.appendChild(tick);
      }

      const ctiHead = document.createElement('div');
      ctiHead.className = 'tl-cti-head';
      ctiHead.id = 'tlCtiHead';
      ctiHead.style.left = `${(this.currentFrame / 60) * 100}%`;
      rulerContent.appendChild(ctiHead);

      const seekFromRuler = (e) => {
        const rect = rulerBar.getBoundingClientRect();
        const scrollLeft = tracksScroll ? tracksScroll.scrollLeft : rulerBar.scrollLeft;
        const totalW = rulerContent ? (rulerContent.scrollWidth || rect.width) : rect.width;
        const clickX = e.clientX - rect.left + scrollLeft;
        const ratio = Math.max(0, Math.min(1, clickX / totalW));
        this.currentFrame = Math.max(0, Math.min(60, Math.round(ratio * 60)));
        const scrubber = this.container.querySelector('#timelineScrubber');
        if (scrubber) scrubber.value = this.currentFrame;
        this.updateTimeDisplay();
        this.updateAnimationFrame();
        this.updatePlayhead();
        this.updateTimelineValues();
      };
      rulerBar.onpointerdown = (e) => {
        e.preventDefault();
        seekFromRuler(e);
        const onMove = (me) => seekFromRuler(me);
        const onUp = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      };
    }

    const clip = this.character.animations?.[this.currentMotion];
    if (!clip) return;
    if (!clip.trackOptions) clip.trackOptions = {};
    if (!clip.tracks) clip.tracks = {};

    // 複合キーフレームがあれば独立した個別プロパティキーフレームに分離
    this.ensureIndependentTracks(clip);

    // 初回のみ：選択パーツがあればデフォルトで展開 (ユーザーの折りたたみ操作を保持)
    if (!this._timelinePartsInitialized && this.editor.selectedPartId) {
      this._timelinePartsInitialized = true;
      this.expandedTimelineParts.add(this.editor.selectedPartId);
      this.expandedTimelineTransforms.add(this.editor.selectedPartId);
    }

    const normCurrentTime = this.currentFrame / 60;

    // スクラバー生成ヘルパー (名称や数値にポインターを置いて左右ドラッグでスライダー増減 / クリックで手入力)
    const createScrubber = (container, { label, getValue, setValue, format, parse, onScrubChange, step = 1, sensitivity = 0.5, min, max, dataKey }) => {
      const field = document.createElement('span');
      field.className = 'ae-scrub-field';

      const labelEl = document.createElement('span');
      labelEl.className = 'ae-scrub-label';
      labelEl.textContent = label;
      labelEl.title = '左右ドラッグで数値を直感変更 (Shift: 5倍速, Alt: 微調整)';

      const valEl = document.createElement('span');
      valEl.className = 'ae-scrub-val';
      if (dataKey) valEl.dataset.trackVal = dataKey;
      valEl.textContent = format(getValue());
      valEl.title = 'クリックで手入力 / 左右ドラッグで変更';

      field.appendChild(labelEl);
      field.appendChild(valEl);

      let startX = 0;
      let startVal = 0;
      let isDragging = false;

      const onPointerDown = (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        startX = e.clientX;
        startVal = getValue();
        isDragging = false;

        const onPointerMove = (me) => {
          const dx = me.clientX - startX;
          if (Math.abs(dx) > 2) isDragging = true;
          if (!isDragging) return;

          const factor = me.shiftKey ? 5 : (me.altKey ? 0.1 : 1);
          let nextVal = startVal + dx * factor * sensitivity * step;
          if (min !== undefined) nextVal = Math.max(min, nextVal);
          if (max !== undefined) nextVal = Math.min(max, nextVal);

          setValue(nextVal);
          if (onScrubChange) onScrubChange(nextVal);
          valEl.textContent = format(nextVal);
          this.editor.render();
          this.updateAnimationFrame();
          this.updateInspectorPreview();
        };

        const onPointerUp = () => {
          window.removeEventListener('pointermove', onPointerMove);
          window.removeEventListener('pointerup', onPointerUp);

          if (!isDragging) {
            startInlineEdit();
          } else {
            this.renderTimeline();
          }
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
      };

      const startInlineEdit = () => {
        valEl.style.display = 'none';
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'ae-scrub-input';
        input.value = getValue();
        field.appendChild(input);
        input.focus();
        input.select();

        let committed = false;
        const commit = () => {
          if (committed) return;
          committed = true;
          const parsed = parse ? parse(input.value) : parseFloat(input.value);
          if (!isNaN(parsed)) {
            let nextVal = parsed;
            if (min !== undefined) nextVal = Math.max(min, nextVal);
            if (max !== undefined) nextVal = Math.min(max, nextVal);
            setValue(nextVal);
            if (onScrubChange) onScrubChange(nextVal);
          }
          if (input.parentNode) input.parentNode.removeChild(input);
          valEl.style.display = '';
          valEl.textContent = format(getValue());
          this.editor.render();
          this.updateAnimationFrame();
          this.updateInspectorPreview();
          this.renderTimeline();
        };

        input.addEventListener('keydown', (ke) => {
          if (ke.key === 'Enter') {
            commit();
          } else if (ke.key === 'Escape') {
            committed = true;
            if (input.parentNode) input.parentNode.removeChild(input);
            valEl.style.display = '';
          }
        });
        input.addEventListener('blur', () => {
          commit();
        });
      };

      labelEl.addEventListener('pointerdown', onPointerDown);
      valEl.addEventListener('pointerdown', onPointerDown);

      container.appendChild(field);
      return field;
    };

    // パーツレイヤーで選択中のパーツを特定 (単一・複数選択に完全連動)
    const selIds = new Set(this.editor.selectedPartIds || []);
    if (this.editor.selectedPartId) selIds.add(this.editor.selectedPartId);

    // フィルタボタンのアクティブ状態をUIに反映
    const btnFilterOnly = this.container.querySelector('#btnTlFilterOnly');
    const btnFilterAll = this.container.querySelector('#btnTlFilterAll');
    if (btnFilterOnly && btnFilterAll) {
      btnFilterOnly.classList.toggle('active', this.timelineFilterMode === 'only');
      btnFilterAll.classList.toggle('active', this.timelineFilterMode === 'all');
    }

    // 初回のみ：選択中のパーツ（または先頭パーツ）を展開
    if (!this._timelinePartsInitialized && this.character.parts.length > 0) {
      this._timelinePartsInitialized = true;
      const initialPart = this.editor.selectedPartId || this.character.parts[0]?.id;
      if (initialPart) {
        this.expandedTimelineParts.add(initialPart);
        this.expandedTimelineTransforms.add(initialPart);
      }
    }

    // 各部位ごと横列を分割表示 (全パーツをzIndex順に一覧表示)
    let sortedParts = [...this.character.parts].sort((a, b) => b.zIndex - a.zIndex);

    // Onlyモード時は選択中のパーツのみに絞り込み (複数選択にも完全対応)
    if (this.timelineFilterMode === 'only') {
      if (selIds.size > 0) {
        sortedParts = sortedParts.filter(part => selIds.has(part.id));
      } else {
        sortedParts = [];
      }
    }

    // 左ペイン幅が記憶されていれば適用
    const leftPane = this.container.querySelector('#tlLeftPane');
    if (leftPane && this.timelineLeftPaneWidth) {
      leftPane.style.width = `${this.timelineLeftPaneWidth}px`;
    }

    if (this.timelineFilterMode === 'only' && sortedParts.length === 0) {
      const emptyNotice = document.createElement('div');
      emptyNotice.style.cssText = 'padding: 24px 12px; color: #94a3b8; font-size: 11px; text-align: center; line-height: 1.6;';
      emptyNotice.innerHTML = `🎯 <strong>パーツが選択されていません</strong><br><span style="font-size:10px; color:#64748b;">キャンバスまたはレイヤー一覧でパーツを選択すると、<br>そのパーツのモーションプロパティが表示されます。<br>(Shiftクリック・ドラッグ矩形による複数選択にも対応)</span>`;
      headersList.appendChild(emptyNotice);
      return;
    }

    sortedParts.forEach(part => {
      const isSelected = selIds.has(part.id);
      const trackKfs = clip.tracks[part.id] || [];
      const isIsolated = clip.trackOptions[part.id]?.isolated ?? false;

      const isPartExpanded = this.expandedTimelineParts.has(part.id);
      const isTransformExpanded = this.expandedTimelineTransforms.has(part.id);
      const isLocked = this.timelineAspectLocked.has(part.id) ? this.timelineAspectLocked.get(part.id) : true;

      // 現在フレームにおける補間値
      const evalTransform = evaluateTrack(trackKfs, normCurrentTime);

      // ==========================================
      // 1. 部位レイヤー親行 (ae-layer-row)
      // ==========================================
      const layerHeader = document.createElement('div');
      layerHeader.className = `track-header ae-layer-row ${isSelected ? 'active' : ''}`;
      layerHeader.dataset.partId = part.id;
      layerHeader.style.height = '28px';
      layerHeader.style.minHeight = '28px';
      layerHeader.style.maxHeight = '28px';
      layerHeader.style.boxSizing = 'border-box';
      layerHeader.innerHTML = `
        <button class="ae-arrow-btn" title="${isPartExpanded ? '折りたたむ' : '展開する'}">${isPartExpanded ? '▼' : '▶'}</button>
        <button class="track-vis-btn" title="表示/非表示">${part.visible ? '👁️' : '🙈'}</button>
        <button class="track-iso-btn ${isIsolated ? 'isolated' : ''}" title="${isIsolated ? '単体で動かす' : '親階層と連動'}">
          ${isIsolated ? '⛓️‍💥' : '🔗'}
        </button>
        <span class="track-name" title="${part.name}">${part.name}</span>
      `;

      layerHeader.querySelector('.ae-arrow-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (isPartExpanded) {
          this.expandedTimelineParts.delete(part.id);
        } else {
          this.expandedTimelineParts.add(part.id);
          this.expandedTimelineTransforms.add(part.id);
        }
        this.renderTimeline();
      });

      layerHeader.querySelector('.track-vis-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        part.visible = !part.visible;
        this.editor.render();
        this.updateInspectorPreview();
        this.renderTimeline();
      });

      layerHeader.querySelector('.track-iso-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        clip.trackOptions[part.id] = { isolated: !isIsolated };
        this.updateAnimationFrame();
        this.renderTimeline();
      });

      layerHeader.addEventListener('click', () => {
        this.editor.selectedPartId = part.id;
        this.editor.render();
        this.renderLayerTree();
        this.renderInspector();
        this.renderTimeline();
      });

      headersList.appendChild(layerHeader);

      // 親行の右側トラック (サマリーキーフレーム表示)
      const layerBar = document.createElement('div');
      layerBar.className = `track-timeline-bar ae-layer-row ${isSelected ? 'active' : ''}`;
      layerBar.dataset.partId = part.id;
      layerBar.style.height = '28px';
      layerBar.style.minHeight = '28px';
      layerBar.style.maxHeight = '28px';
      layerBar.style.boxSizing = 'border-box';

      for (let f = 0; f <= 60; f += 10) {
        const tick = document.createElement('div');
        tick.className = 'track-grid-tick';
        tick.style.left = `${(f / 60) * 100}%`;
        layerBar.appendChild(tick);
      }

      // サマリーキーフレーム (全プロパティの合算)
      const uniqueTimes = Array.from(new Set(trackKfs.map(k => Math.round(k.time * 60))));
      uniqueTimes.forEach(frame => {
        const dia = document.createElement('div');
        dia.className = 'keyframe-diamond summary';
        dia.style.left = `${(frame / 60) * 100}%`;
        dia.title = `${frame}F: キーフレーム (クリックでシーク)`;
        dia.addEventListener('click', (e) => {
          e.stopPropagation();
          this.currentFrame = frame;
          const scrubber = this.container.querySelector('#timelineScrubber');
          if (scrubber) scrubber.value = frame;
          this.updateTimeDisplay();
          this.updateAnimationFrame();
          this.renderTimeline();
        });
        layerBar.appendChild(dia);
      });

      layerBar.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.keyframe-diamond')) return;
        const rect = layerBar.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        this.currentFrame = Math.round(ratio * 60);
        const scrubber = this.container.querySelector('#timelineScrubber');
        if (scrubber) scrubber.value = this.currentFrame;
        this.updateTimeDisplay();
        this.updateAnimationFrame();
        this.updatePlayhead();
      });

      tracksList.appendChild(layerBar);

      // ==========================================
      // 2. トランスフォームグループ行 (ae-group-row)
      // ==========================================
      if (isPartExpanded) {
        const groupHeader = document.createElement('div');
        groupHeader.className = `track-header ae-group-row ${isSelected ? 'active' : ''}`;
        groupHeader.style.height = '24px';
        groupHeader.style.minHeight = '24px';
        groupHeader.style.maxHeight = '24px';
        groupHeader.style.boxSizing = 'border-box';
        groupHeader.innerHTML = `
          <button class="ae-arrow-btn" title="${isTransformExpanded ? 'トランスフォームを折りたたむ' : 'トランスフォームを展開'}">${isTransformExpanded ? '▼' : '▶'}</button>
          <span style="font-size:11px; font-weight:700; color:#94a3b8;">トランスフォーム</span>
          <button class="btn-secondary-sm" style="margin-left:auto; font-size:9px; padding:1px 6px;" title="トランスフォームを初期値にリセット">↺ リセット</button>
        `;

        groupHeader.querySelector('.ae-arrow-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          if (isTransformExpanded) {
            this.expandedTimelineTransforms.delete(part.id);
          } else {
            this.expandedTimelineTransforms.add(part.id);
          }
          this.renderTimeline();
        });

        groupHeader.querySelector('button.btn-secondary-sm')?.addEventListener('click', (e) => {
          e.stopPropagation();
          // トランスフォームキーのリセット
          clip.tracks[part.id] = (clip.tracks[part.id] || []).filter(k => k.prop !== 'pos' && k.prop !== 'scale' && k.prop !== 'rot' && k.prop !== 'opacity');
          this.editor.render();
          this.updateAnimationFrame();
          this.renderTimeline();
        });

        headersList.appendChild(groupHeader);

        const groupBar = document.createElement('div');
        groupBar.className = `track-timeline-bar ae-group-row ${isSelected ? 'active' : ''}`;
        groupBar.style.height = '24px';
        groupBar.style.minHeight = '24px';
        groupBar.style.maxHeight = '24px';
        groupBar.style.boxSizing = 'border-box';
        for (let f = 0; f <= 60; f += 10) {
          const tick = document.createElement('div');
          tick.className = 'track-grid-tick';
          tick.style.left = `${(f / 60) * 100}%`;
          groupBar.appendChild(tick);
        }

        groupBar.addEventListener('pointerdown', (e) => {
          const rect = groupBar.getBoundingClientRect();
          const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          this.currentFrame = Math.round(ratio * 60);
          const scrubber = this.container.querySelector('#timelineScrubber');
          if (scrubber) scrubber.value = this.currentFrame;
          this.updateTimeDisplay();
          this.updateAnimationFrame();
          this.updatePlayhead();
        });

        tracksList.appendChild(groupBar);

        // ==========================================
        // 3. 個別プロパティ行 (位置・スケール・回転・不透明度)
        // ==========================================
        if (isTransformExpanded) {
          const renderPropertyRow = ({ name, type, renderControls, getPropVal, setPropVal, minVal, maxVal, unit = '' }) => {
            const propKey = `${part.id}:${type}`;

            // 該当プロパティのキーフレーム一覧 (新仕様: k.prop指定、旧・複合仕様: tx/ty, sx/sy, rot, op で判定)
            const propKfs = trackKfs.filter(k => {
              if (k.prop === type) return true;
              if (!k.prop) {
                if (type === 'pos') return k.tx !== undefined || k.ty !== undefined;
                if (type === 'scale') return k.sx !== undefined || k.sy !== undefined;
                if (type === 'rot') return k.rot !== undefined;
                if (type === 'opacity') return k.op !== undefined;
              }
              return false;
            });
            const currentPropKf = propKfs.find(k => Math.round(k.time * 60) === this.currentFrame);
            const hasKfAtCurrent = !!currentPropKf;

            // ストップウォッチ状態 (デフォルト: キーフレームがあればtrue、初期化時はtrue)
            if (!this.stopwatchState.has(propKey)) {
              this.stopwatchState.set(propKey, propKfs.length > 0 || true);
            }
            const isStopwatchOn = this.stopwatchState.get(propKey);

            // グラフモード状態
            const isGraphOn = this.inlineGraphProps.has(propKey);
            const rowHeight = isGraphOn 
              ? (this.propRowHeights.get(propKey) || 80)
              : 24;

            // ── 左ヘッダー ──
            const propHeader = document.createElement('div');
            propHeader.className = `track-header ae-prop-header ae-prop-row ${isSelected ? 'active' : ''}`;
            propHeader.style.height = `${rowHeight}px`;
            propHeader.style.minHeight = `${rowHeight}px`;
            propHeader.style.maxHeight = `${rowHeight}px`;
            propHeader.style.boxSizing = 'border-box';
            propHeader.style.overflow = 'hidden';
            propHeader.style.whiteSpace = 'nowrap';

            // 1. ストップウォッチ (ONでキーフレーム自動記録 / OFFでアニメーション全削除)
            const swBtn = document.createElement('button');
            swBtn.className = `ae-stopwatch-btn ${isStopwatchOn ? 'active' : ''}`;
            swBtn.textContent = '⏱';
            swBtn.title = isStopwatchOn ? 'アニメーション記録中 (クリックで全キーフレーム削除)' : '静的値 (クリックでアニメーション化)';
            swBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              if (isStopwatchOn) {
                if (confirm(`「${name}」のアニメーションをオフにしますか？\n（このプロパティの全キーフレームが消去されます）`)) {
                  this.stopwatchState.set(propKey, false);
                  trackKfs = trackKfs.filter(k => {
                    if (k.prop === type) return false;
                    if (!k.prop) {
                      if (type === 'pos') { delete k.tx; delete k.ty; }
                      else if (type === 'scale') { delete k.sx; delete k.sy; }
                      else if (type === 'rot') { delete k.rot; }
                      else if (type === 'opacity') { delete k.op; }
                      return k.tx !== undefined || k.ty !== undefined || k.sx !== undefined || k.sy !== undefined || k.rot !== undefined || k.op !== undefined;
                    }
                    return true;
                  });
                  clip.tracks[part.id] = trackKfs;
                  this.renderTimeline();
                }
              } else {
                this.stopwatchState.set(propKey, true);
                const curVal = getPropVal();
                const newKf = { time: this.currentFrame / 60, prop: type, easing: 'easeInOutQuad' };
                setPropVal(newKf, curVal);
                trackKfs.push(newKf);
                trackKfs.sort((a, b) => a.time - b.time);
                clip.tracks[part.id] = trackKfs;
                this.renderTimeline();
              }
            });
            propHeader.appendChild(swBtn);

            // 2. キーフレームナビゲーション ◀ ◆ ▶
            const sortedKfs = [...propKfs].sort((a, b) => a.time - b.time);
            const prevKf = [...sortedKfs].reverse().find(k => Math.round(k.time * 60) < this.currentFrame);
            const nextKf = sortedKfs.find(k => Math.round(k.time * 60) > this.currentFrame);

            const prevBtn = document.createElement('button');
            prevBtn.className = 'ae-nav-btn';
            prevBtn.textContent = '◀';
            prevBtn.title = '前のキーフレームへ移動';
            prevBtn.disabled = !prevKf;
            prevBtn.style.opacity = prevKf ? '1' : '0.25';
            prevBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              if (prevKf) {
                this.currentFrame = Math.round(prevKf.time * 60);
                const scrubber = this.container.querySelector('#timelineScrubber');
                if (scrubber) scrubber.value = this.currentFrame;
                this.updateTimeDisplay();
                this.updateAnimationFrame();
                this.renderTimeline();
              }
            });
            propHeader.appendChild(prevBtn);

            const nextBtn = document.createElement('button');
            nextBtn.className = 'ae-nav-btn';
            nextBtn.textContent = '▶';
            nextBtn.title = '次のキーフレームへ移動';
            nextBtn.disabled = !nextKf;
            nextBtn.style.opacity = nextKf ? '1' : '0.25';
            nextBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              if (nextKf) {
                this.currentFrame = Math.round(nextKf.time * 60);
                const scrubber = this.container.querySelector('#timelineScrubber');
                if (scrubber) scrubber.value = this.currentFrame;
                this.updateTimeDisplay();
                this.updateAnimationFrame();
                this.renderTimeline();
              }
            });
            propHeader.appendChild(nextBtn);

            // 3. 📈 アイコンボタン (キーフレーム表示 ↔ 60Fベジェ曲線グラフ切り替え)
            const graphToggleBtn = document.createElement('button');
            graphToggleBtn.className = `ae-graph-btn ${isGraphOn ? 'active' : ''}`;
            graphToggleBtn.textContent = '📈';
            graphToggleBtn.title = isGraphOn ? 'キーフレーム表示に戻す' : '60Fベジェ曲線グラフを表示 (ドラッグで縦幅リサイズ可能)';
            graphToggleBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              if (isGraphOn) {
                this.inlineGraphProps.delete(propKey);
              } else {
                this.inlineGraphProps.add(propKey);
                if (!this.propRowHeights.has(propKey)) this.propRowHeights.set(propKey, 80);
              }
              this.renderTimeline();
            });
            propHeader.appendChild(graphToggleBtn);

            // 4. プロパティ名
            const nameEl = document.createElement('span');
            nameEl.className = 'ae-prop-name';
            nameEl.textContent = name;
            propHeader.appendChild(nameEl);

            // 5. コントロール (スクラバー群)
            const scrubGroup = document.createElement('div');
            scrubGroup.className = 'ae-scrub-group';

            // 値変更時のストップウォッチ＆自動キー打ちハンドラー (手入力・ドラッグ共通)
            const onValChanged = () => {
              if (isStopwatchOn || this.isAutoKeyframe) {
                let kf = trackKfs.find(k => {
                  if (Math.round(k.time * 60) !== this.currentFrame) return false;
                  if (k.prop === type) return true;
                  if (!k.prop) {
                    if (type === 'pos') return k.tx !== undefined || k.ty !== undefined;
                    if (type === 'scale') return k.sx !== undefined || k.sy !== undefined;
                    if (type === 'rot') return k.rot !== undefined;
                    if (type === 'opacity') return k.op !== undefined;
                  }
                  return false;
                });
                if (!kf) {
                  kf = { time: this.currentFrame / 60, prop: type, easing: 'easeInOutQuad' };
                  trackKfs.push(kf);
                  trackKfs.sort((a, b) => a.time - b.time);
                  clip.tracks[part.id] = trackKfs;
                }
                setPropVal(kf, getPropVal());
                this.selectedKeyframes = [{ partId: part.id, prop: type, kf }];
              }
              // アニメーションフレーム更新＆キャンバス即時再描画
              this.updateAnimationFrame();
              this.editor.render();
              this.updateInspectorPreview();
            };

            renderControls(scrubGroup, onValChanged);
            propHeader.appendChild(scrubGroup);
            headersList.appendChild(propHeader);

            // ==========================================
            // 右側トラックバー
            // ==========================================
            const propBar = document.createElement('div');
            propBar.className = `track-timeline-bar ae-prop-row ${isSelected ? 'active' : ''}`;
            propBar.dataset.partId = part.id;
            propBar.dataset.propType = type;
            propBar.style.height = `${rowHeight}px`;
            propBar.style.minHeight = `${rowHeight}px`;
            propBar.style.maxHeight = `${rowHeight}px`;
            propBar.style.boxSizing = 'border-box';

            for (let f = 0; f <= 60; f += 10) {
              const tick = document.createElement('div');
              tick.className = 'track-grid-tick';
              tick.style.left = `${(f / 60) * 100}%`;
              propBar.appendChild(tick);
            }

            // 📈 インライン60Fベジェ曲線グラフの描画
            // 📈 インライン60Fベジェ曲線グラフの描画
            if (isGraphOn) {
              const graphContainer = document.createElement('div');
              graphContainer.className = 'ae-inline-graph';

              const zoom = this.timelineZoom || 1.0;
              const baseW = Math.max(600, Math.round(600 * zoom));

              const svgNs = 'http://www.w3.org/2000/svg';
              const svg = document.createElementNS(svgNs, 'svg');
              svg.setAttribute('class', 'ae-graph-canvas');
              svg.setAttribute('viewBox', `0 0 ${baseW} ${rowHeight}`);
              svg.setAttribute('preserveAspectRatio', 'none');

              // グリッド線
              for (let f = 0; f <= 60; f += 10) {
                const x = (f / 60) * baseW;
                const line = document.createElementNS(svgNs, 'line');
                line.setAttribute('x1', x); line.setAttribute('y1', 0);
                line.setAttribute('x2', x); line.setAttribute('y2', rowHeight);
                line.setAttribute('stroke', 'rgba(255, 255, 255, 0.05)');
                line.setAttribute('stroke-width', '1');
                svg.appendChild(line);
              }

              // ベジェ曲線描画
              const sorted = [...propKfs].sort((a, b) => a.time - b.time);
              const curvePaths = [];
              for (let i = 0; i < sorted.length - 1; i++) {
                const k1 = sorted[i];
                const k2 = sorted[i + 1];
                const x1 = k1.time * baseW;
                const x2 = k2.time * baseW;
                const y1 = rowHeight * 0.5;
                const y2 = rowHeight * 0.5;
                const dx = x2 - x1;

                let cp1x = x1 + dx * 0.42;
                let cp1y = rowHeight * 0.2;
                let cp2x = x1 + dx * 0.58;
                let cp2y = rowHeight * 0.8;

                if (k1.bezier && k1.bezier.length === 4) {
                  cp1x = x1 + dx * k1.bezier[0];
                  cp1y = rowHeight - (k1.bezier[1] * (rowHeight - 16) + 8);
                  cp2x = x1 + dx * k1.bezier[2];
                  cp2y = rowHeight - (k1.bezier[3] * (rowHeight - 16) + 8);
                }

                const d = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
                const curve = document.createElementNS(svgNs, 'path');
                curve.setAttribute('d', d);
                curve.setAttribute('fill', 'none');
                curve.setAttribute('stroke', '#38bdf8');
                curve.setAttribute('stroke-width', '2');
                svg.appendChild(curve);
                curvePaths.push({ curve, k1, k2, x1, x2, y1, y2, dx });
              }

              // 📈 ベジェアンカーポイント＆ハンドル制御点（長押しでハンドル出現・ドラッグで湾曲調整）
              sorted.forEach((kf, idx) => {
                const kfX = kf.time * baseW;
                const kfY = rowHeight * 0.5;
                const kfKey = `${part.id}:${type}:${Math.round(kf.time * 60)}`;
                const hasHandle = this.activeBezierHandles.has(kfKey);
                const isKfSel = (this.selectedGraphKeyframe && this.selectedGraphKeyframe.kf === kf);

                // アンカー円 (ズームしても常に正円)
                const anchor = document.createElementNS(svgNs, 'circle');
                anchor.setAttribute('cx', kfX);
                anchor.setAttribute('cy', kfY);
                anchor.setAttribute('r', hasHandle ? '7' : (isKfSel ? '6' : '4'));
                anchor.setAttribute('fill', hasHandle ? '#f43f5e' : (isKfSel ? '#38bdf8' : '#e2e8f0'));
                anchor.setAttribute('stroke', '#0f172a');
                anchor.setAttribute('stroke-width', '2');
                anchor.setAttribute('cursor', 'pointer');
                anchor.setAttribute('class', 'ae-graph-anchor');
                anchor.setAttribute('title', `${Math.round(kf.time * 60)}F: 長押しでベジェハンドル表示/非表示 (クリックでシーク)`);

                let anchorTimer = null;
                let anchorMoved = false;
                let startAnchorX = 0, startAnchorY = 0;

                anchor.addEventListener('pointerdown', (e) => {
                  e.stopPropagation();
                  anchorMoved = false;
                  startAnchorX = e.clientX;
                  startAnchorY = e.clientY;
                  this.selectedGraphKeyframe = { partId: part.id, prop: type, kf };

                  anchorTimer = setTimeout(() => {
                    anchorTimer = null;
                    if (!anchorMoved) {
                      if (this.activeBezierHandles.has(kfKey)) {
                        this.activeBezierHandles.delete(kfKey);
                      } else {
                        this.activeBezierHandles.add(kfKey);
                      }
                      this.renderTimeline();
                    }
                  }, 240);
                });

                anchor.addEventListener('pointermove', (e) => {
                  if (Math.abs(e.clientX - startAnchorX) > 3 || Math.abs(e.clientY - startAnchorY) > 3) {
                    anchorMoved = true;
                    if (anchorTimer) {
                      clearTimeout(anchorTimer);
                      anchorTimer = null;
                    }
                  }
                });

                anchor.addEventListener('pointerup', () => {
                  if (anchorTimer) {
                    clearTimeout(anchorTimer);
                    anchorTimer = null;
                    // 通常短押しクリック: シークと選択
                    this.currentFrame = Math.round(kf.time * 60);
                    const scrubber = this.container.querySelector('#timelineScrubber');
                    if (scrubber) scrubber.value = this.currentFrame;
                    this.updateTimeDisplay();
                    this.updateAnimationFrame();
                    this.updatePlayhead();
                    this.updateTimelineValues();
                  }
                });

                anchor.addEventListener('pointercancel', () => {
                  if (anchorTimer) {
                    clearTimeout(anchorTimer);
                    anchorTimer = null;
                  }
                });

                svg.appendChild(anchor);

                // 長押しされたキーフレームであればベジェハンドルを表示 (他のキーフレームを触っても消えずに維持)
                if (hasHandle) {
                  if (idx < sorted.length - 1) {
                    const kNext = sorted[idx + 1];
                    const nextX = kNext.time * baseW;
                    const dx = nextX - kfX;
                    if (!kf.bezier || kf.bezier.length !== 4) kf.bezier = [0.42, 0.0, 0.58, 1.0];
                    let hx = kfX + dx * kf.bezier[0];
                    let hy = rowHeight - (kf.bezier[1] * (rowHeight - 16) + 8);

                    const handleLine = document.createElementNS(svgNs, 'line');
                    handleLine.setAttribute('x1', kfX); handleLine.setAttribute('y1', kfY);
                    handleLine.setAttribute('x2', hx); handleLine.setAttribute('y2', hy);
                    handleLine.setAttribute('stroke', '#f43f5e');
                    handleLine.setAttribute('stroke-width', '1.5');
                    handleLine.setAttribute('stroke-dasharray', '2 2');
                    svg.appendChild(handleLine);

                    const handleCircle = document.createElementNS(svgNs, 'circle');
                    handleCircle.setAttribute('cx', hx); handleCircle.setAttribute('cy', hy);
                    handleCircle.setAttribute('r', '5');
                    handleCircle.setAttribute('fill', '#f43f5e');
                    handleCircle.setAttribute('stroke', '#fff');
                    handleCircle.setAttribute('stroke-width', '1.5');
                    handleCircle.setAttribute('cursor', 'grab');
                    handleCircle.setAttribute('class', 'ae-bezier-handle');

                    const curveItem = curvePaths.find(cp => cp.k1 === kf);

                    handleCircle.addEventListener('pointerdown', (he) => {
                      he.stopPropagation();
                      he.preventDefault();
                      handleCircle.setPointerCapture(he.pointerId);

                      const onHandleMove = (me) => {
                        const svgRect = svg.getBoundingClientRect();
                        const svgX = ((me.clientX - svgRect.left) / svgRect.width) * baseW;
                        const svgY = ((me.clientY - svgRect.top) / svgRect.height) * rowHeight;
                        let bX = Math.max(0.01, Math.min(0.99, (svgX - kfX) / (dx || 1)));
                        let bY = Math.max(0.0, Math.min(1.0, (rowHeight - 8 - svgY) / (rowHeight - 16)));
                        kf.bezier[0] = Math.round(bX * 100) / 100;
                        kf.bezier[1] = Math.round(bY * 100) / 100;

                        // ハンドル位置と曲線をリアルタイムに直接DOM更新 (超高速・スムーズ)
                        hx = kfX + dx * kf.bezier[0];
                        hy = rowHeight - (kf.bezier[1] * (rowHeight - 16) + 8);
                        handleCircle.setAttribute('cx', hx);
                        handleCircle.setAttribute('cy', hy);
                        handleLine.setAttribute('x2', hx);
                        handleLine.setAttribute('y2', hy);

                        if (curveItem) {
                          const cp2x = curveItem.x1 + curveItem.dx * kf.bezier[2];
                          const cp2y = rowHeight - (kf.bezier[3] * (rowHeight - 16) + 8);
                          curveItem.curve.setAttribute('d', `M ${curveItem.x1} ${curveItem.y1} C ${hx} ${hy}, ${cp2x} ${cp2y}, ${curveItem.x2} ${curveItem.y2}`);
                        }

                        this.updateAnimationFrame();
                        this.editor.render();
                        this.updateTimelineValues();
                      };
                      const onHandleUp = () => {
                        handleCircle.removeEventListener('pointermove', onHandleMove);
                        handleCircle.removeEventListener('pointerup', onHandleUp);
                        this.renderTimeline();
                      };
                      handleCircle.addEventListener('pointermove', onHandleMove);
                      handleCircle.addEventListener('pointerup', onHandleUp);
                    });
                    svg.appendChild(handleCircle);
                  }

                  if (idx > 0) {
                    const kPrev = sorted[idx - 1];
                    const prevX = kPrev.time * baseW;
                    const dx = kfX - prevX;
                    if (!kPrev.bezier || kPrev.bezier.length !== 4) kPrev.bezier = [0.42, 0.0, 0.58, 1.0];
                    let hx = prevX + dx * kPrev.bezier[2];
                    let hy = rowHeight - (kPrev.bezier[3] * (rowHeight - 16) + 8);

                    const handleLine = document.createElementNS(svgNs, 'line');
                    handleLine.setAttribute('x1', kfX); handleLine.setAttribute('y1', kfY);
                    handleLine.setAttribute('x2', hx); handleLine.setAttribute('y2', hy);
                    handleLine.setAttribute('stroke', '#06b6d4');
                    handleLine.setAttribute('stroke-width', '1.5');
                    handleLine.setAttribute('stroke-dasharray', '2 2');
                    svg.appendChild(handleLine);

                    const handleCircle = document.createElementNS(svgNs, 'circle');
                    handleCircle.setAttribute('cx', hx); handleCircle.setAttribute('cy', hy);
                    handleCircle.setAttribute('r', '5');
                    handleCircle.setAttribute('fill', '#06b6d4');
                    handleCircle.setAttribute('stroke', '#fff');
                    handleCircle.setAttribute('stroke-width', '1.5');
                    handleCircle.setAttribute('cursor', 'grab');
                    handleCircle.setAttribute('class', 'ae-bezier-handle');

                    const curveItem = curvePaths.find(cp => cp.k1 === kPrev);

                    handleCircle.addEventListener('pointerdown', (he) => {
                      he.stopPropagation();
                      he.preventDefault();
                      handleCircle.setPointerCapture(he.pointerId);

                      const onHandleMove = (me) => {
                        const svgRect = svg.getBoundingClientRect();
                        const svgX = ((me.clientX - svgRect.left) / svgRect.width) * baseW;
                        const svgY = ((me.clientY - svgRect.top) / svgRect.height) * rowHeight;
                        let bX = Math.max(0.01, Math.min(0.99, (svgX - prevX) / (dx || 1)));
                        let bY = Math.max(0.0, Math.min(1.0, (rowHeight - 8 - svgY) / (rowHeight - 16)));
                        kPrev.bezier[2] = Math.round(bX * 100) / 100;
                        kPrev.bezier[3] = Math.round(bY * 100) / 100;

                        // ハンドル位置と曲線をリアルタイムに直接DOM更新 (超高速・スムーズ)
                        hx = prevX + dx * kPrev.bezier[2];
                        hy = rowHeight - (kPrev.bezier[3] * (rowHeight - 16) + 8);
                        handleCircle.setAttribute('cx', hx);
                        handleCircle.setAttribute('cy', hy);
                        handleLine.setAttribute('x2', hx);
                        handleLine.setAttribute('y2', hy);

                        if (curveItem) {
                          const cp1x = curveItem.x1 + curveItem.dx * kPrev.bezier[0];
                          const cp1y = rowHeight - (kPrev.bezier[1] * (rowHeight - 16) + 8);
                          curveItem.curve.setAttribute('d', `M ${curveItem.x1} ${curveItem.y1} C ${cp1x} ${cp1y}, ${hx} ${hy}, ${curveItem.x2} ${curveItem.y2}`);
                        }

                        this.updateAnimationFrame();
                        this.editor.render();
                        this.updateTimelineValues();
                      };
                      const onHandleUp = () => {
                        handleCircle.removeEventListener('pointermove', onHandleMove);
                        handleCircle.removeEventListener('pointerup', onHandleUp);
                        this.renderTimeline();
                      };
                      handleCircle.addEventListener('pointermove', onHandleMove);
                      handleCircle.addEventListener('pointerup', onHandleUp);
                    });
                    svg.appendChild(handleCircle);
                  }
                }
              });

              graphContainer.appendChild(svg);
              propBar.appendChild(graphContainer);
            }

            // プロパティ境界線リサイザー
            const resizer = document.createElement('div');
            resizer.className = 'ae-prop-resizer';
            resizer.title = 'ドラッグしてこのトランスフォーム項目とタイムラインの高さを同時に変更';

            resizer.addEventListener('pointerdown', (re) => {
              re.stopPropagation();
              re.preventDefault();
              resizer.classList.add('resizing');
              document.body.style.cursor = 'ns-resize';

              const startY = re.clientY;
              const startRowH = this.propRowHeights.get(propKey) || rowHeight;

              const onResizerMove = (me) => {
                const dy = me.clientY - startY;
                const newRowH = Math.max(24, Math.min(500, startRowH + dy));
                this.propRowHeights.set(propKey, newRowH);
                propHeader.style.height = `${newRowH}px`;
                propHeader.style.minHeight = `${newRowH}px`;
                propBar.style.height = `${newRowH}px`;
                propBar.style.minHeight = `${newRowH}px`;

                const graphSvg = propBar.querySelector('.ae-graph-canvas');
                if (graphSvg) {
                  const zoom = this.timelineZoom || 1.0;
                  const baseW = Math.max(600, Math.round(600 * zoom));
                  graphSvg.setAttribute('viewBox', `0 0 ${baseW} ${newRowH}`);
                }

                this.initExternalScrollbar();
              };

              const onResizerUp = () => {
                resizer.classList.remove('resizing');
                document.body.style.cursor = '';
                window.removeEventListener('pointermove', onResizerMove);
                window.removeEventListener('pointerup', onResizerUp);
                this.initExternalScrollbar();
              };

              window.addEventListener('pointermove', onResizerMove);
              window.addEventListener('pointerup', onResizerUp);
            });

            propHeader.appendChild(resizer);

            // キーフレーム配置 (独立選択 & ドラッグ移動 & Alt複製)
            if (!this.selectedKeyframes) this.selectedKeyframes = [];
            propKfs.forEach(kf => {
              const frame = Math.round(kf.time * 60);
              const kfEl = document.createElement('div');
              const isKfSelected = this.selectedKeyframes.some(sk => sk.kf === kf);
              kfEl.className = `keyframe-diamond prop-kf ${type} ${isKfSelected ? 'selected' : ''}`;
              kfEl.style.left = `${(frame / 60) * 100}%`;
              kfEl.title = `${frame}F: [${name}] クリック:選択 / 長押し:ベジェ曲線ハンドル表示 / ドラッグ:移動 / Alt+ドラッグ:複製`;

              kfEl.addEventListener('click', (e) => {
                e.stopPropagation();
                if (e.ctrlKey || e.shiftKey) {
                  const idx = this.selectedKeyframes.findIndex(sk => sk.kf === kf);
                  if (idx >= 0) this.selectedKeyframes.splice(idx, 1);
                  else this.selectedKeyframes.push({ partId: part.id, prop: type, kf });
                } else {
                  this.selectedKeyframes = [{ partId: part.id, prop: type, kf }];
                }
                this.selectedKeyframe = { partId: part.id, kf };
                this.currentFrame = frame;
                const scrubber = this.container.querySelector('#timelineScrubber');
                if (scrubber) scrubber.value = frame;
                this.updateTimeDisplay();
                this.updateAnimationFrame();
                this.updatePlayhead();
                this.updateTimelineValues();
                this.renderTimeline();
              });

              // ポインタドラッグ (一括移動 / Alt複製 / 長押しでベジェ曲線ハンドル表示)
              let kfLongPressTimer = null;
              let kfMoved = false;

              kfEl.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                e.preventDefault();
                kfMoved = false;
                kfEl.setPointerCapture(e.pointerId);

                // 長押しタイマー: 長押しで該当プロパティのベジェハンドルを表示＆維持
                const kfKey = `${part.id}:${type}:${frame}`;
                kfLongPressTimer = setTimeout(() => {
                  kfLongPressTimer = null;
                  if (!kfMoved) {
                    this.inlineGraphProps.add(propKey);
                    if (!this.propRowHeights.has(propKey)) this.propRowHeights.set(propKey, 80);
                    if (this.activeBezierHandles.has(kfKey)) {
                      this.activeBezierHandles.delete(kfKey);
                    } else {
                      this.activeBezierHandles.add(kfKey);
                    }
                    this.renderTimeline();
                  }
                }, 240);

                if (!e.ctrlKey && !e.shiftKey) {
                  this.selectedKeyframes = [{ partId: part.id, prop: type, kf }];
                } else if (!this.selectedKeyframes.some(sk => sk.kf === kf)) {
                  this.selectedKeyframes.push({ partId: part.id, prop: type, kf });
                }

                let movingKfs = this.selectedKeyframes.map(sk => ({
                  ...sk,
                  targetKf: e.altKey ? { ...sk.kf } : sk.kf,
                  origTime: sk.kf.time
                }));

                if (e.altKey) {
                  movingKfs.forEach(item => {
                    if (!clip.tracks[item.partId]) clip.tracks[item.partId] = [];
                    clip.tracks[item.partId].push(item.targetKf);
                  });
                }

                const startClientX = e.clientX;
                const badge = this.container.querySelector('#tlDragBadge');
                if (badge) badge.style.display = 'block';
                kfEl.classList.add('dragging');

                const onPointerMove = (me) => {
                  const dx = me.clientX - startClientX;
                  if (Math.abs(dx) > 3) {
                    kfMoved = true;
                    if (kfLongPressTimer) {
                      clearTimeout(kfLongPressTimer);
                      kfLongPressTimer = null;
                    }
                  }

                  const rect = propBar.getBoundingClientRect();
                  const dNorm = dx / rect.width;

                  movingKfs.forEach(item => {
                    let newTime = Math.max(0, Math.min(1, item.origTime + dNorm));
                    item.targetKf.time = Math.round(newTime * 60) / 60;
                  });

                  const curNewFrame = Math.round(movingKfs[0].targetKf.time * 60);
                  this.currentFrame = curNewFrame;

                  const pct = `${(curNewFrame / 60) * 100}%`;
                  kfEl.style.left = pct;
                  if (badge) {
                    badge.textContent = `${curNewFrame}F`;
                    badge.style.left = pct;
                  }

                  const scrubber = this.container.querySelector('#timelineScrubber');
                  if (scrubber) scrubber.value = curNewFrame;

                  this.updateTimeDisplay();
                  this.updateAnimationFrame();
                  this.updatePlayhead();
                  this.updateTimelineValues();
                };

                const onPointerUp = () => {
                  if (kfLongPressTimer) {
                    clearTimeout(kfLongPressTimer);
                    kfLongPressTimer = null;
                  }
                  kfEl.classList.remove('dragging');
                  if (badge) badge.style.display = 'none';
                  window.removeEventListener('pointermove', onPointerMove);
                  window.removeEventListener('pointerup', onPointerUp);
                  trackKfs.sort((a, b) => a.time - b.time);
                  this.renderTimeline();
                };

                window.addEventListener('pointermove', onPointerMove);
                window.addEventListener('pointerup', onPointerUp);
              });
              propBar.appendChild(kfEl);
            });

            // トラックバークリック/ドラッグでシーク
            const seekFromPropBar = (e) => {
              const rect = propBar.getBoundingClientRect();
              const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              this.currentFrame = Math.max(0, Math.min(60, Math.round(ratio * 60)));
              const scrubber = this.container.querySelector('#timelineScrubber');
              if (scrubber) scrubber.value = this.currentFrame;
              this.updateTimeDisplay();
              this.updateAnimationFrame();
              this.updatePlayhead();
              this.updateTimelineValues();
            };

            propBar.addEventListener('pointerdown', (e) => {
              if (e.target.closest('.keyframe-diamond') || e.target.closest('.ae-prop-resizer') || e.target.closest('.ae-bezier-handle') || e.target.closest('.ae-graph-anchor')) return;
              seekFromPropBar(e);
              const onMove = (me) => seekFromPropBar(me);
              const onUp = () => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
              };
              window.addEventListener('pointermove', onMove);
              window.addEventListener('pointerup', onUp);
            });

            tracksList.appendChild(propBar);
          };

          // ── ① 位置 (Position) ──
          renderPropertyRow({
            name: '位置',
            type: 'pos',
            getPropVal: () => ({ tx: evalTransform.tx, ty: evalTransform.ty }),
            setPropVal: (kf, val) => { kf.tx = val.tx; kf.ty = val.ty; },
            renderControls: (container, onValChanged) => {
              createScrubber(container, {
                label: 'X:',
                dataKey: `${part.id}:pos:x`,
                getValue: () => Math.round(evalTransform.tx * 10) / 10,
                setValue: (v) => { evalTransform.tx = Math.round(v * 10) / 10; },
                onScrubChange: onValChanged,
                format: (v) => `${v.toFixed(1)}`,
                parse: (s) => parseFloat(s),
                step: 1, sensitivity: 0.6
              });
              createScrubber(container, {
                label: 'Y:',
                dataKey: `${part.id}:pos:y`,
                getValue: () => Math.round(evalTransform.ty * 10) / 10,
                setValue: (v) => { evalTransform.ty = Math.round(v * 10) / 10; },
                onScrubChange: onValChanged,
                format: (v) => `${v.toFixed(1)}`,
                parse: (s) => parseFloat(s),
                step: 1, sensitivity: 0.6
              });
            }
          });

          // ── ② スケール (Scale) ──
          renderPropertyRow({
            name: 'スケール',
            type: 'scale',
            getPropVal: () => ({ sx: evalTransform.sx, sy: evalTransform.sy }),
            setPropVal: (kf, val) => { kf.sx = val.sx; kf.sy = val.sy; },
            renderControls: (container, onValChanged) => {
              const linkBtn = document.createElement('button');
              linkBtn.className = `ae-link-btn ${isLocked ? 'active' : ''}`;
              linkBtn.textContent = '🔗';
              linkBtn.title = isLocked ? '縦横比を固定中 (クリックで解除)' : '縦横比固定なし (クリックで固定)';
              linkBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.timelineAspectLocked.set(part.id, !isLocked);
                this.renderTimeline();
              });
              container.appendChild(linkBtn);

              createScrubber(container, {
                label: 'X:',
                dataKey: `${part.id}:scale:x`,
                getValue: () => Math.round(evalTransform.sx * 1000) / 10,
                setValue: (v) => {
                  const s = Math.round((v / 100) * 100) / 100;
                  evalTransform.sx = s;
                  if (isLocked) evalTransform.sy = s;
                },
                onScrubChange: onValChanged,
                format: (v) => `${v.toFixed(1)}%`,
                parse: (s) => parseFloat(String(s).replace('%', '')),
                step: 1, sensitivity: 0.5, min: 0
              });

              createScrubber(container, {
                label: 'Y:',
                dataKey: `${part.id}:scale:y`,
                getValue: () => Math.round(evalTransform.sy * 1000) / 10,
                setValue: (v) => {
                  const s = Math.round((v / 100) * 100) / 100;
                  evalTransform.sy = s;
                  if (isLocked) evalTransform.sx = s;
                },
                onScrubChange: onValChanged,
                format: (v) => `${v.toFixed(1)}%`,
                parse: (s) => parseFloat(String(s).replace('%', '')),
                step: 1, sensitivity: 0.5, min: 0
              });
            }
          });

          // ── ③ 回転 (Rotation) ──
          renderPropertyRow({
            name: '回転',
            type: 'rot',
            getPropVal: () => evalTransform.rot,
            setPropVal: (kf, val) => { kf.rot = val; },
            renderControls: (container, onValChanged) => {
              createScrubber(container, {
                label: '角度:',
                dataKey: `${part.id}:rot`,
                getValue: () => Math.round(evalTransform.rot * 10) / 10,
                setValue: (v) => { evalTransform.rot = Math.round(v * 10) / 10; },
                onScrubChange: onValChanged,
                format: (v) => formatAeRotation(v),
                parse: (s) => parseAeRotation(s),
                step: 1, sensitivity: 0.8
              });
            }
          });

          // ── ④ 不透明度 (Opacity) ──
          renderPropertyRow({
            name: '不透明度',
            type: 'opacity',
            getPropVal: () => evalTransform.op,
            setPropVal: (kf, val) => { kf.op = val; },
            renderControls: (container, onValChanged) => {
              createScrubber(container, {
                label: '値:',
                dataKey: `${part.id}:opacity`,
                getValue: () => Math.round((evalTransform.op !== undefined ? evalTransform.op : 1) * 100),
                setValue: (v) => { evalTransform.op = Math.max(0, Math.min(100, v)) / 100; },
                onScrubChange: onValChanged,
                format: (v) => `${Math.round(v)}%`,
                parse: (s) => parseFloat(String(s).replace('%', '')),
                step: 1, sensitivity: 0.5, min: 0, max: 100
              });
            }
          });
        }
      }
    });

    // 縦スクロール同期 & 外側スクロールバー初期化
    this.initExternalScrollbar();

    // マーキー範囲選択リスナー初期化
    this.initTimelineMarquee();

    // プレイヘッド位置を更新
    this.updatePlayhead();

    // タイムラインズームの適用
    this.applyTimelineZoom();
  }

  // プレイヘッド (CTI) 位置更新
  updatePlayhead() {
    const pct = `${(this.currentFrame / 60) * 100}%`;
    const playheadLine = this.container.querySelector('#tlPlayheadLine');
    if (playheadLine) playheadLine.style.left = pct;
    const ctiHead = this.container.querySelector('#tlCtiHead');
    if (ctiHead) ctiHead.style.left = pct;
    this.updateTimeDisplay();
    this.updateTimelineValues();
    this.updateKeyframeNavGlow();
  }

  // 現在フレームにキーフレームがあるかどうかに基づき、◆ボタンとシークバーの発光状態を動的更新
  updateKeyframeNavGlow() {
    const clip = this.character?.animations?.[this.currentMotion];
    let hasAnyKfAtCurrent = false;

    // 左ヘッダー内の各プロパティ◆トグルボタン
    this.container.querySelectorAll('.ae-nav-kf-toggle[data-nav-prop]').forEach(el => {
      const propKey = el.dataset.navProp; // 例: "part_1:pos"
      if (!propKey || !clip?.tracks) return;
      const parts = propKey.split(':');
      const partId = parts[0];
      const propType = parts[1];
      const trackKfs = clip.tracks[partId] || [];

      const hasKf = trackKfs.some(k => {
        if (Math.round(k.time * 60) !== this.currentFrame) return false;
        if (k.prop === propType) return true;
        if (!k.prop) {
          if (propType === 'pos') return k.tx !== undefined || k.ty !== undefined;
          if (propType === 'scale') return k.sx !== undefined || k.sy !== undefined;
          if (propType === 'rot') return k.rot !== undefined;
          if (propType === 'opacity') return k.op !== undefined;
        }
        return false;
      });

      if (hasKf) {
        el.classList.add('has-kf');
        el.title = '現在フレームのキーフレームを削除';
        hasAnyKfAtCurrent = true;
      } else {
        el.classList.remove('has-kf');
        el.title = '現在フレームにキーフレームを追加';
      }
    });

    // シークバー (赤い縦線) は現在フレームにキーフレームがある時のみ微細発光、何もない通常フレームでは発光しない
    const playheadLine = this.container.querySelector('#tlPlayheadLine');
    if (playheadLine) {
      if (hasAnyKfAtCurrent) {
        playheadLine.classList.add('on-keyframe');
      } else {
        playheadLine.classList.remove('on-keyframe');
      }
    }
  }

  // 現在フレームのトランスフォーム数値をスクラバー＆インスペクターにリアルタイム反映
  updateTimelineValues() {
    const part = this.editor?.getSelectedPart();
    if (!part) return;
    const clip = this.character?.animations?.[this.currentMotion];
    if (!clip) return;

    // 現在フレームの補間トランスフォームを計算 (ベジェ曲線やイージングを含む)
    const norm = Math.max(0, Math.min(1, this.currentFrame / (this.totalFrames || 60)));
    const transforms = resolveRigTransforms(this.character.parts, clip, norm);
    const t = transforms.get(part.id);
    if (!t) return;

    // 1. タイムライン左ヘッダー内のスクラバー数値表示を更新
    const updateScrubEl = (key, valText) => {
      const el = this.container.querySelector(`[data-track-val="${key}"]`);
      if (el && !el.querySelector('input')) {
        el.textContent = valText;
      }
    };

    updateScrubEl(`${part.id}:pos:x`, `${t.tx.toFixed(1)}`);
    updateScrubEl(`${part.id}:pos:y`, `${t.ty.toFixed(1)}`);
    updateScrubEl(`${part.id}:scale:x`, `${(t.sx * 100).toFixed(1)}%`);
    updateScrubEl(`${part.id}:scale:y`, `${(t.sy * 100).toFixed(1)}%`);
    updateScrubEl(`${part.id}:rot`, `${Math.round(t.rot)}°`);
    updateScrubEl(`${part.id}:opacity`, `${Math.round(t.op * 100)}%`);

    // 2. 右側インスペクターパネル内の各入力フィールドをリアルタイム更新
    const setInputVal = (selector, val) => {
      const input = this.container.querySelector(selector);
      if (input && document.activeElement !== input) {
        input.value = val;
      }
    };

    setInputVal('#partPosX', Math.round(t.tx * 10) / 10);
    setInputVal('#partPosY', Math.round(t.ty * 10) / 10);
    setInputVal('#partScaleX', Math.round(t.sx * 100));
    setInputVal('#partScaleY', Math.round(t.sy * 100));
    setInputVal('#partRot', Math.round(t.rot));
    setInputVal('#partOpacity', Math.round(t.op * 100));
  }

  // タイムコード表示更新 (0F (0.00s) / 60F)
  updateTimeDisplay() {
    const f = Math.round(this.currentFrame);
    const sec = (f / 60).toFixed(2);
    const scrubEl = this.container.querySelector('#tlFrameScrub');
    const secEl = this.container.querySelector('#tlSecDisp');
    if (scrubEl && !scrubEl.querySelector('input')) {
      scrubEl.textContent = `${f}F`;
    }
    if (secEl) {
      secEl.textContent = `(${sec}s) / 60F`;
    }
    const timeVal = this.container.querySelector('#timelineTimeVal');
    if (timeVal && !scrubEl) {
      timeVal.textContent = `${f}F (${sec}s) / 60F`;
    }
  }

  // 独立した外側スクロールバー初期化 (トラック幅の干渉を完全排除)
  initExternalScrollbar() {
    const tracksScroll = this.container.querySelector('#tlTracksScroll');
    const extScrollbar = this.container.querySelector('#tlExtScrollbar');
    const extDummy = this.container.querySelector('#tlExtScrollDummy');
    const headersList = this.container.querySelector('#tlHeadersList');
    const tracksList = this.container.querySelector('#tlTracksList');
    if (!tracksScroll || !extScrollbar || !extDummy) return;

    // ヘッダー側・トラック側の全高さを正確に反映
    const updateDummyHeight = () => {
      const hHeight = headersList ? headersList.scrollHeight : 0;
      const tHeight = tracksList ? tracksList.scrollHeight : 0;
      const sHeight = tracksScroll ? tracksScroll.scrollHeight : 0;
      const maxH = Math.max(hHeight, tHeight, sHeight);
      if (maxH > 0) {
        extDummy.style.height = `${maxH}px`;
      }
    };

    updateDummyHeight();
    requestAnimationFrame(updateDummyHeight);
    setTimeout(updateDummyHeight, 60);

    if (!this._extScrollbarBound) {
      this._extScrollbarBound = true;
      let isSyncing = false;

      // 外側スクロールバーのドラッグ・スクロール連動
      extScrollbar.addEventListener('scroll', () => {
        if (isSyncing) return;
        isSyncing = true;
        const top = extScrollbar.scrollTop;
        if (tracksScroll) tracksScroll.scrollTop = top;
        if (headersList) headersList.scrollTop = top;
        isSyncing = false;
      });

      // マウスホイールでの上下スクロール連動 (Shiftなしの縦回転時)
      const onWheel = (e) => {
        if (!e.shiftKey && Math.abs(e.deltaY) > 0) {
          extScrollbar.scrollTop += e.deltaY;
          if (tracksScroll) tracksScroll.scrollTop = extScrollbar.scrollTop;
          if (headersList) headersList.scrollTop = extScrollbar.scrollTop;
          e.preventDefault();
        }
      };

      tracksScroll.addEventListener('wheel', onWheel, { passive: false });
      if (headersList) headersList.addEventListener('wheel', onWheel, { passive: false });
    }
  }

  // タイムラインズーム機能の初期化 (スライダー、ズームボタン、横スクロール連動)
  initTimelineZoom() {
    const slider = this.container.querySelector('#tlZoomSlider');
    const zoomVal = this.container.querySelector('#tlZoomValue');
    const btnOut = this.container.querySelector('#btnZoomOut');
    const btnIn = this.container.querySelector('#btnZoomIn');
    const rulerBar = this.container.querySelector('#timelineRulerBar');
    const tracksScroll = this.container.querySelector('#tlTracksScroll');
    const navBar = this.container.querySelector('#aeTimeNavBar');
    const navTrack = this.container.querySelector('#aeTimeNavTrack');

    const updateZoom = (z) => {
      this.timelineZoom = Math.max(1.0, Math.min(10.0, Math.round(z * 10) / 10));
      if (slider) slider.value = this.timelineZoom;
      if (zoomVal) zoomVal.textContent = `${Math.round(this.timelineZoom * 100)}%`;
      this.applyTimelineZoom();
    };

    if (slider && !this._tlZoomSliderBound) {
      this._tlZoomSliderBound = true;
      slider.addEventListener('input', (e) => {
        updateZoom(parseFloat(e.target.value) || 1.0);
      });
    }

    if (btnOut && !this._btnZoomOutBound) {
      this._btnZoomOutBound = true;
      btnOut.addEventListener('click', () => {
        const nextZoom = this.timelineZoom <= 1.2 ? 1.0 : this.timelineZoom - 0.5;
        updateZoom(nextZoom);
      });
    }

    if (btnIn && !this._btnZoomInBound) {
      this._btnZoomInBound = true;
      btnIn.addEventListener('click', () => {
        updateZoom(this.timelineZoom + 0.5);
      });
    }

    // ルーラーとトラックの横スクロール連動
    if (tracksScroll && rulerBar && !this._tlScrollSyncBound) {
      this._tlScrollSyncBound = true;
      tracksScroll.addEventListener('scroll', () => {
        rulerBar.scrollLeft = tracksScroll.scrollLeft;
        const maxScroll = tracksScroll.scrollWidth - tracksScroll.clientWidth;
        if (navBar && navTrack && maxScroll > 0) {
          const ratio = tracksScroll.scrollLeft / maxScroll;
          const maxNavLeft = navTrack.clientWidth - navBar.clientWidth;
          navBar.style.left = `${Math.max(0, Math.min(maxNavLeft, ratio * maxNavLeft))}px`;
        }
      });
      rulerBar.addEventListener('scroll', () => {
        tracksScroll.scrollLeft = rulerBar.scrollLeft;
      });
    }

    // 時間ナビゲーター (全体ミニマップ) のドラッグでパン
    if (navBar && navTrack && tracksScroll && !this._navBarDragBound) {
      this._navBarDragBound = true;
      navBar.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        const startX = e.clientX;
        const startLeft = parseFloat(navBar.style.left) || 0;
        const maxScroll = tracksScroll.scrollWidth - tracksScroll.clientWidth;
        const maxNavLeft = navTrack.clientWidth - navBar.clientWidth;

        const onMove = (me) => {
          const dx = me.clientX - startX;
          const newLeft = Math.max(0, Math.min(maxNavLeft, startLeft + dx));
          navBar.style.left = `${newLeft}px`;
          if (maxNavLeft > 0) {
            tracksScroll.scrollLeft = (newLeft / maxNavLeft) * maxScroll;
            if (rulerBar) rulerBar.scrollLeft = tracksScroll.scrollLeft;
          }
        };
        const onUp = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      });
    }
  }

  // タイムラインズーム倍率をDOMに反映 (目盛りとトラックを完全連動)
  applyTimelineZoom() {
    const zoom = this.timelineZoom || 1.0;
    const widthPct = `${zoom * 100}%`;
    const rulerBar = this.container.querySelector('#timelineRulerBar');
    const rulerContent = this.container.querySelector('#tlRulerContent');
    const tracksList = this.container.querySelector('#tlTracksList');
    const tracksScroll = this.container.querySelector('#tlTracksScroll');
    const navBar = this.container.querySelector('#aeTimeNavBar');

    if (rulerContent) {
      rulerContent.style.width = widthPct;
    }
    if (rulerBar) {
      rulerBar.style.width = '100%';
    }
    if (tracksList) {
      tracksList.style.width = widthPct;
    }

    if (rulerBar && tracksScroll) {
      rulerBar.scrollLeft = tracksScroll.scrollLeft;
    }

    if (navBar) {
      const barWidthPct = Math.max(10, Math.min(100, (1 / zoom) * 100));
      navBar.style.width = `${barWidthPct}%`;
    }
  }

  // フレーム表示スクラバー初期化 (左右ドラッグでシーク / クリックで手入力)
  initFrameScrubber() {
    const scrubEl = this.container.querySelector('#tlFrameScrub');
    if (!scrubEl || this._frameScrubberBound) return;
    this._frameScrubberBound = true;

    let startX = 0;
    let startFrame = 0;
    let isDragging = false;

    scrubEl.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || scrubEl.querySelector('input')) return;
      e.stopPropagation();
      startX = e.clientX;
      startFrame = this.currentFrame;
      isDragging = false;

      const onPointerMove = (me) => {
        const dx = me.clientX - startX;
        if (Math.abs(dx) > 2) isDragging = true;
        if (!isDragging) return;

        me.preventDefault();
        const factor = me.shiftKey ? 5 : (me.altKey ? 0.2 : 1);
        let nextFrame = Math.round(startFrame + dx * factor * 0.4);
        nextFrame = Math.max(0, Math.min(60, nextFrame));

        this.currentFrame = nextFrame;
        const scrubber = this.container.querySelector('#timelineScrubber');
        if (scrubber) scrubber.value = nextFrame;
        this.updateTimeDisplay();
        this.updateAnimationFrame();
        this.updatePlayhead();
      };

      const onPointerUp = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);

        if (!isDragging) {
          scrubEl.innerHTML = '';
          const input = document.createElement('input');
          input.type = 'number';
          input.className = 'tl-frame-input';
          input.min = '0';
          input.max = '60';
          input.value = this.currentFrame;
          scrubEl.appendChild(input);
          input.focus();
          input.select();

          let committed = false;
          const commit = () => {
            if (committed) return;
            committed = true;
            const val = parseInt(input.value, 10);
            if (!isNaN(val)) {
              this.currentFrame = Math.max(0, Math.min(60, val));
              const scrubber = this.container.querySelector('#timelineScrubber');
              if (scrubber) scrubber.value = this.currentFrame;
              this.updateAnimationFrame();
              this.updatePlayhead();
            }
            this.updateTimeDisplay();
          };

          input.addEventListener('keydown', (ke) => {
            if (ke.key === 'Enter') commit();
            else if (ke.key === 'Escape') { committed = true; this.updateTimeDisplay(); }
          });
          input.addEventListener('blur', commit);
        } else {
          this.renderTimeline();
        }
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    });
  }

  // タイムライン上のマーキー範囲選択枠
  initTimelineMarquee() {
    const tracksScroll = this.container.querySelector('#tlTracksScroll');
    const marqueeEl = this.container.querySelector('#tlMarqueeSelection');
    if (!tracksScroll || !marqueeEl || this._marqueeBound) return;
    this._marqueeBound = true;

    let isMarquee = false;
    let startX = 0;
    let startY = 0;

    tracksScroll.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.keyframe-diamond') || e.target.closest('button') || e.target.closest('.ae-prop-resizer')) {
        return;
      }
      if (e.button !== 0) return;

      const rect = tracksScroll.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      isMarquee = false;

      const onPointerMove = (me) => {
        const dx = me.clientX - startX;
        const dy = me.clientY - startY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          isMarquee = true;
        }
        if (!isMarquee) return;

        me.preventDefault();
        const left = Math.min(startX, me.clientX) - rect.left;
        const top = Math.min(startY, me.clientY) - rect.top + tracksScroll.scrollTop;
        const width = Math.abs(dx);
        const height = Math.abs(dy);

        marqueeEl.style.display = 'block';
        marqueeEl.style.left = `${left}px`;
        marqueeEl.style.top = `${top}px`;
        marqueeEl.style.width = `${width}px`;
        marqueeEl.style.height = `${height}px`;

        const mRect = marqueeEl.getBoundingClientRect();
        const diamonds = tracksScroll.querySelectorAll('.keyframe-diamond.prop-kf');
        
        if (!me.ctrlKey && !me.shiftKey) {
          this.selectedKeyframes = [];
        }

        diamonds.forEach(dia => {
          const dRect = dia.getBoundingClientRect();
          const intersect = !(
            dRect.right < mRect.left ||
            dRect.left > mRect.right ||
            dRect.bottom < mRect.top ||
            dRect.top > mRect.bottom
          );

          if (intersect) {
            dia.classList.add('selected');
            const partId = dia.closest('[data-part-id]')?.dataset.partId;
            const propType = dia.closest('[data-prop-type]')?.dataset.propType;
            const clip = this.character.animations?.[this.currentMotion];
            const kfs = clip?.tracks[partId] || [];
            const kf = kfs.find(k => Math.abs((k.time * 100) - parseFloat(dia.style.left)) < 0.5);
            if (!this.selectedKeyframes) this.selectedKeyframes = [];
            if (kf && !this.selectedKeyframes.some(sk => sk.kf === kf)) {
              this.selectedKeyframes.push({ partId, prop: propType, kf });
            }
          } else if (!me.ctrlKey && !me.shiftKey) {
            dia.classList.remove('selected');
          }
        });
      };

      const onPointerUp = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        marqueeEl.style.display = 'none';

        if (!isMarquee) {
          this.selectedKeyframes = [];
          this.selectedKeyframe = null;
          tracksScroll.querySelectorAll('.keyframe-diamond.selected').forEach(el => el.classList.remove('selected'));
        }
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    });
  }

  // 60Fベジェ曲線グラフエディタ (参考note記事 After Effects風イージング調整)
  renderGraphEditor() {
    const box = this.container.querySelector('#graphCanvasBox');
    const part = this.editor.getSelectedPart();
    if (!box || !this.character) return;

    const clip = this.character.animations?.[this.currentMotion];
    if (!clip || !part) {
      box.innerHTML = `<div class="empty-graph">パーツを選択すると60Fベジェ曲線が表示されます</div>`;
      return;
    }

    const kfs = clip.tracks[part.id] || [];
    if (kfs.length < 2) {
      box.innerHTML = `<div class="empty-graph">ベジェ曲線を調整するにはキーフレームが2つ以上必要です</div>`;
      return;
    }

    const prop = this.selectedGraphProperty; // 'rot', 'tx', 'ty'

    // グラフのSVG描画 (横 600, 縦 240)
    const W = 600;
    const H = 240;
    const padL = 40;
    const padR = 40;
    const padT = 30;
    const padB = 30;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;

    // プロパティに応じた値の範囲
    let minVal = -30;
    let maxVal = 30;
    if (prop === 'rot') { minVal = -45; maxVal = 45; }
    else if (prop === 'tx') { minVal = -50; maxVal = 50; }
    else if (prop === 'ty') { minVal = -50; maxVal = 50; }

    const valToY = (val) => padT + (1 - (val - minVal) / (maxVal - minVal)) * innerH;
    const frameToX = (f) => padL + (f / 60) * innerW;

    // グリッド線
    let gridLines = '';
    for (let f = 0; f <= 60; f += 10) {
      const x = frameToX(f);
      gridLines += `<line x1="${x}" y1="${padT}" x2="${x}" y2="${H - padB}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`;
      gridLines += `<text x="${x}" y="${H - 10}" fill="#94a3b8" font-size="10" text-anchor="middle">${f}F</text>`;
    }
    const zeroY = valToY(0);
    gridLines += `<line x1="${padL}" y1="${zeroY}" x2="${W - padR}" y2="${zeroY}" stroke="rgba(56,189,248,0.3)" stroke-width="1" stroke-dasharray="4,4"/>`;

    // ベジェ曲線パスの生成
    let curvePath = '';
    let handlesHtml = '';
    let keyframeDots = '';

    for (let i = 0; i < kfs.length - 1; i++) {
      const k1 = kfs[i];
      const k2 = kfs[i + 1];
      const f1 = Math.round(k1.time * 60);
      const f2 = Math.round(k2.time * 60);
      const x1 = frameToX(f1);
      const y1 = valToY(k1[prop] || 0);
      const x2 = frameToX(f2);
      const y2 = valToY(k2[prop] || 0);

      // ベジェ制御点 [cp1x, cp1y, cp2x, cp2y] (デフォルト: 0.42, 0.0, 0.58, 1.0)
      if (!k1.bezier) k1.bezier = [0.42, 0.0, 0.58, 1.0];
      const [b1x, b1y, b2x, b2y] = k1.bezier;

      const cx1 = x1 + b1x * (x2 - x1);
      const cy1 = y1 - b1y * (y1 - y2);
      const cx2 = x1 + b2x * (x2 - x1);
      const cy2 = y1 - b2y * (y1 - y2);

      if (i === 0) curvePath += `M ${x1} ${y1} `;
      curvePath += `C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2} `;

      // ハンドル線 & ハンドル丸
      handlesHtml += `
        <!-- ハンドル1 -->
        <line x1="${x1}" y1="${y1}" x2="${cx1}" y2="${cy1}" stroke="#f59e0b" stroke-width="1.5" />
        <circle cx="${cx1}" cy="${cy1}" r="5" fill="#f59e0b" class="graph-handle" data-segment="${i}" data-handle="1" style="cursor:grab;"/>

        <!-- ハンドル2 -->
        <line x1="${x2}" y1="${y2}" x2="${cx2}" y2="${cy2}" stroke="#38bdf8" stroke-width="1.5" />
        <circle cx="${cx2}" cy="${cy2}" r="5" fill="#38bdf8" class="graph-handle" data-segment="${i}" data-handle="2" style="cursor:grab;"/>
      `;

      // キーフレーム丸
      keyframeDots += `<circle cx="${x1}" cy="${y1}" r="6" fill="#fff" stroke="#0284c7" stroke-width="2"/>`;
      if (i === kfs.length - 2) {
        keyframeDots += `<circle cx="${x2}" cy="${y2}" r="6" fill="#fff" stroke="#0284c7" stroke-width="2"/>`;
      }
    }

    // 現在時間インジケーター線
    const curX = frameToX(this.currentFrame);
    const curLine = `<line x1="${curX}" y1="${padT - 5}" x2="${curX}" y2="${H - padB + 5}" stroke="#f43f5e" stroke-width="2"/>`;

    box.innerHTML = `
      <svg class="graph-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        ${gridLines}
        <path d="${curvePath}" fill="none" stroke="#818cf8" stroke-width="3" />
        ${handlesHtml}
        ${keyframeDots}
        ${curLine}
      </svg>
    `;

    // ベジェハンドルのドラッグイベント実装
    const svgEl = box.querySelector('.graph-svg');
    let draggingHandle = null;

    box.querySelectorAll('.graph-handle').forEach(el => {
      el.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        const segIdx = parseInt(el.dataset.segment, 10);
        const handleNum = parseInt(el.dataset.handle, 10);
        draggingHandle = { segIdx, handleNum, el };
      });
    });

    const onMouseMove = (e) => {
      if (!draggingHandle) return;
      const rect = svgEl.getBoundingClientRect();
      const svgX = ((e.clientX - rect.left) / rect.width) * W;
      const svgY = ((e.clientY - rect.top) / rect.height) * H;

      const k1 = kfs[draggingHandle.segIdx];
      const k2 = kfs[draggingHandle.segIdx + 1];
      const f1 = Math.round(k1.time * 60);
      const f2 = Math.round(k2.time * 60);
      const x1 = frameToX(f1);
      const x2 = frameToX(f2);
      const y1 = valToY(k1[prop] || 0);
      const y2 = valToY(k2[prop] || 0);

      const spanX = x2 - x1;
      const spanY = y1 - y2;

      let normX = spanX === 0 ? 0 : (svgX - x1) / spanX;
      normX = Math.max(0, Math.min(1, normX));

      let normY = spanY === 0 ? 0 : (y1 - svgY) / spanY;

      if (draggingHandle.handleNum === 1) {
        k1.bezier[0] = Math.round(normX * 100) / 100;
        k1.bezier[1] = Math.round(normY * 100) / 100;
      } else {
        k1.bezier[2] = Math.round(normX * 100) / 100;
        k1.bezier[3] = Math.round(normY * 100) / 100;
      }

      this.updateAnimationFrame();
      this.renderGraphEditor();
    };

    const onMouseUp = () => {
      if (draggingHandle) {
        draggingHandle = null;
      }
    };

    window.removeEventListener('mousemove', this._graphMouseMove);
    window.removeEventListener('mouseup', this._graphMouseUp);
    this._graphMouseMove = onMouseMove;
    this._graphMouseUp = onMouseUp;
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  // ========================================================
  // 5. ツールバー & 全体イベント
  // ========================================================
  bindControls() {
    // ツールボタン (従来の互換ツールバー用のみ。PhotoshopツールボックスはbindToolboxEventsで完全制御)
    this.container.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;
        this.selectStudioTool(tool);
      });
    });

    // スナップ切替
    const btnSnap = this.container.querySelector('#btnSnapToggle');
    btnSnap?.addEventListener('click', () => {
      this.editor.snapToGrid = !this.editor.snapToGrid;
      btnSnap.classList.toggle('active', this.editor.snapToGrid);
      btnSnap.title = `🧲 グリッドスナップ: ${this.editor.snapToGrid ? 'ON' : 'OFF'}`;
      this.updateCanvasStatusBar();
    });

    // シルエット切替
    const btnSil = this.container.querySelector('#btnSilhouetteToggle');
    btnSil?.addEventListener('click', () => {
      const enabled = !this.editor.isSilhouetteMode;
      this.editor.setSilhouetteMode(enabled);
      btnSil.classList.toggle('active', enabled);
      btnSil.title = `🌑 深海シルエット: ${enabled ? 'ON' : 'OFF'}`;
      this.updateCanvasStatusBar();
    });

    // 向き反転
    const btnFacing = this.container.querySelector('#btnFacingToggle');
    btnFacing?.addEventListener('click', () => {
      const newFacing = (this.editor.previewFacing || 1) * -1;
      this.editor.setFacing(newFacing);
      btnFacing.classList.toggle('active', newFacing === -1);
      btnFacing.title = `↔️ 左右向き反転: ${newFacing === -1 ? '反転中' : '通常'}`;
      this.updateCanvasStatusBar();
    });

    // パス閉鎖
    const btnClosePath = this.container.querySelector('#btnClosePathToggle');
    btnClosePath?.addEventListener('click', () => {
      const part = this.editor.getSelectedPart();
      if (part) {
        part.closed = !part.closed;
        this.editor.render();
        this.updateInspectorPreview();
        btnClosePath.classList.toggle('active', !!part.closed);
        btnClosePath.title = part.closed ? '⭕ パス閉鎖: ON' : '⭕ パス開放: OFF';
        this.updateCanvasStatusBar();
      }
    });

    // メニューバー (Photoshop互換 ドロップダウンメニュー) イベント
    this.bindMenuBarEvents();

    // 自由変形 / スケールモード切替 (Ctrl+T)
    const btnTransform = this.container.querySelector('#btnTransformToggle');
    btnTransform?.addEventListener('click', () => {
      this.selectStudioTool('transform');
    });

    // 複数レイヤー結合 (Ctrl+E)
    this.container.querySelector('#btnMergeLayers')?.addEventListener('click', () => {
      this.editor.mergeSelectedLayers();
      this.renderLayerTree();
      this.renderInspector();
      this.updateInspectorPreview();
    });

    // Undo / Redo
    this.container.querySelector('#btnUndo').addEventListener('click', () => {
      this.editor.undo();
      this.updateInspectorPreview();
    });
    this.container.querySelector('#btnRedo').addEventListener('click', () => {
      this.editor.redo();
      this.updateInspectorPreview();
    });
    this.container.querySelector('#btnResetView').addEventListener('click', () => {
      this.editor.zoom = 1.6;
      this.editor.centerViewport();
    });

    // Photoshop ナビゲーターコントロール (右サイドバー)
    this.attachNavigatorEvents();

    const navPercentInput = this.container.querySelector('#navZoomPercentInput');
    const navSlider = this.container.querySelector('#navZoomSlider');
    const btnNavZoomIn = this.container.querySelector('#btnNavZoomIn');
    const btnNavZoomOut = this.container.querySelector('#btnNavZoomOut');

    const applyNavZoom = (newZoom) => {
      if (!this.editor) return;
      const rect = this.editor.svg ? this.editor.svg.getBoundingClientRect() : this.editor.container.getBoundingClientRect();
      const cx = (rect.width || 900) / 2;
      const cy = (rect.height || 560) / 2;
      this.editor.applyZoom(newZoom, { clientX: (rect.left || 0) + cx, clientY: (rect.top || 0) + cy });
      this.syncNavigator();
    };

    if (navSlider) {
      navSlider.addEventListener('input', (e) => {
        applyNavZoom(parseFloat(e.target.value) / 100);
      });
    }

    if (navPercentInput) {
      const commitPercent = () => {
        let val = navPercentInput.value.replace(/[^0-9.]/g, '');
        let num = parseFloat(val);
        if (isNaN(num)) num = Math.round(this.editor.zoom * 100);
        num = Math.max(20, Math.min(400, num));
        applyNavZoom(num / 100);
        navPercentInput.value = `${Math.round(num)}%`;
      };
      navPercentInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          commitPercent();
          navPercentInput.blur();
        }
      });
      navPercentInput.addEventListener('blur', commitPercent);
    }

    if (btnNavZoomIn) {
      btnNavZoomIn.addEventListener('click', () => {
        this.editor.zoomIn(1.25);
        this.syncNavigator();
      });
    }

    if (btnNavZoomOut) {
      btnNavZoomOut.addEventListener('click', () => {
        this.editor.zoomOut(0.8);
        this.syncNavigator();
      });
    }

    // レイヤー順序操作ボタン (最前面, 前面, 背面, 最背面)
    this.container.querySelector('#btnLayerTop').addEventListener('click', () => this.moveLayerOrder('top'));
    this.container.querySelector('#btnLayerUp').addEventListener('click', () => this.moveLayerOrder('up'));
    this.container.querySelector('#btnLayerDown').addEventListener('click', () => this.moveLayerOrder('down'));
    this.container.querySelector('#btnLayerBottom').addEventListener('click', () => this.moveLayerOrder('bottom'));

    // パーツ追加・複製・反転・削除
    this.container.querySelector('#btnAddPart').addEventListener('click', () => {
      const newPart = createPart({
        name: `新パーツ_${this.character.parts.length + 1}`,
        points: [
          { x: -20, y: -20, type: 'corner', inHandle: { x: -20, y: -20 }, outHandle: { x: -20, y: -20 } },
          { x: 20, y: -20, type: 'corner', inHandle: { x: 20, y: -20 }, outHandle: { x: 20, y: -20 } },
          { x: 20, y: 20, type: 'corner', inHandle: { x: 20, y: 20 }, outHandle: { x: 20, y: 20 } },
          { x: -20, y: 20, type: 'corner', inHandle: { x: -20, y: 20 }, outHandle: { x: -20, y: 20 } }
        ],
        zIndex: (Math.max(...this.character.parts.map(p => p.zIndex || 0), 0)) + 10
      });
      this.character.parts.push(newPart);
      this.editor.selectedPartId = newPart.id;
      this.editor.render();
      this.updateInspectorPreview();
      this.renderLayerTree();
      this.renderInspector();
      this.renderTimeline();
    });

    this.container.querySelector('#btnDuplicatePart').addEventListener('click', () => this.duplicatePart());

    this.container.querySelector('#btnFlipHPart').addEventListener('click', () => {
      this.editor.flipSelectedPartH();
      this.updateInspectorPreview();
    });

    this.container.querySelector('#btnFlipVPart').addEventListener('click', () => {
      this.editor.flipSelectedPartV();
      this.updateInspectorPreview();
    });

    this.container.querySelector('#btnDeletePart').addEventListener('click', () => {
      const selectedParts = this.editor.getSelectedParts();
      if (selectedParts.length === 0 || this.character.parts.length <= 1) return;
      this.editor.pushState();
      const deleteIds = new Set(selectedParts.map(p => p.id));
      this.character.parts = this.character.parts.filter(p => !deleteIds.has(p.id));
      if (this.character.parts.length === 0) {
        this.character.parts.push(createPart({ id: 'part_1', name: 'パーツ 1' }));
      }
      this.editor.selectedPartIds.clear();
      this.editor.selectedPartId = this.character.parts[0].id;
      this.editor.selectedPartIds.add(this.character.parts[0].id);
      this.editor.render();
      this.updateInspectorPreview();
      this.renderLayerTree();
      this.renderInspector();
      this.renderTimeline();
    });

    // レイヤー選択対象モード切替 (全レイヤー対象 vs 指定レイヤーのみ)
    const btnSelectAll = this.container.querySelector('#btnLayerSelectModeAll');
    const btnSelectActive = this.container.querySelector('#btnLayerSelectModeActive');
    btnSelectAll?.addEventListener('click', () => {
      this.editor.setLayerSelectMode('all');
      btnSelectAll.classList.add('active');
      btnSelectActive?.classList.remove('active');
    });
    btnSelectActive?.addEventListener('click', () => {
      this.editor.setLayerSelectMode('active');
      btnSelectActive.classList.add('active');
      btnSelectAll?.classList.remove('active');
    });

    // プリセット切替 (公式7魚種 + カスタム登録キャラ)
    this.container.querySelector('#studioPresetSelect').addEventListener('change', (e) => {
      this.loadPresetById(e.target.value);
    });

    // フレームスクラバー初期化
    this.initFrameScrubber();

    // タイムライン ズーム機能初期化 (スライダー、小山・大山ボタン、スクロール同期)
    this.initTimelineZoom();

    // タイムライン タブ切替 (タイムライン表示 ↔ グラフ表示)
    const tabDope = this.container.querySelector('#tabDopeSheet');
    const tabGraph = this.container.querySelector('#tabGraphEditor');
    const dopeView = this.container.querySelector('#timelineDopeSheetView');
    const graphView = this.container.querySelector('#timelineGraphView');

    const switchTimelineTab = (mode) => {
      this.timelineMode = 'dopesheet';
      if (dopeView) dopeView.style.display = 'flex';
      if (graphView) graphView.style.display = 'none';

      const selIds = new Set(this.editor.selectedPartIds || []);
      if (this.editor.selectedPartId) selIds.add(this.editor.selectedPartId);

      let targetPartIds = this.character.parts.filter(p => selIds.has(p.id) || this.expandedTimelineParts.has(p.id)).map(p => p.id);
      if (targetPartIds.length === 0 && this.character.parts.length > 0) {
        targetPartIds = [this.character.parts[0].id];
      }

      // トランスフォーム項目が消えないよう、パーツおよびトランスフォームの展開状態を確実に維持
      targetPartIds.forEach(pId => {
        this.expandedTimelineParts.add(pId);
        this.expandedTimelineTransforms.add(pId);
      });

      const allProps = ['pos', 'scale', 'rot', 'opacity'];

      if (mode === 'graph') {
        tabGraph?.classList.add('active');
        tabDope?.classList.remove('active');
        // 全プロパティを一括して60Fベジェ曲線グラフ表示にする
        targetPartIds.forEach(pId => {
          allProps.forEach(prop => {
            const key = `${pId}:${prop}`;
            this.inlineGraphProps.add(key);
            if (!this.propRowHeights.has(key) || this.propRowHeights.get(key) < 80) {
              this.propRowHeights.set(key, 90);
            }
          });
        });
      } else {
        tabDope?.classList.add('active');
        tabGraph?.classList.remove('active');
        // キーフレーム表示に戻す
        this.inlineGraphProps.clear();
      }

      this.renderTimeline();
    };

    tabDope?.addEventListener('click', () => switchTimelineTab('dopesheet'));
    tabGraph?.addEventListener('click', () => switchTimelineTab('graph'));

    // タイムライン ALL vs Only (選択中パーツのみ表示) フィルタ切替
    const btnFilterOnly = this.container.querySelector('#btnTlFilterOnly');
    const btnFilterAll = this.container.querySelector('#btnTlFilterAll');
    const updateFilterButtons = () => {
      btnFilterOnly?.classList.toggle('active', this.timelineFilterMode === 'only');
      btnFilterAll?.classList.toggle('active', this.timelineFilterMode === 'all');
    };
    btnFilterOnly?.addEventListener('click', () => {
      this.timelineFilterMode = 'only';
      updateFilterButtons();
      this.renderTimeline();
    });
    btnFilterAll?.addEventListener('click', () => {
      this.timelineFilterMode = 'all';
      updateFilterButtons();
      this.renderTimeline();
    });

    // グラフエディタのプロパティ選択 (後方互換)
    this.container.querySelector('#graphPropertySelect')?.addEventListener('change', (e) => {
      this.selectedGraphProperty = e.target.value;
      this.renderGraphEditor();
    });

    // イージングプリセットボタン
    this.container.querySelectorAll('.btn-preset-curve').forEach(btn => {
      btn.addEventListener('click', () => {
        const ease = btn.dataset.ease;
        const part = this.editor.getSelectedPart();
        const clip = this.character.animations?.[this.currentMotion];
        if (!part || !clip) return;
        const kfs = clip.tracks[part.id] || [];
        for (let i = 0; i < kfs.length - 1; i++) {
          if (ease === 'easeIn') kfs[i].bezier = [0.42, 0.0, 1.0, 1.0];
          else if (ease === 'easeOut') kfs[i].bezier = [0.0, 0.0, 0.58, 1.0];
          else if (ease === 'easeInOut') kfs[i].bezier = [0.42, 0.0, 0.58, 1.0];
          else if (ease === 'fastStart') kfs[i].bezier = [0.1, 0.9, 0.2, 1.0];
          else if (ease === 'linear') kfs[i].bezier = [0.0, 0.0, 1.0, 1.0];
        }
        this.updateAnimationFrame();
        this.renderGraphEditor();
      });
    });

    // タイムライン再生・停止
    const btnPlay = this.container.querySelector('#btnPlayPause');
    const scrubber = this.container.querySelector('#timelineScrubber');
    const motionSelect = this.container.querySelector('#motionSelect');

    motionSelect.addEventListener('change', (e) => {
      this.currentMotion = e.target.value;
      this.currentFrame = 0;
      scrubber.value = 0;
      this.updateTimeDisplay();
      this.updateAnimationFrame();
      this.renderTimeline();
    });

    btnPlay.addEventListener('click', () => {
      this.isPlaying = !this.isPlaying;
      btnPlay.innerText = this.isPlaying ? '⏸ 停止' : '▶ 再生';
      btnPlay.classList.toggle('playing', this.isPlaying);
      this.editor.isPlayingAnim = this.isPlaying;

      if (this.isPlaying) {
        this.lastFrameTimestamp = performance.now();
        this.animLoop();
      } else {
        if (this.animRafId) cancelAnimationFrame(this.animRafId);
        this.editor.setAnimationPose(new Map());
        this.updateInspectorPreview();
      }
    });

    scrubber.addEventListener('input', (e) => {
      this.currentFrame = parseInt(e.target.value, 10);
      this.updateTimeDisplay();
      this.updateAnimationFrame();
      if (this.timelineMode === 'graph') this.renderGraphEditor();
    });

    // 自動キーフレームボタン (Auto-Keyframe: A)
    const btnAutoKeyframe = this.container.querySelector('#btnAutoKeyframe');
    if (btnAutoKeyframe) {
      btnAutoKeyframe.addEventListener('click', () => {
        this.isAutoKeyframe = !this.isAutoKeyframe;
        btnAutoKeyframe.classList.toggle('active', this.isAutoKeyframe);
        btnAutoKeyframe.title = `自動キーフレーム (Auto-Keyframe): ${this.isAutoKeyframe ? 'ON' : 'OFF'} (ショートカット: A)`;
      });
    }

    // キーフレーム追加 (現在フレーム)
    this.container.querySelector('#btnAddKeyframe').addEventListener('click', () => {
      const part = this.editor.getSelectedPart();
      if (!part) {
        alert('キーフレームを追加するパーツを選択してください');
        return;
      }
      const clip = this.character.animations[this.currentMotion];
      if (!clip) return;
      if (!clip.tracks[part.id]) clip.tracks[part.id] = [];

      const timeNorm = this.currentFrame / 60;
      const existing = clip.tracks[part.id].find(k => Math.round(k.time * 60) === this.currentFrame);
      if (existing) {
        existing.time = timeNorm;
      } else {
        clip.tracks[part.id].push({
          time: timeNorm,
          tx: 0, ty: 0, rot: 0, sx: 1, sy: 1, op: 1,
          bezier: [0.42, 0.0, 0.58, 1.0]
        });
        clip.tracks[part.id].sort((a, b) => a.time - b.time);
      }
      this.updateAnimationFrame();
      this.renderTimeline();
    });

    // キーフレーム削除ボタン
    this.container.querySelector('#btnDeleteKeyframe')?.addEventListener('click', () => {
      this.deleteSelectedKeyframes();
    });

    // Delete / Backspace キーでの選択キーフレーム一括削除
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const activeTag = document.activeElement?.tagName?.toLowerCase();
        if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;
        if (this.deleteSelectedKeyframes()) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    });

    // ── 全キャラ一括出力 (JSON) ──
    this.container.querySelector('#btnExportPackJson')?.addEventListener('click', () => {
      this.exportAllCharactersPack();
    });

    // ── 全キャラ一括読込 (JSON) ──
    this.container.querySelector('#btnImportPackJson')?.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const data = JSON.parse(ev.target.result);
            this.importCharactersJson(data);
          } catch (err) {
            alert('JSONの読み込みに失敗しました: ' + (err.message || err));
          }
        };
        reader.readAsText(file);
      };
      input.click();
    });

    // ── 単体キャラ JSON 出力 ──
    this.container.querySelector('#btnExportJson')?.addEventListener('click', () => {
      const str = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.character, null, 2));
      const a = document.createElement('a');
      a.href = str;
      a.download = `${this.character.id}_vector_rig.json`;
      a.click();
    });

    // ── SVG エクスポート ──
    this.container.querySelector('#btnExportSvg')?.addEventListener('click', () => {
      const svgData = this.editor.svg.outerHTML;
      const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.character.id}.svg`;
      a.click();
    });

    // ── 単体キャラ JSON 読み込み ──
    this.container.querySelector('#btnImportJson')?.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const data = JSON.parse(ev.target.result);
            this.importCharactersJson(data);
          } catch (err) {
            alert('JSONの読み込みに失敗しました: ' + (err.message || err));
          }
        };
        reader.readAsText(file);
      };
      input.click();
    });

    // ── メインキャラ選択プルダウン ──
    const presetSelect = this.container.querySelector('#studioPresetSelect');
    presetSelect?.addEventListener('change', (e) => {
      this.loadPresetById(e.target.value);
    });

    // ── ➕ 新規追加 ＆ ベース骨格プリセット選択モーダル ──
    const presetPickerModal = this.container.querySelector('#presetPickerModal');
    this.container.querySelector('#btnStudioNewChar')?.addEventListener('click', () => {
      presetPickerModal?.classList.remove('hidden');
    });

    this.container.querySelector('#btnClosePresetPicker')?.addEventListener('click', () => {
      presetPickerModal?.classList.add('hidden');
    });
    this.container.querySelector('#btnCancelPresetPicker')?.addEventListener('click', () => {
      presetPickerModal?.classList.add('hidden');
    });

    presetPickerModal?.querySelectorAll('.preset-card').forEach(card => {
      card.addEventListener('click', () => {
        const presetKey = card.dataset.preset;
        if (!presetKey) return;

        const defaultNames = {
          hirame: 'オリジナルヒラメ',
          karei: 'オリジナルカレイ',
          octopus: 'オリジナルタコ',
          squid: 'オリジナルイカ',
          stingray: 'オリジナルエイ',
          aji_open: 'オリジナルアジの開き',
          shitabirame: 'オリジナルウシノシタ',
          human: 'オリジナル人間キャラ',
          quadruped: 'オリジナル４足歩行キャラ',
          biped: 'オリジナル２足歩行キャラ',
          insect: 'オリジナル昆虫キャラ',
          spider: 'オリジナル蜘蛛キャラ',
          bird: 'オリジナル鳥キャラ',
          kanji_hirame: '漢字「鮃」',
          kanji_karei_1: '漢字「鰈」',
          kanji_karei_2: '漢字「魪」',
          blank: '白紙オリジナル'
        };

        const defaultName = defaultNames[presetKey] || 'オリジナル新キャラ';
        const name = prompt('新規キャラクター名を入力してください:', defaultName);
        if (!name || !name.trim()) return;

        let newChar;
        if (presetKey === 'blank') {
          newChar = {
            id: `custom_${Date.now()}`,
            name: name.trim(),
            species: 'custom',
            facing: 1,
            parts: [
              createPart({
                id: 'part_body_base',
                name: 'ベース本体',
                type: 'body',
                zIndex: 10,
                closed: true,
                points: [
                  { x: -50, y: -30, handleIn: null, handleOut: null },
                  { x: 50, y: -30, handleIn: null, handleOut: null },
                  { x: 50, y: 30, handleIn: null, handleOut: null },
                  { x: -50, y: 30, handleIn: null, handleOut: null }
                ],
                style: { fill: '#38bdf8', stroke: '#0284c7', strokeWidth: 2, opacity: 1 }
              })
            ],
            animations: {
              swim: { duration: 1.0, loop: true, tracks: {} },
              idle: { duration: 1.0, loop: true, tracks: {} },
              tap: { duration: 0.5, loop: false, tracks: {} }
            }
          };
        } else if (BASE_PRESETS[presetKey]) {
          newChar = BASE_PRESETS[presetKey]();
          newChar.id = `custom_${Date.now()}`;
          newChar.name = name.trim();
        } else {
          newChar = getHiramePreset();
          newChar.id = `custom_${Date.now()}`;
          newChar.name = name.trim();
        }

        const roster = this.getRoster();
        roster[newChar.id] = newChar;
        this.saveRoster(roster);
        this.character = newChar;
        this.editor.setCharacter(this.character);
        this.updatePresetSelectOptions();

        // マイカスタムのビンへ自動登録し、ビンを展開・表示
        this.registerToCustomBin(newChar.id);
        this.switchSidebarTab('bins');
        this.updateActiveBinBreadcrumb();

        this.renderLayerTree();
        this.renderInspector();
        this.renderTimeline();
        this.updateInspectorPreview();

        presetPickerModal?.classList.add('hidden');
        alert(`新規キャラクター「${newChar.name}」を作成し、マイカスタムに登録しました！`);
      });
    });

    // ── 💾 上書き保存 ──
    this.container.querySelector('#btnStudioOverwrite')?.addEventListener('click', () => {
      if (!this.character) return;
      const roster = this.getRoster();
      const curId = this.character.id;
      roster[curId] = JSON.parse(JSON.stringify(this.character));
      localStorage.setItem('hirame_custom_character', JSON.stringify(this.character));
      this.saveRoster(roster);
      this.updatePresetSelectOptions();
      alert(`「${this.character.name}」を上書き保存し、ゲーム本体に即時適用しました！`);
    });

    // ── ✨ 新規登録 ──
    this.container.querySelector('#btnStudioRegisterNew')?.addEventListener('click', () => {
      if (!this.character) return;
      const defaultName = (this.character.name || 'カスタム魚') + ' (別名保存)';
      const name = prompt('新規登録するキャラクター名を入力してください:', defaultName);
      if (!name || !name.trim()) return;

      const newId = `custom_${Date.now()}`;
      this.character.id = newId;
      this.character.name = name.trim();

      const roster = this.getRoster();
      roster[newId] = JSON.parse(JSON.stringify(this.character));
      localStorage.setItem('hirame_custom_character', JSON.stringify(this.character));
      this.saveRoster(roster);
      this.updatePresetSelectOptions();
      this.editor.setCharacter(this.character);

      // ビンへ自動登録 (マイカスタム)
      let customBin = this.bins.find(b => b.id === 'bin_custom');
      if (!customBin) {
        customBin = { id: 'bin_custom', name: 'マイカスタム', isOpen: true, charIds: [] };
        this.bins.push(customBin);
      }
      if (!customBin.charIds.includes(newId)) {
        customBin.charIds.push(newId);
      }
      this.saveBins(this.bins);
      this.renderBinTree();
      this.updateActiveBinBreadcrumb();

      this.renderLayerTree();
      this.renderInspector();
      this.updateInspectorPreview();
      alert(`新規キャラクター「${this.character.name}」として登録し、ゲーム本体に適用しました！`);
    });

    // ── 🗑️ 削除 ──
    this.container.querySelector('#btnStudioDeleteChar')?.addEventListener('click', () => {
      if (!this.character) return;
      const curId = this.character.id;
      const baseKeys = Object.keys(BASE_PRESETS);
      const roster = this.getRoster();

      if (baseKeys.includes(curId)) {
        if (roster[curId]) {
          if (confirm(`「${this.character.name}」のカスタム上書きデータを削除し、初期公式プリセットに戻しますか？`)) {
            delete roster[curId];
            this.saveRoster(roster);
            this.loadPresetById(curId);
            this.updatePresetSelectOptions();
            this.renderBinTree();
            this.updateActiveBinBreadcrumb();
            alert(`「${this.character.name}」を公式初期プリセットに戻しました。`);
          }
        } else {
          alert('公式基本キャラクターは削除できません（カスタム上書き保存がある場合のみ初期化できます）。');
        }
      } else {
        if (confirm(`カスタムキャラクター「${this.character.name}」を完全に削除しますか？`)) {
          delete roster[curId];
          this.saveRoster(roster);
          this.bins.forEach(b => {
            if (b.charIds) b.charIds = b.charIds.filter(id => id !== curId);
          });
          this.saveBins(this.bins);
          this.loadPresetById('hirame');
          this.updatePresetSelectOptions();
          this.renderBinTree();
          this.updateActiveBinBreadcrumb();
          alert('キャラクターを削除しました。');
        }
      }
    });

    // ── 🎮 ゲームに適用 & 保存モーダル制御 ──
    const saveModal = this.container.querySelector('#saveCharacterModal');
    const overwriteSelect = this.container.querySelector('#saveOverwriteTargetSelect');
    const newNameInput = this.container.querySelector('#saveNewCharName');

    const openSaveModal = () => {
      if (!saveModal) return;
      // 既存キャラ選択肢を最新ロスターに合わせて再生成
      const roster = this.getRoster();
      let optHtml = `
        <optgroup label="🐟 水生生物">
          <option value="hirame">🐟 ヒラメ (ターゲット・左向き)</option>
          <option value="karei">🐟 カレイ (ターゲット・右向き)</option>
          <option value="octopus">🐙 タコ (邪魔キャラ・墨吐き)</option>
          <option value="squid">🦑 イカ (邪魔キャラ・高速ジェット)</option>
          <option value="stingray">🌊 エイ (邪魔キャラ・巨大影)</option>
          <option value="aji_open">🐟 アジの開き (罠・干物ボーン)</option>
          <option value="shitabirame">👞 ウシノシタ (舌平目・靴底型)</option>
        </optgroup>
        <optgroup label="🧬 多様体・新骨格">
          <option value="human">🧍 人間 (頭部・胴体・手足)</option>
          <option value="quadruped">🐕 ４足歩行 (トロット・尻尾)</option>
          <option value="biped">🦖 ２足歩行 (大顎・強靭脚)</option>
          <option value="insect">🪲 昆虫 (クワガタ・大顎・6本足)</option>
          <option value="spider">🕷️ 蜘蛛 (8眼・8足波状歩行)</option>
          <option value="bird">🦅 鳥 (青い鳥・羽ばたき)</option>
        </optgroup>
        <optgroup label="🌟 スペシャルキャラクター">
          <option value="boo_chan">🐷 ぶーちゃん (豚顔イルカ・スペシャル)</option>
        </optgroup>
        <optgroup label="🔤 漢字キャラクター">
          <option value="kanji_hirame">鮃 漢字・鮃 (ヒラメ)</option>
          <option value="kanji_karei_1">鰈 漢字・鰈 (カレイ)</option>
          <option value="kanji_karei_2">魪 漢字・魪 (カレイ・魪)</option>
        </optgroup>
      `;
      const baseKeys = Object.keys(BASE_PRESETS);
      const customKeys = Object.keys(roster).filter(k => !baseKeys.includes(k));
      if (customKeys.length > 0) {
        optHtml += `<optgroup label="✨ カスタム登録キャラ">`;
        for (const k of customKeys) {
          const c = roster[k];
          optHtml += `<option value="${k}">✨ ${c.name || k}</option>`;
        }
        optHtml += `</optgroup>`;
      }
      overwriteSelect.innerHTML = optHtml;

      // 現在のIDに合致するものを自動選択
      if (this.character && this.character.id) {
        overwriteSelect.value = this.character.id;
      }
      if (newNameInput) {
        newNameInput.value = this.character ? this.character.name : '';
      }
      saveModal.classList.remove('hidden');
    };

    const closeSaveModal = () => saveModal?.classList.add('hidden');

    this.container.querySelector('#btnApplyToGame')?.addEventListener('click', openSaveModal);
    this.container.querySelector('#btnCloseSaveModal')?.addEventListener('click', closeSaveModal);
    this.container.querySelector('#btnCancelSave')?.addEventListener('click', closeSaveModal);
    saveModal?.addEventListener('click', (e) => {
      if (e.target === saveModal) closeSaveModal();
    });

    // 保存＆ゲーム適用実行
    this.container.querySelector('#btnConfirmSave')?.addEventListener('click', () => {
      const mode = this.container.querySelector('input[name="saveModeRadio"]:checked')?.value || 'overwrite';
      const roster = this.getRoster();

      if (mode === 'overwrite') {
        const targetId = overwriteSelect.value;
        const targetName = overwriteSelect.options[overwriteSelect.selectedIndex]?.text || targetId;
        this.character.id = targetId;
        roster[targetId] = JSON.parse(JSON.stringify(this.character));
        localStorage.setItem('hirame_custom_character', JSON.stringify(this.character));
        this.saveRoster(roster);
        this.updatePresetSelectOptions();
        closeSaveModal();
        alert(`「${this.character.name}」を【${targetName}】に上書き保存し、ゲーム本体に適用しました！`);
      } else {
        const nameVal = newNameInput?.value.trim() || `新規カスタム魚_${Date.now().toString().slice(-4)}`;
        const newId = `custom_${Date.now()}`;
        this.character.id = newId;
        this.character.name = nameVal;
        roster[newId] = JSON.parse(JSON.stringify(this.character));
        localStorage.setItem('hirame_custom_character', JSON.stringify(this.character));
        this.saveRoster(roster);
        this.updatePresetSelectOptions();
        closeSaveModal();
        alert(`新規キャラクター「${nameVal}」として登録し、プリセットに追加＆ゲーム本体に適用しました！`);
      }
    });

    // ── 背景演出オブジェクトとして登録 ──
    this.container.querySelector('#btnRegisterAmbientPreset')?.addEventListener('click', () => {
      const nameVal = prompt('背景演出プリセットの名前を入力してください:', `${this.character.name || 'カスタム素材'} (背景演出)`);
      if (!nameVal) return;
      const isTranslucent = confirm('白系半透明モード（幽霊・浮遊感のある演出）を有効にしますか？\n[OK]: 半透明ホワイト / [キャンセル]: 通常カラー');

      let devCfg = {};
      try {
        devCfg = JSON.parse(localStorage.getItem('hirame_dev_config') || '{}');
      } catch (e) {}

      if (!devCfg.ambientConfig) {
        devCfg.ambientConfig = {
          enabled: true,
          bubbles: { enabled: true, count: 30 },
          smallFish: { enabled: true, count: 15 },
          presets: []
        };
      }
      if (!Array.isArray(devCfg.ambientConfig.presets)) {
        devCfg.ambientConfig.presets = [];
      }

      const newPreset = {
        id: `studio_${Date.now()}`,
        name: nameVal,
        enabled: true,
        type: 'custom',
        count: 5,
        speed: 0.5,
        isWhiteTranslucent: isTranslucent,
        studioModel: JSON.parse(JSON.stringify(this.character))
      };

      devCfg.ambientConfig.presets.push(newPreset);
      localStorage.setItem('hirame_dev_config', JSON.stringify(devCfg));

      if (window.adminChannel) {
        window.adminChannel.postMessage({ type: 'UPDATE_DEV_CONFIG', config: devCfg, timestamp: Date.now() });
      }
      if (typeof window.renderAmbientManager === 'function') {
        window.renderAmbientManager();
      }
      alert(`背景演出プリセット「${nameVal}」を登録しました！\n「🫧 背景演出」サブタブやゲーム本体の水槽で確認できます。`);
    });

    // ── ツールバー折りたたみ ──
    this.container.querySelectorAll('.group-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const groupId = btn.dataset.target;
        const group = this.container.querySelector(`#${groupId}`);
        if (!group) return;
        const isCollapsed = group.classList.toggle('collapsed');
        btn.textContent = isCollapsed ? '▸' : '▾';
      });
    });

    // ── ショートカットモーダル ＆ 別窓ポップアップ制御 ──
    const modal = this.container.querySelector('#shortcutsModal');
    const openModal = () => modal?.classList.remove('hidden');
    const closeModal = () => modal?.classList.add('hidden');
    const openNewWindow = () => {
      window.open('/shortcuts.html', 'studio_shortcuts_window', 'width=920,height=800,scrollbars=yes,resizable=yes');
    };

    this.container.querySelector('#btnOpenShortcuts')?.addEventListener('click', openModal);
    this.container.querySelector('#btnCloseShortcuts')?.addEventListener('click', closeModal);
    this.container.querySelector('#btnOpenNewWindow')?.addEventListener('click', openNewWindow);
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    const selectTool = (toolName) => {
      this.selectStudioTool(toolName);
    };

    // ── 下絵トレース制御 ──
    const traceSelect = this.container.querySelector('#tracePresetSelect');
    const traceOpacitySlider = this.container.querySelector('#traceOpacitySlider');
    const traceOpacityVal = this.container.querySelector('#traceOpacityVal');

    const updateTrace = () => {
      const val = traceSelect?.value;
      const op = parseFloat(traceOpacitySlider?.value || 35) / 100;
      if (!val) {
        this.editor.setTraceCharacter(null, op);
      } else {
        const presetGetter = BASE_PRESETS[val];
        if (presetGetter) {
          const char = presetGetter();
          this.editor.setTraceCharacter(char, op);
        }
      }
    };

    traceSelect?.addEventListener('change', updateTrace);
    const traceOpacityNum = this.container.querySelector('#traceOpacityNum');
    const updateTraceOpacity = (val) => {
      const num = Math.max(0, Math.min(100, parseInt(val, 10) || 0));
      const op = num / 100;
      if (traceOpacitySlider && parseInt(traceOpacitySlider.value, 10) !== num) traceOpacitySlider.value = num;
      if (traceOpacityNum && parseInt(traceOpacityNum.value, 10) !== num) traceOpacityNum.value = num;
      this.editor.setTraceOpacity(op);
    };
    traceOpacitySlider?.addEventListener('input', (e) => updateTraceOpacity(e.target.value));
    traceOpacityNum?.addEventListener('input', (e) => updateTraceOpacity(e.target.value));

    const traceForegroundCheck = this.container.querySelector('#traceForegroundCheck');
    traceForegroundCheck?.addEventListener('change', (e) => {
      this.editor.setTraceForeground(e.target.checked);
    });

    // ── 全体キーボードショートカット (Photoshop互換 ＆ キーフレームコピペ) ──
    window.addEventListener('keydown', (e) => {
      // AI生成ツールが開いている時はスタジオのショートカットをバイパス（Ctrl+V画像貼り付けを正常動作させる）
      if (this.aiGenerator && this.aiGenerator.isOpen && this.aiGenerator.isOpen()) {
        if (e.key === 'Escape') {
          this.aiGenerator.close();
        }
        return;
      }

      // 新規作成プリセット選択モーダルが開いている時
      const presetPickerModal = this.container.querySelector('#presetPickerModal');
      if (presetPickerModal && !presetPickerModal.classList.contains('hidden')) {
        if (e.key === 'Escape') {
          presetPickerModal.classList.add('hidden');
        }
        return;
      }

      const isInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT';

      // Esc: モーダルを閉じる
      if (e.key === 'Escape') {
        closeModal();
        return;
      }

      // F1 または ?: ショートカット一覧モーダル表示
      if (e.key === 'F1' || (e.key === '?' && !isInput)) {
        e.preventDefault();
        openModal();
        return;
      }

      if (isInput) return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl+S: ゲーム本体へリアルタイム保存・適用
      if (cmdOrCtrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.container.querySelector('#btnApplyToGame')?.click();
        return;
      }

      // Ctrl+C: 選択中キーフレーム または 選択中レイヤーのコピー
      if (cmdOrCtrl && e.key.toLowerCase() === 'c') {
        if (this.selectedKeyframe && this.selectedKeyframe.kf) {
          e.preventDefault();
          this.clipboardKeyframe = { ...this.selectedKeyframe.kf };
          return;
        }
        if (this.copySelectedLayers()) {
          e.preventDefault();
          return;
        }
      }

      // Ctrl+V: キーフレーム または レイヤーの貼り付け (追加)
      if (cmdOrCtrl && e.key.toLowerCase() === 'v') {
        if (this.selectedKeyframe && this.clipboardKeyframe) {
          e.preventDefault();
          const part = this.editor.getSelectedPart();
          const clip = this.character.animations?.[this.currentMotion];
          if (part && clip) {
            if (!clip.tracks[part.id]) clip.tracks[part.id] = [];
            const pasteTime = Math.round(this.currentFrame) / 60;
            const newKf = { ...this.clipboardKeyframe, time: pasteTime };
            const tr = clip.tracks[part.id];
            const existingIdx = tr.findIndex(k => Math.abs(k.time - pasteTime) < 0.005);
            if (existingIdx !== -1) {
              tr[existingIdx] = newKf;
            } else {
              tr.push(newKf);
            }
            tr.sort((a, b) => a.time - b.time);
            this.selectedKeyframe = { partId: part.id, kf: newKf };
            this.updateAnimationFrame();
            this.renderTimeline();
            return;
          }
        }
        if (this.pasteLayers()) {
          e.preventDefault();
          return;
        }
      }

      // Delete / Backspace: 選択中キーフレーム または 選択中レイヤーの削除
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this.deleteSelectedKeyframes()) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        const selectedParts = this.editor.getSelectedParts();
        if (selectedParts.length > 0 && this.character.parts.length > 1) {
          e.preventDefault();
          this.editor.pushState();
          const deleteIds = new Set(selectedParts.map(p => p.id));
          this.character.parts = this.character.parts.filter(p => !deleteIds.has(p.id));
          if (this.character.parts.length === 0) {
            this.character.parts.push(createPart({ id: 'part_1', name: 'パーツ 1' }));
          }
          this.editor.selectedPartIds.clear();
          this.editor.selectedPartId = this.character.parts[0].id;
          this.editor.selectedPartIds.add(this.character.parts[0].id);
          this.editor.render();
          this.updateInspectorPreview();
          this.renderLayerTree();
          this.renderInspector();
          this.renderTimeline();
          return;
        }
      }

      // Ctrl+T: 自由変形 / スケールモード
      if (cmdOrCtrl && e.key.toLowerCase() === 't') {
        e.preventDefault();
        if (this.editor.isTransformMode) {
          this.editor.commitTransform();
        } else {
          this.editor.previousToolBeforeTransform = this.editor.currentTool;
          this.editor.toggleTransformMode(true);
        }
        return;
      }

      // Ctrl+E: 複数レイヤー結合 / 下のレイヤーと結合
      if (cmdOrCtrl && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        this.editor.mergeSelectedLayers();
        this.renderLayerTree();
        this.renderInspector();
        this.updateInspectorPreview();
        return;
      }

      // 他の修飾キー付きはエディタ本体に任せる
      if (cmdOrCtrl || e.altKey) return;

      const key = e.key.toLowerCase();
      switch (key) {
        case 'v':
          e.preventDefault();
          selectTool('select');
          break;
        case 'm':
          e.preventDefault();
          selectTool('marquee');
          break;
        case 'a':
          e.preventDefault();
          selectTool('direct_select');
          break;
        case 'p':
          e.preventDefault();
          selectTool('pen');
          break;
        case 'c':
          e.preventDefault();
          selectTool('curvature');
          break;
        case 'r':
        case 'u':
          e.preventDefault();
          selectTool('rect');
          break;
        case 'e':
          e.preventDefault();
          selectTool('ellipse');
          break;
        case 't':
          e.preventDefault();
          selectTool('triangle');
          break;
        case 'h':
          e.preventDefault();
          selectTool('pan');
          break;
        case 'z':
          e.preventDefault();
          selectTool('zoom');
          break;
        case '[':
        case ']': {
          const part = this.editor.getSelectedPart();
          if (part && part.style) {
            e.preventDefault();
            this.editor.pushState();
            const cur = part.style.strokeWidth ?? 1;
            const delta = key === ']' ? 1 : -1;
            part.style.strokeWidth = Math.max(0, cur + delta);
            this.editor.render();
            this.renderInspector();
            this.updateInspectorPreview();
          }
          break;
        }
      }
    });

    // ── パネルリサイザー ──
    this.initPanelResizers();
  }

  initPanelResizers() {
    const workstation = this.container.querySelector('.studio-workstation');
    const leftSidebar  = this.container.querySelector('.left-sidebar');
    const rightSidebar = this.container.querySelector('#rightSidebar');
    const timeline     = this.container.querySelector('#studioTimeline');

    // 1. 左パネルリサイザー (ew-resize: 右へドラッグで広げる)
    const resizerL = this.container.querySelector('#resizerLeft');
    if (resizerL && leftSidebar) {
      let startX = 0, startW = 0;
      resizerL.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        startX = e.clientX;
        startW = leftSidebar.offsetWidth;
        resizerL.setPointerCapture(e.pointerId);
        document.body.style.cursor = 'ew-resize';
      });
      resizerL.addEventListener('pointermove', (e) => {
        if (!resizerL.hasPointerCapture(e.pointerId)) return;
        const newW = Math.max(60, Math.min(800, startW + (e.clientX - startX)));
        leftSidebar.style.width = `${newW}px`;
      });
      resizerL.addEventListener('pointerup', () => { document.body.style.cursor = ''; });
    }

    // 2. 右パネルリサイザー (ew-resize: 左へドラッグで広げる、右へドラッグで狭める)
    const resizerR = this.container.querySelector('#resizerRight');
    if (resizerR && rightSidebar) {
      let startX = 0, startW = 0;
      resizerR.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        startX = e.clientX;
        startW = rightSidebar.offsetWidth;
        resizerR.setPointerCapture(e.pointerId);
        document.body.style.cursor = 'ew-resize';
      });
      resizerR.addEventListener('pointermove', (e) => {
        if (!resizerR.hasPointerCapture(e.pointerId)) return;
        // 右側パネルなので左方向へのドラッグ (startX - e.clientX > 0) で幅拡大
        const newW = Math.max(60, Math.min(800, startW + (startX - e.clientX)));
        rightSidebar.style.width = `${newW}px`;
      });
      resizerR.addEventListener('pointerup', () => { document.body.style.cursor = ''; });
    }

    // 3. ナビゲーターとプロパティの上下リサイザー (ns-resize)
    const resizerNavV = this.container.querySelector('#resizerNavVertical');
    const navCard     = this.container.querySelector('#psNavigatorCard');
    if (resizerNavV && navCard) {
      let startY = 0, startH = 0;
      resizerNavV.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        startY = e.clientY;
        startH = navCard.offsetHeight;
        resizerNavV.setPointerCapture(e.pointerId);
        document.body.style.cursor = 'ns-resize';
      });
      resizerNavV.addEventListener('pointermove', (e) => {
        if (!resizerNavV.hasPointerCapture(e.pointerId)) return;
        const delta = e.clientY - startY;
        const newH = Math.max(28, Math.min(650, startH + delta));
        navCard.style.height = `${newH}px`;
        const navStage = navCard.querySelector('.ps-nav-stage');
        if (navStage) {
          navStage.style.height = `${Math.max(30, newH - 85)}px`;
        }
      });
      resizerNavV.addEventListener('pointerup', () => { document.body.style.cursor = ''; });
    }

    // プロパティ (インスペクター) タブ切替バインド
    const inspTabNav = this.container.querySelector('#inspectorTabNav');
    if (inspTabNav) {
      inspTabNav.addEventListener('click', (e) => {
        const btn = e.target.closest('.inspector-tab-btn');
        if (!btn || !btn.dataset.tab) return;
        this.activeInspectorTab = btn.dataset.tab;
        inspTabNav.querySelectorAll('.inspector-tab-btn').forEach(b => {
          b.classList.toggle('active', b === btn);
        });
        this.renderInspector();
      });
    }

    // 4. タイムライン上下リサイザー (ns-resize: キャンバスエリアとモーションエリアの境界線)
    // 境界線を掴んで上方向にドラッグすると、上のキャンバスUIがY方向に狭くなり、下のモーションエディターが上に拡がる
    const resizerT = this.container.querySelector('#resizerTimeline');
    if (resizerT && timeline) {
      let startY = 0, startH = 0;
      resizerT.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        startY = e.clientY;
        startH = timeline.offsetHeight;
        resizerT.setPointerCapture(e.pointerId);
        document.body.style.cursor = 'ns-resize';
      });
      resizerT.addEventListener('pointermove', (e) => {
        if (!resizerT.hasPointerCapture(e.pointerId)) return;
        const dy = e.clientY - startY;
        const workstation = this.container.querySelector('.studio-workstation');
        const maxTimelineH = Math.max(100, (workstation ? workstation.clientHeight : window.innerHeight) - 160);
        const newH = Math.max(36, Math.min(maxTimelineH, startH - dy));
        timeline.style.height = `${newH}px`;
        timeline.style.maxHeight = `${maxTimelineH}px`;

        // タイムラインの高さに合わせて独立外側スクロールバーを再同期
        this.initExternalScrollbar();
        // キャンバスのサイズ変化に応じて描画を更新
        if (this.editor) {
          this.editor.resize?.();
        }
      });
      resizerT.addEventListener('pointerup', () => { document.body.style.cursor = ''; });
    }

    // 5. タイムライン左右スプリットリサイザー (ew-resize: 左側トランスフォーム項目幅の左右ドラッグ変更)
    const splitResizer = this.container.querySelector('#tlSplitResizer');
    const leftPane = this.container.querySelector('#tlLeftPane');
    if (splitResizer && leftPane) {
      let startX = 0, startW = 0;
      splitResizer.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        startX = e.clientX;
        startW = leftPane.offsetWidth;
        splitResizer.setPointerCapture(e.pointerId);
        splitResizer.classList.add('resizing');
        document.body.style.cursor = 'col-resize';
      });
      splitResizer.addEventListener('pointermove', (e) => {
        if (!splitResizer.hasPointerCapture(e.pointerId)) return;
        const newW = Math.max(160, Math.min(900, startW + (e.clientX - startX)));
        leftPane.style.width = `${newW}px`;
        this.timelineLeftPaneWidth = newW;
      });
      splitResizer.addEventListener('pointerup', () => {
        splitResizer.classList.remove('resizing');
        document.body.style.cursor = '';
      });
    }

    // 6. タイムライン下端リサイザー (ns-resize: 下方向へ自由に縦幅を拡大)
    const resizerB = this.container.querySelector('#resizerTimelineBottom');
    if (resizerB && timeline) {
      let startY = 0, startH = 0;
      resizerB.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        startY = e.clientY;
        startH = timeline.offsetHeight;
        resizerB.setPointerCapture(e.pointerId);
        resizerB.classList.add('resizing');
        document.body.style.cursor = 'ns-resize';
      });
      resizerB.addEventListener('pointermove', (e) => {
        if (!resizerB.hasPointerCapture(e.pointerId)) return;
        const dy = e.clientY - startY;
        const newH = Math.max(100, Math.min(3000, startH + dy));
        timeline.style.height = `${newH}px`;
        timeline.style.maxHeight = 'none';
        this.initExternalScrollbar();
      });
      resizerB.addEventListener('pointerup', () => {
        resizerB.classList.remove('resizing');
        document.body.style.cursor = '';
      });
    }
  }


  // アニメーション再生ループ (60FPS基準)
  animLoop() {
    if (!this.isPlaying) return;

    const now = performance.now();
    const dt = (now - this.lastFrameTimestamp) / 1000;
    this.lastFrameTimestamp = now;

    const framesToAdvance = dt * 60;
    this.currentFrame = (this.currentFrame + framesToAdvance) % 60;

    const scrubber = this.container.querySelector('#timelineScrubber');
    if (scrubber) scrubber.value = Math.round(this.currentFrame);
    this.updateTimeDisplay();

    this.updateAnimationFrame();
    this.updatePlayhead();

    this.animRafId = requestAnimationFrame(() => this.animLoop());
  }

  updateAnimationFrame() {
    const clip = this.character.animations?.[this.currentMotion];
    const norm = Math.max(0, Math.min(1, this.currentFrame / this.totalFrames));

    const transforms = resolveRigTransforms(this.character.parts, clip, norm);
    this.editor.setAnimationPose(transforms);
    this.updateInspectorPreview();
  }

  // ========================================================
  // Photoshop互換 メニューバー イベント処理
  // ========================================================
  bindMenuBarEvents() {
    const menuBar = this.container.querySelector('#studioMenuBar');
    if (!menuBar) return;

    const rootItems = menuBar.querySelectorAll('.menu-item-root');

    const closeAllMenus = () => {
      rootItems.forEach(item => item.classList.remove('open'));
    };

    rootItems.forEach(item => {
      const btn = item.querySelector('.menu-btn-root');
      btn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = item.classList.contains('open');
        closeAllMenus();
        if (!isOpen) item.classList.add('open');
      });

      item.addEventListener('mouseenter', () => {
        const anyOpen = Array.from(rootItems).some(i => i.classList.contains('open'));
        if (anyOpen) {
          closeAllMenus();
          item.classList.add('open');
        }
      });
    });

    window.addEventListener('click', (e) => {
      if (!e.target.closest('.menu-item-root')) {
        closeAllMenus();
      }
    });

    // ── メニュー各項目のクリック割り当て ──
    // ファイル
    this.container.querySelector('#menuItemNewChar')?.addEventListener('click', () => {
      closeAllMenus();
      this.container.querySelector('#btnStudioNewChar')?.click();
    });
    this.container.querySelector('#menuItemImportJson')?.addEventListener('click', () => {
      closeAllMenus();
      this.container.querySelector('#btnImportJson')?.click();
    });
    this.container.querySelector('#menuItemImportPackJson')?.addEventListener('click', () => {
      closeAllMenus();
      this.container.querySelector('#btnImportPackJson')?.click();
    });
    this.container.querySelector('#menuItemOverwrite')?.addEventListener('click', () => {
      closeAllMenus();
      this.container.querySelector('#btnStudioOverwrite')?.click();
    });
    this.container.querySelector('#menuItemRegisterNew')?.addEventListener('click', () => {
      closeAllMenus();
      this.container.querySelector('#btnStudioRegisterNew')?.click();
    });
    this.container.querySelector('#menuItemExportPackJson')?.addEventListener('click', () => {
      closeAllMenus();
      this.container.querySelector('#btnExportPackJson')?.click();
    });
    this.container.querySelector('#menuItemExportJson')?.addEventListener('click', () => {
      closeAllMenus();
      this.container.querySelector('#btnExportJson')?.click();
    });
    this.container.querySelector('#menuItemExportSvg')?.addEventListener('click', () => {
      closeAllMenus();
      this.container.querySelector('#btnExportSvg')?.click();
    });
    this.container.querySelector('#menuItemRegisterAmbient')?.addEventListener('click', () => {
      closeAllMenus();
      this.container.querySelector('#btnRegisterAmbientPreset')?.click();
    });

    // 編集
    this.container.querySelector('#menuItemUndo')?.addEventListener('click', () => {
      closeAllMenus();
      this.container.querySelector('#btnUndo')?.click();
    });
    this.container.querySelector('#menuItemRedo')?.addEventListener('click', () => {
      closeAllMenus();
      this.container.querySelector('#btnRedo')?.click();
    });
    this.container.querySelector('#menuItemDuplicatePart')?.addEventListener('click', () => {
      closeAllMenus();
      this.duplicatePart();
    });
    this.container.querySelector('#menuItemDeletePart')?.addEventListener('click', () => {
      closeAllMenus();
      if (this.editor.selectedPartId) {
        this.editor.deletePart(this.editor.selectedPartId);
        this.renderLayerTree();
        this.renderInspector();
        this.updateInspectorPreview();
      }
    });
    this.container.querySelector('#menuItemDeleteChar')?.addEventListener('click', () => {
      closeAllMenus();
      this.container.querySelector('#btnStudioDeleteChar')?.click();
    });
    this.container.querySelector('#menuItemResetSwatches')?.addEventListener('click', () => {
      closeAllMenus();
      this.resetSwatchesToDefault();
    });
    this.container.querySelector('#menuItemImportSwatches')?.addEventListener('click', () => {
      closeAllMenus();
      this.container.querySelector('#swatchFileInput')?.click();
    });
    this.container.querySelector('#menuItemExportSwatches')?.addEventListener('click', () => {
      closeAllMenus();
      this.exportSwatchesJson();
    });

    // 画像・リグ
    this.container.querySelector('#menuItemFlipH')?.addEventListener('click', () => {
      closeAllMenus();
      this.container.querySelector('#btnFacingToggle')?.click();
    });
    this.container.querySelector('#menuItemFlipV')?.addEventListener('click', () => {
      closeAllMenus();
      const part = this.editor?.getSelectedPart();
      if (part && part.points) {
        this.editor.pushState();
        for (const pt of part.points) pt.y = -pt.y;
        this.editor.render();
        try { this.updateInspectorPreview(); } catch (_) {}
      }
    });
    this.container.querySelector('#menuItemAddPart')?.addEventListener('click', () => {
      closeAllMenus();
      this.container.querySelector('#btnAddPart')?.click();
    });
    this.container.querySelector('#menuItemOpenAi')?.addEventListener('click', () => {
      closeAllMenus();
      this.container.querySelector('#btnOpenAiGenerator')?.click();
    });

    // 表示
    this.container.querySelector('#menuItemZoomIn')?.addEventListener('click', () => {
      closeAllMenus();
      this.container.querySelector('#btnNavZoomIn')?.click();
    });
    this.container.querySelector('#menuItemZoomOut')?.addEventListener('click', () => {
      closeAllMenus();
      this.container.querySelector('#btnNavZoomOut')?.click();
    });
    this.container.querySelector('#menuItemFitView')?.addEventListener('click', () => {
      closeAllMenus();
      this.fitToCanvas();
    });
    this.container.querySelector('#menuItemToggleSnap')?.addEventListener('click', () => {
      closeAllMenus();
      this.container.querySelector('#btnSnapToggle')?.click();
    });
    this.container.querySelector('#menuItemToggleSil')?.addEventListener('click', () => {
      closeAllMenus();
      this.container.querySelector('#btnSilhouetteToggle')?.click();
    });

    // ウィンドウ
    this.container.querySelector('#menuItemShowBins')?.addEventListener('click', () => {
      closeAllMenus();
      this.switchSidebarTab('bins');
    });
    this.container.querySelector('#menuItemShowLayers')?.addEventListener('click', () => {
      closeAllMenus();
      this.switchSidebarTab('layers');
    });
    this.container.querySelector('#menuItemShowNav')?.addEventListener('click', () => {
      closeAllMenus();
      this.selectNavTab?.('main');
    });
    this.container.querySelector('#menuItemShowSwatches')?.addEventListener('click', () => {
      closeAllMenus();
      this.selectNavTab?.('swatch');
    });
    this.container.querySelector('#menuItemShortcuts')?.addEventListener('click', () => {
      closeAllMenus();
      this.container.querySelector('#btnOpenShortcuts')?.click();
    });
  }
}
