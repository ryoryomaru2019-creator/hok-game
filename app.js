/**
 * ランキング用内部ユーザーID自動静止システム (app.js)
 * 
 * 【セキュリティと永続性についての注意事項】
 * ※ 本システムはブラウザの localStorage を利用した最小構成の識別システムです。
 * ※ 完全な本人保証・なりすまし防止には将来的なサーバー署名やレート制限、認証トークンの導入が必要です。
 * ※ ユーザーがブラウザのキャッシュ/localStorageを削除した場合や、別ブラウザ・別端末でアクセスした場合は別人として新規発行されます。
 */

export const STORAGE_KEYS = {
  INTERNAL_USER_ID: 'ranking_internal_user_id',
  PLAYER_NAME: 'ranking_player_name',
  FIRST_SEEN_AT: 'ranking_first_seen_at',
  LAST_SEEN_AT: 'ranking_last_seen_at'
};

export const MAX_NAME_LENGTH = 12;

/**
 * 1. generateInternalUserId
 * internal_user_id の自動生成
 * - crypto が使える場合は crypto ベースで安全に生成
 * - 使えない場合の簡易フォールバックも用意
 * - 'u-' から始まる英数字とハイフンのみで構成
 * - 可読性より衝突回避を優先
 */
export function generateInternalUserId() {
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') {
      return `u-${crypto.randomUUID()}`;
    }
    if (typeof crypto.getRandomValues === 'function') {
      const arr = new Uint8Array(16);
      crypto.getRandomValues(arr);
      const hex = Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
      return `u-${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
    }
  }
  // フォールバック: タイムスタンプと擬似乱数
  const rand = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
  const time = Date.now().toString(36);
  return `u-${time}-${rand}`;
}

/**
 * 2. loadOrCreateUserIdentity
 * ユーザー識別情報の復元または新規発行
 * 第1候補: localStorage の ranking_internal_user_id
 * 第2候補: localStorage にIDがない場合は新規発行
 * 戻り値: ユーザー情報オブジェクト
 */
export function loadOrCreateUserIdentity() {
  const now = new Date().toISOString();
  let userId = null;

  try {
    userId = localStorage.getItem(STORAGE_KEYS.INTERNAL_USER_ID);
  } catch (e) {
    console.warn("localStorage read error:", e);
  }

  if (userId && typeof userId === 'string' && userId.startsWith('u-')) {
    // 既存ユーザーとして復元
    updateLastSeenAt();
    const playerName = localStorage.getItem(STORAGE_KEYS.PLAYER_NAME) || '';
    const firstSeen = localStorage.getItem(STORAGE_KEYS.FIRST_SEEN_AT) || now;
    const lastSeen = localStorage.getItem(STORAGE_KEYS.LAST_SEEN_AT) || now;

    return {
      internal_user_id: userId,
      player_name: playerName,
      first_seen_at: firstSeen,
      last_seen_at: lastSeen,
      is_new_user: false
    };
  } else {
    // 新規ユーザー発行
    userId = generateInternalUserId();

    try {
      localStorage.setItem(STORAGE_KEYS.INTERNAL_USER_ID, userId);
      localStorage.setItem(STORAGE_KEYS.FIRST_SEEN_AT, now);
      localStorage.setItem(STORAGE_KEYS.LAST_SEEN_AT, now);
    } catch (e) {
      console.warn("localStorage write error:", e);
    }

    return {
      internal_user_id: userId,
      player_name: '',
      first_seen_at: now,
      last_seen_at: now,
      is_new_user: true
    };
  }
}

/**
 * 3. sanitizePlayerName
 * 危険なHTML文字列を無害化し、最大文字数で切り詰め
 */
export function sanitizePlayerName(name) {
  if (typeof name !== 'string') return '';
  return name
    .trim()
    .replace(/[&<>'"]/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[char] || char))
    .slice(0, MAX_NAME_LENGTH);
}

/**
 * 4. savePlayerName
 * プレイヤー名を無害化して保存
 * 空文字や空白のみは保存しない
 * 正常時のみ localStorage に保存し、最終訪問日時を更新
 */
export function savePlayerName(rawName) {
  const sanitized = sanitizePlayerName(rawName);
  if (!sanitized) {
    return false;
  }

  try {
    localStorage.setItem(STORAGE_KEYS.PLAYER_NAME, sanitized);
    updateLastSeenAt();
  } catch (e) {
    console.warn("localStorage savePlayerName error:", e);
    return false;
  }

  return sanitized;
}

/**
 * 5. updateLastSeenAt
 * ranking_last_seen_at を現在時刻で更新
 */
export function updateLastSeenAt() {
  const now = new Date().toISOString();
  try {
    localStorage.setItem(STORAGE_KEYS.LAST_SEEN_AT, now);
  } catch (e) {
    console.warn("localStorage updateLastSeenAt error:", e);
  }
  return now;
}

/**
 * 6. buildRankingPayload
 * ランキング送信データの構築
 * 最低限 internal_user_id, player_name, score, played_at を含める
 */
export function buildRankingPayload(score, extra = {}) {
  const identity = loadOrCreateUserIdentity();
  const currentName = localStorage.getItem(STORAGE_KEYS.PLAYER_NAME) || identity.player_name || '名無し釣り人';

  return {
    internal_user_id: identity.internal_user_id,
    player_name: currentName,
    score: Number(score) || 0,
    played_at: new Date().toISOString(),
    ...extra
  };
}

/**
 * 7. renderIdentityStatus
 * 現在の認識状態表示
 * textContentを優先し安全に描画
 * 通常表示では内部ID全文は見せず、デバッグ用として先頭数文字のみ表示
 */
export function renderIdentityStatus(containerEl, identity) {
  if (!containerEl) return;
  const currentName = identity.player_name ? identity.player_name : '未設定 (ゲスト)';
  const prefixId = identity.internal_user_id ? identity.internal_user_id.slice(0, 10) + '...' : 'none';

  containerEl.replaceChildren();

  const wrap = document.createElement('div');
  wrap.className = 'identity-status-pill';

  const badge = document.createElement('span');
  badge.className = identity.is_new_user ? 'badge-new' : 'badge-recon';
  badge.textContent = identity.is_new_user ? '✨ 新規発行' : '👤 同一人物として自動復元';

  const nameSpan = document.createElement('span');
  nameSpan.className = 'identity-name';
  nameSpan.textContent = `釣り人: ${currentName}`;

  const debugId = document.createElement('span');
  debugId.className = 'identity-id-hint';
  debugId.textContent = `[ID: ${prefixId}]`;

  wrap.append(badge, nameSpan, debugId);
  containerEl.appendChild(wrap);
}

/**
 * 8. appendLog
 * 簡易ログ表示欄へ時系列でログを追記
 * 新規発行、復元成功、名前保存、ランキング送信データ生成等を確認可能
 */
export function appendLog(logContainerEl, message) {
  if (!logContainerEl) return;
  const timeStr = new Date().toLocaleTimeString();
  const line = document.createElement('div');
  line.className = 'log-line';

  const timeSpan = document.createElement('span');
  timeSpan.className = 'log-time';
  timeSpan.textContent = `[${timeStr}] `;

  const msgSpan = document.createElement('span');
  msgSpan.className = 'log-text';
  msgSpan.textContent = message;

  line.append(timeSpan, msgSpan);
  logContainerEl.appendChild(line);
  logContainerEl.scrollTop = logContainerEl.scrollHeight;
}
