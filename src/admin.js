// Admin Tool Logic: Judgment Simulator & Vector Character Studio
import { StudioApp } from './studio/studioApp.js';
import { GameRenderer, getFishEyeOffset } from './renderer.js';
import { FISH_TYPES, DEFAULT_CHARACTER_SETTINGS, DEFAULT_AMBIENT_CONFIG, DEFAULT_AMBIENT_TRIGGER, DEFAULT_AMBIENT_PRESETS, DEFAULT_SPAWN_CONDITION, DEFAULT_BUCKETS, DEFAULT_START_CONFIG, DEFAULT_BAIT_CONFIG, DEFAULT_SILHOUETTE_CONFIG, DEFAULT_TEXT_CONFIG } from './fish.js';
import { sound } from './audio.js';
import { DEFAULT_PLAYER_TITLES, DEFAULT_X_SHARE_TEMPLATE, DEFAULT_X_SHARE_TEMPLATES, DEFAULT_TITLE_SCREEN, DEFAULT_MODE_SELECT_SCREEN, DEFAULT_BGM_BANNER_CONFIG, DEFAULT_CHARACTER_LORE, DEFAULT_CHAOS_FEVER_CONFIG, normalizeCharacterLore, applyTextCustomStyles } from './game.js';
import { t } from './i18n.js';
import confetti from 'canvas-confetti';
import { verifyCredentials, isAuthenticated, setAuthenticated, logout, recordLoginLog, getLoginLogs, clearLoginLogs } from './auth.js';
import { trackEvent } from './analytics.js';
import { getOnlineRankingApiUrl, setOnlineRankingApiUrl, testOnlineRankingConnection, migrateLocalScoresToOnline } from './ranking_api.js';

const DEFAULT_CONFIG = {
  onlineRankingApiUrl: '',
  targetFishCount: 40,
  minTargetThreshold: 2,
  refillTargetCount: 6,
  speedMultiplier: 1.0,
  lifetimeSec: 6.0,
  eventScoreThreshold: 150,
  obstacleRate: 25,
  disturberWeights: {
    octopus: 20,
    squid: 20,
    stingray: 20,
    aji_open: 20,
    shitabirame: 20
  },
  randomTurnRate: 0.02,
  dispersionRate: 0.5,
  startConfig: JSON.parse(JSON.stringify(DEFAULT_START_CONFIG)),
  baitConfig: JSON.parse(JSON.stringify(DEFAULT_BAIT_CONFIG)),
  textConfig: JSON.parse(JSON.stringify(DEFAULT_TEXT_CONFIG)),
  silhouetteConfig: JSON.parse(JSON.stringify(DEFAULT_SILHOUETTE_CONFIG)),
  playerTitles: DEFAULT_PLAYER_TITLES,
  xShareTemplate: DEFAULT_X_SHARE_TEMPLATE,
  xShareTemplates: JSON.parse(JSON.stringify(DEFAULT_X_SHARE_TEMPLATES)),
  xShareUrl: '',
  characterLore: JSON.parse(JSON.stringify(DEFAULT_CHARACTER_LORE)),
  titleScreen: JSON.parse(JSON.stringify(DEFAULT_TITLE_SCREEN)),
  modeSelectScreen: JSON.parse(JSON.stringify(DEFAULT_MODE_SELECT_SCREEN)),
  bgmBannerConfig: JSON.parse(JSON.stringify(DEFAULT_BGM_BANNER_CONFIG)),
  characters: { ...DEFAULT_CHARACTER_SETTINGS },
  ambientConfig: JSON.parse(JSON.stringify(DEFAULT_AMBIENT_CONFIG)),
  buckets: JSON.parse(JSON.stringify(DEFAULT_BUCKETS)),
  chaosFeverConfig: JSON.parse(JSON.stringify(DEFAULT_CHAOS_FEVER_CONFIG))
};

const CHARACTER_PRESETS = {
  karei: {
    name: "カレイ (おちょぼ口・水玉・右向き)",
    bodyWidth: 82,
    bodyHeight: 46,
    colorPrimary: "#9c7042",
    colorBelly: "#b58756",
    colorFin: "#704d26",
    jawType: "puckered",
    teethCount: 0,
    eyeSize: 8,
    eyeFacing: "right",
    patternType: "dots",
    patternColor: "#452e18"
  },
  hirame: {
    name: "ヒラメ (獰猛型・左向き)",
    bodyWidth: 90,
    bodyHeight: 48,
    colorPrimary: "#2b261f",
    colorBelly: "#423b32",
    colorFin: "#1e1a14",
    jawType: "predator",
    teethCount: 6,
    eyeSize: 9,
    eyeFacing: "left",
    patternType: "fine_spots",
    patternColor: "#15120e"
  },
  octopus: {
    name: "タコ (墨吐き邪魔キャラ)",
    bodyWidth: 70,
    bodyHeight: 65,
    colorPrimary: "#ef4444",
    colorBelly: "#f87171",
    colorFin: "#b91c1c",
    jawType: "beak",
    teethCount: 0,
    eyeSize: 10,
    eyeFacing: "center",
    patternType: "dots",
    patternColor: "#991b1b"
  },
  squid: {
    name: "イカ (急行邪魔キャラ)",
    bodyWidth: 60,
    bodyHeight: 85,
    colorPrimary: "#e0e7ff",
    colorBelly: "#ffffff",
    colorFin: "#c7d2fe",
    jawType: "none",
    teethCount: 0,
    eyeSize: 9,
    eyeFacing: "center",
    patternType: "stripes",
    patternColor: "#a5b4fc"
  },
  stingray: {
    name: "エイ (大柄シャドウ)",
    bodyWidth: 110,
    bodyHeight: 70,
    colorPrimary: "#334155",
    colorBelly: "#475569",
    colorFin: "#1e293b",
    jawType: "none",
    teethCount: 0,
    eyeSize: 7,
    eyeFacing: "center",
    patternType: "fine_spots",
    patternColor: "#0f172a"
  },
  aji_open: {
    name: "アジの開き (骨・干物罠)",
    bodyWidth: 85,
    bodyHeight: 44,
    colorPrimary: "#d6d3d1",
    colorBelly: "#e7e5e4",
    colorFin: "#a8a29e",
    jawType: "none",
    teethCount: 0,
    eyeSize: 7,
    eyeFacing: "center",
    patternType: "spine",
    patternColor: "#78716c"
  },
  shitabirame: {
    name: "ウシノシタ / シタビラメ (極薄舌状)",
    bodyWidth: 105,
    bodyHeight: 34,
    colorPrimary: "#78350f",
    colorBelly: "#92400e",
    colorFin: "#451a03",
    jawType: "puckered",
    teethCount: 0,
    eyeSize: 6,
    eyeFacing: "left",
    patternType: "stripes",
    patternColor: "#361403"
  },
  boo_chan: {
    name: "ぶーちゃん (豚顔イルカ・スペシャル)",
    bodyWidth: 85,
    bodyHeight: 55,
    colorPrimary: "#f472b6",
    colorBelly: "#fbcfe8",
    colorFin: "#ec4899",
    jawType: "none",
    teethCount: 0,
    eyeSize: 6,
    eyeFacing: "center",
    patternType: "fine_spots",
    patternColor: "#db2777"
  },
  custom: {
    name: "新規オリジナル魚",
    bodyWidth: 80,
    bodyHeight: 50,
    colorPrimary: "#0284c7",
    colorBelly: "#38bdf8",
    colorFin: "#0369a1",
    jawType: "predator",
    teethCount: 4,
    eyeSize: 10,
    eyeFacing: "left",
    patternType: "dots",
    patternColor: "#082f49"
  }
};

window.addEventListener('DOMContentLoaded', () => {
  // BroadcastChannel 準備
  let adminChannel;
  try {
    adminChannel = new BroadcastChannel('hirame_admin_channel');
  } catch (e) {
    console.warn("BroadcastChannel not supported", e);
  }

  // ===== 🔐 管理者認証ゲートウェイ制御 =====
  const adminLoginOverlay = document.getElementById('adminLoginOverlay');
  const adminLoginForm = document.getElementById('adminLoginForm');
  const adminLoginUser = document.getElementById('adminLoginUser');
  const adminLoginPass = document.getElementById('adminLoginPass');
  const btnToggleLoginPass = document.getElementById('btnToggleLoginPass');
  const chkRememberAuth = document.getElementById('chkRememberAuth');
  const adminLoginErrorMsg = document.getElementById('adminLoginErrorMsg');
  const btnLogoutAdmin = document.getElementById('btnLogoutAdmin');
  const btnOpenLoginLogs = document.getElementById('btnOpenLoginLogs');
  const loginLogsModal = document.getElementById('loginLogsModal');
  const btnCloseLoginLogs = document.getElementById('btnCloseLoginLogs');
  const btnCloseLoginLogsFooter = document.getElementById('btnCloseLoginLogsFooter');
  const btnClearLoginLogs = document.getElementById('btnClearLoginLogs');
  const loginLogsTableBody = document.getElementById('loginLogsTableBody');

  function checkAuthGate() {
    if (!isAuthenticated()) {
      if (adminLoginOverlay) {
        adminLoginOverlay.style.display = 'flex';
        adminLoginUser?.focus();
      }
    } else {
      if (adminLoginOverlay) {
        adminLoginOverlay.style.display = 'none';
      }
    }
  }

  // 初回認証チェック
  checkAuthGate();

  // パスワード表示切替
  btnToggleLoginPass?.addEventListener('click', () => {
    if (!adminLoginPass) return;
    const isPass = adminLoginPass.type === 'password';
    adminLoginPass.type = isPass ? 'text' : 'password';
    btnToggleLoginPass.innerText = isPass ? '🙈' : '👁️';
  });

  // ログインフォーム送信
  adminLoginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = adminLoginUser?.value.trim() || '';
    const password = adminLoginPass?.value || '';

    const valid = await verifyCredentials(username, password);
    recordLoginLog(valid, username);

    if (valid) {
      setAuthenticated(chkRememberAuth?.checked);
      if (adminLoginErrorMsg) adminLoginErrorMsg.classList.add('hidden');
      if (adminLoginOverlay) adminLoginOverlay.style.display = 'none';
      trackEvent('admin_login_success', { user: username });
      try { sound.init(); sound.playSuccess(1); } catch (e) {}
    } else {
      if (adminLoginErrorMsg) {
        adminLoginErrorMsg.classList.remove('hidden');
        adminLoginErrorMsg.style.animation = 'none';
        adminLoginErrorMsg.offsetHeight; // reflow
        adminLoginErrorMsg.style.animation = 'shake 0.4s ease';
      }
      trackEvent('admin_login_fail', { user: username });
      try { sound.init(); sound.playError(); } catch (e) {}
    }
  });

  // ログアウト処理
  btnLogoutAdmin?.addEventListener('click', () => {
    if (confirm('管理コンソールからログアウトして画面をロックしますか？')) {
      logout();
      if (adminLoginPass) adminLoginPass.value = '';
      if (adminLoginErrorMsg) adminLoginErrorMsg.classList.add('hidden');
      checkAuthGate();
      trackEvent('admin_logout');
      try { sound.init(); sound.playTap(); } catch (e) {}
    }
  });

  // ログイン履歴ログ モーダル描画＆制御
  function renderLoginLogsTable() {
    if (!loginLogsTableBody) return;
    const logs = getLoginLogs();
    if (logs.length === 0) {
      loginLogsTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:#64748b;">ログイン履歴はまだありません</td></tr>`;
      return;
    }
    loginLogsTableBody.innerHTML = logs.map(l => `
      <tr style="border-bottom:1px solid rgba(255,255,255,0.06);">
        <td style="padding:8px 6px; color:#cbd5e1; white-space:nowrap;">${l.dateStr}</td>
        <td style="padding:8px 6px; font-weight:800; color:${l.success ? '#34d399' : '#f87171'}; white-space:nowrap;">
          ${l.success ? '✅ 成功' : '❌ 失敗'}
        </td>
        <td style="padding:8px 6px; font-family:monospace; color:#f1f5f9;">${(l.user || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m])}</td>
        <td style="padding:8px 6px; color:#94a3b8; font-size:11px;">${(l.device || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m])}</td>
      </tr>
    `).join('');
  }

  btnOpenLoginLogs?.addEventListener('click', () => {
    renderLoginLogsTable();
    loginLogsModal?.classList.remove('hidden');
    try { sound.init(); sound.playTap(); } catch (e) {}
  });

  const closeLoginLogsModal = () => loginLogsModal?.classList.add('hidden');
  btnCloseLoginLogs?.addEventListener('click', closeLoginLogsModal);
  btnCloseLoginLogsFooter?.addEventListener('click', closeLoginLogsModal);
  loginLogsModal?.addEventListener('click', (e) => {
    if (e.target === loginLogsModal) closeLoginLogsModal();
  });

  btnClearLoginLogs?.addEventListener('click', () => {
    if (confirm('すべてのログイン履歴ログを消去しますか？')) {
      clearLoginLogs();
      renderLoginLogsTable();
      try { sound.init(); sound.playTap(); } catch (e) {}
    }
  });

  // ===== キャラクタースタジオ インスタンス変数 =====
  let studioApp = null;
  const studioRoot = document.getElementById('characterStudioContainer');

  // ===== タブ切替 =====
  const tabSimBtn = document.getElementById('tabSimBtn');
  const tabStudioBtn = document.getElementById('tabStudioBtn');
  const simulatorSection = document.getElementById('simulatorSection');
  const studioSection = document.getElementById('studioSection');

  tabSimBtn.addEventListener('click', () => {
    tabSimBtn.classList.add('active');
    tabStudioBtn.classList.remove('active');
    simulatorSection.classList.add('active');
    simulatorSection.classList.remove('hidden');
    studioSection.classList.remove('active');
    studioSection.classList.add('hidden');
  });

  tabStudioBtn.addEventListener('click', () => {
    tabStudioBtn.classList.add('active');
    tabSimBtn.classList.remove('active');
    studioSection.classList.add('active');
    studioSection.classList.remove('hidden');
    simulatorSection.classList.remove('active');
    simulatorSection.classList.add('hidden');

    if (!studioApp && studioRoot) {
      try {
        studioApp = new StudioApp(studioRoot);
        window.studioApp = studioApp;
      } catch (err) {
        console.error('Lazy StudioApp init error:', err);
      }
    }

    setTimeout(() => {
      if (studioApp && studioApp.editor) {
        studioApp.editor.fitViewport();
        studioApp.syncNavigator?.();
      }
    }, 60);
  });

  // ===== サブタブ切替 (パラメーター / BGM / 称号 / Xシェア / タイトル＆モード画面 / ランキング管理) =====
  let updateTitleModeMockup = () => { };
  const subTabButtons = document.querySelectorAll('.sub-tab-btn');
  const previewFishTankContainer = document.getElementById('previewFishTankContainer');
  const previewTitleModeRightNotice = document.getElementById('previewTitleModeRightNotice');

  const subPanels = {
    params: document.getElementById('subPanelParams'),
    textConfig: document.getElementById('subPanelTextConfig'),
    bgm: document.getElementById('subPanelBgm'),
    titles: document.getElementById('subPanelTitles'),
    xshare: document.getElementById('subPanelXShare'),
    titleMode: document.getElementById('subPanelTitleMode'),
    ranking: document.getElementById('subPanelRanking'),
    lore: document.getElementById('subPanelLore'),
    ambient: document.getElementById('subPanelAmbient')
  };

  subTabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      try { sound.init(); sound.playTap(); } catch (e) { }
      const target = btn.dataset.subtab;
      subTabButtons.forEach(b => b.classList.toggle('active', b === btn));
      Object.entries(subPanels).forEach(([key, panel]) => {
        if (!panel) return;
        if (key === target) {
          panel.classList.add('active');
          panel.classList.remove('hidden');
        } else {
          panel.classList.remove('active');
          panel.classList.add('hidden');
        }
      });

      // 右側プレビューカードの切替
      if (target === 'titleMode') {
        if (previewFishTankContainer) previewFishTankContainer.classList.add('hidden');
        if (previewTitleModeRightNotice) previewTitleModeRightNotice.classList.remove('hidden');
        updateTitleModeMockup();
      } else {
        if (previewFishTankContainer) previewFishTankContainer.classList.remove('hidden');
        if (previewTitleModeRightNotice) previewTitleModeRightNotice.classList.add('hidden');
      }

      if (target === 'ranking' && typeof window.renderRankingManager === 'function') {
        window.renderRankingManager();
      }
      if (target === 'lore' && typeof window.renderLoreManager === 'function') {
        window.renderLoreManager();
      }
      if (target === 'ambient' && typeof window.renderAmbientManager === 'function') {
        window.renderAmbientManager();
      }
    });
  });

  // パラメーター設定内の案内ボタンから「演出テキスト」タブへジャンプ
  document.querySelectorAll('.btn-jump-to-text-config').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetBtn = document.querySelector('.sub-tab-btn[data-subtab="textConfig"]');
      if (targetBtn) {
        targetBtn.click();
      }
    });
  });

  // ===== 判定シミュレーター ロジック (個別キャラ設定・役割切替・共通一括適用) =====
  // 0. ゲームバランスON/OFF ＆ モード切替コントロール
  const btnToggleGameBalance = document.getElementById('btnToggleGameBalance');
  const balanceIcon = document.getElementById('balanceIcon');
  const balanceText = document.getElementById('balanceText');
  const balanceNoticeBanner = document.getElementById('balanceNoticeBanner');
  const modePillButtons = document.querySelectorAll('.mode-pill-btn');

  // 1. キャラクター選択
  const charSelectPills = document.getElementById('charSelectPills');
  const activeCharBadge = document.getElementById('activeCharBadge');

  // 2. 役割切り替えスイッチ ＆ バケツ管理
  const charRoleButtonsContainer = document.getElementById('charRoleButtonsContainer');
  const roleBtnTarget = document.getElementById('roleBtnTarget');
  const roleBtnDisturber = document.getElementById('roleBtnDisturber');
  const charRoleDesc = document.getElementById('charRoleDesc');
  const adminBucketList = document.getElementById('adminBucketList');
  const btnAddBucketBtn = document.getElementById('btnAddBucketBtn');

  // ヘッダー & マトリクス「現在の設定をセット」ボタン
  const btnHeaderCommitToGame = document.getElementById('btnHeaderCommitToGame');
  const btnMatrixCommitToGame = document.getElementById('btnMatrixCommitToGame');

  // 2.5 ポイント設定 (獲得 / 減点スコア)
  const charPointBadge = document.getElementById('charPointBadge');
  const btnPointSignPlus = document.getElementById('btnPointSignPlus');
  const btnPointSignMinus = document.getElementById('btnPointSignMinus');
  const charPointInput = document.getElementById('charPointInput');
  const pointPresetButtons = document.querySelectorAll('.btn-point-preset');

  // 3. 共通設定コントロール
  const btnApplyCommonToAll = document.getElementById('btnApplyCommonToAll');
  const charSizeScale = document.getElementById('charSizeScale');
  const charSizeScaleVal = document.getElementById('charSizeScaleVal');
  const charCount = document.getElementById('charCount');
  const charCountVal = document.getElementById('charCountVal');
  const charMinTargetThreshold = document.getElementById('charMinTargetThreshold');
  const charMinTargetThresholdVal = document.getElementById('charMinTargetThresholdVal');
  const charSpeed = document.getElementById('charSpeed');
  const charSpeedVal = document.getElementById('charSpeedVal');
  const charLifetime = document.getElementById('charLifetime');
  const charLifetimeVal = document.getElementById('charLifetimeVal');
  const charRandomTurnRate = document.getElementById('charRandomTurnRate');
  const charRandomTurnRateVal = document.getElementById('charRandomTurnRateVal');

  // プリセットボタン
  const sizePresetButtons = document.querySelectorAll('.btn-size-preset');
  const speedPresetButtons = document.querySelectorAll('.btn-speed-preset');

  // 4. ターゲット専用設定
  const panelTargetSettings = document.getElementById('panelTargetSettings');
  const targetBadgeStatus = document.getElementById('targetBadgeStatus');
  const charBeginnerAlert = document.getElementById('charBeginnerAlert');
  const charBeginnerAlertVal = document.getElementById('charBeginnerAlertVal');

  // 出現条件設定コントロール
  const btnToggleSpawnCondition = document.getElementById('btnToggleSpawnCondition');
  const spawnConditionBody = document.getElementById('spawnConditionBody');
  const charCondTime = document.getElementById('charCondTime');
  const charCondTimeVal = document.getElementById('charCondTimeVal');
  const charCondOrigin = document.getElementById('charCondOrigin');
  const charCondTriggerAction = document.getElementById('charCondTriggerAction');
  const charCondSpecificCharWrap = document.getElementById('charCondSpecificCharWrap');
  const charCondSpecificCharList = document.getElementById('charCondSpecificCharList');
  const charCondTapCountGroup = document.getElementById('charCondTapCountGroup');
  const charCondTapCount = document.getElementById('charCondTapCount');
  const charCondTapCountVal = document.getElementById('charCondTapCountVal');
  const charCondComboToggle = document.getElementById('charCondComboToggle');
  const charCondProbability = document.getElementById('charCondProbability');
  const charCondProbabilityVal = document.getElementById('charCondProbabilityVal');
  const charCondRepeatCount = document.getElementById('charCondRepeatCount');
  const charCondRepeatCountVal = document.getElementById('charCondRepeatCountVal');
  const chkCharCondTapCountEnabled = document.getElementById('chkCharCondTapCountEnabled');
  const chkCharCondShowAlert = document.getElementById('chkCharCondShowAlert');
  const chkCharCondMatchAny = document.getElementById('chkCharCondMatchAny');
  const chkCharCondAll = document.getElementById('chkCharCondAll');
  const chkCharCondScore = document.getElementById('chkCharCondScore');
  const chkCharCondTargetTaps = document.getElementById('chkCharCondTargetTaps');
  const chkCharCondTime = document.getElementById('chkCharCondTime');

  // 全モード適用 ＆ 設定一覧マトリクス要素
  const btnApplyCharToAllModes = document.getElementById('btnApplyCharToAllModes');
  const btnOpenConfigMatrixModal = document.getElementById('btnOpenConfigMatrixModal');
  const configMatrixModal = document.getElementById('configMatrixModal');
  const closeMatrixModalBtn = document.getElementById('btnCloseMatrixModal');
  const btnMatrixCloseBottom = document.getElementById('btnMatrixCloseBottom');
  const configMatrixTable = document.getElementById('configMatrixTable');
  const btnMatrixApplyCurrentModeToAll = document.getElementById('btnMatrixApplyCurrentModeToAll');
  const btnMatrixExportJson = document.getElementById('btnMatrixExportJson');
  const btnMatrixImportJson = document.getElementById('btnMatrixImportJson');
  const matrixJsonFileInput = document.getElementById('matrixJsonFileInput');

  // 5. 邪魔キャラ専用設定
  const panelDisturberSettings = document.getElementById('panelDisturberSettings');
  const disturberBadgeStatus = document.getElementById('disturberBadgeStatus');
  const charDisturberWeight = document.getElementById('charDisturberWeight');
  const charDisturberWeightVal = document.getElementById('charDisturberWeightVal');
  const charDisturberScoreThreshold = document.getElementById('charDisturberScoreThreshold');
  const charDisturberScoreThresholdVal = document.getElementById('charDisturberScoreThresholdVal');

  // 6. 背景演出サージトリガー設定 (全キャラ対応)
  const panelAmbientTriggerSettings = document.getElementById('panelAmbientTriggerSettings');
  const btnToggleCharAmbientTrigger = document.getElementById('btnToggleCharAmbientTrigger');
  const charAmbientTriggerBody = document.getElementById('charAmbientTriggerBody');
  const charAmbTriggerTapCount = document.getElementById('charAmbTriggerTapCount');
  const charAmbTriggerTapCountInput = document.getElementById('charAmbTriggerTapCountInput');
  const charAmbTriggerTapCountVal = document.getElementById('charAmbTriggerTapCountVal');
  const charAmbTriggerPercentage = document.getElementById('charAmbTriggerPercentage');
  const charAmbTriggerPercentageInput = document.getElementById('charAmbTriggerPercentageInput');
  const charAmbTriggerPercentageVal = document.getElementById('charAmbTriggerPercentageVal');
  const btnAmbDirectionIncrease = document.getElementById('btnAmbDirectionIncrease');
  const btnAmbDirectionDecrease = document.getElementById('btnAmbDirectionDecrease');
  const charAmbTriggerDuration = document.getElementById('charAmbTriggerDuration');
  const charAmbTriggerDurationInput = document.getElementById('charAmbTriggerDurationInput');
  const charAmbTriggerDurationVal = document.getElementById('charAmbTriggerDurationVal');
  const charAmbPresetChecklist = document.getElementById('charAmbPresetChecklist');

  // アクションボタン
  const applySimBtn = document.getElementById('applySimBtn');
  const btnSaveAsDefault = document.getElementById('btnSaveAsDefault');
  const resetSimBtn = document.getElementById('resetSimBtn');
  const syncStatusBadge = document.getElementById('syncStatusBadge');

  // カオスフィーバー設定要素
  const chaosFeverEnabled = document.getElementById('chaosFeverEnabled');
  const chaosFeverTriggerTime = document.getElementById('chaosFeverTriggerTime');
  const chaosFeverTriggerTimeVal = document.getElementById('chaosFeverTriggerTimeVal');
  const chaosFeverMaxScreen = document.getElementById('chaosFeverMaxScreen');
  const chaosFeverMaxScreenVal = document.getElementById('chaosFeverMaxScreenVal');
  const chaosFeverConfetti = document.getElementById('chaosFeverConfetti');
  const chaosFeverCharList = document.getElementById('chaosFeverCharList');
  const btnTestChaosFever = document.getElementById('btnTestChaosFever');
  const chaosFeverBody = document.getElementById('chaosFeverBody');

  function createDefaultModeConfig(mode = 'karei') {
    const chars = JSON.parse(JSON.stringify(DEFAULT_CHARACTER_SETTINGS));
    for (const k of Object.keys(chars)) {
      chars[k].role = 'disturber';
      chars[k].pointValue = -5;
    }
    // スペシャルキャラ「ぶーちゃん」は全モードで捕獲対象ターゲット ＆ 唯一デフォルトで「◯◯出現！」ON
    if (chars.boo_chan) {
      chars.boo_chan.role = 'target';
      chars.boo_chan.pointValue = 10;
      chars.boo_chan.spawnCondition = {
        enabled: true,
        condScoreEnabled: false,
        condTargetTapsEnabled: true,
        condTimeEnabled: false,
        timeSec: 0,
        origin: 'silhouette',
        triggerAction: 'tap_target',
        targetCharacters: [],
        tapCount: 10,
        showAlert: true, // ぶーちゃんのみ全モード共通でデフォルト「◯◯出現！」ON
        isCombo: false,
        probability: 100,
        repeatCount: 0
      };
    }

    if (mode === 'karei') {
      if (chars.karei) { chars.karei.role = 'bucketA'; chars.karei.pointValue = 10; }
      if (chars.kanji_karei_1) { chars.kanji_karei_1.role = 'bucketA'; chars.kanji_karei_1.pointValue = 10; }
      if (chars.kanji_karei_2) { chars.kanji_karei_2.role = 'bucketA'; chars.kanji_karei_2.pointValue = 10; }
      if (chars.hirame) { chars.hirame.role = 'bucketB'; chars.hirame.pointValue = 10; }
      if (chars.kanji_hirame) { chars.kanji_hirame.role = 'bucketB'; chars.kanji_hirame.pointValue = 10; }
    } else if (mode === 'hirame') {
      if (chars.hirame) { chars.hirame.role = 'bucketB'; chars.hirame.pointValue = 10; }
      if (chars.kanji_hirame) { chars.kanji_hirame.role = 'bucketB'; chars.kanji_hirame.pointValue = 10; }
      if (chars.karei) { chars.karei.role = 'bucketA'; chars.karei.pointValue = 10; }
      if (chars.kanji_karei_1) { chars.kanji_karei_1.role = 'bucketA'; chars.kanji_karei_1.pointValue = 10; }
      if (chars.kanji_karei_2) { chars.kanji_karei_2.role = 'bucketA'; chars.kanji_karei_2.pointValue = 10; }
    } else if (mode === 'hirai') {
      if (chars.karei) { chars.karei.role = 'bucketA'; chars.karei.pointValue = 10; }
      if (chars.kanji_karei_1) { chars.kanji_karei_1.role = 'bucketA'; chars.kanji_karei_1.pointValue = 10; }
      if (chars.kanji_karei_2) { chars.kanji_karei_2.role = 'bucketA'; chars.kanji_karei_2.pointValue = 10; }
      if (chars.hirame) { chars.hirame.role = 'bucketB'; chars.hirame.pointValue = 10; }
      if (chars.kanji_hirame) { chars.kanji_hirame.role = 'bucketB'; chars.kanji_hirame.pointValue = 10; }
    }
    return {
      timeLimitSec: 60,
      maxScreenFishes: 20,
      targetFishCount: 20,
      minTargetThreshold: 2,
      speedMultiplier: 1.0,
      lifetimeSec: 6.0,
      randomTurnRate: 0.02,
      characters: chars
    };
  }

  // 設定読み込み
  function loadConfig() {
    let base = {
      ...DEFAULT_CONFIG,
      timeLimitSec: 60,
      maxScreenFishes: 20,
      gameBalanceUnified: false,
      activeConfigMode: 'karei',
      modeConfigs: {
        karei: createDefaultModeConfig('karei'),
        hirame: createDefaultModeConfig('hirame'),
        hirai: createDefaultModeConfig('hirai')
      },
      playerTitles: DEFAULT_PLAYER_TITLES,
      xShareTemplate: DEFAULT_X_SHARE_TEMPLATE,
      xShareUrl: '',
      titleScreen: JSON.parse(JSON.stringify(DEFAULT_TITLE_SCREEN)),
      modeSelectScreen: JSON.parse(JSON.stringify(DEFAULT_MODE_SELECT_SCREEN)),
      bgmBannerConfig: JSON.parse(JSON.stringify(DEFAULT_BGM_BANNER_CONFIG)),
      characters: { ...DEFAULT_CHARACTER_SETTINGS },
      chaosFeverConfig: JSON.parse(JSON.stringify(DEFAULT_CHAOS_FEVER_CONFIG))
    };

    try {
      let saved = localStorage.getItem('hirame_dev_config');
      if (!saved) {
        saved = localStorage.getItem('hirame_custom_default_config');
      }
      if (saved) {
        const parsed = JSON.parse(saved);
        const characters = { ...DEFAULT_CHARACTER_SETTINGS };
        if (parsed.characters) {
          for (const [k, v] of Object.entries(parsed.characters)) {
            const defChar = DEFAULT_CHARACTER_SETTINGS[k] || {};
            characters[k] = {
              ...defChar,
              ...v,
              spawnCondition: {
                ...(defChar.spawnCondition || DEFAULT_SPAWN_CONDITION),
                ...(v.spawnCondition || {})
              },
              ambientTrigger: {
                ...(defChar.ambientTrigger || DEFAULT_AMBIENT_TRIGGER),
                ...(v.ambientTrigger || {})
              }
            };
          }
        }

        const mergedAmbientConfig = {
          ...JSON.parse(JSON.stringify(DEFAULT_AMBIENT_CONFIG)),
          ...(parsed.ambientConfig || {}),
          bubbles: {
            ...DEFAULT_AMBIENT_CONFIG.bubbles,
            ...(parsed.ambientConfig?.bubbles || {})
          },
          smallFish: {
            ...DEFAULT_AMBIENT_CONFIG.smallFish,
            ...(parsed.ambientConfig?.smallFish || {})
          },
          presets: parsed.ambientConfig?.presets || JSON.parse(JSON.stringify(DEFAULT_AMBIENT_CONFIG.presets))
        };

        const mergeModeChars = (modeName) => {
          const defaultChars = createDefaultModeConfig(modeName).characters;
          const parsedChars = parsed.modeConfigs?.[modeName]?.characters || {};
          const result = { ...defaultChars };
          for (const [k, v] of Object.entries(parsedChars)) {
            const defChar = defaultChars[k] || DEFAULT_CHARACTER_SETTINGS[k] || {};
            result[k] = {
              ...defChar,
              ...v,
              spawnCondition: {
                ...(defChar.spawnCondition || DEFAULT_SPAWN_CONDITION),
                ...(v.spawnCondition || {})
              },
              ambientTrigger: {
                ...(defChar.ambientTrigger || DEFAULT_AMBIENT_TRIGGER),
                ...(v.ambientTrigger || {})
              }
            };
          }
          return result;
        };

        base = {
          ...base,
          ...parsed,
          characters,
          startConfig: {
            ...JSON.parse(JSON.stringify(DEFAULT_START_CONFIG)),
            ...(parsed.startConfig || {})
          },
          baitConfig: {
            ...JSON.parse(JSON.stringify(DEFAULT_BAIT_CONFIG)),
            ...(parsed.baitConfig || {})
          },
          ambientConfig: mergedAmbientConfig,
          chaosFeverConfig: {
            ...JSON.parse(JSON.stringify(DEFAULT_CHAOS_FEVER_CONFIG)),
            ...(parsed.chaosFeverConfig || {})
          },
          buckets: (parsed.buckets && parsed.buckets.length > 0) ? parsed.buckets : JSON.parse(JSON.stringify(DEFAULT_BUCKETS)),
          playerTitles: parsed.playerTitles || DEFAULT_PLAYER_TITLES,
          xShareTemplate: parsed.xShareTemplate || DEFAULT_X_SHARE_TEMPLATE,
          xShareTemplates: {
            ...DEFAULT_X_SHARE_TEMPLATES,
            ...(parsed.xShareTemplates || {})
          },
          xShareUrl: parsed.xShareUrl || '',
          characterLore: normalizeCharacterLore(parsed.characterLore),
          bgmBannerConfig: {
            ...DEFAULT_BGM_BANNER_CONFIG,
            ...(parsed.bgmBannerConfig || {})
          },
          titleScreen: {
            ...JSON.parse(JSON.stringify(DEFAULT_TITLE_SCREEN)),
            ...(parsed.titleScreen || {}),
            mainTitle: {
              ...DEFAULT_TITLE_SCREEN.mainTitle,
              ...(parsed.titleScreen?.mainTitle || {}),
              textByLang: {
                ...DEFAULT_TITLE_SCREEN.mainTitle.textByLang,
                ...(parsed.titleScreen?.mainTitle?.textByLang || {})
              }
            },
            subTitle: {
              ...DEFAULT_TITLE_SCREEN.subTitle,
              ...(parsed.titleScreen?.subTitle || {}),
              textByLang: {
                ...DEFAULT_TITLE_SCREEN.subTitle.textByLang,
                ...(parsed.titleScreen?.subTitle?.textByLang || {})
              }
            },
            credits: {
              ...DEFAULT_TITLE_SCREEN.credits,
              ...(parsed.titleScreen?.credits || {})
            }
          },
          modeSelectScreen: {
            ...JSON.parse(JSON.stringify(DEFAULT_MODE_SELECT_SCREEN)),
            ...(parsed.modeSelectScreen || {}),
            masterSpeechByLang: {
              ...DEFAULT_MODE_SELECT_SCREEN.masterSpeechByLang,
              ...(parsed.modeSelectScreen?.masterSpeechByLang || {})
            },
            modes: {
              karei: {
                ...DEFAULT_MODE_SELECT_SCREEN.modes.karei,
                ...(parsed.modeSelectScreen?.modes?.karei || {}),
                nameByLang: {
                  ...DEFAULT_MODE_SELECT_SCREEN.modes.karei.nameByLang,
                  ...(parsed.modeSelectScreen?.modes?.karei?.nameByLang || {})
                },
                descByLang: {
                  ...DEFAULT_MODE_SELECT_SCREEN.modes.karei.descByLang,
                  ...(parsed.modeSelectScreen?.modes?.karei?.descByLang || {})
                }
              },
              hirame: {
                ...DEFAULT_MODE_SELECT_SCREEN.modes.hirame,
                ...(parsed.modeSelectScreen?.modes?.hirame || {}),
                nameByLang: {
                  ...DEFAULT_MODE_SELECT_SCREEN.modes.hirame.nameByLang,
                  ...(parsed.modeSelectScreen?.modes?.hirame?.nameByLang || {})
                },
                descByLang: {
                  ...DEFAULT_MODE_SELECT_SCREEN.modes.hirame.descByLang,
                  ...(parsed.modeSelectScreen?.modes?.hirame?.descByLang || {})
                }
              },
              hirai: {
                ...DEFAULT_MODE_SELECT_SCREEN.modes.hirai,
                ...(parsed.modeSelectScreen?.modes?.hirai || {}),
                nameByLang: {
                  ...DEFAULT_MODE_SELECT_SCREEN.modes.hirai.nameByLang,
                  ...(parsed.modeSelectScreen?.modes?.hirai?.nameByLang || {})
                },
                descByLang: {
                  ...DEFAULT_MODE_SELECT_SCREEN.modes.hirai.descByLang,
                  ...(parsed.modeSelectScreen?.modes?.hirai?.descByLang || {})
                }
              }
            }
          },
          gameBalanceUnified: parsed.gameBalanceUnified !== undefined ? parsed.gameBalanceUnified : false,
          activeConfigMode: parsed.activeConfigMode || 'karei',
          modeConfigs: {
            karei: {
              ...createDefaultModeConfig('karei'),
              ...(parsed.modeConfigs?.karei || {}),
              characters: mergeModeChars('karei')
            },
            hirame: {
              ...createDefaultModeConfig('hirame'),
              ...(parsed.modeConfigs?.hirame || {}),
              characters: mergeModeChars('hirame')
            },
            hirai: {
              ...createDefaultModeConfig('hirai'),
              ...(parsed.modeConfigs?.hirai || {}),
              characters: mergeModeChars('hirai')
            }
          }
        };
      }
    } catch (e) {
      console.error(e);
    }
    return base;
  }

  let currentConfig = loadConfig();
  // 全パラメーター設定をデフォルトとして確実に保持・同期
  try {
    localStorage.setItem('hirame_custom_default_config', JSON.stringify(currentConfig));
  } catch (e) { }
  let activeCharId = 'karei';
  let matrixCurrentMode = currentConfig.activeConfigMode || 'karei';

  // 基本キャラ種別 (カレイ -> ヒラメ順)
  const BUILTIN_CHAR_LIST = [
    { id: 'karei', name: '🐟 カレイ' },
    { id: 'hirame', name: '🐟 ヒラメ' },
    { id: 'boo_chan', name: '🐷 ぶーちゃん (豚顔イルカ)' },
    { id: 'octopus', name: '🐙 タコ' },
    { id: 'squid', name: '🦑 イカ' },
    { id: 'stingray', name: '🌊 エイ' },
    { id: 'aji_open', name: '🐟 アジの開き' },
    { id: 'shitabirame', name: '👞 ウシノシタ' },
    { id: 'kanji_karei_1', name: '🔤 漢字・鰈' },
    { id: 'kanji_karei_2', name: '🔤 漢字・魪' },
    { id: 'kanji_hirame', name: '🔤 漢字・鮃' }
  ];

  function getAllAvailableCharacters() {
    let roster = {};
    try {
      const saved = localStorage.getItem('hirame_custom_roster');
      if (saved) roster = JSON.parse(saved);
    } catch (e) { }

    const list = [...BUILTIN_CHAR_LIST];
    for (const [id, char] of Object.entries(roster)) {
      if (!list.some(item => item.id === id)) {
        list.push({ id, name: `✨ ${char.name || id}` });
      }
    }
    return list;
  }

  let simFishes = [];
  let simConsecutiveMisses = 0;

  function getActiveCharactersDict() {
    const mode = currentConfig.activeConfigMode || 'karei';
    if (!currentConfig.modeConfigs) currentConfig.modeConfigs = {};
    if (!currentConfig.modeConfigs[mode]) currentConfig.modeConfigs[mode] = createDefaultModeConfig(mode);
    if (!currentConfig.modeConfigs[mode].characters) {
      currentConfig.modeConfigs[mode].characters = createDefaultModeConfig(mode).characters;
    }
    return currentConfig.modeConfigs[mode].characters;
  }

  function getActiveCharConfig() {
    const charsDict = getActiveCharactersDict();
    if (!charsDict[activeCharId]) {
      const isDefaultTarget = (activeCharId === 'boo_chan' || activeCharId === 'karei' || activeCharId === 'hirame' || activeCharId.startsWith('kanji_'));
      charsDict[activeCharId] = {
        name: activeCharId,
        role: isDefaultTarget ? 'target' : 'disturber',
        pointValue: isDefaultTarget ? 10 : -5,
        count: 20,
        minTargetThreshold: 2,
        speedMultiplier: 1.0,
        lifetimeSec: 6.0,
        randomTurnRate: 0.02,
        sizeScale: 1.0,
        beginnerAlert: true,
        weight: 20,
        scoreThreshold: 150,
        spawnCondition: {
          enabled: false,
          timeSec: 0,
          origin: 'silhouette',
          triggerAction: 'tap_target',
          targetCharacters: [],
          tapCount: 10,
          isCombo: false,
          probability: 100,
          repeatCount: 0
        }
      };
    }
    if (charsDict[activeCharId].pointValue === undefined) {
      charsDict[activeCharId].pointValue = (charsDict[activeCharId].role === 'target') ? 10 : -5;
    }
    if (!charsDict[activeCharId].spawnCondition) {
      charsDict[activeCharId].spawnCondition = {
        enabled: false,
        timeSec: 0,
        origin: 'silhouette',
        triggerAction: 'tap_target',
        targetCharacters: [],
        tapCount: 10,
        isCombo: false,
        probability: 100,
        repeatCount: 0
      };
    } else {
      if (charsDict[activeCharId].spawnCondition.repeatCount === undefined) {
        charsDict[activeCharId].spawnCondition.repeatCount = 0;
      }
      if (charsDict[activeCharId].spawnCondition.isCombo === undefined) {
        charsDict[activeCharId].spawnCondition.isCombo = false;
      }
    }
    if (!charsDict[activeCharId].ambientTrigger) {
      const defTrig = DEFAULT_CHARACTER_SETTINGS[activeCharId]?.ambientTrigger || DEFAULT_AMBIENT_TRIGGER;
      charsDict[activeCharId].ambientTrigger = JSON.parse(JSON.stringify(defTrig));
    }
    return charsDict[activeCharId];
  }

  function renderSpecificCharChecklist(selectedIds = []) {
    if (!charCondSpecificCharList) return;
    const allChars = getAllAvailableCharacters();
    charCondSpecificCharList.innerHTML = allChars.map(c => `
      <label class="char-check-label">
        <input type="checkbox" value="${c.id}" ${selectedIds.includes(c.id) ? 'checked' : ''}>
        <span>${c.name}</span>
      </label>
    `).join('');

    charCondSpecificCharList.querySelectorAll('input[type="checkbox"]').forEach(chk => {
      chk.addEventListener('change', () => {
        const cfg = getActiveCharConfig();
        if (!cfg.spawnCondition) cfg.spawnCondition = {};
        const checkedBoxes = Array.from(charCondSpecificCharList.querySelectorAll('input[type="checkbox"]:checked'));
        cfg.spawnCondition.targetCharacters = checkedBoxes.map(cb => cb.value);
        saveCurrentConfigToStorage();
      });
    });
  }

  function renderAmbientPresetChecklist(selectedPresets = ['bubbles', 'small_fish']) {
    if (!charAmbPresetChecklist) return;
    const presets = currentConfig.ambientConfig?.presets || DEFAULT_AMBIENT_PRESETS;
    charAmbPresetChecklist.innerHTML = presets.map(p => `
      <label class="char-check-label" style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:13px; margin-bottom:6px;">
        <input type="checkbox" value="${p.id}" ${selectedPresets.includes(p.id) ? 'checked' : ''} class="char-amb-preset-cb" style="cursor:pointer; width:16px; height:16px;">
        <span>${p.icon || (p.type === 'bubbles' ? '🫧' : p.type === 'small_fish' ? '🐟' : '🎨')} ${p.name}</span>
      </label>
    `).join('');

    charAmbPresetChecklist.querySelectorAll('.char-amb-preset-cb').forEach(chk => {
      chk.addEventListener('change', () => {
        const cfg = getActiveCharConfig();
        if (!cfg.ambientTrigger) cfg.ambientTrigger = {};
        const checkedBoxes = Array.from(charAmbPresetChecklist.querySelectorAll('.char-amb-preset-cb:checked'));
        cfg.ambientTrigger.targetPresets = checkedBoxes.map(cb => cb.value);
        saveCurrentConfigToStorage();
      });
    });
  }

  function updateBalanceUI() {
    const isUnified = currentConfig.gameBalanceUnified !== false;
    const mode = currentConfig.activeConfigMode || 'karei';
    const modeNames = { karei: 'カレイ派', hirame: 'ヒラメ派', hirai: 'ヒライ派' };

    if (btnToggleGameBalance) {
      btnToggleGameBalance.className = isUnified ? 'btn-balance-toggle active-unified' : 'btn-balance-toggle active-separated';
      if (balanceIcon) balanceIcon.innerText = isUnified ? '⚖️' : '🎮';
      if (balanceText) balanceText.innerText = isUnified ? 'ON (全モード共通)' : 'OFF (モード別設定)';
    }

    if (balanceNoticeBanner) {
      if (isUnified) {
        balanceNoticeBanner.className = 'balance-notice-banner';
        balanceNoticeBanner.innerHTML = '<span>⚡ <strong>ゲームバランス: ON</strong>（全モード共通のパラメーターを設定しています）</span>';
      } else {
        balanceNoticeBanner.className = 'balance-notice-banner notice-separated';
        balanceNoticeBanner.innerHTML = `<span>🎮 <strong>ゲームバランス: OFF</strong>（「<strong>${modeNames[mode] || mode}</strong>」専用のパラメーターを設定・保存中）</span>`;
      }
    }

    modePillButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    updateMatrixModeTabsUI();
  }

  function updateMatrixModeTabsUI() {
    const matrixTabs = document.querySelectorAll('#matrixModeTabs .mode-pill-btn');
    matrixTabs.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === (matrixCurrentMode || currentConfig.activeConfigMode || 'karei'));
    });
  }

  // ===== ⏱️ ゲーム制限時間 & 👥 １画面キャラ表示数設定 (メイン & マトリクス双方向完全連動) =====
  const gameTimeLimitSlider = document.getElementById('gameTimeLimitSlider');
  const gameTimeLimitNum = document.getElementById('gameTimeLimitNum');
  const gameTimeLimitDisplay = document.getElementById('gameTimeLimitDisplay');
  const activeTimeLimitModeBadge = document.getElementById('activeTimeLimitModeBadge');
  const btnApplyTimeLimitToAllModes = document.getElementById('btnApplyTimeLimitToAllModes');
  const timePresetButtons = document.querySelectorAll('.btn-time-preset');

  // マトリクスモーダル側の制限時間コントロール
  const matrixTimeLimitSlider = document.getElementById('matrixTimeLimitSlider');
  const matrixTimeLimitInput = document.getElementById('matrixTimeLimitInput');
  const matrixTimeLimitDisplay = document.getElementById('matrixTimeLimitDisplay');

  // １画面キャラ表示数コントロール (メイン & マトリクス)
  const commonMaxFishSlider = document.getElementById('commonMaxFishSlider');
  const commonMaxFishNum = document.getElementById('commonMaxFishNum');
  const commonMaxFishDisplay = document.getElementById('commonMaxFishDisplay');
  const btnResetCommonMaxFish = document.getElementById('btnResetCommonMaxFish');
  const fishCountPresetButtons = document.querySelectorAll('.btn-fish-count-preset');

  const matrixMaxFishSlider = document.getElementById('matrixMaxFishSlider');
  const matrixMaxFishInput = document.getElementById('matrixMaxFishInput');
  const matrixMaxFishDisplay = document.getElementById('matrixMaxFishDisplay');

  // フィーバー時の画面表示数コントロール (メイン & マトリクス)
  const commonFeverMaxFishSlider = document.getElementById('commonFeverMaxFishSlider');
  const commonFeverMaxFishNum = document.getElementById('commonFeverMaxFishNum');
  const commonFeverMaxFishDisplay = document.getElementById('commonFeverMaxFishDisplay');
  const btnResetCommonFeverMaxFish = document.getElementById('btnResetCommonFeverMaxFish');
  const feverCountPresetButtons = document.querySelectorAll('.btn-fever-count-preset');

  const matrixFeverMaxFishSlider = document.getElementById('matrixFeverMaxFishSlider');
  const matrixFeverMaxFishInput = document.getElementById('matrixFeverMaxFishInput');
  const matrixFeverMaxFishDisplay = document.getElementById('matrixFeverMaxFishDisplay');

  // 全モード一括適用ボタン (全モード共通設定カード内)
  const btnApplyCommonToAllModes = document.getElementById('btnApplyCommonToAllModes');

  function syncTimeLimitUI() {
    const mode = currentConfig.activeConfigMode || 'karei';
    const isUnified = currentConfig.gameBalanceUnified !== false;
    let limit = 60;
    if (isUnified) {
      limit = Number(currentConfig.timeLimitSec) || 60;
    } else {
      const modeCfg = currentConfig.modeConfigs?.[mode];
      limit = Number(modeCfg?.timeLimitSec ?? currentConfig.timeLimitSec ?? 60);
    }
    limit = Math.max(5, Math.min(600, limit));

    if (gameTimeLimitSlider) gameTimeLimitSlider.value = limit;
    if (gameTimeLimitNum) gameTimeLimitNum.value = limit;
    if (gameTimeLimitDisplay) gameTimeLimitDisplay.innerText = `${limit} 秒`;

    if (matrixTimeLimitSlider) matrixTimeLimitSlider.value = limit;
    if (matrixTimeLimitInput) matrixTimeLimitInput.value = limit;
    if (matrixTimeLimitDisplay) matrixTimeLimitDisplay.innerText = `${limit} 秒`;

    if (activeTimeLimitModeBadge) {
      const modeLabels = { karei: '🐟 カレイ派モード設定', hirame: '🦈 ヒラメ派モード設定', hirai: '⚖️ ヒライ派モード設定' };
      activeTimeLimitModeBadge.innerText = isUnified ? '🌐 全モード共通設定' : (modeLabels[mode] || `${mode} 設定`);
    }

    timePresetButtons.forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.val, 10) === limit);
    });
  }

  function setGameTimeLimit(val) {
    const num = Math.max(5, Math.min(600, parseInt(val, 10) || 60));
    const mode = currentConfig.activeConfigMode || 'karei';
    const isUnified = currentConfig.gameBalanceUnified !== false;

    currentConfig.timeLimitSec = num;
    if (isUnified) {
      if (!currentConfig.modeConfigs) currentConfig.modeConfigs = {};
      ['karei', 'hirame', 'hirai'].forEach(m => {
        if (!currentConfig.modeConfigs[m]) currentConfig.modeConfigs[m] = {};
        currentConfig.modeConfigs[m].timeLimitSec = num;
      });
    } else {
      if (!currentConfig.modeConfigs) currentConfig.modeConfigs = {};
      if (!currentConfig.modeConfigs[mode]) currentConfig.modeConfigs[mode] = {};
      currentConfig.modeConfigs[mode].timeLimitSec = num;
    }

    syncTimeLimitUI();
    saveCurrentConfigToStorage();
  }

  // ===== 👥 １画面キャラ表示数同期 =====
  function syncMaxFishUI() {
    const mode = currentConfig.activeConfigMode || 'karei';
    const isUnified = currentConfig.gameBalanceUnified !== false;
    let count = 20;
    if (isUnified) {
      count = currentConfig.maxScreenFishes != null ? Number(currentConfig.maxScreenFishes) : 20;
    } else {
      const modeCfg = currentConfig.modeConfigs?.[mode];
      count = Number(modeCfg?.maxScreenFishes ?? currentConfig.maxScreenFishes ?? 20);
    }
    count = Math.max(0, Math.min(100, isNaN(count) ? 20 : count));

    if (commonMaxFishSlider) commonMaxFishSlider.value = count;
    if (commonMaxFishNum) commonMaxFishNum.value = count;
    if (commonMaxFishDisplay) commonMaxFishDisplay.innerText = `${count} 匹`;

    if (matrixMaxFishSlider) matrixMaxFishSlider.value = count;
    if (matrixMaxFishInput) matrixMaxFishInput.value = count;
    if (matrixMaxFishDisplay) matrixMaxFishDisplay.innerText = `${count} 匹`;

    fishCountPresetButtons.forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.val, 10) === count);
    });
  }

  function setMaxScreenFishes(val) {
    const num = Math.max(0, Math.min(100, parseInt(val, 10) || 0));
    const mode = currentConfig.activeConfigMode || 'karei';
    const isUnified = currentConfig.gameBalanceUnified !== false;

    currentConfig.maxScreenFishes = num;
    currentConfig.targetFishCount = num;
    if (isUnified) {
      if (!currentConfig.modeConfigs) currentConfig.modeConfigs = {};
      ['karei', 'hirame', 'hirai'].forEach(m => {
        if (!currentConfig.modeConfigs[m]) currentConfig.modeConfigs[m] = {};
        currentConfig.modeConfigs[m].maxScreenFishes = num;
        currentConfig.modeConfigs[m].targetFishCount = num;
      });
    } else {
      if (!currentConfig.modeConfigs) currentConfig.modeConfigs = {};
      if (!currentConfig.modeConfigs[mode]) currentConfig.modeConfigs[mode] = {};
      currentConfig.modeConfigs[mode].maxScreenFishes = num;
      currentConfig.modeConfigs[mode].targetFishCount = num;
    }

    syncMaxFishUI();
    saveCurrentConfigToStorage();
  }

  // ===== 🔥 フィーバー時の画面表示数同期 (0〜100匹) =====
  function syncFeverMaxFishUI() {
    const feverCfg = getChaosFeverConfig();
    let count = feverCfg.maxScreenFishes != null ? Number(feverCfg.maxScreenFishes) : 70;
    count = Math.max(0, Math.min(100, isNaN(count) ? 70 : count));

    if (commonFeverMaxFishSlider) commonFeverMaxFishSlider.value = count;
    if (commonFeverMaxFishNum) commonFeverMaxFishNum.value = count;
    if (commonFeverMaxFishDisplay) commonFeverMaxFishDisplay.innerText = `${count} 匹`;

    if (matrixFeverMaxFishSlider) matrixFeverMaxFishSlider.value = count;
    if (matrixFeverMaxFishInput) matrixFeverMaxFishInput.value = count;
    if (matrixFeverMaxFishDisplay) matrixFeverMaxFishDisplay.innerText = `${count} 匹`;

    if (chaosFeverMaxScreen) chaosFeverMaxScreen.value = count;
    if (chaosFeverMaxScreenVal) chaosFeverMaxScreenVal.innerText = `${count} 匹`;

    feverCountPresetButtons.forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.val, 10) === count);
    });
  }

  function setFeverMaxFish(val) {
    const num = Math.max(0, Math.min(100, parseInt(val, 10) || 0));
    const feverCfg = getChaosFeverConfig();
    feverCfg.maxScreenFishes = num;

    if (currentConfig.modeConfigs) {
      ['karei', 'hirame', 'hirai'].forEach(m => {
        if (currentConfig.modeConfigs[m]) {
          if (!currentConfig.modeConfigs[m].chaosFeverConfig) {
            currentConfig.modeConfigs[m].chaosFeverConfig = {};
          }
          currentConfig.modeConfigs[m].chaosFeverConfig.maxScreenFishes = num;
        }
      });
    }

    syncFeverMaxFishUI();
    saveCurrentConfigToStorage();
  }

  // イベントリスナー: 制限時間
  gameTimeLimitSlider?.addEventListener('input', (e) => setGameTimeLimit(e.target.value));
  gameTimeLimitNum?.addEventListener('input', (e) => setGameTimeLimit(e.target.value));
  gameTimeLimitNum?.addEventListener('change', (e) => setGameTimeLimit(e.target.value));
  matrixTimeLimitSlider?.addEventListener('input', (e) => setGameTimeLimit(e.target.value));
  matrixTimeLimitInput?.addEventListener('input', (e) => setGameTimeLimit(e.target.value));
  matrixTimeLimitInput?.addEventListener('change', (e) => setGameTimeLimit(e.target.value));

  timePresetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      setGameTimeLimit(btn.dataset.val);
      try { sound.init(); sound.playTap(); } catch (e) { }
    });
  });

  btnApplyTimeLimitToAllModes?.addEventListener('click', () => {
    const mode = currentConfig.activeConfigMode || 'karei';
    const num = Number(currentConfig.modeConfigs?.[mode]?.timeLimitSec ?? currentConfig.timeLimitSec ?? 60);
    if (!currentConfig.modeConfigs) currentConfig.modeConfigs = {};
    ['karei', 'hirame', 'hirai'].forEach(m => {
      if (!currentConfig.modeConfigs[m]) currentConfig.modeConfigs[m] = {};
      currentConfig.modeConfigs[m].timeLimitSec = num;
    });
    currentConfig.timeLimitSec = num;
    syncTimeLimitUI();
    saveCurrentConfigToStorage();
    try { sound.init(); sound.playSuccess(1); } catch (e) { }
    alert(`現在設定の「${num}秒」をすべてのモード（カレイ派・ヒラメ派・ヒライ派）に適用しました！`);
  });

  // イベントリスナー: １画面キャラ表示数
  commonMaxFishSlider?.addEventListener('input', (e) => setMaxScreenFishes(e.target.value));
  commonMaxFishNum?.addEventListener('input', (e) => setMaxScreenFishes(e.target.value));
  commonMaxFishNum?.addEventListener('change', (e) => setMaxScreenFishes(e.target.value));
  matrixMaxFishSlider?.addEventListener('input', (e) => setMaxScreenFishes(e.target.value));
  matrixMaxFishInput?.addEventListener('input', (e) => setMaxScreenFishes(e.target.value));
  matrixMaxFishInput?.addEventListener('change', (e) => setMaxScreenFishes(e.target.value));

  btnResetCommonMaxFish?.addEventListener('click', () => {
    setMaxScreenFishes(20);
    try { sound.init(); sound.playTap(); } catch (e) { }
  });

  fishCountPresetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      setMaxScreenFishes(btn.dataset.val);
      try { sound.init(); sound.playTap(); } catch (e) { }
    });
  });

  // イベントリスナー: フィーバー時画面表示数
  commonFeverMaxFishSlider?.addEventListener('input', (e) => setFeverMaxFish(e.target.value));
  commonFeverMaxFishNum?.addEventListener('input', (e) => setFeverMaxFish(e.target.value));
  commonFeverMaxFishNum?.addEventListener('change', (e) => setFeverMaxFish(e.target.value));
  matrixFeverMaxFishSlider?.addEventListener('input', (e) => setFeverMaxFish(e.target.value));
  matrixFeverMaxFishInput?.addEventListener('input', (e) => setFeverMaxFish(e.target.value));
  matrixFeverMaxFishInput?.addEventListener('change', (e) => setFeverMaxFish(e.target.value));

  btnResetCommonFeverMaxFish?.addEventListener('click', () => {
    setFeverMaxFish(70);
    try { sound.init(); sound.playTap(); } catch (e) { }
  });

  feverCountPresetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      setFeverMaxFish(btn.dataset.val);
      try { sound.init(); sound.playTap(); } catch (e) { }
    });
  });

  // イベントリスナー: 全モード共通設定を一括適用
  btnApplyCommonToAllModes?.addEventListener('click', () => {
    const curMode = currentConfig.activeConfigMode || 'karei';
    const curLimit = Number(currentConfig.modeConfigs?.[curMode]?.timeLimitSec ?? currentConfig.timeLimitSec ?? 60);
    const curMaxFish = Number(currentConfig.modeConfigs?.[curMode]?.maxScreenFishes ?? currentConfig.maxScreenFishes ?? 20);
    const feverCfg = getChaosFeverConfig();
    const curFeverMax = feverCfg.maxScreenFishes != null ? Number(feverCfg.maxScreenFishes) : 70;

    if (!currentConfig.modeConfigs) currentConfig.modeConfigs = {};
    ['karei', 'hirame', 'hirai'].forEach(m => {
      if (!currentConfig.modeConfigs[m]) currentConfig.modeConfigs[m] = {};
      currentConfig.modeConfigs[m].timeLimitSec = curLimit;
      currentConfig.modeConfigs[m].maxScreenFishes = curMaxFish;
      currentConfig.modeConfigs[m].targetFishCount = curMaxFish;
      if (!currentConfig.modeConfigs[m].chaosFeverConfig) currentConfig.modeConfigs[m].chaosFeverConfig = {};
      currentConfig.modeConfigs[m].chaosFeverConfig.maxScreenFishes = curFeverMax;
    });
    currentConfig.timeLimitSec = curLimit;
    currentConfig.maxScreenFishes = curMaxFish;
    currentConfig.targetFishCount = curMaxFish;
    feverCfg.maxScreenFishes = curFeverMax;

    syncTimeLimitUI();
    syncMaxFishUI();
    syncFeverMaxFishUI();
    saveCurrentConfigToStorage();
    try { sound.init(); sound.playSuccess(1); } catch (e) { }
    alert(`🌐 全モード共通設定（制限時間: ${curLimit}秒、１画面表示数: ${curMaxFish}匹、フィーバー時表示数: ${curFeverMax}匹）を全モードに一括適用しました！`);
  });

  function setActiveGameMode(mode) {
    if (!mode) return;
    currentConfig.activeConfigMode = mode;
    matrixCurrentMode = mode;

    updateBalanceUI();
    renderCharSelectPills();
    syncUIForActiveChar();
    syncSimCanvasCount();
    syncTimeLimitUI();
    syncMaxFishUI();
    syncFeverMaxFishUI();

    if (configMatrixModal && !configMatrixModal.classList.contains('hidden')) {
      if (typeof renderConfigMatrixTable === 'function') {
        renderConfigMatrixTable(matrixCurrentMode);
      }
    }

    saveCurrentConfigToStorage();
  }

  btnToggleGameBalance?.addEventListener('click', () => {
    currentConfig.gameBalanceUnified = !currentConfig.gameBalanceUnified;
    try { sound.init(); sound.playTap(); } catch (e) { }
    updateBalanceUI();
    renderCharSelectPills();
    syncUIForActiveChar();
    syncSimCanvasCount();
  });

  modePillButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      try { sound.init(); sound.playTap(); } catch (e) { }
      setActiveGameMode(btn.dataset.mode);
    });
  });

  // キャラクターピル描画
  function renderCharSelectPills() {
    if (!charSelectPills) return;
    const chars = getAllAvailableCharacters();
    charSelectPills.innerHTML = chars.map(c => `
      <button type="button" class="char-pill-btn ${c.id === activeCharId ? 'active' : ''}" data-char-id="${c.id}">
        ${c.name}
      </button>
    `).join('');

    charSelectPills.querySelectorAll('.char-pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeCharId = btn.dataset.charId;
        renderCharSelectPills();
        syncUIForActiveChar();
      });
    });
  }

  // 役割切り替えボタン群の動的描画 (バケツA・B・追加バケツ ＆ 邪魔キャラ)
  function renderRoleButtons() {
    if (!charRoleButtonsContainer) return;
    const cfg = getActiveCharConfig();
    const curRole = cfg.role || 'bucketA';
    const curBuckets = currentConfig.buckets || DEFAULT_BUCKETS;

    let html = '';
    curBuckets.forEach(b => {
      const isSel = (curRole === b.id);
      const tag = b.id === 'bucketA' ? 'バケツA' : b.id === 'bucketB' ? 'バケツB' : b.name;
      html += `
        <button type="button" class="role-toggle-btn ${isSel ? 'active-target' : ''}" data-role="${b.id}" style="${isSel ? 'background:linear-gradient(135deg, #0284c7, #0369a1); border-color:#38bdf8;' : ''}">
          <span class="role-icon">${b.icon || '🪣'}</span> <span class="role-btn-name">${b.name} (${tag})</span>
        </button>
      `;
    });

    const isDisturber = (curRole === 'disturber');
    html += `
      <button type="button" class="role-toggle-btn ${isDisturber ? 'active-disturber' : ''}" data-role="disturber">
        <span class="role-icon">⚠️</span> <span class="role-btn-name">邪魔キャラ</span>
      </button>
    `;

    charRoleButtonsContainer.innerHTML = html;

    charRoleButtonsContainer.querySelectorAll('.role-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const newRole = btn.dataset.role;
        cfg.role = newRole;
        if (newRole === 'disturber') {
          if (cfg.pointValue === 10) cfg.pointValue = -5;
        } else {
          if (cfg.pointValue === -5) cfg.pointValue = 10;
        }
        try { sound.init(); sound.playTap(); } catch (e) { }
        syncUIForActiveChar();
        syncSimCanvasCount();
        saveCurrentConfigToStorage();
        if (configMatrixModal && !configMatrixModal.classList.contains('hidden')) {
          renderConfigMatrixTable(matrixCurrentMode);
        }
      });
    });
  }

  // 仕分けバケツ管理UIの描画 (ヒライ派 & 役割指定用)
  function renderBucketManagerUI() {
    if (!adminBucketList) return;
    if (!currentConfig.buckets || !Array.isArray(currentConfig.buckets)) {
      currentConfig.buckets = JSON.parse(JSON.stringify(DEFAULT_BUCKETS));
    }

    // デフォルト言語の初期補完
    currentConfig.buckets.forEach(b => {
      if (b.id === 'bucketA') {
        if (!b.name_en) b.name_en = 'Karei';
        if (!b.name_ko) b.name_ko = '가자미';
        if (!b.name_zh) b.name_zh = '鲽鱼';
      } else if (b.id === 'bucketB') {
        if (!b.name_en) b.name_en = 'Hirame';
        if (!b.name_ko) b.name_ko = '히라메';
        if (!b.name_zh) b.name_zh = '牙鲆';
      }
    });

    adminBucketList.innerHTML = currentConfig.buckets.map((b, idx) => {
      const canDelete = currentConfig.buckets.length > 2;
      const tag = b.id === 'bucketA' ? 'バケツA' : b.id === 'bucketB' ? 'バケツB' : `バケツ${idx + 1}`;
      const nameJa = b.name || '';
      const nameEn = b.name_en || (b.id === 'bucketA' ? 'Karei' : b.id === 'bucketB' ? 'Hirame' : '');
      const nameKo = b.name_ko || (b.id === 'bucketA' ? '가자미' : b.id === 'bucketB' ? '히라메' : '');
      const nameZh = b.name_zh || (b.id === 'bucketA' ? '鲽鱼' : b.id === 'bucketB' ? '牙鲆' : '');

      return `
        <div class="bucket-mgmt-item" style="display:flex; flex-direction:column; gap:6px; background:rgba(255,255,255,0.05); padding:8px 10px; border-radius:8px; border:1px solid rgba(255,255,255,0.1); margin-bottom:8px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:16px;">${b.icon || '🪣'}</span>
            <span class="val-pill" style="font-size:11px; padding:2px 6px;">${tag}</span>
            <button type="button" class="btn-micro btn-danger btn-delete-bucket" data-bucket-id="${b.id}" ${canDelete ? '' : 'disabled style="opacity:0.35; cursor:not-allowed;"'} title="${canDelete ? 'このバケツを削除' : '最低2個のバケツが必要です'}" style="margin-left:auto;">🗑️ 削除</button>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:6px;">
            <div>
              <span style="font-size:10px; color:#38bdf8; font-weight:700;">🇯🇵 日本語:</span>
              <input type="text" class="admin-text-input bucket-lang-input" data-lang="ja" data-bucket-id="${b.id}" value="${nameJa}" placeholder="例: カレイ" style="width:100%; padding:3px 6px; font-size:11px; height:26px;">
            </div>
            <div>
              <span style="font-size:10px; color:#38bdf8; font-weight:700;">🇺🇸 英語 (English):</span>
              <input type="text" class="admin-text-input bucket-lang-input" data-lang="en" data-bucket-id="${b.id}" value="${nameEn}" placeholder="例: Karei" style="width:100%; padding:3px 6px; font-size:11px; height:26px;">
            </div>
            <div>
              <span style="font-size:10px; color:#38bdf8; font-weight:700;">🇰🇷 韓国語 (한국어):</span>
              <input type="text" class="admin-text-input bucket-lang-input" data-lang="ko" data-bucket-id="${b.id}" value="${nameKo}" placeholder="例: 가자미" style="width:100%; padding:3px 6px; font-size:11px; height:26px;">
            </div>
            <div>
              <span style="font-size:10px; color:#38bdf8; font-weight:700;">🇨🇳 中国語 (中文):</span>
              <input type="text" class="admin-text-input bucket-lang-input" data-lang="zh" data-bucket-id="${b.id}" value="${nameZh}" placeholder="例: 鲽鱼" style="width:100%; padding:3px 6px; font-size:11px; height:26px;">
            </div>
          </div>
        </div>
      `;
    }).join('');

    adminBucketList.querySelectorAll('.bucket-lang-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const bId = e.target.dataset.bucketId;
        const lang = e.target.dataset.lang;
        const b = currentConfig.buckets.find(x => x.id === bId);
        if (b) {
          const val = e.target.value.trim();
          if (lang === 'ja') b.name = val || 'バケツ';
          else if (lang === 'en') b.name_en = val;
          else if (lang === 'ko') b.name_ko = val;
          else if (lang === 'zh') b.name_zh = val;

          saveCurrentConfigToStorage();
          renderRoleButtons();
          if (configMatrixModal && !configMatrixModal.classList.contains('hidden')) {
            renderConfigMatrixTable(matrixCurrentMode);
          }
        }
      });
    });

    adminBucketList.querySelectorAll('.btn-delete-bucket').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (currentConfig.buckets.length <= 2) return;
        const bId = btn.dataset.bucketId;
        const b = currentConfig.buckets.find(x => x.id === bId);
        const ok = await showAdminConfirm({
          title: 'バケツの削除確認',
          message: `バケツ「${b?.name || bId}」を削除しますか？\n※このバケツに割り当てられていた魚は「バケツA」に自動変更されます。`,
          icon: '🗑️',
          confirmText: '削除する',
          cancelText: 'キャンセル',
          isDanger: true
        });
        if (!ok) return;

        currentConfig.buckets = currentConfig.buckets.filter(x => x.id !== bId);
        // 魚の役割フォールバック
        const modes = ['karei', 'hirame', 'hirai'];
        modes.forEach(m => {
          const chars = currentConfig.modeConfigs?.[m]?.characters;
          if (chars) {
            Object.values(chars).forEach(c => {
              if (c.role === bId) c.role = 'bucketA';
            });
          }
        });
        if (currentConfig.characters) {
          Object.values(currentConfig.characters).forEach(c => {
            if (c.role === bId) c.role = 'bucketA';
          });
        }

        saveCurrentConfigToStorage();
        renderBucketManagerUI();
        renderRoleButtons();
        syncUIForActiveChar();
        if (configMatrixModal && !configMatrixModal.classList.contains('hidden')) {
          renderConfigMatrixTable(matrixCurrentMode);
        }
        try { sound.init(); sound.playTap(); } catch (e) { }
      });
    });
  }

  // 現在アクティブなキャラの設定をUIに反映
  function syncUIForActiveChar() {
    const cfg = getActiveCharConfig();
    const chars = getAllAvailableCharacters();
    const curInfo = chars.find(c => c.id === activeCharId) || { name: activeCharId };

    if (activeCharBadge) {
      activeCharBadge.innerText = curInfo.name;
    }

    // 役割ボタン群とバケツ管理UIを描画
    renderRoleButtons();
    renderBucketManagerUI();

    // 役割判定 (disturber以外はターゲット)
    const isDisturber = (cfg.role === 'disturber');
    const isTarget = !isDisturber;

    if (charRoleDesc) {
      if (isDisturber) {
        charRoleDesc.innerText = 'タップするとペナルティや障害が発生するキャラです';
      } else {
        const curBuckets = currentConfig.buckets || DEFAULT_BUCKETS;
        const b = curBuckets.find(x => x.id === cfg.role) || curBuckets[0];
        charRoleDesc.innerText = `タップで【${b ? b.name : 'バケツ'}】に収穫されるターゲットです`;
      }
    }

    // ポイント設定の反映
    if (cfg.pointValue === undefined) {
      cfg.pointValue = isTarget ? 10 : -5;
    }
    const currentPoints = cfg.pointValue;
    const isPlus = currentPoints >= 0;
    const absVal = Math.min(9999, Math.abs(currentPoints));

    if (btnPointSignPlus && btnPointSignMinus) {
      btnPointSignPlus.classList.toggle('active-plus', isPlus);
      btnPointSignMinus.classList.toggle('active-minus', !isPlus);
    }
    if (charPointInput) {
      charPointInput.value = absVal;
    }
    if (charPointBadge) {
      const signStr = isPlus ? '+' : '−';
      charPointBadge.innerText = `${signStr}${absVal} pt`;
      charPointBadge.className = isPlus ? 'val-pill val-pill-success' : 'val-pill val-pill-danger';
    }

    // パネルの有効・無効切り替え（全キャラ共通で出現条件＆重み・閾値設定が可能）
    if (panelTargetSettings && targetBadgeStatus) {
      panelTargetSettings.classList.remove('section-disabled');
      targetBadgeStatus.innerText = '全キャラ対応';
      targetBadgeStatus.className = 'dedicated-badge-active';
    }

    if (panelDisturberSettings && disturberBadgeStatus) {
      panelDisturberSettings.classList.remove('section-disabled');
      disturberBadgeStatus.innerText = '全キャラ対応';
      disturberBadgeStatus.className = 'dedicated-badge-active';
    }

    // 共通設定の反映
    if (charSizeScale && charSizeScaleVal) {
      charSizeScale.value = cfg.sizeScale ?? 1.0;
      charSizeScaleVal.innerText = `${(cfg.sizeScale ?? 1.0).toFixed(2)} x`;
      sizePresetButtons.forEach(btn => {
        const s = parseFloat(btn.dataset.size);
        btn.classList.toggle('active', Math.abs(s - (cfg.sizeScale ?? 1.0)) < 0.03);
      });
    }

    if (charCount && charCountVal) {
      charCount.value = cfg.count ?? 20;
      charCountVal.innerText = `${cfg.count ?? 20} 匹`;
    }

    if (charMinTargetThreshold && charMinTargetThresholdVal) {
      charMinTargetThreshold.value = cfg.minTargetThreshold ?? 2;
      charMinTargetThresholdVal.innerText = `${cfg.minTargetThreshold ?? 2} 匹`;
    }

    if (charSpeed && charSpeedVal) {
      charSpeed.value = cfg.speedMultiplier ?? 1.0;
      charSpeedVal.innerText = `${(cfg.speedMultiplier ?? 1.0).toFixed(1)} x`;
      speedPresetButtons.forEach(btn => {
        const spd = parseFloat(btn.dataset.speed);
        btn.classList.toggle('active', Math.abs(spd - (cfg.speedMultiplier ?? 1.0)) < 0.05);
      });
    }

    if (charLifetime && charLifetimeVal) {
      charLifetime.value = cfg.lifetimeSec ?? 6.0;
      charLifetimeVal.innerText = `${(cfg.lifetimeSec ?? 6.0).toFixed(1)} 秒`;
    }

    if (charRandomTurnRate && charRandomTurnRateVal) {
      charRandomTurnRate.value = cfg.randomTurnRate ?? 0.02;
      charRandomTurnRateVal.innerText = `${Math.round((cfg.randomTurnRate ?? 0.02) * 100)}% 頻度`;
    }

    const charCollisionRepulsion = document.getElementById('charCollisionRepulsion');
    const charCollisionRepulsionVal = document.getElementById('charCollisionRepulsionVal');
    const repulsionPresetButtons = document.querySelectorAll('.btn-repulsion-preset');
    if (charCollisionRepulsion && charCollisionRepulsionVal) {
      const rep = cfg.collisionRepulsion ?? 0;
      charCollisionRepulsion.value = rep;
      charCollisionRepulsionVal.innerText = rep === 0 ? 'OFF (0.0: すれ違う)' : `${rep.toFixed(1)} (反発あり)`;
      repulsionPresetButtons.forEach(btn => {
        const btnRep = parseFloat(btn.dataset.repulsion);
        btn.classList.toggle('active', Math.abs(btnRep - rep) < 0.05);
      });
    }

    const charDispersion = document.getElementById('charDispersion');
    const charDispersionVal = document.getElementById('charDispersionVal');
    const dispersionPresetButtons = document.querySelectorAll('.btn-dispersion-preset');
    if (charDispersion && charDispersionVal) {
      const disp = cfg.dispersionRate !== undefined ? cfg.dispersionRate : (currentConfig.dispersionRate ?? 0.5);
      const dispPct = Math.round(disp * 100);
      charDispersion.value = dispPct;
      charDispersionVal.innerText = `${dispPct} %`;
      dispersionPresetButtons.forEach(btn => {
        const btnDisp = parseFloat(btn.dataset.dispersion);
        btn.classList.toggle('active', Math.abs(btnDisp - disp) < 0.05);
      });
    }

    const charSilhouetteChance = document.getElementById('charSilhouetteChance');
    const charSilhouetteChanceVal = document.getElementById('charSilhouetteChanceVal');
    const silChancePresetButtons = document.querySelectorAll('.btn-sil-chance-preset');

    const charSilhouetteDuration = document.getElementById('charSilhouetteDuration');
    const charSilhouetteDurationVal = document.getElementById('charSilhouetteDurationVal');
    const silDurPresetButtons = document.querySelectorAll('.btn-sil-dur-preset');

    const charSilhouetteShrink = document.getElementById('charSilhouetteShrink');
    const charSilhouetteShrinkVal = document.getElementById('charSilhouetteShrinkVal');
    const silShrinkPresetButtons = document.querySelectorAll('.btn-sil-shrink-preset');

    const silCfg = cfg.silhouetteConfig || currentConfig.silhouetteConfig || DEFAULT_SILHOUETTE_CONFIG;

    if (charSilhouetteChance && charSilhouetteChanceVal) {
      const chance = silCfg.chancePercent !== undefined ? Number(silCfg.chancePercent) : 20;
      charSilhouetteChance.value = chance;
      charSilhouetteChanceVal.innerText = `${chance} %`;
      silChancePresetButtons.forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.val, 10) === chance);
      });
    }

    if (charSilhouetteDuration && charSilhouetteDurationVal) {
      const dur = silCfg.durationSec !== undefined ? Number(silCfg.durationSec) : 3.0;
      charSilhouetteDuration.value = dur;
      charSilhouetteDurationVal.innerText = `${dur.toFixed(1)} 秒`;
      silDurPresetButtons.forEach(btn => {
        btn.classList.toggle('active', Math.abs(parseFloat(btn.dataset.val) - dur) < 0.05);
      });
    }

    if (charSilhouetteShrink && charSilhouetteShrinkVal) {
      const shrink = silCfg.shrinkScale !== undefined ? Math.round(Number(silCfg.shrinkScale) * 100) : 70;
      charSilhouetteShrink.value = shrink;
      charSilhouetteShrinkVal.innerText = `${shrink} % (${(shrink / 100).toFixed(2)}x)`;
      silShrinkPresetButtons.forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.val, 10) === shrink);
      });
    }

    // ターゲット専用 (初心者機能)
    if (charBeginnerAlert && charBeginnerAlertVal) {
      charBeginnerAlert.checked = !!cfg.beginnerAlert;
      charBeginnerAlertVal.innerText = cfg.beginnerAlert ? 'ON (点滅あり)' : 'OFF (点滅なし)';
      charBeginnerAlertVal.className = cfg.beginnerAlert ? 'val-pill val-pill-success' : 'val-pill val-pill-off';
    }

    // ターゲット専用 (出現条件)
    const sc = cfg.spawnCondition || {
      enabled: false,
      timeSec: 0,
      origin: 'silhouette',
      triggerAction: 'tap_target',
      targetCharacters: [],
      tapCount: 10,
      probability: 100
    };
    cfg.spawnCondition = sc;

    if (btnToggleSpawnCondition && spawnConditionBody) {
      btnToggleSpawnCondition.className = sc.enabled ? 'btn-condition-toggle condition-on' : 'btn-condition-toggle condition-off';
      btnToggleSpawnCondition.innerHTML = sc.enabled
        ? '<span class="toggle-icon">🟢</span> <span class="toggle-text">ON (条件出現)</span>'
        : '<span class="toggle-icon">⚪</span> <span class="toggle-text">OFF (通常出現)</span>';
      spawnConditionBody.classList.toggle('condition-disabled', !sc.enabled);
    }

    if (charCondTime && charCondTimeVal) {
      charCondTime.value = sc.timeSec ?? 0;
      if (sc.timeSec === 0) {
        charCondTimeVal.innerText = '0 秒 (時間指定なし)';
      } else if (sc.timeSec === 61) {
        charCondTimeVal.innerText = '61 秒 (🎲 ランダム時間)';
      } else {
        charCondTimeVal.innerText = `${sc.timeSec} 秒`;
      }
    }

    if (charCondOrigin) {
      charCondOrigin.value = sc.origin || 'silhouette';
    }

    if (charCondTriggerAction) {
      charCondTriggerAction.value = sc.triggerAction || 'tap_target';
      if (charCondSpecificCharWrap) {
        charCondSpecificCharWrap.style.display = (sc.triggerAction === 'tap_specific') ? 'block' : 'none';
      }
      renderSpecificCharChecklist(sc.targetCharacters || []);

      const isIdle = (sc.triggerAction === 'idle');
      const isTapDisabled = isIdle || (sc.tapCountEnabled === false);
      if (charCondTapCount && charCondTapCountGroup) {
        charCondTapCount.disabled = isTapDisabled;
        charCondTapCountGroup.style.opacity = isTapDisabled ? '0.6' : '1';
      }
      if (charCondComboToggle) {
        charCondComboToggle.disabled = isIdle;
      }
    }

    if (chkCharCondTapCountEnabled) {
      chkCharCondTapCountEnabled.checked = (sc.tapCountEnabled !== false && sc.condTargetTapsEnabled !== false);
    }
    if (chkCharCondMatchAny) {
      chkCharCondMatchAny.checked = !!sc.matchAny;
    }
    if (chkCharCondShowAlert) {
      chkCharCondShowAlert.checked = (sc.showAlert === true || (sc.showAlert === undefined && activeCharId === 'boo_chan'));
    }

    const condScore = !!sc.condScoreEnabled;
    const condTaps = sc.condTargetTapsEnabled !== false && sc.tapCountEnabled !== false;
    const condTime = !!sc.condTimeEnabled;
    const isCondAll = condScore && condTaps && condTime;

    if (chkCharCondAll) chkCharCondAll.checked = isCondAll;
    if (chkCharCondScore) chkCharCondScore.checked = condScore;
    if (chkCharCondTargetTaps) chkCharCondTargetTaps.checked = condTaps;
    if (chkCharCondTime) chkCharCondTime.checked = condTime;

    if (charCondTapCount && charCondTapCountVal) {
      const isIdle = (sc.triggerAction === 'idle');
      if (isIdle) {
        charCondTapCount.value = 0;
        charCondTapCountVal.innerText = '0 回 (無操作)';
      } else {
        charCondTapCount.value = sc.tapCount ?? 10;
        if (sc.tapCount === 0) {
          charCondTapCountVal.innerText = '0 回 (無操作)';
        } else if (sc.tapCount === 101) {
          charCondTapCountVal.innerText = '101 回 (🎲 ランダム回数)';
        } else {
          charCondTapCountVal.innerText = `${sc.tapCount} 回`;
        }
      }
    }

    if (charCondComboToggle) {
      const isCombo = !!sc.isCombo;
      charCondComboToggle.classList.toggle('active', isCombo);
      charCondComboToggle.innerText = isCombo ? '🔥 コンボ: ON (連続成功のみ)' : 'コンボ: OFF (延べタップ数)';
    }

    if (charCondProbability && charCondProbabilityVal) {
      charCondProbability.value = sc.probability ?? 100;
      charCondProbabilityVal.innerText = `${sc.probability ?? 100} %`;
    }

    if (charCondRepeatCount && charCondRepeatCountVal) {
      charCondRepeatCount.value = sc.repeatCount ?? 0;
      if (sc.repeatCount === 0) {
        charCondRepeatCountVal.innerText = '0 回 (無限)';
      } else if (sc.repeatCount === 100) {
        charCondRepeatCountVal.innerText = '100 (🎲 回数ランダム)';
      } else {
        charCondRepeatCountVal.innerText = `${sc.repeatCount} 回`;
      }
    }

    // 邪魔キャラ専用
    if (charDisturberWeight && charDisturberWeightVal) {
      charDisturberWeight.value = cfg.weight ?? 20;
      charDisturberWeightVal.innerText = cfg.weight ?? 20;
    }

    if (charDisturberScoreThreshold && charDisturberScoreThresholdVal) {
      charDisturberScoreThreshold.value = cfg.scoreThreshold ?? 150;
      charDisturberScoreThresholdVal.innerText = `${cfg.scoreThreshold ?? 150} pt`;
    }

    // 6. 背景演出サージトリガー (全キャラ対応)
    if (!cfg.ambientTrigger) {
      const defTrig = DEFAULT_CHARACTER_SETTINGS[activeCharId]?.ambientTrigger || DEFAULT_AMBIENT_TRIGGER;
      cfg.ambientTrigger = JSON.parse(JSON.stringify(defTrig));
    }
    const ambTrig = cfg.ambientTrigger;

    if (btnToggleCharAmbientTrigger && charAmbientTriggerBody) {
      btnToggleCharAmbientTrigger.className = ambTrig.enabled ? 'btn-condition-toggle condition-on' : 'btn-condition-toggle condition-off';
      btnToggleCharAmbientTrigger.innerHTML = ambTrig.enabled
        ? '<span class="toggle-icon">🟢</span> <span class="toggle-text">ON (サージ発動)</span>'
        : '<span class="toggle-icon">⚪</span> <span class="toggle-text">OFF (無効)</span>';
      charAmbientTriggerBody.classList.toggle('condition-disabled', !ambTrig.enabled);
    }

    if (charAmbTriggerTapCount && charAmbTriggerTapCountVal) {
      charAmbTriggerTapCount.value = ambTrig.tapCount ?? 1;
      if (charAmbTriggerTapCountInput) charAmbTriggerTapCountInput.value = ambTrig.tapCount ?? 1;
      charAmbTriggerTapCountVal.innerText = `${ambTrig.tapCount ?? 1} 回`;
    }

    if (charAmbTriggerPercentage && charAmbTriggerPercentageVal) {
      charAmbTriggerPercentage.value = ambTrig.percentage ?? 50;
      if (charAmbTriggerPercentageInput) charAmbTriggerPercentageInput.value = ambTrig.percentage ?? 50;
      charAmbTriggerPercentageVal.innerText = `${ambTrig.percentage ?? 50} %`;
    }

    if (btnAmbDirectionIncrease && btnAmbDirectionDecrease) {
      const isInc = (ambTrig.direction !== 'decrease');
      btnAmbDirectionIncrease.classList.toggle('active', isInc);
      btnAmbDirectionDecrease.classList.toggle('active', !isInc);
    }

    if (charAmbTriggerDuration && charAmbTriggerDurationVal) {
      charAmbTriggerDuration.value = ambTrig.durationSec ?? 2.0;
      if (charAmbTriggerDurationInput) charAmbTriggerDurationInput.value = ambTrig.durationSec ?? 2.0;
      charAmbTriggerDurationVal.innerText = `${Number(ambTrig.durationSec ?? 2.0).toFixed(1)} 秒`;
    }

    renderAmbientPresetChecklist(ambTrig.targetPresets || ['bubbles', 'small_fish']);
  }

  // ポイント設定リスナー
  function updatePointFromInputs() {
    const cfg = getActiveCharConfig();
    const isPlus = btnPointSignPlus?.classList.contains('active-plus') ?? true;
    let num = parseInt(charPointInput?.value || '0', 10);
    if (isNaN(num)) num = 0;
    num = Math.max(0, Math.min(9999, num));
    if (charPointInput) charPointInput.value = num;
    const finalVal = isPlus ? num : -num;
    cfg.pointValue = finalVal;

    if (charPointBadge) {
      const signStr = isPlus ? '+' : '−';
      charPointBadge.innerText = `${signStr}${num} pt`;
      charPointBadge.className = isPlus ? 'val-pill val-pill-success' : 'val-pill val-pill-danger';
    }

    // テスト水槽内の該当魚の得点設定も即座に同期
    for (const f of simFishes) {
      if (f.type === activeCharId) {
        f.pointValue = finalVal;
      }
    }
    saveCurrentConfigToStorage();
  }

  btnPointSignPlus?.addEventListener('click', () => {
    btnPointSignPlus.classList.add('active-plus');
    btnPointSignMinus.classList.remove('active-minus');
    try { sound.init(); sound.playTap(); } catch (e) { }
    updatePointFromInputs();
  });

  btnPointSignMinus?.addEventListener('click', () => {
    btnPointSignMinus.classList.add('active-minus');
    btnPointSignPlus.classList.remove('active-plus');
    try { sound.init(); sound.playTap(); } catch (e) { }
    updatePointFromInputs();
  });

  charPointInput?.addEventListener('input', () => {
    updatePointFromInputs();
  });

  pointPresetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const v = parseInt(btn.dataset.val, 10);
      const isPlus = v >= 0;
      const absVal = Math.min(9999, Math.abs(v));
      if (btnPointSignPlus && btnPointSignMinus) {
        btnPointSignPlus.classList.toggle('active-plus', isPlus);
        btnPointSignMinus.classList.toggle('active-minus', !isPlus);
      }
      if (charPointInput) charPointInput.value = absVal;
      try { sound.init(); sound.playTap(); } catch (e) { }
      updatePointFromInputs();
    });
  });

  // 出現条件の有効化 リスナー
  btnToggleSpawnCondition?.addEventListener('click', () => {
    const cfg = getActiveCharConfig();
    if (!cfg.spawnCondition) cfg.spawnCondition = {};
    cfg.spawnCondition.enabled = !cfg.spawnCondition.enabled;

    // 「出現条件の有効化」「条件4: 達成回数」いずれか片方のみONのときは「かたほうでも達成」のチェックは自動で外す
    const isEnabled = !!cfg.spawnCondition.enabled;
    const isTapEnabled = cfg.spawnCondition.tapCountEnabled !== false;
    if (!isEnabled || !isTapEnabled) {
      cfg.spawnCondition.matchAny = false;
    }

    try { sound.init(); sound.playTap(); } catch (e) { }
    syncUIForActiveChar();
    saveCurrentConfigToStorage();
    if (configMatrixModal && !configMatrixModal.classList.contains('hidden')) {
      renderConfigMatrixTable(matrixCurrentMode);
    }
  });

  // 条件4: 達成回数の有効化チェックボックス
  chkCharCondTapCountEnabled?.addEventListener('change', (e) => {
    const cfg = getActiveCharConfig();
    if (!cfg.spawnCondition) cfg.spawnCondition = {};
    cfg.spawnCondition.tapCountEnabled = e.target.checked;

    // 「出現条件の有効化」「条件4: 達成回数」いずれか片方のみONのときは「かたほうでも達成」のチェックは自動で外す
    const isEnabled = !!cfg.spawnCondition.enabled;
    const isTapEnabled = cfg.spawnCondition.tapCountEnabled !== false;
    if (!isEnabled || !isTapEnabled) {
      cfg.spawnCondition.matchAny = false;
    }

    try { sound.init(); sound.playTap(); } catch (err) { }
    syncUIForActiveChar();
    saveCurrentConfigToStorage();
    if (configMatrixModal && !configMatrixModal.classList.contains('hidden')) {
      renderConfigMatrixTable(matrixCurrentMode);
    }
  });

  // 「◯◯出現！」表示 チェックボックス
  chkCharCondShowAlert?.addEventListener('change', (e) => {
    const cfg = getActiveCharConfig();
    if (!cfg.spawnCondition) cfg.spawnCondition = {};
    cfg.spawnCondition.showAlert = e.target.checked;

    try { sound.init(); sound.playTap(); } catch (err) { }
    syncUIForActiveChar();
    saveCurrentConfigToStorage();
    if (configMatrixModal && !configMatrixModal.classList.contains('hidden')) {
      renderConfigMatrixTable(matrixCurrentMode);
    }
  });

  // かたほうでも達成 チェックボックス
  chkCharCondMatchAny?.addEventListener('change', (e) => {
    const cfg = getActiveCharConfig();
    if (!cfg.spawnCondition) cfg.spawnCondition = {};
    cfg.spawnCondition.matchAny = e.target.checked;

    // 「かたほうでも達成」にチェックがONのときは「出現条件の有効化」「条件4: 達成回数」両方ともにチェックONに自動で
    if (e.target.checked) {
      cfg.spawnCondition.enabled = true;
      cfg.spawnCondition.tapCountEnabled = true;
      cfg.spawnCondition.condTargetTapsEnabled = true;
    }

    try { sound.init(); sound.playTap(); } catch (err) { }
    syncUIForActiveChar();
    saveCurrentConfigToStorage();
    if (configMatrixModal && !configMatrixModal.classList.contains('hidden')) {
      renderConfigMatrixTable(matrixCurrentMode);
    }
  });

  // ３条件設定: 全て (ALL) リスナー
  chkCharCondAll?.addEventListener('change', (e) => {
    const cfg = getActiveCharConfig();
    if (!cfg.spawnCondition) cfg.spawnCondition = {};
    const val = e.target.checked;
    cfg.spawnCondition.condAll = val;
    cfg.spawnCondition.condScoreEnabled = val;
    cfg.spawnCondition.condTargetTapsEnabled = val;
    cfg.spawnCondition.tapCountEnabled = val;
    cfg.spawnCondition.condTimeEnabled = val;

    if (!val && !cfg.spawnCondition.enabled) {
      cfg.spawnCondition.matchAny = false;
    }

    try { sound.init(); sound.playTap(); } catch (err) { }
    syncUIForActiveChar();
    saveCurrentConfigToStorage();
    if (configMatrixModal && !configMatrixModal.classList.contains('hidden')) {
      renderConfigMatrixTable(matrixCurrentMode);
    }
  });

  // ３条件設定: 獲得Pt リスナー
  chkCharCondScore?.addEventListener('change', (e) => {
    const cfg = getActiveCharConfig();
    if (!cfg.spawnCondition) cfg.spawnCondition = {};
    cfg.spawnCondition.condScoreEnabled = e.target.checked;
    const condScore = !!cfg.spawnCondition.condScoreEnabled;
    const condTaps = cfg.spawnCondition.condTargetTapsEnabled !== false && cfg.spawnCondition.tapCountEnabled !== false;
    const condTime = !!cfg.spawnCondition.condTimeEnabled;
    cfg.spawnCondition.condAll = condScore && condTaps && condTime;

    try { sound.init(); sound.playTap(); } catch (err) { }
    syncUIForActiveChar();
    saveCurrentConfigToStorage();
    if (configMatrixModal && !configMatrixModal.classList.contains('hidden')) {
      renderConfigMatrixTable(matrixCurrentMode);
    }
  });

  // ３条件設定: T捕獲数 リスナー
  chkCharCondTargetTaps?.addEventListener('change', (e) => {
    const cfg = getActiveCharConfig();
    if (!cfg.spawnCondition) cfg.spawnCondition = {};
    cfg.spawnCondition.condTargetTapsEnabled = e.target.checked;
    cfg.spawnCondition.tapCountEnabled = e.target.checked;
    const condScore = !!cfg.spawnCondition.condScoreEnabled;
    const condTaps = cfg.spawnCondition.condTargetTapsEnabled !== false && cfg.spawnCondition.tapCountEnabled !== false;
    const condTime = !!cfg.spawnCondition.condTimeEnabled;
    cfg.spawnCondition.condAll = condScore && condTaps && condTime;

    const isEnabled = !!cfg.spawnCondition.enabled;
    if (!isEnabled || !condTaps) {
      cfg.spawnCondition.matchAny = false;
    }

    try { sound.init(); sound.playTap(); } catch (err) { }
    syncUIForActiveChar();
    saveCurrentConfigToStorage();
    if (configMatrixModal && !configMatrixModal.classList.contains('hidden')) {
      renderConfigMatrixTable(matrixCurrentMode);
    }
  });

  // ３条件設定: 時間 リスナー
  chkCharCondTime?.addEventListener('change', (e) => {
    const cfg = getActiveCharConfig();
    if (!cfg.spawnCondition) cfg.spawnCondition = {};
    cfg.spawnCondition.condTimeEnabled = e.target.checked;
    const condScore = !!cfg.spawnCondition.condScoreEnabled;
    const condTaps = cfg.spawnCondition.condTargetTapsEnabled !== false && cfg.spawnCondition.tapCountEnabled !== false;
    const condTime = !!cfg.spawnCondition.condTimeEnabled;
    cfg.spawnCondition.condAll = condScore && condTaps && condTime;

    try { sound.init(); sound.playTap(); } catch (err) { }
    syncUIForActiveChar();
    saveCurrentConfigToStorage();
    if (configMatrixModal && !configMatrixModal.classList.contains('hidden')) {
      renderConfigMatrixTable(matrixCurrentMode);
    }
  });

  charCondTime?.addEventListener('input', (e) => {
    const cfg = getActiveCharConfig();
    if (!cfg.spawnCondition) cfg.spawnCondition = {};
    const val = parseInt(e.target.value, 10);
    cfg.spawnCondition.timeSec = val;
    if (val === 0) {
      charCondTimeVal.innerText = '0 秒 (時間指定なし)';
    } else if (val === 61) {
      charCondTimeVal.innerText = '61 秒 (🎲 ランダム時間)';
    } else {
      charCondTimeVal.innerText = `${val} 秒`;
    }
    saveCurrentConfigToStorage();
  });

  charCondOrigin?.addEventListener('change', (e) => {
    const cfg = getActiveCharConfig();
    if (!cfg.spawnCondition) cfg.spawnCondition = {};
    cfg.spawnCondition.origin = e.target.value;
    saveCurrentConfigToStorage();
  });

  charCondTriggerAction?.addEventListener('change', (e) => {
    const cfg = getActiveCharConfig();
    if (!cfg.spawnCondition) cfg.spawnCondition = {};
    const action = e.target.value;
    cfg.spawnCondition.triggerAction = action;

    if (charCondSpecificCharWrap) {
      charCondSpecificCharWrap.style.display = (action === 'tap_specific') ? 'block' : 'none';
    }

    const isIdle = (action === 'idle');
    if (charCondTapCount && charCondTapCountGroup) {
      charCondTapCount.disabled = isIdle;
      charCondTapCountGroup.style.opacity = isIdle ? '0.5' : '1';
      if (isIdle) {
        cfg.spawnCondition.tapCount = 0;
        charCondTapCount.value = 0;
        charCondTapCountVal.innerText = '0 回 (無操作)';
      } else {
        if (cfg.spawnCondition.tapCount === 0) cfg.spawnCondition.tapCount = 10;
        charCondTapCount.value = cfg.spawnCondition.tapCount;
        charCondTapCountVal.innerText = `${cfg.spawnCondition.tapCount} 回`;
      }
    }
    if (charCondComboToggle) {
      charCondComboToggle.disabled = isIdle;
    }
    saveCurrentConfigToStorage();
  });

  charCondComboToggle?.addEventListener('click', () => {
    const cfg = getActiveCharConfig();
    if (!cfg.spawnCondition) cfg.spawnCondition = {};
    cfg.spawnCondition.isCombo = !cfg.spawnCondition.isCombo;
    try { sound.init(); sound.playTap(); } catch (e) { }
    const isCombo = !!cfg.spawnCondition.isCombo;
    charCondComboToggle.classList.toggle('active', isCombo);
    charCondComboToggle.innerText = isCombo ? '🔥 コンボ: ON (連続成功のみ)' : 'コンボ: OFF (延べタップ数)';
    saveCurrentConfigToStorage();
  });

  charCondTapCount?.addEventListener('input', (e) => {
    const cfg = getActiveCharConfig();
    if (!cfg.spawnCondition) cfg.spawnCondition = {};
    const val = parseInt(e.target.value, 10);
    cfg.spawnCondition.tapCount = val;
    if (val === 0) {
      charCondTapCountVal.innerText = '0 回 (無操作)';
    } else if (val === 101) {
      charCondTapCountVal.innerText = '101 回 (🎲 ランダム回数)';
    } else {
      charCondTapCountVal.innerText = `${val} 回`;
    }
    saveCurrentConfigToStorage();
  });

  charCondProbability?.addEventListener('input', (e) => {
    const cfg = getActiveCharConfig();
    if (!cfg.spawnCondition) cfg.spawnCondition = {};
    const val = parseInt(e.target.value, 10);
    cfg.spawnCondition.probability = val;
    charCondProbabilityVal.innerText = `${val} %`;
    saveCurrentConfigToStorage();
  });

  charCondRepeatCount?.addEventListener('input', (e) => {
    const cfg = getActiveCharConfig();
    if (!cfg.spawnCondition) cfg.spawnCondition = {};
    const val = parseInt(e.target.value, 10);
    cfg.spawnCondition.repeatCount = val;
    if (val === 0) {
      charCondRepeatCountVal.innerText = '0 回 (無限)';
    } else if (val === 100) {
      charCondRepeatCountVal.innerText = '100 (🎲 回数ランダム)';
    } else {
      charCondRepeatCountVal.innerText = `${val} 回`;
    }
    saveCurrentConfigToStorage();
  });

  // 背景演出サージトリガー リスナー
  btnToggleCharAmbientTrigger?.addEventListener('click', () => {
    const cfg = getActiveCharConfig();
    if (!cfg.ambientTrigger) cfg.ambientTrigger = {};
    cfg.ambientTrigger.enabled = !cfg.ambientTrigger.enabled;
    try { sound.init(); sound.playTap(); } catch (e) { }
    syncUIForActiveChar();
    saveCurrentConfigToStorage();
  });

  const syncAmbTriggerTap = (val) => {
    const cfg = getActiveCharConfig();
    if (!cfg.ambientTrigger) cfg.ambientTrigger = {};
    cfg.ambientTrigger.tapCount = Math.max(1, Math.min(50, val));
    if (charAmbTriggerTapCount) charAmbTriggerTapCount.value = cfg.ambientTrigger.tapCount;
    if (charAmbTriggerTapCountInput) charAmbTriggerTapCountInput.value = cfg.ambientTrigger.tapCount;
    if (charAmbTriggerTapCountVal) charAmbTriggerTapCountVal.innerText = `${cfg.ambientTrigger.tapCount} 回`;
    saveCurrentConfigToStorage();
  };
  charAmbTriggerTapCount?.addEventListener('input', (e) => syncAmbTriggerTap(parseInt(e.target.value, 10) || 1));
  charAmbTriggerTapCountInput?.addEventListener('input', (e) => syncAmbTriggerTap(parseInt(e.target.value, 10) || 1));

  const syncAmbTriggerPct = (val) => {
    const cfg = getActiveCharConfig();
    if (!cfg.ambientTrigger) cfg.ambientTrigger = {};
    cfg.ambientTrigger.percentage = Math.max(5, Math.min(200, val));
    if (charAmbTriggerPercentage) charAmbTriggerPercentage.value = cfg.ambientTrigger.percentage;
    if (charAmbTriggerPercentageInput) charAmbTriggerPercentageInput.value = cfg.ambientTrigger.percentage;
    if (charAmbTriggerPercentageVal) charAmbTriggerPercentageVal.innerText = `${cfg.ambientTrigger.percentage} %`;
    saveCurrentConfigToStorage();
  };
  charAmbTriggerPercentage?.addEventListener('input', (e) => syncAmbTriggerPct(parseInt(e.target.value, 10) || 50));
  charAmbTriggerPercentageInput?.addEventListener('input', (e) => syncAmbTriggerPct(parseInt(e.target.value, 10) || 50));

  btnAmbDirectionIncrease?.addEventListener('click', () => {
    const cfg = getActiveCharConfig();
    if (!cfg.ambientTrigger) cfg.ambientTrigger = {};
    cfg.ambientTrigger.direction = 'increase';
    btnAmbDirectionIncrease.classList.add('active');
    btnAmbDirectionDecrease?.classList.remove('active');
    try { sound.init(); sound.playTap(); } catch (e) { }
    saveCurrentConfigToStorage();
  });

  btnAmbDirectionDecrease?.addEventListener('click', () => {
    const cfg = getActiveCharConfig();
    if (!cfg.ambientTrigger) cfg.ambientTrigger = {};
    cfg.ambientTrigger.direction = 'decrease';
    btnAmbDirectionDecrease.classList.add('active');
    btnAmbDirectionIncrease?.classList.remove('active');
    try { sound.init(); sound.playTap(); } catch (e) { }
    saveCurrentConfigToStorage();
  });

  const syncAmbTriggerDuration = (val) => {
    const cfg = getActiveCharConfig();
    if (!cfg.ambientTrigger) cfg.ambientTrigger = {};
    cfg.ambientTrigger.durationSec = Math.max(0.5, Math.min(10.0, val));
    if (charAmbTriggerDuration) charAmbTriggerDuration.value = cfg.ambientTrigger.durationSec;
    if (charAmbTriggerDurationInput) charAmbTriggerDurationInput.value = cfg.ambientTrigger.durationSec;
    if (charAmbTriggerDurationVal) charAmbTriggerDurationVal.innerText = `${cfg.ambientTrigger.durationSec.toFixed(1)} 秒`;
    saveCurrentConfigToStorage();
  };
  charAmbTriggerDuration?.addEventListener('input', (e) => syncAmbTriggerDuration(parseFloat(e.target.value) || 2.0));
  charAmbTriggerDurationInput?.addEventListener('input', (e) => syncAmbTriggerDuration(parseFloat(e.target.value) || 2.0));

  // バケツ新規追加ボタン
  btnAddBucketBtn?.addEventListener('click', () => {
    if (!currentConfig.buckets) currentConfig.buckets = JSON.parse(JSON.stringify(DEFAULT_BUCKETS));
    const nextIdx = currentConfig.buckets.length + 1;
    const nextChar = String.fromCharCode(65 + currentConfig.buckets.length); // C, D, ...
    const newId = `bucket_${Date.now()}`;
    currentConfig.buckets.push({
      id: newId,
      name: `仕分け${nextChar}`,
      name_en: `Bucket ${nextChar}`,
      name_ko: `양동이 ${nextChar}`,
      name_zh: `水桶 ${nextChar}`,
      icon: '🪣'
    });
    saveCurrentConfigToStorage();
    renderBucketManagerUI();
    renderRoleButtons();
    if (configMatrixModal && !configMatrixModal.classList.contains('hidden')) {
      renderConfigMatrixTable(matrixCurrentMode);
    }
    try { sound.init(); sound.playSuccess(1); } catch (e) { }
  });

  // ===== 「現在の設定をセット」ボタン (ヘッダー ＆ マトリクス一覧モーダル内) =====
  function commitAllSettingsToGame(sourceBtn) {
    currentConfig.updatedAt = Date.now();
    localStorage.setItem('hirame_dev_config', JSON.stringify(currentConfig));
    if (adminChannel) {
      adminChannel.postMessage({
        type: 'UPDATE_DEV_CONFIG',
        config: currentConfig,
        timestamp: Date.now()
      });
    }
    try {
      sound.init();
      sound.playChime();
    } catch (e) { }

    if (sourceBtn) {
      const origHtml = sourceBtn.innerHTML;
      sourceBtn.innerHTML = '<span>✅</span> ゲームにすべてのパラメーター設定をセットしました！';
      sourceBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
      sourceBtn.style.borderColor = '#6ee7b7';
      setTimeout(() => {
        sourceBtn.innerHTML = origHtml;
        sourceBtn.style.background = '';
        sourceBtn.style.borderColor = '';
      }, 2500);
    }

    if (syncStatusBadge) {
      syncStatusBadge.innerText = '⚡ ゲームにすべてのパラメーター設定をセットしました！';
      syncStatusBadge.style.color = '#38bdf8';
      setTimeout(() => {
        syncStatusBadge.innerText = '⚡ 接続アクティブ';
        syncStatusBadge.style.color = '#10b981';
      }, 3000);
    }
  }

  btnHeaderCommitToGame?.addEventListener('click', () => commitAllSettingsToGame(btnHeaderCommitToGame));
  btnMatrixCommitToGame?.addEventListener('click', () => commitAllSettingsToGame(btnMatrixCommitToGame));

  // 共通設定リスナー
  charSizeScale?.addEventListener('input', (e) => {
    const cfg = getActiveCharConfig();
    cfg.sizeScale = parseFloat(e.target.value);
    charSizeScaleVal.innerText = `${cfg.sizeScale.toFixed(2)} x`;
    sizePresetButtons.forEach(btn => {
      btn.classList.toggle('active', Math.abs(parseFloat(btn.dataset.size) - cfg.sizeScale) < 0.03);
    });
    // 水槽シミュレーター内の魚サイズも即時更新
    for (const f of simFishes) {
      if (f.type === activeCharId) {
        f.sizeScale = cfg.sizeScale;
        f.width = f.baseWidth * f.sizeScale;
        f.height = f.baseHeight * f.sizeScale;
      }
    }
    saveCurrentConfigToStorage();
  });

  sizePresetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const s = parseFloat(btn.dataset.size);
      const cfg = getActiveCharConfig();
      cfg.sizeScale = s;
      charSizeScale.value = s;
      charSizeScaleVal.innerText = `${s.toFixed(2)} x`;
      sizePresetButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      for (const f of simFishes) {
        if (f.type === activeCharId) {
          f.sizeScale = s;
          f.width = f.baseWidth * f.sizeScale;
          f.height = f.baseHeight * f.sizeScale;
        }
      }
      saveCurrentConfigToStorage();
    });
  });

  charCount?.addEventListener('input', (e) => {
    const cfg = getActiveCharConfig();
    cfg.count = parseInt(e.target.value, 10);
    charCountVal.innerText = `${cfg.count} 匹`;
    syncSimCanvasCount();
    saveCurrentConfigToStorage();
  });

  charMinTargetThreshold?.addEventListener('input', (e) => {
    const cfg = getActiveCharConfig();
    cfg.minTargetThreshold = parseInt(e.target.value, 10);
    charMinTargetThresholdVal.innerText = `${cfg.minTargetThreshold} 匹`;
    saveCurrentConfigToStorage();
  });

  charSpeed?.addEventListener('input', (e) => {
    const cfg = getActiveCharConfig();
    cfg.speedMultiplier = parseFloat(e.target.value);
    charSpeedVal.innerText = `${cfg.speedMultiplier.toFixed(1)} x`;
    speedPresetButtons.forEach(btn => {
      btn.classList.toggle('active', Math.abs(parseFloat(btn.dataset.speed) - cfg.speedMultiplier) < 0.05);
    });
    for (const f of simFishes) {
      if (f.type === activeCharId) {
        f.speedMultiplier = cfg.speedMultiplier;
      }
    }
    saveCurrentConfigToStorage();
  });

  speedPresetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const spd = parseFloat(btn.dataset.speed);
      const cfg = getActiveCharConfig();
      cfg.speedMultiplier = spd;
      charSpeed.value = spd;
      charSpeedVal.innerText = `${spd.toFixed(1)} x`;
      speedPresetButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      for (const f of simFishes) {
        if (f.type === activeCharId) {
          f.speedMultiplier = spd;
        }
      }
      saveCurrentConfigToStorage();
    });
  });

  charLifetime?.addEventListener('input', (e) => {
    const cfg = getActiveCharConfig();
    cfg.lifetimeSec = parseFloat(e.target.value);
    charLifetimeVal.innerText = `${cfg.lifetimeSec.toFixed(1)} 秒`;
    for (const f of simFishes) {
      if (f.type === activeCharId) {
        f.lifetimeSec = cfg.lifetimeSec;
      }
    }
    saveCurrentConfigToStorage();
  });

  charRandomTurnRate?.addEventListener('input', (e) => {
    const cfg = getActiveCharConfig();
    cfg.randomTurnRate = parseFloat(e.target.value);
    charRandomTurnRateVal.innerText = `${Math.round(cfg.randomTurnRate * 100)}% 頻度`;
    for (const f of simFishes) {
      if (f.type === activeCharId) {
        f.randomTurnRate = cfg.randomTurnRate;
      }
    }
    saveCurrentConfigToStorage();
  });

  const charCollisionRepulsion = document.getElementById('charCollisionRepulsion');
  const charCollisionRepulsionVal = document.getElementById('charCollisionRepulsionVal');
  const repulsionPresetButtons = document.querySelectorAll('.btn-repulsion-preset');

  charCollisionRepulsion?.addEventListener('input', (e) => {
    const cfg = getActiveCharConfig();
    const rep = parseFloat(e.target.value);
    cfg.collisionRepulsion = rep;
    if (charCollisionRepulsionVal) {
      charCollisionRepulsionVal.innerText = rep === 0 ? 'OFF (0.0: すれ違う)' : `${rep.toFixed(1)} (反発あり)`;
    }
    repulsionPresetButtons.forEach(btn => {
      const btnRep = parseFloat(btn.dataset.repulsion);
      btn.classList.toggle('active', Math.abs(btnRep - rep) < 0.05);
    });
    for (const f of simFishes) {
      if (f.type === activeCharId) {
        f.collisionRepulsion = rep;
      }
    }
    saveCurrentConfigToStorage();
  });

  repulsionPresetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const rep = parseFloat(btn.dataset.repulsion);
      const cfg = getActiveCharConfig();
      cfg.collisionRepulsion = rep;
      if (charCollisionRepulsion) charCollisionRepulsion.value = rep;
      if (charCollisionRepulsionVal) {
        charCollisionRepulsionVal.innerText = rep === 0 ? 'OFF (0.0: すれ違う)' : `${rep.toFixed(1)} (反発あり)`;
      }
      repulsionPresetButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      for (const f of simFishes) {
        if (f.type === activeCharId) {
          f.collisionRepulsion = rep;
        }
      }
      saveCurrentConfigToStorage();
      try { sound.init(); sound.playTap(); } catch (e) { }
    });
  });

  // 魚の分散度 (まばら度) リスナー
  const charDispersion = document.getElementById('charDispersion');
  const charDispersionVal = document.getElementById('charDispersionVal');
  const dispersionPresetButtons = document.querySelectorAll('.btn-dispersion-preset');

  charDispersion?.addEventListener('input', (e) => {
    const cfg = getActiveCharConfig();
    const dispPct = parseInt(e.target.value, 10);
    const disp = dispPct / 100;
    cfg.dispersionRate = disp;
    currentConfig.dispersionRate = disp;
    if (charDispersionVal) {
      charDispersionVal.innerText = `${dispPct} %`;
    }
    dispersionPresetButtons.forEach(btn => {
      const btnDisp = parseFloat(btn.dataset.dispersion);
      btn.classList.toggle('active', Math.abs(btnDisp - disp) < 0.05);
    });
    for (const f of simFishes) {
      if (f.type === activeCharId) {
        f.dispersionRate = disp;
      }
    }
    saveCurrentConfigToStorage();
  });

  dispersionPresetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const disp = parseFloat(btn.dataset.dispersion);
      const dispPct = Math.round(disp * 100);
      const cfg = getActiveCharConfig();
      cfg.dispersionRate = disp;
      currentConfig.dispersionRate = disp;
      if (charDispersion) charDispersion.value = dispPct;
      if (charDispersionVal) charDispersionVal.innerText = `${dispPct} %`;
      dispersionPresetButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      for (const f of simFishes) {
        if (f.type === activeCharId) {
          f.dispersionRate = disp;
        }
      }
      saveCurrentConfigToStorage();
      try { sound.init(); sound.playTap(); } catch (e) { }
    });
  });

  // 🏁 ゲーム開始時のキャラクター配置・遊泳設定 (全モード共通) コントロール
  const startKareiCount = document.getElementById('startKareiCount');
  const startKareiCountVal = document.getElementById('startKareiCountVal');
  const startHirameCount = document.getElementById('startHirameCount');
  const startHirameCountVal = document.getElementById('startHirameCountVal');
  const startDisturberTypeCount = document.getElementById('startDisturberTypeCount');
  const startDisturberTypeCountVal = document.getElementById('startDisturberTypeCountVal');
  const startDisturberCountPerType = document.getElementById('startDisturberCountPerType');
  const startDisturberCountPerTypeVal = document.getElementById('startDisturberCountPerTypeVal');
  const startSpeedMultiplier = document.getElementById('startSpeedMultiplier');
  const startSpeedMultiplierVal = document.getElementById('startSpeedMultiplierVal');

  function initStartSettingsUI() {
    if (!currentConfig.startConfig) {
      currentConfig.startConfig = JSON.parse(JSON.stringify(DEFAULT_START_CONFIG));
    }
    const sCfg = currentConfig.startConfig;

    if (startKareiCount && startKareiCountVal) {
      const val = sCfg.kareiCount !== undefined ? parseInt(sCfg.kareiCount, 10) : 4;
      startKareiCount.value = val;
      startKareiCountVal.innerText = `${val} 匹`;
    }
    if (startHirameCount && startHirameCountVal) {
      const val = sCfg.hirameCount !== undefined ? parseInt(sCfg.hirameCount, 10) : 4;
      startHirameCount.value = val;
      startHirameCountVal.innerText = `${val} 匹`;
    }
    if (startDisturberTypeCount && startDisturberTypeCountVal) {
      const val = sCfg.disturberTypeCount !== undefined ? parseInt(sCfg.disturberTypeCount, 10) : 3;
      startDisturberTypeCount.value = val;
      startDisturberTypeCountVal.innerText = `${val} 種類`;
    }
    if (startDisturberCountPerType && startDisturberCountPerTypeVal) {
      const val = sCfg.disturberCountPerType !== undefined ? parseInt(sCfg.disturberCountPerType, 10) : 2;
      startDisturberCountPerType.value = val;
      startDisturberCountPerTypeVal.innerText = `${val} 匹`;
    }
    if (startSpeedMultiplier && startSpeedMultiplierVal) {
      const val = sCfg.startSpeedMultiplier !== undefined ? parseFloat(sCfg.startSpeedMultiplier) : 0.6;
      startSpeedMultiplier.value = val;
      startSpeedMultiplierVal.innerText = `${val.toFixed(2)} x`;
    }
  }

  startKareiCount?.addEventListener('input', (e) => {
    if (!currentConfig.startConfig) currentConfig.startConfig = {};
    const val = parseInt(e.target.value, 10);
    currentConfig.startConfig.kareiCount = val;
    if (startKareiCountVal) startKareiCountVal.innerText = `${val} 匹`;
    saveCurrentConfigToStorage();
  });

  startHirameCount?.addEventListener('input', (e) => {
    if (!currentConfig.startConfig) currentConfig.startConfig = {};
    const val = parseInt(e.target.value, 10);
    currentConfig.startConfig.hirameCount = val;
    if (startHirameCountVal) startHirameCountVal.innerText = `${val} 匹`;
    saveCurrentConfigToStorage();
  });

  startDisturberTypeCount?.addEventListener('input', (e) => {
    if (!currentConfig.startConfig) currentConfig.startConfig = {};
    const val = parseInt(e.target.value, 10);
    currentConfig.startConfig.disturberTypeCount = val;
    if (startDisturberTypeCountVal) startDisturberTypeCountVal.innerText = `${val} 種類`;
    saveCurrentConfigToStorage();
  });

  startDisturberCountPerType?.addEventListener('input', (e) => {
    if (!currentConfig.startConfig) currentConfig.startConfig = {};
    const val = parseInt(e.target.value, 10);
    currentConfig.startConfig.disturberCountPerType = val;
    if (startDisturberCountPerTypeVal) startDisturberCountPerTypeVal.innerText = `${val} 匹`;
    saveCurrentConfigToStorage();
  });

  startSpeedMultiplier?.addEventListener('input', (e) => {
    if (!currentConfig.startConfig) currentConfig.startConfig = {};
    const val = parseFloat(e.target.value);
    currentConfig.startConfig.startSpeedMultiplier = val;
    if (startSpeedMultiplierVal) startSpeedMultiplierVal.innerText = `${val.toFixed(2)} x`;
    saveCurrentConfigToStorage();
  });

  initStartSettingsUI();

  // 餌の投入後の挙動設定 (全モード共通) コントロール
  const baitSpeedMultiplier = document.getElementById('baitSpeedMultiplier');
  const baitSpeedMultiplierVal = document.getElementById('baitSpeedMultiplierVal');
  const baitSpeedPresetButtons = document.querySelectorAll('.btn-bait-speed-preset');

  const baitSpeedRandomRange = document.getElementById('baitSpeedRandomRange');
  const baitSpeedRandomRangeVal = document.getElementById('baitSpeedRandomRangeVal');
  const baitRandomPresetButtons = document.querySelectorAll('.btn-bait-random-preset');

  const baitEatingStaySec = document.getElementById('baitEatingStaySec');
  const baitEatingStaySecVal = document.getElementById('baitEatingStaySecVal');
  const baitStayPresetButtons = document.querySelectorAll('.btn-bait-stay-preset');

  const baitDisappearDelaySec = document.getElementById('baitDisappearDelaySec');
  const baitDisappearDelaySecVal = document.getElementById('baitDisappearDelaySecVal');
  const baitDisappearPresetButtons = document.querySelectorAll('.btn-bait-disappear-preset');

  // 餌の追加条件 (pt / ターゲット獲得数 / コンボ数) & 対象派閥モード
  const baitTargetScopeBadge = document.getElementById('baitTargetScopeBadge');
  const baitScopeButtons = document.querySelectorAll('.btn-bait-scope');

  const baitPointThreshold = document.getElementById('baitPointThreshold');
  const baitPointThresholdVal = document.getElementById('baitPointThresholdVal');
  const baitPointPresetButtons = document.querySelectorAll('.btn-bait-point-preset');

  const baitTargetCountThreshold = document.getElementById('baitTargetCountThreshold');
  const baitTargetCountThresholdVal = document.getElementById('baitTargetCountThresholdVal');
  const baitTargetPresetButtons = document.querySelectorAll('.btn-bait-target-preset');

  const baitComboThreshold = document.getElementById('baitComboThreshold');
  const baitComboThresholdVal = document.getElementById('baitComboThresholdVal');
  const baitComboPresetButtons = document.querySelectorAll('.btn-bait-combo-preset');

  let currentBaitScope = 'all'; // 'all' | 'karei' | 'hirame' | 'hirai'

  function getBaitConfigForScope(scope = currentBaitScope) {
    if (!currentConfig.baitConfig) {
      currentConfig.baitConfig = JSON.parse(JSON.stringify(DEFAULT_BAIT_CONFIG));
    }
    const bCfg = currentConfig.baitConfig;
    if (!bCfg.modeConfigs) {
      bCfg.modeConfigs = {
        karei: { pointThreshold: 1000, targetCountThreshold: 15, comboThreshold: 10 },
        hirame: { pointThreshold: 1000, targetCountThreshold: 15, comboThreshold: 10 },
        hirai: { pointThreshold: 1000, targetCountThreshold: 15, comboThreshold: 10 }
      };
    }
    if (scope === 'all') {
      return bCfg;
    }
    if (!bCfg.modeConfigs[scope]) {
      bCfg.modeConfigs[scope] = {
        pointThreshold: bCfg.pointThreshold !== undefined ? bCfg.pointThreshold : 1000,
        targetCountThreshold: bCfg.targetCountThreshold !== undefined ? bCfg.targetCountThreshold : 15,
        comboThreshold: bCfg.comboThreshold !== undefined ? bCfg.comboThreshold : 10
      };
    }
    return bCfg.modeConfigs[scope];
  }

  function formatBaitThresholdVal(val, unit) {
    const num = parseInt(val, 10);
    if (num === 0) return '0 (なし)';
    if (num === 99) return '99 (ランダム)';
    return `${num} ${unit}`;
  }

  function updateBaitConditionUI() {
    const cfg = getBaitConfigForScope(currentBaitScope);
    const pVal = cfg.pointThreshold !== undefined ? Number(cfg.pointThreshold) : 1000;
    const tVal = cfg.targetCountThreshold !== undefined ? Number(cfg.targetCountThreshold) : 15;
    const cVal = cfg.comboThreshold !== undefined ? Number(cfg.comboThreshold) : 10;

    // 1. ポイント
    if (baitPointThreshold && baitPointThresholdVal) {
      baitPointThreshold.value = pVal;
      baitPointThresholdVal.innerText = formatBaitThresholdVal(pVal, 'pt');
      baitPointPresetButtons.forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.val, 10) === pVal);
      });
    }

    // 2. ターゲット獲得数
    if (baitTargetCountThreshold && baitTargetCountThresholdVal) {
      baitTargetCountThreshold.value = tVal;
      baitTargetCountThresholdVal.innerText = formatBaitThresholdVal(tVal, '匹');
      baitTargetPresetButtons.forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.val, 10) === tVal);
      });
    }

    // 3. コンボ数
    if (baitComboThreshold && baitComboThresholdVal) {
      baitComboThreshold.value = cVal;
      baitComboThresholdVal.innerText = formatBaitThresholdVal(cVal, 'コンボ');
      baitComboPresetButtons.forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.val, 10) === cVal);
      });
    }

    // モードスコープバッジ & ボタン
    const scopeNames = {
      all: '全て共通',
      karei: 'カレイ派',
      hirame: 'ヒラメ派',
      hirai: 'ヒライ派'
    };
    if (baitTargetScopeBadge) {
      baitTargetScopeBadge.innerText = scopeNames[currentBaitScope] || '全て共通';
      baitTargetScopeBadge.style.background = currentBaitScope === 'all' ? '#eab308' : '#38bdf8';
    }
    baitScopeButtons.forEach(b => {
      b.classList.toggle('active', b.dataset.scope === currentBaitScope);
    });
  }

  function setBaitConditionVal(field, val) {
    if (!currentConfig.baitConfig) {
      currentConfig.baitConfig = JSON.parse(JSON.stringify(DEFAULT_BAIT_CONFIG));
    }
    const bCfg = currentConfig.baitConfig;
    if (!bCfg.modeConfigs) {
      bCfg.modeConfigs = {
        karei: { pointThreshold: 1000, targetCountThreshold: 15, comboThreshold: 10 },
        hirame: { pointThreshold: 1000, targetCountThreshold: 15, comboThreshold: 10 },
        hirai: { pointThreshold: 1000, targetCountThreshold: 15, comboThreshold: 10 }
      };
    }

    const num = Math.max(0, parseInt(val, 10) || 0);

    if (currentBaitScope === 'all') {
      bCfg[field] = num;
      bCfg.targetScope = 'all';
      // 全モードにも一括反映
      ['karei', 'hirame', 'hirai'].forEach(m => {
        if (!bCfg.modeConfigs[m]) bCfg.modeConfigs[m] = {};
        bCfg.modeConfigs[m][field] = num;
      });
    } else {
      bCfg.targetScope = 'custom';
      if (!bCfg.modeConfigs[currentBaitScope]) bCfg.modeConfigs[currentBaitScope] = {};
      bCfg.modeConfigs[currentBaitScope][field] = num;
    }

    updateBaitConditionUI();
    saveCurrentConfigToStorage();
  }

  function initBaitSettingsUI() {
    if (!currentConfig.baitConfig) {
      currentConfig.baitConfig = JSON.parse(JSON.stringify(DEFAULT_BAIT_CONFIG));
    }
    const bCfg = currentConfig.baitConfig;

    if (bCfg.targetScope) {
      currentBaitScope = bCfg.targetScope;
    }
    updateBaitConditionUI();

    if (baitSpeedMultiplier && baitSpeedMultiplierVal) {
      const spd = bCfg.speedMultiplier !== undefined ? Number(bCfg.speedMultiplier) : 1.8;
      baitSpeedMultiplier.value = spd;
      baitSpeedMultiplierVal.innerText = `${spd.toFixed(1)} x`;
      baitSpeedPresetButtons.forEach(b => {
        b.classList.toggle('active', Math.abs(parseFloat(b.dataset.speed) - spd) < 0.05);
      });
    }

    if (baitSpeedRandomRange && baitSpeedRandomRangeVal) {
      const rnd = bCfg.speedRandomRange !== undefined ? Number(bCfg.speedRandomRange) : 0.3;
      baitSpeedRandomRange.value = rnd;
      baitSpeedRandomRangeVal.innerText = `±${rnd.toFixed(2)} x`;
      baitRandomPresetButtons.forEach(b => {
        b.classList.toggle('active', Math.abs(parseFloat(b.dataset.random) - rnd) < 0.05);
      });
    }

    if (baitEatingStaySec && baitEatingStaySecVal) {
      const stay = bCfg.eatingStaySec !== undefined ? Number(bCfg.eatingStaySec) : 3.0;
      baitEatingStaySec.value = stay;
      baitEatingStaySecVal.innerText = `${stay.toFixed(1)} 秒`;
      baitStayPresetButtons.forEach(b => {
        b.classList.toggle('active', Math.abs(parseFloat(b.dataset.stay) - stay) < 0.05);
      });
    }

    if (baitDisappearDelaySec && baitDisappearDelaySecVal) {
      const delay = bCfg.disappearDelaySec !== undefined ? Number(bCfg.disappearDelaySec) : 8.0;
      baitDisappearDelaySec.value = delay;
      baitDisappearDelaySecVal.innerText = `${delay.toFixed(1)} 秒`;
      baitDisappearPresetButtons.forEach(b => {
        b.classList.toggle('active', Math.abs(parseFloat(b.dataset.delay) - delay) < 0.05);
      });
    }
  }

  // 餌追加条件のイベントリスナー
  baitScopeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      currentBaitScope = btn.dataset.scope || 'all';
      if (!currentConfig.baitConfig) currentConfig.baitConfig = {};
      currentConfig.baitConfig.targetScope = currentBaitScope;
      updateBaitConditionUI();
      saveCurrentConfigToStorage();
      try { sound.init(); sound.playTap(); } catch (e) { }
    });
  });

  baitPointThreshold?.addEventListener('input', (e) => {
    setBaitConditionVal('pointThreshold', e.target.value);
  });
  baitPointPresetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      setBaitConditionVal('pointThreshold', btn.dataset.val);
      try { sound.init(); sound.playTap(); } catch (e) { }
    });
  });

  baitTargetCountThreshold?.addEventListener('input', (e) => {
    setBaitConditionVal('targetCountThreshold', e.target.value);
  });
  baitTargetPresetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      setBaitConditionVal('targetCountThreshold', btn.dataset.val);
      try { sound.init(); sound.playTap(); } catch (e) { }
    });
  });

  baitComboThreshold?.addEventListener('input', (e) => {
    setBaitConditionVal('comboThreshold', e.target.value);
  });
  baitComboPresetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      setBaitConditionVal('comboThreshold', btn.dataset.val);
      try { sound.init(); sound.playTap(); } catch (e) { }
    });
  });

  baitSpeedMultiplier?.addEventListener('input', (e) => {
    if (!currentConfig.baitConfig) currentConfig.baitConfig = {};
    const spd = parseFloat(e.target.value);
    currentConfig.baitConfig.speedMultiplier = spd;
    if (baitSpeedMultiplierVal) baitSpeedMultiplierVal.innerText = `${spd.toFixed(1)} x`;
    baitSpeedPresetButtons.forEach(b => {
      b.classList.toggle('active', Math.abs(parseFloat(b.dataset.speed) - spd) < 0.05);
    });
    saveCurrentConfigToStorage();
  });

  baitSpeedPresetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (!currentConfig.baitConfig) currentConfig.baitConfig = {};
      const spd = parseFloat(btn.dataset.speed);
      currentConfig.baitConfig.speedMultiplier = spd;
      if (baitSpeedMultiplier) baitSpeedMultiplier.value = spd;
      if (baitSpeedMultiplierVal) baitSpeedMultiplierVal.innerText = `${spd.toFixed(1)} x`;
      baitSpeedPresetButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      saveCurrentConfigToStorage();
      try { sound.init(); sound.playTap(); } catch (e) { }
    });
  });

  baitSpeedRandomRange?.addEventListener('input', (e) => {
    if (!currentConfig.baitConfig) currentConfig.baitConfig = {};
    const rnd = parseFloat(e.target.value);
    currentConfig.baitConfig.speedRandomRange = rnd;
    if (baitSpeedRandomRangeVal) baitSpeedRandomRangeVal.innerText = `±${rnd.toFixed(2)} x`;
    baitRandomPresetButtons.forEach(b => {
      b.classList.toggle('active', Math.abs(parseFloat(b.dataset.random) - rnd) < 0.05);
    });
    saveCurrentConfigToStorage();
  });

  baitRandomPresetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (!currentConfig.baitConfig) currentConfig.baitConfig = {};
      const rnd = parseFloat(btn.dataset.random);
      currentConfig.baitConfig.speedRandomRange = rnd;
      if (baitSpeedRandomRange) baitSpeedRandomRange.value = rnd;
      if (baitSpeedRandomRangeVal) baitSpeedRandomRangeVal.innerText = `±${rnd.toFixed(2)} x`;
      baitRandomPresetButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      saveCurrentConfigToStorage();
      try { sound.init(); sound.playTap(); } catch (e) { }
    });
  });

  baitEatingStaySec?.addEventListener('input', (e) => {
    if (!currentConfig.baitConfig) currentConfig.baitConfig = {};
    const stay = parseFloat(e.target.value);
    currentConfig.baitConfig.eatingStaySec = stay;
    if (baitEatingStaySecVal) baitEatingStaySecVal.innerText = `${stay.toFixed(1)} 秒`;
    baitStayPresetButtons.forEach(b => {
      b.classList.toggle('active', Math.abs(parseFloat(b.dataset.stay) - stay) < 0.05);
    });
    saveCurrentConfigToStorage();
  });

  baitStayPresetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (!currentConfig.baitConfig) currentConfig.baitConfig = {};
      const stay = parseFloat(btn.dataset.stay);
      currentConfig.baitConfig.eatingStaySec = stay;
      if (baitEatingStaySec) baitEatingStaySec.value = stay;
      if (baitEatingStaySecVal) baitEatingStaySecVal.innerText = `${stay.toFixed(1)} 秒`;
      baitStayPresetButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      saveCurrentConfigToStorage();
      try { sound.init(); sound.playTap(); } catch (e) { }
    });
  });

  baitDisappearDelaySec?.addEventListener('input', (e) => {
    if (!currentConfig.baitConfig) currentConfig.baitConfig = {};
    const delay = parseFloat(e.target.value);
    currentConfig.baitConfig.disappearDelaySec = delay;
    if (baitDisappearDelaySecVal) baitDisappearDelaySecVal.innerText = `${delay.toFixed(1)} 秒`;
    baitDisappearPresetButtons.forEach(b => {
      b.classList.toggle('active', Math.abs(parseFloat(b.dataset.delay) - delay) < 0.05);
    });
    saveCurrentConfigToStorage();
  });

  baitDisappearPresetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (!currentConfig.baitConfig) currentConfig.baitConfig = {};
      const delay = parseFloat(btn.dataset.delay);
      currentConfig.baitConfig.disappearDelaySec = delay;
      if (baitDisappearDelaySec) baitDisappearDelaySec.value = delay;
      if (baitDisappearDelaySecVal) baitDisappearDelaySecVal.innerText = `${delay.toFixed(1)} 秒`;
      baitDisappearPresetButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      saveCurrentConfigToStorage();
      try { sound.init(); sound.playTap(); } catch (e) { }
    });
  });

  initBaitSettingsUI();

  // -------------------------------------------------------------
  // 6. 出現＆餌演出テキスト設定UI (多言語: ja, en, ko, zh)
  // -------------------------------------------------------------
  const textTargetLangBadge = document.getElementById('textTargetLangBadge');
  const textLangButtons = document.querySelectorAll('.btn-text-lang');

  const txtSpawnAlert = document.getElementById('txtSpawnAlert');
  const previewSpawnAlert = document.getElementById('previewSpawnAlert');

  const txtBaitRewardPoint = document.getElementById('txtBaitRewardPoint');
  const previewBaitRewardPoint = document.getElementById('previewBaitRewardPoint');

  const txtBaitRewardPointRandom = document.getElementById('txtBaitRewardPointRandom');
  const previewBaitRewardPointRandom = document.getElementById('previewBaitRewardPointRandom');

  const txtBaitRewardTargetCount = document.getElementById('txtBaitRewardTargetCount');
  const previewBaitRewardTargetCount = document.getElementById('previewBaitRewardTargetCount');

  const txtBaitRewardTargetCountRandom = document.getElementById('txtBaitRewardTargetCountRandom');
  const previewBaitRewardTargetCountRandom = document.getElementById('previewBaitRewardTargetCountRandom');

  const txtBaitRewardCombo = document.getElementById('txtBaitRewardCombo');
  const previewBaitRewardCombo = document.getElementById('previewBaitRewardCombo');

  const txtAnonymousName = document.getElementById('txtAnonymousName');
  const previewAnonymousName = document.getElementById('previewAnonymousName');

  const btnResetCurrentLangText = document.getElementById('btnResetCurrentLangText');
  const btnResetAllLangText = document.getElementById('btnResetAllLangText');

  let currentEditingLang = 'ja'; // 'ja' | 'en' | 'ko' | 'zh'

  const LANG_LABELS = {
    ja: '🇯🇵 日本語 (ja)',
    en: '🇺🇸 English (en)',
    ko: '🇰🇷 한국어 (ko)',
    zh: '🇨🇳 中文 (zh)'
  };

  const SAMPLE_CHAR_NAMES = {
    ja: 'ぶーちゃん',
    en: 'Boo-chan',
    ko: '부짱',
    zh: '嘟嘟猪'
  };

  function ensureTextConfig() {
    if (!currentConfig.textConfig) {
      currentConfig.textConfig = JSON.parse(JSON.stringify(DEFAULT_TEXT_CONFIG));
    }
    const tc = currentConfig.textConfig;
    ['spawnAlert', 'baitRewardPoint', 'baitRewardPointRandom', 'baitRewardTargetCount', 'baitRewardTargetCountRandom', 'baitRewardCombo', 'anonymousName'].forEach(k => {
      if (!tc[k]) tc[k] = {};
      ['ja', 'en', 'ko', 'zh'].forEach(l => {
        if (tc[k][l] === undefined) {
          tc[k][l] = DEFAULT_TEXT_CONFIG[k]?.[l] || '';
        }
      });
    });
    return tc;
  }

  function updateTextSettingsUI() {
    const tc = ensureTextConfig();
    const lang = currentEditingLang;

    if (textTargetLangBadge) {
      textTargetLangBadge.innerText = LANG_LABELS[lang] || lang;
    }
    textLangButtons.forEach(b => {
      b.classList.toggle('active', b.dataset.lang === lang);
    });

    const sampleName = SAMPLE_CHAR_NAMES[lang] || 'Boo-chan';

    // 1. 出現メッセージ
    if (txtSpawnAlert && previewSpawnAlert) {
      const val = tc.spawnAlert[lang] || '';
      txtSpawnAlert.value = val;
      previewSpawnAlert.innerText = val.replace(/\{name\}/g, sampleName);
    }

    // 2. 餌: pt達成時
    if (txtBaitRewardPoint && previewBaitRewardPoint) {
      const val = tc.baitRewardPoint[lang] || '';
      txtBaitRewardPoint.value = val;
      previewBaitRewardPoint.innerText = val.replace(/\{count\}/g, '1').replace(/\{pt\}/g, '1000');
    }

    // 3. 餌: ptランダム
    if (txtBaitRewardPointRandom && previewBaitRewardPointRandom) {
      const val = tc.baitRewardPointRandom[lang] || '';
      txtBaitRewardPointRandom.value = val;
      previewBaitRewardPointRandom.innerText = val;
    }

    // 4. 餌: ターゲット捕獲数達成時
    if (txtBaitRewardTargetCount && previewBaitRewardTargetCount) {
      const val = tc.baitRewardTargetCount[lang] || '';
      txtBaitRewardTargetCount.value = val;
      previewBaitRewardTargetCount.innerText = val.replace(/\{count\}/g, '1').replace(/\{targetCount\}/g, '15');
    }

    // 5. 餌: ターゲット捕獲数ランダム
    if (txtBaitRewardTargetCountRandom && previewBaitRewardTargetCountRandom) {
      const val = tc.baitRewardTargetCountRandom[lang] || '';
      txtBaitRewardTargetCountRandom.value = val;
      previewBaitRewardTargetCountRandom.innerText = val;
    }

    // 6. 餌: コンボ達成時
    if (txtBaitRewardCombo && previewBaitRewardCombo) {
      const val = tc.baitRewardCombo[lang] || '';
      txtBaitRewardCombo.value = val;
      previewBaitRewardCombo.innerText = val.replace(/\{combo\}/g, '10');
    }

    // 7. 名無しユーザー名
    if (txtAnonymousName && previewAnonymousName) {
      const val = tc.anonymousName[lang] || '';
      txtAnonymousName.value = val;
      previewAnonymousName.innerText = val;
    }
  }

  function saveTextConfigField(key, val) {
    const tc = ensureTextConfig();
    tc[key][currentEditingLang] = val;
    updateTextSettingsUI();
    saveCurrentConfigToStorage();
  }

  textLangButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      currentEditingLang = btn.dataset.lang || 'ja';
      updateTextSettingsUI();
      try { sound.init(); sound.playTap(); } catch (e) { }
    });
  });

  txtSpawnAlert?.addEventListener('input', (e) => saveTextConfigField('spawnAlert', e.target.value));
  txtBaitRewardPoint?.addEventListener('input', (e) => saveTextConfigField('baitRewardPoint', e.target.value));
  txtBaitRewardPointRandom?.addEventListener('input', (e) => saveTextConfigField('baitRewardPointRandom', e.target.value));
  txtBaitRewardTargetCount?.addEventListener('input', (e) => saveTextConfigField('baitRewardTargetCount', e.target.value));
  txtBaitRewardTargetCountRandom?.addEventListener('input', (e) => saveTextConfigField('baitRewardTargetCountRandom', e.target.value));
  txtBaitRewardCombo?.addEventListener('input', (e) => saveTextConfigField('baitRewardCombo', e.target.value));
  txtAnonymousName?.addEventListener('input', (e) => saveTextConfigField('anonymousName', e.target.value));

  btnResetCurrentLangText?.addEventListener('click', () => {
    const tc = ensureTextConfig();
    const l = currentEditingLang;
    ['spawnAlert', 'baitRewardPoint', 'baitRewardPointRandom', 'baitRewardTargetCount', 'baitRewardTargetCountRandom', 'baitRewardCombo', 'anonymousName'].forEach(k => {
      tc[k][l] = DEFAULT_TEXT_CONFIG[k][l];
    });
    updateTextSettingsUI();
    saveCurrentConfigToStorage();
    try { sound.init(); sound.playTap(); } catch (e) { }
  });

  btnResetAllLangText?.addEventListener('click', () => {
    if (confirm('全言語（日本語・英語・韓国語・中国語）の演出テキスト設定をすべてデフォルトの初期値にリセットしますか？')) {
      currentConfig.textConfig = JSON.parse(JSON.stringify(DEFAULT_TEXT_CONFIG));
      updateTextSettingsUI();
      saveCurrentConfigToStorage();
      try { sound.init(); sound.playTap(); } catch (e) { }
    }
  });

  updateTextSettingsUI();

  // シルエット演出設定UIの初期化とイベントリスナー
  function initSilhouetteSettingsUI() {
    const charSilhouetteChance = document.getElementById('charSilhouetteChance');
    const charSilhouetteChanceVal = document.getElementById('charSilhouetteChanceVal');
    const silChancePresetButtons = document.querySelectorAll('.btn-sil-chance-preset');

    const charSilhouetteDuration = document.getElementById('charSilhouetteDuration');
    const charSilhouetteDurationVal = document.getElementById('charSilhouetteDurationVal');
    const silDurPresetButtons = document.querySelectorAll('.btn-sil-dur-preset');

    const charSilhouetteShrink = document.getElementById('charSilhouetteShrink');
    const charSilhouetteShrinkVal = document.getElementById('charSilhouetteShrinkVal');
    const silShrinkPresetButtons = document.querySelectorAll('.btn-sil-shrink-preset');

    charSilhouetteChance?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      const cfg = getActiveCharConfig();
      if (!cfg.silhouetteConfig) cfg.silhouetteConfig = { ...DEFAULT_SILHOUETTE_CONFIG };
      cfg.silhouetteConfig.chancePercent = val;
      if (charSilhouetteChanceVal) charSilhouetteChanceVal.innerText = `${val} %`;
      silChancePresetButtons.forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.val, 10) === val);
      });
      for (const f of simFishes) {
        if (f.type === activeCharId) {
          if (!f.silhouetteConfig) f.silhouetteConfig = { ...DEFAULT_SILHOUETTE_CONFIG };
          f.silhouetteConfig.chancePercent = val;
        }
      }
      saveCurrentConfigToStorage();
    });

    silChancePresetButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const val = parseInt(btn.dataset.val, 10);
        const cfg = getActiveCharConfig();
        if (!cfg.silhouetteConfig) cfg.silhouetteConfig = { ...DEFAULT_SILHOUETTE_CONFIG };
        cfg.silhouetteConfig.chancePercent = val;
        if (charSilhouetteChance) charSilhouetteChance.value = val;
        if (charSilhouetteChanceVal) charSilhouetteChanceVal.innerText = `${val} %`;
        silChancePresetButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        for (const f of simFishes) {
          if (f.type === activeCharId) {
            if (!f.silhouetteConfig) f.silhouetteConfig = { ...DEFAULT_SILHOUETTE_CONFIG };
            f.silhouetteConfig.chancePercent = val;
          }
        }
        saveCurrentConfigToStorage();
        try { sound.init(); sound.playTap(); } catch (e) { }
      });
    });

    charSilhouetteDuration?.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      const cfg = getActiveCharConfig();
      if (!cfg.silhouetteConfig) cfg.silhouetteConfig = { ...DEFAULT_SILHOUETTE_CONFIG };
      cfg.silhouetteConfig.durationSec = val;
      if (charSilhouetteDurationVal) charSilhouetteDurationVal.innerText = `${val.toFixed(1)} 秒`;
      silDurPresetButtons.forEach(b => {
        b.classList.toggle('active', Math.abs(parseFloat(b.dataset.val) - val) < 0.05);
      });
      for (const f of simFishes) {
        if (f.type === activeCharId) {
          if (!f.silhouetteConfig) f.silhouetteConfig = { ...DEFAULT_SILHOUETTE_CONFIG };
          f.silhouetteConfig.durationSec = val;
        }
      }
      saveCurrentConfigToStorage();
    });

    silDurPresetButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const val = parseFloat(btn.dataset.val);
        const cfg = getActiveCharConfig();
        if (!cfg.silhouetteConfig) cfg.silhouetteConfig = { ...DEFAULT_SILHOUETTE_CONFIG };
        cfg.silhouetteConfig.durationSec = val;
        if (charSilhouetteDuration) charSilhouetteDuration.value = val;
        if (charSilhouetteDurationVal) charSilhouetteDurationVal.innerText = `${val.toFixed(1)} 秒`;
        silDurPresetButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        for (const f of simFishes) {
          if (f.type === activeCharId) {
            if (!f.silhouetteConfig) f.silhouetteConfig = { ...DEFAULT_SILHOUETTE_CONFIG };
            f.silhouetteConfig.durationSec = val;
          }
        }
        saveCurrentConfigToStorage();
        try { sound.init(); sound.playTap(); } catch (e) { }
      });
    });

    charSilhouetteShrink?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      const scale = val / 100;
      const cfg = getActiveCharConfig();
      if (!cfg.silhouetteConfig) cfg.silhouetteConfig = { ...DEFAULT_SILHOUETTE_CONFIG };
      cfg.silhouetteConfig.shrinkScale = scale;
      if (charSilhouetteShrinkVal) charSilhouetteShrinkVal.innerText = `${val} % (${scale.toFixed(2)}x)`;
      silShrinkPresetButtons.forEach(b => {
        b.classList.toggle('active', parseInt(b.dataset.val, 10) === val);
      });
      for (const f of simFishes) {
        if (f.type === activeCharId) {
          if (!f.silhouetteConfig) f.silhouetteConfig = { ...DEFAULT_SILHOUETTE_CONFIG };
          f.silhouetteConfig.shrinkScale = scale;
        }
      }
      saveCurrentConfigToStorage();
    });

    silShrinkPresetButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const val = parseInt(btn.dataset.val, 10);
        const scale = val / 100;
        const cfg = getActiveCharConfig();
        if (!cfg.silhouetteConfig) cfg.silhouetteConfig = { ...DEFAULT_SILHOUETTE_CONFIG };
        cfg.silhouetteConfig.shrinkScale = scale;
        if (charSilhouetteShrink) charSilhouetteShrink.value = val;
        if (charSilhouetteShrinkVal) charSilhouetteShrinkVal.innerText = `${val} % (${scale.toFixed(2)}x)`;
        silShrinkPresetButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        for (const f of simFishes) {
          if (f.type === activeCharId) {
            if (!f.silhouetteConfig) f.silhouetteConfig = { ...DEFAULT_SILHOUETTE_CONFIG };
            f.silhouetteConfig.shrinkScale = scale;
          }
        }
        saveCurrentConfigToStorage();
        try { sound.init(); sound.playTap(); } catch (e) { }
      });
    });
  }

  initSilhouetteSettingsUI();

  // 初心者機能トグル
  charBeginnerAlert?.addEventListener('change', (e) => {
    const cfg = getActiveCharConfig();
    cfg.beginnerAlert = e.target.checked;
    charBeginnerAlertVal.innerText = cfg.beginnerAlert ? 'ON (点滅あり)' : 'OFF (点滅なし)';
    charBeginnerAlertVal.className = cfg.beginnerAlert ? 'val-pill val-pill-success' : 'val-pill val-pill-off';
    for (const f of simFishes) {
      if (f.type === activeCharId) {
        f.beginnerAlert = cfg.beginnerAlert;
      }
    }
    saveCurrentConfigToStorage();
  });

  // 邪魔キャラ設定リスナー
  charDisturberWeight?.addEventListener('input', (e) => {
    const cfg = getActiveCharConfig();
    cfg.weight = parseInt(e.target.value, 10);
    charDisturberWeightVal.innerText = cfg.weight;
    syncSimCanvasCount();
    saveCurrentConfigToStorage();
  });

  charDisturberScoreThreshold?.addEventListener('input', (e) => {
    const cfg = getActiveCharConfig();
    cfg.scoreThreshold = parseInt(e.target.value, 10);
    charDisturberScoreThresholdVal.innerText = `${cfg.scoreThreshold} pt`;
    saveCurrentConfigToStorage();
  });

  // 「全てのキャラに適用」ボタン
  btnApplyCommonToAll?.addEventListener('click', () => {
    const cur = getActiveCharConfig();
    const commonFields = {
      sizeScale: cur.sizeScale ?? 1.0,
      count: cur.count ?? 20,
      minTargetThreshold: cur.minTargetThreshold ?? 2,
      speedMultiplier: cur.speedMultiplier ?? 1.0,
      lifetimeSec: cur.lifetimeSec ?? 6.0,
      randomTurnRate: cur.randomTurnRate ?? 0.02,
      collisionRepulsion: cur.collisionRepulsion ?? 0,
      dispersionRate: cur.dispersionRate ?? 0.5,
      silhouetteConfig: cur.silhouetteConfig ? JSON.parse(JSON.stringify(cur.silhouetteConfig)) : JSON.parse(JSON.stringify(DEFAULT_SILHOUETTE_CONFIG))
    };

    // 現在編集中のディクショナリ（全モード共通 or 個別モード）の全キャラに適用
    const targetDict = getActiveCharactersDict();
    for (const [id, cCfg] of Object.entries(targetDict)) {
      Object.assign(cCfg, commonFields);
    }

    if (currentConfig.gameBalanceUnified === false) {
      const mode = currentConfig.activeConfigMode || 'karei';
      if (!currentConfig.modeConfigs[mode]) currentConfig.modeConfigs[mode] = createDefaultModeConfig(mode);
      currentConfig.modeConfigs[mode].speedMultiplier = commonFields.speedMultiplier;
      currentConfig.modeConfigs[mode].lifetimeSec = commonFields.lifetimeSec;
      currentConfig.modeConfigs[mode].minTargetThreshold = commonFields.minTargetThreshold;
      currentConfig.modeConfigs[mode].randomTurnRate = commonFields.randomTurnRate;
      currentConfig.modeConfigs[mode].targetFishCount = commonFields.count * 2;
      currentConfig.modeConfigs[mode].collisionRepulsion = commonFields.collisionRepulsion;
      currentConfig.modeConfigs[mode].dispersionRate = commonFields.dispersionRate;
      currentConfig.modeConfigs[mode].silhouetteConfig = JSON.parse(JSON.stringify(commonFields.silhouetteConfig));
    } else {
      currentConfig.speedMultiplier = commonFields.speedMultiplier;
      currentConfig.lifetimeSec = commonFields.lifetimeSec;
      currentConfig.minTargetThreshold = commonFields.minTargetThreshold;
      currentConfig.randomTurnRate = commonFields.randomTurnRate;
      currentConfig.targetFishCount = commonFields.count * 2;
      currentConfig.collisionRepulsion = commonFields.collisionRepulsion;
      currentConfig.dispersionRate = commonFields.dispersionRate;
      currentConfig.silhouetteConfig = JSON.parse(JSON.stringify(commonFields.silhouetteConfig));
    }

    for (const f of simFishes) {
      f.sizeScale = commonFields.sizeScale;
      f.width = f.baseWidth * f.sizeScale;
      f.height = f.baseHeight * f.sizeScale;
      f.speedMultiplier = commonFields.speedMultiplier;
      f.randomTurnRate = commonFields.randomTurnRate;
      f.lifetime = commonFields.lifetimeSec * 60;
      f.collisionRepulsion = commonFields.collisionRepulsion;
      f.dispersionRate = commonFields.dispersionRate;
      f.silhouetteConfig = JSON.parse(JSON.stringify(commonFields.silhouetteConfig));
    }

    btnApplyCommonToAll.classList.add('applied-pulse');
    const origText = btnApplyCommonToAll.innerText;
    btnApplyCommonToAll.innerText = '✅ 全てのキャラに適用完了！';
    setTimeout(() => {
      btnApplyCommonToAll.classList.remove('applied-pulse');
      btnApplyCommonToAll.innerText = origText;
    }, 1500);
  });

  // 「セット」ボタン：ゲーム本体に即座に通知＆永続化
  applySimBtn?.addEventListener('click', () => {
    localStorage.setItem('hirame_dev_config', JSON.stringify(currentConfig));
    if (adminChannel) {
      adminChannel.postMessage({ type: 'UPDATE_DEV_CONFIG', config: currentConfig, timestamp: Date.now() });
    }
    try {
      sound.init();
      sound.playSuccess();
    } catch (e) { }

    const origHtml = applySimBtn.innerHTML;
    applySimBtn.innerHTML = '<span>✅</span> 設定完了';
    applySimBtn.classList.add('btn-applied-success');
    syncStatusBadge.innerText = '⚡ ゲームに即時適用完了！';
    syncStatusBadge.style.color = '#38bdf8';
    setTimeout(() => {
      applySimBtn.innerHTML = origHtml;
      applySimBtn.classList.remove('btn-applied-success');
      syncStatusBadge.innerText = '⚡ 接続アクティブ';
      syncStatusBadge.style.color = '#10b981';
    }, 2000);
  });

  // 「現在の設定をデフォルトに設定」ボタン
  btnSaveAsDefault?.addEventListener('click', () => {
    saveCurrentConfigToStorage();
    localStorage.setItem('hirame_custom_default_config', JSON.stringify(currentConfig));
    localStorage.setItem('hirame_dev_config', JSON.stringify(currentConfig));
    if (adminChannel) {
      adminChannel.postMessage({ type: 'UPDATE_DEV_CONFIG', config: currentConfig, timestamp: Date.now() });
    }
    try {
      sound.init();
      sound.playSuccess();
    } catch (e) { }

    const origHtml = btnSaveAsDefault.innerHTML;
    btnSaveAsDefault.innerHTML = '<span>⭐</span> デフォルトに保存完了！';
    btnSaveAsDefault.style.background = 'rgba(250,204,21,0.3)';
    syncStatusBadge.innerText = '⭐ 現在の設定をデフォルトとして保存しました';
    syncStatusBadge.style.color = '#facc15';
    setTimeout(() => {
      btnSaveAsDefault.innerHTML = origHtml;
      btnSaveAsDefault.style.background = '';
      syncStatusBadge.innerText = '⚡ 接続アクティブ';
      syncStatusBadge.style.color = '#10b981';
    }, 2500);
  });

  // デフォルトに戻す
  resetSimBtn?.addEventListener('click', () => {
    const customDefault = localStorage.getItem('hirame_custom_default_config');
    let loaded = null;
    if (customDefault) {
      try {
        loaded = JSON.parse(customDefault);
      } catch (e) { }
    }
    if (loaded) {
      currentConfig = loaded;
    } else {
      currentConfig = {
        ...DEFAULT_CONFIG,
        gameBalanceUnified: true,
        activeConfigMode: 'karei',
        modeConfigs: {
          karei: createDefaultModeConfig('karei'),
          hirame: createDefaultModeConfig('hirame'),
          hirai: createDefaultModeConfig('hirai')
        },
        startConfig: JSON.parse(JSON.stringify(DEFAULT_START_CONFIG)),
        baitConfig: JSON.parse(JSON.stringify(DEFAULT_BAIT_CONFIG)),
  textConfig: JSON.parse(JSON.stringify(DEFAULT_TEXT_CONFIG)),
        playerTitles: JSON.parse(JSON.stringify(DEFAULT_PLAYER_TITLES)),
        xShareTemplate: DEFAULT_X_SHARE_TEMPLATE,
        characters: { ...DEFAULT_CHARACTER_SETTINGS },
        chaosFeverConfig: JSON.parse(JSON.stringify(DEFAULT_CHAOS_FEVER_CONFIG))
      };
    }
    updateBalanceUI();
    initStartSettingsUI();
    initBaitSettingsUI();
    renderCharSelectPills();
    syncUIForActiveChar();
    renderTitleTiers();
    updateXShareUI();
    syncChaosFeverUI();
    localStorage.setItem('hirame_dev_config', JSON.stringify(currentConfig));
    if (adminChannel) {
      adminChannel.postMessage({ type: 'UPDATE_DEV_CONFIG', config: currentConfig, timestamp: Date.now() });
    }
    syncStatusBadge.innerText = customDefault ? '🔄 カスタムデフォルトに復元' : '🔄 初期設定にリセット';
  });

  function saveCurrentConfigToStorage() {
    const activeMode = currentConfig.activeConfigMode || 'karei';
    if (!currentConfig.modeConfigs) currentConfig.modeConfigs = {};
    if (!currentConfig.modeConfigs[activeMode]) {
      currentConfig.modeConfigs[activeMode] = createDefaultModeConfig(activeMode);
    }
    // アクティブモードの設定をルートの characters にもミラーリング（後方互換性用）
    const activeChars = currentConfig.modeConfigs[activeMode].characters;
    if (activeChars) {
      if (!currentConfig.characters) currentConfig.characters = {};
      for (const [cId, cCfg] of Object.entries(activeChars)) {
        currentConfig.characters[cId] = JSON.parse(JSON.stringify(cCfg));
      }
    }

    localStorage.setItem('hirame_dev_config', JSON.stringify(currentConfig));
    if (adminChannel) {
      adminChannel.postMessage({ type: 'UPDATE_DEV_CONFIG', config: currentConfig, timestamp: Date.now() });
    }

    // マトリクスモーダルが開いている場合、セル編集中でなければマトリクス一覧も最新化
    if (configMatrixModal && !configMatrixModal.classList.contains('hidden')) {
      const activeEl = document.activeElement;
      const isEditingMatrix = activeEl && configMatrixTable && configMatrixTable.contains(activeEl);
      if (!isEditingMatrix && typeof renderConfigMatrixTable === 'function') {
        renderConfigMatrixTable(matrixCurrentMode);
      }
    }
  }

  // １．「全てのモードに適応」ボタンリスナー
  btnApplyCharToAllModes?.addEventListener('click', () => {
    const cur = getActiveCharConfig();
    const copied = JSON.parse(JSON.stringify(cur));

    const modes = ['karei', 'hirame', 'hirai'];
    for (const m of modes) {
      if (!currentConfig.modeConfigs) currentConfig.modeConfigs = {};
      if (!currentConfig.modeConfigs[m]) {
        currentConfig.modeConfigs[m] = createDefaultModeConfig(m);
      }
      if (!currentConfig.modeConfigs[m].characters) {
        currentConfig.modeConfigs[m].characters = createDefaultModeConfig(m).characters;
      }
      currentConfig.modeConfigs[m].characters[activeCharId] = JSON.parse(JSON.stringify(copied));
    }
    if (!currentConfig.characters) currentConfig.characters = {};
    currentConfig.characters[activeCharId] = JSON.parse(JSON.stringify(copied));

    saveCurrentConfigToStorage();
    syncSimCanvasCount();
    try { sound.init(); sound.playSuccess(1); } catch (e) { }

    // ボタンのフィードバック演出
    btnApplyCharToAllModes.classList.add('applied-pulse');
    const origText = btnApplyCharToAllModes.innerText;
    btnApplyCharToAllModes.innerText = '✅ 全モードに連動適用！';
    setTimeout(() => {
      btnApplyCharToAllModes.classList.remove('applied-pulse');
      btnApplyCharToAllModes.innerText = origText;
    }, 1800);
  });

  // 共通確認ダイアログモーダル表示ヘルパー (Promiseベース)
  function showAdminConfirm({ title = '確認', message = 'この操作を実行しますか？', icon = '⚠️', confirmText = 'はい', cancelText = 'いいえ', isDanger = false } = {}) {
    return new Promise((resolve) => {
      const modal = document.getElementById('adminConfirmModal');
      const titleEl = document.getElementById('confirmModalTitle');
      const msgEl = document.getElementById('confirmModalMessage');
      const iconEl = document.getElementById('confirmModalIcon');
      const okBtn = document.getElementById('btnConfirmOk');
      const cancelBtn = document.getElementById('btnConfirmCancel');

      if (!modal || !okBtn || !cancelBtn) {
        resolve(window.confirm(message));
        return;
      }

      if (titleEl) titleEl.innerText = title;
      if (msgEl) msgEl.innerText = message;
      if (iconEl) iconEl.innerText = icon;
      okBtn.innerText = confirmText;
      cancelBtn.innerText = cancelText;

      if (isDanger) {
        okBtn.classList.add('danger');
      } else {
        okBtn.classList.remove('danger');
      }

      modal.classList.remove('hidden');

      function cleanup(result) {
        modal.classList.add('hidden');
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        modal.removeEventListener('click', onBackdrop);
        window.removeEventListener('keydown', onKey);
        resolve(result);
      }

      function onOk() { cleanup(true); }
      function onCancel() { cleanup(false); }
      function onBackdrop(e) { if (e.target === modal) cleanup(false); }
      function onKey(e) { if (e.key === 'Escape') cleanup(false); }

      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
      modal.addEventListener('click', onBackdrop);
      window.addEventListener('keydown', onKey);
    });
  }

  // キャラクターのロック状態管理
  function isCharLocked(charId) {
    if (!currentConfig.lockedCharacters) currentConfig.lockedCharacters = {};
    return !!currentConfig.lockedCharacters[charId];
  }

  function toggleCharLock(charId) {
    if (!currentConfig.lockedCharacters) currentConfig.lockedCharacters = {};
    currentConfig.lockedCharacters[charId] = !currentConfig.lockedCharacters[charId];
    saveCurrentConfigToStorage();
    return currentConfig.lockedCharacters[charId];
  }

  // ２．「現在の設定一覧」別窓モーダル制御
  function openConfigMatrixModal() {
    if (!configMatrixModal) return;
    matrixCurrentMode = currentConfig.activeConfigMode || 'karei';
    updateMatrixModeTabsUI();
    renderConfigMatrixTable(matrixCurrentMode);
    configMatrixModal.classList.remove('hidden');
    try { sound.init(); sound.playTap(); } catch (e) { }
  }

  function closeConfigMatrixModal() {
    if (!configMatrixModal) return;
    configMatrixModal.classList.add('hidden');
    setActiveGameMode(matrixCurrentMode);
  }

  btnOpenConfigMatrixModal?.addEventListener('click', openConfigMatrixModal);
  closeMatrixModalBtn?.addEventListener('click', closeConfigMatrixModal);
  btnMatrixCloseBottom?.addEventListener('click', closeConfigMatrixModal);

  // オーバーレイ背景クリックで閉じる
  configMatrixModal?.addEventListener('click', (e) => {
    if (e.target === configMatrixModal) {
      closeConfigMatrixModal();
    }
  });

  // Escキーで閉じる
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && configMatrixModal && !configMatrixModal.classList.contains('hidden')) {
      closeConfigMatrixModal();
    }
  });

  // マトリクスモーダル内のモード切替タブ (パラメーター設定と完全連動)
  const matrixTabs = document.querySelectorAll('#matrixModeTabs .mode-pill-btn');
  matrixTabs.forEach(btn => {
    btn.addEventListener('click', () => {
      try { sound.init(); sound.playTap(); } catch (e) { }
      setActiveGameMode(btn.dataset.mode);
    });
  });

  // マトリクスモーダル 一括設定ツールバー折りたたみトグル
  const matrixBulkToggleHeader = document.getElementById('matrixBulkToggleHeader');
  const matrixBulkToolbar = document.getElementById('matrixBulkToolbar');
  const matrixBulkToggleArrow = document.getElementById('matrixBulkToggleArrow');

  matrixBulkToggleHeader?.addEventListener('click', () => {
    if (!matrixBulkToolbar) return;
    const isCollapsed = matrixBulkToolbar.classList.toggle('collapsed');
    if (matrixBulkToggleArrow) {
      matrixBulkToggleArrow.innerText = isCollapsed ? '▼ 展開する' : '▲ 折りたたむ';
    }
    try { sound.init(); sound.playTap(); } catch (e) { }
  });

  // ── マトリクスモーダル スプリッター＆下端ドラッグリサイズ (黄色枠境界線 ＆ 下端境界線) ──
  const matrixToolbarResizer = document.getElementById('matrixToolbarResizer');
  const matrixModalBottomResizer = document.getElementById('matrixModalBottomResizer');
  const matrixModalWindow = document.querySelector('.matrix-modal-window');

  // 保存済みのツールバー高さを復元
  const savedToolbarH = localStorage.getItem('hirame_matrix_toolbar_h');
  if (savedToolbarH && matrixBulkToolbar) {
    matrixBulkToolbar.style.maxHeight = `${savedToolbarH}px`;
  }

  // 1. 黄色枠スプリッター (ツールバー ↕ テーブル境界線)
  if (matrixToolbarResizer && matrixBulkToolbar) {
    let isResizingToolbar = false;
    let startY = 0;
    let startH = 0;

    matrixToolbarResizer.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      isResizingToolbar = true;
      startY = e.clientY;
      startH = matrixBulkToolbar.offsetHeight;
      matrixToolbarResizer.setPointerCapture(e.pointerId);
      matrixToolbarResizer.classList.add('dragging');
      document.body.style.cursor = 'row-resize';
      // もし折りたたまれていたら解除
      if (matrixBulkToolbar.classList.contains('collapsed')) {
        matrixBulkToolbar.classList.remove('collapsed');
        if (matrixBulkToggleArrow) matrixBulkToggleArrow.innerText = '▲ 折りたたむ';
      }
    });

    matrixToolbarResizer.addEventListener('pointermove', (e) => {
      if (!isResizingToolbar || !matrixToolbarResizer.hasPointerCapture(e.pointerId)) return;
      const deltaY = e.clientY - startY;
      const nextH = Math.max(40, Math.min(600, startH + deltaY));
      matrixBulkToolbar.style.maxHeight = `${nextH}px`;
    });

    const endToolbarResize = () => {
      if (isResizingToolbar) {
        isResizingToolbar = false;
        matrixToolbarResizer.classList.remove('dragging');
        document.body.style.cursor = '';
        if (matrixBulkToolbar) {
          localStorage.setItem('hirame_matrix_toolbar_h', matrixBulkToolbar.offsetHeight.toString());
        }
      }
    };
    matrixToolbarResizer.addEventListener('pointerup', endToolbarResize);
    matrixToolbarResizer.addEventListener('pointercancel', endToolbarResize);

    // ダブルクリックでリセット
    matrixToolbarResizer.addEventListener('dblclick', () => {
      matrixBulkToolbar.style.maxHeight = '240px';
      localStorage.removeItem('hirame_matrix_toolbar_h');
    });
  }

  // 2. モーダル下端リサイザー (モーダル全体の高さ変更)
  if (matrixModalBottomResizer && matrixModalWindow) {
    let isResizingModal = false;
    let startY = 0;
    let startH = 0;

    matrixModalBottomResizer.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      isResizingModal = true;
      startY = e.clientY;
      startH = matrixModalWindow.offsetHeight;
      matrixModalBottomResizer.setPointerCapture(e.pointerId);
      matrixModalBottomResizer.classList.add('dragging');
      document.body.style.cursor = 'ns-resize';
    });

    matrixModalBottomResizer.addEventListener('pointermove', (e) => {
      if (!isResizingModal || !matrixModalBottomResizer.hasPointerCapture(e.pointerId)) return;
      const deltaY = e.clientY - startY;
      const maxH = window.innerHeight - 10;
      const nextH = Math.max(350, Math.min(maxH, startH + deltaY));
      matrixModalWindow.style.height = `${nextH}px`;
      matrixModalWindow.style.maxHeight = `${nextH}px`;
    });

    const endModalResize = () => {
      if (isResizingModal) {
        isResizingModal = false;
        matrixModalBottomResizer.classList.remove('dragging');
        document.body.style.cursor = '';
      }
    };
    matrixModalBottomResizer.addEventListener('pointerup', endModalResize);
    matrixModalBottomResizer.addEventListener('pointercancel', endModalResize);

    // ダブルクリックで全画面高にリセット
    matrixModalBottomResizer.addEventListener('dblclick', () => {
      matrixModalWindow.style.height = 'calc(100vh - 20px)';
      matrixModalWindow.style.maxHeight = 'calc(100vh - 20px)';
    });
  }

  // ===== 🌐 一括設定 (サイズ・遊泳速度・衝突反発) メイン画面 & マトリクス双方向完全連動 =====
  // 1. 一括サイズ変更 (0〜1000%・個別設定と比率連動)
  const matrixBulkScaleSlider = document.getElementById('matrixBulkScaleSlider');
  const matrixBulkScaleInput = document.getElementById('matrixBulkScaleInput');
  const btnResetBulkScale = document.getElementById('btnResetBulkScale');

  const commonBulkScaleSlider = document.getElementById('commonBulkScaleSlider');
  const commonBulkScaleInput = document.getElementById('commonBulkScaleInput');
  const commonBulkScaleDisplay = document.getElementById('commonBulkScaleDisplay');
  const btnCommonResetBulkScale = document.getElementById('btnCommonResetBulkScale');

  let currentBulkScalePercent = 100;

  function applyBulkScale(percent, syncControls = true) {
    const pct = Math.max(0, Math.min(1000, parseFloat(percent) || 0));
    currentBulkScalePercent = pct;
    if (syncControls) {
      if (matrixBulkScaleSlider) matrixBulkScaleSlider.value = pct;
      if (matrixBulkScaleInput) matrixBulkScaleInput.value = pct;
      if (commonBulkScaleSlider) commonBulkScaleSlider.value = pct;
      if (commonBulkScaleInput) commonBulkScaleInput.value = pct;
    }
    if (commonBulkScaleDisplay) commonBulkScaleDisplay.innerText = `${pct} %`;

    const allChars = getAllAvailableCharacters();
    const ratio = pct / 100;
    const mode = matrixCurrentMode || currentConfig.activeConfigMode || 'karei';
    const charsDict = currentConfig.modeConfigs?.[mode]?.characters;
    if (charsDict) {
      for (const c of allChars) {
        if (isCharLocked(c.id)) continue;
        const cfg = charsDict[c.id];
        if (!cfg) continue;
        if (cfg._baseSizeScale === undefined) {
          cfg._baseSizeScale = cfg.sizeScale || 1.0;
        }
        cfg.sizeScale = Math.round(cfg._baseSizeScale * ratio * 100) / 100;
      }
    }

    // テーブル内の input[data-field="sizeScale"] を直接更新
    const sizeInputs = configMatrixTable?.querySelectorAll('input[data-field="sizeScale"]');
    sizeInputs?.forEach(inp => {
      const charId = inp.dataset.charId;
      if (charsDict && charsDict[charId]) {
        inp.value = (charsDict[charId].sizeScale || 1.0).toFixed(2);
      }
    });

    // テスト水槽内の魚サイズも即時反映
    if (mode === (currentConfig.activeConfigMode || 'karei')) {
      for (const f of simFishes) {
        const cfg = charsDict?.[f.type];
        if (cfg) {
          f.sizeScale = cfg.sizeScale;
          f.width = f.baseWidth * f.sizeScale;
          f.height = f.baseHeight * f.sizeScale;
        }
      }
    }

    saveCurrentConfigToStorage();
    if (activeCharId && mode === (currentConfig.activeConfigMode || 'karei')) {
      syncUIForActiveChar();
    }
  }

  // マトリクス側サイズイベント
  matrixBulkScaleSlider?.addEventListener('input', () => {
    applyBulkScale(matrixBulkScaleSlider.value, false);
    if (matrixBulkScaleInput) matrixBulkScaleInput.value = matrixBulkScaleSlider.value;
    if (commonBulkScaleSlider) commonBulkScaleSlider.value = matrixBulkScaleSlider.value;
    if (commonBulkScaleInput) commonBulkScaleInput.value = matrixBulkScaleSlider.value;
  });
  matrixBulkScaleInput?.addEventListener('input', () => {
    applyBulkScale(matrixBulkScaleInput.value, false);
    if (matrixBulkScaleSlider) matrixBulkScaleSlider.value = matrixBulkScaleInput.value;
    if (commonBulkScaleSlider) commonBulkScaleSlider.value = matrixBulkScaleInput.value;
    if (commonBulkScaleInput) commonBulkScaleInput.value = matrixBulkScaleInput.value;
  });
  btnResetBulkScale?.addEventListener('click', () => {
    applyBulkScale(100, true);
    try { sound.init(); sound.playTap(); } catch (e) { }
  });

  // メイン画面側サイズイベント
  commonBulkScaleSlider?.addEventListener('input', () => {
    applyBulkScale(commonBulkScaleSlider.value, false);
    if (commonBulkScaleInput) commonBulkScaleInput.value = commonBulkScaleSlider.value;
    if (matrixBulkScaleSlider) matrixBulkScaleSlider.value = commonBulkScaleSlider.value;
    if (matrixBulkScaleInput) matrixBulkScaleInput.value = commonBulkScaleSlider.value;
  });
  commonBulkScaleInput?.addEventListener('input', () => {
    applyBulkScale(commonBulkScaleInput.value, false);
    if (commonBulkScaleSlider) commonBulkScaleSlider.value = commonBulkScaleInput.value;
    if (matrixBulkScaleSlider) matrixBulkScaleSlider.value = commonBulkScaleInput.value;
    if (matrixBulkScaleInput) matrixBulkScaleInput.value = commonBulkScaleInput.value;
  });
  btnCommonResetBulkScale?.addEventListener('click', () => {
    applyBulkScale(100, true);
    try { sound.init(); sound.playTap(); } catch (e) { }
  });

  // 2. 一括遊泳速度変更 (0.2〜3.0x)
  const matrixBulkSpeedSlider = document.getElementById('matrixBulkSpeedSlider');
  const matrixBulkSpeedInput = document.getElementById('matrixBulkSpeedInput');
  const btnResetBulkSpeed = document.getElementById('btnResetBulkSpeed');

  const commonBulkSpeedSlider = document.getElementById('commonBulkSpeedSlider');
  const commonBulkSpeedInput = document.getElementById('commonBulkSpeedInput');
  const commonBulkSpeedDisplay = document.getElementById('commonBulkSpeedDisplay');
  const btnCommonResetBulkSpeed = document.getElementById('btnCommonResetBulkSpeed');

  function applyBulkSpeed(speedVal, syncControls = true) {
    const spd = Math.max(0.1, Math.min(5.0, parseFloat(speedVal) || 1.0));
    if (syncControls) {
      if (matrixBulkSpeedSlider) matrixBulkSpeedSlider.value = spd;
      if (matrixBulkSpeedInput) matrixBulkSpeedInput.value = spd;
      if (commonBulkSpeedSlider) commonBulkSpeedSlider.value = spd;
      if (commonBulkSpeedInput) commonBulkSpeedInput.value = spd;
    }
    if (commonBulkSpeedDisplay) commonBulkSpeedDisplay.innerText = `${spd.toFixed(1)} x`;

    const allChars = getAllAvailableCharacters();
    const mode = matrixCurrentMode || currentConfig.activeConfigMode || 'karei';
    const charsDict = currentConfig.modeConfigs?.[mode]?.characters;
    if (charsDict) {
      for (const c of allChars) {
        if (isCharLocked(c.id)) continue;
        const cfg = charsDict[c.id];
        if (!cfg) continue;
        cfg.speedMultiplier = spd;
      }
    }

    // テーブル内の input[data-field="speedMultiplier"] を更新
    const speedInputs = configMatrixTable?.querySelectorAll('input[data-field="speedMultiplier"]');
    speedInputs?.forEach(inp => {
      const charId = inp.dataset.charId;
      if (charsDict && charsDict[charId]) {
        inp.value = (charsDict[charId].speedMultiplier ?? 1.0).toFixed(1);
      }
    });

    // テスト水槽内の魚速度も即時反映
    if (mode === (currentConfig.activeConfigMode || 'karei')) {
      for (const f of simFishes) {
        const cfg = charsDict?.[f.type];
        if (cfg) {
          f.speedMultiplier = cfg.speedMultiplier;
        }
      }
    }

    saveCurrentConfigToStorage();
    if (activeCharId && mode === (currentConfig.activeConfigMode || 'karei')) {
      syncUIForActiveChar();
    }
  }

  // マトリクス側速度イベント
  matrixBulkSpeedSlider?.addEventListener('input', () => {
    applyBulkSpeed(matrixBulkSpeedSlider.value, false);
    if (matrixBulkSpeedInput) matrixBulkSpeedInput.value = matrixBulkSpeedSlider.value;
    if (commonBulkSpeedSlider) commonBulkSpeedSlider.value = matrixBulkSpeedSlider.value;
    if (commonBulkSpeedInput) commonBulkSpeedInput.value = matrixBulkSpeedSlider.value;
  });
  matrixBulkSpeedInput?.addEventListener('input', () => {
    applyBulkSpeed(matrixBulkSpeedInput.value, false);
    if (matrixBulkSpeedSlider) matrixBulkSpeedSlider.value = matrixBulkSpeedInput.value;
    if (commonBulkSpeedSlider) commonBulkSpeedSlider.value = matrixBulkSpeedInput.value;
    if (commonBulkSpeedInput) commonBulkSpeedInput.value = matrixBulkSpeedInput.value;
  });
  btnResetBulkSpeed?.addEventListener('click', () => {
    applyBulkSpeed(1.0, true);
    try { sound.init(); sound.playTap(); } catch (e) { }
  });

  // メイン画面側速度イベント
  commonBulkSpeedSlider?.addEventListener('input', () => {
    applyBulkSpeed(commonBulkSpeedSlider.value, false);
    if (commonBulkSpeedInput) commonBulkSpeedInput.value = commonBulkSpeedSlider.value;
    if (matrixBulkSpeedSlider) matrixBulkSpeedSlider.value = commonBulkSpeedSlider.value;
    if (matrixBulkSpeedInput) matrixBulkSpeedInput.value = commonBulkSpeedSlider.value;
  });
  commonBulkSpeedInput?.addEventListener('input', () => {
    applyBulkSpeed(commonBulkSpeedInput.value, false);
    if (commonBulkSpeedSlider) commonBulkSpeedSlider.value = commonBulkSpeedInput.value;
    if (matrixBulkSpeedSlider) matrixBulkSpeedSlider.value = commonBulkSpeedInput.value;
    if (matrixBulkSpeedInput) matrixBulkSpeedInput.value = commonBulkSpeedInput.value;
  });
  btnCommonResetBulkSpeed?.addEventListener('click', () => {
    applyBulkSpeed(1.0, true);
    try { sound.init(); sound.playTap(); } catch (e) { }
  });

  // 3. 一括衝突反発変更 (0.0〜1.5)
  const matrixBulkRepulsionSlider = document.getElementById('matrixBulkRepulsionSlider');
  const matrixBulkRepulsionInput = document.getElementById('matrixBulkRepulsionInput');
  const btnResetBulkRepulsion = document.getElementById('btnResetBulkRepulsion');

  const commonBulkRepulsionSlider = document.getElementById('commonBulkRepulsionSlider');
  const commonBulkRepulsionInput = document.getElementById('commonBulkRepulsionInput');
  const commonBulkRepulsionDisplay = document.getElementById('commonBulkRepulsionDisplay');
  const btnCommonResetBulkRepulsion = document.getElementById('btnCommonResetBulkRepulsion');

  function applyBulkRepulsion(repVal, syncControls = true) {
    const rep = Math.max(0, Math.min(2.0, parseFloat(repVal) || 0));
    if (syncControls) {
      if (matrixBulkRepulsionSlider) matrixBulkRepulsionSlider.value = rep;
      if (matrixBulkRepulsionInput) matrixBulkRepulsionInput.value = rep;
      if (commonBulkRepulsionSlider) commonBulkRepulsionSlider.value = rep;
      if (commonBulkRepulsionInput) commonBulkRepulsionInput.value = rep;
    }
    if (commonBulkRepulsionDisplay) {
      commonBulkRepulsionDisplay.innerText = rep === 0 ? '0 (OFF)' : `${rep.toFixed(1)}`;
    }

    const allChars = getAllAvailableCharacters();
    const mode = matrixCurrentMode || currentConfig.activeConfigMode || 'karei';
    const charsDict = currentConfig.modeConfigs?.[mode]?.characters;
    if (charsDict) {
      for (const c of allChars) {
        if (isCharLocked(c.id)) continue;
        const cfg = charsDict[c.id];
        if (!cfg) continue;
        cfg.collisionRepulsion = rep;
      }
    }

    // テーブル内の input[data-field="collisionRepulsion"] を更新
    const repInputs = configMatrixTable?.querySelectorAll('input[data-field="collisionRepulsion"]');
    repInputs?.forEach(inp => {
      const charId = inp.dataset.charId;
      if (charsDict && charsDict[charId]) {
        inp.value = (charsDict[charId].collisionRepulsion ?? 0).toFixed(1);
      }
    });

    // テスト水槽内の魚反発も即時反映
    if (mode === (currentConfig.activeConfigMode || 'karei')) {
      for (const f of simFishes) {
        const cfg = charsDict?.[f.type];
        if (cfg) {
          f.collisionRepulsion = cfg.collisionRepulsion;
        }
      }
    }

    saveCurrentConfigToStorage();
    if (activeCharId && mode === (currentConfig.activeConfigMode || 'karei')) {
      syncUIForActiveChar();
    }
  }

  // マトリクス側反発イベント
  matrixBulkRepulsionSlider?.addEventListener('input', () => {
    applyBulkRepulsion(matrixBulkRepulsionSlider.value, false);
    if (matrixBulkRepulsionInput) matrixBulkRepulsionInput.value = matrixBulkRepulsionSlider.value;
    if (commonBulkRepulsionSlider) commonBulkRepulsionSlider.value = matrixBulkRepulsionSlider.value;
    if (commonBulkRepulsionInput) commonBulkRepulsionInput.value = matrixBulkRepulsionSlider.value;
  });
  matrixBulkRepulsionInput?.addEventListener('input', () => {
    applyBulkRepulsion(matrixBulkRepulsionInput.value, false);
    if (matrixBulkRepulsionSlider) matrixBulkRepulsionSlider.value = matrixBulkRepulsionInput.value;
    if (commonBulkRepulsionSlider) commonBulkRepulsionSlider.value = matrixBulkRepulsionInput.value;
    if (commonBulkRepulsionInput) commonBulkRepulsionInput.value = matrixBulkRepulsionInput.value;
  });
  btnResetBulkRepulsion?.addEventListener('click', () => {
    applyBulkRepulsion(0, true);
    try { sound.init(); sound.playTap(); } catch (e) { }
  });

  // メイン画面側反発イベント
  commonBulkRepulsionSlider?.addEventListener('input', () => {
    applyBulkRepulsion(commonBulkRepulsionSlider.value, false);
    if (commonBulkRepulsionInput) commonBulkRepulsionInput.value = commonBulkRepulsionSlider.value;
    if (matrixBulkRepulsionSlider) matrixBulkRepulsionSlider.value = commonBulkRepulsionSlider.value;
    if (matrixBulkRepulsionInput) matrixBulkRepulsionInput.value = commonBulkRepulsionSlider.value;
  });
  commonBulkRepulsionInput?.addEventListener('input', () => {
    applyBulkRepulsion(commonBulkRepulsionInput.value, false);
    if (commonBulkRepulsionSlider) commonBulkRepulsionSlider.value = commonBulkRepulsionInput.value;
    if (matrixBulkRepulsionSlider) matrixBulkRepulsionSlider.value = commonBulkRepulsionInput.value;
    if (matrixBulkRepulsionInput) matrixBulkRepulsionInput.value = commonBulkRepulsionInput.value;
  });
  btnCommonResetBulkRepulsion?.addEventListener('click', () => {
    applyBulkRepulsion(0, true);
    try { sound.init(); sound.playTap(); } catch (e) { }
  });

  // ===== JSON書き出し・読み込み =====
  btnMatrixExportJson?.addEventListener('click', () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentConfig, null, 2));
      const downloadAnchor = document.createElement('a');
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const timeStr = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `hirame_game_config_${dateStr}_${timeStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      try { sound.init(); sound.playSuccess(1); } catch (e) { }
    } catch (err) {
      alert(`JSON書き出しに失敗しました: ${err.message}`);
    }
  });

  btnMatrixImportJson?.addEventListener('click', () => {
    matrixJsonFileInput?.click();
  });

  matrixJsonFileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (!parsed || typeof parsed !== 'object') {
        throw new Error('JSONの形式が正しくありません。');
      }

      const confirmed = await showAdminConfirm({
        title: 'JSON設定ファイルの読み込み確認',
        message: `選択したファイル（${file.name}）からゲーム設定を復元・適用しますか？\n\n※現在の全モード設定（カレイ派・ヒラメ派・ヒライ派）、称号、カスタム魚などが上書きされます。`,
        icon: '📤',
        confirmText: 'はい (読み込んで適用)',
        cancelText: 'いいえ (キャンセル)'
      });

      if (!confirmed) {
        matrixJsonFileInput.value = '';
        return;
      }

      currentConfig = {
        ...DEFAULT_CONFIG,
        ...parsed,
        modeConfigs: parsed.modeConfigs || currentConfig.modeConfigs,
        playerTitles: parsed.playerTitles || currentConfig.playerTitles,
        xShareTemplate: parsed.xShareTemplate || currentConfig.xShareTemplate,
        characters: parsed.characters || currentConfig.characters,
        lockedCharacters: parsed.lockedCharacters || currentConfig.lockedCharacters || {}
      };

      saveCurrentConfigToStorage();
      renderConfigMatrixTable(matrixCurrentMode);
      syncUIForActiveChar();
      syncSimCanvasCount();
      renderTitleTiers();
      try { sound.init(); sound.playSuccess(2); } catch (err) { }
      alert('設定ファイルを正常に読み込み、全モードに適用しました！');
    } catch (err) {
      alert(`設定ファイルの読み込みに失敗しました:\n${err.message}`);
    } finally {
      matrixJsonFileInput.value = '';
    }
  });

  // 「🌐 このモードの全キャラを全モードに複製」ボタン
  btnMatrixApplyCurrentModeToAll?.addEventListener('click', async () => {
    const modeNames = { karei: 'カレイ派', hirame: 'ヒラメ派', hirai: 'ヒライ派' };
    const srcChars = currentConfig.modeConfigs?.[matrixCurrentMode]?.characters;
    if (!srcChars) return;

    const ok = await showAdminConfirm({
      title: '全モード複製の確認',
      message: `現在表示中の【${modeNames[matrixCurrentMode] || matrixCurrentMode}】の全キャラ設定を、他の２つのモードに複製しますか？\n\n※「🔒 ロック中」のキャラクターは上書きされず保護されます。`,
      icon: '🌐',
      confirmText: 'はい (全モードに複製)',
      cancelText: 'いいえ (キャンセル)'
    });
    if (!ok) return;

    for (const m of ['karei', 'hirame', 'hirai']) {
      if (m === matrixCurrentMode) continue;
      if (!currentConfig.modeConfigs[m]) currentConfig.modeConfigs[m] = createDefaultModeConfig(m);
      if (!currentConfig.modeConfigs[m].characters) currentConfig.modeConfigs[m].characters = createDefaultModeConfig(m).characters;
      const destChars = currentConfig.modeConfigs[m].characters;

      for (const [charId, charCfg] of Object.entries(srcChars)) {
        if (isCharLocked(charId)) continue; // ロック中キャラは保護
        destChars[charId] = JSON.parse(JSON.stringify(charCfg));
      }
    }

    saveCurrentConfigToStorage();
    renderConfigMatrixTable(matrixCurrentMode);
    syncUIForActiveChar();
    syncSimCanvasCount();
    try { sound.init(); sound.playSuccess(1); } catch (e) { }

    const origText = btnMatrixApplyCurrentModeToAll.innerText;
    btnMatrixApplyCurrentModeToAll.innerText = '✅ 全モードに複製完了！';
    setTimeout(() => {
      btnMatrixApplyCurrentModeToAll.innerText = origText;
    }, 1800);
  });

  // マトリクステーブル生成関数 (縦列＝設定項目、横列＝キャラクター)
  function renderConfigMatrixTable(mode = matrixCurrentMode) {
    if (!configMatrixTable) return;
    if (!currentConfig.modeConfigs) currentConfig.modeConfigs = {};
    if (!currentConfig.modeConfigs[mode]) currentConfig.modeConfigs[mode] = createDefaultModeConfig(mode);
    if (!currentConfig.modeConfigs[mode].characters) {
      currentConfig.modeConfigs[mode].characters = createDefaultModeConfig(mode).characters;
    }
    if (!currentConfig.lockedCharacters) currentConfig.lockedCharacters = {};

    const charsDict = currentConfig.modeConfigs[mode].characters;
    const allChars = getAllAvailableCharacters();

    // 未初期化キャラのデフォルト補完
    for (const c of allChars) {
      if (!charsDict[c.id]) {
        const isDefaultTarget = (c.id === 'boo_chan' || c.id === 'karei' || c.id === 'hirame' || c.id.startsWith('kanji_'));
        charsDict[c.id] = {
          name: c.name,
          role: isDefaultTarget ? 'target' : 'disturber',
          pointValue: isDefaultTarget ? 10 : -5,
          count: 20,
          minTargetThreshold: 2,
          speedMultiplier: 1.0,
          lifetimeSec: 6.0,
          randomTurnRate: 0.02,
          sizeScale: 1.0,
          beginnerAlert: true,
          weight: 20,
          scoreThreshold: 150,
          spawnCondition: {
            enabled: false,
            timeSec: 0,
            origin: 'silhouette',
            triggerAction: 'tap_target',
            targetCharacters: [],
            tapCount: 10,
            isCombo: false,
            probability: 100,
            repeatCount: 0
          }
        };
      }
    }

    let html = '';

    // 1. thead (キャラクター横列)
    html += '<thead><tr>';
    html += '<th class="matrix-th-param-header">⚙️ 設定項目</th>';
    for (const c of allChars) {
      const cfg = charsDict[c.id];
      const curBuckets = currentConfig.buckets || DEFAULT_BUCKETS;
      const isDisturber = cfg.role === 'disturber';
      const bObj = curBuckets.find(b => b.id === cfg.role);
      const badgeBg = !isDisturber ? 'rgba(56,189,248,0.2)' : 'rgba(239,68,68,0.2)';
      const badgeColor = !isDisturber ? '#38bdf8' : '#ef4444';
      const badgeText = !isDisturber ? (bObj ? bObj.name : 'バケツ') : '邪魔キャラ';
      const isLocked = isCharLocked(c.id);

      html += `
        <th class="matrix-th-char ${isLocked ? 'is-locked' : ''}" data-char-id="${c.id}" title="クリックでこのキャラを選択">
          <div class="matrix-th-char-name">
            <span>${c.name}</span>
            <span class="matrix-th-char-badge" id="matrixBadge_${c.id}" style="background:${badgeBg}; color:${badgeColor};">${badgeText}</span>
          </div>
          <div class="matrix-char-ctrl-bar">
            <button type="button" class="btn-char-micro btn-char-lock ${isLocked ? 'active' : ''}" data-char-id="${c.id}" data-action="toggle-lock" title="${isLocked ? '🔒 ロック中（クリックで解除）' : '🔓 ロックOFF（クリックで保護）'}">
              ${isLocked ? '🔒 ロック中' : '🔓 ロック'}
            </button>
            <button type="button" class="btn-char-micro btn-char-all-modes" data-char-id="${c.id}" data-action="char-all-modes" title="このキャラの設定を全3モードに共通反映" ${isLocked ? 'disabled' : ''}>
              🌐 共通
            </button>
            <button type="button" class="btn-char-micro btn-char-default" data-char-id="${c.id}" data-action="char-default" title="このキャラの設定をデフォルトに戻す" ${isLocked ? 'disabled' : ''}>
              🔄 戻す
            </button>
          </div>
        </th>
      `;
    }
    html += '</tr></thead>';

    // 2. tbody (各設定項目を縦列に並べる)
    html += '<tbody>';

    // --- 0. 全モード共通設定 (ゲーム制限時間 & １画面キャラ表示数 & フィーバー時表示数) ---
    const curTimeLimit = Number(currentConfig.modeConfigs?.[mode]?.timeLimitSec ?? currentConfig.timeLimitSec ?? 60);
    const curMaxFish = Number(currentConfig.modeConfigs?.[mode]?.maxScreenFishes ?? currentConfig.maxScreenFishes ?? 20);
    const feverCfg = getChaosFeverConfig();
    const curFeverMax = Number(currentConfig.modeConfigs?.[mode]?.chaosFeverConfig?.maxScreenFishes ?? feverCfg?.maxScreenFishes ?? 70);

    html += `
      <tr class="matrix-category-row" style="background:rgba(2,132,199,0.25);">
        <td class="matrix-category-header-wrap" style="color:#38bdf8;">
          <span>【🌐 全モード共通設定】</span>
          <span class="matrix-param-desc" style="color:#bae6fd;">制限時間＆キャラ表示数</span>
        </td>
        <td colspan="${allChars.length}" style="padding:8px 12px; background:rgba(15,23,42,0.6); text-align:left;">
          <div style="display:flex; gap:20px; align-items:center; flex-wrap:wrap;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:16px;">⏱️</span>
              <strong style="color:#e0f2fe; font-size:13px;">ゲーム制限時間:</strong>
              <span class="val-pill val-pill-success" style="font-size:13px; font-weight:800;">${curTimeLimit} 秒</span>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:16px;">👥</span>
              <strong style="color:#e0f2fe; font-size:13px;">１画面キャラ表示数:</strong>
              <span class="val-pill val-pill-success" style="font-size:13px; font-weight:800;">${curMaxFish} 匹</span>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:16px;">🔥</span>
              <strong style="color:#e0f2fe; font-size:13px;">フィーバー時表示数:</strong>
              <span class="val-pill val-pill-success" style="font-size:13px; font-weight:800; background:rgba(250,204,21,0.2); color:#facc15; border-color:rgba(250,204,21,0.4);">${curFeverMax} 匹</span>
            </div>
            <span style="font-size:11px; color:#94a3b8;">※上のツールバーまたはメイン共通設定で変更・連動できます</span>
          </div>
        </td>
      </tr>
      <tr>
        <td class="matrix-param-cell-label">⏱️ ゲーム制限時間<span class="matrix-param-desc">1プレイの秒数 (5〜600秒)</span></td>
        ${allChars.map(() => `
          <td style="text-align:center; color:#38bdf8; font-weight:700; font-size:12px; background:rgba(56,189,248,0.06);">
            ${curTimeLimit} 秒
          </td>
        `).join('')}
      </tr>
      <tr>
        <td class="matrix-param-cell-label">👥 １画面キャラ表示数<span class="matrix-param-desc">同時描画総数 (0〜100匹)</span></td>
        ${allChars.map(() => `
          <td style="text-align:center; color:#34d399; font-weight:700; font-size:12px; background:rgba(16,185,129,0.06);">
            ${curMaxFish} 匹
          </td>
        `).join('')}
      </tr>
      <tr>
        <td class="matrix-param-cell-label">🔥 フィーバー時表示数<span class="matrix-param-desc">ラスト10秒総数 (0〜100匹)</span></td>
        ${allChars.map(() => `
          <td style="text-align:center; color:#facc15; font-weight:700; font-size:12px; background:rgba(250,204,21,0.06);">
            ${curFeverMax} 匹
          </td>
        `).join('')}
      </tr>
    `;

    // --- 1. 基本・共通パラメーター ---
    html += `
      <tr class="matrix-category-row">
        <td class="matrix-category-header-wrap">
          <span>【1. 基本・共通パラメーター】</span>
          <div class="matrix-cat-actions">
            <button type="button" class="btn-cat-action btn-cat-all-modes" data-action="cat-all-modes" title="基本パラメーター（役割・得点等）を全3モードに一括反映">
              🌐 全行反映
            </button>
            <button type="button" class="btn-cat-action btn-cat-lock" data-action="cat-toggle-all-lock" title="全キャラのロック/解除を一括切り替え">
              🔒 全ロック
            </button>
            <button type="button" class="btn-cat-action btn-cat-default" data-action="cat-reset-default" title="基本パラメーターを初期デフォルト値に戻します">
              🔄 全初期化
            </button>
          </div>
        </td>
    `;
    for (const c of allChars) {
      const isLocked = isCharLocked(c.id);
      html += `
        <td class="matrix-cat-char-cell ${isLocked ? 'is-locked' : ''}">
          <div class="matrix-char-ctrl-bar-stacked">
            <button type="button" class="btn-cat-action" data-char-id="${c.id}" data-action="char-all-modes" title="このキャラの設定を全モードに反映" ${isLocked ? 'disabled' : ''}>
              🌐 全モード共通
            </button>
            <button type="button" class="btn-cat-action ${isLocked ? 'active' : ''}" data-char-id="${c.id}" data-action="toggle-lock" title="このキャラをロック">
              ${isLocked ? '🔓 解除' : '🔒 ロック'}
            </button>
            <button type="button" class="btn-cat-action" data-char-id="${c.id}" data-action="char-default" title="このキャラの設定をデフォルトに戻す" ${isLocked ? 'disabled' : ''}>
              🔄 デフォルト
            </button>
          </div>
        </td>
      `;
    }
    html += '</tr>';

    // 役割
    html += '<tr>';
    html += '<td class="matrix-param-cell-label">🎭 役割 (仕分け/邪魔)<span class="matrix-param-desc">バケツまたは邪魔魚</span></td>';
    for (const c of allChars) {
      const cfg = charsDict[c.id];
      const isLocked = isCharLocked(c.id);
      const curRole = cfg.role || 'bucketA';
      const curBuckets = currentConfig.buckets || DEFAULT_BUCKETS;
      html += `
        <td class="${isLocked ? 'is-locked' : ''}">
          <select class="matrix-select matrix-select-role" data-char-id="${c.id}" ${isLocked ? 'disabled' : ''} style="width:100%; font-size:11px; padding:3px; border-radius:4px; background:rgba(15,23,42,0.8); color:#f8fafc; border:1px solid rgba(56,189,248,0.3);">
            ${curBuckets.map(b => {
        const bTag = b.id === 'bucketA' ? 'バケツA' : b.id === 'bucketB' ? 'バケツB' : b.name;
        return `<option value="${b.id}" ${curRole === b.id ? 'selected' : ''}>${b.icon || '🪣'} ${b.name} (${bTag})</option>`;
      }).join('')}
            <option value="disturber" ${curRole === 'disturber' ? 'selected' : ''}>⚠️ 邪魔キャラ</option>
          </select>
        </td>
      `;
    }
    html += '</tr>';

    // ポイント設定
    html += '<tr>';
    html += '<td class="matrix-param-cell-label">💰 タップ得点 (pt)<span class="matrix-param-desc">-9999 〜 +9999</span></td>';
    for (const c of allChars) {
      const cfg = charsDict[c.id];
      const isTarget = cfg.role !== 'disturber';
      const pVal = cfg.pointValue !== undefined ? cfg.pointValue : (isTarget ? 10 : -5);
      const isLocked = isCharLocked(c.id);
      html += `
        <td class="${isLocked ? 'is-locked' : ''}">
          <input type="number" class="matrix-input-number matrix-field" data-char-id="${c.id}" data-field="pointValue" min="-9999" max="9999" step="1" value="${pVal}" ${isLocked ? 'disabled' : ''}>
        </td>
      `;
    }
    html += '</tr>';

    // サイズ倍率
    html += '<tr>';
    html += '<td class="matrix-param-cell-label">📏 サイズ倍率<span class="matrix-param-desc">0.05x 〜 25.0x (一括拡縮連動)</span></td>';
    for (const c of allChars) {
      const cfg = charsDict[c.id];
      const isLocked = isCharLocked(c.id);
      html += `
        <td class="${isLocked ? 'is-locked' : ''}">
          <input type="number" class="matrix-input-number matrix-field" data-char-id="${c.id}" data-field="sizeScale" min="0.05" max="25.0" step="0.05" value="${(cfg.sizeScale || 1.0).toFixed(2)}" ${isLocked ? 'disabled' : ''}>
        </td>
      `;
    }
    html += '</tr>';

    // 目標表示数
    html += '<tr>';
    html += '<td class="matrix-param-cell-label">🐟 目標表示数 (匹)<span class="matrix-param-desc">1 〜 100匹</span></td>';
    for (const c of allChars) {
      const cfg = charsDict[c.id];
      const isLocked = isCharLocked(c.id);
      html += `
        <td class="${isLocked ? 'is-locked' : ''}">
          <input type="number" class="matrix-input-number matrix-field" data-char-id="${c.id}" data-field="count" min="1" max="100" step="1" value="${cfg.count ?? 20}" ${isLocked ? 'disabled' : ''}>
        </td>
      `;
    }
    html += '</tr>';

    // 下限補充閾値
    html += '<tr>';
    html += '<td class="matrix-param-cell-label">🛡️ 補充下限閾値 (匹)<span class="matrix-param-desc">0 〜 6匹以下で即補充</span></td>';
    for (const c of allChars) {
      const cfg = charsDict[c.id];
      const isLocked = isCharLocked(c.id);
      html += `
        <td class="${isLocked ? 'is-locked' : ''}">
          <input type="number" class="matrix-input-number matrix-field" data-char-id="${c.id}" data-field="minTargetThreshold" min="0" max="6" step="1" value="${cfg.minTargetThreshold ?? 2}" ${isLocked ? 'disabled' : ''}>
        </td>
      `;
    }
    html += '</tr>';

    // 遊泳スピード
    html += '<tr>';
    html += '<td class="matrix-param-cell-label">⚡ 遊泳速度倍率<span class="matrix-param-desc">0.3x 〜 3.0x</span></td>';
    for (const c of allChars) {
      const cfg = charsDict[c.id];
      const isLocked = isCharLocked(c.id);
      html += `
        <td class="${isLocked ? 'is-locked' : ''}">
          <input type="number" class="matrix-input-number matrix-field" data-char-id="${c.id}" data-field="speedMultiplier" min="0.3" max="3.0" step="0.1" value="${(cfg.speedMultiplier || 1.0).toFixed(1)}" ${isLocked ? 'disabled' : ''}>
        </td>
      `;
    }
    html += '</tr>';

    // 滞在時間
    html += '<tr>';
    html += '<td class="matrix-param-cell-label">⏳ 滞在時間 (秒)<span class="matrix-param-desc">3.0 〜 20.0秒</span></td>';
    for (const c of allChars) {
      const cfg = charsDict[c.id];
      const isLocked = isCharLocked(c.id);
      html += `
        <td class="${isLocked ? 'is-locked' : ''}">
          <input type="number" class="matrix-input-number matrix-field" data-char-id="${c.id}" data-field="lifetimeSec" min="3.0" max="20.0" step="0.5" value="${(cfg.lifetimeSec || 6.0).toFixed(1)}" ${isLocked ? 'disabled' : ''}>
        </td>
      `;
    }
    html += '</tr>';

    // ランダム転回率
    html += '<tr>';
    html += '<td class="matrix-param-cell-label">🔄 転回頻度 (%)<span class="matrix-param-desc">0.5% 〜 6.0%</span></td>';
    for (const c of allChars) {
      const cfg = charsDict[c.id];
      const pct = ((cfg.randomTurnRate || 0.02) * 100).toFixed(1);
      const isLocked = isCharLocked(c.id);
      html += `
        <td class="${isLocked ? 'is-locked' : ''}">
          <input type="number" class="matrix-input-number matrix-field" data-char-id="${c.id}" data-field="randomTurnRatePercent" min="0.5" max="6.0" step="0.5" value="${pct}" ${isLocked ? 'disabled' : ''}>
        </td>
      `;
    }
    html += '</tr>';

    // 衝突反発
    html += '<tr>';
    html += '<td class="matrix-param-cell-label">💥 衝突反発 (しきい値)<span class="matrix-param-desc">0: OFF(通過), 0.1〜1.5</span></td>';
    for (const c of allChars) {
      const cfg = charsDict[c.id];
      const isLocked = isCharLocked(c.id);
      const rep = (cfg.collisionRepulsion ?? 0).toFixed(1);
      html += `
        <td class="${isLocked ? 'is-locked' : ''}">
          <input type="number" class="matrix-input-number matrix-field" data-char-id="${c.id}" data-field="collisionRepulsion" min="0" max="1.5" step="0.1" value="${rep}" ${isLocked ? 'disabled' : ''}>
        </td>
      `;
    }
    html += '</tr>';

    // --- 2. ターゲット専用設定 ---
    html += `<tr class="matrix-category-row"><td colspan="${allChars.length + 1}">【2. ターゲット専用設定】</td></tr>`;

    // 逃走2秒前点滅警告
    html += '<tr>';
    html += '<td class="matrix-param-cell-label">💡 逃走2秒前 点滅警告<span class="matrix-param-desc">初心者補助 (ON/OFF)</span></td>';
    for (const c of allChars) {
      const cfg = charsDict[c.id];
      const isChecked = cfg.beginnerAlert ?? true;
      const isLocked = isCharLocked(c.id);
      html += `
        <td class="${isLocked ? 'is-locked' : ''}">
          <label class="matrix-switch">
            <input type="checkbox" class="matrix-checkbox-field" data-char-id="${c.id}" data-field="beginnerAlert" ${isChecked ? 'checked' : ''} ${isLocked ? 'disabled' : ''}>
            <span class="matrix-switch-slider"></span>
          </label>
        </td>
      `;
    }
    html += '</tr>';

    // --- 3. 抽選重み ＆ 出現スコア閾値 (全キャラ共通) ---
    html += `<tr class="matrix-category-row"><td colspan="${allChars.length + 1}">【3. 抽選重み ＆ 出現スコア閾値 (全キャラ共通)】</td></tr>`;

    // 出現重み
    html += '<tr>';
    html += '<td class="matrix-param-cell-label">⚖️ 出現重み (抽選割合)<span class="matrix-param-desc">1 〜 100 (出現時の抽選比率)</span></td>';
    for (const c of allChars) {
      const cfg = charsDict[c.id];
      const isLocked = isCharLocked(c.id);
      html += `
        <td class="${isLocked ? 'is-locked' : ''}">
          <input type="number" class="matrix-input-number matrix-field" data-char-id="${c.id}" data-field="weight" min="1" max="100" step="1" value="${cfg.weight ?? 20}" ${isLocked ? 'disabled' : ''}>
        </td>
      `;
    }
    html += '</tr>';

    // 出現スコア閾値
    html += '<tr>';
    html += '<td class="matrix-param-cell-label">🎯 出現スコア閾値 (pt)<span class="matrix-param-desc">全キャラ共通: このスコア以上で出現 (0=最初から出現)</span></td>';
    for (const c of allChars) {
      const cfg = charsDict[c.id];
      const isLocked = isCharLocked(c.id);
      const isSpawnCondEnabled = !!cfg.spawnCondition?.enabled;
      html += `
        <td class="${isLocked ? 'is-locked' : ''} ${isSpawnCondEnabled ? 'spawn-cond-prioritized' : ''}">
          <input type="number" class="matrix-input-number matrix-field" data-char-id="${c.id}" data-field="scoreThreshold" min="0" max="2000" step="10" value="${cfg.scoreThreshold ?? 150}" ${isLocked ? 'disabled' : ''} style="${isSpawnCondEnabled ? 'opacity:0.65; border-color:#f59e0b;' : ''}" title="${isSpawnCondEnabled ? '※出現条件ONのため出現条件判定と連動します' : 'スコア到達後に海中に出現します'}">
          ${isSpawnCondEnabled ? '<div style="font-size:10px; color:#f59e0b; margin-top:2px; font-weight:700;">⚡ 出現条件連動</div>' : ''}
        </td>
      `;
    }
    html += '</tr>';

    // --- 4. 出現条件 (スポーン条件) ---
    html += `<tr class="matrix-category-row"><td colspan="${allChars.length + 1}">【4. 出現条件 (スポーン条件)】</td></tr>`;

    // 条件1: 残り時間
    html += '<tr>';
    html += '<td class="matrix-param-cell-label">⏱️ 条件1: 残り時間<span class="matrix-param-desc">発動する残り時間</span></td>';
    for (const c of allChars) {
      const cfg = charsDict[c.id];
      const sec = cfg.spawnCondition?.timeSec ?? 0;
      const isLocked = isCharLocked(c.id);
      html += `
        <td class="${isLocked ? 'is-locked' : ''}">
          <select class="matrix-select matrix-select-field" data-char-id="${c.id}" data-field="spawnCondition.timeSec" ${isLocked ? 'disabled' : ''}>
            <option value="0" ${sec === 0 ? 'selected' : ''}>0秒 (指定なし)</option>
            <option value="10" ${sec === 10 ? 'selected' : ''}>10秒以下</option>
            <option value="20" ${sec === 20 ? 'selected' : ''}>20秒以下</option>
            <option value="30" ${sec === 30 ? 'selected' : ''}>30秒以下</option>
            <option value="45" ${sec === 45 ? 'selected' : ''}>45秒以下</option>
            <option value="60" ${sec === 60 ? 'selected' : ''}>60秒以下</option>
            <option value="61" ${sec === 61 ? 'selected' : ''}>61 (🎲 ランダム)</option>
          </select>
        </td>
      `;
    }
    html += '</tr>';

    // 条件2: 出現場所
    html += '<tr>';
    html += '<td class="matrix-param-cell-label">🌊 条件2: 出現場所<span class="matrix-param-desc">スポーン起点</span></td>';
    for (const c of allChars) {
      const cfg = charsDict[c.id];
      const orig = cfg.spawnCondition?.origin || 'silhouette';
      const isLocked = isCharLocked(c.id);
      html += `
        <td class="${isLocked ? 'is-locked' : ''}">
          <select class="matrix-select matrix-select-field" data-char-id="${c.id}" data-field="spawnCondition.origin" ${isLocked ? 'disabled' : ''}>
            <option value="silhouette" ${orig === 'silhouette' ? 'selected' : ''}>魚影</option>
            <option value="seabed" ${orig === 'seabed' ? 'selected' : ''}>海底</option>
            <option value="left" ${orig === 'left' ? 'selected' : ''}>画面左</option>
            <option value="right" ${orig === 'right' ? 'selected' : ''}>画面右</option>
            <option value="top" ${orig === 'top' ? 'selected' : ''}>水面</option>
            <option value="random" ${orig === 'random' ? 'selected' : ''}>ランダム</option>
          </select>
        </td>
      `;
    }
    html += '</tr>';

    // 条件3: トリガー行動
    html += '<tr>';
    html += '<td class="matrix-param-cell-label">🎯 条件3: トリガー行動<span class="matrix-param-desc">出現の契機アクション</span></td>';
    for (const c of allChars) {
      const cfg = charsDict[c.id];
      const act = cfg.spawnCondition?.triggerAction || 'tap_target';
      const isLocked = isCharLocked(c.id);
      html += `
        <td class="${isLocked ? 'is-locked' : ''}">
          <select class="matrix-select matrix-select-field" data-char-id="${c.id}" data-field="spawnCondition.triggerAction" ${isLocked ? 'disabled' : ''}>
            <option value="tap_target" ${act === 'tap_target' ? 'selected' : ''}>ターゲット獲得</option>
            <option value="tap_disturber" ${act === 'tap_disturber' ? 'selected' : ''}>邪魔キャラタップ</option>
            <option value="tap_background" ${act === 'tap_background' ? 'selected' : ''}>空振りタップ</option>
            <option value="tap_specific" ${act === 'tap_specific' ? 'selected' : ''}>個別キャラ</option>
            <option value="idle" ${act === 'idle' ? 'selected' : ''}>無操作 (3秒)</option>
          </select>
        </td>
      `;
    }
    html += '</tr>';

    // 条件4: 達成タップ回数 (有効化チェックボックス + 回数数値入力)
    html += '<tr>';
    html += '<td class="matrix-param-cell-label">🔢 条件4: 達成回数 (回)<span class="matrix-param-desc">スイッチ:ON/OFF, 1〜100, 101:🎲</span></td>';
    for (const c of allChars) {
      const cfg = charsDict[c.id];
      const tCount = cfg.spawnCondition?.tapCount ?? 10;
      const isTapEnabled = cfg.spawnCondition?.tapCountEnabled !== false;
      const isLocked = isCharLocked(c.id);
      html += `
        <td class="${isLocked ? 'is-locked' : ''}">
          <div style="display:flex; align-items:center; justify-content:center; gap:6px;">
            <label class="matrix-switch" title="条件4(達成回数)の有効/無効">
              <input type="checkbox" class="matrix-checkbox-field" data-char-id="${c.id}" data-field="spawnCondition.tapCountEnabled" ${isTapEnabled ? 'checked' : ''} ${isLocked ? 'disabled' : ''}>
              <span class="matrix-switch-slider"></span>
            </label>
            <input type="number" class="matrix-input-number matrix-field" data-char-id="${c.id}" data-field="spawnCondition.tapCount" min="0" max="101" step="1" value="${tCount}" ${isLocked || !isTapEnabled ? 'disabled' : ''} style="width:55px; ${!isTapEnabled ? 'opacity:0.4;' : ''}">
          </div>
        </td>
      `;
    }
    html += '</tr>';

    // 条件4: コンボ方式
    html += '<tr>';
    html += '<td class="matrix-param-cell-label">🔥 条件4: コンボ達成方式<span class="matrix-param-desc">ON: 連続成功のみ</span></td>';
    for (const c of allChars) {
      const cfg = charsDict[c.id];
      const isCombo = !!cfg.spawnCondition?.isCombo;
      const isLocked = isCharLocked(c.id);
      html += `
        <td class="${isLocked ? 'is-locked' : ''}">
          <button type="button" class="matrix-btn-combo ${isCombo ? 'active' : ''}" data-char-id="${c.id}" data-action="toggle-combo" ${isLocked ? 'disabled' : ''}>
            ${isCombo ? '🔥 連続成功' : 'OFF 延べ'}
          </button>
        </td>
      `;
    }
    html += '</tr>';

    // 📋 3条件: 全て (ALL)
    html += '<tr style="background:rgba(234,179,8,0.06);">';
    html += '<td class="matrix-param-cell-label"><span style="color:#facc15; font-weight:800;">📋 3条件: 全て (ALL)</span><span class="matrix-param-desc">獲得Pt・T捕獲数・時間を全ON/OFF</span></td>';
    for (const c of allChars) {
      const cfg = charsDict[c.id];
      const sc = cfg.spawnCondition || {};
      const condScore = !!sc.condScoreEnabled;
      const condTaps = sc.condTargetTapsEnabled !== false && sc.tapCountEnabled !== false;
      const condTime = !!sc.condTimeEnabled;
      const isCondAll = condScore && condTaps && condTime;
      const isLocked = isCharLocked(c.id);
      html += `
        <td class="${isLocked ? 'is-locked' : ''}">
          <label class="matrix-switch" title="獲得Pt・T捕獲数・時間 3条件すべてを一括ON/OFF">
            <input type="checkbox" class="matrix-checkbox-field" data-char-id="${c.id}" data-field="spawnCondition.condAll" ${isCondAll ? 'checked' : ''} ${isLocked ? 'disabled' : ''}>
            <span class="matrix-switch-slider" style="${isCondAll ? 'background-color:#eab308;' : ''}"></span>
          </label>
        </td>
      `;
    }
    html += '</tr>';

    // 💰 3条件: 獲得Pt
    html += '<tr>';
    html += '<td class="matrix-param-cell-label">💰 3条件: 獲得Pt<span class="matrix-param-desc">スコア閾値到達を出現条件にする</span></td>';
    for (const c of allChars) {
      const cfg = charsDict[c.id];
      const isScoreCond = !!cfg.spawnCondition?.condScoreEnabled;
      const isLocked = isCharLocked(c.id);
      html += `
        <td class="${isLocked ? 'is-locked' : ''}">
          <label class="matrix-switch" title="スコア閾値到達を出現条件にする">
            <input type="checkbox" class="matrix-checkbox-field" data-char-id="${c.id}" data-field="spawnCondition.condScoreEnabled" ${isScoreCond ? 'checked' : ''} ${isLocked ? 'disabled' : ''}>
            <span class="matrix-switch-slider"></span>
          </label>
        </td>
      `;
    }
    html += '</tr>';

    // 🎯 3条件: T捕獲数
    html += '<tr>';
    html += '<td class="matrix-param-cell-label">🎯 3条件: T捕獲数<span class="matrix-param-desc">ターゲット捕獲数を出現条件にする</span></td>';
    for (const c of allChars) {
      const cfg = charsDict[c.id];
      const isTapsCond = cfg.spawnCondition?.condTargetTapsEnabled !== false && cfg.spawnCondition?.tapCountEnabled !== false;
      const isLocked = isCharLocked(c.id);
      html += `
        <td class="${isLocked ? 'is-locked' : ''}">
          <label class="matrix-switch" title="達成回数(ターゲット捕獲数)を出現条件にする">
            <input type="checkbox" class="matrix-checkbox-field" data-char-id="${c.id}" data-field="spawnCondition.condTargetTapsEnabled" ${isTapsCond ? 'checked' : ''} ${isLocked ? 'disabled' : ''}>
            <span class="matrix-switch-slider"></span>
          </label>
        </td>
      `;
    }
    html += '</tr>';

    // ⏱️ 3条件: 時間
    html += '<tr>';
    html += '<td class="matrix-param-cell-label">⏱️ 3条件: 時間<span class="matrix-param-desc">残り時間を出現条件にする</span></td>';
    for (const c of allChars) {
      const cfg = charsDict[c.id];
      const isTimeCond = !!cfg.spawnCondition?.condTimeEnabled;
      const isLocked = isCharLocked(c.id);
      html += `
        <td class="${isLocked ? 'is-locked' : ''}">
          <label class="matrix-switch" title="残り時間を出現条件にする">
            <input type="checkbox" class="matrix-checkbox-field" data-char-id="${c.id}" data-field="spawnCondition.condTimeEnabled" ${isTimeCond ? 'checked' : ''} ${isLocked ? 'disabled' : ''}>
            <span class="matrix-switch-slider"></span>
          </label>
        </td>
      `;
    }
    html += '</tr>';

    // 🚀 出現条件の有効化 (条件4の下の行に移動)
    html += '<tr>';
    html += '<td class="matrix-param-cell-label">🚀 出現条件の有効化<span class="matrix-param-desc">条件達成時のみ出現</span></td>';
    for (const c of allChars) {
      const cfg = charsDict[c.id];
      const isEnabled = cfg.spawnCondition?.enabled ?? false;
      const isLocked = isCharLocked(c.id);
      html += `
        <td class="${isLocked ? 'is-locked' : ''}">
          <label class="matrix-switch" title="出現条件全体の有効/無効">
            <input type="checkbox" class="matrix-checkbox-field" data-char-id="${c.id}" data-field="spawnCondition.enabled" ${isEnabled ? 'checked' : ''} ${isLocked ? 'disabled' : ''}>
            <span class="matrix-switch-slider"></span>
          </label>
        </td>
      `;
    }
    html += '</tr>';

    // 📢 「◯◯出現！」表示
    html += '<tr>';
    html += '<td class="matrix-param-cell-label">📢 「◯◯出現！」表示<span class="matrix-param-desc">出現時ポップアップ文字のON/OFF</span></td>';
    for (const c of allChars) {
      const cfg = charsDict[c.id];
      const isShowAlert = (cfg.spawnCondition?.showAlert === true) || (cfg.spawnCondition?.showAlert === undefined && c.id === 'boo_chan');
      const isLocked = isCharLocked(c.id);
      html += `
        <td class="${isLocked ? 'is-locked' : ''}">
          <label class="matrix-switch" title="出現時に「◯◯出現！」を表示する">
            <input type="checkbox" class="matrix-checkbox-field" data-char-id="${c.id}" data-field="spawnCondition.showAlert" ${isShowAlert ? 'checked' : ''} ${isLocked ? 'disabled' : ''}>
            <span class="matrix-switch-slider"></span>
          </label>
        </td>
      `;
    }
    html += '</tr>';

    // ✨ かたほうでも達成 (時間・回数の片方達成で発動)
    html += '<tr>';
    html += '<td class="matrix-param-cell-label">✨ かたほうでも達成<span class="matrix-param-desc">時間・達成回数のいずれかで出現</span></td>';
    for (const c of allChars) {
      const cfg = charsDict[c.id];
      const isMatchAny = !!cfg.spawnCondition?.matchAny;
      const isLocked = isCharLocked(c.id);
      html += `
        <td class="${isLocked ? 'is-locked' : ''}">
          <label class="matrix-switch" title="時間または達成回数の片方でも達成すれば出現">
            <input type="checkbox" class="matrix-checkbox-field" data-char-id="${c.id}" data-field="spawnCondition.matchAny" ${isMatchAny ? 'checked' : ''} ${isLocked ? 'disabled' : ''}>
            <span class="matrix-switch-slider"></span>
          </label>
        </td>
      `;
    }
    html += '</tr>';

    // 出現確率
    html += '<tr>';
    html += '<td class="matrix-param-cell-label">🎲 出現確率 (%)<span class="matrix-param-desc">1 〜 100%</span></td>';
    for (const c of allChars) {
      const cfg = charsDict[c.id];
      const prob = cfg.spawnCondition?.probability ?? 100;
      const isLocked = isCharLocked(c.id);
      html += `
        <td class="${isLocked ? 'is-locked' : ''}">
          <input type="number" class="matrix-input-number matrix-field" data-char-id="${c.id}" data-field="spawnCondition.probability" min="1" max="100" step="1" value="${prob}" ${isLocked ? 'disabled' : ''}>
        </td>
      `;
    }
    html += '</tr>';

    // 最大発動回数
    html += '<tr>';
    html += '<td class="matrix-param-cell-label">🔁 1ゲーム最大回数<span class="matrix-param-desc">0: 無限, 1〜99, 100:🎲</span></td>';
    for (const c of allChars) {
      const cfg = charsDict[c.id];
      const rep = cfg.spawnCondition?.repeatCount ?? 0;
      const isLocked = isCharLocked(c.id);
      html += `
        <td class="${isLocked ? 'is-locked' : ''}">
          <input type="number" class="matrix-input-number matrix-field" data-char-id="${c.id}" data-field="spawnCondition.repeatCount" min="0" max="100" step="1" value="${rep}" ${isLocked ? 'disabled' : ''}>
        </td>
      `;
    }
    html += '</tr>';

    html += '</tbody>';
    configMatrixTable.innerHTML = html;
  }

  // マトリクス表のインライン変更ハンドラ (モード別に独立して変更)
  function updateMatrixCharField(charId, fieldPath, rawValue) {
    if (isCharLocked(charId)) return;
    const mode = matrixCurrentMode;
    if (!currentConfig.modeConfigs) currentConfig.modeConfigs = {};
    if (!currentConfig.modeConfigs[mode]) currentConfig.modeConfigs[mode] = createDefaultModeConfig(mode);
    const cfg = currentConfig.modeConfigs[mode].characters[charId];
    if (!cfg) return;

    let val = rawValue;
    if (fieldPath === 'randomTurnRatePercent') {
      cfg.randomTurnRate = parseFloat(rawValue) / 100;
    } else if (fieldPath.startsWith('spawnCondition.')) {
      const sub = fieldPath.split('.')[1];
      if (!cfg.spawnCondition) cfg.spawnCondition = {};
      if (sub === 'timeSec' || sub === 'tapCount' || sub === 'probability' || sub === 'repeatCount') {
        val = parseInt(rawValue, 10);
      }
      cfg.spawnCondition[sub] = val;
    } else {
      if (fieldPath === 'pointValue' || fieldPath === 'count' || fieldPath === 'minTargetThreshold' || fieldPath === 'weight' || fieldPath === 'scoreThreshold') {
        val = parseInt(rawValue, 10);
      } else if (fieldPath === 'sizeScale' || fieldPath === 'speedMultiplier' || fieldPath === 'lifetimeSec' || fieldPath === 'collisionRepulsion') {
        val = parseFloat(rawValue);
      }
      cfg[fieldPath] = val;
      if (fieldPath === 'sizeScale') {
        const ratio = currentBulkScalePercent > 0 ? (currentBulkScalePercent / 100) : 1;
        cfg._baseSizeScale = Math.round((val / ratio) * 100) / 100;
      }
    }

    // メイン画面のアクティブキャラかつアクティブモードと一致する場合、UIも即時同期
    if (charId === activeCharId && mode === (currentConfig.activeConfigMode || 'karei')) {
      syncUIForActiveChar();
    }

    // テスト水槽内の魚プロパティも即時反映 (アクティブモード時)
    if (mode === (currentConfig.activeConfigMode || 'karei')) {
      for (const f of simFishes) {
        if (f.type === charId) {
          if (fieldPath === 'pointValue') f.pointValue = val;
          else if (fieldPath === 'sizeScale') {
            f.sizeScale = val;
            f.width = f.baseWidth * f.sizeScale;
            f.height = f.baseHeight * f.sizeScale;
          } else if (fieldPath === 'speedMultiplier') f.speedMultiplier = val;
          else if (fieldPath === 'lifetimeSec') f.lifetimeSec = val;
          else if (fieldPath === 'beginnerAlert') f.beginnerAlert = val;
          else if (fieldPath === 'randomTurnRatePercent') f.randomTurnRate = val / 100;
          else if (fieldPath === 'collisionRepulsion') f.collisionRepulsion = val;
        }
      }
    }

    saveCurrentConfigToStorage();
  }

  // マトリクステーブル内のイベントデリゲーション
  configMatrixTable?.addEventListener('click', async (e) => {
    const modeNames = { karei: 'カレイ派', hirame: 'ヒラメ派', hirai: 'ヒライ派' };
    const allChars = getAllAvailableCharacters();
    const commonParamKeys = ['role', 'pointValue', 'sizeScale', 'count', 'minTargetThreshold', 'speedMultiplier', 'lifetimeSec', 'randomTurnRate', 'collisionRepulsion'];

    // 1. カテゴリ行「全モード共通」ボタン (【1. 基本・共通パラメーター】行)
    const catAllModesBtn = e.target.closest('[data-action="cat-all-modes"]');
    if (catAllModesBtn) {
      const ok = await showAdminConfirm({
        title: '全モード共通の反映確認',
        message: `現在表示中【${modeNames[matrixCurrentMode] || matrixCurrentMode}】の【1. 基本・共通パラメーター】（役割・得点・サイズ・速度など）を、他の２つのモードに反映させますか？\n\n※「🔒 ロック中」のキャラクターは上書きされず保護されます。`,
        icon: '🌐',
        confirmText: 'はい (反映する)',
        cancelText: 'いいえ (キャンセル)'
      });
      if (!ok) return;

      const otherModes = ['karei', 'hirame', 'hirai'].filter(m => m !== matrixCurrentMode);
      const srcChars = currentConfig.modeConfigs[matrixCurrentMode]?.characters || {};

      for (const char of allChars) {
        if (isCharLocked(char.id)) continue;
        const src = srcChars[char.id];
        if (!src) continue;

        for (const m of otherModes) {
          if (!currentConfig.modeConfigs[m]) currentConfig.modeConfigs[m] = createDefaultModeConfig(m);
          if (!currentConfig.modeConfigs[m].characters) currentConfig.modeConfigs[m].characters = createDefaultModeConfig(m).characters;
          const dest = currentConfig.modeConfigs[m].characters[char.id];
          if (dest) {
            for (const k of commonParamKeys) {
              if (src[k] !== undefined) dest[k] = src[k];
            }
          }
        }
      }

      saveCurrentConfigToStorage();
      renderConfigMatrixTable(matrixCurrentMode);
      syncUIForActiveChar();
      syncSimCanvasCount();
      try { sound.init(); sound.playSuccess(1); } catch (err) { }
      return;
    }

    // 2. カテゴリ行「一括ロック切替」ボタン
    const catLockBtn = e.target.closest('[data-action="cat-toggle-all-lock"]');
    if (catLockBtn) {
      if (!currentConfig.lockedCharacters) currentConfig.lockedCharacters = {};
      const anyUnlocked = allChars.some(c => !isCharLocked(c.id));
      for (const c of allChars) {
        currentConfig.lockedCharacters[c.id] = anyUnlocked;
      }
      saveCurrentConfigToStorage();
      renderConfigMatrixTable(matrixCurrentMode);
      try { sound.init(); sound.playTap(); } catch (err) { }
      return;
    }

    // 3. カテゴリ行「デフォルト」ボタン
    const catDefaultBtn = e.target.closest('[data-action="cat-reset-default"]');
    if (catDefaultBtn) {
      const ok = await showAdminConfirm({
        title: 'デフォルト復元の確認',
        message: `現在表示中【${modeNames[matrixCurrentMode] || matrixCurrentMode}】の【1. 基本・共通パラメーター】を、デフォルト値に戻しますか？\n\n※「🔒 ロック中」のキャラクターは維持され、変更されません。`,
        icon: '🔄',
        confirmText: 'はい (デフォルトに戻す)',
        cancelText: 'いいえ (キャンセル)',
        isDanger: true
      });
      if (!ok) return;

      const defaultModeCfg = createDefaultModeConfig(matrixCurrentMode);
      const defaultChars = defaultModeCfg.characters;
      const curChars = currentConfig.modeConfigs[matrixCurrentMode]?.characters;

      if (curChars) {
        for (const c of allChars) {
          if (isCharLocked(c.id)) continue;
          const def = defaultChars[c.id];
          const cur = curChars[c.id];
          if (def && cur) {
            for (const k of commonParamKeys) {
              if (def[k] !== undefined) cur[k] = def[k];
            }
          }
        }
      }

      saveCurrentConfigToStorage();
      renderConfigMatrixTable(matrixCurrentMode);
      syncUIForActiveChar();
      syncSimCanvasCount();
      try { sound.init(); sound.playSuccess(1); } catch (err) { }
      return;
    }

    // 4. キャラヘッダー内「ロック」ミニボタン
    const lockBtn = e.target.closest('[data-action="toggle-lock"]');
    if (lockBtn) {
      const charId = lockBtn.dataset.charId;
      toggleCharLock(charId);
      renderConfigMatrixTable(matrixCurrentMode);
      try { sound.init(); sound.playTap(); } catch (err) { }
      return;
    }

    // 5. キャラヘッダー内「全モード共通」ミニボタン
    const charAllModesBtn = e.target.closest('[data-action="char-all-modes"]');
    if (charAllModesBtn) {
      const charId = charAllModesBtn.dataset.charId;
      if (isCharLocked(charId)) return;
      const cInfo = allChars.find(c => c.id === charId) || { name: charId };

      const ok = await showAdminConfirm({
        title: '全モード反映の確認',
        message: `「${cInfo.name}」の基本設定・役割を、３つのモードすべてに反映させますか？`,
        icon: '🌐',
        confirmText: 'はい (反映する)',
        cancelText: 'いいえ (キャンセル)'
      });
      if (!ok) return;

      const src = currentConfig.modeConfigs?.[matrixCurrentMode]?.characters?.[charId];
      if (src) {
        for (const m of ['karei', 'hirame', 'hirai']) {
          if (m === matrixCurrentMode) continue;
          if (!currentConfig.modeConfigs[m]) currentConfig.modeConfigs[m] = createDefaultModeConfig(m);
          if (!currentConfig.modeConfigs[m].characters) currentConfig.modeConfigs[m].characters = createDefaultModeConfig(m).characters;
          const dest = currentConfig.modeConfigs[m].characters[charId];
          if (dest) {
            for (const k of commonParamKeys) {
              if (src[k] !== undefined) dest[k] = src[k];
            }
          }
        }
        saveCurrentConfigToStorage();
        renderConfigMatrixTable(matrixCurrentMode);
        syncUIForActiveChar();
        syncSimCanvasCount();
        try { sound.init(); sound.playSuccess(1); } catch (err) { }
      }
      return;
    }

    // 6. キャラヘッダー内「デフォルト」ミニボタン
    const charDefaultBtn = e.target.closest('[data-action="char-default"]');
    if (charDefaultBtn) {
      const charId = charDefaultBtn.dataset.charId;
      if (isCharLocked(charId)) return;
      const cInfo = allChars.find(c => c.id === charId) || { name: charId };

      const ok = await showAdminConfirm({
        title: 'デフォルト復元の確認',
        message: `「${cInfo.name}」の基本設定を、現在のモード【${modeNames[matrixCurrentMode] || matrixCurrentMode}】のデフォルト値に戻しますか？`,
        icon: '🔄',
        confirmText: 'はい (デフォルトに戻す)',
        cancelText: 'いいえ (キャンセル)',
        isDanger: true
      });
      if (!ok) return;

      const defaultModeCfg = createDefaultModeConfig(matrixCurrentMode);
      const def = defaultModeCfg.characters?.[charId];
      const cur = currentConfig.modeConfigs?.[matrixCurrentMode]?.characters?.[charId];
      if (def && cur) {
        for (const k of commonParamKeys) {
          if (def[k] !== undefined) cur[k] = def[k];
        }
        saveCurrentConfigToStorage();
        renderConfigMatrixTable(matrixCurrentMode);
        syncUIForActiveChar();
        syncSimCanvasCount();
        try { sound.init(); sound.playSuccess(1); } catch (err) { }
      }
      return;
    }

    // 8. コンボトグルボタン
    const comboBtn = e.target.closest('[data-action="toggle-combo"]');
    if (comboBtn) {
      const charId = comboBtn.dataset.charId;
      if (isCharLocked(charId)) return;
      const mode = matrixCurrentMode;
      const cfg = currentConfig.modeConfigs?.[mode]?.characters?.[charId];
      if (!cfg) return;
      const curCombo = !!cfg.spawnCondition?.isCombo;
      const newCombo = !curCombo;
      updateMatrixCharField(charId, 'spawnCondition.isCombo', newCombo);
      comboBtn.classList.toggle('active', newCombo);
      comboBtn.innerText = newCombo ? '🔥 連続成功' : 'OFF 延べ';
      try { sound.init(); sound.playTap(); } catch (err) { }
      return;
    }

    // 9. キャラクターヘッダー（列選択）
    const thChar = e.target.closest('th.matrix-th-char');
    if (thChar && !e.target.closest('.matrix-char-ctrl-bar')) {
      const charId = thChar.dataset.charId;
      if (charId) {
        activeCharId = charId;
        renderCharSelectPills();
        syncUIForActiveChar();
        try { sound.init(); sound.playTap(); } catch (err) { }
      }
    }
  });

  // 数値・セレクト・チェックボックスの変更イベント
  configMatrixTable?.addEventListener('change', (e) => {
    const target = e.target;
    const charId = target.dataset.charId;
    if (!charId) return;

    if (target.classList.contains('matrix-select-role')) {
      const newRole = target.value;
      updateMatrixCharField(charId, 'role', newRole);
      const mode = matrixCurrentMode;
      const cfg = currentConfig.modeConfigs?.[mode]?.characters?.[charId];
      if (cfg) {
        if (newRole === 'disturber' && cfg.pointValue === 10) {
          updateMatrixCharField(charId, 'pointValue', -5);
        } else if (newRole !== 'disturber' && cfg.pointValue === -5) {
          updateMatrixCharField(charId, 'pointValue', 10);
        }
      }
      renderConfigMatrixTable(matrixCurrentMode);
      syncSimCanvasCount();
      try { sound.init(); sound.playTap(); } catch (err) { }
      return;
    }

    const field = target.dataset.field;
    if (!field) return;

    if (target.type === 'checkbox') {
      const mode = matrixCurrentMode;
      const charCfg = currentConfig.modeConfigs?.[mode]?.characters?.[charId];

      if (field === 'spawnCondition.matchAny') {
        const isChecked = target.checked;
        updateMatrixCharField(charId, 'spawnCondition.matchAny', isChecked);
        if (isChecked) {
          // 「かたほうでも達成」にチェックがONのときは「出現条件の有効化」「条件4: 達成回数 (回)」両方ともにチェックONに自動で
          updateMatrixCharField(charId, 'spawnCondition.enabled', true);
          updateMatrixCharField(charId, 'spawnCondition.tapCountEnabled', true);
          updateMatrixCharField(charId, 'spawnCondition.condTargetTapsEnabled', true);
        }
        renderConfigMatrixTable(matrixCurrentMode);
        saveCurrentConfigToStorage();
        return;
      }

      if (field === 'spawnCondition.condAll') {
        const isChecked = target.checked;
        updateMatrixCharField(charId, 'spawnCondition.condAll', isChecked);
        updateMatrixCharField(charId, 'spawnCondition.condScoreEnabled', isChecked);
        updateMatrixCharField(charId, 'spawnCondition.condTargetTapsEnabled', isChecked);
        updateMatrixCharField(charId, 'spawnCondition.tapCountEnabled', isChecked);
        updateMatrixCharField(charId, 'spawnCondition.condTimeEnabled', isChecked);
        if (!isChecked && !charCfg?.spawnCondition?.enabled) {
          updateMatrixCharField(charId, 'spawnCondition.matchAny', false);
        }
        renderConfigMatrixTable(matrixCurrentMode);
        saveCurrentConfigToStorage();
        return;
      }

      if (field === 'spawnCondition.condScoreEnabled') {
        const isChecked = target.checked;
        updateMatrixCharField(charId, field, isChecked);
        const condScore = isChecked;
        const condTaps = charCfg?.spawnCondition?.condTargetTapsEnabled !== false && charCfg?.spawnCondition?.tapCountEnabled !== false;
        const condTime = !!charCfg?.spawnCondition?.condTimeEnabled;
        updateMatrixCharField(charId, 'spawnCondition.condAll', condScore && condTaps && condTime);
        renderConfigMatrixTable(matrixCurrentMode);
        saveCurrentConfigToStorage();
        return;
      }

      if (field === 'spawnCondition.condTargetTapsEnabled' || field === 'spawnCondition.tapCountEnabled') {
        const isChecked = target.checked;
        updateMatrixCharField(charId, 'spawnCondition.condTargetTapsEnabled', isChecked);
        updateMatrixCharField(charId, 'spawnCondition.tapCountEnabled', isChecked);
        const condScore = !!charCfg?.spawnCondition?.condScoreEnabled;
        const condTaps = isChecked;
        const condTime = !!charCfg?.spawnCondition?.condTimeEnabled;
        updateMatrixCharField(charId, 'spawnCondition.condAll', condScore && condTaps && condTime);

        const isEnabled = !!charCfg?.spawnCondition?.enabled;
        if (!isEnabled || !condTaps) {
          updateMatrixCharField(charId, 'spawnCondition.matchAny', false);
        }
        renderConfigMatrixTable(matrixCurrentMode);
        saveCurrentConfigToStorage();
        return;
      }

      if (field === 'spawnCondition.condTimeEnabled') {
        const isChecked = target.checked;
        updateMatrixCharField(charId, field, isChecked);
        const condScore = !!charCfg?.spawnCondition?.condScoreEnabled;
        const condTaps = charCfg?.spawnCondition?.condTargetTapsEnabled !== false && charCfg?.spawnCondition?.tapCountEnabled !== false;
        const condTime = isChecked;
        updateMatrixCharField(charId, 'spawnCondition.condAll', condScore && condTaps && condTime);
        renderConfigMatrixTable(matrixCurrentMode);
        saveCurrentConfigToStorage();
        return;
      }

      if (field === 'spawnCondition.enabled') {
        updateMatrixCharField(charId, field, target.checked);
        const isEnabled = target.checked;
        const isTapEnabled = charCfg?.spawnCondition?.condTargetTapsEnabled !== false && charCfg?.spawnCondition?.tapCountEnabled !== false;
        if (!isEnabled || !isTapEnabled) {
          updateMatrixCharField(charId, 'spawnCondition.matchAny', false);
        }
        renderConfigMatrixTable(matrixCurrentMode);
        saveCurrentConfigToStorage();
        return;
      }

      updateMatrixCharField(charId, field, target.checked);
      renderConfigMatrixTable(matrixCurrentMode);
      saveCurrentConfigToStorage();
    } else {
      updateMatrixCharField(charId, field, target.value);
      saveCurrentConfigToStorage();
    }
  });

  configMatrixTable?.addEventListener('input', (e) => {
    const target = e.target;
    if (target.classList.contains('matrix-input-number')) {
      const charId = target.dataset.charId;
      const field = target.dataset.field;
      if (charId && field) {
        updateMatrixCharField(charId, field, target.value);
        saveCurrentConfigToStorage();
      }
    }
  });

  updateBalanceUI();
  renderCharSelectPills();
  syncUIForActiveChar();
  syncTimeLimitUI();
  syncMaxFishUI();
  syncFeverMaxFishUI();

  // ===== 称号一覧エディタ =====
  const adminTitleTiersList = document.getElementById('adminTitleTiersList');
  const adminAddTitleTierBtn = document.getElementById('adminAddTitleTierBtn');
  const adminResetTitlesBtn = document.getElementById('adminResetTitlesBtn');

  function renderTitleTiers() {
    if (!adminTitleTiersList) return;
    if (!currentConfig.playerTitles || !Array.isArray(currentConfig.playerTitles)) {
      currentConfig.playerTitles = JSON.parse(JSON.stringify(DEFAULT_PLAYER_TITLES));
    }
    // スコア降順でソート
    currentConfig.playerTitles.sort((a, b) => b.minScore - a.minScore);
    adminTitleTiersList.innerHTML = '';
    currentConfig.playerTitles.forEach((tier, index) => {
      const row = document.createElement('div');
      row.className = 'title-tier-row';
      row.innerHTML = `
        <span class="title-tier-badge">RANK ${index + 1}</span>
        <div class="title-tier-name-col">
          <span class="title-tier-label">称号名:</span>
          <input type="text" class="admin-text-input title-tier-name-input" value="${tier.title}" placeholder="称号名を入力...">
        </div>
        <div class="title-tier-score-col">
          <span class="title-tier-label">必要スコア:</span>
          <input type="number" min="0" step="50" class="admin-text-input title-tier-score-input" value="${tier.minScore}">
          <span class="title-tier-unit">pt以上</span>
        </div>
        <button type="button" class="btn-tier-delete" title="この称号を削除" ${currentConfig.playerTitles.length <= 1 ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''}>🗑️</button>
      `;

      const scoreInput = row.querySelector('.title-tier-score-input');
      const nameInput = row.querySelector('.title-tier-name-input');
      const delBtn = row.querySelector('.btn-tier-delete');

      scoreInput.addEventListener('change', () => {
        tier.minScore = Math.max(0, parseInt(scoreInput.value, 10) || 0);
        renderTitleTiers();
      });

      nameInput.addEventListener('input', () => {
        tier.title = nameInput.value.trim() || '称号なし';
      });

      delBtn.addEventListener('click', () => {
        if (currentConfig.playerTitles.length > 1) {
          currentConfig.playerTitles.splice(index, 1);
          renderTitleTiers();
        }
      });

      adminTitleTiersList.appendChild(row);
    });
  }

  const adminSaveTitlesBtn = document.getElementById('adminSaveTitlesBtn');

  adminSaveTitlesBtn?.addEventListener('click', () => {
    try { sound.init(); sound.playChime(); } catch (e) { }
    localStorage.setItem('hirame_dev_config', JSON.stringify(currentConfig));
    adminChannel?.postMessage({ type: 'UPDATE_DEV_CONFIG', config: currentConfig });
    if (adminSaveTitlesBtn) {
      const orig = adminSaveTitlesBtn.innerHTML;
      adminSaveTitlesBtn.innerHTML = '<span>✅</span> 称号設定を保存しました！';
      adminSaveTitlesBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
      setTimeout(() => {
        adminSaveTitlesBtn.innerHTML = orig;
        adminSaveTitlesBtn.style.background = '';
      }, 2500);
    }
    const syncBadge = document.getElementById('syncStatusBadge');
    if (syncBadge) {
      syncBadge.innerText = '⚡ 称号設定を即時保存・反映！';
      syncBadge.style.color = '#38bdf8';
      setTimeout(() => { syncBadge.innerText = '⚡ 接続アクティブ'; syncBadge.style.color = '#10b981'; }, 3000);
    }
  });

  adminAddTitleTierBtn?.addEventListener('click', () => {
    if (!currentConfig.playerTitles) currentConfig.playerTitles = [];
    currentConfig.playerTitles.push({ minScore: 500, title: '新米釣り名人' });
    renderTitleTiers();
  });

  adminResetTitlesBtn?.addEventListener('click', () => {
    currentConfig.playerTitles = JSON.parse(JSON.stringify(DEFAULT_PLAYER_TITLES));
    renderTitleTiers();
  });

  renderTitleTiers();

  // ===== X結果シェア文言エディタ (多言語対応 ＆ 保存) =====
  const adminXShareTemplate = document.getElementById('adminXShareTemplate');
  const adminXShareCharCount = document.getElementById('adminXShareCharCount');
  const adminXShareWarning = document.getElementById('adminXShareWarning');
  const adminXShareUrl = document.getElementById('adminXShareUrl');
  const adminResetXShareBtn = document.getElementById('adminResetXShareBtn');
  const adminSaveXShareBtn = document.getElementById('adminSaveXShareBtn');
  const xShareLangPills = document.querySelectorAll('#xShareLangPills .btn-micro, .xshare-lang-pill');

  let currentXShareLang = 'ja';

  function updateXShareUI() {
    if (!adminXShareTemplate) return;
    if (adminXShareUrl) {
      adminXShareUrl.value = currentConfig.xShareUrl || '';
    }
    if (!currentConfig.xShareTemplates) {
      currentConfig.xShareTemplates = JSON.parse(JSON.stringify(DEFAULT_X_SHARE_TEMPLATES));
    }
    ['ja', 'en', 'ko', 'zh'].forEach(l => {
      if (!currentConfig.xShareTemplates[l]) {
        currentConfig.xShareTemplates[l] = DEFAULT_X_SHARE_TEMPLATES[l];
      }
    });
    // 言語切り替え時に、旧バージョンの日本語データがコピーされている場合は各言語のデフォルトに戻す
    if (currentXShareLang !== 'ja') {
      const val = currentConfig.xShareTemplates[currentXShareLang];
      if (!val || val === currentConfig.xShareTemplates.ja || val === DEFAULT_X_SHARE_TEMPLATES.ja || val.includes('【ヒラメいた！】')) {
        currentConfig.xShareTemplates[currentXShareLang] = DEFAULT_X_SHARE_TEMPLATES[currentXShareLang];
      }
    }
    const tpl = currentConfig.xShareTemplates[currentXShareLang] || DEFAULT_X_SHARE_TEMPLATES[currentXShareLang] || DEFAULT_X_SHARE_TEMPLATE;
    adminXShareTemplate.value = tpl;
    updateXShareCharCount();
  }

  function updateXShareCharCount() {
    if (!adminXShareTemplate || !adminXShareCharCount) return;
    const len = adminXShareTemplate.value.length;
    adminXShareCharCount.innerText = `${len} / 140 文字`;
    if (len > 140) {
      adminXShareCharCount.style.background = '#ef4444';
      if (adminXShareWarning) adminXShareWarning.style.display = 'inline';
    } else {
      adminXShareCharCount.style.background = '';
      if (adminXShareWarning) adminXShareWarning.style.display = 'none';
    }
  }

  xShareLangPills.forEach(btn => {
    btn.addEventListener('click', () => {
      try { sound.init(); sound.playTap(); } catch (e) { }
      if (!currentConfig.xShareTemplates) {
        currentConfig.xShareTemplates = JSON.parse(JSON.stringify(DEFAULT_X_SHARE_TEMPLATES));
      }
      currentConfig.xShareTemplates[currentXShareLang] = adminXShareTemplate.value;
      if (currentXShareLang === 'ja') {
        currentConfig.xShareTemplate = adminXShareTemplate.value;
      }

      currentXShareLang = btn.dataset.lang;
      xShareLangPills.forEach(b => b.classList.toggle('active', b === btn));
      updateXShareUI();
    });
  });

  adminXShareTemplate?.addEventListener('input', () => {
    if (!currentConfig.xShareTemplates) {
      currentConfig.xShareTemplates = JSON.parse(JSON.stringify(DEFAULT_X_SHARE_TEMPLATES));
    }
    currentConfig.xShareTemplates[currentXShareLang] = adminXShareTemplate.value;
    if (currentXShareLang === 'ja') {
      currentConfig.xShareTemplate = adminXShareTemplate.value;
    }
    updateXShareCharCount();
  });

  adminXShareUrl?.addEventListener('input', () => {
    currentConfig.xShareUrl = adminXShareUrl.value.trim();
  });

  adminSaveXShareBtn?.addEventListener('click', () => {
    try { sound.init(); sound.playChime(); } catch (e) { }
    if (!currentConfig.xShareTemplates) {
      currentConfig.xShareTemplates = JSON.parse(JSON.stringify(DEFAULT_X_SHARE_TEMPLATES));
    }
    currentConfig.xShareTemplates[currentXShareLang] = adminXShareTemplate.value;
    if (currentXShareLang === 'ja') {
      currentConfig.xShareTemplate = adminXShareTemplate.value;
    }
    if (adminXShareUrl) {
      currentConfig.xShareUrl = adminXShareUrl.value.trim();
    }
    localStorage.setItem('hirame_dev_config', JSON.stringify(currentConfig));
    adminChannel?.postMessage({ type: 'UPDATE_DEV_CONFIG', config: currentConfig });
    if (adminSaveXShareBtn) {
      const orig = adminSaveXShareBtn.innerHTML;
      adminSaveXShareBtn.innerHTML = '<span>✅</span> シェア文言を保存しました！';
      adminSaveXShareBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
      setTimeout(() => {
        adminSaveXShareBtn.innerHTML = orig;
        adminSaveXShareBtn.style.background = '';
      }, 2500);
    }
    const syncBadge = document.getElementById('syncStatusBadge');
    if (syncBadge) {
      syncBadge.innerText = '⚡ シェア文言を即時保存・反映！';
      syncBadge.style.color = '#38bdf8';
      setTimeout(() => { syncBadge.innerText = '⚡ 接続アクティブ'; syncBadge.style.color = '#10b981'; }, 3000);
    }
  });

  adminResetXShareBtn?.addEventListener('click', () => {
    try { sound.init(); sound.playTap(); } catch (e) { }
    currentConfig.xShareTemplates = JSON.parse(JSON.stringify(DEFAULT_X_SHARE_TEMPLATES));
    currentConfig.xShareTemplate = DEFAULT_X_SHARE_TEMPLATE;
    currentConfig.xShareUrl = '';
    if (adminXShareUrl) adminXShareUrl.value = '';
    updateXShareUI();
  });

  updateXShareUI();

  // ===== BGM & 音量マネージャー =====
  const adminBgmVol = document.getElementById('adminBgmVol');
  const adminBgmVolVal = document.getElementById('adminBgmVolVal');
  const adminBgmPlayToggleBtn = document.getElementById('adminBgmPlayToggleBtn');
  const adminMasterVol = document.getElementById('adminMasterVol');
  const adminMasterVolVal = document.getElementById('adminMasterVolVal');
  const adminSeVol = document.getElementById('adminSeVol');
  const adminSeVolVal = document.getElementById('adminSeVolVal');
  const adminBgmPlaylist = document.getElementById('adminBgmPlaylist');
  const adminTrackCountBadge = document.getElementById('adminTrackCountBadge');
  const adminBgmTrackBadge = document.getElementById('adminBgmTrackBadge');
  const adminResetBgmBtn = document.getElementById('adminResetBgmBtn');
  const adminAddBgmTitle = document.getElementById('adminAddBgmTitle');
  const adminAddBgmSrc = document.getElementById('adminAddBgmSrc');
  const adminBgmFilePicker = document.getElementById('adminBgmFilePicker');
  const adminAddBgmBtn = document.getElementById('adminAddBgmBtn');

  if (adminBgmVol && adminBgmPlayToggleBtn) {
    adminBgmVol.value = sound.bgmVolume;
    adminBgmVolVal.innerText = `${Math.round(sound.bgmVolume * 100)} %`;
    adminMasterVol.value = sound.masterVolume;
    adminMasterVolVal.innerText = `${Math.round(sound.masterVolume * 100)} %`;
    adminSeVol.value = sound.seVolume;
    adminSeVolVal.innerText = `${Math.round(sound.seVolume * 100)} %`;

    // スムーズ音量変更
    adminBgmVol.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      sound.setBgmVolume(val);
      adminBgmVolVal.innerText = `${Math.round(val * 100)} %`;
      if (adminChannel) adminChannel.postMessage({ type: 'UPDATE_AUDIO_SETTINGS', bgmVolume: val });
    });

    adminMasterVol.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      sound.setMasterVolume(val);
      adminMasterVolVal.innerText = `${Math.round(val * 100)} %`;
      if (adminChannel) adminChannel.postMessage({ type: 'UPDATE_AUDIO_SETTINGS', masterVolume: val });
    });

    adminSeVol.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      sound.setSeVolume(val);
      adminSeVolVal.innerText = `${Math.round(val * 100)} %`;
      if (adminChannel) adminChannel.postMessage({ type: 'UPDATE_AUDIO_SETTINGS', seVolume: val });
    });

    // ツマミ再生・停止トグル
    const updatePlayToggleBtnState = (isPlaying) => {
      if (isPlaying) {
        adminBgmPlayToggleBtn.innerText = '⏹';
        adminBgmPlayToggleBtn.classList.add('playing');
        adminBgmPlayToggleBtn.title = 'BGMを停止';
      } else {
        adminBgmPlayToggleBtn.innerText = '▶';
        adminBgmPlayToggleBtn.classList.remove('playing');
        adminBgmPlayToggleBtn.title = 'BGMを再生';
      }
    };

    adminBgmPlayToggleBtn.addEventListener('click', () => {
      const isPlaying = sound.togglePlayPause();
      updatePlayToggleBtnState(isPlaying);
      renderPlaylistItems();
    });

    sound.onPlayStateChange = (isPlaying) => {
      updatePlayToggleBtnState(isPlaying);
      renderPlaylistItems();
    };

    sound.onTrackChange = (track) => {
      if (adminBgmTrackBadge) {
        adminBgmTrackBadge.innerText = `NOW: ${track.title}`;
      }
      renderPlaylistItems();
    };

    // プレイリスト描画
    function renderPlaylistItems() {
      const playlist = sound.getPlaylist();
      if (!adminBgmPlaylist) return;
      adminBgmPlaylist.innerHTML = '';
      if (adminTrackCountBadge) {
        adminTrackCountBadge.innerText = `${playlist.length} 曲`;
      }

      const currentTrack = sound.getCurrentTrack();
      const isPlaying = sound.isPlaying();
      if (adminBgmTrackBadge) {
        adminBgmTrackBadge.innerText = `BGM: ${currentTrack?.title || '未選択'}`;
      }

      playlist.forEach((track, idx) => {
        const isCur = sound.currentTrackIndex === idx;
        const isEnabled = track.enabled !== false;
        const itemEl = document.createElement('div');
        itemEl.className = `admin-track-item ${isCur && isPlaying ? 'active-playing' : ''} ${isEnabled ? '' : 'track-item-disabled'}`;
        if (!isEnabled) {
          itemEl.style.opacity = '0.65';
        }

        itemEl.innerHTML = `
          <div class="track-info-cell" style="display:flex; align-items:center; gap:8px;">
            <label class="track-enable-toggle" style="display:inline-flex; align-items:center; gap:4px; cursor:pointer;" title="ゲーム本体で表示・再生可能にするか設定">
              <input type="checkbox" class="track-enable-checkbox" ${isEnabled ? 'checked' : ''} style="width:16px; height:16px; accent-color:#38bdf8; cursor:pointer;">
              <span class="track-enable-label" style="font-size:11px; font-weight:800; color:${isEnabled ? '#38bdf8' : '#94a3b8'};">${isEnabled ? 'ON' : 'OFF'}</span>
            </label>
            <span class="track-index-num" style="color:#64748b; font-size:11px;">#${idx + 1}</span>
            <button type="button" class="btn-track-play ${isCur && isPlaying ? 'playing' : ''}" title="${isCur && isPlaying ? '停止' : 'この曲を再生'}">
              ${isCur && isPlaying ? '⏹' : '▶'}
            </button>
            <span class="track-name-text" style="${isEnabled ? '' : 'text-decoration: line-through; color: #94a3b8;'}" title="${track.title}">${track.title}</span>
          </div>
          <div class="track-actions-cell">
            <button type="button" class="btn-track-order btn-order-up" title="上へ移動" ${idx === 0 ? 'disabled' : ''}>▲</button>
            <button type="button" class="btn-track-order btn-order-down" title="下へ移動" ${idx === playlist.length - 1 ? 'disabled' : ''}>▼</button>
            <button type="button" class="btn-track-delete" title="削除" ${playlist.length <= 1 ? 'disabled' : ''}>🗑️</button>
          </div>
        `;

        // 有効/無効チェックボックス切り替え
        const enableCheckbox = itemEl.querySelector('.track-enable-checkbox');
        enableCheckbox.addEventListener('change', (e) => {
          sound.toggleTrackEnabled(idx, e.target.checked);
          renderPlaylistItems();
          if (adminChannel) adminChannel.postMessage({ type: 'UPDATE_BGM_PLAYLIST', playlist: sound.getPlaylist() });
        });

        // 再生/停止
        const playBtn = itemEl.querySelector('.btn-track-play');
        playBtn.addEventListener('click', () => {
          if (isCur && isPlaying) {
            sound.stopTrackAudition(false);
            sound.pauseBGM();
          } else {
            sound.startBGM(idx);
          }
          renderPlaylistItems();
        });

        // 上へ移動
        const upBtn = itemEl.querySelector('.btn-order-up');
        upBtn.addEventListener('click', () => {
          sound.reorderTrack(idx, idx - 1);
          renderPlaylistItems();
          if (adminChannel) adminChannel.postMessage({ type: 'UPDATE_BGM_PLAYLIST', playlist: sound.getPlaylist() });
        });

        // 下へ移動
        const downBtn = itemEl.querySelector('.btn-order-down');
        downBtn.addEventListener('click', () => {
          sound.reorderTrack(idx, idx + 1);
          renderPlaylistItems();
          if (adminChannel) adminChannel.postMessage({ type: 'UPDATE_BGM_PLAYLIST', playlist: sound.getPlaylist() });
        });

        // 削除
        const delBtn = itemEl.querySelector('.btn-track-delete');
        delBtn.addEventListener('click', () => {
          if (confirm(`「${track.title}」をプレイリストから削除しますか？`)) {
            sound.removeTrack(idx);
            renderPlaylistItems();
            if (adminChannel) adminChannel.postMessage({ type: 'UPDATE_BGM_PLAYLIST', playlist: sound.getPlaylist() });
          }
        });

        adminBgmPlaylist.appendChild(itemEl);
      });
    }

    // ファイルアップロードからBGM追加
    adminBgmFilePicker.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result;
        const cleanTitle = file.name.replace(/\.[^/.]+$/, "");
        adminAddBgmTitle.value = cleanTitle;
        adminAddBgmSrc.value = dataUrl;
      };
      reader.readAsDataURL(file);
    });

    // 楽曲追加ボタン
    adminAddBgmBtn.addEventListener('click', () => {
      const title = adminAddBgmTitle.value.trim();
      const src = adminAddBgmSrc.value.trim();
      if (!title || !src) {
        alert('曲名と音声ファイル(URLまたはファイル選択)を入力してください');
        return;
      }
      sound.addTrack({ title, src });
      adminAddBgmTitle.value = '';
      adminAddBgmSrc.value = '';
      adminBgmFilePicker.value = '';
      renderPlaylistItems();
      if (adminChannel) adminChannel.postMessage({ type: 'UPDATE_BGM_PLAYLIST', playlist: sound.getPlaylist() });
    });

    // 初期3曲にリセット
    adminResetBgmBtn.addEventListener('click', () => {
      if (confirm('BGMプレイリストを初期の3曲に戻しますか？')) {
        sound.resetPlaylist();
        renderPlaylistItems();
        if (adminChannel) adminChannel.postMessage({ type: 'UPDATE_BGM_PLAYLIST', playlist: sound.getPlaylist() });
      }
    });

    renderPlaylistItems();
  }

  // ===== シミュレーター内テスト水槽キャンバス (本物モデル描画 ＆ インタラクティブタップ対応) =====
  const simCanvas = document.getElementById('simTestCanvas');
  const simCountStat = document.getElementById('simCountStat');
  const simKareiStat = document.getElementById('simKareiStat');
  const simHirameStat = document.getElementById('simHirameStat');
  const simTrapStat = document.getElementById('simTrapStat');

  const simRenderer = new GameRenderer(simCanvas);

  // キャラクタースタジオで作成されたカスタムベクターキャラクターがあれば水槽にも反映
  const savedRoster = localStorage.getItem('hirame_custom_roster');
  if (savedRoster) {
    try {
      simRenderer.setCustomCharacters(JSON.parse(savedRoster));
    } catch (e) { }
  }

  const BASE_SPECIES_INFO = [
    { id: FISH_TYPES.HIRAME, name: '🐟 ヒラメ' },
    { id: FISH_TYPES.KAREI, name: '🐟 カレイ' },
    { id: FISH_TYPES.OCTOPUS, name: '🐙 タコ' },
    { id: FISH_TYPES.SQUID, name: '🦑 イカ' },
    { id: FISH_TYPES.STINGRAY, name: '🌊 エイ' },
    { id: FISH_TYPES.AJI_OPEN, name: '🐟 アジの開き' },
    { id: FISH_TYPES.SHITABIRAME, name: '👞 ウシノシタ' },
    { id: 'kanji_hirame', name: '🔤 漢字・鮃 (ヒラメ)' },
    { id: 'kanji_karei_1', name: '🔤 漢字・鰈 (カレイ)' },
    { id: 'kanji_karei_2', name: '🔤 漢字・魪 (カレイ)' }
  ];

  let enabledFishTypes = new Set(BASE_SPECIES_INFO.map(s => s.id));
  let simCharCounts = {};
  let simRandomCounts = {};
  let enabledAmbientTypes = new Set(['ocean', 'light_rays', 'seabed', 'bubbles', 'small_fish', 'flow_effect', 'sparks']);

  function renderSimFishCheckboxes() {
    const container = document.getElementById('simCharCheckboxes');
    if (!container) return;

    let roster = {};
    try {
      const saved = localStorage.getItem('hirame_custom_roster');
      if (saved) roster = JSON.parse(saved);
    } catch (e) { }

    const list = [...BASE_SPECIES_INFO];
    for (const [id, char] of Object.entries(roster)) {
      if (!list.some(item => item.id === id)) {
        list.push({ id, name: `✨ ${char.name || id}` });
        if (!enabledFishTypes.has(id)) {
          enabledFishTypes.add(id);
        }
      }
    }

    container.innerHTML = list.map(item => {
      const isChecked = enabledFishTypes.has(item.id);
      const cnt = simCharCounts[item.id] ?? 0;
      return `
        <div class="sim-char-filter-item" style="display:flex; align-items:center; gap:6px; background:rgba(255,255,255,0.05); padding:4px 8px; border-radius:6px; border:1px solid rgba(255,255,255,0.08); font-size:12px;">
          <input type="checkbox" data-fish-type="${item.id}" ${isChecked ? 'checked' : ''} style="cursor:pointer; width:16px; height:16px;">
          <span style="font-weight:700; color:#e2e8f0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:140px;">${item.name}</span>
          <div style="display:flex; align-items:center; gap:3px; margin-left:auto;">
            <input type="number" min="0" max="50" step="1" value="${cnt}" data-fish-type="${item.id}" class="sim-char-count-input admin-number-input" style="width:48px; text-align:center; padding:2px 4px; font-size:11px; height:24px;" title="0匹指定時は🎲ランダム(1〜5匹)で自動決定">
            <span style="font-size:11px; color:#94a3b8;">匹</span>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('input[type="checkbox"]').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const t = e.target.dataset.fishType;
        if (e.target.checked) {
          enabledFishTypes.add(t);
        } else {
          enabledFishTypes.delete(t);
          delete simRandomCounts[t];
          simFishes = simFishes.filter(f => f.type !== t);
        }
        syncSimCanvasCount();
      });
    });

    container.querySelectorAll('.sim-char-count-input').forEach(inp => {
      inp.addEventListener('input', (e) => {
        const t = e.target.dataset.fishType;
        const val = Math.max(0, parseInt(e.target.value, 10) || 0);
        simCharCounts[t] = val;
        delete simRandomCounts[t]; // 再計算
        syncSimCanvasCount();
      });
    });
  }

  // 背景演出 表示・非表示選択チェックボックス描画 (スタジオ登録プリセットも連動)
  const DEFAULT_SIM_AMBIENTS = [
    { id: 'ocean', name: '🎨 背景グラデーション / 画像', icon: '🎨' },
    { id: 'light_rays', name: '✨ 光芒 (サンビーム)', icon: '✨' },
    { id: 'seabed', name: '🏖️ 地面 (地形/草)', icon: '🏖️' },
    { id: 'bubbles', name: '🫧 泡パーティクル', icon: '🫧' },
    { id: 'small_fish', name: '🐟 小魚の群れ', icon: '🐟' },
    { id: 'flow_effect', name: '⬬ 横流れエフェクト', icon: '⬬' },
    { id: 'sparks', name: '✨ 浮遊微粒子/星くず', icon: '✨' }
  ];

  function renderSimAmbientCheckboxes() {
    const container = document.getElementById('simAmbientCheckboxes');
    if (!container) return;

    const list = [...DEFAULT_SIM_AMBIENTS];
    const ambPresets = currentConfig.ambientConfig?.presets || DEFAULT_AMBIENT_PRESETS;
    ambPresets.forEach(p => {
      if (!list.some(x => x.id === p.id)) {
        list.push({
          id: p.id,
          name: `${p.icon || '🎨'} ${p.name}`,
          icon: p.icon || '🎨',
          isPreset: true
        });
        if (!enabledAmbientTypes.has(p.id)) {
          enabledAmbientTypes.add(p.id);
        }
      }
    });

    container.innerHTML = list.map(item => `
      <label class="sim-ambient-check-label" style="display:inline-flex; align-items:center; gap:5px; background:rgba(255,255,255,0.06); padding:4px 8px; border-radius:6px; border:1px solid rgba(255,255,255,0.1); font-size:12px; cursor:pointer; color:#cbd5e1;">
        <input type="checkbox" data-ambient-id="${item.id}" ${enabledAmbientTypes.has(item.id) ? 'checked' : ''} style="cursor:pointer; width:15px; height:15px;">
        <span>${item.name}</span>
      </label>
    `).join('');

    container.querySelectorAll('input[type="checkbox"]').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const id = e.target.dataset.ambientId;
        if (e.target.checked) {
          enabledAmbientTypes.add(id);
        } else {
          enabledAmbientTypes.delete(id);
        }
      });
    });
  }

  // 全選択・全解除ボタン (魚)
  document.getElementById('btnFilterSelectAll')?.addEventListener('click', () => {
    const checkboxes = document.querySelectorAll('#simCharCheckboxes input[type="checkbox"]');
    checkboxes.forEach(c => {
      c.checked = true;
      enabledFishTypes.add(c.dataset.fishType);
    });
    syncSimCanvasCount();
  });

  document.getElementById('btnFilterSelectNone')?.addEventListener('click', () => {
    const checkboxes = document.querySelectorAll('#simCharCheckboxes input[type="checkbox"]');
    checkboxes.forEach(c => {
      c.checked = false;
      enabledFishTypes.delete(c.dataset.fishType);
    });
    simFishes = [];
    syncSimCanvasCount();
  });

  // 全選択・全解除ボタン (背景演出)
  document.getElementById('btnAmbFilterSelectAll')?.addEventListener('click', () => {
    const checkboxes = document.querySelectorAll('#simAmbientCheckboxes input[type="checkbox"]');
    checkboxes.forEach(c => {
      c.checked = true;
      enabledAmbientTypes.add(c.dataset.ambientId);
    });
  });

  document.getElementById('btnAmbFilterSelectNone')?.addEventListener('click', () => {
    const checkboxes = document.querySelectorAll('#simAmbientCheckboxes input[type="checkbox"]');
    checkboxes.forEach(c => {
      c.checked = false;
      enabledAmbientTypes.delete(c.dataset.ambientId);
    });
  });

  // 強制「全復活」ボタン
  document.getElementById('btnSimRespawnAll')?.addEventListener('click', () => {
    simRandomCounts = {};
    simFishes = [];
    syncSimCanvasCount();
    simRenderer.addSplash(simCanvas.width * 0.5, simCanvas.height * 0.5, "#38bdf8");
    simRenderer.addFloatingText("✨ 全魚が復活しました！", simCanvas.width * 0.5, simCanvas.height * 0.45, "#38bdf8", 26);
  });

  renderSimFishCheckboxes();
  renderSimAmbientCheckboxes();

  class SimFish {
    constructor(type) {
      this.type = type; // FISH_TYPES.*
      const activeChars = getActiveCharactersDict();
      const charCfg = activeChars?.[type] || DEFAULT_CHARACTER_SETTINGS[type] || {};
      this.role = charCfg.role || (type === FISH_TYPES.HIRAME || type === FISH_TYPES.KAREI || type === 'boo_chan' || type.startsWith('kanji_') ? 'target' : 'disturber');
      this.sizeScale = Number(charCfg.sizeScale) || 1.0;
      this.speedMultiplier = Number(charCfg.speedMultiplier) || (currentConfig.speedMultiplier || 1.0);
      this.randomTurnRate = Number(charCfg.randomTurnRate) ?? (currentConfig.randomTurnRate || 0.02);
      this.beginnerAlert = charCfg.beginnerAlert ?? true;
      this.lifetimeSec = Number(charCfg.lifetimeSec) || (currentConfig.lifetimeSec || 6.0);
      this.lifetime = Math.floor(this.lifetimeSec * 60);
      this.pointValue = charCfg.pointValue !== undefined ? charCfg.pointValue : (this.role === 'target' ? 10 : -5);
      this.collisionRepulsion = Number(charCfg.collisionRepulsion) || 0;
      this.dispersionRate = charCfg.dispersionRate !== undefined ? Number(charCfg.dispersionRate) : (currentConfig.dispersionRate ?? 0.5);
      this.isBlinkingAlert = false;

      let baseW = 66;
      let baseH = 44;
      if (type === FISH_TYPES.STINGRAY) {
        baseW = 110;
        baseH = 80;
      } else if (type === FISH_TYPES.AJI_OPEN) {
        baseW = 54;
        baseH = 36;
      }

      this.baseWidth = baseW;
      this.baseHeight = baseH;
      this.width = baseW * this.sizeScale;
      this.height = baseH * this.sizeScale;

      this.x = 40 + Math.random() * (simCanvas.width - 80);
      this.y = 50 + Math.random() * (simCanvas.height - 110);
      this.turnCheckTimer = Math.floor(Math.random() * 60);
      this.heading = Math.random() > 0.5 ? 1 : -1;
      this.vx = this.heading * (1.2 + Math.random() * 0.8) * 0.15 * this.speedMultiplier;
      this.vy = (Math.random() - 0.5) * 0.4;
      this.depth = 0.2 + Math.random() * 0.6;
      this.finCycle = Math.random() * Math.PI * 2;
      this.swimCycle = Math.random() * Math.PI * 2;
      this.state = 'swimming'; // 'swimming', 'fleeing_temp', 'returning_temp', 'squid_ink_escape'
      this.fleeTimer = 0;
      this.isCaptured = false;
      this.captureProgress = 0;
      this.targetBucketPos = null;
      this.isDead = false;
      this.pendingInks = [];
      this.inkTimer = 0;

      // シルエット演出設定 (通常表示 → シルエット(等倍→3秒間70%縮小→等倍) → 通常表示)
      const silCfg = charCfg.silhouetteConfig || currentConfig.silhouetteConfig || DEFAULT_SILHOUETTE_CONFIG;
      this.silhouetteConfig = { ...DEFAULT_SILHOUETTE_CONFIG, ...silCfg };
      this.silhouetteState = 'none'; // 'none' | 'shrinking' | 'holding' | 'restoring'
      this.silhouetteTimer = 0;
      this.silhouetteScaleFactor = 1.0;
      this.isSilhouetteActive = false;
      this.silhouetteCooldown = Math.floor(30 + Math.random() * 90);
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

      const cfg = this.silhouetteConfig || currentConfig.silhouetteConfig || DEFAULT_SILHOUETTE_CONFIG;
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
          this.silhouetteCooldown = Math.floor(120 + Math.random() * 120);
        }
      }
    }

    // イカ専用: スミを吐きながら超高速逃走
    jetInkEscape() {
      this.state = 'squid_ink_escape';
      this.isCaptured = true;
      this.inkTimer = 0;
      const toLeft = this.x < simCanvas.width * 0.5;
      this.heading = toLeft ? -1 : 1;
      this.vx = this.heading * 18.0 * 0.15 * (this.speedMultiplier || 1.0);
      this.vy = (Math.random() - 0.5) * 2.0;
      if (!this.pendingInks) this.pendingInks = [];
      this.pendingInks.push({ x: this.x, y: this.y });
    }

    fleeTemporary() {
      if (this.isCaptured || this.state === 'squid_ink_escape') return;
      this.state = 'fleeing_temp';
      this.fleeTimer = 80;
      const toLeft = this.x < simCanvas.width * 0.5;
      this.heading = toLeft ? -1 : 1;
      this.vx = this.heading * 6.0 * 0.15 * (this.speedMultiplier || 1.0);
      this.fleeLimitX = toLeft ? -this.width - 25 : simCanvas.width + this.width + 25;
    }

    update() {
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
        if (this.x < -this.width * 2 || this.x > simCanvas.width + this.width * 2) {
          this.isDead = true;
        }
        return;
      }

      if (this.isCaptured) return;
      this.finCycle += 0.15;
      this.swimCycle += 0.15;

      // シルエット演出アニメーション更新 (等倍 -> 指定秒間縮小シルエット -> 等倍復帰)
      this.updateSilhouette();

      // 滞在時間カウントダウン
      if (this.lifetime > 0) {
        this.lifetime--;
      } else {
        this.lifetime = Math.floor(this.lifetimeSec * 60);
      }

      // 初心者機能：離脱2秒前（120フレーム以下）で点滅
      if (this.role === 'target' && this.beginnerAlert && this.lifetime <= 120 && this.state === 'swimming') {
        this.isBlinkingAlert = true;
      } else {
        this.isBlinkingAlert = false;
      }

      const spd = this.speedMultiplier || 1.0;

      if (this.state === 'fleeing_temp') {
        this.x += this.vx;
        this.fleeTimer--;
        if (this.heading < 0 && this.x < this.fleeLimitX) {
          this.x = this.fleeLimitX;
          this.vx = 0;
        } else if (this.heading > 0 && this.x > this.fleeLimitX) {
          this.x = this.fleeLimitX;
          this.vx = 0;
        }

        if (this.fleeTimer <= 0) {
          this.state = 'returning_temp';
          this.heading = this.x < simCanvas.width * 0.5 ? 1 : -1;
          this.vx = this.heading * 2.2 * 0.15 * spd;
        }
        return;
      }

      if (this.state === 'returning_temp') {
        this.x += this.vx;
        if (this.x > 35 && this.x < simCanvas.width - 35) {
          this.state = 'swimming';
        }
        return;
      }

      // 魚同士のまばら度・ソーシャルディスタンス（まばら度設定連動）
      const dispersion = this.dispersionRate !== undefined ? this.dispersionRate : (currentConfig.dispersionRate ?? 0.5);
      if (dispersion > 0 && this.state === 'swimming') {
        for (const other of simFishes) {
          if (other === this || other.isCaptured || other.isDead || other.state !== 'swimming') continue;
          const dx = this.x - other.x;
          const dy = this.y - other.y;
          const dist = Math.hypot(dx, dy);
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
        for (const other of simFishes) {
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

      // 通常遊泳
      this.x += this.vx;
      this.y += this.vy;

      // 端の反射
      if (this.x < 35 && this.vx < 0) {
        this.vx = Math.abs(this.vx);
        this.heading = 1;
      } else if (this.x > simCanvas.width - 35 && this.vx > 0) {
        this.vx = -Math.abs(this.vx);
        this.heading = -1;
      }

      if (this.y < 45 && this.vy < 0) this.vy = Math.abs(this.vy);
      if (this.y > simCanvas.height - 55 && this.vy > 0) this.vy = -Math.abs(this.vy);

      // 方向転換（1秒＝60フレームに1回判定し、真の設定確率で方向転換）
      this.turnCheckTimer = (this.turnCheckTimer || 0) + 1;
      if (this.turnCheckTimer >= 60) {
        this.turnCheckTimer = 0;
        if (Math.random() < this.randomTurnRate) {
          this.heading *= -1;
          this.vx = this.heading * Math.abs(this.vx || (1.2 * 0.15 * spd));
          this.vy = (Math.random() - 0.5) * 0.4;
        }
      }
    }

    containsPoint(px, py) {
      if (this.isCaptured || this.state === 'squid_ink_escape') return false;
      const rx = this.width * 0.65;
      const ry = this.height * 0.65;
      const dx = (px - this.x) / rx;
      const dy = (py - this.y) / ry;
      return (dx * dx + dy * dy) <= 1.0;
    }
  }

  function syncSimCanvasCount() {
    const available = [...enabledFishTypes];
    if (available.length === 0) {
      simFishes = [];
      return;
    }

    // 排除された魚種が水槽にいれば除去
    simFishes = simFishes.filter(f => enabledFishTypes.has(f.type));

    // 各魚種ごとに目標匹数を決定 (0匹指定時は1〜20匹のランダム)
    const targetCounts = {};
    for (const t of available) {
      let count = simCharCounts[t] ?? 0;
      if (count === 0) {
        if (!simRandomCounts[t]) {
          simRandomCounts[t] = Math.floor(Math.random() * 5) + 1; // 1〜5匹
        }
        count = simRandomCounts[t];
      }
      targetCounts[t] = count;
    }

    // 魚種ごとに現在数と目標数を合わせて増減
    for (const t of available) {
      const target = targetCounts[t];
      const curFishesOfType = simFishes.filter(f => f.type === t);

      if (curFishesOfType.length < target) {
        const diff = target - curFishesOfType.length;
        for (let i = 0; i < diff; i++) {
          simFishes.push(new SimFish(t));
        }
      } else if (curFishesOfType.length > target) {
        const diff = curFishesOfType.length - target;
        let removed = 0;
        for (let i = simFishes.length - 1; i >= 0 && removed < diff; i--) {
          if (simFishes[i].type === t) {
            simFishes.splice(i, 1);
            removed++;
          }
        }
      }
    }
  }

  syncSimCanvasCount();

  // テスト水槽のインタラクティブタップ＆空振りテスト
  simCanvas.addEventListener('pointerdown', (e) => {
    const rect = simCanvas.getBoundingClientRect();
    const scaleX = simCanvas.width / rect.width;
    const scaleY = simCanvas.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;

    // 手前にいる魚から判定 (非シルエット最優先、次いでdepth昇順)
    const sorted = [...simFishes].filter(f => !f.isCaptured).sort((a, b) => {
      const aSil = (a.depth > 0.55);
      const bSil = (b.depth > 0.55);
      if (aSil !== bSil) {
        return aSil ? 1 : -1;
      }
      return a.depth - b.depth;
    });
    let hitFish = null;
    for (const f of sorted) {
      if (f.containsPoint(px, py)) {
        hitFish = f;
        break;
      }
    }

    if (hitFish) {
      simConsecutiveMisses = 0;
      const activeChars = getActiveCharactersDict();
      const charCfg = activeChars?.[hitFish.type] || DEFAULT_CHARACTER_SETTINGS[hitFish.type] || {};
      const role = charCfg.role || hitFish.role || (hitFish.type === 'karei' || hitFish.type === 'hirame' || hitFish.type === 'boo_chan' || hitFish.type?.startsWith('kanji_') ? 'target' : 'disturber');

      // 設定値から正確に得点を取得 (0や正負も完全反映)
      const pointVal = charCfg.pointValue !== undefined
        ? charCfg.pointValue
        : (hitFish.pointValue !== undefined ? hitFish.pointValue : (role === 'target' ? 10 : -5));

      const isDisturber = (role === 'disturber');
      const pointText = pointVal > 0 ? `+${pointVal}` : `${pointVal}`;
      const label = pointVal >= 0 ? t('targetCorrect') : t('targetWrong');
      const pointColor = pointVal >= 0 ? '#38bdf8' : '#ef4444';

      if (isDisturber) {
        if (hitFish.type === FISH_TYPES.SQUID) {
          // イカは逃げながらスミを吐く！
          try { sound.init(); sound.playInk(); } catch (e) { }
          simRenderer.addInkCloud(hitFish.x, hitFish.y);
          simRenderer.addFloatingText(`${pointText} (${label})`, hitFish.x, hitFish.y, pointColor, 24);
          hitFish.jetInkEscape();
          setTimeout(() => syncSimCanvasCount(), 3000);
          return;
        } else if (hitFish.type === FISH_TYPES.OCTOPUS) {
          try { sound.init(); sound.playInk(); } catch (e) { }
          simRenderer.addInkCloud(hitFish.x, hitFish.y);
          simRenderer.addFloatingText(`${pointText} (${label})`, hitFish.x, hitFish.y, pointColor, 24);
        } else {
          try { sound.init(); sound.playMiss(); } catch (e) { }
          simRenderer.addSplash(hitFish.x, hitFish.y, pointColor);
          simRenderer.addFloatingText(`${pointText} (${label})`, hitFish.x, hitFish.y, pointColor, 24);
        }
      } else {
        // ターゲット獲得
        try { sound.init(); sound.playSuccess(1); } catch (e) { }
        simRenderer.addSplash(hitFish.x, hitFish.y, pointColor);
        simRenderer.addFloatingText(`${pointText} (${label})`, hitFish.x, hitFish.y, pointColor, 26);
      }

      // 捕獲された魚を水槽から除外し、3秒後に自動復活
      const idx = simFishes.indexOf(hitFish);
      if (idx !== -1) {
        simFishes.splice(idx, 1);
        setTimeout(() => syncSimCanvasCount(), 3000);
      }
    } else {
      // 空振りタップミス
      try { sound.init(); sound.playTap(); } catch (e) { }
      simRenderer.addSplash(px, py);
      simConsecutiveMisses++;
      const activeFishes = simFishes.filter(f => !f.isCaptured && f.state !== 'fleeing_temp');

      if (simConsecutiveMisses >= 4) {
        for (const f of activeFishes) {
          f.fleeTemporary();
        }
        simRenderer.addFloatingText("魚が全滅逃走！(空振り4回)", simCanvas.width * 0.5, simCanvas.height * 0.45, "#ef4444", 28);
        simConsecutiveMisses = 0;
      } else if (simConsecutiveMisses === 2) {
        const half = Math.ceil(activeFishes.length * 0.5);
        const shuffled = [...activeFishes].sort(() => Math.random() - 0.5);
        for (let i = 0; i < half; i++) {
          shuffled[i].fleeTemporary();
        }
        simRenderer.addFloatingText("半分逃走！(空振り2回)", simCanvas.width * 0.5, simCanvas.height * 0.45, "#f59e0b", 26);
      } else {
        simRenderer.addFloatingText("空振りミス！", px, py, "#94a3b8", 20);
      }
    }
  });

  // カスタムロスターが更新された時の水槽同期
  window.addEventListener('hirame_custom_roster_updated', (e) => {
    if (e.detail?.roster) {
      simRenderer.setCustomCharacters(e.detail.roster);
    }
    renderSimFishCheckboxes();
    syncSimCanvasCount();
    renderChaosFeverCharList();
  });

  let simAmbientFishes = [];
  function initSimAmbientFishes() {
    simAmbientFishes = [];
    for (let i = 0; i < 25; i++) {
      simAmbientFishes.push({
        x: Math.random() * simCanvas.width,
        y: 30 + Math.random() * (simCanvas.height - 100),
        size: 3 + Math.random() * 4,
        speed: 0.6 + Math.random() * 1.4,
        angle: 0
      });
    }
  }
  initSimAmbientFishes();

  let simFpsFrames = 0;
  let simFpsLastTime = performance.now();
  let simCurrentFps = 60;

  function simLoop() {
    requestAnimationFrame(simLoop);

    simFpsFrames++;
    const fpsNow = performance.now();
    if (fpsNow - simFpsLastTime >= 400) {
      simCurrentFps = Math.round((simFpsFrames * 1000) / (fpsNow - simFpsLastTime));
      simCurrentFps = Math.max(1, Math.min(120, simCurrentFps));
      simFpsFrames = 0;
      simFpsLastTime = fpsNow;
    }

    const ctx = simCanvas.getContext('2d');

    // 2. 光芒 (サンビーム) & 泡パーティクル
    const showRays = enabledAmbientTypes.has('light_rays');
    const showBubbles = enabledAmbientTypes.has('bubbles');
    const showSmallFish = enabledAmbientTypes.has('small_fish');
    const showFlow = enabledAmbientTypes.has('flow_effect');
    const showSparks = enabledAmbientTypes.has('sparks');

    // プリセット演出: 「表示用プリセット一覧」でOFF（ゲーム本体で非表示）であっても、プレビュー側のチェックがONならテスト水槽でプレビュー可能にする
    const filteredPresets = (currentConfig.ambientConfig?.presets || []).map(p => ({
      ...p,
      enabled: enabledAmbientTypes.has(p.id)
    }));

    const ambCfg = currentConfig.ambientConfig || {};
    const simGameState = {
      showLightRays: showRays,
      devConfig: {
        ambientConfig: {
          ...ambCfg,
          enabled: true,
          bubbles: { ...(ambCfg.bubbles || {}), enabled: showBubbles, count: ambCfg.bubbles?.count || 30 },
          smallFish: { ...(ambCfg.smallFish || {}), enabled: showSmallFish, count: ambCfg.smallFish?.count || 15 },
          flowEffect: { ...(ambCfg.flowEffect || {}), enabled: showFlow },
          sparks: { ...(ambCfg.sparks || {}), enabled: showSparks },
          presets: filteredPresets
        }
      }
    };

    // 1. 背景グラデーション & 背景PNG画像
    if (enabledAmbientTypes.has('ocean')) {
      simRenderer.renderOceanBackground(simCanvas.width, simCanvas.height, simGameState);
    } else {
      ctx.fillStyle = '#0a192f';
      ctx.fillRect(0, 0, simCanvas.width, simCanvas.height);
    }

    if (showRays || showBubbles) {
      simRenderer.renderCausticsAndBubbles(simCanvas.width, simCanvas.height, simGameState);
    }

    // 3. 横流れエフェクト (⬬ 楕円パーティクル)
    if (showFlow) {
      simRenderer.renderFlowEffect(simCanvas.width, simCanvas.height, simGameState);
    }

    // 4. 浮遊微粒子 / 星くず (Sparks & Dust)
    if (showSparks) {
      simRenderer.renderSparks(simCanvas.width, simCanvas.height, simGameState);
    }

    // 5. 地面 (地形 & 草)
    if (enabledAmbientTypes.has('seabed')) {
      simRenderer.renderSeabed(simCanvas.width, simCanvas.height, simCanvas.height, simGameState);
    }

    // 6. 小魚の群れ ＆ 登録プリセット (スタジオ連携)
    if (showSmallFish || filteredPresets.some(p => p.enabled)) {
      for (const af of simAmbientFishes) {
        af.x += af.speed;
        if (af.x > simCanvas.width + 20) af.x = -20;
      }
      simRenderer.renderAmbientFish(simAmbientFishes, simGameState);
    }

    let kCount = 0, hCount = 0, tCount = 0;
    // 魚の描画 (水深とシルエット判定でソート: シルエットは最背面、手前の魚は前面)
    const sorted = [...simFishes].sort((a, b) => {
      const aSil = !!a.isSilhouetteActive || a.depth > 0.55;
      const bSil = !!b.isSilhouetteActive || b.depth > 0.55;
      if (aSil !== bSil) return aSil ? -1 : 1;
      return b.depth - a.depth;
    });
    for (let i = 0; i < sorted.length; i++) {
      const f = sorted[i];
      f.update();

      // イカスミ逃走のスミ雲反映
      if (f.pendingInks && f.pendingInks.length > 0) {
        while (f.pendingInks.length > 0) {
          const ink = f.pendingInks.pop();
          simRenderer.addInkCloud(ink.x, ink.y);
        }
      }

      if (f.isDead) {
        const idx = simFishes.indexOf(f);
        if (idx !== -1) simFishes.splice(idx, 1);
        continue;
      }

      simRenderer.renderFish(f);
      if (f.type === FISH_TYPES.KAREI) kCount++;
      else if (f.type === FISH_TYPES.HIRAME) hCount++;
      else tCount++;
    }

    // VFX描画
    simRenderer.renderInkClouds();
    simRenderer.renderParticles();
    simRenderer.renderFloatingTexts();

    // 右上にFPS表示 (1〜120 FPS)
    ctx.save();
    const fpsText = `${simCurrentFps} FPS`;
    ctx.font = 'bold 12px "Outfit", sans-serif';
    const textWidth = ctx.measureText(fpsText).width;
    const badgeW = textWidth + 22;
    const badgeH = 22;
    const badgeX = simCanvas.width - badgeW - 10;
    const badgeY = 10;

    // バッジ背景 (半透明のダークピル)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 11);
    ctx.fill();
    ctx.stroke();

    // インジケータードット (緑・黄・赤)
    ctx.beginPath();
    ctx.arc(badgeX + 10, badgeY + badgeH / 2, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = simCurrentFps >= 50 ? '#4ade80' : (simCurrentFps >= 30 ? '#facc15' : '#ef4444');
    ctx.fill();

    // FPSテキスト
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(fpsText, badgeX + 17, badgeY + badgeH / 2);
    ctx.restore();

    simCountStat.innerText = simFishes.length;
    simKareiStat.innerText = kCount;
    simHirameStat.innerText = hCount;
    simTrapStat.innerText = tCount;
  }
  simLoop();

  // ===== カオスフィーバー設定 =====
  function getChaosFeverConfig() {
    if (!currentConfig.chaosFeverConfig) {
      currentConfig.chaosFeverConfig = JSON.parse(JSON.stringify(DEFAULT_CHAOS_FEVER_CONFIG));
    }
    return currentConfig.chaosFeverConfig;
  }

  function syncChaosFeverUI() {
    const feverCfg = getChaosFeverConfig();
    if (chaosFeverEnabled) chaosFeverEnabled.checked = feverCfg.enabled !== false;
    if (chaosFeverTriggerTime) {
      chaosFeverTriggerTime.value = feverCfg.triggerTimeSec || 10;
      if (chaosFeverTriggerTimeVal) chaosFeverTriggerTimeVal.innerText = `残り ${chaosFeverTriggerTime.value} 秒`;
    }
    if (chaosFeverMaxScreen) {
      chaosFeverMaxScreen.value = feverCfg.maxScreenFishes || 70;
      if (chaosFeverMaxScreenVal) chaosFeverMaxScreenVal.innerText = `${chaosFeverMaxScreen.value} 匹`;
    }
    if (chaosFeverConfetti) {
      chaosFeverConfetti.checked = feverCfg.confettiEnabled !== false;
    }
    renderChaosFeverCharList();
  }

  function renderChaosFeverCharList() {
    if (!chaosFeverCharList) return;
    const feverCfg = getChaosFeverConfig();
    if (!feverCfg.characters) feverCfg.characters = {};

    const allChars = getAllAvailableCharacters();
    chaosFeverCharList.innerHTML = allChars.map(char => {
      const charCfg = feverCfg.characters[char.id] || { enabled: true, count: 6 };
      const isChecked = charCfg.enabled !== false;
      const count = charCfg.count !== undefined ? charCfg.count : 6;
      return `
        <div class="fever-char-item" style="display:flex; align-items:center; justify-content:space-between; gap:6px; padding:4px 8px; background:rgba(30,41,59,0.7); border-radius:6px; border:1px solid rgba(255,255,255,0.05);">
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer; flex:1; min-width:0; margin:0;">
            <input type="checkbox" class="fever-char-chk" data-char-id="${char.id}" ${isChecked ? 'checked' : ''} style="cursor:pointer; accent-color:#38bdf8;">
            <span style="font-size:12px; color:#e2e8f0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${char.name}">${char.name}</span>
          </label>
          <div style="display:flex; align-items:center; gap:3px;">
            <input type="number" class="fever-char-count admin-text-input" data-char-id="${char.id}" min="0" max="50" value="${count}" style="width:48px; padding:2px 4px; font-size:12px; text-align:center; height:24px; border-radius:4px;">
            <span style="font-size:11px; color:#94a3b8;">匹</span>
          </div>
        </div>
      `;
    }).join('');

    chaosFeverCharList.querySelectorAll('.fever-char-chk').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const cId = e.target.dataset.charId;
        if (!feverCfg.characters[cId]) feverCfg.characters[cId] = { enabled: true, count: 6 };
        feverCfg.characters[cId].enabled = e.target.checked;
        saveCurrentConfigToStorage();
      });
    });

    chaosFeverCharList.querySelectorAll('.fever-char-count').forEach(num => {
      num.addEventListener('input', (e) => {
        const cId = e.target.dataset.charId;
        const val = Math.max(0, Math.min(50, parseInt(e.target.value, 10) || 0));
        if (!feverCfg.characters[cId]) feverCfg.characters[cId] = { enabled: true, count: val };
        feverCfg.characters[cId].count = val;
        saveCurrentConfigToStorage();
      });
    });
  }

  function initChaosFeverUI() {
    const toggleBtn = document.querySelector('button[data-target="chaosFeverBody"]');
    toggleBtn?.addEventListener('click', () => {
      if (chaosFeverBody) {
        const isHidden = chaosFeverBody.classList.toggle('hidden');
        toggleBtn.textContent = isHidden ? '▸' : '▾';
      }
    });

    chaosFeverEnabled?.addEventListener('change', (e) => {
      const feverCfg = getChaosFeverConfig();
      feverCfg.enabled = e.target.checked;
      saveCurrentConfigToStorage();
    });

    chaosFeverTriggerTime?.addEventListener('input', (e) => {
      const feverCfg = getChaosFeverConfig();
      const val = parseInt(e.target.value, 10) || 10;
      feverCfg.triggerTimeSec = val;
      if (chaosFeverTriggerTimeVal) chaosFeverTriggerTimeVal.innerText = `残り ${val} 秒`;
      saveCurrentConfigToStorage();
    });

    chaosFeverMaxScreen?.addEventListener('input', (e) => {
      setFeverMaxFish(e.target.value);
    });

    chaosFeverConfetti?.addEventListener('change', (e) => {
      const feverCfg = getChaosFeverConfig();
      feverCfg.confettiEnabled = e.target.checked;
      saveCurrentConfigToStorage();
    });

    btnTestChaosFever?.addEventListener('click', () => {
      try {
        sound.init();
        sound.playCombo();
      } catch (e) { }

      const feverCfg = getChaosFeverConfig();
      if (feverCfg.confettiEnabled !== false && typeof confetti === 'function') {
        confetti({
          particleCount: 50,
          spread: 90,
          origin: { x: 0.7, y: 0.3 }
        });
      }

      simRenderer.addFloatingText('🔥 カオスフィーバー大漁ラッシュ！', simCanvas.width * 0.5, simCanvas.height * 0.35, '#facc15', 34);

      const maxCap = Math.max(10, feverCfg.maxScreenFishes || 70);
      const charConfigs = feverCfg.characters || {};
      for (const [charId, charInfo] of Object.entries(charConfigs)) {
        if (charInfo && charInfo.enabled !== false && (charInfo.count || 0) > 0) {
          for (let i = 0; i < charInfo.count; i++) {
            if (simFishes.length >= maxCap) break;
            simFishes.push(new SimFish(charId));
          }
        }
      }

      const origHtml = btnTestChaosFever.innerHTML;
      btnTestChaosFever.innerHTML = '<span>⚡</span> フィーバー発動中！';
      btnTestChaosFever.style.background = 'rgba(250,204,21,0.4)';
      setTimeout(() => {
        btnTestChaosFever.innerHTML = origHtml;
        btnTestChaosFever.style.background = '';
      }, 2000);
    });

    syncChaosFeverUI();
  }

  initChaosFeverUI();

  // ===== 📻 音量・BGM設定 ＆ BGM再生表示トリガー設定 =====
  function initBgmManager() {
    const adminBgmVol = document.getElementById('adminBgmVol');
    const adminBgmVolVal = document.getElementById('adminBgmVolVal');
    const adminMasterVol = document.getElementById('adminMasterVol');
    const adminMasterVolVal = document.getElementById('adminMasterVolVal');
    const adminSeVol = document.getElementById('adminSeVol');
    const adminSeVolVal = document.getElementById('adminSeVolVal');
    const adminBgmPlayToggleBtn = document.getElementById('adminBgmPlayToggleBtn');
    const adminBgmTrackBadge = document.getElementById('adminBgmTrackBadge');

    // BGM再生表示設定要素
    const holdSecInput = document.getElementById('adminBgmHoldSec');
    const holdSecVal = document.getElementById('adminBgmHoldSecVal');
    const tapCountInput = document.getElementById('adminBgmTapCount');
    const actionTypeSelect = document.getElementById('adminBgmActionType');
    const titleInput = document.getElementById('adminBgmBannerTitle');
    const messageInput = document.getElementById('adminBgmBannerMessage');
    const linkUrlInput = document.getElementById('adminBgmBannerLinkUrl');
    const linkTextInput = document.getElementById('adminBgmBannerLinkText');
    const saveBgmBannerBtn = document.getElementById('adminSaveBgmBannerBtn');
    const resetBgmBannerBtn = document.getElementById('adminResetBgmBannerBtn');

    function syncBgmBannerUI() {
      const cfg = currentConfig.bgmBannerConfig || DEFAULT_BGM_BANNER_CONFIG;
      const sec = cfg.holdSec !== undefined ? cfg.holdSec : 61;
      if (holdSecInput) holdSecInput.value = sec;
      if (holdSecVal) {
        if (sec === 0) {
          holdSecVal.innerText = '0秒 (タップ即時)';
        } else if (sec >= 61) {
          holdSecVal.innerText = '61 (タップ無効)';
        } else {
          holdSecVal.innerText = `${sec} 秒`;
        }
      }
      if (tapCountInput) tapCountInput.value = cfg.tapCount !== undefined ? cfg.tapCount : 1;
      if (actionTypeSelect) actionTypeSelect.value = cfg.actionType || 'modal';
      if (titleInput) titleInput.value = cfg.title || '';
      if (messageInput) messageInput.value = cfg.message || '';
      if (linkUrlInput) linkUrlInput.value = cfg.linkUrl || '';
      if (linkTextInput) linkTextInput.value = cfg.linkText || '';
    }

    holdSecInput?.addEventListener('input', (e) => {
      const sec = parseInt(e.target.value, 10);
      if (holdSecVal) {
        if (sec === 0) {
          holdSecVal.innerText = '0秒 (タップ即時)';
        } else if (sec >= 61) {
          holdSecVal.innerText = '61 (タップ無効)';
        } else {
          holdSecVal.innerText = `${sec} 秒`;
        }
      }
    });

    function saveBgmBannerConfig(notify = true) {
      if (!currentConfig.bgmBannerConfig) {
        currentConfig.bgmBannerConfig = JSON.parse(JSON.stringify(DEFAULT_BGM_BANNER_CONFIG));
      }
      const sec = parseInt(holdSecInput?.value, 10);
      currentConfig.bgmBannerConfig.holdSec = isNaN(sec) ? 61 : Math.max(0, Math.min(61, sec));
      const taps = parseInt(tapCountInput?.value, 10);
      currentConfig.bgmBannerConfig.tapCount = isNaN(taps) ? 1 : Math.max(1, Math.min(10, taps));
      currentConfig.bgmBannerConfig.actionType = actionTypeSelect?.value || 'modal';
      currentConfig.bgmBannerConfig.title = titleInput?.value.trim() || '';
      currentConfig.bgmBannerConfig.message = messageInput?.value.trim() || '';
      currentConfig.bgmBannerConfig.linkUrl = linkUrlInput?.value.trim() || '';
      currentConfig.bgmBannerConfig.linkText = linkTextInput?.value.trim() || '';

      saveCurrentConfigToStorage();

      if (notify) {
        try { sound.init(); sound.playChime(); } catch (e) { }
        if (saveBgmBannerBtn) {
          const origText = saveBgmBannerBtn.innerHTML;
          saveBgmBannerBtn.innerHTML = '<span>✅</span> BGM再生表示設定を保存しました！';
          saveBgmBannerBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
          setTimeout(() => {
            saveBgmBannerBtn.innerHTML = origText;
            saveBgmBannerBtn.style.background = '';
          }, 2500);
        }
        const syncBadge = document.getElementById('syncStatusBadge');
        if (syncBadge) {
          syncBadge.innerText = '⚡ BGM再生表示設定を即時反映！';
          syncBadge.style.color = '#38bdf8';
          setTimeout(() => { syncBadge.innerText = '⚡ 接続アクティブ'; syncBadge.style.color = '#10b981'; }, 3000);
        }
      }
    }

    saveBgmBannerBtn?.addEventListener('click', () => saveBgmBannerConfig(true));
    resetBgmBannerBtn?.addEventListener('click', () => {
      try { sound.init(); sound.playTap(); } catch (e) { }
      currentConfig.bgmBannerConfig = JSON.parse(JSON.stringify(DEFAULT_BGM_BANNER_CONFIG));
      syncBgmBannerUI();
      saveBgmBannerConfig(true);
    });

    // 音量スライダー初期化
    if (adminBgmVol) {
      adminBgmVol.value = sound.bgmVolume;
      if (adminBgmVolVal) adminBgmVolVal.innerText = `${Math.round(sound.bgmVolume * 100)} %`;
      adminBgmVol.addEventListener('input', (e) => {
        const v = parseFloat(e.target.value) || 0;
        sound.setBgmVolume(v);
        if (adminBgmVolVal) adminBgmVolVal.innerText = `${Math.round(v * 100)} %`;
      });
    }
    if (adminMasterVol) {
      adminMasterVol.value = sound.masterVolume;
      if (adminMasterVolVal) adminMasterVolVal.innerText = `${Math.round(sound.masterVolume * 100)} %`;
      adminMasterVol.addEventListener('input', (e) => {
        const v = parseFloat(e.target.value) || 0;
        sound.setMasterVolume(v);
        if (adminMasterVolVal) adminMasterVolVal.innerText = `${Math.round(v * 100)} %`;
      });
    }
    if (adminSeVol) {
      adminSeVol.value = sound.seVolume;
      if (adminSeVolVal) adminSeVolVal.innerText = `${Math.round(sound.seVolume * 100)} %`;
      adminSeVol.addEventListener('input', (e) => {
        const v = parseFloat(e.target.value) || 0;
        sound.setSeVolume(v);
        if (adminSeVolVal) adminSeVolVal.innerText = `${Math.round(v * 100)} %`;
      });
    }

    if (adminBgmPlayToggleBtn) {
      adminBgmPlayToggleBtn.addEventListener('click', () => {
        try {
          sound.init();
          sound.toggleBgm();
          adminBgmPlayToggleBtn.innerText = sound.isBgmPlaying ? '⏸' : '▶';
          if (adminBgmTrackBadge) {
            const track = sound.getCurrentTrack();
            adminBgmTrackBadge.innerText = `BGM: ${track ? track.title : '再生停止中'}`;
          }
        } catch (e) {
          console.warn(e);
        }
      });
    }

    syncBgmBannerUI();
  }

  try {
    initBgmManager();
  } catch (err) {
    console.error('initBgmManager initialization error:', err);
  }

  // ===== タイトル＆モード画面エディタ (Premiere Pro & Photoshop風 UI) =====
  function initTitleModeEditor() {
    let currentTitleScreen = JSON.parse(JSON.stringify(currentConfig.titleScreen || DEFAULT_TITLE_SCREEN));
    let currentModeSelectScreen = JSON.parse(JSON.stringify(currentConfig.modeSelectScreen || DEFAULT_MODE_SELECT_SCREEN));
    let activeTitleTarget = 'mainTitle'; // 'mainTitle' | 'subTitle'
    let isAspectLocked = true;
    let activeLang = 'ja'; // 'ja' | 'en' | 'ko' | 'zh'

    // 多言語辞書のフォールバック統合 (保存済み設定に新言語が欠損している場合も自動補完)
    if (!currentTitleScreen.mainTitle) currentTitleScreen.mainTitle = JSON.parse(JSON.stringify(DEFAULT_TITLE_SCREEN.mainTitle));
    if (!currentTitleScreen.subTitle) currentTitleScreen.subTitle = JSON.parse(JSON.stringify(DEFAULT_TITLE_SCREEN.subTitle));

    currentTitleScreen.mainTitle.textByLang = Object.assign(
      {},
      DEFAULT_TITLE_SCREEN.mainTitle.textByLang,
      currentTitleScreen.mainTitle.textByLang || {}
    );
    if (currentTitleScreen.mainTitle.text) {
      currentTitleScreen.mainTitle.textByLang.ja = currentTitleScreen.mainTitle.text;
    }

    currentTitleScreen.subTitle.textByLang = Object.assign(
      {},
      DEFAULT_TITLE_SCREEN.subTitle.textByLang,
      currentTitleScreen.subTitle.textByLang || {}
    );
    if (currentTitleScreen.subTitle.text) {
      currentTitleScreen.subTitle.textByLang.ja = currentTitleScreen.subTitle.text;
    }

    if (!currentModeSelectScreen.masterSpeechByLang) {
      currentModeSelectScreen.masterSpeechByLang = {};
    }
    currentModeSelectScreen.masterSpeechByLang = Object.assign(
      {},
      DEFAULT_MODE_SELECT_SCREEN.masterSpeechByLang,
      currentModeSelectScreen.masterSpeechByLang || {}
    );
    if (currentModeSelectScreen.masterSpeech) {
      currentModeSelectScreen.masterSpeechByLang.ja = currentModeSelectScreen.masterSpeech;
    }

    if (!currentModeSelectScreen.modes) {
      currentModeSelectScreen.modes = JSON.parse(JSON.stringify(DEFAULT_MODE_SELECT_SCREEN.modes));
    }

    // モード選択画面
    const avatarThumbPreview = document.getElementById('avatarThumbPreview');
    const tmAvatarPathInput = document.getElementById('tmAvatarPathInput');
    const tmAvatarFileInput = document.getElementById('tmAvatarFileInput');
    const btnResetBUTAAvatar = document.getElementById('btnResetBUTAAvatar');
    const tmMasterSpeechText = document.getElementById('tmMasterSpeechText');
    const tmMasterSpeechCount = document.getElementById('tmMasterSpeechCount');
    const btnResetMasterSpeech = document.getElementById('btnResetMasterSpeech');

    // 派閥モード名称＆説明文カスタム要素
    const tmModeKareiName = document.getElementById('tmModeKareiName');
    const tmModeKareiDesc = document.getElementById('tmModeKareiDesc');
    const tmModeHirameName = document.getElementById('tmModeHirameName');
    const tmModeHirameDesc = document.getElementById('tmModeHirameDesc');
    const tmModeHiraiName = document.getElementById('tmModeHiraiName');
    const tmModeHiraiDesc = document.getElementById('tmModeHiraiDesc');
    const btnResetModeFactionNames = document.getElementById('btnResetModeFactionNames');

    // プレビューモック要素
    const btnPreviewTitleScreen = document.getElementById('btnPreviewTitleScreen');
    const btnPreviewModeScreen = document.getElementById('btnPreviewModeScreen');
    const mockTitleStage = document.getElementById('mockTitleStage');
    const mockModeStage = document.getElementById('mockModeStage');
    const mockTitleLogo = document.getElementById('mockTitleLogo');
    const mockTitleSub = document.getElementById('mockTitleSub');
    const mockMasterAvatarImg = document.getElementById('mockMasterAvatarImg');
    const mockMasterSpeech = document.getElementById('mockMasterSpeech');

    // 保存＆リセット
    const btnSaveTitleMode = document.getElementById('btnSaveTitleMode');
    const btnResetTitleMode = document.getElementById('btnResetTitleMode');
    const btnQuickSyncTitleMode = document.getElementById('btnQuickSyncTitleMode');

    // 入力中のテキストを状態に即時フラッシュ同期
    function flushCurrentInputsToState() {
      if (typeof tmTextContent !== 'undefined' && tmTextContent) {
        const val = tmTextContent.value;
        const style = currentTitleScreen[activeTitleTarget];
        if (style) {
          if (!style.textByLang) style.textByLang = {};
          style.textByLang[activeLang] = val;
          if (activeLang === 'ja') {
            style.text = val;
          }
        }
      }
      if (tmMasterSpeechText) {
        const speechVal = tmMasterSpeechText.value;
        if (!currentModeSelectScreen.masterSpeechByLang) {
          currentModeSelectScreen.masterSpeechByLang = {};
        }
        currentModeSelectScreen.masterSpeechByLang[activeLang] = speechVal;
        if (activeLang === 'ja') {
          currentModeSelectScreen.masterSpeech = speechVal;
        }
      }
      if (tmModeKareiName || tmModeKareiDesc || tmModeHirameName || tmModeHirameDesc || tmModeHiraiName || tmModeHiraiDesc) {
        if (!currentModeSelectScreen.modes) {
          currentModeSelectScreen.modes = JSON.parse(JSON.stringify(DEFAULT_MODE_SELECT_SCREEN.modes));
        }
        const modes = currentModeSelectScreen.modes;
        ['karei', 'hirame', 'hirai'].forEach(modeKey => {
          if (!modes[modeKey]) modes[modeKey] = JSON.parse(JSON.stringify(DEFAULT_MODE_SELECT_SCREEN.modes[modeKey]));
          if (!modes[modeKey].nameByLang) modes[modeKey].nameByLang = {};
          if (!modes[modeKey].descByLang) modes[modeKey].descByLang = {};
        });
        if (tmModeKareiName) modes.karei.nameByLang[activeLang] = tmModeKareiName.value;
        if (tmModeKareiDesc) modes.karei.descByLang[activeLang] = tmModeKareiDesc.value;
        if (tmModeHirameName) modes.hirame.nameByLang[activeLang] = tmModeHirameName.value;
        if (tmModeHirameDesc) modes.hirame.descByLang[activeLang] = tmModeHirameDesc.value;
        if (tmModeHiraiName) modes.hirai.nameByLang[activeLang] = tmModeHiraiName.value;
        if (tmModeHiraiDesc) modes.hirai.descByLang[activeLang] = tmModeHiraiDesc.value;
      }
    }

    // プレビュー更新 (多言語対応)
    updateTitleModeMockup = function () {
      if (mockTitleLogo && currentTitleScreen.mainTitle) {
        applyTextCustomStyles(mockTitleLogo, currentTitleScreen.mainTitle, activeLang);
      }
      if (mockTitleSub && currentTitleScreen.subTitle) {
        applyTextCustomStyles(mockTitleSub, currentTitleScreen.subTitle, activeLang);
      }
      if (mockMasterAvatarImg) {
        mockMasterAvatarImg.src = currentModeSelectScreen.masterAvatar || './images/BUTA_shokunin.png';
      }
      if (avatarThumbPreview) {
        avatarThumbPreview.src = currentModeSelectScreen.masterAvatar || './images/BUTA_shokunin.png';
      }
      if (mockMasterSpeech) {
        const speech = (currentModeSelectScreen.masterSpeechByLang && currentModeSelectScreen.masterSpeechByLang[activeLang] !== undefined && currentModeSelectScreen.masterSpeechByLang[activeLang] !== '')
          ? currentModeSelectScreen.masterSpeechByLang[activeLang]
          : (activeLang === 'ja' && currentModeSelectScreen.masterSpeech
            ? currentModeSelectScreen.masterSpeech
            : (DEFAULT_MODE_SELECT_SCREEN.masterSpeechByLang?.[activeLang] || ''));
        mockMasterSpeech.style.whiteSpace = 'pre-line';
        mockMasterSpeech.innerText = speech;
      }

      // モード選択画面のプレビューカード文言も選択言語に合わせてローカライズ表示 (カスタム派閥名対応)
      const mockCards = document.querySelectorAll('#mockModeStage .mock-mode-card');
      if (mockCards && mockCards.length >= 3) {
        const modes = currentModeSelectScreen.modes || DEFAULT_MODE_SELECT_SCREEN.modes;
        mockCards[0].innerText = modes.karei?.nameByLang?.[activeLang] || DEFAULT_MODE_SELECT_SCREEN.modes.karei.nameByLang[activeLang] || '🐟 カレイ派';
        mockCards[1].innerText = modes.hirame?.nameByLang?.[activeLang] || DEFAULT_MODE_SELECT_SCREEN.modes.hirame.nameByLang[activeLang] || '🦈 ヒラメ派';
        mockCards[2].innerText = modes.hirai?.nameByLang?.[activeLang] || DEFAULT_MODE_SELECT_SCREEN.modes.hirai.nameByLang[activeLang] || '⚖️ ヒライ派';
      }

      // クレジット表示モック連動
      const mockCredits = document.getElementById('mockTitleCredits');
      if (mockCredits) {
        const cr = currentTitleScreen.credits || { enabled: true, author: 'PIG STAR', year: '2026', fontSize: 11, fontFamily: "'M PLUS Rounded 1c', sans-serif", position: 'subtitle' };
        if (cr.enabled !== false && (cr.author || cr.year)) {
          mockCredits.innerText = `${cr.author || 'PIG STAR'} / ${cr.year || '2026'}`;
          mockCredits.style.display = 'block';
          mockCredits.style.fontSize = `${cr.fontSize || 11}px`;
          mockCredits.style.fontFamily = cr.fontFamily || "'M PLUS Rounded 1c', sans-serif";

          const mockOverlay = document.querySelector('#mockTitleStage .mock-modal-content');
          const mockBanner = document.querySelector('#mockTitleStage .mock-title-banner');
          const mockSub = document.getElementById('mockTitleSub');
          const mockLang = document.querySelector('#mockTitleStage .mock-lang-selector');

          if (mockOverlay) {
            mockCredits.remove();
            if (cr.position === 'header') {
              mockOverlay.insertBefore(mockCredits, mockOverlay.firstChild);
              mockCredits.style.margin = '0 0 10px 0';
            } else if (cr.position === 'above_lang' && mockLang) {
              mockOverlay.insertBefore(mockCredits, mockLang);
              mockCredits.style.margin = '10px 0 6px 0';
            } else if (cr.position === 'footer') {
              mockOverlay.appendChild(mockCredits);
              mockCredits.style.margin = '12px 0 0 0';
            } else {
              if (mockBanner && mockSub && mockSub.parentNode === mockBanner) {
                mockBanner.insertBefore(mockCredits, mockSub.nextSibling);
                mockCredits.style.margin = '4px 0 0 0';
              } else if (mockBanner) {
                mockBanner.appendChild(mockCredits);
                mockCredits.style.margin = '4px 0 0 0';
              } else {
                mockOverlay.appendChild(mockCredits);
              }
            }
          }
        } else {
          mockCredits.style.display = 'none';
        }
      }
    };

    // 多言語切り替えセレクター
    const tmLangPills = document.querySelectorAll('.tm-lang-pill');
    tmLangPills.forEach(pill => {
      pill.addEventListener('click', () => {
        flushCurrentInputsToState();
        tmLangPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        activeLang = pill.dataset.lang || 'ja';
        syncFormFromState();
        updateTitleModeMockup();
        try { sound.init(); sound.playTap(); } catch (e) { }
      });
    });

    // Adobe 3タブ切り替え (📐 整列と変形 / 🔤 文字／段落 / 🎨 アピアランス)
    const adobeTabNavBtns = document.querySelectorAll('.adobe-tab-nav-btn');
    const adobePanes = {
      transform: document.getElementById('adobePaneTransform'),
      typography: document.getElementById('adobePaneTypography'),
      appearance: document.getElementById('adobePaneAppearance')
    };

    adobeTabNavBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.dataset.adobetab;
        adobeTabNavBtns.forEach(b => b.classList.toggle('active', b === btn));
        Object.entries(adobePanes).forEach(([key, pane]) => {
          if (!pane) return;
          const isCurrent = key === targetTab;
          pane.classList.toggle('active', isCurrent);
          pane.classList.toggle('hidden', !isCurrent);
        });
        try { sound.init(); sound.playTap(); } catch (e) { }
      });
    });

    // DOM要素取得
    const btnTabTitleEdit = document.getElementById('btnTabTitleEdit');
    const btnTabModeEdit = document.getElementById('btnTabModeEdit');
    const sectionTitleEdit = document.getElementById('sectionTitleEdit');
    const sectionModeEdit = document.getElementById('sectionModeEdit');

    const btnTargetMainTitle = document.getElementById('btnTargetMainTitle');
    const btnTargetSubTitle = document.getElementById('btnTargetSubTitle');
    const tmTextContent = document.getElementById('tmTextContent');
    const tmTextCharCount = document.getElementById('tmTextCharCount');

    // 整列 & 変形
    const btnAdobeAligns = document.querySelectorAll('.btn-adobe-align');
    const tmPosX = document.getElementById('tmPosX');
    const tmPosY = document.getElementById('tmPosY');
    const tmScaleX = document.getElementById('tmScaleX');
    const tmScaleY = document.getElementById('tmScaleY');
    const btnLockAspect = document.getElementById('btnLockAspect');
    const tmRotation = document.getElementById('tmRotation');
    const tmOpacity = document.getElementById('tmOpacity');
    const tmOpacityVal = document.getElementById('tmOpacityVal');

    // 文字・段落パネル
    const tmFontFamily = document.getElementById('tmFontFamily');
    const tmFontWeight = document.getElementById('tmFontWeight');
    const tmFontSize = document.getElementById('tmFontSize');
    const tmLineHeight = document.getElementById('tmLineHeight');
    const tmLetterSpacing = document.getElementById('tmLetterSpacing');
    const tmBaselineShift = document.getElementById('tmBaselineShift');
    const tmCharScaleY = document.getElementById('tmCharScaleY');
    const tmCharScaleX = document.getElementById('tmCharScaleX');

    // Fauxスタイルボタン
    const fauxButtons = {
      fauxBold: document.getElementById('btnFauxBold'),
      fauxItalic: document.getElementById('btnFauxItalic'),
      allCaps: document.getElementById('btnAllCaps'),
      smallCaps: document.getElementById('btnSmallCaps'),
      superscript: document.getElementById('btnSuperscript'),
      subscript: document.getElementById('btnSubscript'),
      underline: document.getElementById('btnUnderline'),
      strikethrough: document.getElementById('btnStrikethrough')
    };

    const btnPsAligns = document.querySelectorAll('.btn-ps-align');

    // アピアランス
    const tmFillEnabled = document.getElementById('tmFillEnabled');
    const btnFillTypeSolid = document.getElementById('btnFillTypeSolid');
    const btnFillTypeGrad = document.getElementById('btnFillTypeGrad');
    const fillSolidRow = document.getElementById('fillSolidRow');
    const fillGradRow = document.getElementById('fillGradRow');
    const tmFillColor = document.getElementById('tmFillColor');
    const tmFillColorHex = document.getElementById('tmFillColorHex');
    const tmGradStop1 = document.getElementById('tmGradStop1');
    const tmGradStop2 = document.getElementById('tmGradStop2');
    const tmGradStop3 = document.getElementById('tmGradStop3');
    const tmGradAngle = document.getElementById('tmGradAngle');
    const tmGradAngleVal = document.getElementById('tmGradAngleVal');

    const tmStrokeEnabled = document.getElementById('tmStrokeEnabled');
    const tmStrokeColor = document.getElementById('tmStrokeColor');
    const tmStrokeWidth = document.getElementById('tmStrokeWidth');
    const tmStrokeWidthVal = document.getElementById('tmStrokeWidthVal');

    const tmBgEnabled = document.getElementById('tmBgEnabled');
    const tmBgColor = document.getElementById('tmBgColor');
    const tmBgOpacity = document.getElementById('tmBgOpacity');
    const tmBgOpacityVal = document.getElementById('tmBgOpacityVal');
    const tmBgPaddingX = document.getElementById('tmBgPaddingX');
    const tmBgPaddingXVal = document.getElementById('tmBgPaddingXVal');
    const tmBgPaddingY = document.getElementById('tmBgPaddingY');
    const tmBgPaddingYVal = document.getElementById('tmBgPaddingYVal');
    const tmBgRadius = document.getElementById('tmBgRadius');
    const tmBgRadiusVal = document.getElementById('tmBgRadiusVal');

    const tmShadowEnabled = document.getElementById('tmShadowEnabled');
    const tmShadowColor = document.getElementById('tmShadowColor');
    const tmShadowOpacity = document.getElementById('tmShadowOpacity');
    const tmShadowOpacityVal = document.getElementById('tmShadowOpacityVal');
    const tmShadowAngle = document.getElementById('tmShadowAngle');
    const tmShadowAngleVal = document.getElementById('tmShadowAngleVal');
    const tmShadowDistance = document.getElementById('tmShadowDistance');
    const tmShadowDistanceVal = document.getElementById('tmShadowDistanceVal');
    const tmShadowBlur = document.getElementById('tmShadowBlur');
    const tmShadowBlurVal = document.getElementById('tmShadowBlurVal');


    // プレビュー更新 (多言語対応)
    updateTitleModeMockup = function () {
      if (mockTitleLogo && currentTitleScreen.mainTitle) {
        applyTextCustomStyles(mockTitleLogo, currentTitleScreen.mainTitle, activeLang);
      }
      if (mockTitleSub && currentTitleScreen.subTitle) {
        applyTextCustomStyles(mockTitleSub, currentTitleScreen.subTitle, activeLang);
      }
      if (mockMasterAvatarImg) {
        mockMasterAvatarImg.src = currentModeSelectScreen.masterAvatar || './images/BUTA_shokunin.png';
      }
      if (avatarThumbPreview) {
        avatarThumbPreview.src = currentModeSelectScreen.masterAvatar || './images/BUTA_shokunin.png';
      }
      if (mockMasterSpeech) {
        const speech = (currentModeSelectScreen.masterSpeechByLang && currentModeSelectScreen.masterSpeechByLang[activeLang] !== undefined && currentModeSelectScreen.masterSpeechByLang[activeLang] !== '')
          ? currentModeSelectScreen.masterSpeechByLang[activeLang]
          : (activeLang === 'ja' && currentModeSelectScreen.masterSpeech
            ? currentModeSelectScreen.masterSpeech
            : (DEFAULT_MODE_SELECT_SCREEN.masterSpeechByLang?.[activeLang] || ''));
        mockMasterSpeech.style.whiteSpace = 'pre-line';
        mockMasterSpeech.innerText = speech;
      }

      // モード選択画面のプレビューカード文言も選択言語に合わせてローカライズ表示
      const mockCards = document.querySelectorAll('#mockModeStage .mock-mode-card');
      if (mockCards && mockCards.length >= 3) {
        const modeLabels = {
          ja: ['🐟 カレイ派', '🦈 ヒラメ派', '⚖️ ヒライ派'],
          en: ['🐟 Karei Team', '🦈 Hirame Team', '⚖️ Hirai Team (Sort Both)'],
          ko: ['🐟 가자미파', '🦈 넙치파', '⚖️ 히라이파 (양쪽 선별)'],
          zh: ['🐟 鲽鱼派', '🦈 比目鱼派', '⚖️ 平井派 (双选大师)']
        };
        const labels = modeLabels[activeLang] || modeLabels.ja;
        mockCards[0].innerText = labels[0];
        mockCards[1].innerText = labels[1];
        mockCards[2].innerText = labels[2];
      }

      // クレジット表示モック連動
      const mockCredits = document.getElementById('mockTitleCredits');
      if (mockCredits) {
        const cr = currentTitleScreen.credits || { enabled: true, author: 'PIG STAR', year: '2026', fontSize: 11, fontFamily: "'M PLUS Rounded 1c', sans-serif", position: 'subtitle' };
        if (cr.enabled !== false && (cr.author || cr.year)) {
          mockCredits.innerText = `${cr.author || 'PIG STAR'} / ${cr.year || '2026'}`;
          mockCredits.style.display = 'block';
          mockCredits.style.fontSize = `${cr.fontSize || 11}px`;
          mockCredits.style.fontFamily = cr.fontFamily || "'M PLUS Rounded 1c', sans-serif";

          // レイアウト位置の反映 (header / subtitle / above_lang / footer)
          const mockOverlay = document.querySelector('#mockTitleStage .mock-modal-content');
          const mockBanner = document.querySelector('#mockTitleStage .mock-title-banner');
          const mockSub = document.getElementById('mockTitleSub');
          const pos = cr.position || 'subtitle';

          if (mockOverlay && mockBanner) {
            if (pos === 'header') {
              mockOverlay.insertBefore(mockCredits, mockBanner);
              mockCredits.style.marginTop = '0px';
              mockCredits.style.marginBottom = '8px';
            } else if (pos === 'above_lang' || pos === 'footer') {
              mockOverlay.appendChild(mockCredits);
              mockCredits.style.marginTop = pos === 'above_lang' ? '10px' : '12px';
              mockCredits.style.marginBottom = '2px';
            } else {
              // subtitle
              if (mockSub && mockSub.nextSibling) {
                mockBanner.insertBefore(mockCredits, mockSub.nextSibling);
              } else {
                mockBanner.appendChild(mockCredits);
              }
              mockCredits.style.marginTop = '4px';
              mockCredits.style.marginBottom = '0px';
            }
          }
        } else {
          mockCredits.style.display = 'none';
        }
      }
    };

    // フォーム同期
    function syncFormFromState() {
      const cr = currentTitleScreen.credits = currentTitleScreen.credits || { enabled: true, author: 'PIG STAR', year: '2026', fontSize: 11, fontFamily: "'M PLUS Rounded 1c', sans-serif", position: 'subtitle' };
      const authorInput = document.getElementById('tmCreditsAuthor');
      const yearInput = document.getElementById('tmCreditsYear');
      const enabledInput = document.getElementById('tmCreditsEnabled');
      const posSelect = document.getElementById('tmCreditsPosition');
      const fontSelect = document.getElementById('tmCreditsFontFamily');
      const fontSizeInput = document.getElementById('tmCreditsFontSize');
      const fontSizeRange = document.getElementById('tmCreditsFontSizeRange');

      if (authorInput) authorInput.value = cr.author || 'PIG STAR';
      if (yearInput) yearInput.value = cr.year || '2026';
      if (enabledInput) enabledInput.checked = cr.enabled !== false;
      if (posSelect) posSelect.value = cr.position || 'subtitle';
      if (fontSelect) fontSelect.value = cr.fontFamily || "'M PLUS Rounded 1c', sans-serif";
      if (fontSizeInput) fontSizeInput.value = cr.fontSize || 11;
      if (fontSizeRange) fontSizeRange.value = cr.fontSize || 11;

      const style = currentTitleScreen[activeTitleTarget];
      if (!style) return;

      if (!style.textByLang) {
        style.textByLang = { ja: style.text || '' };
      }
      const curText = (style.textByLang[activeLang] !== undefined && style.textByLang[activeLang] !== null)
        ? style.textByLang[activeLang]
        : (DEFAULT_TITLE_SCREEN[activeTitleTarget]?.textByLang?.[activeLang] || style.text || '');
      if (tmTextContent) {
        tmTextContent.value = curText;
        if (tmTextCharCount) tmTextCharCount.innerText = `${curText.length} 文字`;
      }

      if (tmPosX) tmPosX.value = style.posX || 0;
      if (tmPosY) tmPosY.value = style.posY || 0;
      if (tmScaleX) tmScaleX.value = style.scaleX || 100;
      if (tmScaleY) tmScaleY.value = style.scaleY || 100;
      if (tmRotation) tmRotation.value = style.rotation || 0;
      if (tmOpacity) {
        tmOpacity.value = style.opacity !== undefined ? style.opacity : 100;
        if (tmOpacityVal) tmOpacityVal.innerText = `${tmOpacity.value}%`;
      }

      if (tmFontFamily) tmFontFamily.value = style.fontFamily || "'M PLUS Rounded 1c', sans-serif";
      if (tmFontWeight) tmFontWeight.value = `${style.fontWeight || 700}`;
      if (tmFontSize) tmFontSize.value = style.fontSize || 36;
      if (tmLineHeight) tmLineHeight.value = style.lineHeight || 1.25;
      if (tmLetterSpacing) tmLetterSpacing.value = style.letterSpacing || 0;
      if (tmBaselineShift) tmBaselineShift.value = style.baselineShift || 0;
      if (tmCharScaleY) tmCharScaleY.value = style.scaleY || 100;
      if (tmCharScaleX) tmCharScaleX.value = style.scaleX || 100;

      // Faux buttons
      Object.entries(fauxButtons).forEach(([key, btn]) => {
        if (!btn) return;
        btn.classList.toggle('active', !!style[key]);
      });

      // Align buttons
      btnPsAligns.forEach(b => {
        b.classList.toggle('active', b.dataset.textalign === (style.textAlign || 'center'));
      });

      // Fill
      if (tmFillEnabled) tmFillEnabled.checked = style.fillEnabled !== false;
      const isGrad = style.fillType === 'gradient';
      if (btnFillTypeSolid) btnFillTypeSolid.classList.toggle('active', !isGrad);
      if (btnFillTypeGrad) btnFillTypeGrad.classList.toggle('active', isGrad);
      if (fillSolidRow) fillSolidRow.classList.toggle('hidden', isGrad);
      if (fillGradRow) fillGradRow.classList.toggle('hidden', !isGrad);

      if (tmFillColor) tmFillColor.value = style.fillColor || '#ffffff';
      if (tmFillColorHex) tmFillColorHex.innerText = tmFillColor.value;
      if (style.fillGradStops && style.fillGradStops.length >= 3) {
        if (tmGradStop1) tmGradStop1.value = style.fillGradStops[0].color || '#38bdf8';
        if (tmGradStop2) tmGradStop2.value = style.fillGradStops[1].color || '#facc15';
        if (tmGradStop3) tmGradStop3.value = style.fillGradStops[2].color || '#f43f5e';
      }
      if (tmGradAngle) {
        tmGradAngle.value = style.fillGradAngle || 135;
        if (tmGradAngleVal) tmGradAngleVal.innerText = `${tmGradAngle.value}°`;
      }

      // Stroke
      if (tmStrokeEnabled) tmStrokeEnabled.checked = !!style.strokeEnabled;
      if (tmStrokeColor) tmStrokeColor.value = style.strokeColor || '#000000';
      if (tmStrokeWidth) {
        tmStrokeWidth.value = style.strokeWidth || 4;
        if (tmStrokeWidthVal) tmStrokeWidthVal.innerText = `${tmStrokeWidth.value} px`;
      }

      // Background
      if (tmBgEnabled) tmBgEnabled.checked = !!style.bgEnabled;
      if (tmBgColor) tmBgColor.value = style.bgColor || '#0f172a';
      if (tmBgOpacity) {
        tmBgOpacity.value = style.bgOpacity !== undefined ? style.bgOpacity : 80;
        if (tmBgOpacityVal) tmBgOpacityVal.innerText = `${tmBgOpacity.value} %`;
      }
      if (tmBgPaddingX) {
        tmBgPaddingX.value = style.bgPaddingX || 16;
        if (tmBgPaddingXVal) tmBgPaddingXVal.innerText = `${tmBgPaddingX.value} px`;
      }
      if (tmBgPaddingY) {
        tmBgPaddingY.value = style.bgPaddingY || 8;
        if (tmBgPaddingYVal) tmBgPaddingYVal.innerText = `${tmBgPaddingY.value} px`;
      }
      if (tmBgRadius) {
        tmBgRadius.value = style.bgRadius || 12;
        if (tmBgRadiusVal) tmBgRadiusVal.innerText = `${tmBgRadius.value} px`;
      }

      // Shadow
      if (tmShadowEnabled) tmShadowEnabled.checked = !!style.shadowEnabled;
      if (tmShadowColor) tmShadowColor.value = style.shadowColor || '#000000';
      if (tmShadowOpacity) {
        tmShadowOpacity.value = style.shadowOpacity !== undefined ? style.shadowOpacity : 50;
        if (tmShadowOpacityVal) tmShadowOpacityVal.innerText = `${tmShadowOpacity.value} %`;
      }
      if (tmShadowAngle) {
        tmShadowAngle.value = style.shadowAngle || 135;
        if (tmShadowAngleVal) tmShadowAngleVal.innerText = `${tmShadowAngle.value}°`;
      }
      if (tmShadowDistance) {
        tmShadowDistance.value = style.shadowDistance || 4;
        if (tmShadowDistanceVal) tmShadowDistanceVal.innerText = `${tmShadowDistance.value} px`;
      }
      if (tmShadowBlur) {
        tmShadowBlur.value = style.shadowBlur || 12;
        if (tmShadowBlurVal) tmShadowBlurVal.innerText = `${tmShadowBlur.value} px`;
      }

      // Mode Select controls
      if (tmAvatarPathInput) tmAvatarPathInput.value = currentModeSelectScreen.masterAvatar || './images/BUTA_shokunin.png';
      if (avatarThumbPreview) avatarThumbPreview.src = currentModeSelectScreen.masterAvatar || './images/BUTA_shokunin.png';
      if (tmMasterSpeechText) {
        const speech = (currentModeSelectScreen.masterSpeechByLang && currentModeSelectScreen.masterSpeechByLang[activeLang] !== undefined && currentModeSelectScreen.masterSpeechByLang[activeLang] !== '')
          ? currentModeSelectScreen.masterSpeechByLang[activeLang]
          : (activeLang === 'ja' && currentModeSelectScreen.masterSpeech
            ? currentModeSelectScreen.masterSpeech
            : (DEFAULT_MODE_SELECT_SCREEN.masterSpeechByLang?.[activeLang] || ''));
        tmMasterSpeechText.value = speech;
        if (tmMasterSpeechCount) tmMasterSpeechCount.innerText = `${tmMasterSpeechText.value.length} 文字`;
      }

      // 派閥モード名称＆説明文 (現在の言語別)
      const modes = currentModeSelectScreen.modes || DEFAULT_MODE_SELECT_SCREEN.modes;
      if (tmModeKareiName) tmModeKareiName.value = modes.karei?.nameByLang?.[activeLang] || DEFAULT_MODE_SELECT_SCREEN.modes.karei.nameByLang[activeLang] || '';
      if (tmModeKareiDesc) tmModeKareiDesc.value = modes.karei?.descByLang?.[activeLang] || DEFAULT_MODE_SELECT_SCREEN.modes.karei.descByLang[activeLang] || '';
      if (tmModeHirameName) tmModeHirameName.value = modes.hirame?.nameByLang?.[activeLang] || DEFAULT_MODE_SELECT_SCREEN.modes.hirame.nameByLang[activeLang] || '';
      if (tmModeHirameDesc) tmModeHirameDesc.value = modes.hirame?.descByLang?.[activeLang] || DEFAULT_MODE_SELECT_SCREEN.modes.hirame.descByLang[activeLang] || '';
      if (tmModeHiraiName) tmModeHiraiName.value = modes.hirai?.nameByLang?.[activeLang] || DEFAULT_MODE_SELECT_SCREEN.modes.hirai.nameByLang[activeLang] || '';
      if (tmModeHiraiDesc) tmModeHiraiDesc.value = modes.hirai?.descByLang?.[activeLang] || DEFAULT_MODE_SELECT_SCREEN.modes.hirai.descByLang[activeLang] || '';

      updateTitleModeMockup();
    }

    // 保存＆ブロードキャスト送信 (非同期・ノンブロッキング即時反映)
    function saveTitleModeConfig(notify = true) {
      flushCurrentInputsToState();
      currentConfig.titleScreen = JSON.parse(JSON.stringify(currentTitleScreen));
      currentConfig.modeSelectScreen = JSON.parse(JSON.stringify(currentModeSelectScreen));
      currentConfig.updatedAt = Date.now();
      localStorage.setItem('hirame_dev_config', JSON.stringify(currentConfig));

      if (adminChannel) {
        try {
          adminChannel.postMessage({
            type: 'UPDATE_DEV_CONFIG',
            config: currentConfig,
            timestamp: Date.now()
          });
        } catch (e) {
          console.warn("Broadcast failed", e);
        }
      }

      if (notify) {
        try {
          sound.init();
          sound.playChime();
        } catch (e) { }

        const syncBadge = document.getElementById('syncStatusBadge');
        if (syncBadge) {
          syncBadge.innerText = '⚡ タイトル＆モード設定をゲーム本体に即時反映！';
          syncBadge.style.color = '#38bdf8';
          setTimeout(() => {
            syncBadge.innerText = '⚡ 接続アクティブ';
            syncBadge.style.color = '#10b981';
          }, 3000);
        }

        if (btnSaveTitleMode) {
          const origText = btnSaveTitleMode.innerHTML;
          btnSaveTitleMode.style.transition = 'all 0.25s ease';
          btnSaveTitleMode.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
          btnSaveTitleMode.innerHTML = '<span>✅</span> タイトル＆モード設定をゲーム本体に即時反映しました！';
          setTimeout(() => {
            btnSaveTitleMode.innerHTML = origText;
            btnSaveTitleMode.style.background = '';
          }, 2500);
        }
      }
    }

    // タブ切替 (タイトル vs モード画面)
    if (btnTabTitleEdit && btnTabModeEdit) {
      btnTabTitleEdit.addEventListener('click', () => {
        flushCurrentInputsToState();
        btnTabTitleEdit.classList.add('active');
        btnTabModeEdit.classList.remove('active');
        sectionTitleEdit.classList.add('active');
        sectionTitleEdit.classList.remove('hidden');
        sectionModeEdit.classList.remove('active');
        sectionModeEdit.classList.add('hidden');
        if (btnPreviewTitleScreen) btnPreviewTitleScreen.click();
        try { sound.init(); sound.playTap(); } catch (e) { }
      });
      btnTabModeEdit.addEventListener('click', () => {
        flushCurrentInputsToState();
        btnTabModeEdit.classList.add('active');
        btnTabTitleEdit.classList.remove('active');
        sectionModeEdit.classList.add('active');
        sectionModeEdit.classList.remove('hidden');
        sectionTitleEdit.classList.remove('active');
        sectionTitleEdit.classList.add('hidden');
        if (btnPreviewModeScreen) btnPreviewModeScreen.click();
        try { sound.init(); sound.playTap(); } catch (e) { }
      });
    }

    // プレビューモック切替
    if (btnPreviewTitleScreen && btnPreviewModeScreen) {
      btnPreviewTitleScreen.addEventListener('click', () => {
        btnPreviewTitleScreen.classList.add('active');
        btnPreviewModeScreen.classList.remove('active');
        mockTitleStage.classList.remove('hidden');
        mockModeStage.classList.add('hidden');
      });
      btnPreviewModeScreen.addEventListener('click', () => {
        btnPreviewModeScreen.classList.add('active');
        btnPreviewTitleScreen.classList.remove('active');
        mockModeStage.classList.remove('hidden');
        mockTitleStage.classList.add('hidden');
      });
    }

    // 編集対象テキスト切替 (メインタイトル vs サブタイトル)
    if (btnTargetMainTitle && btnTargetSubTitle) {
      btnTargetMainTitle.addEventListener('click', () => {
        flushCurrentInputsToState();
        activeTitleTarget = 'mainTitle';
        btnTargetMainTitle.classList.add('active');
        btnTargetSubTitle.classList.remove('active');
        syncFormFromState();
        try { sound.init(); sound.playTap(); } catch (e) { }
      });
      btnTargetSubTitle.addEventListener('click', () => {
        flushCurrentInputsToState();
        activeTitleTarget = 'subTitle';
        btnTargetSubTitle.classList.add('active');
        btnTargetMainTitle.classList.remove('active');
        syncFormFromState();
        try { sound.init(); sound.playTap(); } catch (e) { }
      });
    }

    // テキスト入力 (多言語対応)
    if (tmTextContent) {
      tmTextContent.addEventListener('input', () => {
        const val = tmTextContent.value;
        const style = currentTitleScreen[activeTitleTarget];
        if (!style.textByLang) style.textByLang = {};
        style.textByLang[activeLang] = val;
        if (activeLang === 'ja') {
          style.text = val;
        }
        if (tmTextCharCount) tmTextCharCount.innerText = `${val.length} 文字`;
        updateTitleModeMockup();
      });
    }

    // 開発元クレジット入力リスナー
    const authorInput = document.getElementById('tmCreditsAuthor');
    const yearInput = document.getElementById('tmCreditsYear');
    const enabledInput = document.getElementById('tmCreditsEnabled');
    const posSelect = document.getElementById('tmCreditsPosition');
    const fontSelect = document.getElementById('tmCreditsFontFamily');
    const fontSizeInput = document.getElementById('tmCreditsFontSize');
    const fontSizeRange = document.getElementById('tmCreditsFontSizeRange');

    authorInput?.addEventListener('input', () => {
      currentTitleScreen.credits = currentTitleScreen.credits || {};
      currentTitleScreen.credits.author = authorInput.value;
      updateTitleModeMockup();
    });
    yearInput?.addEventListener('input', () => {
      currentTitleScreen.credits = currentTitleScreen.credits || {};
      currentTitleScreen.credits.year = yearInput.value;
      updateTitleModeMockup();
    });
    enabledInput?.addEventListener('change', () => {
      currentTitleScreen.credits = currentTitleScreen.credits || {};
      currentTitleScreen.credits.enabled = enabledInput.checked;
      updateTitleModeMockup();
    });
    posSelect?.addEventListener('change', () => {
      currentTitleScreen.credits = currentTitleScreen.credits || {};
      currentTitleScreen.credits.position = posSelect.value;
      updateTitleModeMockup();
    });
    fontSelect?.addEventListener('change', () => {
      currentTitleScreen.credits = currentTitleScreen.credits || {};
      currentTitleScreen.credits.fontFamily = fontSelect.value;
      updateTitleModeMockup();
    });
    fontSizeInput?.addEventListener('input', () => {
      const val = Math.max(9, Math.min(24, parseInt(fontSizeInput.value, 10) || 11));
      currentTitleScreen.credits = currentTitleScreen.credits || {};
      currentTitleScreen.credits.fontSize = val;
      if (fontSizeRange) fontSizeRange.value = val;
      updateTitleModeMockup();
    });
    fontSizeRange?.addEventListener('input', () => {
      const val = parseInt(fontSizeRange.value, 10) || 11;
      currentTitleScreen.credits = currentTitleScreen.credits || {};
      currentTitleScreen.credits.fontSize = val;
      if (fontSizeInput) fontSizeInput.value = val;
      updateTitleModeMockup();
    });

    // 整列ボタン (Premiere Pro風)
    btnAdobeAligns.forEach(btn => {
      btn.addEventListener('click', () => {
        const align = btn.dataset.align;
        const style = currentTitleScreen[activeTitleTarget];
        if (align === 'left') { style.textAlign = 'left'; style.posX = -40; }
        else if (align === 'center') { style.textAlign = 'center'; style.posX = 0; }
        else if (align === 'right') { style.textAlign = 'right'; style.posX = 40; }
        else if (align === 'top') { style.posY = -30; }
        else if (align === 'middle') { style.posY = 0; }
        else if (align === 'bottom') { style.posY = 30; }
        syncFormFromState();
      });
    });

    // 変形フィールド
    if (tmPosX) {
      tmPosX.addEventListener('input', () => {
        currentTitleScreen[activeTitleTarget].posX = parseFloat(tmPosX.value) || 0;
        updateTitleModeMockup();
      });
    }
    if (tmPosY) {
      tmPosY.addEventListener('input', () => {
        currentTitleScreen[activeTitleTarget].posY = parseFloat(tmPosY.value) || 0;
        updateTitleModeMockup();
      });
    }
    if (tmScaleX) {
      tmScaleX.addEventListener('input', () => {
        const val = parseFloat(tmScaleX.value) || 100;
        currentTitleScreen[activeTitleTarget].scaleX = val;
        if (isAspectLocked) {
          currentTitleScreen[activeTitleTarget].scaleY = val;
          if (tmScaleY) tmScaleY.value = val;
        }
        updateTitleModeMockup();
      });
    }
    if (tmScaleY) {
      tmScaleY.addEventListener('input', () => {
        const val = parseFloat(tmScaleY.value) || 100;
        currentTitleScreen[activeTitleTarget].scaleY = val;
        if (isAspectLocked) {
          currentTitleScreen[activeTitleTarget].scaleX = val;
          if (tmScaleX) tmScaleX.value = val;
        }
        updateTitleModeMockup();
      });
    }
    if (btnLockAspect) {
      btnLockAspect.addEventListener('click', () => {
        isAspectLocked = !isAspectLocked;
        btnLockAspect.classList.toggle('active', isAspectLocked);
      });
    }
    if (tmRotation) {
      tmRotation.addEventListener('input', () => {
        currentTitleScreen[activeTitleTarget].rotation = parseFloat(tmRotation.value) || 0;
        updateTitleModeMockup();
      });
    }
    if (tmOpacity) {
      tmOpacity.addEventListener('input', () => {
        const val = parseFloat(tmOpacity.value);
        currentTitleScreen[activeTitleTarget].opacity = val;
        if (tmOpacityVal) tmOpacityVal.innerText = `${val}%`;
        updateTitleModeMockup();
      });
    }

    // 文字パネル
    if (tmFontFamily) {
      tmFontFamily.addEventListener('change', () => {
        currentTitleScreen[activeTitleTarget].fontFamily = tmFontFamily.value;
        updateTitleModeMockup();
      });
    }
    if (tmFontWeight) {
      tmFontWeight.addEventListener('change', () => {
        currentTitleScreen[activeTitleTarget].fontWeight = tmFontWeight.value;
        updateTitleModeMockup();
      });
    }
    if (tmFontSize) {
      tmFontSize.addEventListener('input', () => {
        currentTitleScreen[activeTitleTarget].fontSize = parseFloat(tmFontSize.value) || 36;
        updateTitleModeMockup();
      });
    }
    if (tmLineHeight) {
      tmLineHeight.addEventListener('input', () => {
        currentTitleScreen[activeTitleTarget].lineHeight = parseFloat(tmLineHeight.value) || 1.25;
        updateTitleModeMockup();
      });
    }
    if (tmLetterSpacing) {
      tmLetterSpacing.addEventListener('input', () => {
        currentTitleScreen[activeTitleTarget].letterSpacing = parseFloat(tmLetterSpacing.value) || 0;
        updateTitleModeMockup();
      });
    }
    if (tmBaselineShift) {
      tmBaselineShift.addEventListener('input', () => {
        currentTitleScreen[activeTitleTarget].baselineShift = parseFloat(tmBaselineShift.value) || 0;
        updateTitleModeMockup();
      });
    }
    if (tmCharScaleY) {
      tmCharScaleY.addEventListener('input', () => {
        const val = parseFloat(tmCharScaleY.value) || 100;
        currentTitleScreen[activeTitleTarget].scaleY = val;
        if (tmScaleY) tmScaleY.value = val;
        updateTitleModeMockup();
      });
    }
    if (tmCharScaleX) {
      tmCharScaleX.addEventListener('input', () => {
        const val = parseFloat(tmCharScaleX.value) || 100;
        currentTitleScreen[activeTitleTarget].scaleX = val;
        if (tmScaleX) tmScaleX.value = val;
        updateTitleModeMockup();
      });
    }

    // Fauxスタイルボタン
    Object.entries(fauxButtons).forEach(([key, btn]) => {
      if (!btn) return;
      btn.addEventListener('click', () => {
        const style = currentTitleScreen[activeTitleTarget];
        style[key] = !style[key];
        btn.classList.toggle('active', !!style[key]);
        updateTitleModeMockup();
      });
    });

    // 段落揃えボタン
    btnPsAligns.forEach(btn => {
      btn.addEventListener('click', () => {
        currentTitleScreen[activeTitleTarget].textAlign = btn.dataset.textalign;
        btnPsAligns.forEach(b => b.classList.toggle('active', b === btn));
        updateTitleModeMockup();
      });
    });

    // アピアランス: 塗り
    if (tmFillEnabled) {
      tmFillEnabled.addEventListener('change', () => {
        currentTitleScreen[activeTitleTarget].fillEnabled = tmFillEnabled.checked;
        updateTitleModeMockup();
      });
    }
    if (btnFillTypeSolid && btnFillTypeGrad) {
      btnFillTypeSolid.addEventListener('click', () => {
        currentTitleScreen[activeTitleTarget].fillType = 'solid';
        btnFillTypeSolid.classList.add('active');
        btnFillTypeGrad.classList.remove('active');
        fillSolidRow.classList.remove('hidden');
        fillGradRow.classList.add('hidden');
        updateTitleModeMockup();
      });
      btnFillTypeGrad.addEventListener('click', () => {
        currentTitleScreen[activeTitleTarget].fillType = 'gradient';
        btnFillTypeGrad.classList.add('active');
        btnFillTypeSolid.classList.remove('active');
        fillGradRow.classList.remove('hidden');
        fillSolidRow.classList.add('hidden');
        updateTitleModeMockup();
      });
    }
    if (tmFillColor) {
      tmFillColor.addEventListener('input', () => {
        currentTitleScreen[activeTitleTarget].fillColor = tmFillColor.value;
        if (tmFillColorHex) tmFillColorHex.innerText = tmFillColor.value;
        updateTitleModeMockup();
      });
    }
    if (tmGradStop1) {
      tmGradStop1.addEventListener('input', () => {
        currentTitleScreen[activeTitleTarget].fillGradStops[0].color = tmGradStop1.value;
        updateTitleModeMockup();
      });
    }
    if (tmGradStop2) {
      tmGradStop2.addEventListener('input', () => {
        currentTitleScreen[activeTitleTarget].fillGradStops[1].color = tmGradStop2.value;
        updateTitleModeMockup();
      });
    }
    if (tmGradStop3) {
      tmGradStop3.addEventListener('input', () => {
        currentTitleScreen[activeTitleTarget].fillGradStops[2].color = tmGradStop3.value;
        updateTitleModeMockup();
      });
    }
    if (tmGradAngle) {
      tmGradAngle.addEventListener('input', () => {
        const val = parseFloat(tmGradAngle.value) || 135;
        currentTitleScreen[activeTitleTarget].fillGradAngle = val;
        if (tmGradAngleVal) tmGradAngleVal.innerText = `${val}°`;
        updateTitleModeMockup();
      });
    }

    // アピアランス: 境界線
    if (tmStrokeEnabled) {
      tmStrokeEnabled.addEventListener('change', () => {
        currentTitleScreen[activeTitleTarget].strokeEnabled = tmStrokeEnabled.checked;
        updateTitleModeMockup();
      });
    }
    if (tmStrokeColor) {
      tmStrokeColor.addEventListener('input', () => {
        currentTitleScreen[activeTitleTarget].strokeColor = tmStrokeColor.value;
        updateTitleModeMockup();
      });
    }
    if (tmStrokeWidth) {
      tmStrokeWidth.addEventListener('input', () => {
        const val = parseFloat(tmStrokeWidth.value) || 4;
        currentTitleScreen[activeTitleTarget].strokeWidth = val;
        if (tmStrokeWidthVal) tmStrokeWidthVal.innerText = `${val} px`;
        updateTitleModeMockup();
      });
    }

    // アピアランス: 背景
    if (tmBgEnabled) {
      tmBgEnabled.addEventListener('change', () => {
        currentTitleScreen[activeTitleTarget].bgEnabled = tmBgEnabled.checked;
        updateTitleModeMockup();
      });
    }
    if (tmBgColor) {
      tmBgColor.addEventListener('input', () => {
        currentTitleScreen[activeTitleTarget].bgColor = tmBgColor.value;
        updateTitleModeMockup();
      });
    }
    if (tmBgOpacity) {
      tmBgOpacity.addEventListener('input', () => {
        const val = parseFloat(tmBgOpacity.value);
        currentTitleScreen[activeTitleTarget].bgOpacity = val;
        if (tmBgOpacityVal) tmBgOpacityVal.innerText = `${val} %`;
        updateTitleModeMockup();
      });
    }
    if (tmBgPaddingX) {
      tmBgPaddingX.addEventListener('input', () => {
        const val = parseFloat(tmBgPaddingX.value) || 0;
        currentTitleScreen[activeTitleTarget].bgPaddingX = val;
        if (tmBgPaddingXVal) tmBgPaddingXVal.innerText = `${val} px`;
        updateTitleModeMockup();
      });
    }
    if (tmBgPaddingY) {
      tmBgPaddingY.addEventListener('input', () => {
        const val = parseFloat(tmBgPaddingY.value) || 0;
        currentTitleScreen[activeTitleTarget].bgPaddingY = val;
        if (tmBgPaddingYVal) tmBgPaddingYVal.innerText = `${val} px`;
        updateTitleModeMockup();
      });
    }
    if (tmBgRadius) {
      tmBgRadius.addEventListener('input', () => {
        const val = parseFloat(tmBgRadius.value) || 0;
        currentTitleScreen[activeTitleTarget].bgRadius = val;
        if (tmBgRadiusVal) tmBgRadiusVal.innerText = `${val} px`;
        updateTitleModeMockup();
      });
    }

    // アピアランス: シャドウ
    if (tmShadowEnabled) {
      tmShadowEnabled.addEventListener('change', () => {
        currentTitleScreen[activeTitleTarget].shadowEnabled = tmShadowEnabled.checked;
        updateTitleModeMockup();
      });
    }
    if (tmShadowColor) {
      tmShadowColor.addEventListener('input', () => {
        currentTitleScreen[activeTitleTarget].shadowColor = tmShadowColor.value;
        updateTitleModeMockup();
      });
    }
    if (tmShadowOpacity) {
      tmShadowOpacity.addEventListener('input', () => {
        const val = parseFloat(tmShadowOpacity.value);
        currentTitleScreen[activeTitleTarget].shadowOpacity = val;
        if (tmShadowOpacityVal) tmShadowOpacityVal.innerText = `${val} %`;
        updateTitleModeMockup();
      });
    }
    if (tmShadowAngle) {
      tmShadowAngle.addEventListener('input', () => {
        const val = parseFloat(tmShadowAngle.value) || 135;
        currentTitleScreen[activeTitleTarget].shadowAngle = val;
        if (tmShadowAngleVal) tmShadowAngleVal.innerText = `${val}°`;
        updateTitleModeMockup();
      });
    }
    if (tmShadowDistance) {
      tmShadowDistance.addEventListener('input', () => {
        const val = parseFloat(tmShadowDistance.value) || 4;
        currentTitleScreen[activeTitleTarget].shadowDistance = val;
        if (tmShadowDistanceVal) tmShadowDistanceVal.innerText = `${val} px`;
        updateTitleModeMockup();
      });
    }
    if (tmShadowBlur) {
      tmShadowBlur.addEventListener('input', () => {
        const val = parseFloat(tmShadowBlur.value) || 12;
        currentTitleScreen[activeTitleTarget].shadowBlur = val;
        if (tmShadowBlurVal) tmShadowBlurVal.innerText = `${val} px`;
        updateTitleModeMockup();
      });
    }

    // モード選択画面: アイコン画像ファイルアップロード
    if (tmAvatarFileInput) {
      tmAvatarFileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          const dataUrl = evt.target.result;
          currentModeSelectScreen.masterAvatar = dataUrl;
          if (tmAvatarPathInput) tmAvatarPathInput.value = 'アップロード画像 (DataURL)';
          if (avatarThumbPreview) avatarThumbPreview.src = dataUrl;
          if (mockMasterAvatarImg) mockMasterAvatarImg.src = dataUrl;
        };
        reader.readAsDataURL(file);
      });
    }

    // 画像パス手入力
    if (tmAvatarPathInput) {
      tmAvatarPathInput.addEventListener('input', () => {
        currentModeSelectScreen.masterAvatar = tmAvatarPathInput.value.trim() || './images/BUTA_shokunin.png';
        if (avatarThumbPreview) avatarThumbPreview.src = currentModeSelectScreen.masterAvatar;
        if (mockMasterAvatarImg) mockMasterAvatarImg.src = currentModeSelectScreen.masterAvatar;
      });
    }

    // BUTA職人画像リセットボタン
    if (btnResetBUTAAvatar) {
      btnResetBUTAAvatar.addEventListener('click', () => {
        currentModeSelectScreen.masterAvatar = './images/BUTA_shokunin.png';
        if (tmAvatarPathInput) tmAvatarPathInput.value = './images/BUTA_shokunin.png';
        if (avatarThumbPreview) avatarThumbPreview.src = './images/BUTA_shokunin.png';
        if (mockMasterAvatarImg) mockMasterAvatarImg.src = './images/BUTA_shokunin.png';
      });
    }

    // セリフ文言入力 (多言語対応)
    if (tmMasterSpeechText) {
      tmMasterSpeechText.addEventListener('input', () => {
        const val = tmMasterSpeechText.value;
        if (!currentModeSelectScreen.masterSpeechByLang) currentModeSelectScreen.masterSpeechByLang = {};
        currentModeSelectScreen.masterSpeechByLang[activeLang] = val;
        if (activeLang === 'ja') {
          currentModeSelectScreen.masterSpeech = val;
        }
        if (tmMasterSpeechCount) tmMasterSpeechCount.innerText = `${val.length} 文字`;
        if (mockMasterSpeech) {
          mockMasterSpeech.style.whiteSpace = 'pre-line';
          mockMasterSpeech.innerText = val;
        }
      });
    }

    // セリフ初期化ボタン (多言語デフォルト復元)
    if (btnResetMasterSpeech) {
      btnResetMasterSpeech.addEventListener('click', () => {
        currentModeSelectScreen.masterSpeech = DEFAULT_MODE_SELECT_SCREEN.masterSpeech;
        currentModeSelectScreen.masterSpeechByLang = JSON.parse(JSON.stringify(DEFAULT_MODE_SELECT_SCREEN.masterSpeechByLang));
        const defSpeech = currentModeSelectScreen.masterSpeechByLang[activeLang] || currentModeSelectScreen.masterSpeech;
        if (tmMasterSpeechText) tmMasterSpeechText.value = defSpeech;
        if (tmMasterSpeechCount) tmMasterSpeechCount.innerText = `${defSpeech.length} 文字`;
        if (mockMasterSpeech) {
          mockMasterSpeech.style.whiteSpace = 'pre-line';
          mockMasterSpeech.innerText = defSpeech;
        }
        try { sound.init(); sound.playTap(); } catch (e) { }
      });
    }

    // 保存＆即時反映ボタン
    if (btnSaveTitleMode) {
      btnSaveTitleMode.addEventListener('click', () => {
        saveTitleModeConfig(true);
      });
    }
    if (btnQuickSyncTitleMode) {
      btnQuickSyncTitleMode.addEventListener('click', () => {
        saveTitleModeConfig(true);
      });
    }

    // 初期状態にリセットボタン
    if (btnResetTitleMode) {
      btnResetTitleMode.addEventListener('click', () => {
        if (!confirm('タイトル画面とモード選択画面のスタイル・文言・アイコンを初期状態にリセットしますか？')) return;
        currentTitleScreen = JSON.parse(JSON.stringify(DEFAULT_TITLE_SCREEN));
        currentModeSelectScreen = JSON.parse(JSON.stringify(DEFAULT_MODE_SELECT_SCREEN));
        syncFormFromState();
        saveTitleModeConfig(true);
      });
    }

    // 派閥名称＆説明文入力イベント
    [tmModeKareiName, tmModeKareiDesc, tmModeHirameName, tmModeHirameDesc, tmModeHiraiName, tmModeHiraiDesc].forEach(el => {
      el?.addEventListener('input', () => {
        flushCurrentInputsToState();
        updateTitleModeMockup();
      });
    });

    if (btnResetModeFactionNames) {
      btnResetModeFactionNames.addEventListener('click', () => {
        try { sound.init(); sound.playTap(); } catch (e) { }
        if (!currentModeSelectScreen.modes) {
          currentModeSelectScreen.modes = JSON.parse(JSON.stringify(DEFAULT_MODE_SELECT_SCREEN.modes));
        }
        ['karei', 'hirame', 'hirai'].forEach(modeKey => {
          const def = DEFAULT_MODE_SELECT_SCREEN.modes[modeKey];
          currentModeSelectScreen.modes[modeKey].nameByLang[activeLang] = def.nameByLang[activeLang] || def.name;
          currentModeSelectScreen.modes[modeKey].descByLang[activeLang] = def.descByLang[activeLang] || def.desc;
        });
        syncFormFromState();
        updateTitleModeMockup();
      });
    }

    // 初回初期化
    syncFormFromState();
  }

  // タイトル＆モード画面エディタ初期化起動
  initTitleModeEditor();

  // ===== 🏆 ランキング管理 ＆ ユーザー審査モデレーション =====
  function initRankingModeration() {
    const DEFAULT_LEADERBOARD_ENTRIES = [
      { id: '#4829', name: '華麗なる名無し', score: 3820, mode: 'karei', title: '伝説の海神', timestamp: '2026-10-18 16:42', period: 'daily' },
      { id: '#1042', name: 'ひらめマスター', score: 3450, mode: 'hirame', title: '深海の覇者', timestamp: '2026-10-18 15:30', period: 'daily' },
      { id: '#9931', name: '悪質BOT_xxx', score: 99990, mode: 'hirai', title: 'チート疑い', timestamp: '2026-10-18 14:15', period: 'daily' },
      { id: '#2204', name: 'さかなクンリスペクト', score: 2980, mode: 'karei', title: '魚類博士', timestamp: '2026-10-17 12:20', period: 'weekly' },
      { id: '#5512', name: 'ぶーちゃん推し', score: 2410, mode: 'hirame', title: '板前見習い', timestamp: '2026-10-16 10:05', period: 'weekly' },
      { id: '#7734', name: '荒らしユーザー#NG', score: 88880, mode: 'karei', title: '不審者', timestamp: '2026-10-15 09:12', period: 'monthly' },
      { id: '#3319', name: 'ヒライの中立派', score: 2150, mode: 'hirai', title: '中立の審判者', timestamp: '2026-10-12 22:50', period: 'monthly' },
      { id: '#8841', name: '波乗りヒラメ', score: 1890, mode: 'hirame', title: '新米釣り名人', timestamp: '2026-10-05 19:10', period: 'yearly' }
    ];

    const adminRankingTableBody = document.getElementById('adminRankingTableBody');
    const adminRankingSearchInput = document.getElementById('adminRankingSearchInput');
    const chkSelectAllRanking = document.getElementById('chkSelectAllRanking');
    const btnBatchDeleteRanking = document.getElementById('btnBatchDeleteRanking');
    const btnBatchToggleBlockRanking = document.getElementById('btnBatchToggleBlockRanking');
    const btnResetMockLeaderboard = document.getElementById('btnResetMockLeaderboard');
    const rankingTotalCount = document.getElementById('rankingTotalCount');
    const rankingBlockedCount = document.getElementById('rankingBlockedCount');
    const periodPills = document.querySelectorAll('#adminRankingPeriodPills .btn-micro');

    // 編集モーダル要素
    const editModal = document.getElementById('adminRankingEditModal');
    const editUserId = document.getElementById('rankingEditUserId');
    const editPlayerName = document.getElementById('rankingEditPlayerName');
    const editScore = document.getElementById('rankingEditScore');
    const btnEditSave = document.getElementById('btnRankingEditSave');
    const btnEditCancel = document.getElementById('btnRankingEditCancel');
    const btnEditClose = document.getElementById('btnRankingEditClose');

    let currentPeriod = 'all';
    let currentMode = 'all';
    let searchQuery = '';
    let editingIndex = -1;

    const modePills = document.querySelectorAll('#adminRankingModePills .btn-micro');
    modePills.forEach(btn => {
      btn.addEventListener('click', () => {
        try { sound.init(); sound.playTap(); } catch (e) { }
        currentMode = btn.dataset.mode;
        modePills.forEach(b => b.classList.toggle('active', b === btn));
        renderRankingTable();
      });
    });

    function getStoredLeaderboard() {
      try {
        const raw = localStorage.getItem('hirame_leaderboard');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) { }
      // 初期データ設定
      localStorage.setItem('hirame_leaderboard', JSON.stringify(DEFAULT_LEADERBOARD_ENTRIES));
      return JSON.parse(JSON.stringify(DEFAULT_LEADERBOARD_ENTRIES));
    }

    function saveStoredLeaderboard(data) {
      localStorage.setItem('hirame_leaderboard', JSON.stringify(data));
      if (adminChannel) {
        try {
          adminChannel.postMessage({ type: 'UPDATE_LEADERBOARD', leaderboard: data });
        } catch (e) { }
      }
    }

    function getBlockedUserIds() {
      try {
        const raw = localStorage.getItem('hirame_blocked_users');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (e) { }
      const defBlocked = ['#9931'];
      localStorage.setItem('hirame_blocked_users', JSON.stringify(defBlocked));
      return defBlocked;
    }

    function saveBlockedUserIds(arr) {
      localStorage.setItem('hirame_blocked_users', JSON.stringify(arr));
      if (adminChannel) {
        try {
          adminChannel.postMessage({ type: 'UPDATE_BLOCKED_USERS', blockedUsers: arr });
        } catch (e) { }
      }
    }

    function renderRankingTable() {
      if (!adminRankingTableBody) return;
      const allEntries = getStoredLeaderboard();
      const blockedIds = getBlockedUserIds();

      // ソート: スコア降順
      allEntries.sort((a, b) => (b.score || 0) - (a.score || 0));

      // 絞り込み
      const filtered = allEntries.filter(entry => {
        if (currentPeriod !== 'all' && entry.period && entry.period !== currentPeriod) {
          return false;
        }
        if (currentMode !== 'all' && entry.mode && entry.mode !== currentMode) {
          return false;
        }
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const matchName = (entry.name || '').toLowerCase().includes(q);
          const matchId = (entry.id || '').toLowerCase().includes(q);
          const matchTitle = (entry.title || '').toLowerCase().includes(q);
          if (!matchName && !matchId && !matchTitle) return false;
        }
        return true;
      });

      // カウンター更新
      if (rankingTotalCount) rankingTotalCount.innerText = allEntries.length;
      if (rankingBlockedCount) {
        const totalBlocked = allEntries.filter(e => blockedIds.includes(e.id)).length;
        rankingBlockedCount.innerText = totalBlocked;
      }

      if (filtered.length === 0) {
        adminRankingTableBody.innerHTML = `
          <tr>
            <td colspan="10" style="text-align:center; padding:36px; color:#94a3b8;">
              🔍 条件に一致するランキングエントリーが見つかりません。
            </td>
          </tr>
        `;
        if (chkSelectAllRanking) chkSelectAllRanking.checked = false;
        return;
      }

      let html = '';
      filtered.forEach((entry, idx) => {
        const isBlocked = blockedIds.includes(entry.id);
        const factionMap = { karei: '🐟 カレイ派', hirame: '🦈 ヒラメ派', hirai: '⚖️ ヒライ派' };
        const factionLabel = factionMap[entry.mode] || entry.mode || 'ヒラメ派';

        html += `
          <tr data-id="${entry.id}">
            <td>
              <input type="checkbox" class="ranking-row-chk" data-id="${entry.id}">
            </td>
            <td style="font-weight:800; color:${idx < 3 ? '#facc15' : '#94a3b8'};">
              ${idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : idx + 1}
            </td>
            <td>
              <strong style="color:#f8fafc; font-size:14px;">${escapeHtml(entry.name || '名無し')}</strong>
              ${isBlocked ? '<span class="ranking-blocked-badge" style="margin-left:6px;">🚫 除外中</span>' : ''}
            </td>
            <td style="font-weight:800; color:#38bdf8; font-size:15px;">
              ${(entry.score || 0).toLocaleString()}
            </td>
            <td>
              <span class="val-pill" style="font-family:monospace; background:rgba(30,41,59,0.8);">${escapeHtml(entry.id || 'N/A')}</span>
            </td>
            <td>
              <span style="font-size:12px; color:#94a3b8;">${factionLabel}</span>
            </td>
            <td>
              <span style="font-size:12px; color:#facc15;">${escapeHtml(entry.title || '一般')}</span>
            </td>
            <td style="font-size:12px; color:#64748b;">
              ${escapeHtml(entry.timestamp || '2026-10-18')}
            </td>
            <td>
              ${isBlocked
            ? '<span class="ranking-blocked-badge">🚫 非表示</span>'
            : '<span class="ranking-active-badge">✅ 公開中</span>'}
            </td>
            <td>
              <div class="ranking-action-group">
                <button type="button" class="btn-ranking-action btn-ranking-edit" data-id="${entry.id}" title="名前やスコアを修正">
                  ✏️ 編集
                </button>
                <button type="button" class="btn-ranking-action ${isBlocked ? 'btn-ranking-unblock' : 'btn-ranking-block'}" data-id="${entry.id}" title="${isBlocked ? 'ランキング除外を解除' : 'ランキング非表示(ブロック)に指定'}">
                  ${isBlocked ? '⭕ 解除' : '🚫 ブロック'}
                </button>
                <button type="button" class="btn-ranking-action btn-ranking-delete" data-id="${entry.id}" title="エントリーを完全に削除">
                  🗑️
                </button>
              </div>
            </td>
          </tr>
        `;
      });

      adminRankingTableBody.innerHTML = html;
      if (chkSelectAllRanking) chkSelectAllRanking.checked = false;
    }

    function escapeHtml(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    // 検索入力
    adminRankingSearchInput?.addEventListener('input', () => {
      searchQuery = adminRankingSearchInput.value.trim();
      renderRankingTable();
    });

    // 期間切替ピル
    periodPills.forEach(pill => {
      pill.addEventListener('click', () => {
        periodPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentPeriod = pill.dataset.period || 'all';
        renderRankingTable();
        try { sound.init(); sound.playTap(); } catch (e) { }
      });
    });

    // 全選択チェックボックス
    chkSelectAllRanking?.addEventListener('change', () => {
      const chks = adminRankingTableBody?.querySelectorAll('.ranking-row-chk');
      chks?.forEach(c => c.checked = chkSelectAllRanking.checked);
    });

    // テーブル内イベント (編集 / ブロック切替 / 削除)
    adminRankingTableBody?.addEventListener('click', async (e) => {
      const editBtn = e.target.closest('.btn-ranking-edit');
      const blockBtn = e.target.closest('.btn-ranking-block, .btn-ranking-unblock');
      const deleteBtn = e.target.closest('.btn-ranking-delete');

      // 1. 編集
      if (editBtn) {
        const id = editBtn.dataset.id;
        const all = getStoredLeaderboard();
        const item = all.find(x => x.id === id);
        if (!item) return;

        editingIndex = all.findIndex(x => x.id === id);
        if (editUserId) editUserId.value = item.id;
        if (editPlayerName) editPlayerName.value = item.name || '';
        if (editScore) editScore.value = item.score || 0;
        if (editModal) editModal.classList.remove('hidden');
        try { sound.init(); sound.playTap(); } catch (err) { }
        return;
      }

      // 2. ブロック / 解除
      if (blockBtn) {
        const id = blockBtn.dataset.id;
        const blocked = getBlockedUserIds();
        const isCurrentlyBlocked = blocked.includes(id);

        if (isCurrentlyBlocked) {
          const next = blocked.filter(x => x !== id);
          saveBlockedUserIds(next);
        } else {
          blocked.push(id);
          saveBlockedUserIds(blocked);
        }

        renderRankingTable();
        try { sound.init(); sound.playTap(); } catch (err) { }
        return;
      }

      // 3. 単一削除
      if (deleteBtn) {
        const id = deleteBtn.dataset.id;
        const confirmed = await showAdminConfirm({
          title: 'エントリー削除の確認',
          message: `内部ID【${id}】のランキングデータを完全に削除しますか？\n※この操作は取り消せません。`,
          icon: '🗑️',
          confirmText: 'はい (削除する)',
          cancelText: 'いいえ (キャンセル)',
          isDanger: true
        });
        if (!confirmed) return;

        const all = getStoredLeaderboard();
        const next = all.filter(x => x.id !== id);
        saveStoredLeaderboard(next);
        renderRankingTable();
        try { sound.init(); sound.playSuccess(1); } catch (err) { }
        return;
      }
    });

    // 編集モーダル保存
    btnEditSave?.addEventListener('click', () => {
      if (editingIndex < 0) return;
      const all = getStoredLeaderboard();
      if (!all[editingIndex]) return;

      const newName = (editPlayerName?.value || '').trim() || '名無し';
      const newScore = Math.max(0, parseInt(editScore?.value, 10) || 0);

      all[editingIndex].name = newName;
      all[editingIndex].score = newScore;
      all[editingIndex].timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');

      saveStoredLeaderboard(all);
      if (editModal) editModal.classList.add('hidden');
      editingIndex = -1;
      renderRankingTable();
      try { sound.init(); sound.playSuccess(1); } catch (e) { }
    });

    const closeEdit = () => {
      if (editModal) editModal.classList.add('hidden');
      editingIndex = -1;
    };
    btnEditCancel?.addEventListener('click', closeEdit);
    btnEditClose?.addEventListener('click', closeEdit);

    // 一括削除
    btnBatchDeleteRanking?.addEventListener('click', async () => {
      const checkedBoxes = adminRankingTableBody?.querySelectorAll('.ranking-row-chk:checked');
      if (!checkedBoxes || checkedBoxes.length === 0) {
        alert('削除したいユーザーにチェックを入れてください。');
        return;
      }
      const idsToDelete = Array.from(checkedBoxes).map(c => c.dataset.id);

      const confirmed = await showAdminConfirm({
        title: '選択エントリー一括削除',
        message: `選択された ${idsToDelete.length} 件のランキングデータを一括削除しますか？\n対象ID: ${idsToDelete.join(', ')}`,
        icon: '🗑️',
        confirmText: 'はい (一括削除)',
        cancelText: 'いいえ (キャンセル)',
        isDanger: true
      });
      if (!confirmed) return;

      const all = getStoredLeaderboard();
      const next = all.filter(x => !idsToDelete.includes(x.id));
      saveStoredLeaderboard(next);
      renderRankingTable();
      try { sound.init(); sound.playSuccess(1); } catch (err) { }
    });

    // 一括ブロック / 解除
    btnBatchToggleBlockRanking?.addEventListener('click', async () => {
      const checkedBoxes = adminRankingTableBody?.querySelectorAll('.ranking-row-chk:checked');
      if (!checkedBoxes || checkedBoxes.length === 0) {
        alert('ブロック/解除したいユーザーにチェックを入れてください。');
        return;
      }
      const targetIds = Array.from(checkedBoxes).map(c => c.dataset.id);
      let blocked = getBlockedUserIds();

      const anyUnblocked = targetIds.some(id => !blocked.includes(id));
      if (anyUnblocked) {
        targetIds.forEach(id => {
          if (!blocked.includes(id)) blocked.push(id);
        });
      } else {
        blocked = blocked.filter(id => !targetIds.includes(id));
      }

      saveBlockedUserIds(blocked);
      renderRankingTable();
      try { sound.init(); sound.playSuccess(1); } catch (err) { }
    });

    // 初期モックデータ復元
    btnResetMockLeaderboard?.addEventListener('click', async () => {
      const confirmed = await showAdminConfirm({
        title: '初期データ復元の確認',
        message: 'ランキングデータを初期サンプルデータにリセットしますか？',
        icon: '🔄',
        confirmText: 'はい (復元する)',
        cancelText: 'いいえ (キャンセル)'
      });
      if (!confirmed) return;
      saveStoredLeaderboard(DEFAULT_LEADERBOARD_ENTRIES);
      saveBlockedUserIds(['#9931']);
      renderRankingTable();
      try { sound.init(); sound.playSuccess(2); } catch (err) { }
    });

    window.renderRankingManager = renderRankingTable;
    renderRankingTable();
  }

  // ランキング管理モデレーション初期化
  initRankingModeration();


  // ===== 🌐 オンライン世界ランキング (GAS) 連携機能 =====
  function initOnlineRankingGASIntegration() {
    const inputUrl = document.getElementById('adminOnlineRankingApiUrl');
    const btnSave = document.getElementById('btnSaveRankingApiUrl');
    const btnTest = document.getElementById('btnTestRankingApiUrl');
    const statusPing = document.getElementById('statusRankingApiPing');
    const btnMigrate = document.getElementById('btnMigrateLocalScoresNow');
    const lblUnsynced = document.getElementById('lblUnsyncedScoreCount');
    const msgMigration = document.getElementById('msgMigrationResult');
    const btnCopyGas = document.getElementById('btnCopyGasScript');

    if (!inputUrl) return;

    // 現在保存されているURLを復元
    const currentUrl = getOnlineRankingApiUrl();
    if (currentUrl) {
      inputUrl.value = currentUrl;
    }

    // 未同期スコア件数の表示更新
    function updateUnsyncedCount() {
      if (!lblUnsynced) return;
      try {
        const raw = localStorage.getItem('hirame_leaderboard');
        if (!raw) {
          lblUnsynced.innerText = '未同期スコア: 0 件';
          return;
        }
        const list = JSON.parse(raw);
        if (!Array.isArray(list)) {
          lblUnsynced.innerText = '未同期スコア: 0 件';
          return;
        }
        const count = list.filter(item => {
          const isMock = String(item.id || '').startsWith('mock_');
          const isDeleted = !!item.deleted;
          const isSynced = item.synced === true;
          return !isMock && !isDeleted && !isSynced && typeof item.score === 'number' && item.score > 0;
        }).length;
        lblUnsynced.innerHTML = '未同期スコア: <strong style="color:#c084fc;">' + count + '</strong> 件';
      } catch (e) {
        lblUnsynced.innerText = '未同期スコア: 0 件';
      }
    }
    updateUnsyncedCount();

    // 1. URL保存
    btnSave?.addEventListener('click', () => {
      try { sound.init(); sound.playTap(); } catch (e) {}
      const val = (inputUrl.value || '').trim();
      setOnlineRankingApiUrl(val);
      if (currentConfig) {
        currentConfig.onlineRankingApiUrl = val;
        saveCurrentConfigToStorage();
      }
      if (statusPing) {
        statusPing.innerHTML = '<span style="color:#22c55e; font-weight:700;">✅ URLを保存しました！</span>';
      }
    });

    // 2. 接続テスト (ping)
    btnTest?.addEventListener('click', async () => {
      try { sound.init(); sound.playTap(); } catch (e) {}
      const val = (inputUrl.value || '').trim();
      if (!val) {
        if (statusPing) statusPing.innerHTML = '<span style="color:#f43f5e; font-weight:700;">❌ URLが入力されていません</span>';
        return;
      }
      if (statusPing) statusPing.innerHTML = '<span style="color:#38bdf8;">🔄 接続テスト中...</span>';
      const startT = Date.now();
      const res = await testOnlineRankingConnection(val);
      const elapsed = Date.now() - startT;
      if (res.success) {
        try { sound.playSuccess?.(1) || sound.playTap?.(); } catch (e) {}
        if (statusPing) {
          statusPing.innerHTML = '<span style="color:#22c55e; font-weight:700;">✅ 接続成功！ (' + elapsed + 'ms)</span> - ' + (res.data?.message || 'OK');
        }
      } else {
        if (statusPing) {
          statusPing.innerHTML = '<span style="color:#f43f5e; font-weight:700;">❌ 接続失敗:</span> ' + (res.message || '通信エラー');
        }
      }
    });

    // 3. 既存ローカルスコアの即時マイグレーション実行
    btnMigrate?.addEventListener('click', async () => {
      try { sound.init(); sound.playTap(); } catch (e) {}
      const val = (inputUrl.value || '').trim();
      if (!val) {
        if (msgMigration) msgMigration.innerHTML = '<span style="color:#f43f5e;">先にオンラインランキングURLを登録してください。</span>';
        return;
      }
      if (btnMigrate) btnMigrate.disabled = true;
      if (msgMigration) msgMigration.innerHTML = '<span style="color:#c084fc;">📤 送信中... しばらくお待ちください</span>';
      
      const success = await migrateLocalScoresToOnline();
      if (btnMigrate) btnMigrate.disabled = false;
      updateUnsyncedCount();
      if (success) {
        try { sound.playSuccess?.(2) || sound.playTap?.(); } catch (e) {}
        if (msgMigration) msgMigration.innerHTML = '<span style="color:#22c55e; font-weight:700;">🎉 未同期スコアを正常にオンライン世界ランキングへ一括送信しました！</span>';
      } else {
        if (msgMigration) msgMigration.innerHTML = '<span style="color:#94a3b8;">未同期の実スコアがないか、送信処理が完了しています。</span>';
      }
    });

    // 4. GASスクリプトコードをコピー
    btnCopyGas?.addEventListener('click', () => {
      try { sound.init(); sound.playTap(); } catch (e) {}
      const gasCode = "/**\n * ============================================================================\n * HoK！ ~華麗にヒラメいた！~ オンライン世界ランキング API (Google Apps Script)\n * ============================================================================\n * \n * 【セットアップ手順】\n * 1. Google ドライブで新規「Google スプレッドシート」を作成します。\n *    （名前例: HoK_World_Rankings）\n * 2. メニュー「拡張機能」 > 「Apps Script」を開きます。\n * 3. 既存のコードを全て消去し、このスクリプトの内容をすべて貼り付けて保存（Ctrl+S）します。\n * 4. 画面右上の「デプロイ」 > 「新しいデプロイ」をクリックします。\n * 5. 歯車アイコン「種類の選択」で「ウェブアプリ」を選択します。\n *    - 説明: HoK Ranking API\n *    - 次のユーザーとして実行: 自分 (アクセス権限を持つユーザー)\n *    - アクセスできるユーザー: 全員 (Anyone)  ← ★必ず「全員」に設定してください\n * 6. 「デプロイ」をクリックし、初回のみ「アクセスを承認」を完了します。\n * 7. 発行された「ウェブアプリの URL」をコピーし、管理コンソールまたはゲーム設定に設定します。\n */\n\nconst SHEET_NAME = 'Rankings';\n\n// 初期化（シートがなければ自動作成してヘッダーを設定）\nfunction getOrCreateSheet() {\n  const ss = SpreadsheetApp.getActiveSpreadsheet();\n  let sheet = ss.getSheetByName(SHEET_NAME);\n  if (!sheet) {\n    sheet = ss.insertSheet(SHEET_NAME);\n    const headers = [\n      'ID', 'InternalUserID', 'PlayerName', 'PlayerTag',\n      'Score', 'Mode', 'MaxCombo', 'Title',\n      'PlayedAt', 'CreatedAt', 'Deleted'\n    ];\n    sheet.appendRow(headers);\n    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#0f172a').setFontColor('#38bdf8');\n    sheet.setFrozenRows(1);\n  }\n  return sheet;\n}\n\n// レスポンス返却用ヘルパー\nfunction makeJsonResponse(data) {\n  return ContentService.createTextOutput(JSON.stringify(data))\n    .setMimeType(ContentService.MimeType.JSON);\n}\n\n// GETリクエスト処理（ランキング取得 / 接続テスト / フォールバック送信）\nfunction doGet(e) {\n  try {\n    const params = e ? e.parameter : {};\n    const action = params.action || 'get';\n\n    // 1. 接続確認 ping\n    if (action === 'ping') {\n      return makeJsonResponse({ status: 'ok', message: 'HoK Ranking API is online!', timestamp: Date.now() });\n    }\n\n    // 2. GET経由でのスコア登録（CORSフォールバック用）\n    if (action === 'submit') {\n      const payload = params.data ? JSON.parse(decodeURIComponent(params.data)) : params;\n      return handleScoreSubmission(payload);\n    }\n\n    // 3. GET経由での特定ID削除\n    if (action === 'delete') {\n      return handleScoreDeletion(params.id, params.internal_user_id);\n    }\n\n    // 4. ランキング取得 (action === 'get')\n    const mode = params.mode || 'all';      // 'all' | 'karei' | 'hirame' | 'hirai'\n    const period = params.period || 'yearly';// 'yearly' | 'monthly' | 'weekly' | 'daily'\n    const limit = Math.min(100, Math.max(10, parseInt(params.limit, 10) || 50));\n\n    const rankings = queryRankings(mode, period, limit);\n    return makeJsonResponse({\n      status: 'ok',\n      mode: mode,\n      period: period,\n      count: rankings.length,\n      rankings: rankings,\n      timestamp: Date.now()\n    });\n  } catch (err) {\n    return makeJsonResponse({ status: 'error', message: err.toString() });\n  }\n}\n\n// POSTリクエスト処理（スコア送信・マイグレーション・削除）\nfunction doPost(e) {\n  try {\n    let body = {};\n    if (e && e.postData && e.postData.contents) {\n      body = JSON.parse(e.postData.contents);\n    }\n    const action = body.action || 'submit';\n\n    if (action === 'delete') {\n      return handleScoreDeletion(body.id, body.internal_user_id);\n    }\n\n    return handleScoreSubmission(body);\n  } catch (err) {\n    return makeJsonResponse({ status: 'error', message: err.toString() });\n  }\n}\n\n// スコア登録処理（単一レコードまたはマイグレーション用配列対応）\nfunction handleScoreSubmission(payload) {\n  const sheet = getOrCreateSheet();\n  const entries = Array.isArray(payload.entries) ? payload.entries : (payload.score !== undefined ? [payload] : []);\n  const now = new Date();\n  const nowIso = now.toISOString();\n\n  let addedCount = 0;\n  for (let i = 0; i < entries.length; i++) {\n    const it = entries[i];\n    if (!it || typeof it.score !== 'number' || it.score < 0) continue;\n\n    // 不正スコアの簡易ガード（999,999点超え等は除外）\n    if (it.score > 999999) continue;\n\n    const id = it.id || ('lb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6));\n    const internalUserId = String(it.internal_user_id || '').slice(0, 60);\n    const playerName = String(it.name || it.player_name || '名無し').slice(0, 16);\n    const playerTag = String(it.tag || '').slice(0, 10);\n    const score = Number(it.score);\n    const mode = String(it.mode || 'karei').toLowerCase();\n    const maxCombo = Number(it.maxCombo || 0);\n    const title = String(it.title || '見習い').slice(0, 30);\n    const playedAt = String(it.played_at || nowIso);\n\n    sheet.appendRow([\n      id, internalUserId, playerName, playerTag,\n      score, mode, maxCombo, title,\n      playedAt, nowIso, false // Deleted: false\n    ]);\n    addedCount++;\n  }\n\n  return makeJsonResponse({\n    status: 'ok',\n    addedCount: addedCount,\n    timestamp: Date.now()\n  });\n}\n\n// スコア削除処理（本人確認: IDとinternal_user_idが一致するもののみ論理削除）\nfunction handleScoreDeletion(id, internalUserId) {\n  if (!id) return makeJsonResponse({ status: 'error', message: 'Missing record id' });\n  const sheet = getOrCreateSheet();\n  const data = sheet.getDataRange().getValues();\n\n  let deleted = false;\n  for (let i = 1; i < data.length; i++) {\n    const rowId = String(data[i][0]);\n    const rowUser = String(data[i][1]);\n    if (rowId === id) {\n      // ユーザーIDが指定されている場合は検証\n      if (!internalUserId || rowUser === internalUserId) {\n        sheet.getRange(i + 1, 11).setValue(true); // Deleted = true\n        deleted = true;\n      }\n    }\n  }\n\n  return makeJsonResponse({ status: deleted ? 'ok' : 'not_found', deleted: deleted });\n}\n\n// ランキング抽出＆集計（1プレイヤー最大保持件数制御 ＆ ソート）\nfunction queryRankings(mode, period, limit) {\n  const sheet = getOrCreateSheet();\n  const rows = sheet.getDataRange().getValues();\n  if (rows.length <= 1) return [];\n\n  const now = Date.now();\n  const MS_DAY = 24 * 60 * 60 * 1000;\n  let periodMs = 365 * MS_DAY;\n  if (period === 'daily') periodMs = 1 * MS_DAY;\n  else if (period === 'weekly') periodMs = 7 * MS_DAY;\n  else if (period === 'monthly') periodMs = 30 * MS_DAY;\n\n  const validEntries = [];\n  for (let i = 1; i < rows.length; i++) {\n    const r = rows[i];\n    const isDeleted = !!r[10];\n    if (isDeleted) continue;\n\n    const rowMode = String(r[5] || '').toLowerCase();\n    if (mode !== 'all' && rowMode !== mode) continue;\n\n    const playedAtStr = r[8] || r[9];\n    const playedTime = new Date(playedAtStr).getTime();\n    if (isNaN(playedTime) || (now - playedTime > periodMs)) continue;\n\n    validEntries.push({\n      id: String(r[0]),\n      internal_user_id: String(r[1]),\n      name: String(r[2]),\n      tag: String(r[3]),\n      score: Number(r[4]) || 0,\n      mode: rowMode,\n      maxCombo: Number(r[6]) || 0,\n      title: String(r[7]),\n      played_at: String(playedAtStr),\n      date: formatDateRelative(playedTime, now)\n    });\n  }\n\n  // 同一プレイヤー（internal_user_id）ごとにハイスコア順にグループ化し、ベストスコアを優先\n  const playerMap = {};\n  for (let i = 0; i < validEntries.length; i++) {\n    const e = validEntries[i];\n    const key = e.internal_user_id || e.name;\n    if (!playerMap[key]) playerMap[key] = [];\n    playerMap[key].push(e);\n  }\n\n  const result = [];\n  Object.keys(playerMap).forEach(key => {\n    const list = playerMap[key];\n    list.sort((a, b) => b.score - a.score || b.maxCombo - a.maxCombo);\n    // 1人あたり最大3件までランキングに掲載\n    result.push(...list.slice(0, 3));\n  });\n\n  result.sort((a, b) => b.score - a.score || b.maxCombo - a.maxCombo);\n  return result.slice(0, limit);\n}\n\nfunction formatDateRelative(playedTime, now) {\n  const diffHours = (now - playedTime) / (1000 * 60 * 60);\n  if (diffHours < 1) return 'たった今';\n  if (diffHours < 24) return Math.floor(diffHours) + '時間前';\n  const diffDays = Math.floor(diffHours / 24);\n  if (diffDays === 1) return '昨日';\n  if (diffDays <= 7) return diffDays + '日前';\n  return new Date(playedTime).toLocaleDateString('ja-JP');\n}\n";
      navigator.clipboard.writeText(gasCode).then(() => {
        const oldHtml = btnCopyGas.innerHTML;
        btnCopyGas.innerHTML = '<span>✅</span> コピー完了！';
        setTimeout(() => { btnCopyGas.innerHTML = oldHtml; }, 2500);
      }).catch(err => {
        prompt('下記コードを全選択してコピーしてください:', gasCode);
      });
    });
  }

  initOnlineRankingGASIntegration();

  // ===== 📖 キャラ図鑑 編集マネージャー =====
  function initLoreEditor() {
    const tableBody = document.getElementById('adminLoreTableBody');
    const saveBtn = document.getElementById('adminSaveLoreBtn');
    const resetBtn = document.getElementById('adminResetLoreBtn');
    if (!tableBody) return;

    let activeLoreLang = 'ja';
    const loreLangPills = document.querySelectorAll('#loreLangPills .btn-micro');
    loreLangPills.forEach(pill => {
      pill.addEventListener('click', () => {
        try { sound.init(); sound.playTap(); } catch (e) { }
        activeLoreLang = pill.dataset.lang || 'ja';
        loreLangPills.forEach(p => p.classList.toggle('active', p === pill));
        renderLoreTable();
        updateLorePreviewHeader();
      });
    });

    function escapeHtml(str) {
      if (typeof str !== 'string') return '';
      return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
      }[tag] || tag));
    }

    const loreIcons = {
      karei: '🐟',
      hirame: '🦈',
      boo_chan: '🐷',
      octopus: '🐙',
      squid: '🦑',
      stingray: '🌊',
      aji_open: '🐟',
      shitabirame: '👞',
      kanji_hirame: '🔤',
      kanji_karei_1: '🔤',
      kanji_karei_2: '🔤'
    };

    const TOUCH_EFFECT_TAGS = [
      { id: 'flee', label: '💨 泳逃逃亡', cls: 'active-flee', name: '泳逃逃亡' },
      { id: 'lucky', label: '💖 幸福光芒', cls: 'active-lucky', name: '幸福光芒' },
      { id: 'ink', label: '🦑 スミ吐き', cls: 'active-ink', name: 'スミ吐き' },
      { id: 'glare', label: '👁 激怒睨目', cls: 'active-glare', name: '激怒睨目' }
    ];

    // ===== 魚図鑑プレビュー ヘッダー制御 =====
    const btnLorePrev = document.getElementById('btnLorePrev');
    const btnLoreNext = document.getElementById('btnLoreNext');
    const lorePreviewStage = document.getElementById('lorePreviewStage');
    const previewCanvas = document.getElementById('loreHeaderPreviewCanvas');
    const previewName = document.getElementById('lorePreviewName');
    const previewEffects = document.getElementById('lorePreviewEffects');
    const previewSubtitle = document.getElementById('lorePreviewSubtitle');
    const previewDescription = document.getElementById('lorePreviewDescription');
    const previewCharSelect = document.getElementById('lorePreviewCharSelect');

    let lorePreviewIndex = 0; // 初期値: カレイ (インデックス0)
    let previewFishState = null;
    let previewAnimFrameId = null;
    let previewRenderer = null;
    if (previewCanvas) {
      previewRenderer = new GameRenderer(previewCanvas);
      const savedRoster = localStorage.getItem('hirame_custom_roster');
      if (savedRoster) {
        try { previewRenderer.setCustomCharacters(JSON.parse(savedRoster)); } catch (e) { }
      }
    }

    function initPreviewFishState(charInfo) {
      if (!previewCanvas || !charInfo) return;
      const charId = charInfo.id;
      const cw = previewCanvas.width || 180;
      const ch = previewCanvas.height || 105;
      previewFishState = {
        id: charId,
        name: charInfo.name || charId,
        x: cw / 2,
        y: ch / 2,
        baseX: cw / 2,
        baseY: ch / 2,
        width: charId === 'shitabirame' ? 120 : (charId === 'octopus' || charId === 'squid' ? 70 : 96),
        height: charId === 'shitabirame' ? 40 : (charId === 'octopus' || charId === 'squid' ? 75 : 55),
        swimCycle: 0,
        finCycle: 0,
        heading: 1,
        animMode: null,
        animStartTime: 0,
        particles: []
      };
    }

    function syncPreviewCharSelectOptions() {
      if (!previewCharSelect) return;
      const list = currentConfig.characterLore || [];
      const currentVal = previewCharSelect.value;
      previewCharSelect.innerHTML = list.map((item, idx) => {
        const icon = loreIcons[item.id] || '✨';
        const dName = item.nameByLang?.[activeLoreLang] || item.name || item.id;
        return `<option value="${idx}">${icon} ${escapeHtml(dName)}</option>`;
      }).join('');
      if (list[lorePreviewIndex]) {
        previewCharSelect.value = String(lorePreviewIndex);
      }
    }

    previewCharSelect?.addEventListener('change', (e) => {
      const idx = parseInt(e.target.value, 10);
      if (!isNaN(idx) && idx >= 0) {
        lorePreviewIndex = idx;
        updateLorePreviewHeader();
        try { sound.init(); sound.playTap(); } catch (err) { }
      }
    });

    function updateLorePreviewHeader() {
      const list = currentConfig.characterLore || [];
      if (list.length === 0) return;
      if (lorePreviewIndex < 0) lorePreviewIndex = list.length - 1;
      if (lorePreviewIndex >= list.length) lorePreviewIndex = 0;

      const cur = list[lorePreviewIndex];
      const curName = cur.nameByLang?.[activeLoreLang] || cur.name || cur.id;
      if (previewName) previewName.innerText = curName;
      if (previewSubtitle) {
        previewSubtitle.innerText = cur.subtitleByLang?.[activeLoreLang] ?? cur.subtitle ?? '';
      }
      if (previewDescription) {
        previewDescription.innerText = cur.descriptionByLang?.[activeLoreLang] ?? cur.description ?? '';
      }
      if (previewCharSelect && previewCharSelect.value !== String(lorePreviewIndex)) {
        previewCharSelect.value = String(lorePreviewIndex);
      }
      if (previewEffects) {
        let effs = Array.isArray(cur.touchEffects) && cur.touchEffects.length > 0 ? cur.touchEffects : ['flee'];
        effs = effs.map(e => e === 'stare' ? 'glare' : e);
        const labels = effs.map(e => {
          const t = TOUCH_EFFECT_TAGS.find(tag => tag.id === e);
          return t ? t.name : e;
        });
        previewEffects.innerText = labels.join(', ');
      }

      initPreviewFishState(cur);
    }

    function triggerPreviewTouch() {
      if (!previewFishState || previewFishState.animMode !== null) return;
      const list = currentConfig.characterLore || [];
      const cur = list[lorePreviewIndex];
      if (!cur) return;

      try { sound.init(); } catch (e) { }

      let effs = Array.isArray(cur.touchEffects) && cur.touchEffects.length > 0 ? cur.touchEffects : ['flee'];
      effs = effs.map(e => e === 'stare' ? 'glare' : e);
      const chosen = effs[Math.floor(Math.random() * effs.length)] || 'flee';

      previewFishState.animMode = chosen;
      previewFishState.animStartTime = performance.now();

      if (chosen === 'glare') {
        try { sound.playTap(); } catch (e) { }
        for (let i = 0; i < 10; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 1.0 + Math.random() * 2.0;
          previewFishState.particles.push({
            x: previewFishState.x,
            y: previewFishState.y,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            radius: 1.5 + Math.random() * 2,
            color: Math.random() < 0.6 ? '#ef4444' : '#facc15',
            alpha: 1.0,
            fade: 2.5
          });
        }
      } else if (chosen === 'lucky') {
        try { sound.playSuccess ? sound.playSuccess(1) : sound.playTap(); } catch (e) { }
        const symbols = ['★', '❤', '♪', '✨'];
        const colors = ['#f43f5e', '#ec4899', '#facc15', '#38bdf8', '#a855f7'];
        for (let i = 0; i < 8; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 0.8 + Math.random() * 1.6;
          previewFishState.particles.push({
            x: previewFishState.x,
            y: previewFishState.y,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd - 0.8,
            radius: 4 + Math.random() * 3,
            char: symbols[Math.floor(Math.random() * symbols.length)],
            color: colors[Math.floor(Math.random() * colors.length)],
            alpha: 1.0,
            fade: 1.3
          });
        }
      } else if (chosen === 'ink') {
        try { sound.playMiss ? sound.playMiss() : sound.playTap(); } catch (e) { }
        for (let i = 0; i < 10; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 0.6 + Math.random() * 1.5;
          previewFishState.particles.push({
            x: previewFishState.x + (previewFishState.heading === 1 ? -10 : 10),
            y: previewFishState.y + 2,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            radius: 4 + Math.random() * 6,
            grow: 18,
            color: 'rgba(20, 20, 35, 0.85)',
            alpha: 0.9,
            fade: 1.0
          });
        }
      } else {
        // flee
        try { sound.playTap(); } catch (e) { }
        for (let i = 0; i < 12; i++) {
          const ang = Math.random() * Math.PI * 2;
          const spd = 1.5 + Math.random() * 2.5;
          previewFishState.particles.push({
            x: previewFishState.x,
            y: previewFishState.y,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            radius: 1.5 + Math.random() * 2.5,
            color: '#38bdf8',
            alpha: 1.0,
            fade: 2.0
          });
        }
      }
    }

    btnLorePrev?.addEventListener('click', (e) => {
      e.stopPropagation();
      try { sound.init(); sound.playTap(); } catch (err) { }
      lorePreviewIndex--;
      updateLorePreviewHeader();
    });

    btnLoreNext?.addEventListener('click', (e) => {
      e.stopPropagation();
      try { sound.init(); sound.playTap(); } catch (err) { }
      lorePreviewIndex++;
      updateLorePreviewHeader();
    });

    lorePreviewStage?.addEventListener('click', () => {
      triggerPreviewTouch();
    });

    // プレビューキャンバス描画ループ
    let prevLastTime = performance.now();
    function renderPreviewLoop(now) {
      const dt = Math.min(0.05, (now - prevLastTime) / 1000);
      prevLastTime = now;

      if (previewCanvas && previewFishState && previewRenderer) {
        const ctx = previewCanvas.getContext('2d');
        ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

        // 背景
        const bg = ctx.createLinearGradient(0, 0, 0, previewCanvas.height);
        bg.addColorStop(0, '#0284c7');
        bg.addColorStop(1, '#082f49');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

        let currentZoom = 1.0;
        let focusProgress = 0.0;
        let shakeX = 0;
        let shakeY = 0;

        const eyeOffset = getFishEyeOffset(previewFishState.id, previewFishState.width, previewFishState.height, previewFishState.heading);
        const eyeRelX = eyeOffset.x;
        const eyeRelY = eyeOffset.y;

        if (previewFishState.animMode === 'flee') {
          const elapsed = (now - previewFishState.animStartTime) / 1000;
          previewFishState.swimCycle += dt * 18.0;
          previewFishState.finCycle += dt * 20.0;

          if (elapsed < 0.5) {
            const p = elapsed / 0.5;
            previewFishState.x = 48 + p * p * 110;
            if (Math.random() < 0.3) {
              previewFishState.particles.push({
                x: previewFishState.x - 18,
                y: previewFishState.y + (Math.random() - 0.5) * 8,
                vx: -1.2,
                vy: (Math.random() - 0.5) * 0.8,
                radius: 1.2 + Math.random() * 2,
                color: 'rgba(255, 255, 255, 0.7)',
                alpha: 0.9,
                fade: 2.0
              });
            }
          } else if (elapsed < 0.7) {
            const p = (elapsed - 0.5) / 0.2;
            previewFishState.x = -50 + p * 25;
          } else if (elapsed < 1.6) {
            const p = (elapsed - 0.7) / 0.9;
            const ease = 1 - Math.pow(1 - p, 3);
            previewFishState.x = -25 + ease * 73;
          } else {
            previewFishState.x = 48;
            previewFishState.animMode = null;
          }
        } else if (previewFishState.animMode === 'lucky') {
          const elapsed = (now - previewFishState.animStartTime) / 1000;
          previewFishState.swimCycle += dt * 8.0;
          previewFishState.finCycle += dt * 10.0;

          if (elapsed < 1.8) {
            if (Math.random() < 0.45) {
              const symbols = ['★', '❤', '♪', '✨'];
              const colors = ['#f43f5e', '#ec4899', '#facc15', '#38bdf8', '#a855f7'];
              previewFishState.particles.push({
                x: previewFishState.x + (Math.random() - 0.5) * 20,
                y: previewFishState.y + 6,
                vx: (Math.random() - 0.5) * 1.2,
                vy: -1.0 - Math.random() * 1.5,
                radius: 4 + Math.random() * 3,
                char: symbols[Math.floor(Math.random() * symbols.length)],
                color: colors[Math.floor(Math.random() * colors.length)],
                alpha: 1.0,
                fade: 1.4
              });
            }
          } else {
            previewFishState.animMode = null;
          }
        } else if (previewFishState.animMode === 'ink') {
          const elapsed = (now - previewFishState.animStartTime) / 1000;
          previewFishState.swimCycle += dt * 5.0;
          previewFishState.finCycle += dt * 6.0;

          if (elapsed < 1.8) {
            if (elapsed < 0.5 && Math.random() < 0.5) {
              previewFishState.particles.push({
                x: previewFishState.x + (previewFishState.heading === 1 ? -10 : 10),
                y: previewFishState.y + 2,
                vx: (previewFishState.heading === 1 ? -1 : 1) + (Math.random() - 0.5),
                vy: (Math.random() - 0.5) * 0.8,
                radius: 4 + Math.random() * 4,
                grow: 18,
                color: 'rgba(20, 20, 35, 0.85)',
                alpha: 0.9,
                fade: 1.0
              });
            }
          } else {
            previewFishState.animMode = null;
          }
        } else if (previewFishState.animMode === 'glare' || previewFishState.animMode === 'stare') {
          const elapsed = (now - previewFishState.animStartTime) / 1000;
          previewFishState.swimCycle += dt * 2.0;
          previewFishState.finCycle += dt * 3.0;

          const maxZoom = 3.2;
          if (elapsed < 0.4) {
            const p = elapsed / 0.4;
            const ease = 1 - Math.pow(1 - p, 3);
            currentZoom = 1.0 + ease * (maxZoom - 1.0);
            focusProgress = ease;
          } else if (elapsed < 1.35) {
            currentZoom = maxZoom;
            focusProgress = 1.0;
            // 怒りの小刻み振動
            shakeX = Math.sin(now * 0.12) * 2.8 + (Math.random() - 0.5) * 2.0;
            shakeY = Math.cos(now * 0.14) * 2.8 + (Math.random() - 0.5) * 2.0;

            if (Math.random() < 0.35) {
              previewFishState.particles.push({
                x: previewCanvas.width / 2 + (Math.random() - 0.5) * 16,
                y: previewCanvas.height / 2 + (Math.random() - 0.5) * 16,
                vx: (Math.random() - 0.5) * 1.5,
                vy: (Math.random() - 0.5) * 1.5,
                radius: 1.2 + Math.random() * 2,
                color: Math.random() < 0.6 ? '#ef4444' : '#facc15',
                alpha: 0.9,
                fade: 3.0
              });
            }
          } else if (elapsed < 1.8) {
            const p = (elapsed - 1.35) / 0.45;
            const ease = p * p;
            currentZoom = maxZoom - ease * (maxZoom - 1.0);
            focusProgress = 1.0 - ease;
          } else {
            currentZoom = 1.0;
            focusProgress = 0.0;
            previewFishState.animMode = null;
          }
        } else {
          previewFishState.swimCycle += dt * 4.5;
          previewFishState.finCycle += dt * 5.5;
        }

        // パーティクル描画
        for (let i = previewFishState.particles.length - 1; i >= 0; i--) {
          const p = previewFishState.particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.alpha -= dt * p.fade;
          p.radius = Math.max(0, p.radius + (p.grow || 0) * dt);
          if (p.alpha <= 0) {
            previewFishState.particles.splice(i, 1);
            continue;
          }
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.alpha);
          if (p.char) {
            ctx.font = `bold ${Math.max(8, Math.round(p.radius * 2))}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = p.color;
            ctx.fillText(p.char, p.x, p.y);
          } else {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }

        // 魚描画
        ctx.save();
        const isFreezing = (previewFishState.animMode === 'glare' || previewFishState.animMode === 'stare');
        const bobY = isFreezing ? 0 : Math.sin(previewFishState.swimCycle) * 2;

        ctx.translate(previewCanvas.width / 2 + shakeX, previewCanvas.height / 2 + shakeY);
        ctx.scale(currentZoom, currentZoom);
        const targetFocusX = previewFishState.x + eyeRelX * focusProgress;
        const targetFocusY = previewFishState.y + bobY + eyeRelY * focusProgress;
        ctx.translate(-targetFocusX, -targetFocusY);

        ctx.translate(previewFishState.x, previewFishState.y + bobY);

        const mockFish = {
          type: previewFishState.id,
          x: 0,
          y: 0,
          width: previewFishState.width,
          height: previewFishState.height,
          finCycle: previewFishState.finCycle,
          swimCycle: previewFishState.swimCycle,
          heading: previewFishState.heading,
          depth: 0.1,
          isBlinkingAlert: false
        };

        previewRenderer.drawFishDetailed(ctx, mockFish, 1.0);
        ctx.restore();
      }

      previewAnimFrameId = requestAnimationFrame(renderPreviewLoop);
    }

    function renderLoreTable() {
      try {
        currentConfig.characterLore = normalizeCharacterLore(currentConfig.characterLore);

        // 新規作成された追加キャラ・カスタムキャラを自動検出して図鑑リストに同期補完
        const existingLoreIds = new Set(currentConfig.characterLore.map(c => c.id));
        const allRegisteredChars = {};
        if (currentConfig.characters) Object.assign(allRegisteredChars, currentConfig.characters);
        if (currentConfig.modeConfigs) {
          for (const mCfg of Object.values(currentConfig.modeConfigs)) {
            if (mCfg.characters) Object.assign(allRegisteredChars, mCfg.characters);
          }
        }
        try {
          const savedRoster = JSON.parse(localStorage.getItem('hirame_custom_roster') || '{}');
          Object.assign(allRegisteredChars, savedRoster);
        } catch (e) { }

        for (const [cId, cData] of Object.entries(allRegisteredChars)) {
          if (!existingLoreIds.has(cId)) {
            const cName = cData.name || cId;
            currentConfig.characterLore.push({
              id: cId,
              name: cName,
              nameByLang: { ja: cName, en: cName, ko: cName, zh: cName },
              enabled: true,
              appearanceRate: 0,
              subtitle: `${cName}が登場！`,
              subtitleByLang: { ja: `${cName}が登場！`, en: `${cName}!`, ko: `${cName}!`, zh: `${cName}!` },
              description: "キャラクタースタジオで作成された特別なキャラクターです。",
              descriptionByLang: {
                ja: "キャラクタースタジオで作成された特別なキャラクターです。",
                en: "Special character created in Character Studio.",
                ko: "캐릭터 스튜디오에서 생성된 특별한 캐릭터입니다.",
                zh: "在角色工作室中创建的特别角色。"
              },
              touchEffects: ['flee']
            });
            existingLoreIds.add(cId);
          }
        }

        syncPreviewCharSelectOptions();

        tableBody.innerHTML = currentConfig.characterLore.map((item, idx) => {
          const isEnabled = item.enabled !== false;
          const disabledAttr = isEnabled ? '' : 'disabled';
          const rateVal = item.appearanceRate !== undefined ? item.appearanceRate : 0;
          const icon = loreIcons[item.id] || '✨';
          const dispName = item.nameByLang?.[activeLoreLang] || item.name || item.id;
          const dispSubtitle = item.subtitleByLang?.[activeLoreLang] ?? item.subtitle ?? '';
          const dispDesc = item.descriptionByLang?.[activeLoreLang] ?? item.description ?? '';

          let activeEffects = Array.isArray(item.touchEffects) && item.touchEffects.length > 0
            ? item.touchEffects
            : (item.tapEffect ? [item.tapEffect] : ['flee']);
          activeEffects = activeEffects.map(e => e === 'stare' ? 'glare' : e);

          return `
            <tr data-id="${item.id}" class="${isEnabled ? '' : 'lore-row-disabled'}" style="${isEnabled ? '' : 'opacity: 0.5; background: rgba(15,23,42,0.5);'}">
              <!-- 1. キャラ名 (編集可能入力欄 ＆ ID表示) -->
              <td style="vertical-align:middle;">
                <div style="display:flex; align-items:center; gap:6px;">
                  <span style="font-size:16px; flex-shrink:0;">${icon}</span>
                  <input type="text" class="admin-text-input lore-name-input" data-idx="${idx}" value="${escapeHtml(dispName)}" placeholder="キャラ名を入力" style="width:100%; font-weight:800; font-size:12px; color:#f8fafc;" ${disabledAttr}>
                </div>
                <div style="font-size:10px; color:#64748b; font-family:monospace; margin-top:3px; padding-left:22px;">ID: ${escapeHtml(item.id)}</div>
              </td>
              <!-- 2. 図鑑表示 -->
              <td style="text-align:center; vertical-align:middle;">
                <label style="cursor:pointer; display:inline-flex; align-items:center; gap:5px;">
                  <input type="checkbox" class="lore-enable-toggle" data-idx="${idx}" ${isEnabled ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer; accent-color:#38bdf8;">
                  <span style="font-size:11px; font-weight:700; color:${isEnabled ? '#38bdf8' : '#64748b'};">${isEnabled ? '表示' : '非表示'}</span>
                </label>
              </td>
              <!-- 3. 登場率 (%) -->
              <td style="vertical-align:middle;">
                <div style="display:flex; align-items:center; gap:4px;">
                  <input type="number" min="0" max="100" class="admin-text-input lore-rate-input" data-idx="${idx}" value="${rateVal}" style="width:65px; text-align:center; font-weight:700;" ${disabledAttr}>
                  <span style="font-size:12px; color:#94a3b8; font-weight:700;">%</span>
                </div>
                <div style="font-size:10px; color:#64748b; margin-top:2px;">※0は均等出現</div>
              </td>
              <!-- 4. 図鑑見出し ＆ 説明文 -->
              <td style="vertical-align:middle;">
                <div style="margin-bottom:6px;">
                  <input type="text" class="admin-text-input lore-subtitle-input" data-idx="${idx}" value="${escapeHtml(dispSubtitle)}" placeholder="見出し (例: これがカレイだ！)" style="width:100%; font-weight:700; font-size:12px;" ${disabledAttr}>
                </div>
                <div>
                  <textarea class="admin-textarea lore-desc-input" rows="2" data-idx="${idx}" placeholder="図鑑での説明文を入力..." style="width:100%; resize:vertical; font-size:12px; line-height:1.4;" ${disabledAttr}>${escapeHtml(dispDesc)}</textarea>
                </div>
              </td>
              <!-- 5. 触れた演出 (タグ形式・複数選択時はランダム実行) -->
              <td style="text-align:center; vertical-align:middle;">
                <div class="lore-tag-group">
                  ${TOUCH_EFFECT_TAGS.map(tag => {
            const isSelected = activeEffects.includes(tag.id);
            return `
                      <button type="button" class="lore-tag-btn ${isSelected ? tag.cls : ''}" data-idx="${idx}" data-tag="${tag.id}" ${disabledAttr} title="${tag.label} (クリックでON/OFF切り替え)">
                        ${tag.label}
                      </button>
                    `;
          }).join('')}
                </div>
              </td>
            </tr>
          `;
        }).join('');

        // イベントリスナー紐付け: キャラ名入力
        tableBody.querySelectorAll('.lore-name-input').forEach(input => {
          input.addEventListener('input', (e) => {
            const idx = parseInt(e.target.dataset.idx, 10);
            const item = currentConfig.characterLore[idx];
            if (item) {
              if (!item.nameByLang) item.nameByLang = {};
              item.nameByLang[activeLoreLang] = e.target.value;
              if (activeLoreLang === 'ja') {
                item.name = e.target.value;
              }
              updateLorePreviewHeader();
              saveCurrentConfigToStorage();
            }
          });
        });

        // イベントリスナー紐付け: タグボタン切り替え
        tableBody.querySelectorAll('.lore-tag-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.idx, 10);
            const tagId = btn.dataset.tag;
            const target = currentConfig.characterLore[idx];
            if (!target) return;

            try { sound.init(); sound.playTap(); } catch (err) { }

            let curTags = Array.isArray(target.touchEffects) && target.touchEffects.length > 0
              ? [...target.touchEffects]
              : (target.tapEffect ? [target.tapEffect] : ['flee']);
            curTags = curTags.map(t => t === 'stare' ? 'glare' : t);

            if (curTags.includes(tagId)) {
              if (curTags.length > 1) {
                curTags = curTags.filter(t => t !== tagId);
              }
            } else {
              curTags.push(tagId);
            }

            target.touchEffects = curTags;
            delete target.tapEffect;

            renderLoreTable();
            updateLorePreviewHeader();
            saveCurrentConfigToStorage();
          });
        });

        // イベントリスナー紐付け: 表示ON/OFF
        tableBody.querySelectorAll('.lore-enable-toggle').forEach(chk => {
          chk.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.idx, 10);
            if (currentConfig.characterLore[idx]) {
              currentConfig.characterLore[idx].enabled = e.target.checked;
              renderLoreTable();
              updateLorePreviewHeader();
              saveCurrentConfigToStorage();
            }
          });
        });

        tableBody.querySelectorAll('.lore-rate-input').forEach(input => {
          input.addEventListener('input', (e) => {
            const idx = parseInt(e.target.dataset.idx, 10);
            if (currentConfig.characterLore[idx]) {
              currentConfig.characterLore[idx].appearanceRate = Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0));
              saveCurrentConfigToStorage();
            }
          });
        });

        tableBody.querySelectorAll('.lore-name-input').forEach(input => {
          input.addEventListener('input', (e) => {
            const idx = parseInt(e.target.dataset.idx, 10);
            if (currentConfig.characterLore[idx]) {
              if (!currentConfig.characterLore[idx].nameByLang) {
                currentConfig.characterLore[idx].nameByLang = {};
              }
              currentConfig.characterLore[idx].nameByLang[activeLoreLang] = e.target.value;
              if (activeLoreLang === 'ja') {
                currentConfig.characterLore[idx].name = e.target.value;
              }
              updateLorePreviewHeader();
              saveCurrentConfigToStorage();
            }
          });
        });

        tableBody.querySelectorAll('.lore-subtitle-input').forEach(input => {
          input.addEventListener('input', (e) => {
            const idx = parseInt(e.target.dataset.idx, 10);
            if (currentConfig.characterLore[idx]) {
              if (!currentConfig.characterLore[idx].subtitleByLang) {
                currentConfig.characterLore[idx].subtitleByLang = {};
              }
              currentConfig.characterLore[idx].subtitleByLang[activeLoreLang] = e.target.value;
              if (activeLoreLang === 'ja') {
                currentConfig.characterLore[idx].subtitle = e.target.value;
              }
              updateLorePreviewHeader();
              saveCurrentConfigToStorage();
            }
          });
        });

        tableBody.querySelectorAll('.lore-desc-input').forEach(textarea => {
          textarea.addEventListener('input', (e) => {
            const idx = parseInt(e.target.dataset.idx, 10);
            if (currentConfig.characterLore[idx]) {
              if (!currentConfig.characterLore[idx].descriptionByLang) {
                currentConfig.characterLore[idx].descriptionByLang = {};
              }
              currentConfig.characterLore[idx].descriptionByLang[activeLoreLang] = textarea.value;
              if (activeLoreLang === 'ja') {
                currentConfig.characterLore[idx].description = textarea.value;
              }
              updateLorePreviewHeader();
              saveCurrentConfigToStorage();
            }
          });
        });
      } catch (err) {
        console.error('renderLoreTable error:', err);
      }
    }

    saveBtn?.addEventListener('click', () => {
      try { sound.init(); sound.playChime(); } catch (e) { }
      saveCurrentConfigToStorage();
      if (saveBtn) {
        const orig = saveBtn.innerHTML;
        saveBtn.innerHTML = '<span>✅</span> キャラ図鑑設定を保存しました！';
        saveBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        setTimeout(() => {
          saveBtn.innerHTML = orig;
          saveBtn.style.background = '';
        }, 2500);
      }
      const syncBadge = document.getElementById('syncStatusBadge');
      if (syncBadge) {
        syncBadge.innerText = '⚡ キャラ図鑑設定を即時保存・反映！';
        syncBadge.style.color = '#38bdf8';
        setTimeout(() => { syncBadge.innerText = '⚡ 接続アクティブ'; syncBadge.style.color = '#10b981'; }, 3000);
      }
    });

    resetBtn?.addEventListener('click', () => {
      try { sound.init(); sound.playTap(); } catch (e) { }
      currentConfig.characterLore = JSON.parse(JSON.stringify(DEFAULT_CHARACTER_LORE));
      renderLoreTable();
      updateLorePreviewHeader();
      saveCurrentConfigToStorage();
    });

    renderLoreTable();
    updateLorePreviewHeader();
    if (!previewAnimFrameId) {
      previewAnimFrameId = requestAnimationFrame(renderPreviewLoop);
    }
    window.renderLoreManager = renderLoreTable;
  }

  try {
    initLoreEditor();
  } catch (err) {
    console.error('initLoreEditor initialization error:', err);
  }

  // ===== 🫧 背景演出マネージャー =====
  function initAmbientManager() {
    const btnToggleGlobal = document.getElementById('btnToggleGlobalAmbient');
    const btnToggleBubbles = document.getElementById('btnToggleAmbientBubbles');
    const sliderBubbles = document.getElementById('adminAmbientBubblesCount');
    const inputBubbles = document.getElementById('adminAmbientBubblesInput');
    const valBubbles = document.getElementById('adminAmbientBubblesVal');
    const btnToggleSmallFish = document.getElementById('btnToggleAmbientSmallFish');
    const sliderSmallFish = document.getElementById('adminAmbientSmallFishCount');
    const inputSmallFish = document.getElementById('adminAmbientSmallFishInput');
    const valSmallFish = document.getElementById('adminAmbientSmallFishVal');
    const btnAddPreset = document.getElementById('btnAddAmbientPresetBtn');
    const btnSaveAmbient = document.getElementById('adminSaveAmbientBtn');
    const btnResetAmbient = document.getElementById('adminResetAmbientBtn');

    // ===== 🎨 背景素材作成 (PNG画像・グラデーション・光芒・地面・横流れ・星くず) コントロール =====
    const btnToggleBgImage = document.getElementById('btnToggleBgImage');
    const bgImageFileInput = document.getElementById('bgImageFileInput');
    const btnRemoveBgImage = document.getElementById('btnRemoveBgImage');
    const bgImagePreviewEl = document.getElementById('bgImagePreviewEl');
    const bgImageEmptyText = document.getElementById('bgImageEmptyText');
    const bgImageFitSelect = document.getElementById('bgImageFitSelect');
    const bgImageOpacitySlider = document.getElementById('bgImageOpacitySlider');
    const bgImageOpacityVal = document.getElementById('bgImageOpacityVal');

    const btnToggleBgGradient = document.getElementById('btnToggleBgGradient');
    const bgGradTopColor = document.getElementById('bgGradTopColor');
    const bgGradTopHex = document.getElementById('bgGradTopHex');
    const bgGradMidColor = document.getElementById('bgGradMidColor');
    const bgGradMidHex = document.getElementById('bgGradMidHex');
    const bgGradDeepColor = document.getElementById('bgGradDeepColor');
    const bgGradDeepHex = document.getElementById('bgGradDeepHex');
    const bgGradBtmColor = document.getElementById('bgGradBtmColor');
    const bgGradBtmHex = document.getElementById('bgGradBtmHex');

    const btnToggleBgLightRays = document.getElementById('btnToggleBgLightRays');
    const bgLightRayColor = document.getElementById('bgLightRayColor');
    const bgLightRayHex = document.getElementById('bgLightRayHex');
    const bgLightRayIntensity = document.getElementById('bgLightRayIntensity');
    const bgLightRayIntensityVal = document.getElementById('bgLightRayIntensityVal');

    const btnToggleBgGround = document.getElementById('btnToggleBgGround');
    const bgGroundTopColor = document.getElementById('bgGroundTopColor');
    const bgGroundTopHex = document.getElementById('bgGroundTopHex');
    const bgGroundBtmColor = document.getElementById('bgGroundBtmColor');
    const bgGroundBtmHex = document.getElementById('bgGroundBtmHex');
    const bgGroundPlantColor = document.getElementById('bgGroundPlantColor');
    const bgGroundPlantHex = document.getElementById('bgGroundPlantHex');
    const bgGroundShowPlants = document.getElementById('bgGroundShowPlants');

    const adminAmbientBubblesColor = document.getElementById('adminAmbientBubblesColor');
    const adminAmbientBubblesHex = document.getElementById('adminAmbientBubblesHex');
    const adminAmbientSmallFishColor = document.getElementById('adminAmbientSmallFishColor');
    const adminAmbientSmallFishHex = document.getElementById('adminAmbientSmallFishHex');

    const btnToggleBgFlow = document.getElementById('btnToggleBgFlow');
    const bgFlowColor = document.getElementById('bgFlowColor');
    const bgFlowHex = document.getElementById('bgFlowHex');
    const bgFlowCount = document.getElementById('bgFlowCount');
    const bgFlowCountVal = document.getElementById('bgFlowCountVal');
    const bgFlowSpeed = document.getElementById('bgFlowSpeed');
    const bgFlowSpeedVal = document.getElementById('bgFlowSpeedVal');

    const btnToggleBgSparks = document.getElementById('btnToggleBgSparks');
    const bgSparksColor = document.getElementById('bgSparksColor');
    const bgSparksHex = document.getElementById('bgSparksHex');
    const bgSparksCount = document.getElementById('bgSparksCount');
    const bgSparksCountVal = document.getElementById('bgSparksCountVal');
    const bgSparksSpeed = document.getElementById('bgSparksSpeed');
    const bgSparksSpeedVal = document.getElementById('bgSparksSpeedVal');

    function ensureAmbientConfig() {
      if (!currentConfig.ambientConfig) {
        currentConfig.ambientConfig = JSON.parse(JSON.stringify(DEFAULT_AMBIENT_CONFIG));
      }
      if (!currentConfig.ambientConfig.bubbles) {
        currentConfig.ambientConfig.bubbles = { enabled: true, count: 30, color: '#ffffff' };
      }
      if (!currentConfig.ambientConfig.bubbles.color) {
        currentConfig.ambientConfig.bubbles.color = '#ffffff';
      }
      if (!currentConfig.ambientConfig.smallFish) {
        currentConfig.ambientConfig.smallFish = { enabled: true, count: 15, color: '#e0f2fe' };
      }
      if (!currentConfig.ambientConfig.smallFish.color) {
        currentConfig.ambientConfig.smallFish.color = '#e0f2fe';
      }
      if (!currentConfig.ambientConfig.backgroundImage) {
        currentConfig.ambientConfig.backgroundImage = { enabled: false, dataUrl: '', fit: 'cover', opacity: 0.85 };
      }
      if (!currentConfig.ambientConfig.gradient) {
        currentConfig.ambientConfig.gradient = { enabled: true, topColor: '#0284c7', midColor: '#0369a1', deepColor: '#075985', bottomColor: '#0c2340' };
      }
      if (!currentConfig.ambientConfig.lightRays) {
        currentConfig.ambientConfig.lightRays = { enabled: true, color: '#ffffff', intensity: 1.0 };
      }
      if (!currentConfig.ambientConfig.ground) {
        currentConfig.ambientConfig.ground = { enabled: true, topColor: '#786047', bottomColor: '#3b2b1d', plantColor: '#15803d', showPlants: true };
      }
      if (!currentConfig.ambientConfig.flowEffect) {
        currentConfig.ambientConfig.flowEffect = { enabled: false, count: 20, color: '#38bdf8', speed: 1.0 };
      }
      if (!currentConfig.ambientConfig.sparks) {
        currentConfig.ambientConfig.sparks = { enabled: false, count: 25, color: '#fef08a', speed: 1.0 };
      }
      if (!Array.isArray(currentConfig.ambientConfig.presets)) {
        currentConfig.ambientConfig.presets = JSON.parse(JSON.stringify(DEFAULT_AMBIENT_PRESETS));
      }
      return currentConfig.ambientConfig;
    }

    function renderAmbientManager() {
      const ambCfg = ensureAmbientConfig();

      // Global
      if (btnToggleGlobal) {
        const isGlobalOn = ambCfg.enabled !== false;
        btnToggleGlobal.className = isGlobalOn ? 'btn-condition-toggle condition-on' : 'btn-condition-toggle condition-off';
        btnToggleGlobal.innerHTML = isGlobalOn
          ? '<span class="toggle-icon">🟢</span> <span class="toggle-text">ON (演出表示中)</span>'
          : '<span class="toggle-icon">⚪</span> <span class="toggle-text">OFF (全体停止)</span>';
      }

      // 1. 背景画像
      const bgImg = ambCfg.backgroundImage || {};
      if (btnToggleBgImage) {
        const isOn = bgImg.enabled !== false && !!bgImg.dataUrl;
        btnToggleBgImage.className = isOn ? 'btn-condition-toggle condition-on' : 'btn-condition-toggle condition-off';
        btnToggleBgImage.innerHTML = isOn
          ? '<span class="toggle-icon">🟢</span> <span class="toggle-text">ON</span>'
          : '<span class="toggle-icon">⚪</span> <span class="toggle-text">OFF</span>';
      }
      if (bgImagePreviewEl && bgImageEmptyText) {
        if (bgImg.dataUrl) {
          bgImagePreviewEl.src = bgImg.dataUrl;
          bgImagePreviewEl.style.display = 'block';
          bgImageEmptyText.style.display = 'none';
        } else {
          bgImagePreviewEl.src = '';
          bgImagePreviewEl.style.display = 'none';
          bgImageEmptyText.style.display = 'block';
        }
      }
      if (bgImageFitSelect) bgImageFitSelect.value = bgImg.fit || 'cover';
      const opPct = Math.round((bgImg.opacity ?? 0.85) * 100);
      if (bgImageOpacitySlider) bgImageOpacitySlider.value = opPct;
      if (bgImageOpacityVal) bgImageOpacityVal.innerText = `${opPct}%`;

      // 2. グラデーション
      const grad = ambCfg.gradient || {};
      if (btnToggleBgGradient) {
        const isOn = grad.enabled !== false;
        btnToggleBgGradient.className = isOn ? 'btn-condition-toggle condition-on' : 'btn-condition-toggle condition-off';
        btnToggleBgGradient.innerHTML = isOn
          ? '<span class="toggle-icon">🟢</span> <span class="toggle-text">ON</span>'
          : '<span class="toggle-icon">⚪</span> <span class="toggle-text">OFF</span>';
      }
      if (bgGradTopColor) bgGradTopColor.value = grad.topColor || '#0284c7';
      if (bgGradTopHex) bgGradTopHex.innerText = grad.topColor || '#0284c7';
      if (bgGradMidColor) bgGradMidColor.value = grad.midColor || '#0369a1';
      if (bgGradMidHex) bgGradMidHex.innerText = grad.midColor || '#0369a1';
      if (bgGradDeepColor) bgGradDeepColor.value = grad.deepColor || '#075985';
      if (bgGradDeepHex) bgGradDeepHex.innerText = grad.deepColor || '#075985';
      if (bgGradBtmColor) bgGradBtmColor.value = grad.bottomColor || '#0c2340';
      if (bgGradBtmHex) bgGradBtmHex.innerText = grad.bottomColor || '#0c2340';

      // 3. 光芒
      const rays = ambCfg.lightRays || {};
      if (btnToggleBgLightRays) {
        const isOn = rays.enabled !== false;
        btnToggleBgLightRays.className = isOn ? 'btn-condition-toggle condition-on' : 'btn-condition-toggle condition-off';
        btnToggleBgLightRays.innerHTML = isOn
          ? '<span class="toggle-icon">🟢</span> <span class="toggle-text">ON</span>'
          : '<span class="toggle-icon">⚪</span> <span class="toggle-text">OFF</span>';
      }
      if (bgLightRayColor) bgLightRayColor.value = rays.color || '#ffffff';
      if (bgLightRayHex) bgLightRayHex.innerText = rays.color || '#ffffff';
      const rayInt = rays.intensity ?? 1.0;
      if (bgLightRayIntensity) bgLightRayIntensity.value = rayInt;
      if (bgLightRayIntensityVal) bgLightRayIntensityVal.innerText = `${rayInt.toFixed(1)} x`;

      // 4. 地面
      const grnd = ambCfg.ground || {};
      if (btnToggleBgGround) {
        const isOn = grnd.enabled !== false;
        btnToggleBgGround.className = isOn ? 'btn-condition-toggle condition-on' : 'btn-condition-toggle condition-off';
        btnToggleBgGround.innerHTML = isOn
          ? '<span class="toggle-icon">🟢</span> <span class="toggle-text">ON</span>'
          : '<span class="toggle-icon">⚪</span> <span class="toggle-text">OFF</span>';
      }
      if (bgGroundTopColor) bgGroundTopColor.value = grnd.topColor || '#786047';
      if (bgGroundTopHex) bgGroundTopHex.innerText = grnd.topColor || '#786047';
      if (bgGroundBtmColor) bgGroundBtmColor.value = grnd.bottomColor || '#3b2b1d';
      if (bgGroundBtmHex) bgGroundBtmHex.innerText = grnd.bottomColor || '#3b2b1d';
      if (bgGroundPlantColor) bgGroundPlantColor.value = grnd.plantColor || '#15803d';
      if (bgGroundPlantHex) bgGroundPlantHex.innerText = grnd.plantColor || '#15803d';
      if (bgGroundShowPlants) bgGroundShowPlants.checked = grnd.showPlants !== false;

      // 5. 泡・小魚カラー
      const bubCol = ambCfg.bubbles?.color || '#ffffff';
      if (adminAmbientBubblesColor) adminAmbientBubblesColor.value = bubCol;
      if (adminAmbientBubblesHex) adminAmbientBubblesHex.innerText = bubCol;
      const sfCol = ambCfg.smallFish?.color || '#e0f2fe';
      if (adminAmbientSmallFishColor) adminAmbientSmallFishColor.value = sfCol;
      if (adminAmbientSmallFishHex) adminAmbientSmallFishHex.innerText = sfCol;

      // 6. 横流れエフェクト
      const flow = ambCfg.flowEffect || {};
      if (btnToggleBgFlow) {
        const isOn = !!flow.enabled;
        btnToggleBgFlow.className = isOn ? 'btn-condition-toggle condition-on' : 'btn-condition-toggle condition-off';
        btnToggleBgFlow.innerHTML = isOn
          ? '<span class="toggle-icon">🟢</span> <span class="toggle-text">ON</span>'
          : '<span class="toggle-icon">⚪</span> <span class="toggle-text">OFF</span>';
      }
      if (bgFlowColor) bgFlowColor.value = flow.color || '#38bdf8';
      if (bgFlowHex) bgFlowHex.innerText = flow.color || '#38bdf8';
      const flowCnt = flow.count ?? 20;
      if (bgFlowCount) bgFlowCount.value = flowCnt;
      if (bgFlowCountVal) bgFlowCountVal.innerText = `${flowCnt} 個`;
      const flowSpd = flow.speed ?? 1.0;
      if (bgFlowSpeed) bgFlowSpeed.value = flowSpd;
      if (bgFlowSpeedVal) bgFlowSpeedVal.innerText = `${flowSpd.toFixed(1)} x`;

      // 7. 浮遊微粒子 (星くず)
      const sparks = ambCfg.sparks || {};
      if (btnToggleBgSparks) {
        const isOn = !!sparks.enabled;
        btnToggleBgSparks.className = isOn ? 'btn-condition-toggle condition-on' : 'btn-condition-toggle condition-off';
        btnToggleBgSparks.innerHTML = isOn
          ? '<span class="toggle-icon">🟢</span> <span class="toggle-text">ON</span>'
          : '<span class="toggle-icon">⚪</span> <span class="toggle-text">OFF</span>';
      }
      if (bgSparksColor) bgSparksColor.value = sparks.color || '#fef08a';
      if (bgSparksHex) bgSparksHex.innerText = sparks.color || '#fef08a';
      const sparkCnt = sparks.count ?? 25;
      if (bgSparksCount) bgSparksCount.value = sparkCnt;
      if (bgSparksCountVal) bgSparksCountVal.innerText = `${sparkCnt} 個`;
      const sparkSpd = sparks.speed ?? 1.0;
      if (bgSparksSpeed) bgSparksSpeed.value = sparkSpd;
      if (bgSparksSpeedVal) bgSparksSpeedVal.innerText = `${sparkSpd.toFixed(1)} x`;

      // Bubbles count
      if (btnToggleBubbles) {
        const isBOn = ambCfg.bubbles.enabled !== false;
        btnToggleBubbles.className = isBOn ? 'btn-condition-toggle condition-on' : 'btn-condition-toggle condition-off';
        btnToggleBubbles.innerHTML = isBOn
          ? '<span class="toggle-icon">🟢</span> <span class="toggle-text">ON</span>'
          : '<span class="toggle-icon">⚪</span> <span class="toggle-text">OFF</span>';
      }
      const bCount = ambCfg.bubbles.count ?? 30;
      if (sliderBubbles) sliderBubbles.value = bCount;
      if (inputBubbles) inputBubbles.value = bCount;
      if (valBubbles) valBubbles.innerText = (bCount === 0) ? '🎲 ランダム' : `${bCount} 個`;

      // Small Fish count
      if (btnToggleSmallFish) {
        const isSFOn = ambCfg.smallFish.enabled !== false;
        btnToggleSmallFish.className = isSFOn ? 'btn-condition-toggle condition-on' : 'btn-condition-toggle condition-off';
        btnToggleSmallFish.innerHTML = isSFOn
          ? '<span class="toggle-icon">🟢</span> <span class="toggle-text">ON</span>'
          : '<span class="toggle-icon">⚪</span> <span class="toggle-text">OFF</span>';
      }
      const sfCount = ambCfg.smallFish.count ?? 15;
      if (sliderSmallFish) sliderSmallFish.value = sfCount;
      if (inputSmallFish) inputSmallFish.value = sfCount;
      if (valSmallFish) valSmallFish.innerText = (sfCount === 0) ? '🎲 ランダム' : `${sfCount} 匹`;

      // Presets List
      const presetsList = document.getElementById('adminAmbientPresetsList');
      if (presetsList) {
        presetsList.innerHTML = '';
        ambCfg.presets.forEach(p => {
          const row = document.createElement('div');
          row.className = 'ambient-preset-item';
          row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 14px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); border-radius:8px;';

          const isCustom = p.type === 'custom' || p.id.startsWith('custom_') || p.id.startsWith('studio_');
          const isTranslucent = !!p.isWhiteTranslucent;
          const icon = p.icon || (p.type === 'bubbles' ? '🫧' : p.type === 'small_fish' ? '🐟' : '🎨');

          row.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; min-width:180px;">
              <input type="checkbox" id="ambPresetToggle_${p.id}" class="amb-preset-active-check" data-id="${p.id}" ${p.enabled ? 'checked' : ''} style="cursor:pointer; width:18px; height:18px;">
              <label for="ambPresetToggle_${p.id}" style="cursor:pointer; font-weight:700; color:#fff; font-size:14px;">
                ${icon} ${p.name}
              </label>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <label style="font-size:12px; color:#cbd5e1;">個数/匹数:</label>
              <input type="number" min="0" max="100" value="${p.count ?? 5}" data-id="${p.id}" class="amb-preset-count-input admin-number-input" style="width:65px; text-align:center;">
              <span style="font-size:11px; color:#94a3b8;">${p.count === 0 ? '(🎲ランダム)' : ''}</span>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
              <button type="button" class="btn-micro amb-preset-translucent-toggle ${isTranslucent ? 'active' : ''}" data-id="${p.id}" title="白系半透明フィルター効果の切替">
                ${isTranslucent ? '👻 白系半透明: ON' : '🎨 通常カラー'}
              </button>
              ${isCustom ? `<button type="button" class="btn-micro btn-danger amb-preset-delete-btn" data-id="${p.id}" title="プリセット削除">🗑️</button>` : ''}
            </div>
          `;
          presetsList.appendChild(row);
        });

        presetsList.querySelectorAll('.amb-preset-active-check').forEach(chk => {
          chk.addEventListener('change', (e) => {
            const p = ambCfg.presets.find(x => x.id === e.target.dataset.id);
            if (p) p.enabled = e.target.checked;
            saveCurrentConfigToStorage();
          });
        });

        presetsList.querySelectorAll('.amb-preset-count-input').forEach(inp => {
          inp.addEventListener('input', (e) => {
            const p = ambCfg.presets.find(x => x.id === e.target.dataset.id);
            if (p) p.count = Math.max(0, parseInt(e.target.value, 10) || 0);
            saveCurrentConfigToStorage();
          });
        });

        presetsList.querySelectorAll('.amb-preset-translucent-toggle').forEach(btn => {
          btn.addEventListener('click', () => {
            const p = ambCfg.presets.find(x => x.id === btn.dataset.id);
            if (p) {
              p.isWhiteTranslucent = !p.isWhiteTranslucent;
              renderAmbientManager();
              saveCurrentConfigToStorage();
            }
          });
        });

        presetsList.querySelectorAll('.amb-preset-delete-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const p = ambCfg.presets.find(x => x.id === btn.dataset.id);
            if (p && confirm(`プリセット「${p.name}」を削除しますか？`)) {
              ambCfg.presets = ambCfg.presets.filter(x => x.id !== p.id);
              renderAmbientManager();
              saveCurrentConfigToStorage();
            }
          });
        });
      }
    }

    // ===== 背景素材作成 リスナー群 =====
    // 1. 背景画像読込
    bgImageFileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        const ambCfg = ensureAmbientConfig();
        if (!ambCfg.backgroundImage) ambCfg.backgroundImage = {};
        ambCfg.backgroundImage.dataUrl = evt.target.result;
        ambCfg.backgroundImage.enabled = true;
        renderAmbientManager();
        saveCurrentConfigToStorage();
        try { sound.init(); sound.playSuccess(1); } catch (err) { }
      };
      reader.readAsDataURL(file);
    });

    btnToggleBgImage?.addEventListener('click', () => {
      const ambCfg = ensureAmbientConfig();
      if (!ambCfg.backgroundImage) ambCfg.backgroundImage = {};
      ambCfg.backgroundImage.enabled = !(ambCfg.backgroundImage.enabled !== false);
      renderAmbientManager();
      saveCurrentConfigToStorage();
      try { sound.init(); sound.playTap(); } catch (err) { }
    });

    btnRemoveBgImage?.addEventListener('click', () => {
      const ambCfg = ensureAmbientConfig();
      if (ambCfg.backgroundImage) {
        ambCfg.backgroundImage.dataUrl = '';
        ambCfg.backgroundImage.enabled = false;
      }
      if (bgImageFileInput) bgImageFileInput.value = '';
      renderAmbientManager();
      saveCurrentConfigToStorage();
      try { sound.init(); sound.playTap(); } catch (err) { }
    });

    bgImageFitSelect?.addEventListener('change', (e) => {
      const ambCfg = ensureAmbientConfig();
      if (!ambCfg.backgroundImage) ambCfg.backgroundImage = {};
      ambCfg.backgroundImage.fit = e.target.value;
      saveCurrentConfigToStorage();
    });

    bgImageOpacitySlider?.addEventListener('input', (e) => {
      const ambCfg = ensureAmbientConfig();
      if (!ambCfg.backgroundImage) ambCfg.backgroundImage = {};
      const val = parseInt(e.target.value, 10) || 85;
      ambCfg.backgroundImage.opacity = val / 100;
      if (bgImageOpacityVal) bgImageOpacityVal.innerText = `${val}%`;
      saveCurrentConfigToStorage();
    });

    // 2. グラデーション
    btnToggleBgGradient?.addEventListener('click', () => {
      const ambCfg = ensureAmbientConfig();
      ambCfg.gradient.enabled = !(ambCfg.gradient.enabled !== false);
      renderAmbientManager();
      saveCurrentConfigToStorage();
      try { sound.init(); sound.playTap(); } catch (err) { }
    });
    const bindGradColor = (input, hexEl, key) => {
      input?.addEventListener('input', (e) => {
        const ambCfg = ensureAmbientConfig();
        ambCfg.gradient[key] = e.target.value;
        if (hexEl) hexEl.innerText = e.target.value;
        saveCurrentConfigToStorage();
      });
    };
    bindGradColor(bgGradTopColor, bgGradTopHex, 'topColor');
    bindGradColor(bgGradMidColor, bgGradMidHex, 'midColor');
    bindGradColor(bgGradDeepColor, bgGradDeepHex, 'deepColor');
    bindGradColor(bgGradBtmColor, bgGradBtmHex, 'bottomColor');

    // 3. 光芒
    btnToggleBgLightRays?.addEventListener('click', () => {
      const ambCfg = ensureAmbientConfig();
      ambCfg.lightRays.enabled = !(ambCfg.lightRays.enabled !== false);
      renderAmbientManager();
      saveCurrentConfigToStorage();
      try { sound.init(); sound.playTap(); } catch (err) { }
    });
    bgLightRayColor?.addEventListener('input', (e) => {
      const ambCfg = ensureAmbientConfig();
      ambCfg.lightRays.color = e.target.value;
      if (bgLightRayHex) bgLightRayHex.innerText = e.target.value;
      saveCurrentConfigToStorage();
    });
    bgLightRayIntensity?.addEventListener('input', (e) => {
      const ambCfg = ensureAmbientConfig();
      const val = parseFloat(e.target.value) || 1.0;
      ambCfg.lightRays.intensity = val;
      if (bgLightRayIntensityVal) bgLightRayIntensityVal.innerText = `${val.toFixed(1)} x`;
      saveCurrentConfigToStorage();
    });

    // 4. 地面
    btnToggleBgGround?.addEventListener('click', () => {
      const ambCfg = ensureAmbientConfig();
      ambCfg.ground.enabled = !(ambCfg.ground.enabled !== false);
      renderAmbientManager();
      saveCurrentConfigToStorage();
      try { sound.init(); sound.playTap(); } catch (err) { }
    });
    bgGroundTopColor?.addEventListener('input', (e) => {
      const ambCfg = ensureAmbientConfig();
      ambCfg.ground.topColor = e.target.value;
      if (bgGroundTopHex) bgGroundTopHex.innerText = e.target.value;
      saveCurrentConfigToStorage();
    });
    bgGroundBtmColor?.addEventListener('input', (e) => {
      const ambCfg = ensureAmbientConfig();
      ambCfg.ground.bottomColor = e.target.value;
      if (bgGroundBtmHex) bgGroundBtmHex.innerText = e.target.value;
      saveCurrentConfigToStorage();
    });
    bgGroundPlantColor?.addEventListener('input', (e) => {
      const ambCfg = ensureAmbientConfig();
      ambCfg.ground.plantColor = e.target.value;
      if (bgGroundPlantHex) bgGroundPlantHex.innerText = e.target.value;
      saveCurrentConfigToStorage();
    });
    bgGroundShowPlants?.addEventListener('change', (e) => {
      const ambCfg = ensureAmbientConfig();
      ambCfg.ground.showPlants = e.target.checked;
      saveCurrentConfigToStorage();
    });

    // 5. 泡・小魚カラー
    adminAmbientBubblesColor?.addEventListener('input', (e) => {
      const ambCfg = ensureAmbientConfig();
      ambCfg.bubbles.color = e.target.value;
      if (adminAmbientBubblesHex) adminAmbientBubblesHex.innerText = e.target.value;
      saveCurrentConfigToStorage();
    });
    adminAmbientSmallFishColor?.addEventListener('input', (e) => {
      const ambCfg = ensureAmbientConfig();
      ambCfg.smallFish.color = e.target.value;
      if (adminAmbientSmallFishHex) adminAmbientSmallFishHex.innerText = e.target.value;
      saveCurrentConfigToStorage();
    });

    // 6. 横流れエフェクト
    btnToggleBgFlow?.addEventListener('click', () => {
      const ambCfg = ensureAmbientConfig();
      ambCfg.flowEffect.enabled = !ambCfg.flowEffect.enabled;
      renderAmbientManager();
      saveCurrentConfigToStorage();
      try { sound.init(); sound.playTap(); } catch (err) { }
    });
    bgFlowColor?.addEventListener('input', (e) => {
      const ambCfg = ensureAmbientConfig();
      ambCfg.flowEffect.color = e.target.value;
      if (bgFlowHex) bgFlowHex.innerText = e.target.value;
      saveCurrentConfigToStorage();
    });
    bgFlowCount?.addEventListener('input', (e) => {
      const ambCfg = ensureAmbientConfig();
      const val = parseInt(e.target.value, 10) || 20;
      ambCfg.flowEffect.count = val;
      if (bgFlowCountVal) bgFlowCountVal.innerText = `${val} 個`;
      saveCurrentConfigToStorage();
    });
    bgFlowSpeed?.addEventListener('input', (e) => {
      const ambCfg = ensureAmbientConfig();
      const val = parseFloat(e.target.value) || 1.0;
      ambCfg.flowEffect.speed = val;
      if (bgFlowSpeedVal) bgFlowSpeedVal.innerText = `${val.toFixed(1)} x`;
      saveCurrentConfigToStorage();
    });

    // 7. 浮遊微粒子 (星くず)
    btnToggleBgSparks?.addEventListener('click', () => {
      const ambCfg = ensureAmbientConfig();
      ambCfg.sparks.enabled = !ambCfg.sparks.enabled;
      renderAmbientManager();
      saveCurrentConfigToStorage();
      try { sound.init(); sound.playTap(); } catch (err) { }
    });
    bgSparksColor?.addEventListener('input', (e) => {
      const ambCfg = ensureAmbientConfig();
      ambCfg.sparks.color = e.target.value;
      if (bgSparksHex) bgSparksHex.innerText = e.target.value;
      saveCurrentConfigToStorage();
    });
    bgSparksCount?.addEventListener('input', (e) => {
      const ambCfg = ensureAmbientConfig();
      const val = parseInt(e.target.value, 10) || 25;
      ambCfg.sparks.count = val;
      if (bgSparksCountVal) bgSparksCountVal.innerText = `${val} 個`;
      saveCurrentConfigToStorage();
    });
    bgSparksSpeed?.addEventListener('input', (e) => {
      const ambCfg = ensureAmbientConfig();
      const val = parseFloat(e.target.value) || 1.0;
      ambCfg.sparks.speed = val;
      if (bgSparksSpeedVal) bgSparksSpeedVal.innerText = `${val.toFixed(1)} x`;
      saveCurrentConfigToStorage();
    });

    // Global toggle listener
    btnToggleGlobal?.addEventListener('click', () => {
      const ambCfg = ensureAmbientConfig();
      ambCfg.enabled = !(ambCfg.enabled !== false);
      try { sound.init(); sound.playTap(); } catch (e) { }
      renderAmbientManager();
      saveCurrentConfigToStorage();
    });

    // Bubbles listeners
    btnToggleBubbles?.addEventListener('click', () => {
      const ambCfg = ensureAmbientConfig();
      ambCfg.bubbles.enabled = !(ambCfg.bubbles.enabled !== false);
      try { sound.init(); sound.playTap(); } catch (e) { }
      renderAmbientManager();
      saveCurrentConfigToStorage();
    });

    const syncBubblesCount = (val) => {
      const ambCfg = ensureAmbientConfig();
      ambCfg.bubbles.count = Math.max(0, Math.min(100, val));
      if (sliderBubbles) sliderBubbles.value = ambCfg.bubbles.count;
      if (inputBubbles) inputBubbles.value = ambCfg.bubbles.count;
      if (valBubbles) valBubbles.innerText = (ambCfg.bubbles.count === 0) ? '🎲 ランダム' : `${ambCfg.bubbles.count} 個`;
      saveCurrentConfigToStorage();
    };
    sliderBubbles?.addEventListener('input', (e) => syncBubblesCount(parseInt(e.target.value, 10) || 0));
    inputBubbles?.addEventListener('input', (e) => syncBubblesCount(parseInt(e.target.value, 10) || 0));

    // Small fish listeners
    btnToggleSmallFish?.addEventListener('click', () => {
      const ambCfg = ensureAmbientConfig();
      ambCfg.smallFish.enabled = !(ambCfg.smallFish.enabled !== false);
      try { sound.init(); sound.playTap(); } catch (e) { }
      renderAmbientManager();
      saveCurrentConfigToStorage();
    });

    const syncSmallFishCount = (val) => {
      const ambCfg = ensureAmbientConfig();
      ambCfg.smallFish.count = Math.max(0, Math.min(60, val));
      if (sliderSmallFish) sliderSmallFish.value = ambCfg.smallFish.count;
      if (inputSmallFish) inputSmallFish.value = ambCfg.smallFish.count;
      if (valSmallFish) valSmallFish.innerText = (ambCfg.smallFish.count === 0) ? '🎲 ランダム' : `${ambCfg.smallFish.count} 匹`;
      saveCurrentConfigToStorage();
    };
    sliderSmallFish?.addEventListener('input', (e) => syncSmallFishCount(parseInt(e.target.value, 10) || 0));
    inputSmallFish?.addEventListener('input', (e) => syncSmallFishCount(parseInt(e.target.value, 10) || 0));

    // Add preset
    btnAddPreset?.addEventListener('click', () => {
      const ambCfg = ensureAmbientConfig();
      const nameVal = prompt('追加する背景演出プリセットの名前を入力してください:', '🎃 ハロウィン・カボチャ');
      if (!nameVal) return;
      const iconVal = prompt('絵文字アイコンを入力してください (例: 🎃, 👻, 🌟, 🍬):', '🎃') || '✨';
      const isTranslucent = confirm('白系半透明モード（幽霊・浮遊感）を有効にしますか？\n[OK]: 有効 / [キャンセル]: 通常');
      ambCfg.presets.push({
        id: `custom_${Date.now()}`,
        name: nameVal,
        type: 'custom',
        icon: iconVal,
        enabled: true,
        count: 5,
        speed: 0.6,
        isWhiteTranslucent: isTranslucent
      });
      renderAmbientManager();
      saveCurrentConfigToStorage();
      try { sound.init(); sound.playSuccess(1); } catch (e) { }
    });

    // Save button
    btnSaveAmbient?.addEventListener('click', () => {
      saveCurrentConfigToStorage();
      try { sound.init(); sound.playSuccess(1); } catch (e) { }
      const orig = btnSaveAmbient.innerHTML;
      btnSaveAmbient.innerHTML = '✅ 保存完了！(ゲームに即時反映)';
      setTimeout(() => { btnSaveAmbient.innerHTML = orig; }, 1800);
    });

    // Reset button
    btnResetAmbient?.addEventListener('click', () => {
      if (confirm('背景演出設定をデフォルトに戻しますか？')) {
        currentConfig.ambientConfig = JSON.parse(JSON.stringify(DEFAULT_AMBIENT_CONFIG));
        renderAmbientManager();
        saveCurrentConfigToStorage();
        try { sound.init(); sound.playTap(); } catch (e) { }
        alert('背景演出設定を初期状態にリセットしました。');
      }
    });

    window.renderAmbientManager = renderAmbientManager;
    renderAmbientManager();
  }

  // ===== 🚀 簡易ビルドモード (Easy Game Generator) ウィザード ロジック =====
  function initGameBuilderWizard() {
    const modal = document.getElementById('gameBuilderModal');
    const btnOpen = document.getElementById('btnOpenGameBuilder');
    const btnCloseTop = document.getElementById('btnBuilderCloseTop');
    const btnPrev = document.getElementById('btnBuilderPrev');
    const btnNext = document.getElementById('btnBuilderNext');
    const stepTitleBadge = document.getElementById('builderStepTitleBadge');
    const stepNumText = document.getElementById('builderStepNumText');
    const stepDots = document.querySelectorAll('.b-step-dot');
    const stepPanes = document.querySelectorAll('.builder-step-pane');

    // Inputs
    const titleInput = document.getElementById('builderGameTitle');
    const nameAInput = document.getElementById('builderNameA');
    const nameBInput = document.getElementById('builderNameB');
    const nameBothInput = document.getElementById('builderNameBoth');
    const echoNameA = document.getElementById('builderEchoNameA');
    const echoNameB = document.getElementById('builderEchoNameB');

    // Cards
    const cardsTypeA = document.querySelectorAll('#builderGridTypeA .builder-type-card');
    const cardsTypeB = document.querySelectorAll('#builderGridTypeB .builder-type-card');
    const pillDisturbers = document.querySelectorAll('.builder-pill-opt[data-disturbers]');
    const pillSpecial = document.querySelectorAll('.builder-pill-opt[data-special]');
    const timeSlider = document.getElementById('builderTimeSlider');
    const timeNum = document.getElementById('builderTimeNum');
    const timePresetBtns = document.querySelectorAll('.btn-builder-time');
    const themeCards = document.querySelectorAll('#builderGridTheme .builder-theme-card');

    // Summary Elements
    const summaryTitle = document.getElementById('builderSummaryTitle');
    const summaryA = document.getElementById('builderSummaryA');
    const summaryB = document.getElementById('builderSummaryB');
    const summaryTime = document.getElementById('builderSummaryTime');
    const summaryDisturber = document.getElementById('builderSummaryDisturber');
    const summarySpecial = document.getElementById('builderSummarySpecial');
    const summaryTheme = document.getElementById('builderSummaryTheme');

    // Action buttons
    const btnExecuteBuild = document.getElementById('btnExecuteGameBuild');
    const btnExportJson = document.getElementById('btnExportBuilderJson');

    let currentStep = 1;
    const builderState = {
      title: 'ムシムシ大決戦！~クワカブ仕分けバトル~',
      nameA: 'カブトムシ',
      nameB: 'クワガタムシ',
      nameBoth: '両方仕分け名人',
      typeA: 'insect',
      typeB: 'insect',
      disturberCount: 2,
      hasSpecial: true,
      timeLimit: 60,
      theme: 'forest'
    };

    const stepTitles = [
      '',
      'Step 1: 何を仕分けさせますか？',
      'Step 2: ターゲットAのタイプ選択',
      'Step 3: ターゲットBのタイプ選択',
      'Step 4: お邪魔キャラの設定',
      'Step 5: スペシャルキャラの設定',
      'Step 6: ゲーム制限時間の設定',
      'Step 7: BGM・背景世界観の選択',
      'Step 8: ビルド＆即試遊！'
    ];

    function openWizard() {
      if (!modal) return;
      currentStep = 1;
      updateStepUI();
      modal.classList.remove('hidden');
      try { sound.init(); sound.playTap(); } catch (e) { }
    }

    function closeWizard() {
      if (!modal) return;
      modal.classList.add('hidden');
    }

    function updateStepUI() {
      stepDots.forEach(dot => {
        const step = parseInt(dot.dataset.step, 10);
        dot.classList.toggle('active', step === currentStep);
        dot.classList.toggle('completed', step < currentStep);
      });

      stepPanes.forEach((pane, idx) => {
        pane.classList.toggle('hidden', (idx + 1) !== currentStep);
        pane.classList.toggle('active', (idx + 1) === currentStep);
      });

      if (stepTitleBadge) stepTitleBadge.innerText = stepTitles[currentStep] || `Step ${currentStep}`;
      if (stepNumText) stepNumText.innerText = `Step ${currentStep} / 8`;

      if (btnPrev) btnPrev.style.display = (currentStep === 1) ? 'none' : 'inline-flex';
      if (btnNext) {
        if (currentStep === 8) {
          btnNext.style.display = 'none';
        } else {
          btnNext.style.display = 'inline-flex';
          btnNext.innerText = '次へ進む ▶';
        }
      }

      // 画面更新時の動的テキスト反映
      if (nameAInput && echoNameA) {
        builderState.nameA = nameAInput.value.trim() || 'ターゲットA';
        echoNameA.innerText = builderState.nameA;
      }
      if (nameBInput && echoNameB) {
        builderState.nameB = nameBInput.value.trim() || 'ターゲットB';
        echoNameB.innerText = builderState.nameB;
      }

      if (currentStep === 8) {
        refreshSummary();
      }
    }

    function refreshSummary() {
      builderState.title = titleInput?.value.trim() || 'オリジナル仕分けゲーム';
      builderState.nameA = nameAInput?.value.trim() || 'カブトムシ';
      builderState.nameB = nameBInput?.value.trim() || 'クワガタムシ';
      builderState.nameBoth = nameBothInput?.value.trim() || '両方仕分け名人';

      if (summaryTitle) summaryTitle.innerText = `🎮 ${builderState.title}`;
      if (summaryA) summaryA.innerText = `${builderState.nameA} (${getTypeLabel(builderState.typeA)})`;
      if (summaryB) summaryB.innerText = `${builderState.nameB} (${getTypeLabel(builderState.typeB)})`;
      if (summaryTime) summaryTime.innerText = `${builderState.timeLimit} 秒`;
      if (summaryDisturber) summaryDisturber.innerText = `${builderState.disturberCount} 種類`;
      if (summarySpecial) summarySpecial.innerText = builderState.hasSpecial ? 'あり (ぶーちゃん/金ボーナス)' : 'なし';
      if (summaryTheme) summaryTheme.innerText = getThemeLabel(builderState.theme);
    }

    function getTypeLabel(type) {
      const map = { insect: '甲虫・昆虫系', fish: '魚系', biped: '２足歩行', quad: '４足歩行', text: '文字・記号' };
      return map[type] || type;
    }

    function getThemeLabel(theme) {
      const map = { forest: '深緑の森 (自然)', ocean: 'オーシャンブルー', sunset: '夕焼けサンセット', night: '星空ナイト', simple: 'シンプルダーク' };
      return map[theme] || theme;
    }

    btnOpen?.addEventListener('click', openWizard);
    btnCloseTop?.addEventListener('click', closeWizard);
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) closeWizard();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
        closeWizard();
      }
    });

    btnNext?.addEventListener('click', () => {
      if (currentStep < 8) {
        currentStep++;
        updateStepUI();
        try { sound.init(); sound.playTap(); } catch (e) { }
      }
    });

    btnPrev?.addEventListener('click', () => {
      if (currentStep > 1) {
        currentStep--;
        updateStepUI();
        try { sound.init(); sound.playTap(); } catch (e) { }
      }
    });

    stepDots.forEach(dot => {
      dot.addEventListener('click', () => {
        currentStep = parseInt(dot.dataset.step, 10);
        updateStepUI();
        try { sound.init(); sound.playTap(); } catch (e) { }
      });
    });

    // Step 2 & 3: カード選択
    cardsTypeA.forEach(c => {
      c.addEventListener('click', () => {
        cardsTypeA.forEach(x => x.classList.remove('active'));
        c.classList.add('active');
        builderState.typeA = c.dataset.type;
        try { sound.init(); sound.playTap(); } catch (e) { }
      });
    });

    cardsTypeB.forEach(c => {
      c.addEventListener('click', () => {
        cardsTypeB.forEach(x => x.classList.remove('active'));
        c.classList.add('active');
        builderState.typeB = c.dataset.type;
        try { sound.init(); sound.playTap(); } catch (e) { }
      });
    });

    // Step 4: お邪魔キャラ数
    pillDisturbers.forEach(p => {
      p.addEventListener('click', () => {
        pillDisturbers.forEach(x => x.classList.remove('active'));
        p.classList.add('active');
        builderState.disturberCount = parseInt(p.dataset.disturbers, 10);
        try { sound.init(); sound.playTap(); } catch (e) { }
      });
    });

    // Step 5: スペシャルキャラ
    pillSpecial.forEach(p => {
      p.addEventListener('click', () => {
        pillSpecial.forEach(x => x.classList.remove('active'));
        p.classList.add('active');
        builderState.hasSpecial = p.dataset.special === 'yes';
        try { sound.init(); sound.playTap(); } catch (e) { }
      });
    });

    // Step 6: 制限時間
    const syncBuilderTime = (val) => {
      const num = Math.max(10, Math.min(300, parseInt(val, 10) || 60));
      builderState.timeLimit = num;
      if (timeSlider) timeSlider.value = num;
      if (timeNum) timeNum.value = num;
      timePresetBtns.forEach(b => b.classList.toggle('active', parseInt(b.dataset.val, 10) === num));
    };
    timeSlider?.addEventListener('input', (e) => syncBuilderTime(e.target.value));
    timeNum?.addEventListener('change', (e) => syncBuilderTime(e.target.value));
    timePresetBtns.forEach(b => {
      b.addEventListener('click', () => {
        syncBuilderTime(b.dataset.val);
        try { sound.init(); sound.playTap(); } catch (e) { }
      });
    });

    // Step 7: テーマ
    themeCards.forEach(c => {
      c.addEventListener('click', () => {
        themeCards.forEach(x => x.classList.remove('active'));
        c.classList.add('active');
        builderState.theme = c.dataset.theme;
        try { sound.init(); sound.playTap(); } catch (e) { }
      });
    });

    // Step 8: ビルド処理
    function generateBuiltConfig() {
      refreshSummary();
      const cfg = JSON.parse(JSON.stringify(currentConfig));

      // 1. タイトル画面
      if (!cfg.titleScreen) cfg.titleScreen = {};
      if (!cfg.titleScreen.mainTitle) cfg.titleScreen.mainTitle = {};
      cfg.titleScreen.mainTitle.text = builderState.title;
      cfg.titleScreen.mainTitle.textByLang = {
        ja: builderState.title,
        en: builderState.title,
        ko: builderState.title,
        zh: builderState.title
      };

      // 2. モード選択画面
      if (!cfg.modeSelectScreen) cfg.modeSelectScreen = {};
      if (!cfg.modeSelectScreen.modes) cfg.modeSelectScreen.modes = {};
      cfg.modeSelectScreen.modes.karei = {
        nameByLang: { ja: `${builderState.nameA}派`, en: `${builderState.nameA} Faction`, ko: `${builderState.nameA}파`, zh: `${builderState.nameA}派` },
        descByLang: { ja: `ひたすら【${builderState.nameA}】だけを仕分け・タップ！`, en: `Catch only ${builderState.nameA}!`, ko: `${builderState.nameA}만 집중 포획!`, zh: `只分流【${builderState.nameA}】！` }
      };
      cfg.modeSelectScreen.modes.hirame = {
        nameByLang: { ja: `${builderState.nameB}派`, en: `${builderState.nameB} Faction`, ko: `${builderState.nameB}파`, zh: `${builderState.nameB}派` },
        descByLang: { ja: `ひたすら【${builderState.nameB}】だけを仕分け・タップ！`, en: `Catch only ${builderState.nameB}!`, ko: `${builderState.nameB}만 집중 포획!`, zh: `只分流【${builderState.nameB}】！` }
      };
      cfg.modeSelectScreen.modes.hirai = {
        nameByLang: { ja: `${builderState.nameBoth}`, en: 'Sorting Master', ko: '양쪽 분류 마스터', zh: '两面分流大师' },
        descByLang: { ja: `【${builderState.nameA}】と【${builderState.nameB}】を左右のバケツへ振り分けろ！`, en: `Sort ${builderState.nameA} & ${builderState.nameB}!`, ko: '양쪽 모두 능숙하게 분류!', zh: '双向快速准确分流！' }
      };

      // 3. バケツ名
      if (!Array.isArray(cfg.buckets) || cfg.buckets.length < 2) {
        cfg.buckets = [
          { id: 'bucketA', name: builderState.nameA, key: 'A', icon: '🅰️', color: '#0284c7' },
          { id: 'bucketB', name: builderState.nameB, key: 'B', icon: '🅱️', color: '#ec4899' }
        ];
      } else {
        cfg.buckets[0].name = builderState.nameA;
        cfg.buckets[1].name = builderState.nameB;
      }

      // 4. キャラクター構成・役割
      // kareiをターゲットA、hirameをターゲットBに割り当て
      if (!cfg.characters) cfg.characters = {};
      if (cfg.characters.karei) {
        cfg.characters.karei.name = builderState.nameA;
        cfg.characters.karei.targetBucketId = 'bucketA';
        cfg.characters.karei.points = 10;
        cfg.characters.karei.weight = 100;
      }
      if (cfg.characters.hirame) {
        cfg.characters.hirame.name = builderState.nameB;
        cfg.characters.hirame.targetBucketId = 'bucketB';
        cfg.characters.hirame.points = 10;
        cfg.characters.hirame.weight = 100;
      }

      // お邪魔キャラの有効/無効
      const disturbers = ['octopus', 'squid', 'ray', 'sole'];
      disturbers.forEach((dId, idx) => {
        if (cfg.characters[dId]) {
          cfg.characters[dId].targetBucketId = 'disturber';
          cfg.characters[dId].weight = (idx < builderState.disturberCount) ? 50 : 0;
          cfg.characters[dId].points = -5;
        }
      });

      // スペシャルキャラ
      if (cfg.characters.pig_fortune) {
        cfg.characters.pig_fortune.weight = builderState.hasSpecial ? 15 : 0;
        cfg.characters.pig_fortune.points = 100;
      }

      // 5. 制限時間
      cfg.timeLimitSec = builderState.timeLimit;
      if (!cfg.modeConfigs) cfg.modeConfigs = {};
      ['karei', 'hirame', 'hirai'].forEach(m => {
        if (!cfg.modeConfigs[m]) cfg.modeConfigs[m] = {};
        cfg.modeConfigs[m].timeLimitSec = builderState.timeLimit;
      });

      // 6. 背景テーマ
      if (!cfg.ambientConfig) cfg.ambientConfig = JSON.parse(JSON.stringify(DEFAULT_AMBIENT_CONFIG));
      if (!cfg.ambientConfig.gradient) cfg.ambientConfig.gradient = {};
      if (!cfg.ambientConfig.ground) cfg.ambientConfig.ground = {};
      if (!cfg.ambientConfig.flowEffect) cfg.ambientConfig.flowEffect = {};
      if (!cfg.ambientConfig.sparks) cfg.ambientConfig.sparks = {};

      if (builderState.theme === 'forest') {
        // 深緑の森
        cfg.ambientConfig.gradient = { enabled: true, topColor: '#064e3b', midColor: '#065f46', deepColor: '#047857', bottomColor: '#022c22' };
        cfg.ambientConfig.ground = { enabled: true, topColor: '#451a03', bottomColor: '#271004', plantColor: '#16a34a', showPlants: true };
        cfg.ambientConfig.flowEffect = { enabled: true, count: 20, color: '#4ade80', speed: 1.0 };
        cfg.ambientConfig.sparks = { enabled: true, count: 25, color: '#fef08a', speed: 0.8 }; // ホタル
      } else if (builderState.theme === 'sunset') {
        // 夕焼け
        cfg.ambientConfig.gradient = { enabled: true, topColor: '#ea580c', midColor: '#c2410c', deepColor: '#9a3412', bottomColor: '#431407' };
        cfg.ambientConfig.ground = { enabled: true, topColor: '#78350f', bottomColor: '#451a03', plantColor: '#d97706', showPlants: true };
        cfg.ambientConfig.flowEffect = { enabled: true, count: 25, color: '#fdba74', speed: 1.2 };
        cfg.ambientConfig.sparks = { enabled: true, count: 20, color: '#fed7aa', speed: 1.0 };
      } else if (builderState.theme === 'night') {
        // 星空ナイト
        cfg.ambientConfig.gradient = { enabled: true, topColor: '#0f172a', midColor: '#1e1b4b', deepColor: '#0f172a', bottomColor: '#020617' };
        cfg.ambientConfig.ground = { enabled: true, topColor: '#1e293b', bottomColor: '#0f172a', plantColor: '#38bdf8', showPlants: true };
        cfg.ambientConfig.flowEffect = { enabled: false, count: 10, color: '#38bdf8', speed: 1.0 };
        cfg.ambientConfig.sparks = { enabled: true, count: 40, color: '#fef08a', speed: 0.7 }; // 星くず
      } else if (builderState.theme === 'simple') {
        // シンプルダーク
        cfg.ambientConfig.gradient = { enabled: true, topColor: '#18181b', midColor: '#27272a', deepColor: '#18181b', bottomColor: '#09090b' };
        cfg.ambientConfig.ground = { enabled: false, topColor: '#27272a', bottomColor: '#18181b', plantColor: '#71717a', showPlants: false };
        cfg.ambientConfig.flowEffect = { enabled: false, count: 10, color: '#a1a1aa', speed: 1.0 };
        cfg.ambientConfig.sparks = { enabled: false, count: 15, color: '#ffffff', speed: 1.0 };
      } else {
        // ocean
        cfg.ambientConfig.gradient = { enabled: true, topColor: '#0284c7', midColor: '#0369a1', deepColor: '#075985', bottomColor: '#0c2340' };
        cfg.ambientConfig.ground = { enabled: true, topColor: '#786047', bottomColor: '#3b2b1d', plantColor: '#15803d', showPlants: true };
        cfg.ambientConfig.flowEffect = { enabled: true, count: 20, color: '#38bdf8', speed: 1.2 };
        cfg.ambientConfig.sparks = { enabled: false, count: 20, color: '#ffffff', speed: 1.0 };
      }

      return cfg;
    }

    btnExecuteBuild?.addEventListener('click', () => {
      try { sound.init(); sound.playSuccess(2); } catch (e) { }
      const newCfg = generateBuiltConfig();
      currentConfig = newCfg;
      saveCurrentConfigToStorage();

      if (typeof syncTimeLimitUI === 'function') syncTimeLimitUI();
      if (typeof renderAmbientManager === 'function') renderAmbientManager();

      closeWizard();

      // 即時反映とゲーム起動案内
      alert(`🎉 新規ゲーム【${builderState.title}】をビルドしました！\n\n・🅰️ ${builderState.nameA} vs 🅱️ ${builderState.nameB}\n・⏱️ 制限時間: ${builderState.timeLimit}秒\n・🎨 テーマ: ${getThemeLabel(builderState.theme)}\n\n別タブで新規ゲームを起動します！`);
      window.open('index.html', '_blank');
    });

    btnExportJson?.addEventListener('click', () => {
      try { sound.init(); sound.playTap(); } catch (e) { }
      const newCfg = generateBuiltConfig();
      const blob = new Blob([JSON.stringify(newCfg, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `custom_game_${builderState.nameA}_vs_${builderState.nameB}_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  try {
    initAmbientManager();
  } catch (err) {
    console.error('initAmbientManager initialization error:', err);
  }

  try {
    initGameBuilderWizard();
  } catch (err) {
    console.error('initGameBuilderWizard initialization error:', err);
  }

  // ===== 全キャラ網羅JSONファイル (保存 & 読込) =====
  function initAllCharactersJsonHandlers() {
    const btnExport = document.getElementById('btnExportAllCharsJson');
    const fileImport = document.getElementById('fileImportAllCharsJson');

    btnExport?.addEventListener('click', () => {
      try { sound.init(); sound.playTap(); } catch (e) { }
      let customRoster = {};
      try { customRoster = JSON.parse(localStorage.getItem('hirame_custom_roster') || '{}'); } catch (e) { }
      let customChar = null;
      try { customChar = JSON.parse(localStorage.getItem('hirame_custom_character') || 'null'); } catch (e) { }

      const charsBundle = {
        version: "2.0",
        type: "HOK_ALL_CHARACTERS_DATA",
        exportedAt: new Date().toISOString(),
        characters: currentConfig.characters,
        modeConfigs: currentConfig.modeConfigs,
        characterLore: currentConfig.characterLore,
        customRoster,
        customCharacter: customChar
      };
      const blob = new Blob([JSON.stringify(charsBundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hok_all_characters_data_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    fileImport?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = JSON.parse(evt.target.result);
          if (!data || typeof data !== 'object') throw new Error('Invalid JSON format');
          if (data.characters) currentConfig.characters = data.characters;
          if (data.modeConfigs) currentConfig.modeConfigs = data.modeConfigs;
          if (data.characterLore) currentConfig.characterLore = normalizeCharacterLore(data.characterLore);
          if (data.customRoster) localStorage.setItem('hirame_custom_roster', JSON.stringify(data.customRoster));
          if (data.customCharacter) localStorage.setItem('hirame_custom_character', JSON.stringify(data.customCharacter));

          localStorage.setItem('hirame_dev_config', JSON.stringify(currentConfig));
          adminChannel?.postMessage({ type: 'UPDATE_DEV_CONFIG', config: currentConfig });
          if (data.customRoster) {
            adminChannel?.postMessage({ type: 'UPDATE_CUSTOM_ROSTER', roster: data.customRoster });
          }

          sound.init();
          sound.playChime();
          if (btnExport) {
            const orig = btnExport.innerHTML;
            btnExport.innerHTML = '<span>✅</span> 全キャラJSON読込完了！';
            setTimeout(() => { btnExport.innerHTML = orig; }, 2500);
          }
          if (typeof window.renderLoreManager === 'function') window.renderLoreManager();
        } catch (err) {
          console.error('All chars import error:', err);
          alert('JSONファイルの読み込みに失敗しました。ファイル形式を確認してください。');
        }
        e.target.value = '';
      };
      reader.readAsText(file);
    });
  }

  try {
    initAllCharactersJsonHandlers();
  } catch (err) {
    console.error('initAllCharactersJsonHandlers error:', err);
  }

  // ===== ゲーム設定全網羅JSONファイル (保存 & 読込) =====
  function initAllGameDataJsonHandlers() {
    const btnExport = document.getElementById('btnExportAllGameData');
    const fileImport = document.getElementById('fileImportAllGameData');

    btnExport?.addEventListener('click', () => {
      try { sound.init(); sound.playTap(); } catch (e) { }
      let lb = [];
      try { lb = JSON.parse(localStorage.getItem('hirame_leaderboard') || '[]'); } catch (e) { }
      let blk = [];
      try { blk = JSON.parse(localStorage.getItem('hirame_blocked_users') || '[]'); } catch (e) { }
      let bgm = [];
      try { bgm = JSON.parse(localStorage.getItem('hirame_bgm_playlist') || '[]'); } catch (e) { }
      let roster = {};
      try { roster = JSON.parse(localStorage.getItem('hirame_custom_roster') || '{}'); } catch (e) { }
      let customChar = null;
      try { customChar = JSON.parse(localStorage.getItem('hirame_custom_character') || 'null'); } catch (e) { }

      const gameBundle = {
        version: "2.0",
        type: "HOK_COMPLETE_GAME_DATA",
        exportedAt: new Date().toISOString(),
        devConfig: currentConfig,
        leaderboard: lb,
        blockedUsers: blk,
        bgmPlaylist: bgm,
        customRoster: roster,
        customCharacter: customChar
      };
      const blob = new Blob([JSON.stringify(gameBundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hok_complete_game_data_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    fileImport?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = JSON.parse(evt.target.result);
          if (!data || typeof data !== 'object') throw new Error('Invalid JSON format');
          if (data.devConfig) {
            currentConfig = { ...currentConfig, ...data.devConfig };
            if (currentConfig.characterLore) {
              currentConfig.characterLore = normalizeCharacterLore(currentConfig.characterLore);
            }
            localStorage.setItem('hirame_dev_config', JSON.stringify(currentConfig));
          }
          if (data.leaderboard) localStorage.setItem('hirame_leaderboard', JSON.stringify(data.leaderboard));
          if (data.blockedUsers) localStorage.setItem('hirame_blocked_users', JSON.stringify(data.blockedUsers));
          if (data.bgmPlaylist) {
            sound.setPlaylist(data.bgmPlaylist);
            localStorage.setItem('hirame_bgm_playlist', JSON.stringify(data.bgmPlaylist));
          }
          if (data.customRoster) localStorage.setItem('hirame_custom_roster', JSON.stringify(data.customRoster));
          if (data.customCharacter) localStorage.setItem('hirame_custom_character', JSON.stringify(data.customCharacter));

          adminChannel?.postMessage({ type: 'UPDATE_DEV_CONFIG', config: currentConfig });
          adminChannel?.postMessage({ type: 'UPDATE_LEADERBOARD', leaderboard: data.leaderboard });
          adminChannel?.postMessage({ type: 'UPDATE_BLOCKED_USERS', blockedUsers: data.blockedUsers });
          if (data.bgmPlaylist) adminChannel?.postMessage({ type: 'UPDATE_BGM_PLAYLIST', playlist: data.bgmPlaylist });
          if (data.customRoster) adminChannel?.postMessage({ type: 'UPDATE_CUSTOM_ROSTER', roster: data.customRoster });

          sound.init();
          sound.playChime();
          if (btnExport) {
            const orig = btnExport.innerHTML;
            btnExport.innerHTML = '<span>✅</span> 全データ読込完了！';
            setTimeout(() => { btnExport.innerHTML = orig; }, 2500);
          }

          if (typeof window.renderLoreManager === 'function') window.renderLoreManager();
          if (typeof window.renderRankingManager === 'function') window.renderRankingManager();
          if (typeof updateTitleModeMockup === 'function') updateTitleModeMockup();
        } catch (err) {
          console.error('Complete game data import error:', err);
          alert('JSONファイルの読み込みに失敗しました。ファイル形式を確認してください。');
        }
        e.target.value = '';
      };
      reader.readAsText(file);
    });
  }

  try {
    initAllGameDataJsonHandlers();
  } catch (err) {
    console.error('initAllGameDataJsonHandlers error:', err);
  }

  // ===== 8項目別 JSONバックアップ (エクスポート & インポート) =====
  function initSectionBackupHandlers() {
    function exportSectionJson(section) {
      let exportData = null;
      const timestamp = new Date().toISOString();
      const fnPrefix = `hok_${section}_backup`;

      switch (section) {
        case 'params':
          exportData = {
            section: 'params',
            name: 'パラメーター設定 (遊泳・判定・バランス)',
            timestamp,
            speedMultiplier: currentConfig.speedMultiplier,
            lifetimeSec: currentConfig.lifetimeSec,
            minTargetThreshold: currentConfig.minTargetThreshold,
            refillTargetCount: currentConfig.refillTargetCount,
            targetFishCount: currentConfig.targetFishCount,
            randomTurnRate: currentConfig.randomTurnRate,
            dispersionRate: currentConfig.dispersionRate,
            collisionRepulsion: currentConfig.collisionRepulsion,
            startConfig: currentConfig.startConfig,
            baitConfig: currentConfig.baitConfig,
            silhouetteConfig: currentConfig.silhouetteConfig,
            chaosFeverConfig: currentConfig.chaosFeverConfig,
            buckets: currentConfig.buckets,
            characters: currentConfig.characters,
            modeConfigs: currentConfig.modeConfigs,
            activeConfigMode: currentConfig.activeConfigMode,
            gameBalanceUnified: currentConfig.gameBalanceUnified
          };
          break;
        case 'bgm':
          exportData = {
            section: 'bgm',
            name: '音量・BGM設定 ＆ プレイリスト',
            timestamp,
            bgmConfig: currentConfig.bgmConfig,
            bgmBannerConfig: currentConfig.bgmBannerConfig,
            bgmVolume: currentConfig.bgmVolume,
            seVolume: currentConfig.seVolume,
            masterVolume: currentConfig.masterVolume,
            bgmPlaylist: sound.getPlaylist?.() || []
          };
          break;
        case 'titles':
          exportData = {
            section: 'titles',
            name: '称号一覧エディタ',
            timestamp,
            playerTitles: currentConfig.playerTitles || DEFAULT_PLAYER_TITLES
          };
          break;
        case 'xshare':
          exportData = {
            section: 'xshare',
            name: '𝕏 結果シェア文言テンプレート',
            timestamp,
            xShareTemplate: currentConfig.xShareTemplate || DEFAULT_X_SHARE_TEMPLATE,
            xShareTemplates: currentConfig.xShareTemplates || DEFAULT_X_SHARE_TEMPLATES,
            xShareUrl: currentConfig.xShareUrl || ''
          };
          break;
        case 'titleMode':
          exportData = {
            section: 'titleMode',
            name: 'タイトル＆モード画面設定',
            timestamp,
            titleScreen: currentConfig.titleScreen || DEFAULT_TITLE_SCREEN,
            modeSelectScreen: currentConfig.modeSelectScreen || DEFAULT_MODE_SELECT_SCREEN
          };
          break;
        case 'ranking':
          exportData = {
            section: 'ranking',
            name: 'ランキング管理データ',
            timestamp,
            ranking: currentConfig.ranking || [],
            rankingBlacklist: currentConfig.rankingBlacklist || [],
            localLeaderboard: JSON.parse(localStorage.getItem('hirame_leaderboard') || '[]'),
            blockedUsers: JSON.parse(localStorage.getItem('hirame_blocked_users') || '[]')
          };
          break;
        case 'lore':
          exportData = {
            section: 'lore',
            name: 'キャラ図鑑 編集設定',
            timestamp,
            characterLore: currentConfig.characterLore || DEFAULT_CHARACTER_LORE
          };
          break;
        case 'ambient':
          exportData = {
            section: 'ambient',
            name: '背景演出設定 (泡・小魚・プリセット)',
            timestamp,
            ambientConfig: currentConfig.ambientConfig || DEFAULT_AMBIENT_CONFIG
          };
          break;
      }

      if (!exportData) return;
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fnPrefix}_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      try { sound.init(); sound.playChime(); } catch (e) { }
    }

    function importSectionJson(section, file, triggerBtn) {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (!data || typeof data !== 'object') throw new Error('Invalid JSON format');

          switch (section) {
            case 'params':
              if (data.characters) currentConfig.characters = data.characters;
              if (data.modeConfigs) currentConfig.modeConfigs = data.modeConfigs;
              if (data.speedMultiplier !== undefined) currentConfig.speedMultiplier = data.speedMultiplier;
              if (data.lifetimeSec !== undefined) currentConfig.lifetimeSec = data.lifetimeSec;
              if (data.minTargetThreshold !== undefined) currentConfig.minTargetThreshold = data.minTargetThreshold;
              if (data.refillTargetCount !== undefined) currentConfig.refillTargetCount = data.refillTargetCount;
              if (data.targetFishCount !== undefined) currentConfig.targetFishCount = data.targetFishCount;
              if (data.randomTurnRate !== undefined) currentConfig.randomTurnRate = data.randomTurnRate;
              if (data.dispersionRate !== undefined) currentConfig.dispersionRate = data.dispersionRate;
              if (data.collisionRepulsion !== undefined) currentConfig.collisionRepulsion = data.collisionRepulsion;
              if (data.startConfig) currentConfig.startConfig = data.startConfig;
              if (data.baitConfig) currentConfig.baitConfig = data.baitConfig;
              if (data.silhouetteConfig) currentConfig.silhouetteConfig = data.silhouetteConfig;
              if (data.chaosFeverConfig) currentConfig.chaosFeverConfig = data.chaosFeverConfig;
              if (data.buckets) currentConfig.buckets = data.buckets;
              initStartSettingsUI();
              initBaitSettingsUI();
              loadCharConfig(activeCharId);
              syncSimCanvasCount();
              break;
            case 'bgm':
              if (data.bgmConfig) currentConfig.bgmConfig = data.bgmConfig;
              if (data.bgmBannerConfig) currentConfig.bgmBannerConfig = data.bgmBannerConfig;
              if (data.bgmVolume !== undefined) currentConfig.bgmVolume = data.bgmVolume;
              if (data.seVolume !== undefined) currentConfig.seVolume = data.seVolume;
              if (data.masterVolume !== undefined) currentConfig.masterVolume = data.masterVolume;
              if (Array.isArray(data.bgmPlaylist) && data.bgmPlaylist.length > 0) {
                sound.setPlaylist(data.bgmPlaylist);
                localStorage.setItem('hirame_bgm_playlist', JSON.stringify(data.bgmPlaylist));
              }
              if (typeof renderAdminBgmList === 'function') renderAdminBgmList();
              break;
            case 'titles':
              if (Array.isArray(data.playerTitles)) {
                currentConfig.playerTitles = data.playerTitles;
              }
              if (typeof renderTitlesList === 'function') renderTitlesList();
              break;
            case 'xshare':
              if (data.xShareTemplate) currentConfig.xShareTemplate = data.xShareTemplate;
              if (data.xShareTemplates) currentConfig.xShareTemplates = data.xShareTemplates;
              if (data.xShareUrl !== undefined) currentConfig.xShareUrl = data.xShareUrl;
              if (typeof updateXSharePreview === 'function') updateXSharePreview();
              break;
            case 'titleMode':
              if (data.titleScreen) currentConfig.titleScreen = data.titleScreen;
              if (data.modeSelectScreen) currentConfig.modeSelectScreen = data.modeSelectScreen;
              if (typeof updateTitleModeMockup === 'function') updateTitleModeMockup();
              break;
            case 'ranking':
              if (Array.isArray(data.localLeaderboard)) {
                localStorage.setItem('hirame_leaderboard', JSON.stringify(data.localLeaderboard));
              }
              if (Array.isArray(data.blockedUsers)) {
                localStorage.setItem('hirame_blocked_users', JSON.stringify(data.blockedUsers));
              }
              if (typeof renderAdminRankingTable === 'function') renderAdminRankingTable();
              break;
            case 'lore':
              if (Array.isArray(data.characterLore)) {
                currentConfig.characterLore = normalizeCharacterLore(data.characterLore);
              }
              if (typeof renderLoreTable === 'function') renderLoreTable();
              break;
            case 'ambient':
              if (data.ambientConfig) {
                currentConfig.ambientConfig = data.ambientConfig;
              }
              if (typeof renderAmbientPresetsTable === 'function') renderAmbientPresetsTable();
              break;
          }

          saveCurrentConfigToStorage();
          try { sound.init(); sound.playChime(); } catch (e) { }

          if (triggerBtn) {
            const orig = triggerBtn.innerHTML;
            triggerBtn.innerHTML = '<span>✅</span> 読込完了！';
            setTimeout(() => { triggerBtn.innerHTML = orig; }, 2200);
          }
        } catch (err) {
          console.error(`Section [${section}] JSON import error:`, err);
          alert(`【${section}】JSONファイルの読み込みに失敗しました。ファイル形式を確認してください。`);
        }
      };
      reader.readAsText(file);
    }

    // エクスポートボタン紐付け
    document.querySelectorAll('.btn-export-section').forEach(btn => {
      btn.addEventListener('click', () => {
        const sec = btn.dataset.section;
        if (sec) {
          exportSectionJson(sec);
          const orig = btn.innerHTML;
          btn.innerHTML = '<span>✅</span> 保存完了！';
          setTimeout(() => { btn.innerHTML = orig; }, 2000);
        }
      });
    });

    // インポートファイル入力紐付け
    document.querySelectorAll('.file-import-section').forEach(input => {
      input.addEventListener('change', (e) => {
        const sec = input.dataset.section;
        const file = e.target.files?.[0];
        const label = input.closest('label');
        if (sec && file) {
          importSectionJson(sec, file, label);
        }
        e.target.value = '';
      });
    });
  }

  try {
    initSectionBackupHandlers();
  } catch (err) {
    console.error('initSectionBackupHandlers error:', err);
  }

  // ===== 管理コンソール全域: 数値入力 ＆ 全数値ピル(.val-pill)の左右ドラッグ＆クリック手入力 =====
  function setupGlobalNumberScrubbing() {
    // 1. input[type="number"] のドラッグ＆クリック選択
    document.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const numInput = e.target.closest('input[type="number"]');
      if (!numInput || numInput.disabled || numInput.readOnly) return;

      const startX = e.clientX;
      const startVal = parseFloat(numInput.value) || 0;
      let hasDragged = false;

      const rawStep = numInput.getAttribute('step');
      let step = (rawStep && rawStep !== 'any') ? parseFloat(rawStep) : 1;
      if (isNaN(step) || step <= 0) step = 1;

      let precision = 0;
      if (rawStep && rawStep.includes('.')) {
        precision = rawStep.split('.')[1].length;
      } else if (step < 1) {
        precision = String(step).split('.')[1]?.length || 1;
      }

      const rawMin = numInput.getAttribute('min');
      const min = (rawMin !== null && rawMin !== '') ? parseFloat(rawMin) : -Infinity;
      const rawMax = numInput.getAttribute('max');
      const max = (rawMax !== null && rawMax !== '') ? parseFloat(rawMax) : Infinity;

      const onPointerMove = (me) => {
        const dx = me.clientX - startX;
        if (Math.abs(dx) > 3) hasDragged = true;
        if (!hasDragged) return;

        me.preventDefault();
        const speed = me.shiftKey ? 5 : (me.altKey ? 0.1 : 1);
        let nextVal = startVal + dx * speed * step * 0.4;
        if (!isNaN(min)) nextVal = Math.max(min, nextVal);
        if (!isNaN(max)) nextVal = Math.min(max, nextVal);

        numInput.value = precision > 0 ? nextVal.toFixed(precision) : Math.round(nextVal);
        numInput.dispatchEvent(new Event('input', { bubbles: true }));
        numInput.dispatchEvent(new Event('change', { bubbles: true }));
      };

      const onPointerUp = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        if (!hasDragged) {
          numInput.focus();
          numInput.select();
        } else {
          numInput.blur();
        }
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    });

    // 2. 全 .val-pill およびスライダー数値表示部分の左右ドラッグ ＆ クリック手入力
    document.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const pill = e.target.closest('.val-pill, .bulk-title, [id$="Val"]');
      if (!pill || pill.closest('table') || pill.querySelector('input')) return;

      // 紐付くスライダー (input[type="range"]) を多角的に検索
      let slider = null;
      const parentBlock = pill.closest('.form-group, .label-row, .slider-with-knob-row, .matrix-bulk-scale-bar, .bulk-scale-controls, .settings-block');
      if (parentBlock) {
        slider = parentBlock.querySelector('input[type="range"]');
      }
      if (!slider && pill.id && pill.id.endsWith('Val')) {
        const baseId = pill.id.slice(0, -3);
        slider = document.getElementById(baseId) || document.getElementById(baseId + 'Slider');
      }

      if (!slider) return;

      e.preventDefault();
      const startX = e.clientX;
      const startSliderVal = parseFloat(slider.value) || 0;
      let hasDragged = false;
      document.body.style.cursor = 'ew-resize';

      const sMin = parseFloat(slider.min || 0);
      const sMax = parseFloat(slider.max || 100);
      const sStep = parseFloat(slider.step || (sMax <= 1 ? 0.01 : 1)) || 0.01;
      const isPercentSlider = (sMax <= 1.05 && sMin >= 0 && (pill.innerText.includes('%') || slider.id.toLowerCase().includes('vol')));

      const onPointerMove = (me) => {
        const dx = me.clientX - startX;
        if (Math.abs(dx) > 3) hasDragged = true;
        if (!hasDragged) return;

        me.preventDefault();
        const speed = me.shiftKey ? 5 : (me.altKey ? 0.15 : 1);
        const span = sMax - sMin;
        const sensitivity = span / 200;
        let nextVal = startSliderVal + dx * speed * sensitivity;
        nextVal = Math.round(nextVal / sStep) * sStep;
        nextVal = Math.max(sMin, Math.min(sMax, nextVal));

        slider.value = nextVal;
        slider.dispatchEvent(new Event('input', { bubbles: true }));
        slider.dispatchEvent(new Event('change', { bubbles: true }));
      };

      const onPointerUp = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        document.body.style.cursor = '';

        if (!hasDragged) {
          // 単純クリック時: 手入力インライン入力フィールドを起動
          startPillInlineEdit(pill, slider, isPercentSlider, sMin, sMax, sStep);
        }
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    });

    function startPillInlineEdit(pill, slider, isPercent, sMin, sMax, sStep) {
      if (pill.querySelector('input') || pill.nextElementSibling?.classList.contains('pill-scrub-input')) return;

      const origText = pill.innerText.trim();
      let initVal = parseFloat(slider.value);
      if (isPercent) {
        initVal = Math.round(initVal * 100);
      } else {
        const match = origText.match(/[-+]?[0-9]*\.?[0-9]+/);
        if (match) initVal = parseFloat(match[0]);
      }

      pill.style.display = 'none';

      const inlineInput = document.createElement('input');
      inlineInput.type = 'number';
      inlineInput.className = 'admin-text-input pill-scrub-input';
      inlineInput.value = isNaN(initVal) ? '' : initVal;
      inlineInput.step = isPercent ? '1' : String(sStep);
      inlineInput.style.width = '70px';
      inlineInput.style.height = '24px';
      inlineInput.style.padding = '0 6px';
      inlineInput.style.fontSize = '12px';
      inlineInput.style.fontWeight = '800';
      inlineInput.style.textAlign = 'center';
      inlineInput.style.background = '#0f172a';
      inlineInput.style.color = '#38bdf8';
      inlineInput.style.border = '1px solid #38bdf8';
      inlineInput.style.borderRadius = '9999px';
      inlineInput.style.outline = 'none';
      inlineInput.style.boxShadow = '0 0 10px rgba(56, 189, 248, 0.5)';

      pill.parentNode.insertBefore(inlineInput, pill.nextSibling);
      inlineInput.focus();
      inlineInput.select();

      let committed = false;
      const commit = () => {
        if (committed) return;
        committed = true;
        const val = parseFloat(inlineInput.value);
        if (!isNaN(val)) {
          let nextSliderVal = val;
          if (isPercent) {
            nextSliderVal = val / 100;
          }
          nextSliderVal = Math.max(sMin, Math.min(sMax, nextSliderVal));
          slider.value = nextSliderVal;
          slider.dispatchEvent(new Event('input', { bubbles: true }));
          slider.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (inlineInput.parentNode) inlineInput.parentNode.removeChild(inlineInput);
        pill.style.display = '';
      };

      inlineInput.addEventListener('keydown', (ke) => {
        if (ke.key === 'Enter') {
          commit();
        } else if (ke.key === 'Escape') {
          committed = true;
          if (inlineInput.parentNode) inlineInput.parentNode.removeChild(inlineInput);
          pill.style.display = '';
        }
      });
      inlineInput.addEventListener('blur', commit);
    }
  }

  setupGlobalNumberScrubbing();

  // ===== 管理コンソール各パネル インナータブ汎用切り替えハンドラ =====
  function initAdminInnerTabs() {
    const navs = document.querySelectorAll('.admin-inner-tabs-nav');
    navs.forEach(nav => {
      const btns = nav.querySelectorAll('.inner-tab-btn');
      btns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const targetId = btn.dataset.innertab;
          if (!targetId) return;

          // タブボタンのアクティブ更新
          btns.forEach(b => b.classList.toggle('active', b === btn));

          // 親コンテナ（.tm-section または .sub-editor-panel）を特定してペインを切り替え
          const container = nav.closest('.tm-section, .sub-editor-panel') || nav.parentElement;
          if (container) {
            const panes = container.querySelectorAll('.inner-tab-pane');
            panes.forEach(pane => {
              // 自コンテナの直下または自コンテナに一番近いペインのみを対象にする
              const paneParent = pane.closest('.tm-section, .sub-editor-panel');
              if (paneParent === container || pane.parentElement === container) {
                pane.classList.toggle('hidden', pane.id !== targetId);
              }
            });
          }
        });
      });
    });
  }

  initAdminInnerTabs();

  // ===== キャラクタースタジオ 初期起動 =====
  if (studioRoot && !studioApp) {
    try {
      studioApp = new StudioApp(studioRoot);
      window.studioApp = studioApp;
    } catch (err) {
      console.error('StudioApp initialization error:', err);
    }
  }
});


