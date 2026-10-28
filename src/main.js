import { Game, GAME_STATES, MODES, applyTextCustomStyles, DEFAULT_BGM_BANNER_CONFIG } from './game.js';
import { GameRenderer, getFishEyeOffset } from './renderer.js';
import { initI18n, setLang, getCurrentLang, t, onLangChange, getLocalizedPlayerName, getLocalizedTitle } from './i18n.js';
import { sound, BGM_PLAYLIST, LINKCORE_URL } from './audio.js';
import { trackEvent } from './analytics.js';
import {
  loadOrCreateUserIdentity,
  savePlayerName,
  buildRankingPayload,
  renderIdentityStatus,
  appendLog
} from './app.js';

window.addEventListener('DOMContentLoaded', () => {
  initI18n();

  const canvas = document.getElementById('gameCanvas');
  const renderer = new GameRenderer(canvas);
  const game = new Game(canvas, renderer);

  // リサイズ処理 (画面伸縮時にも上下UIと魚が絶対に被らないセーフエリアを動的に算出)
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.resize(w, h);
    
    // ヘッダー下地パネル、Now playing pill、およびボトムドック下地パネルの位置・高さを正確に取得
    const hudEl = document.getElementById('gameHud');
    const nowPlayingPillEl = document.getElementById('nowPlayingPill');
    const bottomDockEl = document.getElementById('bottomDock');
    
    let safeTop = 115;
    if (nowPlayingPillEl && nowPlayingPillEl.offsetParent !== null) {
      const rect = nowPlayingPillEl.getBoundingClientRect();
      safeTop = Math.max(safeTop, rect.bottom + 8);
    } else if (hudEl) {
      safeTop = Math.max(safeTop, hudEl.offsetHeight + 35);
    }
    
    let safeBottom = h * 0.75;
    if (bottomDockEl && bottomDockEl.offsetParent !== null) {
      const rect = bottomDockEl.getBoundingClientRect();
      safeBottom = Math.min(h - 110, rect.top - 10);
    } else if (bottomDockEl) {
      const dockHeight = bottomDockEl.offsetHeight || 105;
      safeBottom = Math.max(safeTop + 120, h - dockHeight - 12);
    }
    game.setSafeBounds(safeTop, safeBottom);
    updateBucketPositions();
  }

  function updateBucketPositions() {
    const container = document.getElementById('bucketsContainer');
    if (!container) return;
    const bucketEls = container.querySelectorAll('.bucket-box');
    bucketEls.forEach(el => {
      const bId = el.dataset.bucketId;
      const rect = el.getBoundingClientRect();
      const pos = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      if (bId) {
        game.bucketPositions[bId] = pos;
        if (bId === 'bucketA') game.bucketPositions.karei = pos;
        if (bId === 'bucketB') game.bucketPositions.hirame = pos;
      }
    });
  }

  window.addEventListener('resize', resize);
  resize();

  // DOM要素取得
  const dom = {
    // HUD
    gameHud: document.getElementById('gameHud'),
    hudTimeVal: document.getElementById('hudTimeVal'),
    hudScoreVal: document.getElementById('hudScoreVal'),
    hudComboVal: document.getElementById('hudComboVal'),
    quickRetryBtn: document.getElementById('quickRetryBtn'),
    hudHomeBtn: document.getElementById('hudHomeBtn'),
    hudMuteBtn: document.getElementById('hudMuteBtn'),
    hudSettingsBtn: document.getElementById('hudSettingsBtn'),
    nowPlayingPill: document.getElementById('nowPlayingPill'),
    nowPlayingTitle: document.getElementById('nowPlayingTitle'),
    
    // ボトムドック
    bottomDock: document.getElementById('bottomDock'),
    feedKareiBtn: document.getElementById('feedKareiBtn'),
    feedHirameBtn: document.getElementById('feedHirameBtn'),
    baitStockBadge: document.getElementById('baitStockBadge'),
    bucketKarei: document.getElementById('bucketKarei'),
    bucketHirame: document.getElementById('bucketHirame'),
    countdownOverlay: document.getElementById('countdownOverlay'),

    // モーダル
    titleModal: document.getElementById('titleModal'),
    masterModal: document.getElementById('masterModal'),
    resultModal: document.getElementById('resultModal'),
    leaderboardModal: document.getElementById('leaderboardModal'),
    musicModal: document.getElementById('musicModal'),
    settingsModal: document.getElementById('settingsModal'),

    // タイトルボタン
    playerNameInput: document.getElementById('playerNameInput'),
    toModeSelectBtn: document.getElementById('toModeSelectBtn'),
    openLeaderboardBtn: document.getElementById('openLeaderboardBtn'),
    openSettingsBtn: document.getElementById('openSettingsBtn'),
    openMusicModalBtn: document.getElementById('openMusicModalBtn'),
    closeLeaderboardBtn: document.getElementById('closeLeaderboardBtn'),
    closeMusicModalBtn: document.getElementById('closeMusicModalBtn'),
    closeSettingsBtn: document.getElementById('closeSettingsBtn'),
    btnSaveGameSettings: document.getElementById('btnSaveGameSettings'),
    btnHomeGameSettings: document.getElementById('btnHomeGameSettings'),
    btnResetGameSettings: document.getElementById('btnResetGameSettings'),
    settingsSaveToast: document.getElementById('settingsSaveToast'),

    // 設定要素
    fps30Btn: document.getElementById('fps30Btn'),
    fps60Btn: document.getElementById('fps60Btn'),
    masterVolSlider: document.getElementById('masterVolSlider'),
    masterVolVal: document.getElementById('masterVolVal'),
    toggleMasterBtn: document.getElementById('toggleMasterBtn'),
    bgmVolSlider: document.getElementById('bgmVolSlider'),
    bgmVolVal: document.getElementById('bgmVolVal'),
    toggleBgmBtn: document.getElementById('toggleBgmBtn'),
    seVolSlider: document.getElementById('seVolSlider'),
    seVolVal: document.getElementById('seVolVal'),
    toggleSeBtn: document.getElementById('toggleSeBtn'),
    trackSelectGrid: document.getElementById('trackSelectGrid'),

    // モード選択ボタン
    chooseKareiMode: document.getElementById('chooseKareiMode'),
    chooseHirameMode: document.getElementById('chooseHirameMode'),
    chooseHiraiMode: document.getElementById('chooseHiraiMode'),
    backToTitleBtn: document.getElementById('backToTitleBtn'),

    // リザルトボタン
    resultScore: document.getElementById('resultScore'),
    resultTitleBadge: document.getElementById('resultTitleBadge'),
    resultMaxCombo: document.getElementById('resultMaxCombo'),
    resultCatchCount: document.getElementById('resultCatchCount'),
    shareXBtn: document.getElementById('shareXBtn'),
    retryBtn: document.getElementById('retryBtn'),
    resultTitleBtn: document.getElementById('resultTitleBtn'),
    leaderboardItems: document.getElementById('leaderboardItems'),

    // 内部ユーザーID自動静止システム & ステータス画面ランキング
    identityStatusBox: document.getElementById('identityStatusBox'),
    resultRankingItems: document.getElementById('resultRankingItems'),
    clearMyRankingBtn: document.getElementById('clearMyRankingBtn'),
    refreshResultRankingBtn: document.getElementById('refreshResultRankingBtn'),
    clearRankingModal: document.getElementById('clearRankingModal'),
    clearRankingConfirmText: document.getElementById('clearRankingConfirmText'),
    btnCancelClearRanking: document.getElementById('btnCancelClearRanking'),
    btnConfirmClearRanking: document.getElementById('btnConfirmClearRanking'),
    rankingTestSection: document.getElementById('rankingTestSection'),
    btnCloseRankingTestSection: document.getElementById('btnCloseRankingTestSection'),
    btnTestSubmitScore: document.getElementById('btnTestSubmitScore'),
    rankingIdentityLog: document.getElementById('rankingIdentityLog'),

    // クレジットバナー
    titleCreditsBanner: document.getElementById('titleCreditsBanner'),

    // キャラ図鑑 (Result画面)
    resultLoreContainer: document.getElementById('resultLoreContainer'),
    resultLoreName: document.getElementById('resultLoreName'),
    resultLoreCanvasWrap: document.getElementById('resultLoreCanvasWrap'),
    resultLoreCanvas: document.getElementById('resultLoreCanvas'),
    resultLoreSubtitle: document.getElementById('resultLoreSubtitle'),
    resultLoreDescription: document.getElementById('resultLoreDescription'),

    // ランキング削除ボタン & ステータス
    btnDeleteSelectedResultRanking: document.getElementById('btnDeleteSelectedResultRanking'),
    btnDeleteSelectedMainRanking: document.getElementById('btnDeleteSelectedMainRanking'),
    resultDeleteStatus: document.getElementById('resultDeleteStatus'),
    mainDeleteStatus: document.getElementById('mainDeleteStatus')
  };

  // プレイヤー名 & 内部ユーザーID自動静止システムの初期化・自動復元
  const initialIdentity = loadOrCreateUserIdentity();
  if (initialIdentity.player_name) {
    dom.playerNameInput.value = initialIdentity.player_name;
    game.setPlayerName(initialIdentity.player_name);
  }
  renderIdentityStatus(dom.identityStatusBox, initialIdentity);

  dom.playerNameInput.addEventListener('input', (e) => {
    const raw = e.target.value;
    const sanitized = savePlayerName(raw);
    if (sanitized) {
      game.setPlayerName(sanitized);
    }
    const updated = loadOrCreateUserIdentity();
    renderIdentityStatus(dom.identityStatusBox, updated);
  });

  // BGM曲名表示同期ヘルパー
  function syncNowPlayingBgm(track = null) {
    const current = track || sound.getCurrentTrack();
    if (dom.nowPlayingTitle && current) {
      dom.nowPlayingTitle.innerText = `♪ ${current.title}`;
    }
  }

  // BGMトラック更新監視 (確実に曲名ピルと選曲カードの両方を同期)
  sound.onTrackChange = (track) => {
    syncNowPlayingBgm(track);
    renderTrackCards();
  };
  // 初期トラック名表示
  syncNowPlayingBgm();

  // 言語切替ボタン
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setLang(btn.dataset.lang);
    });
  });

  onLangChange((newLang) => {
    renderTrackCards();
    renderLeaderboard(currentLeaderboardPeriod);
    renderResultRanking(currentResultRankingPeriod);
    renderIdentityStatus(dom.identityStatusBox, loadOrCreateUserIdentity());
    if (dom.resultCatchCount) {
      dom.resultCatchCount.innerText = `${game.correctCount} ${t('countUnit')}`;
    }
    if (dom.resultTitleBadge) {
      dom.resultTitleBadge.innerText = game.getPlayerTitle();
    }
    applyTitleAndModeScreenConfig(game.devConfig, newLang);
    renderBucketsUI(game.mode);
    updateLoreTextForCurrentLang();
  });

  // ===== 設定画面ロジック =====
  function initSettingsUI() {
    dom.masterVolSlider.value = sound.masterVolume;
    dom.masterVolVal.innerText = `${Math.round(sound.masterVolume * 100)}%`;
    dom.toggleMasterBtn.innerText = sound.masterMuted ? 'OFF' : 'ON';
    dom.toggleMasterBtn.classList.toggle('active', !sound.masterMuted);

    dom.bgmVolSlider.value = sound.bgmVolume;
    dom.bgmVolVal.innerText = `${Math.round(sound.bgmVolume * 100)}%`;
    dom.toggleBgmBtn.innerText = sound.bgmMuted ? 'OFF' : 'ON';
    dom.toggleBgmBtn.classList.toggle('active', !sound.bgmMuted);

    dom.seVolSlider.value = sound.seVolume;
    dom.seVolVal.innerText = `${Math.round(sound.seVolume * 100)}%`;
    dom.toggleSeBtn.innerText = sound.seMuted ? 'OFF' : 'ON';
    dom.toggleSeBtn.classList.toggle('active', !sound.seMuted);

    // スライダーイベント
    dom.masterVolSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      sound.setMasterVolume(val);
      dom.masterVolVal.innerText = `${Math.round(val * 100)}%`;
    });
    dom.masterVolSlider.addEventListener('change', () => {
      sound.playTap();
    });

    dom.bgmVolSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      sound.setBgmVolume(val);
      dom.bgmVolVal.innerText = `${Math.round(val * 100)}%`;
    });
    dom.bgmVolSlider.addEventListener('change', () => {
      sound.playTap();
    });

    dom.seVolSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      sound.setSeVolume(val);
      dom.seVolVal.innerText = `${Math.round(val * 100)}%`;
      sound.playTap();
    });

    // スライダーのツマミをタップ（クリック）した時にもその音量でSEを鳴らす
    dom.seVolSlider.addEventListener('pointerdown', () => {
      sound.playTap();
    });

    // トグルボタン
    const updateMuteIcons = (isMuted) => {
      dom.hudMuteBtn.innerText = isMuted ? '🔇' : '🔊';
      dom.toggleMasterBtn.innerText = isMuted ? 'OFF' : 'ON';
      dom.toggleMasterBtn.classList.toggle('active', !isMuted);
    };

    dom.toggleMasterBtn.addEventListener('click', () => {
      const isMuted = sound.toggleMasterMute();
      updateMuteIcons(isMuted);
    });

    dom.hudMuteBtn.addEventListener('click', () => {
      const isMuted = sound.toggleMasterMute();
      updateMuteIcons(isMuted);
    });

    dom.toggleBgmBtn.addEventListener('click', () => {
      const isMuted = sound.toggleBgmMute();
      dom.toggleBgmBtn.innerText = isMuted ? 'OFF' : 'ON';
      dom.toggleBgmBtn.classList.toggle('active', !isMuted);
    });

    dom.toggleSeBtn.addEventListener('click', () => {
      const isMuted = sound.toggleSeMute();
      dom.toggleSeBtn.innerText = isMuted ? 'OFF' : 'ON';
      dom.toggleSeBtn.classList.toggle('active', !isMuted);
      if (!isMuted) sound.playTap();
    });

    // BGM再生モードボタン
    const bgmModeRandomBtn = document.getElementById('bgmModeRandomBtn');
    const bgmModeFixedBtn = document.getElementById('bgmModeFixedBtn');
    const updateModeBtns = () => {
      if (bgmModeRandomBtn && bgmModeFixedBtn) {
        bgmModeRandomBtn.classList.toggle('active', sound.bgmPlayMode === 'random');
        bgmModeFixedBtn.classList.toggle('active', sound.bgmPlayMode === 'fixed');
      }
    };
    updateModeBtns();

    if (bgmModeRandomBtn) {
      bgmModeRandomBtn.addEventListener('click', () => {
        sound.playTap();
        sound.setBgmPlayMode('random');
        updateModeBtns();
      });
    }
    if (bgmModeFixedBtn) {
      bgmModeFixedBtn.addEventListener('click', () => {
        sound.playTap();
        sound.setBgmPlayMode('fixed');
        updateModeBtns();
      });
    }

    // BGM音量ツマミの再生・停止トグル (音量チェック用: フェードイン・フェードアウトなし、ランダム位置20秒再生)
    const gameBgmPlayToggleBtn = document.getElementById('gameBgmPlayToggleBtn');
    const updateGameKnobBtn = (isPlaying) => {
      if (!gameBgmPlayToggleBtn) return;
      if (isPlaying) {
        gameBgmPlayToggleBtn.innerText = '⏹';
        gameBgmPlayToggleBtn.classList.add('playing');
        gameBgmPlayToggleBtn.title = 'BGMを停止';
      } else {
        gameBgmPlayToggleBtn.innerText = '▶';
        gameBgmPlayToggleBtn.classList.remove('playing');
        gameBgmPlayToggleBtn.title = 'BGMを再生 (音量確認・フェードなし20秒)';
      }
    };

    if (gameBgmPlayToggleBtn) {
      gameBgmPlayToggleBtn.addEventListener('click', () => {
        sound.init();
        if (sound.isPlaying()) {
          sound.stopTrackAudition(false);
          sound.pauseBGM();
        } else {
          // BGM音量コンテナ: フェードなしで即座に設定音量でランダム開始20秒再生
          sound.startTrackAudition(sound.currentTrackIndex, { fade: false, duration: 20 });
        }
        updateGameKnobBtn(sound.isPlaying());
        renderTrackCards();
      });
    }

    sound.onPlayStateChange = (isPlaying) => {
      updateGameKnobBtn(isPlaying);
      renderTrackCards();
    };

    sound.onTrackChange = (track) => {
      syncNowPlayingBgm(track);
      renderTrackCards();
    };

    // BGM選曲リスト生成
    renderTrackCards();
  }

  function renderTrackCards() {
    if (!dom.trackSelectGrid) return;
    // 有効(ON)な登録楽曲のみ表示
    const playableList = sound.getPlayablePlaylist();
    const isPlaying = sound.isPlaying();
    const curTrack = sound.getCurrentTrack();

    if (playableList.length === 0) {
      dom.trackSelectGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align:center; padding:16px; color:#94a3b8; font-size:12px;">
          🔕 再生可能なBGMがありません (管理コンソールで曲を有効化してください)
        </div>
      `;
      return;
    }

    dom.trackSelectGrid.innerHTML = playableList.map((track) => {
      const globalIdx = BGM_PLAYLIST.indexOf(track);
      const isCurrent = curTrack && (curTrack.id === track.id || curTrack.src === track.src);
      const isTrackPlaying = isCurrent && isPlaying;
      const statusText = isTrackPlaying ? t('trackPlaying') : (isCurrent ? t('trackSelected') : t('trackTapToPlay'));
      const actionTitle = isTrackPlaying ? t('stop') : t('play');
      return `
        <div class="track-item-card ${isCurrent ? 'active' : ''} ${isTrackPlaying ? 'preview-active' : ''}" data-idx="${globalIdx}">
          <div class="track-info">
            <span class="track-title">🎵 ${track.title}</span>
            <span class="track-status-pill">${statusText}</span>
          </div>
          <div class="track-actions">
            <button class="track-icon-btn ${isTrackPlaying ? 'playing' : ''}" data-toggle-idx="${globalIdx}" title="${actionTitle}">
              ${isTrackPlaying ? '⏹' : '▶'}
            </button>
          </div>
        </div>
      `;
    }).join('');

    // カードタップまたはアイコンタップで楽曲試聴（フェードイン＆フェードアウト・ランダム開始位置20秒）
    dom.trackSelectGrid.querySelectorAll('.track-item-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const idx = parseInt(card.dataset.idx, 10);
        sound.init();

        const isCurrent = idx === sound.currentTrackIndex;
        const isPlaying = sound.isPlaying();

        if (isCurrent && isPlaying) {
          // 既に再生中の同一曲をタップした場合は停止
          sound.stopTrackAudition(false);
          sound.pauseBGM();
        } else {
          // 楽曲一覧＆試聴: フェードイン＆フェードアウト、ランダム位置20秒再生（1曲で終了）
          sound.startTrackAudition(idx, { fade: true, duration: 20 });
        }
        renderTrackCards();
        const knobBtn = document.getElementById('gameBgmPlayToggleBtn');
        if (knobBtn) {
          knobBtn.innerText = sound.isPlaying() ? '⏹' : '▶';
          knobBtn.classList.toggle('playing', sound.isPlaying());
        }
      });
    });
  }

  function updateTrackButtons() {
    renderTrackCards();
  }

  // タイトル画面・モード選択画面のカスタマイズ反映
  function applyTitleAndModeScreenConfig(cfg, lang = null) {
    if (!cfg) return;
    const l = lang || (typeof getCurrentLang === 'function' ? getCurrentLang() : 'ja');

    const titleCfg = cfg.titleScreen;
    if (titleCfg) {
      const titleLogo = document.querySelector('#titleModal .title-logo');
      if (titleLogo && titleCfg.mainTitle) {
        applyTextCustomStyles(titleLogo, titleCfg.mainTitle, l);
      }
      const titleSub = document.querySelector('#titleModal .title-sub');
      if (titleSub && titleCfg.subTitle) {
        applyTextCustomStyles(titleSub, titleCfg.subTitle, l);
      }
      const creditsBanner = document.getElementById('titleCreditsBanner');
      if (creditsBanner) {
        const cr = titleCfg.credits;
        if (cr && cr.enabled !== false && (cr.author || cr.year)) {
          creditsBanner.innerText = `${cr.author || 'PIG STAR'} / ${cr.year || '2026'}`;
          creditsBanner.style.display = 'block';
          creditsBanner.style.fontSize = `${cr.fontSize || 11}px`;
          creditsBanner.style.fontFamily = cr.fontFamily || "'M PLUS Rounded 1c', sans-serif";

          // レイアウト位置の反映 (header / subtitle / above_lang / footer)
          const modalContent = document.querySelector('#titleModal .modal-content');
          const titleBanner = document.querySelector('#titleModal .title-banner');
          const titleSub = document.querySelector('#titleModal .title-sub');
          const langSelector = document.querySelector('#titleModal .lang-selector');
          const pos = cr.position || 'subtitle';

          if (modalContent) {
            if (pos === 'header' && titleBanner) {
              modalContent.insertBefore(creditsBanner, titleBanner);
              creditsBanner.style.marginTop = '0px';
              creditsBanner.style.marginBottom = '10px';
            } else if (pos === 'above_lang' && langSelector) {
              modalContent.insertBefore(creditsBanner, langSelector);
              creditsBanner.style.marginTop = '12px';
              creditsBanner.style.marginBottom = '6px';
            } else if (pos === 'footer') {
              modalContent.appendChild(creditsBanner);
              creditsBanner.style.marginTop = '14px';
              creditsBanner.style.marginBottom = '4px';
            } else if (titleBanner) {
              // subtitle (デフォルト)
              if (titleSub && titleSub.nextSibling) {
                titleBanner.insertBefore(creditsBanner, titleSub.nextSibling);
              } else {
                titleBanner.appendChild(creditsBanner);
              }
              creditsBanner.style.marginTop = '6px';
              creditsBanner.style.marginBottom = '0px';
            }
          }
        } else if (cr && cr.enabled === false) {
          creditsBanner.style.display = 'none';
        } else {
          creditsBanner.innerText = 'PIG STAR / 2026';
          creditsBanner.style.display = 'block';
          creditsBanner.style.fontSize = '11px';
          creditsBanner.style.fontFamily = "'M PLUS Rounded 1c', sans-serif";
        }
      }
    }

    const modeCfg = cfg.modeSelectScreen;
    if (modeCfg) {
      const masterAvatarImg = document.getElementById('masterAvatarImg');
      if (masterAvatarImg && modeCfg.masterAvatar) {
        let avatarSrc = modeCfg.masterAvatar;
        if (typeof avatarSrc === 'string' && avatarSrc.startsWith('/')) avatarSrc = '.' + avatarSrc;
        masterAvatarImg.src = avatarSrc;
      }
      const masterSpeech = document.getElementById('masterSpeechBubble');
      if (masterSpeech) {
        masterSpeech.style.whiteSpace = 'pre-line';
        let speech = null;
        if (modeCfg.masterSpeechByLang && modeCfg.masterSpeechByLang[l] !== undefined && modeCfg.masterSpeechByLang[l] !== '') {
          if (l !== 'ja' && modeCfg.masterSpeechByLang[l] === (modeCfg.masterSpeechByLang.ja || modeCfg.masterSpeech)) {
            speech = t('masterPrompt');
          } else {
            speech = modeCfg.masterSpeechByLang[l];
          }
        } else if (l === 'ja' && modeCfg.masterSpeech) {
          speech = modeCfg.masterSpeech;
        } else {
          speech = t('masterPrompt');
        }
        if (speech) masterSpeech.innerText = speech;
      }

      // 派閥（モード）名称・説明文の言語別反映
      if (modeCfg.modes) {
        const modes = modeCfg.modes;
        const applyModeInfo = (cardId, modeKey, defaultI18nTitleKey, defaultI18nDescKey) => {
          const card = document.getElementById(cardId);
          if (!card) return;
          const titleSpan = card.querySelector('.mode-card-title span:last-child');
          const descDiv = card.querySelector('.mode-card-desc');
          const m = modes[modeKey];
          if (m) {
            let name = (m.nameByLang && m.nameByLang[l] !== undefined && m.nameByLang[l] !== '')
              ? m.nameByLang[l]
              : (l === 'ja' && m.name ? m.name : t(defaultI18nTitleKey));
            let desc = (m.descByLang && m.descByLang[l] !== undefined && m.descByLang[l] !== '')
              ? m.descByLang[l]
              : (l === 'ja' && m.desc ? m.desc : t(defaultI18nDescKey));
            if (titleSpan && name) titleSpan.innerText = name;
            if (descDiv && desc) descDiv.innerText = desc;
          }
        };
        applyModeInfo('chooseKareiMode', 'karei', 'modeKarei', 'modeKareiDesc');
        applyModeInfo('chooseHirameMode', 'hirame', 'modeHirame', 'modeHirameDesc');
        applyModeInfo('chooseHiraiMode', 'hirai', 'modeHirai', 'modeHiraiDesc');
      }
    }

    updateNowPlayingPillAppearance(cfg);
  }

  function updateNowPlayingPillAppearance(cfg = game.devConfig) {
    const bgmCfg = cfg?.bgmBannerConfig || DEFAULT_BGM_BANNER_CONFIG;
    const holdSec = bgmCfg.holdSec ?? 61;
    if (dom.nowPlayingPill) {
      if (holdSec >= 61) {
        dom.nowPlayingPill.classList.add('pill-disabled');
      } else {
        dom.nowPlayingPill.classList.remove('pill-disabled');
      }
    }
  }

  // 初期ロード時反映
  applyTitleAndModeScreenConfig(game.devConfig);

  // 管理者ツールとのリアルタイム連携 (BroadcastChannel & localStorage)
  try {
    const adminChannel = new BroadcastChannel('hirame_admin_channel');
    adminChannel.onmessage = (event) => {
      if (event.data?.type === 'UPDATE_DEV_CONFIG') {
        const nextCfg = event.data.config || game.loadDevConfig();
        game.setDevConfig(nextCfg);
        applyTitleAndModeScreenConfig(game.devConfig);
        sound.playChime(); // ゲーム本体にも「ポロン♪」の合図音
        renderer.addFloatingText('⚙️ 設定完了 (即時反映)', canvas.width * 0.5, canvas.height * 0.25, '#38bdf8', 26);
      } else if (event.data?.type === 'UPDATE_BGM_PLAYLIST') {
        sound.setPlaylist(event.data.playlist);
        renderTrackCards();
      } else if (event.data?.type === 'UPDATE_AUDIO_SETTINGS') {
        if (event.data.bgmVolume != null) {
          sound.setBgmVolume(event.data.bgmVolume);
          if (dom.bgmVolSlider) dom.bgmVolSlider.value = event.data.bgmVolume;
          if (dom.bgmVolVal) dom.bgmVolVal.innerText = `${Math.round(event.data.bgmVolume * 100)}%`;
        }
        if (event.data.masterVolume != null) {
          sound.setMasterVolume(event.data.masterVolume);
          if (dom.masterVolSlider) dom.masterVolSlider.value = event.data.masterVolume;
          if (dom.masterVolVal) dom.masterVolVal.innerText = `${Math.round(event.data.masterVolume * 100)}%`;
        }
        if (event.data.seVolume != null) {
          sound.setSeVolume(event.data.seVolume);
          if (dom.seVolSlider) dom.seVolSlider.value = event.data.seVolume;
          if (dom.seVolVal) dom.seVolVal.innerText = `${Math.round(event.data.seVolume * 100)}%`;
        }
      } else if (event.data?.type === 'UPDATE_LEADERBOARD' || event.data?.type === 'UPDATE_BLOCKED_USERS') {
        if (dom.leaderboardModal && !dom.leaderboardModal.classList.contains('hidden')) {
          renderLeaderboard(currentLeaderboardPeriod);
        }
      } else if (event.data?.type === 'UPDATE_CUSTOM_CHARACTER') {
        renderer.setCustomCharacter(event.data.character);
        renderer.addFloatingText(`🎨 「${event.data.character.name}」をゲームに反映！`, canvas.width * 0.5, canvas.height * 0.35, '#10b981', 26);
      } else if (event.data?.type === 'UPDATE_CUSTOM_ROSTER') {
        if (event.data.roster) renderer.setCustomCharacters(event.data.roster);
        if (event.data.activeCharacter) renderer.setCustomCharacter(event.data.activeCharacter);
        renderer.addFloatingText(`📦 キャラクターロスターを更新！`, canvas.width * 0.5, canvas.height * 0.35, '#38bdf8', 26);
      }
    };
  } catch (e) {
    console.log("BroadcastChannel not supported", e);
  }

  // 初期ロード時にも localStorage からカスタムキャラ・ロスターを読み込む
  try {
    const savedRoster = localStorage.getItem('hirame_custom_roster');
    if (savedRoster) {
      const parsedRoster = JSON.parse(savedRoster);
      // カレイが古い目玉（2つの目玉パーツがない）なら最新プリセットを適用
      if (parsedRoster.karei && !parsedRoster.karei.parts?.some(p => p.id === 'karei_eye_socket_2' || p.id === 'karei_eye_white_2')) {
        delete parsedRoster.karei;
        localStorage.setItem('hirame_custom_roster', JSON.stringify(parsedRoster));
      }
      renderer.setCustomCharacters(parsedRoster);
    }
    const savedChar = localStorage.getItem('hirame_custom_character');
    if (savedChar) {
      const parsedChar = JSON.parse(savedChar);
      if (parsedChar.id === 'karei' && !parsedChar.parts?.some(p => p.id === 'karei_eye_socket_2' || p.id === 'karei_eye_white_2')) {
        localStorage.removeItem('hirame_custom_character');
      } else {
        renderer.setCustomCharacter(parsedChar);
      }
    }
  } catch (e) {
    console.warn("Failed to load saved custom character", e);
  }

  // Web公開環境用: 同梱デフォルト設定 (default_game_data.json) があれば自動取得して未設定端末へ適用
  try {
    fetch('./default_game_data.json')
      .then(res => res.ok ? res.json() : null)
      .then(bundle => {
        if (!bundle) return;
        if (bundle.customRoster) {
          renderer.setCustomCharacters(bundle.customRoster);
        }
        if (bundle.customCharacter) {
          renderer.setCustomCharacter(bundle.customCharacter);
        }
        if (bundle.devConfig && !localStorage.getItem('hirame_dev_config')) {
          game.setDevConfig(bundle.devConfig);
          applyTitleAndModeScreenConfig(game.devConfig);
        }
      })
      .catch(() => {});
  } catch (e) {}

  window.addEventListener('storage', (e) => {
    if (e.key === 'hirame_dev_config') {
      game.setDevConfig(game.loadDevConfig());
      applyTitleAndModeScreenConfig(game.devConfig);
      sound.playChime();
      renderer.addFloatingText('⚙️ 設定完了 (即時反映)', canvas.width * 0.5, canvas.height * 0.25, '#38bdf8', 26);
    } else if (e.key === 'hirame_bgm_playlist' && e.newValue) {
      try {
        sound.setPlaylist(JSON.parse(e.newValue));
        renderTrackCards();
      } catch (err) {
        console.warn(err);
      }
    } else if (e.key === 'hirame_bgm_vol' && e.newValue) {
      const val = parseFloat(e.newValue);
      if (!isNaN(val)) {
        sound.setBgmVolume(val);
        if (dom.bgmVolSlider) dom.bgmVolSlider.value = val;
        if (dom.bgmVolVal) dom.bgmVolVal.innerText = `${Math.round(val * 100)}%`;
      }
    } else if (e.key === 'hirame_master_vol' && e.newValue) {
      const val = parseFloat(e.newValue);
      if (!isNaN(val)) {
        sound.setMasterVolume(val);
        if (dom.masterVolSlider) dom.masterVolSlider.value = val;
        if (dom.masterVolVal) dom.masterVolVal.innerText = `${Math.round(val * 100)}%`;
      }
    } else if (e.key === 'hirame_se_vol' && e.newValue) {
      const val = parseFloat(e.newValue);
      if (!isNaN(val)) {
        sound.setSeVolume(val);
        if (dom.seVolSlider) dom.seVolSlider.value = val;
        if (dom.seVolVal) dom.seVolVal.innerText = `${Math.round(val * 100)}%`;
      }
    } else if (e.key === 'hirame_leaderboard' || e.key === 'hirame_blocked_users') {
      if (dom.leaderboardModal && !dom.leaderboardModal.classList.contains('hidden')) {
        renderLeaderboard(currentLeaderboardPeriod);
      }
    } else if (e.key === 'hirame_custom_roster' && e.newValue) {
      try {
        renderer.setCustomCharacters(JSON.parse(e.newValue));
      } catch (err) {
        console.warn(err);
      }
    } else if (e.key === 'hirame_custom_character' && e.newValue) {
      try {
        renderer.setCustomCharacter(JSON.parse(e.newValue));
      } catch (err) {
        console.warn(err);
      }
    }
  });

  initSettingsUI();

  // ── FPS設定 (30FPS / 60FPS) ──
  let targetFps = parseInt(localStorage.getItem('hirame_target_fps') || '60', 10);
  if (targetFps !== 30 && targetFps !== 60) targetFps = 60;

  const updateFpsUI = () => {
    if (dom.fps30Btn && dom.fps60Btn) {
      dom.fps30Btn.classList.toggle('active', targetFps === 30);
      dom.fps60Btn.classList.toggle('active', targetFps === 60);
    }
  };
  updateFpsUI();

  if (dom.fps30Btn) {
    dom.fps30Btn.addEventListener('click', () => {
      sound.playTap();
      targetFps = 30;
      localStorage.setItem('hirame_target_fps', '30');
      updateFpsUI();
    });
  }
  if (dom.fps60Btn) {
    dom.fps60Btn.addEventListener('click', () => {
      sound.playTap();
      targetFps = 60;
      localStorage.setItem('hirame_target_fps', '60');
      updateFpsUI();
    });
  }

  // 設定モーダル開閉
  const openSettings = () => {
    sound.playTap();
    dom.settingsModal.classList.remove('hidden');
  };
  dom.openSettingsBtn.addEventListener('click', openSettings);
  dom.hudSettingsBtn.addEventListener('click', openSettings);
  if (dom.closeSettingsBtn) {
    dom.closeSettingsBtn.addEventListener('click', () => {
      sound.playTap();
      dom.settingsModal.classList.add('hidden');
    });
  }

  // 設定保存トースト通知ユーティリティ
  let saveToastTimer = null;
  const showSettingsToast = (msg = '✓ 設定を保存しました') => {
    if (!dom.settingsSaveToast) return;
    dom.settingsSaveToast.textContent = msg;
    dom.settingsSaveToast.classList.add('show');
    if (saveToastTimer) clearTimeout(saveToastTimer);
    saveToastTimer = setTimeout(() => {
      dom.settingsSaveToast.classList.remove('show');
    }, 1800);
  };

  // 1. 設定保存ボタン
  if (dom.btnSaveGameSettings) {
    dom.btnSaveGameSettings.addEventListener('click', () => {
      sound.playCatchSuccess(); // 成功ファンファーレSE
      // 音量等の最新値を保存
      sound.saveSettings();
      localStorage.setItem('hirame_target_fps', String(targetFps));
      showSettingsToast('✓ 設定を保存しました');
    });
  }

  // 2. デフォルトに戻すボタン
  if (dom.btnResetGameSettings) {
    dom.btnResetGameSettings.addEventListener('click', () => {
      sound.playTap();
      // デフォルト値
      sound.setMasterVolume(0.8);
      sound.setBgmVolume(0.7);
      sound.setSeVolume(0.8);
      targetFps = 60;
      localStorage.setItem('hirame_target_fps', '60');
      updateFpsUI();

      // UI反映
      if (dom.masterVolSlider) dom.masterVolSlider.value = '0.8';
      if (dom.masterVolVal) dom.masterVolVal.textContent = '80%';
      if (dom.bgmVolSlider) dom.bgmVolSlider.value = '0.7';
      if (dom.bgmVolVal) dom.bgmVolVal.textContent = '70%';
      if (dom.seVolSlider) dom.seVolSlider.value = '0.8';
      if (dom.seVolVal) dom.seVolVal.textContent = '80%';

      sound.saveSettings();
      showSettingsToast('🔄 初期設定に戻しました');
    });
  }

  // 3. ホーム画面に戻るボタン
  if (dom.btnHomeGameSettings) {
    dom.btnHomeGameSettings.addEventListener('click', () => {
      sound.playTap();
      dom.settingsModal.classList.add('hidden');
      // ゲームプレイ中の場合はゲームを終了してタイトルへ
      if (game.isPlaying) {
        game.stop();
        dom.gameHud.classList.add('hidden');
        dom.bottomDock.classList.add('hidden');
        dom.titleModal.classList.remove('hidden');
      }
    });
  }

  // BGM再生表示トリガーアクション実行
  const executeBgmTriggerAction = () => {
    const cfg = game.devConfig?.bgmBannerConfig || DEFAULT_BGM_BANNER_CONFIG;
    sound.playTap();
    if (cfg.actionType === 'link' && cfg.linkUrl) {
      window.open(cfg.linkUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    // actionType === 'modal' (デフォルト)
    const modal = dom.musicModal;
    if (!modal) return;
    const titleEl = modal.querySelector('h2');
    const msgEl = modal.querySelector('p');
    const promoBanner = modal.querySelector('.linkcore-promo-banner');
    const promoTitle = modal.querySelector('.promo-title');
    const promoSubtitle = modal.querySelector('.promo-subtitle');

    if (titleEl) {
      titleEl.removeAttribute('data-i18n');
      titleEl.innerText = cfg.title || '🎵 BGM Information';
    }
    if (msgEl) {
      msgEl.removeAttribute('data-i18n');
      msgEl.innerText = cfg.message || '';
    }
    if (promoBanner) {
      if (cfg.linkUrl) {
        promoBanner.href = cfg.linkUrl;
        promoBanner.style.display = 'flex';
      } else {
        promoBanner.style.display = 'none';
      }
    }
    if (promoTitle) {
      promoTitle.removeAttribute('data-i18n');
      promoTitle.innerText = cfg.linkText || '🎵 配信プラットフォーム一覧を開く';
    }
    if (promoSubtitle) {
      promoSubtitle.innerText = cfg.linkUrl || '';
    }
    modal.classList.remove('hidden');
  };

  dom.openMusicModalBtn.addEventListener('click', executeBgmTriggerAction);
  dom.closeMusicModalBtn.addEventListener('click', () => {
    sound.playTap();
    dom.musicModal.classList.add('hidden');
  });

  // Now Playingピルのホールド / 連打トリガー判定
  let bgmHoldTimer = null;
  let bgmTapSequenceCount = 0;
  let bgmTapResetTimer = null;
  let isHoldThresholdMet = false;

  function resetBgmHoldState() {
    if (bgmHoldTimer) {
      clearTimeout(bgmHoldTimer);
      bgmHoldTimer = null;
    }
    isHoldThresholdMet = false;
    dom.nowPlayingPill?.classList.remove('pill-holding', 'pill-hold-ready');
  }

  function handlePillPointerDown(e) {
    const cfg = game.devConfig?.bgmBannerConfig || DEFAULT_BGM_BANNER_CONFIG;
    const holdSec = cfg.holdSec ?? 61;
    const reqTaps = cfg.tapCount ?? 1;

    // 61: タップしても何も起きない（デフォルト）
    if (holdSec >= 61) return;

    // 0秒: 1回タップした瞬間に即発動
    if (holdSec === 0) {
      executeBgmTriggerAction();
      return;
    }

    // 1〜60秒 & 回数 1: タップからホールドして離すまでの時間設定
    if (reqTaps <= 1) {
      resetBgmHoldState();
      dom.nowPlayingPill?.classList.add('pill-holding');
      bgmHoldTimer = setTimeout(() => {
        isHoldThresholdMet = true;
        dom.nowPlayingPill?.classList.remove('pill-holding');
        dom.nowPlayingPill?.classList.add('pill-hold-ready');
        try {
          if (navigator.vibrate) navigator.vibrate(40);
        } catch {}
      }, holdSec * 1000);
      return;
    }

    // 1〜60秒 & 回数 > 1: 指定秒数内に何回タップしたかでトリガー
    if (bgmTapSequenceCount === 0) {
      bgmTapSequenceCount = 1;
      if (bgmTapResetTimer) clearTimeout(bgmTapResetTimer);
      bgmTapResetTimer = setTimeout(() => {
        bgmTapSequenceCount = 0;
      }, holdSec * 1000);
    } else {
      bgmTapSequenceCount++;
      if (bgmTapSequenceCount >= reqTaps) {
        if (bgmTapResetTimer) {
          clearTimeout(bgmTapResetTimer);
          bgmTapResetTimer = null;
        }
        bgmTapSequenceCount = 0;
        executeBgmTriggerAction();
      }
    }
  }

  function handlePillPointerUp(e) {
    const cfg = game.devConfig?.bgmBannerConfig || DEFAULT_BGM_BANNER_CONFIG;
    const holdSec = cfg.holdSec ?? 61;
    const reqTaps = cfg.tapCount ?? 1;

    if (holdSec >= 61 || holdSec === 0 || reqTaps > 1) {
      resetBgmHoldState();
      return;
    }

    // ホールド達成後に離した瞬間にトリガー発動
    if (isHoldThresholdMet) {
      resetBgmHoldState();
      executeBgmTriggerAction();
    } else {
      // 指定秒数未満で離した場合は不発
      resetBgmHoldState();
    }
  }

  function handlePillPointerCancel() {
    resetBgmHoldState();
  }

  if (dom.nowPlayingPill) {
    dom.nowPlayingPill.addEventListener('pointerdown', handlePillPointerDown);
    dom.nowPlayingPill.addEventListener('pointerup', handlePillPointerUp);
    dom.nowPlayingPill.addEventListener('pointerleave', handlePillPointerCancel);
    dom.nowPlayingPill.addEventListener('pointercancel', handlePillPointerCancel);
  }

  // ランキングモーダル
  let currentLeaderboardPeriod = 'yearly';
  let currentLeaderboardMode = 'all';
  let currentResultRankingPeriod = 'yearly';
  let currentResultRankingMode = 'all';

  // 期間タブ
  const mainRankingTabBtns = document.querySelectorAll('#mainRankingTabs .ranking-tab-btn');
  mainRankingTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      sound.playTap();
      const period = btn.dataset.period;
      currentLeaderboardPeriod = period;
      mainRankingTabBtns.forEach(b => b.classList.toggle('active', b === btn));
      renderLeaderboard();
    });
  });

  // モード切替タブ
  const mainRankingModeBtns = document.querySelectorAll('#mainRankingModeTabs .ranking-mode-tab-btn');
  mainRankingModeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      sound.playTap();
      const mode = btn.dataset.mode;
      currentLeaderboardMode = mode;
      mainRankingModeBtns.forEach(b => b.classList.toggle('active', b === btn));
      renderLeaderboard();
    });
  });

  dom.openLeaderboardBtn.addEventListener('click', () => {
    sound.playTap();
    renderLeaderboard();
    dom.leaderboardModal.classList.remove('hidden');
  });
  dom.closeLeaderboardBtn.addEventListener('click', () => {
    sound.playTap();
    dom.leaderboardModal.classList.add('hidden');
  });

  function updateMainDeleteButton() {
    if (!dom.btnDeleteSelectedMainRanking) return;
    const checked = dom.leaderboardItems.querySelectorAll('.main-self-chk:checked');
    dom.btnDeleteSelectedMainRanking.disabled = checked.length === 0;
    const template = t('deleteSelectedRecordsCount') || '🗑️ チェックした自分の記録を削除 ({count}件)';
    const defaultText = t('deleteSelectedRecords') || '🗑️ チェックした自分の記録を削除';
    dom.btnDeleteSelectedMainRanking.innerText = checked.length > 0
      ? template.replace('{count}', checked.length)
      : defaultText;
  }

  function renderLeaderboard(period = currentLeaderboardPeriod, mode = currentLeaderboardMode) {
    const list = game.getLeaderboard(period, mode);
    const identity = loadOrCreateUserIdentity();
    if (list.length === 0) {
      dom.leaderboardItems.innerHTML = `
        <div style="text-align:center; padding:32px; color:#94a3b8; font-size:13px;">
          📭 ランキングデータがまだありません
        </div>
      `;
      updateMainDeleteButton();
      return;
    }

    dom.leaderboardItems.innerHTML = list.map((item, idx) => {
      const isTop3 = idx < 3;
      const medal = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : `${idx + 1}`));
      const isSelf = Boolean((item.internal_user_id && item.internal_user_id === identity.internal_user_id) || (item.name && item.name === identity.player_name));
      const localizedName = isSelf ? (item.name || t('anonymousAngler')) : getLocalizedPlayerName(item.name);
      const chkHtml = isSelf
        ? `<label class="self-ranking-label" title="自分の記録を選択して削除"><input type="checkbox" class="self-ranking-chk main-self-chk" data-id="${item.id}"></label>`
        : `<span class="self-ranking-spacer"></span>`;

      const comboText = (item.maxCombo !== undefined && item.maxCombo !== null) ? item.maxCombo : 0;
      return `
        <div class="leaderboard-item ${isTop3 ? 'top3' : ''} ${isSelf ? 'is-self' : ''}">
          <div style="display:flex; align-items:center; gap:8px;">
            ${chkHtml}
            <span class="rank-badge">${medal}</span>
          </div>
          <span style="font-weight:700; flex:1; margin-left:6px;">
            ${escapeHtml(localizedName)}${isSelf ? ` 👤(${t('you')})` : ''}
            <span style="font-size:11px;color:#94a3b8;">#${item.tag || '---'}</span>
          </span>
          <span style="font-weight:800;color:#38bdf8;white-space:nowrap;text-align:right;">
            ${item.score} pt
            <span style="font-size:11px;color:#facc15;font-weight:700;margin-left:4px;">(${comboText} combo)</span>
          </span>
        </div>
      `;
    }).join('');

    dom.leaderboardItems.querySelectorAll('.main-self-chk').forEach(chk => {
      chk.addEventListener('change', updateMainDeleteButton);
    });
    updateMainDeleteButton();
  }

  // チェックした自分の記録を削除 (メインランキング)
  dom.btnDeleteSelectedMainRanking?.addEventListener('click', () => {
    sound.playTap();
    const checked = Array.from(dom.leaderboardItems.querySelectorAll('.main-self-chk:checked')).map(c => c.dataset.id);
    if (checked.length === 0) return;
    const deletedCount = game.deleteLeaderboardEntries(checked);
    renderLeaderboard();
    renderResultRanking();
    if (dom.mainDeleteStatus) {
      dom.mainDeleteStatus.innerText = '✅ 削除しました！';
      setTimeout(() => { if (dom.mainDeleteStatus) dom.mainDeleteStatus.innerText = ''; }, 3000);
    }
    appendLog(dom.rankingIdentityLog, '🗑️ 自分のランキングを削除しました');
  });

  function escapeHtml(str) {
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
  }

  // タイトル -> 頑固親父の派閥選択へ
  dom.toModeSelectBtn.addEventListener('click', () => {
    sound.init();
    sound.playTap();
    game.setPlayerName(dom.playerNameInput.value);
    dom.titleModal.classList.add('hidden');
    dom.masterModal.classList.remove('hidden');
    applyTitleAndModeScreenConfig(game.devConfig);
  });

  // 派閥選択からタイトルへ戻る
  dom.backToTitleBtn.addEventListener('click', () => {
    sound.playTap();
    dom.masterModal.classList.add('hidden');
    dom.titleModal.classList.remove('hidden');
    applyTitleAndModeScreenConfig(game.devConfig);
  });

  function getBucketDisplayName(b, lang = getCurrentLang()) {
    if (!b) return '';
    if (lang === 'en' && b.name_en) return b.name_en;
    if (lang === 'ko' && b.name_ko) return b.name_ko;
    if (lang === 'zh' && b.name_zh) return b.name_zh;
    if (lang === 'en' && (b.id === 'bucketA' || b.name === 'カレイ')) return 'Karei';
    if (lang === 'en' && (b.id === 'bucketB' || b.name === 'ヒラメ')) return 'Hirame';
    if (lang === 'ko' && (b.id === 'bucketA' || b.name === 'カレイ')) return '가자미';
    if (lang === 'ko' && (b.id === 'bucketB' || b.name === 'ヒラメ')) return '히라메';
    if (lang === 'zh' && (b.id === 'bucketA' || b.name === 'カレイ')) return '鲽鱼';
    if (lang === 'zh' && (b.id === 'bucketB' || b.name === 'ヒラメ')) return '牙鲆';
    return b.name || '';
  }

  // 動的バケツ描画関数 (管理コンソールのバケツ設定＆追加・削除・名称変更に完全対応)
  function renderBucketsUI(mode) {
    const container = document.getElementById('bucketsContainer');
    if (!container) return;
    const activeCfg = game.getActiveDevConfig();
    const buckets = (activeCfg?.buckets && activeCfg.buckets.length > 0)
      ? activeCfg.buckets
      : [
          { id: 'bucketA', name: t('bucketKarei') || 'カレイ', name_en: 'Karei', name_ko: '가자미', name_zh: '鲽鱼', icon: '🪣' },
          { id: 'bucketB', name: t('bucketHirame') || 'ヒラメ', name_en: 'Hirame', name_ko: '히라메', name_zh: '牙鲆', icon: '🪣' }
        ];

    let visibleBuckets = [];
    if (mode === MODES.KAREI) {
      visibleBuckets = buckets.filter(b => b.id === 'bucketA' || b.id === 'karei');
      if (visibleBuckets.length === 0 && buckets.length > 0) visibleBuckets = [buckets[0]];
      game.activeBucket = visibleBuckets[0]?.id || 'bucketA';
    } else if (mode === MODES.HIRAME) {
      visibleBuckets = buckets.filter(b => b.id === 'bucketB' || b.id === 'hirame');
      if (visibleBuckets.length === 0 && buckets.length > 1) visibleBuckets = [buckets[1]];
      game.activeBucket = visibleBuckets[0]?.id || 'bucketB';
    } else {
      // ヒライ派: 全バケツ表示
      visibleBuckets = buckets;
      if (!visibleBuckets.some(b => b.id === game.activeBucket)) {
        game.activeBucket = visibleBuckets[0]?.id || 'bucketA';
      }
    }

    container.innerHTML = visibleBuckets.map(b => {
      const isActive = b.id === game.activeBucket || 
        (game.activeBucket === 'karei' && b.id === 'bucketA') || 
        (game.activeBucket === 'hirame' && b.id === 'bucketB');
      return `
        <div class="bucket-box ${isActive ? 'active' : ''}" data-bucket-id="${b.id}" id="bucket_${b.id}">
          <span class="bucket-icon">${b.icon || '🪣'}</span>
          <span class="bucket-name">${getBucketDisplayName(b)}</span>
        </div>
      `;
    }).join('');

    // バケツ切替タップ
    container.querySelectorAll('.bucket-box').forEach(el => {
      el.addEventListener('click', () => {
        if (game.mode === MODES.HIRAI) {
          const bId = el.dataset.bucketId;
          game.setActiveBucket(bId);
          container.querySelectorAll('.bucket-box').forEach(bEl => {
            bEl.classList.toggle('active', bEl.dataset.bucketId === bId);
          });
        }
      });
    });

    requestAnimationFrame(updateBucketPositions);
  }

  // モード選択
  const startWithMode = (mode) => {
    sound.init();
    sound.playTap();
    game.setMode(mode);
    dom.masterModal.classList.add('hidden');
    dom.gameHud.classList.remove('hidden');
    dom.bottomDock.classList.remove('hidden');

    // モードに応じたバケツ動的描画
    renderBucketsUI(mode);

    // 餌撒きボタンの表示切替
    if (mode === MODES.KAREI) {
      dom.feedKareiBtn.classList.remove('hidden');
      dom.feedHirameBtn.classList.add('hidden');
    } else if (mode === MODES.HIRAME) {
      dom.feedKareiBtn.classList.add('hidden');
      dom.feedHirameBtn.classList.remove('hidden');
    } else {
      dom.feedKareiBtn.classList.remove('hidden');
      dom.feedHirameBtn.classList.remove('hidden');
    }

    // カウントダウン開始
    game.startCountdown();
    trackEvent('game_start', { mode });
  };

  dom.chooseKareiMode.addEventListener('click', () => startWithMode(MODES.KAREI));
  dom.chooseHirameMode.addEventListener('click', () => startWithMode(MODES.HIRAME));
  dom.chooseHiraiMode.addEventListener('click', () => startWithMode(MODES.HIRAI));

  // 餌撒きボタン
  dom.feedKareiBtn.addEventListener('click', () => {
    game.scatterBait('karei');
  });

  dom.feedHirameBtn.addEventListener('click', () => {
    game.scatterBait('hirame');
  });

  // クイックリトライ（プレイ中にいつでも最初からやり直せる）
  dom.quickRetryBtn.addEventListener('click', () => {
    sound.playTap();
    game.restart();
  });

  // メニュー（タイトル）に戻る
  dom.hudHomeBtn.addEventListener('click', () => {
    sound.playTap();
    game.resetToTitle();
    dom.gameHud.classList.add('hidden');
    dom.bottomDock.classList.add('hidden');
    dom.titleModal.classList.remove('hidden');
  });

  // ===== キャラ図鑑 (Result画面) =====
  let loreAnimFrameId = null;
  let currentLoreChar = null;
  let loreFishState = {
    x: 80,
    y: 45,
    baseX: 80,
    baseY: 45,
    width: 95,
    height: 55,
    swimCycle: 0,
    finCycle: 0,
    heading: 1,
    scale: 1.0,
    animMode: null, // null | 'flee' | 'stare'
    animStartTime: 0,
    particles: []
  };

  function updateLoreTextForCurrentLang() {
    if (!currentLoreChar) return;
    const lang = (typeof getCurrentLang === 'function') ? getCurrentLang() : 'ja';
    const c = currentLoreChar;
    const name = c.nameByLang?.[lang] || (lang === 'ja' ? c.name : '') || c.nameByLang?.ja || c.name || 'カレイ';
    const subtitle = c.subtitleByLang?.[lang] || (lang === 'ja' ? c.subtitle : '') || c.subtitleByLang?.ja || c.subtitle || '';
    const desc = c.descriptionByLang?.[lang] || (lang === 'ja' ? c.description : '') || c.descriptionByLang?.ja || c.description || '';

    if (dom.resultLoreName) dom.resultLoreName.innerText = name;
    if (dom.resultLoreSubtitle) dom.resultLoreSubtitle.innerText = subtitle;
    if (dom.resultLoreDescription) dom.resultLoreDescription.innerText = desc;
  }

  function showResultLore() {
    stopResultLore();
    const loreList = game.devConfig?.characterLore || [];
    const enabledChars = loreList.filter(c => c.enabled !== false);
    if (enabledChars.length === 0) {
      if (dom.resultLoreContainer) dom.resultLoreContainer.style.display = 'none';
      return;
    }
    if (dom.resultLoreContainer) dom.resultLoreContainer.style.display = 'block';

    // 登場率% (appearanceRate) に基づく重み付け抽選 (0は均等ランダム)
    let selected = null;
    const hasCustomRates = enabledChars.some(c => (c.appearanceRate || 0) > 0);
    if (hasCustomRates) {
      const totalWeight = enabledChars.reduce((sum, c) => sum + (c.appearanceRate > 0 ? c.appearanceRate : 10), 0);
      let rand = Math.random() * totalWeight;
      for (const c of enabledChars) {
        const w = c.appearanceRate > 0 ? c.appearanceRate : 10;
        if (rand < w) {
          selected = c;
          break;
        }
        rand -= w;
      }
    }
    if (!selected) {
      selected = enabledChars[Math.floor(Math.random() * enabledChars.length)];
    }

    currentLoreChar = selected;
    updateLoreTextForCurrentLang();

    // ミニキャンバス初期化
    const canvas = dom.resultLoreCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    loreFishState = {
      x: 80,
      y: 45,
      baseX: 80,
      baseY: 45,
      width: selected.id === 'shitabirame' ? 120 : (selected.id === 'octopus' || selected.id === 'squid' ? 70 : 95),
      height: selected.id === 'shitabirame' ? 40 : (selected.id === 'octopus' || selected.id === 'squid' ? 75 : 55),
      swimCycle: 0,
      finCycle: 0,
      heading: 1,
      scale: 1.0,
      animMode: null,
      animStartTime: 0,
      particles: []
    };

    let lastTime = performance.now();

    function renderLoreLoop(now) {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 海中グラデーション
      const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bgGrad.addColorStop(0, '#0369a1');
      bgGrad.addColorStop(1, '#0c2340');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // アニメーション進行制御
      let currentZoom = 1.0;
      let focusProgress = 0.0;
      let shakeX = 0;
      let shakeY = 0;

      // 目の相対座標を計算 (魚種・向き・頭部位置に応じて最適化)
      const eyeOffset = getFishEyeOffset(selected.id, loreFishState.width, loreFishState.height, loreFishState.heading);
      const eyeRelX = eyeOffset.x;
      const eyeRelY = eyeOffset.y;

      if (loreFishState.animMode === 'flee') {
        // 💨 泳逃逃亡: 画面外へ猛ダッシュして回り込んで戻る
        const elapsed = (now - loreFishState.animStartTime) / 1000;
        loreFishState.swimCycle += dt * 18.0; // 猛スピードで体をくねらせる
        loreFishState.finCycle += dt * 20.0;

        if (elapsed < 0.55) {
          // フェーズ1: 驚いて右画面外へ猛ダッシュ
          const p = elapsed / 0.55;
          const ease = p * p; // 加速
          loreFishState.x = 80 + ease * 160; // 80 -> 240 (画面幅160の外側へ)
          loreFishState.heading = 1;

          // 泡の軌跡
          if (Math.random() < 0.4) {
            loreFishState.particles.push({
              x: loreFishState.x - 30,
              y: loreFishState.y + (Math.random() - 0.5) * 12,
              vx: -1.5 - Math.random() * 2,
              vy: (Math.random() - 0.5) * 1,
              radius: 1.5 + Math.random() * 3,
              color: 'rgba(255, 255, 255, 0.7)',
              alpha: 0.9,
              fade: 2.0
            });
          }
        } else if (elapsed < 0.75) {
          // フェーズ2: 左画面外から回り込んで登場待機
          const p = (elapsed - 0.55) / 0.2;
          loreFishState.x = -80 + p * 40; // -80 -> -40
          loreFishState.heading = 1;
        } else if (elapsed < 1.75) {
          // フェーズ3: 左から中心へなめらかに戻ってくる (イーズアウト)
          const p = (elapsed - 0.75) / 1.0;
          const ease = 1 - Math.pow(1 - p, 3); // ease-out cubic
          loreFishState.x = -40 + ease * 120; // -40 -> 80
          loreFishState.heading = 1;

          if (Math.random() < 0.25) {
            loreFishState.particles.push({
              x: loreFishState.x - 20,
              y: loreFishState.y + (Math.random() - 0.5) * 8,
              vx: -1.0,
              vy: (Math.random() - 0.5) * 0.8,
              radius: 1.5 + Math.random() * 2,
              color: 'rgba(255, 255, 255, 0.6)',
              alpha: 0.8,
              fade: 1.8
            });
          }
        } else {
          // 復帰完了
          loreFishState.x = 80;
          loreFishState.heading = 1;
          loreFishState.animMode = null;
        }
      } else if (loreFishState.animMode === 'lucky') {
        // 💖 幸福光芒: ★、❤、♪、✨ がキャラから溢れ出して上昇
        const elapsed = (now - loreFishState.animStartTime) / 1000;
        loreFishState.swimCycle += dt * 8.0; // 喜んで体を軽くフリフリ
        loreFishState.finCycle += dt * 10.0;

        if (elapsed < 2.0) {
          // 溢れ出す記号パーティクル
          if (Math.random() < 0.5) {
            const luckySymbols = ['★', '❤', '♪', '✨'];
            const luckyColors = ['#f43f5e', '#ec4899', '#facc15', '#38bdf8', '#a855f7', '#34d399'];
            loreFishState.particles.push({
              x: loreFishState.x + (Math.random() - 0.5) * 36,
              y: loreFishState.y + 10,
              vx: (Math.random() - 0.5) * 1.5,
              vy: -1.2 - Math.random() * 2.0, // 泡と同じように上方にふわふわ上昇
              radius: 5 + Math.random() * 4,
              char: luckySymbols[Math.floor(Math.random() * luckySymbols.length)],
              color: luckyColors[Math.floor(Math.random() * luckyColors.length)],
              alpha: 1.0,
              fade: 1.2
            });
          }
          // 同時に透明な泡も少し発生
          if (Math.random() < 0.25) {
            loreFishState.particles.push({
              x: loreFishState.x + (Math.random() - 0.5) * 20,
              y: loreFishState.y + 5,
              vx: (Math.random() - 0.5) * 0.8,
              vy: -1.0 - Math.random() * 1.5,
              radius: 1.5 + Math.random() * 2.5,
              color: 'rgba(255, 255, 255, 0.7)',
              alpha: 0.85,
              fade: 1.5
            });
          }
        } else {
          loreFishState.animMode = null;
        }
      } else if (loreFishState.animMode === 'ink') {
        // 🦑 スミ吐き: キャラから濃いスミ煙がもくもくと広がる
        const elapsed = (now - loreFishState.animStartTime) / 1000;
        loreFishState.swimCycle += dt * 5.0;
        loreFishState.finCycle += dt * 6.0;

        if (elapsed < 2.0) {
          if (elapsed < 0.6 && Math.random() < 0.6) {
            const inkColors = ['rgba(20, 20, 35, 0.85)', 'rgba(30, 25, 45, 0.8)', 'rgba(15, 23, 42, 0.85)'];
            loreFishState.particles.push({
              x: loreFishState.x + (loreFishState.heading === 1 ? -15 : 15) + (Math.random() - 0.5) * 10,
              y: loreFishState.y + 4 + (Math.random() - 0.5) * 8,
              vx: (loreFishState.heading === 1 ? -1.2 : 1.2) + (Math.random() - 0.5) * 1.2,
              vy: (Math.random() - 0.5) * 1.2,
              radius: 5 + Math.random() * 6,
              grow: 28, // もくもく巨大化
              color: inkColors[Math.floor(Math.random() * inkColors.length)],
              alpha: 0.9,
              fade: 0.9
            });
          }
        } else {
          loreFishState.animMode = null;
        }
      } else if (loreFishState.animMode === 'glare' || loreFishState.animMode === 'stare') {
        // 👁 激怒睨目: キャラクタースタジオ指定の「目」を中心にドアップ＋怒りの小刻み振動
        const elapsed = (now - loreFishState.animStartTime) / 1000;
        loreFishState.swimCycle += dt * 2.0; // 睨んでいる間は動きが静止気味に
        loreFishState.finCycle += dt * 3.0;

        const maxZoom = 3.6; // 目のドアップ倍率

        if (elapsed < 0.45) {
          // フェーズ1: 一気に目の位置へズームイン
          const p = elapsed / 0.45;
          const ease = 1 - Math.pow(1 - p, 3);
          currentZoom = 1.0 + ease * (maxZoom - 1.0);
          focusProgress = ease;
        } else if (elapsed < 1.45) {
          // フェーズ2: 目ガープされた瞬間に怒りで小刻みに激しく揺れる演出
          currentZoom = maxZoom;
          focusProgress = 1.0;
          shakeX = Math.sin(now * 0.12) * 3.8 + (Math.random() - 0.5) * 2.8;
          shakeY = Math.cos(now * 0.14) * 3.8 + (Math.random() - 0.5) * 2.8;

          // 視線・怒りオーラ演出（赤い眼光やスパーク）
          if (Math.random() < 0.4) {
            loreFishState.particles.push({
              x: canvas.width / 2 + (Math.random() - 0.5) * 24,
              y: canvas.height / 2 + (Math.random() - 0.5) * 24,
              vx: (Math.random() - 0.5) * 2.2,
              vy: (Math.random() - 0.5) * 2.2,
              radius: 1.5 + Math.random() * 2.5,
              color: Math.random() < 0.6 ? '#ef4444' : '#facc15',
              alpha: 0.95,
              fade: 3.2
            });
          }
        } else if (elapsed < 1.95) {
          // フェーズ3: すっと元の位置に戻る
          const p = (elapsed - 1.45) / 0.5;
          const ease = p * p;
          currentZoom = maxZoom - ease * (maxZoom - 1.0);
          focusProgress = 1.0 - ease;
        } else {
          // ズーム復帰完了
          currentZoom = 1.0;
          focusProgress = 0.0;
          loreFishState.animMode = null;
        }
      } else {
        // 通常アイドル遊泳
        loreFishState.swimCycle += dt * 4.5;
        loreFishState.finCycle += dt * 5.5;
      }

      // パーティクル描画 (記号・泡・キラキラ・スミ)
      for (let i = loreFishState.particles.length - 1; i >= 0; i--) {
        const p = loreFishState.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= dt * p.fade;
        p.radius = Math.max(0, p.radius + (p.grow || 0) * dt);
        if (p.alpha <= 0) {
          loreFishState.particles.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        if (p.char) {
          ctx.font = `bold ${Math.max(10, Math.round(p.radius * 2))}px sans-serif`;
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

      // キャラクター描画
      ctx.save();
      const isFreezing = (loreFishState.animMode === 'glare' || loreFishState.animMode === 'stare');
      const bobY = isFreezing ? 0 : Math.sin(loreFishState.swimCycle) * 3;

      // 目を中心にしたカメラ変形 (左向き・右向きを問わず目の位置に正確にフォーカス)
      ctx.translate(canvas.width / 2 + shakeX, canvas.height / 2 + shakeY);
      ctx.scale(currentZoom, currentZoom);
      const targetFocusX = loreFishState.x + eyeRelX * focusProgress;
      const targetFocusY = loreFishState.y + bobY + eyeRelY * focusProgress;
      ctx.translate(-targetFocusX, -targetFocusY);

      ctx.translate(loreFishState.x, loreFishState.y + bobY);

      const mockFish = {
        type: selected.id,
        x: 0,
        y: 0,
        width: loreFishState.width,
        height: loreFishState.height,
        finCycle: loreFishState.finCycle,
        swimCycle: loreFishState.swimCycle,
        heading: loreFishState.heading,
        depth: 0.1,
        isBlinkingAlert: false
      };

      renderer.drawFishDetailed(ctx, mockFish, 1.0);
      ctx.restore();

      loreAnimFrameId = requestAnimationFrame(renderLoreLoop);
    }

    loreAnimFrameId = requestAnimationFrame(renderLoreLoop);
  }

  function stopResultLore() {
    if (loreAnimFrameId) {
      cancelAnimationFrame(loreAnimFrameId);
      loreAnimFrameId = null;
    }
  }

  // 図鑑キャラタップ演出 (複数選択時はランダムで演出を実行)
  function triggerLoreInteraction() {
    if (!currentLoreChar || loreFishState.animMode !== null) return;

    sound.init();

    // 触れた演出タグリストを取得 (未指定時はデフォルト泳逃逃亡)
    let effects = Array.isArray(currentLoreChar.touchEffects) && currentLoreChar.touchEffects.length > 0
      ? currentLoreChar.touchEffects
      : (currentLoreChar.tapEffect ? [currentLoreChar.tapEffect] : ['flee']);
    
    // 後方互換 ('stare' -> 'glare')
    effects = effects.map(e => e === 'stare' ? 'glare' : e);

    const chosenEffect = effects[Math.floor(Math.random() * effects.length)] || 'flee';
    loreFishState.animMode = chosenEffect;
    loreFishState.animStartTime = performance.now();

    if (chosenEffect === 'glare') {
      try { sound.playTap(); } catch (e) {}
      // 激怒睨目集中キラキラ
      const colors = ['#ef4444', '#facc15', '#ffffff'];
      for (let i = 0; i < 14; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 1.2 + Math.random() * 2.5;
        loreFishState.particles.push({
          x: loreFishState.x,
          y: loreFishState.y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          radius: 2 + Math.random() * 3,
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: 1.0,
          fade: 2.5
        });
      }
    } else if (chosenEffect === 'lucky') {
      try { sound.playChime ? sound.playChime() : sound.playCatch(); } catch (e) {}
      // 幸福光芒 初期スターバースト
      const luckySymbols = ['★', '❤', '♪', '✨'];
      const luckyColors = ['#f43f5e', '#ec4899', '#facc15', '#38bdf8', '#a855f7'];
      for (let i = 0; i < 10; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 1.0 + Math.random() * 2.0;
        loreFishState.particles.push({
          x: loreFishState.x,
          y: loreFishState.y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 1.0,
          radius: 5 + Math.random() * 4,
          char: luckySymbols[Math.floor(Math.random() * luckySymbols.length)],
          color: luckyColors[Math.floor(Math.random() * luckyColors.length)],
          alpha: 1.0,
          fade: 1.3
        });
      }
    } else if (chosenEffect === 'ink') {
      try { sound.playMiss ? sound.playMiss() : sound.playTap(); } catch (e) {}
      // スミ吐き初期バースト
      for (let i = 0; i < 12; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 0.8 + Math.random() * 2.0;
        loreFishState.particles.push({
          x: loreFishState.x + (loreFishState.heading === 1 ? -15 : 15),
          y: loreFishState.y + 4,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          radius: 6 + Math.random() * 8,
          grow: 24,
          color: 'rgba(20, 20, 35, 0.85)',
          alpha: 0.95,
          fade: 1.0
        });
      }
    } else {
      // 💨 泳逃逃亡
      try { sound.playTap(); } catch (e) {}
      // 水しぶきスプラッシュ
      for (let i = 0; i < 16; i++) {
        const ang = Math.random() * Math.PI * 2;
        const spd = 2 + Math.random() * 3.5;
        loreFishState.particles.push({
          x: loreFishState.x,
          y: loreFishState.y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          radius: 2 + Math.random() * 3,
          color: '#38bdf8',
          alpha: 1.0,
          fade: 2.0
        });
      }
    }
  }

  dom.resultLoreCanvasWrap?.addEventListener('click', triggerLoreInteraction);
  dom.resultLoreCanvasWrap?.addEventListener('touchstart', (e) => {
    e.preventDefault();
    triggerLoreInteraction();
  }, { passive: false });

  // ===== リザルト画面イベント =====
  // リトライ
  dom.retryBtn.addEventListener('click', () => {
    sound.playTap();
    stopResultLore();
    dom.resultModal.classList.add('hidden');
    game.startCountdown();
  });

  // タイトルに戻るボタン
  dom.resultTitleBtn.addEventListener('click', () => {
    sound.playTap();
    stopResultLore();
    game.resetToTitle();
    dom.resultModal.classList.add('hidden');
    dom.gameHud.classList.add('hidden');
    dom.bottomDock.classList.add('hidden');
    dom.titleModal.classList.remove('hidden');
  });

  // X (Twitter) シェア
  dom.shareXBtn.addEventListener('click', () => {
    sound.playTap();
    const url = game.generateXShareUrl();
    window.open(url, '_blank');
  });

  // ===== ステータス画面 (リザルト) 内ランキング & 内部IDテスト =====
  // 期間切替タブ
  const resultRankingTabBtns = document.querySelectorAll('#resultRankingTabs .ranking-tab-btn');
  resultRankingTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      sound.playTap();
      const period = btn.dataset.period;
      currentResultRankingPeriod = period;
      resultRankingTabBtns.forEach(b => b.classList.toggle('active', b === btn));
      renderResultRanking();
    });
  });

  // モード切替タブ
  const resultRankingModeBtns = document.querySelectorAll('#resultRankingModeTabs .ranking-mode-tab-btn');
  resultRankingModeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      sound.playTap();
      const mode = btn.dataset.mode;
      currentResultRankingMode = mode;
      resultRankingModeBtns.forEach(b => b.classList.toggle('active', b === btn));
      renderResultRanking();
    });
  });

  function updateResultDeleteButton() {
    if (!dom.btnDeleteSelectedResultRanking) return;
    const checked = dom.resultRankingItems.querySelectorAll('.result-self-chk:checked');
    dom.btnDeleteSelectedResultRanking.disabled = checked.length === 0;
    const template = t('deleteSelectedRecordsCount') || '🗑️ チェックした自分の記録を削除 ({count}件)';
    const defaultText = t('deleteSelectedRecords') || '🗑️ チェックした自分の記録を削除';
    dom.btnDeleteSelectedResultRanking.innerText = checked.length > 0
      ? template.replace('{count}', checked.length)
      : defaultText;
  }

  function renderResultRanking(period = currentResultRankingPeriod, mode = currentResultRankingMode) {
    if (!dom.resultRankingItems) return;
    const list = game.getLeaderboard(period, mode);
    const identity = loadOrCreateUserIdentity();
    if (list.length === 0) {
      dom.resultRankingItems.innerHTML = `
        <div style="text-align:center; padding:18px; color:#94a3b8; font-size:12px;">
          📭 ランキングデータがまだありません
        </div>
      `;
      updateResultDeleteButton();
      return;
    }

    dom.resultRankingItems.innerHTML = list.slice(0, 10).map((item, idx) => {
      const medal = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : `${idx + 1}`));
      const isSelf = Boolean((item.internal_user_id && item.internal_user_id === identity.internal_user_id) || (item.name && item.name === identity.player_name));
      const localizedName = isSelf ? (item.name || t('anonymousAngler')) : getLocalizedPlayerName(item.name);
      const chkHtml = isSelf
        ? `<label class="self-ranking-label" title="自分の記録を選択して削除"><input type="checkbox" class="self-ranking-chk result-self-chk" data-id="${item.id}"></label>`
        : `<span class="self-ranking-spacer"></span>`;

      const comboText = (item.maxCombo !== undefined && item.maxCombo !== null) ? item.maxCombo : 0;
      return `
        <div class="result-ranking-row ${isSelf ? 'current-user' : ''}">
          <div style="display:flex; align-items:center; gap:6px;">
            ${chkHtml}
            <span class="rank-medal">${medal}</span>
          </div>
          <span class="rank-name" style="flex:1;">${escapeHtml(localizedName)}${isSelf ? ` 👤(${t('you')})` : ''}</span>
          <span class="rank-score" style="white-space:nowrap;text-align:right;">
            ${item.score} pt
            <span style="font-size:10px;color:#facc15;font-weight:700;margin-left:3px;">(${comboText} combo)</span>
          </span>
        </div>
      `;
    }).join('');

    dom.resultRankingItems.querySelectorAll('.result-self-chk').forEach(chk => {
      chk.addEventListener('change', updateResultDeleteButton);
    });
    updateResultDeleteButton();
  }

  // チェックした自分の記録を削除 (リザルトランキング)
  dom.btnDeleteSelectedResultRanking?.addEventListener('click', () => {
    sound.playTap();
    const checked = Array.from(dom.resultRankingItems.querySelectorAll('.result-self-chk:checked')).map(c => c.dataset.id);
    if (checked.length === 0) return;
    const deletedCount = game.deleteLeaderboardEntries(checked);
    renderLeaderboard();
    renderResultRanking();
    if (dom.resultDeleteStatus) {
      dom.resultDeleteStatus.innerText = '✅ 削除しました！';
      setTimeout(() => { if (dom.resultDeleteStatus) dom.resultDeleteStatus.innerText = ''; }, 3000);
    }
    appendLog(dom.rankingIdentityLog, '🗑️ 自分のランキングを削除しました');
  });

  // 登録済みの全ランキング消去ボタン (🗑️) & 確認モーダル
  dom.clearMyRankingBtn?.addEventListener('click', () => {
    sound.playTap();
    if (dom.clearRankingConfirmText) {
      dom.clearRankingConfirmText.innerText = t('confirmDeleteAllRankings');
    }
    if (dom.btnConfirmClearRanking) {
      dom.btnConfirmClearRanking.innerText = t('btnYes');
    }
    if (dom.btnCancelClearRanking) {
      dom.btnCancelClearRanking.innerText = t('btnNo');
    }
    dom.clearRankingModal?.classList.remove('hidden');
  });

  dom.btnCancelClearRanking?.addEventListener('click', () => {
    sound.playTap();
    dom.clearRankingModal?.classList.add('hidden');
  });

  dom.clearRankingModal?.addEventListener('click', (e) => {
    if (e.target === dom.clearRankingModal) {
      dom.clearRankingModal.classList.add('hidden');
    }
  });

  dom.btnConfirmClearRanking?.addEventListener('click', () => {
    sound.playTap();
    dom.clearRankingModal?.classList.add('hidden');
    const identity = loadOrCreateUserIdentity();
    const count = game.clearAllMyLeaderboardEntries(identity);
    renderLeaderboard();
    renderResultRanking();
    if (dom.resultDeleteStatus) {
      dom.resultDeleteStatus.innerText = `✅ ${t('deleteRankingsSuccess')}`;
      setTimeout(() => { if (dom.resultDeleteStatus) dom.resultDeleteStatus.innerText = ''; }, 3000);
    }
    appendLog(dom.rankingIdentityLog, '🗑️ 全ての登録済みランキング記録を消去しました');
  });

  // ランキング更新ボタン (🔄) & デバッグモード起動 (10回連打で表示)
  let refreshClickCount = 0;
  let lastRefreshClickTime = 0;

  dom.refreshResultRankingBtn?.addEventListener('click', () => {
    sound.playTap();
    renderResultRanking();
    appendLog(dom.rankingIdentityLog, '🔄 ランキング一覧を再読み込みしました');

    const now = performance.now();
    if (now - lastRefreshClickTime > 4000) {
      refreshClickCount = 0;
    }
    lastRefreshClickTime = now;
    refreshClickCount++;

    if (refreshClickCount >= 10) {
      refreshClickCount = 0;
      if (dom.rankingTestSection) {
        dom.rankingTestSection.style.display = 'block';
        try { sound.playBonusCatch?.() || sound.playCorrect?.(); } catch (e) {}
        appendLog(dom.rankingIdentityLog, '🛠️ [DEBUG] デバッグモードを起動しました');
      }
    }
  });

  // デバッグ用セクション「閉じる」ボタン
  dom.btnCloseRankingTestSection?.addEventListener('click', () => {
    sound.playTap();
    if (dom.rankingTestSection) {
      dom.rankingTestSection.style.display = 'none';
    }
  });

  // テスト用スコア送信ボタン (内部ユーザーID動作検証用)
  dom.btnTestSubmitScore?.addEventListener('click', () => {
    sound.playTap();
    const testScore = game.score > 0 ? game.score : Math.floor(Math.random() * 600 + 400);
    const payload = buildRankingPayload(testScore, { mode: game.mode, maxCombo: game.maxCombo });
    game.score = payload.score;
    game.saveScoreToLeaderboard();
    renderResultRanking();
    appendLog(dom.rankingIdentityLog, `🚀 テスト送信: [${payload.internal_user_id.slice(0, 8)}...] ${payload.player_name} (${payload.score}pt)`);
  });

  // キャンバスタップ / クリックイベント (マルチタッチ・スマホ対応)
  function handleInput(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    game.handleTap(x, y);
  }

  canvas.addEventListener('pointerdown', (e) => {
    handleInput(e.clientX, e.clientY);
  });

  // メインループ
  let lastFrameTime = 0;
  function gameLoop(timestamp) {
    requestAnimationFrame(gameLoop);

    // FPS制御 (30FPS / 60FPS)
    if (timestamp) {
      const interval = 1000 / targetFps;
      if (timestamp - lastFrameTime < interval - 1.5) {
        return; // 次のフレームまで待機
      }
      lastFrameTime = timestamp;
    }

    try {
      game.update();
    } catch (err) {
      console.error("[Game Loop Error] game.update failed:", err);
    }

    try {
      renderer.render(game);
    } catch (err) {
      console.error("[Game Loop Error] renderer.render failed:", err);
    }

    try {
      // UI状態の同期
      updateUI();
    } catch (err) {
      console.error("[Game Loop Error] updateUI failed:", err);
    }
  }

  function updateUI() {
    // 【バグ1修正】カウントダウン表示の厳格制御
    if (game.state === GAME_STATES.COUNTDOWN) {
      dom.countdownOverlay.classList.remove('hidden');
      dom.countdownOverlay.innerText = game.countdownNumber || '';
    } else {
      dom.countdownOverlay.classList.add('hidden');
      dom.countdownOverlay.innerText = '';
    }

    if (game.state === GAME_STATES.PLAYING) {
      dom.hudTimeVal.innerText = game.timeLeft;
      dom.hudScoreVal.innerText = game.score;
      dom.hudComboVal.innerText = game.combo;
      dom.baitStockBadge.innerText = game.baitStock;

      if (game.timeLeft <= 10) {
        dom.hudTimeVal.classList.add('hud-time-alert');
      } else {
        dom.hudTimeVal.classList.remove('hud-time-alert');
      }

      // 餌ボタンの有効/無効
      if (game.baitStock <= 0) {
        dom.feedKareiBtn.classList.add('disabled');
        dom.feedHirameBtn.classList.add('disabled');
      } else {
        dom.feedKareiBtn.classList.remove('disabled');
        dom.feedHirameBtn.classList.remove('disabled');
      }
    }

    // リザルト画面への遷移検出
    if (game.state === GAME_STATES.RESULT && dom.resultModal.classList.contains('hidden')) {
      dom.resultScore.innerText = `${game.score} pt`;
      dom.resultTitleBadge.innerText = game.getPlayerTitle();
      dom.resultMaxCombo.innerText = game.maxCombo;
      dom.resultCatchCount.innerText = `${game.correctCount} ${t('countUnit')}`;

      // スコアをランキングに記録して画面に表示
      game.saveScoreToLeaderboard();
      renderResultRanking();
      showResultLore();
      appendLog(dom.rankingIdentityLog, `🏆 本日の水揚げ結果: ${game.score} pt (${game.getPlayerTitle()})`);

      dom.resultModal.classList.remove('hidden');
      trackEvent('game_over', { score: game.score, combo: game.maxCombo, mode: game.mode });
    }
  }

  requestAnimationFrame(gameLoop);
});
