// Fish simulation: ecology behaviors, collision avoidance, depth visibility, 6s lifetime, bait eating stop, and miss panic flee

export const FISH_TYPES = {
  HIRAME: 'hirame',      // ヒラメ (左向き, 待ち伏せ捕食, 小魚好き)
  KAREI: 'karei',        // カレイ (右向き, 菱形おちょぼ口, ゴカイ好き)
  BOO_CHAN: 'boo_chan',  // ぶーちゃん (豚顔イルカ・スペシャル)
  OCTOPUS: 'octopus',    // タコ (邪魔キャラ: 墨吐き)
  SQUID: 'squid',        // イカ (邪魔キャラ: ジェット急行)
  STINGRAY: 'stingray',  // エイ (邪魔キャラ: 巨大影)
  AJI_OPEN: 'aji_open',  // アジの開き (罠: -5pt)
  SHITABIRAME: 'shitabirame', // シタビラメ (ひっかけ激似魚)
  KANJI_HIRAME: 'kanji_hirame',   // 漢字「鮃」 (ヒラメ扱い)
  KANJI_KAREI_1: 'kanji_karei_1', // 漢字「鰈」 (カレイ扱い)
  KANJI_KAREI_2: 'kanji_karei_2'  // 漢字「魪」 (カレイ扱い)
};

export const DEFAULT_BUCKETS = [
  { id: 'bucketA', name: 'カレイ', name_en: 'Karei', name_ko: '가자미', name_zh: '鲽鱼', icon: '🪣' },
  { id: 'bucketB', name: 'ヒラメ', name_en: 'Hirame', name_ko: '히라메', name_zh: '牙鲆', icon: '🪣' }
];

/**
 * 魚種の系統分類 ('karei' | 'hirame' | 'disturber' | 'special')
 */
export function getSpeciesCategory(type) {
  if (
    type === FISH_TYPES.KAREI ||
    type === FISH_TYPES.KANJI_KAREI_1 ||
    type === FISH_TYPES.KANJI_KAREI_2
  ) {
    return 'karei';
  }
  if (
    type === FISH_TYPES.HIRAME ||
    type === FISH_TYPES.KANJI_HIRAME
  ) {
    return 'hirame';
  }
  if (type === FISH_TYPES.BOO_CHAN) {
    return 'special';
  }
  return 'disturber';
}

/**
 * 各ゲームモードにおけるターゲット対象判定
 * ・カレイ派モード: 「バケツA（カレイ）」所属魚種
 * ・ヒラメ派モード: 「バケツB（ヒラメ）」所属魚種
 * ・ヒライ派モード: 各種バケツ（バケツA・B・追加バケツ）所属魚種
 * ・ぶーちゃん: 全モードでボーナスターゲット
 */
export function isTargetForMode(type, mode, devConfig = null) {
  // 1. スペシャルキャラ（ぶーちゃん）は明示的にdisturber指定されない限り全モードでターゲット
  if (type === FISH_TYPES.BOO_CHAN) {
    const bCfg = devConfig?.modeConfigs?.[mode]?.characters?.[type] || devConfig?.characters?.[type];
    return bCfg?.role !== 'disturber';
  }

  // 2. モード別のキャラクター設定を取得（各モード設定を優先）
  const modeChars = devConfig?.modeConfigs?.[mode]?.characters || devConfig?.characters;

  const charCfg = modeChars?.[type];

  // 3. キャラクター設定によるバケツ・役割判定
  if (charCfg) {
    if (charCfg.role === 'disturber') {
      return false;
    }
    if (charCfg.role === 'bucketA') {
      return mode === 'karei' || mode === 'hirai';
    }
    if (charCfg.role === 'bucketB') {
      return mode === 'hirame' || mode === 'hirai';
    }
    if (charCfg.role && charCfg.role.startsWith('bucket')) {
      return mode === 'hirai';
    }
    if (charCfg.role === 'target') {
      // 汎用ターゲット指定の場合、モード基本判定へ
    }
  }

  // 4. デフォルトの魚種別判定（フォールバック）
  if (mode === 'karei') {
    return type === FISH_TYPES.KAREI || type === FISH_TYPES.KANJI_KAREI_1 || type === FISH_TYPES.KANJI_KAREI_2;
  }
  if (mode === 'hirame') {
    return type === FISH_TYPES.HIRAME || type === FISH_TYPES.KANJI_HIRAME;
  }
  if (mode === 'hirai') {
    return type === FISH_TYPES.KAREI || type === FISH_TYPES.KANJI_KAREI_1 || type === FISH_TYPES.KANJI_KAREI_2 ||
           type === FISH_TYPES.HIRAME || type === FISH_TYPES.KANJI_HIRAME;
  }
  return false;
}

export const DEFAULT_SPAWN_CONDITION = {
  enabled: false,
  condAll: false,               // 3条件設定: 全て (ALL)
  condScoreEnabled: false,      // 3条件設定: 獲得Pt (スコア閾値判定の有効化)
  condTargetTapsEnabled: true,  // 3条件設定: T捕獲数 (達成回数判定の有効化)
  condTimeEnabled: false,       // 3条件設定: 時間 (残り時間判定の有効化)
  timeSec: 0,                   // 0: なし, 1~60: 秒数, 61: ランダム
  origin: 'silhouette',         // 'seabed' | 'silhouette' | 'left' | 'right' | 'top' | 'random'
  triggerAction: 'tap_target',  // 'tap_target' | 'tap_disturber' | 'tap_specific' | 'tap_background' | 'idle'
  targetCharacters: [],         // キャラ個別タップ用 (IDリスト)
  tapCount: 10,                 // 0: 無操作, 1~100: 回数, 101: ランダム
  tapCountEnabled: true,        // 後方互換用
  matchAny: false,              // かたほうでも達成 (いずれか達成)
  isCombo: false,               // コンボ達成条件 (false: 延べタップ数, true: 連続タップ成功のみ)
  probability: 100,             // 1~100%
  repeatCount: 0                // 0: 無限 (条件達成するたび発生), 1~99: 発動回数制限, 100: 回数ランダム
};

export const DEFAULT_AMBIENT_TRIGGER = {
  enabled: false,
  tapCount: 1,            // xx回タップしたら
  percentage: 50,         // xxパーセント
  direction: 'increase',  // 'increase' (増加) | 'decrease' (減少)
  durationSec: 2.0,       // xx秒間
  targetPresets: ['bubbles', 'small_fish'] // 使用するプリセット選択
};

export const DEFAULT_AMBIENT_PRESETS = [
  { id: 'bubbles', name: '🫧 泡', type: 'bubbles', enabled: true, count: 30, speed: 1.0 },
  { id: 'small_fish', name: '🐟 小魚 (イワシ群)', type: 'small_fish', enabled: true, count: 15, speed: 1.0 },
  { id: 'halloween_pumpkin', name: '🎃 カボチャ (半透明)', type: 'custom', enabled: false, icon: '🎃', count: 5, speed: 0.5, isWhiteTranslucent: true, opacity: 0.4 },
  { id: 'halloween_ghost', name: '👻 オバケ (半透明)', type: 'custom', enabled: false, icon: '👻', count: 5, speed: 0.7, isWhiteTranslucent: true, opacity: 0.45 }
];

export const DEFAULT_AMBIENT_CONFIG = {
  enabled: true,
  backgroundImage: {
    enabled: false,
    dataUrl: '',
    fit: 'cover',
    opacity: 1.0
  },
  gradient: {
    enabled: true,
    topColor: '#0284c7',
    midColor: '#0369a1',
    deepColor: '#075985',
    bottomColor: '#0c2340'
  },
  lightRays: {
    enabled: true,
    color: '#ffffff',
    alpha: 0.12,
    count: 5
  },
  ground: {
    enabled: true,
    topColor: '#786047',
    bottomColor: '#3b2b1d',
    plantColor: '#15803d',
    showPlants: true
  },
  bubbles: {
    enabled: true,
    count: 30, // 0: ランダム (15〜50)
    color: '#ffffff'
  },
  smallFish: {
    enabled: true,
    count: 15, // 0: ランダム (8〜25)
    color: '#e0f2fe'
  },
  flowEffect: {
    enabled: false,
    count: 15,
    color: '#38bdf8',
    speed: 1.0,
    size: 20
  },
  sparks: {
    enabled: false,
    count: 20,
    color: '#facc15',
    shape: 'spark' // 'spark' | 'star' | 'dot'
  },
  presets: JSON.parse(JSON.stringify(DEFAULT_AMBIENT_PRESETS))
};

export const DEFAULT_START_CONFIG = {
  startKareiCount: 4,             // カレイ初期匹数 (4匹)
  startHirameCount: 4,            // ヒラメ初期匹数 (4匹)
  startDisturberTypeCount: 3,     // 邪魔キャラ出現種類数 (3種)
  startDisturberCountPerType: 2,  // 邪魔キャラ各匹数 (2匹)
  startSpeedMultiplier: 0.6       // 開始時遊泳速度 (0.6x、ゆっくり)
};

export const DEFAULT_BAIT_CONFIG = {
  speedMultiplier: 1.8,    // 餌に向かう基準スピード（x倍）
  speedRandomRange: 0.3,   // 餌スピードのランダム変動幅（±倍率）
  eatingStaySec: 3.0,      // 餌にとどまる時間（秒）
  disappearDelaySec: 8.0   // 餌の自然消滅時間（秒）
};

export const DEFAULT_SILHOUETTE_CONFIG = {
  enabled: true,
  chancePercent: 20,       // シルエットになる確率 (%)
  durationSec: 3.0,        // シルエット維持秒数 (秒)
  shrinkScale: 0.7         // 縮小率 (0.7 = 70%)
};

export const DEFAULT_CHARACTER_SETTINGS = {
  karei: {
    name: 'カレイ',
    role: 'bucketA',
    pointValue: 10,
    count: 20,
    minTargetThreshold: 2,
    speedMultiplier: 1.0,
    lifetimeSec: 6.0,
    randomTurnRate: 0.02,
    dispersionRate: 0.5,
    sizeScale: 1.0,
    beginnerAlert: true,
    weight: 20,
    scoreThreshold: 0,
    spawnCondition: { ...DEFAULT_SPAWN_CONDITION },
    ambientTrigger: { ...DEFAULT_AMBIENT_TRIGGER }
  },
  hirame: {
    name: 'ヒラメ',
    role: 'bucketB',
    pointValue: 10,
    count: 20,
    minTargetThreshold: 2,
    speedMultiplier: 1.0,
    lifetimeSec: 6.0,
    randomTurnRate: 0.02,
    dispersionRate: 0.5,
    sizeScale: 1.0,
    beginnerAlert: true,
    weight: 20,
    scoreThreshold: 0,
    spawnCondition: { ...DEFAULT_SPAWN_CONDITION },
    ambientTrigger: { ...DEFAULT_AMBIENT_TRIGGER }
  },
  boo_chan: {
    name: 'ぶーちゃん',
    role: 'target',
    pointValue: 10,
    count: 5,
    minTargetThreshold: 1,
    speedMultiplier: 1.2,
    lifetimeSec: 7.0,
    randomTurnRate: 0.02,
    dispersionRate: 0.5,
    sizeScale: 1.05,
    beginnerAlert: true,
    weight: 20,
    scoreThreshold: 0,
    spawnCondition: {
      enabled: true,
      timeSec: 0,
      origin: 'silhouette',
      triggerAction: 'tap_target',
      targetCharacters: [],
      tapCount: 10,
      isCombo: false,
      probability: 100,
      repeatCount: 0
    },
    ambientTrigger: { ...DEFAULT_AMBIENT_TRIGGER }
  },
  kanji_hirame: {
    name: '漢字・鮃',
    role: 'bucketB',
    pointValue: 10,
    count: 10,
    minTargetThreshold: 1,
    speedMultiplier: 1.0,
    lifetimeSec: 6.0,
    randomTurnRate: 0.02,
    dispersionRate: 0.5,
    sizeScale: 1.0,
    beginnerAlert: true,
    weight: 20,
    scoreThreshold: 150,
    spawnCondition: { ...DEFAULT_SPAWN_CONDITION },
    ambientTrigger: { ...DEFAULT_AMBIENT_TRIGGER }
  },
  kanji_karei_1: {
    name: '漢字・鰈',
    role: 'bucketA',
    pointValue: 10,
    count: 10,
    minTargetThreshold: 1,
    speedMultiplier: 1.0,
    lifetimeSec: 6.0,
    randomTurnRate: 0.02,
    dispersionRate: 0.5,
    sizeScale: 1.0,
    beginnerAlert: true,
    weight: 20,
    scoreThreshold: 150,
    spawnCondition: { ...DEFAULT_SPAWN_CONDITION },
    ambientTrigger: { ...DEFAULT_AMBIENT_TRIGGER }
  },
  kanji_karei_2: {
    name: '漢字・魪',
    role: 'bucketA',
    pointValue: 10,
    count: 10,
    minTargetThreshold: 1,
    speedMultiplier: 1.0,
    lifetimeSec: 6.0,
    randomTurnRate: 0.02,
    dispersionRate: 0.5,
    sizeScale: 1.0,
    beginnerAlert: true,
    weight: 20,
    scoreThreshold: 150,
    spawnCondition: { ...DEFAULT_SPAWN_CONDITION },
    ambientTrigger: { ...DEFAULT_AMBIENT_TRIGGER }
  },
  octopus: {
    name: 'タコ',
    role: 'disturber',
    pointValue: -5,
    count: 5,
    minTargetThreshold: 0,
    speedMultiplier: 1.0,
    lifetimeSec: 8.0,
    randomTurnRate: 0.02,
    dispersionRate: 0.5,
    sizeScale: 1.0,
    beginnerAlert: false,
    weight: 20,
    scoreThreshold: 150,
    spawnCondition: { ...DEFAULT_SPAWN_CONDITION },
    ambientTrigger: { ...DEFAULT_AMBIENT_TRIGGER }
  },
  squid: {
    name: 'イカ',
    role: 'disturber',
    pointValue: -5,
    count: 5,
    minTargetThreshold: 0,
    speedMultiplier: 1.2,
    lifetimeSec: 8.0,
    randomTurnRate: 0.02,
    dispersionRate: 0.5,
    sizeScale: 1.0,
    beginnerAlert: false,
    weight: 20,
    scoreThreshold: 150,
    spawnCondition: { ...DEFAULT_SPAWN_CONDITION },
    ambientTrigger: { ...DEFAULT_AMBIENT_TRIGGER }
  },
  stingray: {
    name: 'エイ',
    role: 'disturber',
    pointValue: -5,
    count: 3,
    minTargetThreshold: 0,
    speedMultiplier: 0.7,
    lifetimeSec: 10.0,
    randomTurnRate: 0.005,
    dispersionRate: 0.5,
    sizeScale: 1.0,
    beginnerAlert: false,
    weight: 20,
    scoreThreshold: 200,
    spawnCondition: { ...DEFAULT_SPAWN_CONDITION },
    ambientTrigger: {
      enabled: true,
      tapCount: 1,
      percentage: 50,
      direction: 'increase',
      durationSec: 2.0,
      targetPresets: ['bubbles', 'small_fish']
    }
  },
  aji_open: {
    name: 'アジの開き',
    role: 'disturber',
    pointValue: -5,
    count: 5,
    minTargetThreshold: 0,
    speedMultiplier: 1.0,
    lifetimeSec: 6.0,
    randomTurnRate: 0.02,
    dispersionRate: 0.5,
    sizeScale: 1.0,
    beginnerAlert: false,
    weight: 20,
    scoreThreshold: 150,
    spawnCondition: { ...DEFAULT_SPAWN_CONDITION },
    ambientTrigger: { ...DEFAULT_AMBIENT_TRIGGER }
  },
  shitabirame: {
    name: 'ウシノシタ',
    role: 'disturber',
    pointValue: -5,
    count: 5,
    minTargetThreshold: 0,
    speedMultiplier: 1.0,
    lifetimeSec: 7.0,
    randomTurnRate: 0.02,
    dispersionRate: 0.5,
    sizeScale: 1.0,
    beginnerAlert: false,
    weight: 20,
    scoreThreshold: 150,
    spawnCondition: { ...DEFAULT_SPAWN_CONDITION },
    ambientTrigger: { ...DEFAULT_AMBIENT_TRIGGER }
  }
};

export class Bait {
  constructor(x, y, targetType, config = {}) {
    this.x = x;
    this.y = y;
    this.targetType = targetType; // 'hirame' or 'karei'
    this.radius = 16;
    this.vy = 1.4;    // 海底へ沈む
    this.vx = (Math.random() - 0.5) * 0.6;
    this.isSettled = false;
    this.eaters = new Set();
    this.isFinished = false;
    this.alpha = 1.0;

    // 自然消滅時間 (設定秒数、デフォルト8秒)
    // 餌投下時からカウントダウンを開始し、設定秒数経過で確実に自然消滅する！
    this.disappearDelaySec = config?.disappearDelaySec !== undefined ? Math.max(1.0, Number(config.disappearDelaySec)) : 8.0;
    this.totalLife = Math.floor(this.disappearDelaySec * 60);
    this.life = this.totalLife;

    // 魚が触れたフラグ
    this.touched = false;
  }

  // 魚が口元を接触させた
  touch(fish = null) {
    this.touched = true;
    if (fish) {
      this.eaters.add(fish);
    }
  }

  // 魚が食べ終えた時の消滅処理（食べ尽くされた）
  consume(fish = null) {
    if (fish) {
      this.eaters.delete(fish);
    }
    // 魚が食べ終わったら餌は食べ尽くされて消滅！
    this.isFinished = true;
  }

  update(bounds) {
    if (this.isFinished) return;

    // 餌の自然消滅タイマー（投下後から毎フレーム減算）
    this.life--;
    if (this.life <= 0) {
      this.isFinished = true;
      return;
    }

    // 残り0.6秒（約36フレーム）でスムーズにフェードアウト
    if (this.life < 36) {
      this.alpha = Math.max(0, this.life / 36);
    } else {
      this.alpha = 1.0;
    }

    if (!this.isSettled) {
      this.y += this.vy;
      this.x += this.vx;
      const maxSeabed = bounds.safeBottom !== undefined ? (bounds.safeBottom - 25) : (bounds.height * 0.72);
      if (this.y >= maxSeabed) {
        this.y = maxSeabed;
        this.vy = 0;
        this.vx = 0;
        this.isSettled = true;
      }
    }
  }
}

export class AmbientFish {
  // 背景の小魚（イワシ・シラス）
  constructor(w, h) {
    this.x = Math.random() * w;
    this.y = Math.random() * (h * 0.7);
    this.speed = 1.2 + Math.random() * 1.5;
    this.angle = Math.random() * Math.PI * 2;
    this.size = 8 + Math.random() * 4;
  }

  update(bounds) {
    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;
    if (Math.random() < 0.02) {
      this.angle += (Math.random() - 0.5) * 0.5;
    }
    if (this.x < -30) this.x = bounds.width + 30;
    if (this.x > bounds.width + 30) this.x = -30;
    if (this.y < 30) this.y = bounds.height * 0.7;
    if (this.y > bounds.height * 0.8) this.y = 50;
  }
}

export class Fish {
  constructor(type, bounds, devConfig = {}, gameMode = 'karei', options = {}) {
    this.type = type;
    this.gameMode = gameMode;
    this.devConfig = devConfig;
    this.options = options;
    this.id = Math.random().toString(36).substring(2, 9);
    
    // 個別キャラクター設定の取得 (モード別の個別設定があれば優先)
    const modeChars = (devConfig?.gameBalanceUnified === false && devConfig?.modeConfigs?.[gameMode]?.characters)
      ? devConfig.modeConfigs[gameMode].characters
      : devConfig?.characters;
    const charCfg = modeChars?.[type] || {};
    
    // 役割 ('target' or 'disturber')
    this.role = isTargetForMode(type, gameMode, devConfig) ? 'target' : 'disturber';

    // 得点/減点 (disturberなら確実に負の値)
    if (this.role === 'disturber') {
      const p = charCfg.pointValue !== undefined ? charCfg.pointValue : -5;
      this.pointValue = p >= 0 ? -Math.abs(p || 5) : p;
    } else {
      const p = charCfg.pointValue !== undefined ? charCfg.pointValue : 10;
      this.pointValue = p <= 0 ? Math.abs(p || 10) : p;
    }

    // キャラのサイズ倍率 (デフォルト1.0x)
    this.sizeScale = charCfg.sizeScale != null ? charCfg.sizeScale : (devConfig.sizeScale || 1.0);

    // スピード倍率
    this.speedMultiplier = charCfg.speedMultiplier != null ? charCfg.speedMultiplier : (devConfig.speedMultiplier || 1.0);

    // ランダム方向転換頻度
    this.randomTurnRate = charCfg.randomTurnRate != null ? charCfg.randomTurnRate : (devConfig.randomTurnRate ?? 0.02);

    // 初心者機能 (逃走2秒前に点滅通知)
    this.beginnerAlert = charCfg.beginnerAlert != null ? charCfg.beginnerAlert : (this.role === 'target');
    this.isBlinkingAlert = false;

    // 基本サイズ (sizeScaleで拡大縮小)
    this.baseWidth = 66;
    this.baseHeight = 44;
    if (type === FISH_TYPES.STINGRAY) {
      this.baseWidth = 110;
      this.baseHeight = 80;
    } else if (type === FISH_TYPES.AJI_OPEN) {
      this.baseWidth = 54;
      this.baseHeight = 36;
    } else if (type === FISH_TYPES.OCTOPUS) {
      this.baseWidth = 70;
      this.baseHeight = 65;
    } else if (type === FISH_TYPES.SQUID) {
      this.baseWidth = 60;
      this.baseHeight = 85;
    } else if (type === FISH_TYPES.SHITABIRAME) {
      this.baseWidth = 105;
      this.baseHeight = 34;
    } else if (type === FISH_TYPES.BOO_CHAN) {
      this.baseWidth = 85;
      this.baseHeight = 55;
    } else if (type === FISH_TYPES.KANJI_HIRAME || type === FISH_TYPES.KANJI_KAREI_1 || type === FISH_TYPES.KANJI_KAREI_2) {
      this.baseWidth = 75;
      this.baseHeight = 75;
    }
    this.width = this.baseWidth * this.sizeScale;
    this.height = this.baseHeight * this.sizeScale;

    // 出現位置・方向の決定 (出現条件 origin パラメータ対応: 海底、奥、左、右、上、ランダム)
    const reqOrigin = options.origin || 'default';
    let chosenOrigin = reqOrigin;
    if (chosenOrigin === 'random') {
      const origins = ['seabed', 'silhouette', 'left', 'right', 'top'];
      chosenOrigin = origins[Math.floor(Math.random() * origins.length)];
    }

    this.vy = 0;
    if (chosenOrigin === 'left') {
      this.x = -this.width;
      this.heading = 1;
      this.depth = 0.35;
      this.targetDepth = 0.35;
      this.y = this.calculateYFromDepth(bounds);
    } else if (chosenOrigin === 'right') {
      this.x = bounds.width + this.width;
      this.heading = -1;
      this.depth = 0.35;
      this.targetDepth = 0.35;
      this.y = this.calculateYFromDepth(bounds);
    } else if (chosenOrigin === 'top') {
      const topSafe = bounds.safeTop !== undefined ? bounds.safeTop : 105;
      const minY = topSafe + this.height * 0.6 + 30;
      this.x = bounds.width * (0.2 + Math.random() * 0.6);
      this.y = minY;
      this.heading = Math.random() > 0.5 ? 1 : -1;
      this.depth = 0.25;
      this.targetDepth = 0.35;
      this.vy = 1.0 * this.speedMultiplier;
    } else if (chosenOrigin === 'seabed') {
      const botSafe = bounds.safeBottom !== undefined ? bounds.safeBottom : bounds.height * 0.72;
      const maxY = botSafe - this.height * 0.6 - 15;
      this.x = bounds.width * (0.2 + Math.random() * 0.6);
      this.depth = 0.85;
      this.targetDepth = 0.45;
      this.y = maxY;
      this.heading = Math.random() > 0.5 ? 1 : -1;
      this.vy = -1.5 * this.speedMultiplier;
    } else if (chosenOrigin === 'silhouette') {
      this.x = bounds.width * (0.3 + Math.random() * 0.4);
      this.depth = 0.88;
      this.targetDepth = 0.32;
      this.heading = Math.random() > 0.5 ? 1 : -1;
      this.y = this.calculateYFromDepth(bounds);
      this.emergingFromBackground = true;
    } else if (options.isInitial) {
      // ゲーム開始時の初期出現: 画面全域（上下左右）に均等に広く散らばって出現 (中央密集の防止)
      const padX = bounds.width * 0.08;
      this.x = padX + Math.random() * (bounds.width - padX * 2);
      this.heading = Math.random() > 0.5 ? 1 : -1;

      // 水深：初期スライス比率があればそれを使用、なければ海面から海底まで均等に分散
      if (options.initialYRatio !== undefined) {
        this.depth = Math.max(0.08, Math.min(0.92, options.initialYRatio));
      } else {
        this.depth = 0.08 + Math.random() * 0.84;
      }
      this.targetDepth = this.depth;
      this.y = this.calculateYFromDepth(bounds);
    } else {
      // 通常出現: 画面外の左右から遊泳出現
      const spawnFromLeft = Math.random() > 0.5;
      this.x = spawnFromLeft ? -this.width : bounds.width + this.width;
      this.heading = spawnFromLeft ? 1 : -1;

      // 水深：海面(0.12〜0.35)、海中(0.35〜0.65)、海底(0.65〜0.88)
      const layerRand = Math.random();
      if (layerRand < 0.33) {
        this.depth = 0.12 + Math.random() * 0.22; // 海面
      } else if (layerRand < 0.67) {
        this.depth = 0.35 + Math.random() * 0.30; // 海中
      } else {
        this.depth = 0.65 + Math.random() * 0.23; // 海底
      }
      this.targetDepth = this.depth;
      this.y = this.calculateYFromDepth(bounds);
    }

    // 基本遊泳速度：画面を自然に横断・回遊できる適正速度（以前の0.15は遅すぎたため0.85に改善）
    const startSpdMult = options.isInitial ? (devConfig?.startConfig?.startSpeedMultiplier ?? 0.7) : 1.0;
    this.vx = this.heading * (1.2 + Math.random() * 0.8) * 0.85 * this.speedMultiplier * startSpdMult;
    if (this.vy === undefined) this.vy = (Math.random() - 0.5) * 0.2;
    this.speed = 1.0;
    this.collisionRepulsion = charCfg.collisionRepulsion !== undefined ? Number(charCfg.collisionRepulsion) : (devConfig.collisionRepulsion !== undefined ? Number(devConfig.collisionRepulsion) : 0);
    this.dispersionRate = charCfg.dispersionRate !== undefined ? Number(charCfg.dispersionRate) : (devConfig.dispersionRate !== undefined ? Number(devConfig.dispersionRate) : 0.5);
    this.turnCheckTimer = Math.floor(Math.random() * 60); // 方向転換判定タイマー分散
    this.state = options.isInitial ? 'swimming' : 'entering';
    this.stateTimer = Math.floor(60 + Math.random() * 60);

    // 画面出現＆中央通過フラグ
    this.hasEnteredScreen = !!options.isInitial; // 画面内に全身が入ったか
    this.hasCrossedCenter = !!options.isInitial; // 画面中央（bounds.width*0.5）を通過したか

    // 滞在・離脱時間（逃走秒数）：画面内に出現した瞬間からフルカウントダウン開始
    this.lifetimeSec = charCfg.lifetimeSec != null ? charCfg.lifetimeSec : (devConfig.lifetimeSec || 6.0);
    const baseLife = this.lifetimeSec * 60;
    this.lifetime = options.isInitial
      ? Math.floor(baseLife + Math.random() * 240 + 60)
      : Math.floor(baseLife);

    // 生態
    this.initEcology();

    // 食事タイマー & 傾き角度（底の餌を食べる時の斜め下向き姿勢演出用）
    this.eatingTimer = 0;
    this.targetBait = null;
    this.tiltAngle = 0; // ラジアン単位の傾き (画像4枚目の底餌捕食時の尾浮き角度)

    // 一時逃避タイマー
    this.fleeTimer = 0;
    this.fleeReturnX = 0;

    // シルエット演出設定 (通常表示 → シルエット(等倍→3秒間70%縮小→等倍) → 通常表示)
    const silCfg = charCfg.silhouetteConfig || devConfig.silhouetteConfig || DEFAULT_SILHOUETTE_CONFIG;
    this.silhouetteConfig = { ...DEFAULT_SILHOUETTE_CONFIG, ...silCfg };
    this.silhouetteState = 'none'; // 'none' | 'shrinking' | 'holding' | 'restoring'
    this.silhouetteTimer = 0;
    this.silhouetteScaleFactor = 1.0;
    this.isSilhouetteActive = false;
    this.silhouetteCooldown = Math.floor(60 + Math.random() * 180);

    // アニメーション用
    this.finCycle = Math.random() * Math.PI * 2;
    this.isCaptured = false;
    this.captureProgress = 0;
    this.targetBucketPos = null;
    this.isDead = false;
    this.pendingInks = [];
    this.inkTimer = 0;
  }

  // シルエット演出アニメーションの更新
  updateSilhouette() {
    if (this.isCaptured || this.state !== 'swimming') {
      if (this.silhouetteState !== 'none') {
        this.silhouetteState = 'none';
        this.silhouetteScaleFactor = 1.0;
        this.isSilhouetteActive = false;
      }
      return;
    }

    const cfg = this.silhouetteConfig || DEFAULT_SILHOUETTE_CONFIG;
    if (cfg.enabled === false || (cfg.chancePercent || 0) <= 0) {
      if (this.silhouetteState !== 'none') {
        this.silhouetteState = 'none';
        this.silhouetteScaleFactor = 1.0;
        this.isSilhouetteActive = false;
      }
      return;
    }

    const shrinkScale = Math.max(0.2, Math.min(1.0, cfg.shrinkScale !== undefined ? Number(cfg.shrinkScale) : 0.7));
    const durationFrames = Math.max(10, Math.floor((cfg.durationSec !== undefined ? Number(cfg.durationSec) : 3.0) * 60));
    const transitionFrames = 24; // 約0.4秒で滑らかに拡大縮小

    if (this.silhouetteState === 'none') {
      if (this.silhouetteCooldown > 0) {
        this.silhouetteCooldown--;
      } else {
        // 定期判定 (60フレーム=1秒に1回)
        if (Math.random() * 100 < (cfg.chancePercent || 20)) {
          this.silhouetteState = 'shrinking';
          this.silhouetteTimer = transitionFrames;
          this.isSilhouetteActive = true;
        } else {
          this.silhouetteCooldown = 60;
        }
      }
    } else if (this.silhouetteState === 'shrinking') {
      this.silhouetteTimer--;
      const progress = 1 - (this.silhouetteTimer / transitionFrames);
      const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      this.silhouetteScaleFactor = 1.0 - (1.0 - shrinkScale) * ease;
      this.isSilhouetteActive = true;
      if (this.silhouetteTimer <= 0) {
        this.silhouetteState = 'holding';
        this.silhouetteTimer = durationFrames;
        this.silhouetteScaleFactor = shrinkScale;
      }
    } else if (this.silhouetteState === 'holding') {
      this.silhouetteScaleFactor = shrinkScale;
      this.isSilhouetteActive = true;
      this.silhouetteTimer--;
      if (this.silhouetteTimer <= 0) {
        this.silhouetteState = 'restoring';
        this.silhouetteTimer = transitionFrames;
      }
    } else if (this.silhouetteState === 'restoring') {
      this.silhouetteTimer--;
      const progress = 1 - (this.silhouetteTimer / transitionFrames);
      const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      this.silhouetteScaleFactor = shrinkScale + (1.0 - shrinkScale) * ease;
      this.isSilhouetteActive = true;
      if (this.silhouetteTimer <= 0) {
        this.silhouetteState = 'none';
        this.silhouetteScaleFactor = 1.0;
        this.isSilhouetteActive = false;
        this.silhouetteCooldown = Math.floor(180 + Math.random() * 180); // 3〜6秒クールダウン
      }
    }
  }

  // イカ専用: スミを吐きながら超高速ジェットで画面外へ逃走
  jetInkEscape(bounds) {
    this.state = 'squid_ink_escape';
    this.isCaptured = true;
    this.captureProgress = 0;
    this.inkTimer = 0;
    const toLeft = this.x < bounds.width * 0.5;
    this.heading = toLeft ? -1 : 1;
    this.vx = this.heading * 18.0 * 0.15 * this.speedMultiplier;
    this.vy = (Math.random() - 0.5) * 2.5;
    if (!this.pendingInks) this.pendingInks = [];
    this.pendingInks.push({ x: this.x, y: this.y });
  }

  setGameMode(mode) {
    this.gameMode = mode;
  }

  isTargetForCurrentMode() {
    return isTargetForMode(this.type, this.gameMode, this.devConfig);
  }

  initEcology() {
    const category = getSpeciesCategory(this.type);
    if (this.role === 'disturber' || category === 'disturber') {
      this.targetCategory = null;
      if (this.type === FISH_TYPES.OCTOPUS) {
        this.naturalFaceLeft = Math.random() > 0.5;
      } else if (this.type === FISH_TYPES.SQUID) {
        this.naturalFaceLeft = false;
        this.speed = 3.5;
      } else if (this.type === FISH_TYPES.STINGRAY) {
        this.naturalFaceLeft = Math.random() > 0.5;
        this.randomTurnRate = 0.002; // エイは旋回を極力少なく
      } else {
        this.naturalFaceLeft = Math.random() > 0.5;
      }
      return;
    }

    // ターゲットの場合
    if (category === 'hirame') {
      this.naturalFaceLeft = true;
      this.targetCategory = 'hirame';
      if (this.type === FISH_TYPES.KANJI_HIRAME) {
        this.heading = -1;
      }
    } else if (category === 'karei') {
      this.naturalFaceLeft = false;
      this.targetCategory = 'karei';
      if (this.type === FISH_TYPES.KANJI_KAREI_1 || this.type === FISH_TYPES.KANJI_KAREI_2) {
        this.heading = 1;
      }
    } else {
      this.naturalFaceLeft = Math.random() > 0.5;
      this.targetCategory = 'target';
    }
  }

  calculateYFromDepth(bounds) {
    const seaTop = bounds.safeTop !== undefined ? bounds.safeTop : (bounds.height * 0.14);
    const seabed = bounds.safeBottom !== undefined ? bounds.safeBottom : (bounds.height * 0.72);
    // 上下UIと被らない安全域の中で、上下いっぱいに広く泳ぐ
    const minY = seaTop + this.height * 0.5 + 8;
    const maxY = seabed - this.height * 0.5 - 8;
    if (minY >= maxY) return (seaTop + seabed) / 2;
    return minY + this.depth * (maxY - minY);
  }

  // 餌を好んで食べるターゲット魚かどうかの判定 (全モード・全魚種完全対応)
  canEatBait(bait) {
    if (!bait || bait.isFinished) return false;
    // 邪魔キャラ（タコ・イカ・エイ等）は餌に反応しない（ターゲット魚のみ）
    if (this.role === 'disturber') return false;

    // カレイの餌 (ゴカイ)
    if (bait.targetType === 'karei') {
      if (this.targetCategory === 'karei' || this.type === FISH_TYPES.KAREI || this.type === FISH_TYPES.KANJI_KAREI_1 || this.type === FISH_TYPES.KANJI_KAREI_2) return true;
      const charCfg = this.devConfig?.characters?.[this.type];
      if (charCfg?.role === 'bucketA') return true;
      if (this.gameMode === 'karei' && this.isTargetForCurrentMode()) return true;
    }

    // ヒラメの餌 (小魚)
    if (bait.targetType === 'hirame') {
      if (this.targetCategory === 'hirame' || this.type === FISH_TYPES.HIRAME || this.type === FISH_TYPES.KANJI_HIRAME) return true;
      const charCfg = this.devConfig?.characters?.[this.type];
      if (charCfg?.role === 'bucketB') return true;
      if (this.gameMode === 'hirame' && this.isTargetForCurrentMode()) return true;
    }

    // 個別魚種指定やぶーちゃん等
    if (bait.targetType === this.type || bait.targetType === this.targetCategory) return true;

    return false;
  }

  // 空振りペナルティで一時画面外逃避
  fleeTemporary(bounds) {
    if (this.isCaptured || this.state === 'eating' || this.state === 'squid_ink_escape') return;
    this.state = 'fleeing_temp';
    this.fleeTimer = 80; // 約1.3秒間画面外へ退避
    // 左右どちらか近い方の画面外へダッシュ
    const toLeft = this.x < bounds.width * 0.5;
    this.heading = toLeft ? -1 : 1;
    this.vx = this.heading * 6.0 * 0.15 * this.speedMultiplier;
    this.fleeLimitX = toLeft ? -this.width - 25 : bounds.width + this.width + 25;
  }

  update(bounds, otherFishes, baits, ambientFishes, recentTapPos = null) {
    // イカのスミ吐き超高速ジェット逃走
    if (this.state === 'squid_ink_escape') {
      this.x += this.vx;
      this.y += this.vy;
      this.inkTimer = (this.inkTimer || 0) + 1;
      if (this.inkTimer % 3 === 0) {
        if (!this.pendingInks) this.pendingInks = [];
        this.pendingInks.push({
          x: this.x - this.heading * 26,
          y: this.y + (Math.random() - 0.5) * 10
        });
      }
      if (this.x < -this.width * 2 || this.x > bounds.width + this.width * 2) {
        this.isDead = true;
        this.captureProgress = 1;
      }
      return;
    }

    if (this.isCaptured) {
      if (this.targetBucketPos) {
        this.x += (this.targetBucketPos.x - this.x) * 0.2;
        this.y += (this.targetBucketPos.y - this.y) * 0.2;
        this.width *= 0.88;
        this.height *= 0.88;
        this.captureProgress += 0.08;
      }
      return;
    }

    this.finCycle += 0.15;
    this.stateTimer--;

    // シルエット演出アニメーション更新 (等倍 -> 3秒間70%縮小シルエット -> 等倍復帰)
    this.updateSilhouette();

    // 1. 食事中（指定滞在時間中は停止し、その場でモグモグ。終了と同時に餌を消費して逃走！）
    if (this.state === 'eating') {
      // 餌が途中で消滅した場合は食事を終えて退場
      if (this.targetBait && this.targetBait.isFinished) {
        this.targetBait = null;
        this.initLeaving(bounds);
        return;
      }
      this.vx = 0;
      this.vy = 0;
      this.finCycle += 0.25; // 尾びれを小さくヒラヒラ動かしながらモグモグ
      this.eatingTimer--;
      if (this.eatingTimer <= 0) {
        // ★食べ終わったタイミングで餌を食べ尽くして逃走開始！
        if (this.targetBait) {
          this.targetBait.consume(this);
        }
        this.targetBait = null;
        this.initLeaving(bounds);
      }
      return;
    }

    // 2. 空振りペナルティの一時逃避（画面外へ逃げて待機し、その後復帰）
    if (this.state === 'fleeing_temp') {
      this.x += this.vx;
      this.fleeTimer--;
      // 画面外に出たらそこで一旦待機（画面から遠く離れすぎないようにする）
      if (this.heading < 0 && this.x < this.fleeLimitX) {
        this.x = this.fleeLimitX;
        this.vx = 0;
      } else if (this.heading > 0 && this.x > this.fleeLimitX) {
        this.x = this.fleeLimitX;
        this.vx = 0;
      }

      if (this.fleeTimer <= 0) {
        // 画面内に向かって泳ぎ込む
        this.state = 'returning_temp';
        this.heading = this.x < bounds.width * 0.5 ? 1 : -1;
        this.vx = this.heading * (2.4 + Math.random() * 1.0) * 0.3 * this.speedMultiplier;
      }
      return;
    }

    // 復帰遊泳中（画面外から画面内へ戻ってくる最中もタップ捕獲可能）
    if (this.state === 'returning_temp') {
      this.x += this.vx;
      if (this.x > 35 && this.x < bounds.width - 35) {
        this.state = 'swimming';
        // 画面内に戻ったターゲットは確実に捕獲できるよう十分な寿命(約6秒=360F)を再付与
        this.lifetime = Math.max(this.lifetime, 360);
      }
      return;
    }

    // ===== 3. 餌への接近＆食事判定（退場中の魚も餌に気付いて急行！） =====
    let nearestBait = null;
    let minDist = 1400; // 画面全体の餌を確実に感知
    for (const bait of baits) {
      if (bait.isFinished) continue;
      if (this.canEatBait(bait)) {
        const d = Math.hypot(bait.x - this.x, bait.y - this.y);
        if (d < minDist) {
          minDist = d;
          nearestBait = bait;
        }
      }
    }

    const baitCfg = this.devConfig?.baitConfig || DEFAULT_BAIT_CONFIG;
    const baseApproachSpeedMult = baitCfg.speedMultiplier !== undefined ? Number(baitCfg.speedMultiplier) : 1.8;
    const speedRandomRange = baitCfg.speedRandomRange !== undefined ? Number(baitCfg.speedRandomRange) : 0.3;
    const eatingStaySec = baitCfg.eatingStaySec !== undefined ? Number(baitCfg.eatingStaySec) : 3.0;

    if (nearestBait) {
      // 餌があれば退場中(leaving)であっても喜んで泳ぎ戻り、寿命を維持
      if (this.state === 'leaving') {
        this.state = 'swimming';
      }
      this.lifetime = Math.max(this.lifetime, 360);

      // 魚固有の餌スピードランダムオフセット（餌感知時に決定し、その餌に向かう間維持）
      if (this.currentBaitTarget !== nearestBait) {
        this.currentBaitTarget = nearestBait;
        this.baitSpeedOffset = (Math.random() * 2 - 1) * speedRandomRange;
      }
      const approachSpeedMult = Math.max(0.4, baseApproachSpeedMult + (this.baitSpeedOffset || 0));

      // 魚の体中心と餌のX座標差
      const bodyDx = nearestBait.x - this.x;
      const bodyDy = nearestBait.y - this.y;

      // ★1フレームごとの高速反転バグを徹底防止！
      // 向き（heading）の判定は口ではなく「体の中心」を基準とし、かつX軸の差が小さい不感帯（±8px以内）では現在の向きを完全固定！
      if (Math.abs(bodyDx) >= 8) {
        this.heading = bodyDx > 0 ? 1 : -1;
      }
      // ※ Math.abs(bodyDx) < 8 の時は現在の this.heading をそのまま維持！

      // 口の位置 (右向きなら進行方向前方・左向きなら後方)
      const mouthOffsetX = (this.heading === 1 ? this.width * 0.42 : -this.width * 0.42);
      const mouthX = this.x + mouthOffsetX;
      const mouthY = this.y;

      const dx = nearestBait.x - mouthX;
      const dy = nearestBait.y - mouthY;
      const distToMouth = Math.hypot(dx, dy);

      // 底の餌かどうか (着底済みまたは海底付近)
      const seabedY = bounds.safeBottom !== undefined ? (bounds.safeBottom - 25) : (bounds.height * 0.72);
      const isSeabedBait = nearestBait.isSettled || nearestBait.y >= seabedY - 30;

      // ★海底の餌へのアプローチ姿勢（口方向が餌に向き、尾びれ側は少し浮く斜め下向き）
      if (isSeabedBait) {
        const targetTilt = this.heading === 1 ? 0.45 : -0.45;
        this.tiltAngle += (targetTilt - this.tiltAngle) * 0.15;
      } else {
        const targetTilt = Math.max(-0.4, Math.min(0.4, Math.atan2(dy, Math.abs(dx) + 1) * 0.5));
        this.tiltAngle += (targetTilt - this.tiltAngle) * 0.1;
      }

      // 到着・接触判定（口との距離が24px以内、または餌に十分重なっている場合）
      if (distToMouth < 24 || (Math.abs(bodyDx) < 20 && Math.abs(bodyDy) < 16)) {
        nearestBait.touch(this);
        this.state = 'eating';
        this.eatingTimer = Math.floor(eatingStaySec * 60);
        this.targetBait = nearestBait;
        this.currentBaitTarget = null;
        this.baitSpeedOffset = 0;
        this.x = nearestBait.x - mouthOffsetX;
        this.y = nearestBait.y;
        this.vx = 0;
        this.vy = 0;
        return;
      } else {
        // 通常の巡航遊泳速度（1.4 * this.speedMultiplier）に設定倍率（approachSpeedMult）を乗算
        const baseCruisingSpeed = 1.4 * this.speedMultiplier;
        const baitSpeed = baseCruisingSpeed * approachSpeedMult;

        // ★万が一X軸方向が一致または極めて近い場合（|bodyDx| < 8）:
        // 現在の向きを保持したままX軸を固定し、まっすぐ斜め下・真下の餌へ口が接触するまで降下！
        if (Math.abs(bodyDx) < 8) {
          this.vx = 0; // X軸固定
          this.vy = Math.sign(bodyDy || 1) * baitSpeed;
        } else {
          const angle = Math.atan2(dy, dx);
          this.vx = Math.cos(angle) * baitSpeed;
          this.vy = Math.sin(angle) * baitSpeed;
        }

        // 深さを同期
        const seaTop = bounds.safeTop !== undefined ? bounds.safeTop : (bounds.height * 0.14);
        const seabed = bounds.safeBottom !== undefined ? (bounds.safeBottom - 35) : (bounds.height * 0.72);
        this.depth = Math.max(0.08, Math.min(0.92, (this.y - seaTop) / Math.max(1, seabed - seaTop)));
        this.targetDepth = this.depth;
        this.x += this.vx;
        this.y += this.vy;
        return;
      }
    } else {
      this.currentBaitTarget = null;
      this.baitSpeedOffset = 0;
    }

    // 餌がない時は自然に水平姿勢へ戻る
    this.tiltAngle += (0 - this.tiltAngle) * 0.08;

    // 4. 寿命（退場処理）：画面内にしっかり出現してから初めてカウントダウンを開始！
    if (this.hasEnteredScreen && this.state !== 'leaving') {
      this.lifetime--;

      // 初心者機能：ターゲット逃走2秒前の点滅通知（画面内に出現してから残り2秒以下で発動）
      const isTargetNow = this.isTargetForCurrentMode();
      if (isTargetNow && this.beginnerAlert && this.lifetime <= 120) {
        this.isBlinkingAlert = true;
      } else {
        this.isBlinkingAlert = false;
      }

      if (this.lifetime <= 0) {
        this.initLeaving(bounds);
      }
    } else {
      this.isBlinkingAlert = false;
    }

    // 優雅にランダムに方向を変えながら画面外に去る退場処理
    if (this.state === 'leaving') {
      this.updateLeaving(bounds);
      return;
    }

    // 5. 水深のアクティブな変動と優雅な上下遊泳（画面内を上下広く泳ぐ）
    if (this.emergingFromBackground) {
      this.targetDepth = 0.32;
      if (this.depth <= 0.45) this.emergingFromBackground = false;
    } else if (Math.random() < 0.025) {
      // 海面(0.08)から海底(0.92)まで上下全体へ目標水深をランダム再設定（Y方向の上下ランダム通過）
      const r = Math.random();
      if (r < 0.33) {
        this.targetDepth = 0.08 + Math.random() * 0.25; // 浅瀬・海面近く
      } else if (r < 0.67) {
        this.targetDepth = 0.35 + Math.random() * 0.30; // 中層
      } else {
        this.targetDepth = 0.68 + Math.random() * 0.24; // 深海・海底近く
      }
    }
    this.depth += (this.targetDepth - this.depth) * 0.03;
    const targetY = this.calculateYFromDepth(bounds);
    this.y += (targetY - this.y) * 0.05;

    // 優雅な上下うねり波
    this.vy = Math.sin(this.finCycle * 0.4) * 0.35 + (targetY - this.y) * 0.03;

    // 画面中央（X軸）の通過保証判定
    const centerX = bounds.width * 0.5;
    if (!this.hasCrossedCenter) {
      if ((this.heading === 1 && this.x >= centerX) || (this.heading === -1 && this.x <= centerX)) {
        this.hasCrossedCenter = true;
      } else {
        // 中央通過までは前進ベクトルを力強く優雅に維持（両サイドでのスタック・逆走を完全防止）
        const forwardMin = 1.2 * this.speedMultiplier;
        this.vx = this.heading * Math.max(forwardMin, Math.abs(this.vx));
      }
    }

    // 通常の遊泳AI & 画面出現判定
    if (this.state === 'entering') {
      this.x += this.vx;

      // PC・スマホの画面サイズ・描画範囲に合わせた正確な「キャラ出現」判定
      // 魚の体全体が画面内にしっかり入った瞬間に進入完了
      const halfW = this.width * 0.5;
      const isFullyOnScreen = (this.heading === 1 && this.x >= halfW) || 
                              (this.heading === -1 && this.x <= bounds.width - halfW);

      if (isFullyOnScreen) {
        this.state = 'swimming';
        this.hasEnteredScreen = true;
        // ★画面に出現した瞬間から、パラメーター通りの滞在時間（6.0秒等）をフルで開始！
        const baseLife = (this.lifetimeSec || 6.0) * 60;
        this.lifetime = Math.floor(baseLife);
      }
    } else {
      // パラメーター設定のランダム反転頻度（※画面中央を通過した後にのみ反転を許可）
      this.turnCheckTimer = (this.turnCheckTimer || 0) + 1;
      if (this.turnCheckTimer >= 60) {
        this.turnCheckTimer = 0;
        if (this.hasCrossedCenter && this.state === 'swimming' && Math.random() < (this.randomTurnRate || 0.02)) {
          this.heading *= -1;
          this.vx = this.heading * Math.abs(this.vx || (1.2 * 0.85 * this.speedMultiplier));
        }
      }

      if (this.type === FISH_TYPES.OCTOPUS || this.type === FISH_TYPES.SQUID) {
        this.updateDisturberAI(bounds, otherFishes, recentTapPos);
      } else if (this.type === FISH_TYPES.STINGRAY) {
        this.updateStingrayAI(bounds, otherFishes);
      } else if (this.type === FISH_TYPES.HIRAME || this.type === FISH_TYPES.KANJI_HIRAME) {
        this.updateHirameAI(bounds, ambientFishes);
      } else if (this.type === FISH_TYPES.KAREI || this.type === FISH_TYPES.KANJI_KAREI_1 || this.type === FISH_TYPES.KANJI_KAREI_2) {
        this.updateKareiAI(bounds);
      } else {
        this.updateGenericAI(bounds);
      }
    }

    // 魚同士のまばら度・ソーシャルディスタンス（まばら度設定連動）
    const dispersion = this.dispersionRate !== undefined ? this.dispersionRate : (this.devConfig?.dispersionRate ?? 0.5);
    if (dispersion > 0 && this.state === 'swimming') {
      for (const other of otherFishes) {
        if (other === this || other.isCaptured || other.isDead || other.state !== 'swimming') continue;
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        const dist = Math.hypot(dx, dy);
        // 魚の体長に応じたパーソナルスペース
        const personalSpace = (this.width + other.width) * 0.6 * (0.5 + dispersion * 0.8);
        if (dist > 0 && dist < personalSpace) {
          const push = ((personalSpace - dist) / personalSpace) * dispersion * 0.12;
          this.vx += (dx / dist) * push;
          this.vy += (dy / dist) * push * 0.5;
        }
      }
    }

    // 魚同士の衝突反発処理（しきい値設定連動: 0なら優雅に通過、>0なら反発インパルス）
    const repulsion = this.collisionRepulsion !== undefined ? this.collisionRepulsion : 0;
    if (repulsion > 0 && this.state === 'swimming') {
      for (const other of otherFishes) {
        if (other === this || other.isCaptured || other.isDead || other.state !== 'swimming') continue;
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minD = (this.width + other.width) * 0.35;
        if (dist > 0 && dist < minD) {
          const push = ((minD - dist) / minD) * repulsion * 0.4;
          this.vx += (dx / dist) * push;
          this.vy += (dy / dist) * push;
        }
      }
    }

    // 座標移動
    this.x += this.vx;
    this.y += this.vy;

    // 上下UIの背面に絶対に入り込まないためのクランプ＆バウンス
    if (this.state !== 'leaving' && this.state !== 'squid_ink_escape') {
      const seaTop = bounds.safeTop !== undefined ? bounds.safeTop : 105;
      const seabed = bounds.safeBottom !== undefined ? bounds.safeBottom : (bounds.height * 0.72);
      const minY = seaTop + this.height * 0.6 + 32;
      const maxY = seabed - this.height * 0.6 - 15;
      if (minY < maxY) {
        if (this.y < minY) {
          this.y = minY;
          this.vy = Math.abs(this.vy || 0.4);
        } else if (this.y > maxY) {
          this.y = maxY;
          this.vy = -Math.abs(this.vy || 0.4);
        }
      }
    }

    // 画面端の折り返し（必ず中央を通過した後、かつleaving中以外）
    const pad = 30;
    if (this.hasCrossedCenter && this.state !== 'leaving' && this.state !== 'entering' && this.state !== 'fleeing_temp') {
      if (this.x < pad) {
        this.x = pad;
        this.vx = Math.abs(this.vx);
        this.heading = 1;
      } else if (this.x > bounds.width - pad) {
        this.x = bounds.width - pad;
        this.vx = -Math.abs(this.vx);
        this.heading = -1;
      }
    }
  }

  // --- 優雅にランダムに方向を変えながら画面外に去る退場初期化 ---
  initLeaving(bounds) {
    this.state = 'leaving';
    this.isBlinkingAlert = false;
    this.leaveTimer = 0;
    this.leaveTurnCount = 0;
    // 途中で身をひるがえす回数は1〜2回（前半に優雅な方向転換を見せる）
    this.leaveMaxTurns = Math.random() < 0.65 ? 1 : 2;
    this.leaveNextTurn = Math.floor(25 + Math.random() * 35); // 25〜60フレーム後に最初の方向転換

    // 退場基本速度 (テンポ良く、かつ優雅に去る速度: 約1.6〜2.6 px/frame)
    const spd = this.speedMultiplier || 1.0;
    this.leaveBaseSpeed = (3.2 + Math.random() * 1.6) * 0.42 * spd;

    // 退場開始時に35%の確率でまず反対向きにヒラリと身をひるがえす（フェイント）
    if (Math.random() < 0.35) {
      this.heading *= -1;
    }
    this.vx = this.heading * this.leaveBaseSpeed;

    // 上下の緩やかな推進ベクトル（上・下・斜め方向へランダムに広がる）
    this.leaveBaseVy = (Math.random() - 0.5) * 1.4 * this.leaveBaseSpeed;
    this.vy = this.leaveBaseVy;

    // 優雅な上下S字波打ち・うねり（sin波）
    this.leaveWaveFreq = 0.06 + Math.random() * 0.04;
    this.leaveWaveAmp = 0.9 + Math.random() * 1.5;
    this.leaveWavePhase = Math.random() * Math.PI * 2;
  }

  // --- 優雅にランダムに方向を変えながら画面外に去る更新処理 ---
  updateLeaving(bounds) {
    this.leaveTimer++;
    this.finCycle += 0.25; // 尾びれをテンポ良く振る
    this.swimCycle = (this.swimCycle || 0) + 0.25;

    const bW = bounds?.width || 800;
    const bH = bounds?.height || 600;

    // 1. ランダムな方向転換（前半にヒラリと向きを変える・蛇行する）
    if (this.leaveTimer >= this.leaveNextTurn && this.leaveTurnCount < this.leaveMaxTurns) {
      this.leaveTurnCount++;
      this.leaveNextTurn = this.leaveTimer + Math.floor(40 + Math.random() * 45);

      const margin = 120;
      const nearLeft = this.x < margin;
      const nearRight = this.x > bW - margin;

      // 画面端に近い場合は画面外へ向かう方向に固定。中央付近ならヒラリと身をひるがえす
      if (nearLeft) {
        this.heading = -1; // 左画面外へ向かう
      } else if (nearRight) {
        this.heading = 1;  // 右画面外へ向かう
      } else {
        this.heading *= -1; // 反転フェイント
      }

      // 上下の進行方向もランダムに切り替え
      this.leaveBaseVy = (Math.random() - 0.5) * 1.6 * this.leaveBaseSpeed;
      this.leaveWavePhase = Math.random() * Math.PI * 2;
    }

    // 徐々にスムーズに加速（去っていく勢い）
    this.leaveBaseSpeed = Math.min(3.8, this.leaveBaseSpeed * 1.004);

    // 2. 優雅な波打ち運動（sin波による上下うねり ＋ 尾びれキックのパルス推進）
    const wave = Math.sin(this.leaveTimer * this.leaveWaveFreq + this.leaveWavePhase) * this.leaveWaveAmp;
    const thrust = 1.0 + Math.sin(this.leaveTimer * this.leaveWaveFreq * 2) * 0.2;

    this.vx = this.heading * this.leaveBaseSpeed * thrust;
    this.vy = this.leaveBaseVy + wave;

    this.x += this.vx;
    this.y += this.vy;

    // 3. 進行方向に応じた優雅な傾き (tiltAngle)
    const moveAngle = Math.atan2(this.vy, Math.abs(this.vx));
    const targetTilt = Math.max(-0.55, Math.min(0.55, (this.heading === 1 ? moveAngle : -moveAngle) * 0.7));
    this.tiltAngle += (targetTilt - this.tiltAngle) * 0.14;

    // 4. 水深の深海フェード（画面の奥へスーッと消えていく立体感）
    if (this.depth < 0.88) {
      this.depth += 0.0022;
    }

    // 5. 画面外完全離脱チェック（魚の体が画面外に抜けたら消滅）
    const padX = this.width * 0.9;
    const padY = this.height * 0.9;
    if (this.x < -padX || this.x > bW + padX || this.y < -padY || this.y > bH + padY) {
      this.isDead = true;
    }
  }

  // --- タコ・イカAI (すばしっこくタップ位置やターゲットに被る) ---
  updateDisturberAI(bounds, otherFishes, recentTapPos) {
    let targetX = null;
    let targetY = null;

    // タップ位置への急行 (直近1.5秒以内のタップがあれば最優先で近寄る)
    if (recentTapPos && (Date.now() - recentTapPos.time < 1500)) {
      targetX = recentTapPos.x;
      targetY = recentTapPos.y;
    } else {
      // 周囲の未捕獲ターゲット（カレイ・ヒラメ・漢字キャラ）を探して重なるように移動
      const targets = otherFishes.filter(f => 
        !f.isCaptured && f.state !== 'squid_ink_escape' &&
        (f.targetCategory === 'hirame' || f.targetCategory === 'karei')
      );
      if (targets.length > 0) {
        let closest = null;
        let cDist = 9999;
        for (const t of targets) {
          const d = Math.hypot(t.x - this.x, t.y - this.y);
          if (d < cDist) {
            cDist = d;
            closest = t;
          }
        }
        if (closest) {
          targetX = closest.x;
          targetY = closest.y;
        }
      }
    }

    if (targetX !== null && targetY !== null) {
      const dx = targetX - this.x;
      const dy = targetY - this.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 22) {
        // すばしっこい急行ダッシュ
        const angle = Math.atan2(dy, dx);
        const spd = (this.type === FISH_TYPES.SQUID ? 4.0 : 3.0) * 0.15 * this.speedMultiplier;
        this.vx = Math.cos(angle) * spd;
        this.vy = Math.sin(angle) * spd;
        this.heading = dx > 0 ? 1 : -1;
      } else {
        // ターゲットの上でぴったりホバリングして邪魔する
        this.vx = (Math.random() - 0.5) * 0.2;
        this.vy = (Math.random() - 0.5) * 0.2;
      }
    } else {
      this.updateGenericAI(bounds);
    }
  }

  // --- エイAI (ゆっくりと左右中心、旋回少なくターゲットに被る) ---
  updateStingrayAI(bounds, otherFishes) {
    // 旋回は極力少なく、左右の水平巡航がメイン
    const glideSpeed = 1.0 * 0.7 * this.speedMultiplier;
    this.vx = this.heading * glideSpeed;

    // X軸が近いターゲット魚を探し、そのY座標（水深）に合わせてゆっくり覆いかぶさる
    const targets = otherFishes.filter(f => 
      !f.isCaptured &&
      (f.targetCategory === 'hirame' || f.targetCategory === 'karei') &&
      Math.abs(f.x - this.x) < 220
    );

    if (targets.length > 0) {
      const target = targets[0];
      const dy = target.y - this.y;
      // ゆっくりターゲットの高さに合わせる
      this.vy = Math.sign(dy) * Math.min(Math.abs(dy) * 0.04, 0.3);
      this.depth += (target.depth - this.depth) * 0.03;
    } else {
      // 緩やかな波打ち上下動
      this.vy = Math.sin(this.finCycle * 0.4) * 0.15;
    }
  }

  // --- ヒラメAI ---
  updateHirameAI(bounds, ambientFishes) {
    if (this.stateTimer <= 0) {
      this.vx = this.heading * (1.1 + Math.random() * 0.7) * 0.85 * this.speedMultiplier;
      this.stateTimer = 90 + Math.random() * 60;
    }
  }

  // --- カレイAI ---
  updateKareiAI(bounds) {
    if (this.stateTimer <= 0) {
      this.vx = this.heading * (1.0 + Math.random() * 0.6) * 0.85 * this.speedMultiplier;
      this.stateTimer = 90 + Math.random() * 60;
    }
  }

  updateGenericAI(bounds) {
    if (this.stateTimer <= 0) {
      this.vx = this.heading * (1.1 + Math.random() * 0.7) * 0.85 * this.speedMultiplier;
      this.stateTimer = 90 + Math.random() * 60;
    }
  }

  containsPoint(px, py) {
    // 捕獲中以外は、逃走中(fleeing_temp)・退場中(leaving)でも画面内にいればタップで捕獲可能！
    if (this.isCaptured) return false;
    const rx = this.width * 0.65;
    const ry = this.height * 0.65;
    const dx = (px - this.x) / rx;
    const dy = (py - this.y) / ry;
    return (dx * dx + dy * dy) <= 1.0;
  }

  capture(bucketPos) {
    this.isCaptured = true;
    this.targetBucketPos = bucketPos;
  }
}
