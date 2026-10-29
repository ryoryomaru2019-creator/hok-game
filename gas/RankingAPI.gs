/**
 * ============================================================================
 * HoK！ ~華麗にヒラメいた！~ オンライン世界ランキング API (Google Apps Script)
 * ============================================================================
 * 
 * 【セットアップ手順】
 * 1. Google ドライブで新規「Google スプレッドシート」を作成します。
 *    （名前例: HoK_World_Rankings）
 * 2. メニュー「拡張機能」 > 「Apps Script」を開きます。
 * 3. 既存のコードを全て消去し、このスクリプトの内容をすべて貼り付けて保存（Ctrl+S）します。
 * 4. 画面右上の「デプロイ」 > 「新しいデプロイ」をクリックします。
 * 5. 歯車アイコン「種類の選択」で「ウェブアプリ」を選択します。
 *    - 説明: HoK Ranking API
 *    - 次のユーザーとして実行: 自分 (アクセス権限を持つユーザー)
 *    - アクセスできるユーザー: 全員 (Anyone)  ← ★必ず「全員」に設定してください
 * 6. 「デプロイ」をクリックし、初回のみ「アクセスを承認」を完了します。
 * 7. 発行された「ウェブアプリの URL」をコピーし、管理コンソールまたはゲーム設定に設定します。
 */

const SHEET_NAME = 'Rankings';

// 初期化（シートがなければ自動作成してヘッダーを設定）
function getOrCreateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    const headers = [
      'ID', 'InternalUserID', 'PlayerName', 'PlayerTag',
      'Score', 'Mode', 'MaxCombo', 'Title',
      'PlayedAt', 'CreatedAt', 'Deleted'
    ];
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#0f172a').setFontColor('#38bdf8');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// レスポンス返却用ヘルパー
function makeJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// GETリクエスト処理（ランキング取得 / 接続テスト / フォールバック送信）
function doGet(e) {
  try {
    const params = e ? e.parameter : {};
    const action = params.action || 'get';

    // 1. 接続確認 ping
    if (action === 'ping') {
      return makeJsonResponse({ status: 'ok', message: 'HoK Ranking API is online!', timestamp: Date.now() });
    }

    // 2. GET経由でのスコア登録（CORSフォールバック用）
    if (action === 'submit') {
      const payload = params.data ? JSON.parse(decodeURIComponent(params.data)) : params;
      return handleScoreSubmission(payload);
    }

    // 3. GET経由での特定ID削除
    if (action === 'delete') {
      return handleScoreDeletion(params.id, params.internal_user_id);
    }

    // 4. ランキング取得 (action === 'get')
    const mode = params.mode || 'all';      // 'all' | 'karei' | 'hirame' | 'hirai'
    const period = params.period || 'yearly';// 'yearly' | 'monthly' | 'weekly' | 'daily'
    const limit = Math.min(100, Math.max(10, parseInt(params.limit, 10) || 50));

    const rankings = queryRankings(mode, period, limit);
    return makeJsonResponse({
      status: 'ok',
      mode: mode,
      period: period,
      count: rankings.length,
      rankings: rankings,
      timestamp: Date.now()
    });
  } catch (err) {
    return makeJsonResponse({ status: 'error', message: err.toString() });
  }
}

// POSTリクエスト処理（スコア送信・マイグレーション・削除）
function doPost(e) {
  try {
    let body = {};
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
    const action = body.action || 'submit';

    if (action === 'delete') {
      return handleScoreDeletion(body.id, body.internal_user_id);
    }

    return handleScoreSubmission(body);
  } catch (err) {
    return makeJsonResponse({ status: 'error', message: err.toString() });
  }
}

// スコア登録処理（単一レコードまたはマイグレーション用配列対応）
function handleScoreSubmission(payload) {
  const sheet = getOrCreateSheet();
  const entries = Array.isArray(payload.entries) ? payload.entries : (payload.score !== undefined ? [payload] : []);
  const now = new Date();
  const nowIso = now.toISOString();

  let addedCount = 0;
  for (let i = 0; i < entries.length; i++) {
    const it = entries[i];
    if (!it || typeof it.score !== 'number' || it.score < 0) continue;

    // 不正スコアの簡易ガード（999,999点超え等は除外）
    if (it.score > 999999) continue;

    const id = it.id || ('lb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6));
    const internalUserId = String(it.internal_user_id || '').slice(0, 60);
    const playerName = String(it.name || it.player_name || '名無し').slice(0, 16);
    const playerTag = String(it.tag || '').slice(0, 10);
    const score = Number(it.score);
    const mode = String(it.mode || 'karei').toLowerCase();
    const maxCombo = Number(it.maxCombo || 0);
    const title = String(it.title || '見習い').slice(0, 30);
    const playedAt = String(it.played_at || nowIso);

    sheet.appendRow([
      id, internalUserId, playerName, playerTag,
      score, mode, maxCombo, title,
      playedAt, nowIso, false // Deleted: false
    ]);
    addedCount++;
  }

  return makeJsonResponse({
    status: 'ok',
    addedCount: addedCount,
    timestamp: Date.now()
  });
}

// スコア削除処理（本人確認: IDとinternal_user_idが一致するもののみ論理削除）
function handleScoreDeletion(id, internalUserId) {
  if (!id) return makeJsonResponse({ status: 'error', message: 'Missing record id' });
  const sheet = getOrCreateSheet();
  const data = sheet.getDataRange().getValues();

  let deleted = false;
  for (let i = 1; i < data.length; i++) {
    const rowId = String(data[i][0]);
    const rowUser = String(data[i][1]);
    if (rowId === id) {
      // ユーザーIDが指定されている場合は検証
      if (!internalUserId || rowUser === internalUserId) {
        sheet.getRange(i + 1, 11).setValue(true); // Deleted = true
        deleted = true;
      }
    }
  }

  return makeJsonResponse({ status: deleted ? 'ok' : 'not_found', deleted: deleted });
}

// ランキング抽出＆集計（1プレイヤー最大保持件数制御 ＆ ソート）
function queryRankings(mode, period, limit) {
  const sheet = getOrCreateSheet();
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];

  const now = Date.now();
  const MS_DAY = 24 * 60 * 60 * 1000;
  let periodMs = 365 * MS_DAY;
  if (period === 'daily') periodMs = 1 * MS_DAY;
  else if (period === 'weekly') periodMs = 7 * MS_DAY;
  else if (period === 'monthly') periodMs = 30 * MS_DAY;

  const validEntries = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const isDeleted = !!r[10];
    if (isDeleted) continue;

    const rowMode = String(r[5] || '').toLowerCase();
    if (mode !== 'all' && rowMode !== mode) continue;

    const playedAtStr = r[8] || r[9];
    const playedTime = new Date(playedAtStr).getTime();
    if (isNaN(playedTime) || (now - playedTime > periodMs)) continue;

    validEntries.push({
      id: String(r[0]),
      internal_user_id: String(r[1]),
      name: String(r[2]),
      tag: String(r[3]),
      score: Number(r[4]) || 0,
      mode: rowMode,
      maxCombo: Number(r[6]) || 0,
      title: String(r[7]),
      played_at: String(playedAtStr),
      date: formatDateRelative(playedTime, now)
    });
  }

  // 同一プレイヤー（internal_user_id）ごとにハイスコア順にグループ化し、ベストスコアを優先
  const playerMap = {};
  for (let i = 0; i < validEntries.length; i++) {
    const e = validEntries[i];
    const key = e.internal_user_id || e.name;
    if (!playerMap[key]) playerMap[key] = [];
    playerMap[key].push(e);
  }

  const result = [];
  Object.keys(playerMap).forEach(key => {
    const list = playerMap[key];
    list.sort((a, b) => b.score - a.score || b.maxCombo - a.maxCombo);
    // 1人あたり最大3件までランキングに掲載
    result.push(...list.slice(0, 3));
  });

  result.sort((a, b) => b.score - a.score || b.maxCombo - a.maxCombo);
  return result.slice(0, limit);
}

function formatDateRelative(playedTime, now) {
  const diffHours = (now - playedTime) / (1000 * 60 * 60);
  if (diffHours < 1) return 'たった今';
  if (diffHours < 24) return Math.floor(diffHours) + '時間前';
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return '昨日';
  if (diffDays <= 7) return diffDays + '日前';
  return new Date(playedTime).toLocaleDateString('ja-JP');
}
