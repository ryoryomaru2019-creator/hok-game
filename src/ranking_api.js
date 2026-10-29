// ============================================================================
// HoK！ オンライン世界ランキング クライアントAPIモジュール (ranking_api.js)
// ============================================================================

export const STORAGE_KEYS = {
  API_URL: 'hirame_ranking_api_url',
  CACHE_PREFIX: 'hirame_online_cache_',
  LAST_SYNC: 'hirame_ranking_last_sync'
};

// デフォルトのオンラインランキングAPI URL（管理画面でいつでも変更・設定可能）
export const DEFAULT_ONLINE_RANKING_API_URL = 'https://script.google.com/macros/s/AKfycbzER9ZtozR_YyLvtStJ_KXhkyJxqiXsJjRLDZYieXfGbK-ZKefpQQqQTT_mUMe44mHHtg/exec';

/**
 * 設定されたオンラインAPIのURLを取得
 */
export function getOnlineRankingApiUrl() {
  try {
    const custom = localStorage.getItem(STORAGE_KEYS.API_URL);
    if (custom && custom.trim().startsWith('http')) {
      return custom.trim();
    }
    // dev_config 内に保存されている場合も参照
    const devCfg = localStorage.getItem('hirame_dev_config');
    if (devCfg) {
      const parsed = JSON.parse(devCfg);
      if (parsed?.onlineRankingApiUrl && parsed.onlineRankingApiUrl.startsWith('http')) {
        return parsed.onlineRankingApiUrl.trim();
      }
    }
  } catch (e) {}
  return DEFAULT_ONLINE_RANKING_API_URL;
}

/**
 * オンラインAPIのURLを保存
 */
export function setOnlineRankingApiUrl(url) {
  try {
    const clean = (url || '').trim();
    localStorage.setItem(STORAGE_KEYS.API_URL, clean);
    const devCfg = localStorage.getItem('hirame_dev_config');
    if (devCfg) {
      const parsed = JSON.parse(devCfg);
      parsed.onlineRankingApiUrl = clean;
      localStorage.setItem('hirame_dev_config', JSON.stringify(parsed));
    }
    return true;
  } catch (e) {
    console.warn('[RankingAPI] Failed to save API URL', e);
    return false;
  }
}

/**
 * 接続テスト（ping）
 */
export async function testOnlineRankingConnection(apiUrl = getOnlineRankingApiUrl()) {
  if (!apiUrl) return { success: false, message: 'URLが未設定です' };
  try {
    const sep = apiUrl.includes('?') ? '&' : '?';
    const res = await fetch(`${apiUrl}${sep}action=ping&_t=${Date.now()}`, {
      method: 'GET',
      mode: 'cors'
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return { success: data.status === 'ok', data };
  } catch (err) {
    return { success: false, message: err.toString() };
  }
}

/**
 * 既存ローカルスコアをオンラインへ自動マイグレーション（1回のみ自動実行）
 * - 既に遊んでくれたプレイヤーの端末内スコア（mock_以外）をGASへ一括送信
 */
export async function migrateLocalScoresToOnline() {
  const apiUrl = getOnlineRankingApiUrl();
  if (!apiUrl) return false;

  try {
    const raw = localStorage.getItem('hirame_leaderboard');
    if (!raw) return false;
    const list = JSON.parse(raw);
    if (!Array.isArray(list) || list.length === 0) return false;

    // mock_ 以外の実記録で、かつ未同期(synced !== true)のものを抽出
    const unSyncedEntries = list.filter(item => {
      const isMock = String(item.id || '').startsWith('mock_');
      const isDeleted = !!item.deleted;
      const isSynced = item.synced === true;
      return !isMock && !isDeleted && !isSynced && typeof item.score === 'number' && item.score > 0;
    });

    if (unSyncedEntries.length === 0) return false;

    console.log(`[RankingAPI] 既存ローカルスコア ${unSyncedEntries.length}件 をオンラインへ同期中...`);

    const payload = {
      action: 'submit',
      entries: unSyncedEntries
    };

    let success = false;
    // 1. POST送信
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        mode: 'cors'
      });
      const data = await res.json();
      if (data && data.status === 'ok') success = true;
    } catch (postErr) {
      // 2. GETフォールバック
      try {
        const sep = apiUrl.includes('?') ? '&' : '?';
        const encoded = encodeURIComponent(JSON.stringify(payload));
        const res = await fetch(`${apiUrl}${sep}action=submit&data=${encoded}`, { method: 'GET', mode: 'cors' });
        const data = await res.json();
        if (data && data.status === 'ok') success = true;
      } catch (getErr) {}
    }

    if (success) {
      // 同期完了フラグをローカルに記録
      const updatedList = list.map(item => {
        if (unSyncedEntries.some(u => u.id === item.id)) {
          return { ...item, synced: true };
        }
        return item;
      });
      localStorage.setItem('hirame_leaderboard', JSON.stringify(updatedList));
      localStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());
      console.log('[RankingAPI] 🎉 既存ローカルスコアのオンライン同期が完了しました！');
      return true;
    }
  } catch (e) {
    console.warn('[RankingAPI] Migration failed', e);
  }
  return false;
}

/**
 * スコアをオンラインに送信（プレイ終了時）
 */
export async function submitScoreToOnline(entry) {
  const apiUrl = getOnlineRankingApiUrl();
  if (!apiUrl || !entry || typeof entry.score !== 'number') return false;

  const payload = {
    action: 'submit',
    ...entry
  };

  try {
    // 1. POST試行 (text/plain で送信してCORSプリフライトを回避)
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      mode: 'cors'
    });
    const data = await res.json();
    return data && data.status === 'ok';
  } catch (err) {
    // 2. GETフォールバック
    try {
      const sep = apiUrl.includes('?') ? '&' : '?';
      const encoded = encodeURIComponent(JSON.stringify(payload));
      const res = await fetch(`${apiUrl}${sep}action=submit&data=${encoded}`, { method: 'GET', mode: 'cors' });
      const data = await res.json();
      return data && data.status === 'ok';
    } catch (e) {
      console.warn('[RankingAPI] Online score submit failed, saved locally only.', e);
      return false;
    }
  }
}

/**
 * オンラインから世界ランキング一覧を取得
 * @param {string} period 'yearly' | 'monthly' | 'weekly' | 'daily'
 * @param {string} mode 'all' | 'karei' | 'hirame' | 'hirai'
 * @param {Array} fallbackList 通信失敗時のローカルデータ
 */
export async function fetchOnlineLeaderboard(period = 'yearly', mode = 'all', fallbackList = []) {
  const apiUrl = getOnlineRankingApiUrl();
  if (!apiUrl) return fallbackList;

  try {
    const sep = apiUrl.includes('?') ? '&' : '?';
    const url = `${apiUrl}${sep}action=get&period=${encodeURIComponent(period)}&mode=${encodeURIComponent(mode)}&limit=50&_t=${Date.now()}`;
    const res = await fetch(url, { method: 'GET', mode: 'cors' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (data && data.status === 'ok' && Array.isArray(data.rankings)) {
      // 重複排除: 同一ID、または同一ユーザーの同一スコアを除去
      const uniqueList = [];
      const seenIds = new Set();
      const seenScoresByUser = new Set();
      for (const item of data.rankings) {
        if (!item) continue;
        if (item.id && seenIds.has(item.id)) continue;
        const userKey = (item.internal_user_id || item.name || '') + '_' + item.score;
        if (seenScoresByUser.has(userKey)) continue;
        if (item.id) seenIds.add(item.id);
        seenScoresByUser.add(userKey);
        uniqueList.push(item);
      }

      // キャッシュ更新
      try {
        const cacheKey = `${STORAGE_KEYS.CACHE_PREFIX}${period}_${mode}`;
        localStorage.setItem(cacheKey, JSON.stringify({
          timestamp: Date.now(),
          rankings: uniqueList
        }));
      } catch (e) {}
      return uniqueList;
    }
  } catch (err) {
    console.debug('[RankingAPI] Fetch online rankings failed, using fallback/cache:', err);
    // キャッシュからの復元を試行
    try {
      const cacheKey = `${STORAGE_KEYS.CACHE_PREFIX}${period}_${mode}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed?.rankings) && parsed.rankings.length > 0) {
          return parsed.rankings;
        }
      }
    } catch (e) {}
  }

  return fallbackList;
}

/**
 * オンラインスコアの削除リクエスト
 */
export async function deleteScoreFromOnline(id, internalUserId) {
  const apiUrl = getOnlineRankingApiUrl();
  if (!apiUrl || !id) return false;

  const payload = {
    action: 'delete',
    id: id,
    internal_user_id: internalUserId
  };

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      mode: 'cors'
    });
    const data = await res.json();
    return data && data.status === 'ok';
  } catch (err) {
    try {
      const sep = apiUrl.includes('?') ? '&' : '?';
      const url = `${apiUrl}${sep}action=delete&id=${encodeURIComponent(id)}&internal_user_id=${encodeURIComponent(internalUserId || '')}`;
      const res = await fetch(url, { method: 'GET', mode: 'cors' });
      const data = await res.json();
      return data && data.status === 'ok';
    } catch (e) {
      return false;
    }
  }
}

