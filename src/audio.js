// Audio controller handling custom local BGM tracks, LinkCore streaming links, 30s fading preview, and Web Audio API synthesized SFX

export const DEFAULT_BGM_PLAYLIST = [
  { id: 'halloween_pig', title: 'Halloween PIG!', src: './bgm/Halloween PIG!.mp3', enabled: true },
  { id: 'nano_ninja', title: 'Nano Ninja', src: './bgm/Nano Ninja.mp3', enabled: true },
  { id: 'onabe_the_mic', title: 'ONABE THE MIC – Hyper Boil Twins', src: './bgm/ONABE THE MIC – Hyper Boil Twins.mp3', enabled: true },
  { id: 'eenyade', title: 'ええんやで', src: './bgm/ええんやで.mp3', enabled: true },
  { id: 'haraheri', title: 'はらへりひれはれ', src: './bgm/はらへりひれはれ.mp3', enabled: true },
  { id: 'tonton', title: 'トントン！！！', src: './bgm/トントン！！！.mp3', enabled: true }
];

export function resolveAssetPath(src) {
  if (typeof src === 'string' && src.startsWith('/')) {
    return '.' + src;
  }
  return src;
}

function loadStoredPlaylist() {
  try {
    const saved = localStorage.getItem('hirame_bgm_playlist');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // 旧曲名「はらほろひれはれ」を新曲名「はらへりひれはれ」へマイグレーション
        const migrated = parsed.map(item => {
          let title = item.title;
          let src = item.src;
          if (title === 'はらほろひれはれ' || (src && src.includes('はらほろひれはれ'))) {
            title = 'はらへりひれはれ';
            src = '/bgm/はらへりひれはれ.mp3';
          }
          return {
            ...item,
            title,
            src,
            enabled: item.enabled !== false
          };
        });

        // デフォルト新曲が未登録の場合はリスト末尾に追加
        for (const def of DEFAULT_BGM_PLAYLIST) {
          const exists = migrated.some(m => m.src === def.src || m.title === def.title);
          if (!exists) {
            migrated.push({ ...def });
          }
        }

        localStorage.setItem('hirame_bgm_playlist', JSON.stringify(migrated));
        return migrated;
      }
    }
  } catch (e) {
    console.warn("Failed to load stored BGM playlist", e);
  }
  const initList = DEFAULT_BGM_PLAYLIST.map(item => ({ ...item }));
  try {
    localStorage.setItem('hirame_bgm_playlist', JSON.stringify(initList));
  } catch (e) {}
  return initList;
}

export const BGM_PLAYLIST = loadStoredPlaylist();

export const LINKCORE_URL = "https://linkco.re/HaZSEutS";

class SoundSystem {
  constructor() {
    this.ctx = null;
    this.bgmAudio = null;
    this.auditionAudio = null;
    this.auditionTimeout = null;
    this.auditionFadeTimeout = null;
    this.auditionFadeInterval = null;
    this.isAuditioning = false;
    this.auditionTrackIndex = null;
    this.bgmFadeInterval = null;

    // 後方互換用プロパティ
    this.previewAudio = null;
    this.previewTimeout = null;
    this.previewFadeInterval = null;
    this.previewingIndex = null;
    
    // 設定項目 (ローカルストレージから復元)
    this.masterMuted = localStorage.getItem('hirame_master_muted') === 'true';
    this.bgmMuted = localStorage.getItem('hirame_bgm_muted') === 'true';
    this.seMuted = localStorage.getItem('hirame_se_muted') === 'true';
    
    this.masterVolume = parseFloat(localStorage.getItem('hirame_master_vol') || '0.8');
    this.bgmVolume = parseFloat(localStorage.getItem('hirame_bgm_vol') || '0.7');
    this.seVolume = parseFloat(localStorage.getItem('hirame_se_vol') || '0.8');

    // BGM再生モード: 'random' (曲が終わったら次へ) or 'fixed' (現在の曲を固定ループ)
    this.bgmPlayMode = localStorage.getItem('hirame_bgm_mode') || 'random';

    const playable = this.getPlayablePlaylist();
    this.currentTrackIndex = playable.length > 0
      ? BGM_PLAYLIST.indexOf(playable[Math.floor(Math.random() * playable.length)])
      : 0;
    if (this.currentTrackIndex < 0) this.currentTrackIndex = 0;

    this.linkcoreUrl = LINKCORE_URL;

    // イベント通知コールバック
    this.onTrackChange = null;
    this.onPreviewStateChange = null;
    this.onPlayStateChange = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // ===== ボリューム & ミュート設定 =====
  setMasterVolume(val) {
    this.masterVolume = Math.max(0, Math.min(1, val));
    localStorage.setItem('hirame_master_vol', this.masterVolume);
    this.applyBgmVolume();
    this.applyAuditionVolume();
  }

  setBgmVolume(val) {
    this.bgmVolume = Math.max(0, Math.min(1, val));
    localStorage.setItem('hirame_bgm_vol', this.bgmVolume);
    this.applyBgmVolume();
    this.applyAuditionVolume();
  }

  setSeVolume(val) {
    this.seVolume = Math.max(0, Math.min(1, val));
    localStorage.setItem('hirame_se_vol', this.seVolume);
  }

  toggleMasterMute() {
    this.masterMuted = !this.masterMuted;
    localStorage.setItem('hirame_master_muted', this.masterMuted);
    this.applyBgmVolume();
    this.applyAuditionVolume();
    return this.masterMuted;
  }

  toggleBgmMute() {
    this.bgmMuted = !this.bgmMuted;
    localStorage.setItem('hirame_bgm_muted', this.bgmMuted);
    this.applyBgmVolume();
    this.applyAuditionVolume();
    return this.bgmMuted;
  }

  toggleSeMute() {
    this.seMuted = !this.seMuted;
    localStorage.setItem('hirame_se_muted', this.seMuted);
    return this.seMuted;
  }

  setBgmPlayMode(mode) {
    this.bgmPlayMode = mode; // 'random' or 'fixed'
    localStorage.setItem('hirame_bgm_mode', mode);
  }

  applyBgmVolume(fadeMultiplier = 1.0) {
    if (!this.bgmAudio) return;
    if (this.masterMuted || this.bgmMuted || this.isAuditioning) {
      this.bgmAudio.volume = 0;
    } else {
      const target = Math.max(0, Math.min(1, this.masterVolume * this.bgmVolume * fadeMultiplier));
      this.bgmAudio.volume = target;
    }
  }

  applyAuditionVolume(fadeMultiplier = 1.0) {
    if (!this.auditionAudio) return;
    if (this.masterMuted || this.bgmMuted) {
      this.auditionAudio.volume = 0;
    } else {
      const target = Math.max(0, Math.min(1, this.masterVolume * this.bgmVolume * (this.auditionAudio._fadeLevel != null ? this.auditionAudio._fadeLevel : fadeMultiplier)));
      this.auditionAudio.volume = target;
    }
  }

  applyPreviewVolume(factor = 1.0) {
    this.applyAuditionVolume(factor);
  }

  getEffectiveSeVolume() {
    if (this.masterMuted || this.seMuted) return 0;
    return this.masterVolume * this.seVolume;
  }

  getCurrentTrack() {
    if (BGM_PLAYLIST.length === 0) return { id: 'none', title: '曲なし', src: '', enabled: false };
    return BGM_PLAYLIST[this.currentTrackIndex % BGM_PLAYLIST.length];
  }

  // 有効な曲リストのみを返す (ゲーム本体用)
  getPlayablePlaylist() {
    return BGM_PLAYLIST.filter(t => t.enabled !== false);
  }

  // ===== BGM 制御 =====
  startBGM(trackIndex = null, forceNewRandom = false, { fromStart = false, fadeIn = false, fadeDuration = 1.5 } = {}) {
    this.init();
    this.stopTrackAudition(false); // 試聴を停止

    const playable = this.getPlayablePlaylist();
    if (playable.length === 0) {
      if (this.bgmAudio) this.bgmAudio.pause();
      if (this.onPlayStateChange) this.onPlayStateChange(false);
      return;
    }

    if (trackIndex !== null) {
      this.currentTrackIndex = trackIndex % BGM_PLAYLIST.length;
    } else if (this.bgmPlayMode === 'random' && forceNewRandom) {
      if (playable.length > 1) {
        let randTrack;
        const curTrack = this.getCurrentTrack();
        do {
          randTrack = playable[Math.floor(Math.random() * playable.length)];
        } while (randTrack === curTrack && playable.length > 1);
        this.currentTrackIndex = BGM_PLAYLIST.indexOf(randTrack);
      }
    }

    // 現在の曲が無効化されている場合は、有効な最初の曲にフォールバック
    if (BGM_PLAYLIST[this.currentTrackIndex]?.enabled === false) {
      this.currentTrackIndex = BGM_PLAYLIST.indexOf(playable[0]);
    }

    const track = this.getCurrentTrack();
    if (!this.bgmAudio) {
      this.bgmAudio = new Audio();
      this.bgmAudio.addEventListener('ended', () => {
        if (this.bgmPlayMode === 'fixed') {
          this.bgmAudio.currentTime = 0;
          this.bgmAudio.play().catch(e => console.log(e));
        } else {
          this.startBGM(null, true);
        }
      });
      this.bgmAudio.addEventListener('play', () => {
        if (this.onPlayStateChange && !this.isAuditioning) this.onPlayStateChange(true);
      });
      this.bgmAudio.addEventListener('pause', () => {
        if (this.onPlayStateChange && !this.isAuditioning) this.onPlayStateChange(false);
      });
    }

    if (this.bgmFadeInterval) {
      clearInterval(this.bgmFadeInterval);
      this.bgmFadeInterval = null;
    }

    this.bgmAudio.src = encodeURI(resolveAssetPath(track.src));
    if (fromStart) {
      this.bgmAudio.currentTime = 0;
    }

    if (fadeIn) {
      // 0からフェードイン
      this.bgmAudio.volume = 0;
      this.bgmAudio.play().catch(e => console.log("BGM play prevented:", e));
      const stepMs = 50;
      const totalSteps = Math.max(1, Math.floor((fadeDuration * 1000) / stepMs));
      let step = 0;
      this.bgmFadeInterval = setInterval(() => {
        step++;
        const factor = Math.min(1.0, step / totalSteps);
        this.applyBgmVolume(factor);
        if (step >= totalSteps) {
          clearInterval(this.bgmFadeInterval);
          this.bgmFadeInterval = null;
        }
      }, stepMs);
    } else {
      this.applyBgmVolume();
      this.bgmAudio.play().catch(e => console.log("BGM play prevented:", e));
    }

    if (this.onTrackChange) this.onTrackChange(track);
    if (this.onPlayStateChange) this.onPlayStateChange(true);
  }

  // ゲームカウントダウン用: 最初からフェードイン再生
  startBGMWithFadeIn(trackIndex = null, fadeDuration = 1.5) {
    this.startBGM(trackIndex, false, { fromStart: true, fadeIn: true, fadeDuration });
  }

  // タイムアップ用: フェードアウトして停止
  fadeOutBGM(fadeDuration = 1.0) {
    if (!this.bgmAudio || this.bgmAudio.paused) return;
    if (this.bgmFadeInterval) {
      clearInterval(this.bgmFadeInterval);
      this.bgmFadeInterval = null;
    }

    const stepMs = 50;
    const totalSteps = Math.max(1, Math.floor((fadeDuration * 1000) / stepMs));
    let step = 0;
    const initialVolFactor = 1.0;

    this.bgmFadeInterval = setInterval(() => {
      step++;
      const factor = Math.max(0, initialVolFactor * (1.0 - (step / totalSteps)));
      this.applyBgmVolume(factor);
      if (step >= totalSteps) {
        clearInterval(this.bgmFadeInterval);
        this.bgmFadeInterval = null;
        this.stopBGM();
      }
    }, stepMs);
  }

  pauseBGM() {
    if (this.bgmAudio) {
      this.bgmAudio.pause();
      if (this.onPlayStateChange && !this.isAuditioning) this.onPlayStateChange(false);
    }
  }

  resumeBGM() {
    if (this.bgmAudio && this.bgmAudio.paused && !this.isAuditioning) {
      this.applyBgmVolume();
      this.bgmAudio.play().catch(e => console.log(e));
      if (this.onPlayStateChange) this.onPlayStateChange(true);
    }
  }

  stopBGM() {
    if (this.bgmFadeInterval) {
      clearInterval(this.bgmFadeInterval);
      this.bgmFadeInterval = null;
    }
    if (this.bgmAudio) {
      this.bgmAudio.pause();
      this.bgmAudio.currentTime = 0;
      this.applyBgmVolume();
      if (this.onPlayStateChange && !this.isAuditioning) this.onPlayStateChange(false);
    }
  }

  isPlaying() {
    if (this.isAuditioning && this.auditionAudio && !this.auditionAudio.paused) {
      return true;
    }
    return !!(this.bgmAudio && !this.bgmAudio.paused);
  }

  togglePlayPause() {
    if (this.isPlaying()) {
      if (this.isAuditioning) {
        this.stopTrackAudition();
      } else {
        this.pauseBGM();
      }
      return false;
    } else {
      if (this.bgmAudio && this.bgmAudio.src) {
        this.resumeBGM();
      } else {
        this.startBGM(this.currentTrackIndex);
      }
      return true;
    }
  }

  // ===== 20秒間ランダム試聴 & 音量チェック再生 (1曲で止まる) =====
  // fade: true  -> 「楽曲一覧＆試聴」用 (フェードイン＆フェードアウト)
  // fade: false -> 「BGM音量」コンテナ用 (音量確認のためフェードなしで即時再生)
  startTrackAudition(trackIndex = null, { fade = true, duration = 20 } = {}) {
    this.init();
    this.stopTrackAudition(false);

    // 通常BGMを一時停止
    if (this.bgmAudio) {
      this.bgmAudio.pause();
    }

    const idx = trackIndex !== null ? trackIndex : this.currentTrackIndex;
    const track = BGM_PLAYLIST[idx] || this.getCurrentTrack();
    if (!track || !track.src) return;

    this.isAuditioning = true;
    this.auditionTrackIndex = idx;
    this.currentTrackIndex = idx;
    if (this.onTrackChange) this.onTrackChange(track);

    this.auditionAudio = new Audio(encodeURI(resolveAssetPath(track.src)));
    this.previewAudio = this.auditionAudio; // 後方互換

    if (fade) {
      this.auditionAudio._fadeLevel = 0;
      this.applyAuditionVolume(0);
    } else {
      this.auditionAudio._fadeLevel = 1.0;
      this.applyAuditionVolume(1.0);
    }

    const onMetadata = () => {
      if (!this.isAuditioning || !this.auditionAudio) return;
      const totalDur = this.auditionAudio.duration || 120;
      // ランダム開始位置 (曲長から20秒を引いた範囲、最低0秒)
      const maxStart = Math.max(0, totalDur - duration - 2);
      const startSec = maxStart > 5 ? Math.floor(5 + Math.random() * (maxStart - 5)) : 0;
      this.auditionAudio.currentTime = startSec;

      this.auditionAudio.play().catch(e => console.log("Audition play prevented:", e));

      if (fade) {
        // 1.2秒かけてフェードイン
        let currentFade = 0;
        this.auditionFadeInterval = setInterval(() => {
          currentFade += 0.08;
          if (currentFade >= 1.0) {
            currentFade = 1.0;
            clearInterval(this.auditionFadeInterval);
            this.auditionFadeInterval = null;
          }
          if (this.auditionAudio) {
            this.auditionAudio._fadeLevel = currentFade;
            this.applyAuditionVolume(currentFade);
          } else {
            clearInterval(this.auditionFadeInterval);
            this.auditionFadeInterval = null;
          }
        }, 80);

        // (duration - 2) 秒後にフェードアウト開始
        const fadeOutDelay = Math.max(500, (duration - 2.0) * 1000);
        this.auditionFadeTimeout = setTimeout(() => {
          let outFade = 1.0;
          this.auditionFadeInterval = setInterval(() => {
            outFade -= 0.08;
            if (outFade <= 0) {
              outFade = 0;
              clearInterval(this.auditionFadeInterval);
              this.auditionFadeInterval = null;
            }
            if (this.auditionAudio) {
              this.auditionAudio._fadeLevel = outFade;
              this.applyAuditionVolume(outFade);
            } else {
              clearInterval(this.auditionFadeInterval);
              this.auditionFadeInterval = null;
            }
          }, 80);
        }, fadeOutDelay);
      }

      // duration 秒後に完全停止（1曲で止まる、リピートなし）
      this.auditionTimeout = setTimeout(() => {
        this.stopTrackAudition(false);
      }, duration * 1000);
    };

    this.auditionAudio.addEventListener('loadedmetadata', onMetadata);
    setTimeout(() => {
      if (this.auditionAudio && this.auditionAudio.paused) {
        onMetadata();
      }
    }, 350);

    if (this.onPreviewStateChange) {
      this.onPreviewStateChange(idx, true);
    }
    if (this.onPlayStateChange) {
      this.onPlayStateChange(true);
    }
  }

  stopTrackAudition(resumeNormalBgm = false) {
    if (this.auditionTimeout) {
      clearTimeout(this.auditionTimeout);
      this.auditionTimeout = null;
    }
    if (this.auditionFadeTimeout) {
      clearTimeout(this.auditionFadeTimeout);
      this.auditionFadeTimeout = null;
    }
    if (this.auditionFadeInterval) {
      clearInterval(this.auditionFadeInterval);
      this.auditionFadeInterval = null;
    }
    if (this.auditionAudio) {
      this.auditionAudio.pause();
      this.auditionAudio = null;
    }
    this.previewAudio = null;

    const prevIndex = this.auditionTrackIndex;
    this.isAuditioning = false;
    this.auditionTrackIndex = null;

    if (this.onPreviewStateChange) {
      this.onPreviewStateChange(prevIndex, false);
    }
    if (this.onPlayStateChange) {
      this.onPlayStateChange(false);
    }

    if (resumeNormalBgm && this.bgmAudio && !this.bgmMuted && !this.masterMuted) {
      this.applyBgmVolume();
      this.bgmAudio.play().catch(e => console.log(e));
    }
  }

  // 後方互換用
  startTrackPreview(index) {
    this.startTrackAudition(index, { fade: true, duration: 20 });
  }

  // ===== プレイリスト管理 (追加・削除・並び順変更・有効無効・リセット) =====
  getPlaylist(onlyEnabled = false) {
    if (onlyEnabled) {
      return BGM_PLAYLIST.filter(t => t.enabled !== false);
    }
    return [...BGM_PLAYLIST];
  }

  setPlaylist(newList) {
    if (!Array.isArray(newList) || newList.length === 0) return;
    BGM_PLAYLIST.length = 0;
    BGM_PLAYLIST.push(...newList);
    localStorage.setItem('hirame_bgm_playlist', JSON.stringify(BGM_PLAYLIST));
    if (this.currentTrackIndex >= BGM_PLAYLIST.length) {
      this.currentTrackIndex = 0;
    }
    if (this.onTrackChange) {
      this.onTrackChange(this.getCurrentTrack());
    }
  }

  toggleTrackEnabled(index, enabled = null) {
    if (index >= 0 && index < BGM_PLAYLIST.length) {
      if (enabled === null) {
        BGM_PLAYLIST[index].enabled = BGM_PLAYLIST[index].enabled === false;
      } else {
        BGM_PLAYLIST[index].enabled = !!enabled;
      }
      localStorage.setItem('hirame_bgm_playlist', JSON.stringify(BGM_PLAYLIST));
      return BGM_PLAYLIST[index].enabled;
    }
    return false;
  }

  addTrack(track) {
    if (!track || !track.src) return null;
    const newTrack = {
      id: track.id || `custom_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      title: track.title || '新規楽曲',
      src: track.src,
      enabled: track.enabled !== false
    };
    BGM_PLAYLIST.push(newTrack);
    localStorage.setItem('hirame_bgm_playlist', JSON.stringify(BGM_PLAYLIST));
    return newTrack;
  }

  removeTrack(index) {
    if (BGM_PLAYLIST.length <= 1) {
      return false; // 最低1曲は残す
    }
    if (index >= 0 && index < BGM_PLAYLIST.length) {
      const isCurrent = this.currentTrackIndex === index;
      const wasPlaying = this.isPlaying();
      BGM_PLAYLIST.splice(index, 1);
      localStorage.setItem('hirame_bgm_playlist', JSON.stringify(BGM_PLAYLIST));
      if (isCurrent) {
        this.currentTrackIndex = Math.min(this.currentTrackIndex, BGM_PLAYLIST.length - 1);
        if (wasPlaying) {
          this.startBGM(this.currentTrackIndex);
        }
      } else if (this.currentTrackIndex > index) {
        this.currentTrackIndex--;
      }
      return true;
    }
    return false;
  }

  reorderTrack(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= BGM_PLAYLIST.length || toIndex < 0 || toIndex >= BGM_PLAYLIST.length) return;
    const [moved] = BGM_PLAYLIST.splice(fromIndex, 1);
    BGM_PLAYLIST.splice(toIndex, 0, moved);
    localStorage.setItem('hirame_bgm_playlist', JSON.stringify(BGM_PLAYLIST));
    if (this.currentTrackIndex === fromIndex) {
      this.currentTrackIndex = toIndex;
    } else if (fromIndex < this.currentTrackIndex && toIndex >= this.currentTrackIndex) {
      this.currentTrackIndex--;
    } else if (fromIndex > this.currentTrackIndex && toIndex <= this.currentTrackIndex) {
      this.currentTrackIndex++;
    }
  }

  resetPlaylist() {
    BGM_PLAYLIST.length = 0;
    BGM_PLAYLIST.push(...DEFAULT_BGM_PLAYLIST.map(t => ({ ...t })));
    localStorage.setItem('hirame_bgm_playlist', JSON.stringify(BGM_PLAYLIST));
    this.currentTrackIndex = 0;
    if (this.isPlaying()) {
      this.startBGM(0);
    }
  }

  nextTrack() {
    const playable = this.getPlayablePlaylist();
    if (playable.length === 0) return;
    const curTrack = this.getCurrentTrack();
    const curPlayableIdx = playable.indexOf(curTrack);
    const nextPlayableIdx = (curPlayableIdx + 1) % playable.length;
    this.currentTrackIndex = BGM_PLAYLIST.indexOf(playable[nextPlayableIdx]);
    this.startBGM(this.currentTrackIndex);
  }

  selectTrack(index) {
    this.startBGM(index);
  }

  // ===== 効果音 (Web Audio API 合成) =====
  playTap() {
    const seVol = this.getEffectiveSeVolume();
    if (seVol <= 0 || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.08);
    
    gain.gain.setValueAtTime(0.2 * seVol, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.08);
  }

  playSuccess(combo = 0) {
    const seVol = this.getEffectiveSeVolume();
    if (seVol <= 0 || !this.ctx) return;
    const now = this.ctx.currentTime;
    
    const baseFreq = 523.25; // C5
    const pitchOffset = Math.min(combo * 20, 200);
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq + pitchOffset, now);
    osc.frequency.setValueAtTime((baseFreq * 1.5) + pitchOffset, now + 0.07);
    
    gain.gain.setValueAtTime(0.35 * seVol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.25);
  }

  playMiss() {
    const seVol = this.getEffectiveSeVolume();
    if (seVol <= 0 || !this.ctx) return;
    const now = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.2);
    
    gain.gain.setValueAtTime(0.3 * seVol, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.2);
  }

  playCombo() {
    const seVol = this.getEffectiveSeVolume();
    if (seVol <= 0 || !this.ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C E G C
    notes.forEach((freq, idx) => {
      const now = this.ctx.currentTime + idx * 0.06;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      
      gain.gain.setValueAtTime(0.25 * seVol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(now);
      osc.stop(now + 0.15);
    });
  }

  playCount(num) {
    const seVol = this.getEffectiveSeVolume();
    if (seVol <= 0 || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    const freq = num === 0 ? 880 : 440;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    
    gain.gain.setValueAtTime(0.4 * seVol, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + (num === 0 ? 0.4 : 0.15));
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + (num === 0 ? 0.4 : 0.15));
  }

  playSplash() {
    const seVol = this.getEffectiveSeVolume();
    if (seVol <= 0 || !this.ctx) return;
    const now = this.ctx.currentTime;
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.15);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1000, now);
    filter.frequency.exponentialRampToValueAtTime(300, now + 0.15);
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25 * seVol, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    
    noise.start(now);
  }

  playInk() {
    const seVol = this.getEffectiveSeVolume();
    if (seVol <= 0 || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.35);
    
    gain.gain.setValueAtTime(0.4 * seVol, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.35);
  }

  playTimeUp() {
    const seVol = this.getEffectiveSeVolume();
    if (seVol <= 0 || !this.ctx) return;
    const chords = [392, 329.63, 261.63]; // G4, E4, C4
    chords.forEach((freq, idx) => {
      const now = this.ctx.currentTime + idx * 0.12;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      
      gain.gain.setValueAtTime(0.3 * seVol, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(now);
      osc.stop(now + 0.4);
    });
  }

  // パラメーター即時適用・連動合図音「ポロン♪」 (G5 -> C6 -> E6 の美しい澄んだベルチャイム)
  playChime() {
    this.init();
    const seVol = this.getEffectiveSeVolume();
    if (seVol <= 0 || !this.ctx) return;
    const notes = [
      { freq: 783.99, delay: 0.00 },   // G5
      { freq: 1046.50, delay: 0.09 },  // C6
      { freq: 1318.51, delay: 0.19 }   // E6
    ];
    notes.forEach(({ freq, delay }) => {
      const now = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      
      gain.gain.setValueAtTime(0.35 * seVol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(now);
      osc.stop(now + 0.45);
    });
  }
}

export const sound = new SoundSystem();
