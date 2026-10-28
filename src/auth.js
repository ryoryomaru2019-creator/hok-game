// ============================================================================
// HoK! 管理コンソール 暗号化認証 & ログインアクセスログ管理モジュール
// ============================================================================

const USER_SALT = 'hok_user_salt_';
const USER_HASH = 'ddc34ce20d39f45ffa8bb27c6a47694ff4f6f68c1e47e48784e54558d401c6c8';

const PASS_SALT = 'hok_secure_salt_892348_';
const PASS_HASH = '894db9677c54a2b39ec00365f32dababf0977153c5b662c5ab1c1c9018074b58';

const STORAGE_KEY_AUTH_SESSION = 'hirame_admin_auth_session';
const STORAGE_KEY_AUTH_PERSIST = 'hirame_admin_auth_persist';
const STORAGE_KEY_LOGIN_LOGS   = 'hirame_admin_login_logs';

/**
 * Web Crypto API を用いたセキュアな SHA-256 ハッシュ計算
 * 平文パスワードはコードやGitHub上に一切記録されず、不可逆暗号化ハッシュのみで照合
 */
export async function sha256Hex(str) {
  const enc = new TextEncoder();
  const data = enc.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 資格情報の検証
 */
export async function verifyCredentials(username, password) {
  if (!username || !password) return false;
  const uHash = await sha256Hex(USER_SALT + username.trim());
  const pHash = await sha256Hex(PASS_SALT + password);
  return (uHash === USER_HASH && pHash === PASS_HASH);
}

/**
 * ログイン中かどうかの判定
 */
export function isAuthenticated() {
  return sessionStorage.getItem(STORAGE_KEY_AUTH_SESSION) === 'true' ||
         localStorage.getItem(STORAGE_KEY_AUTH_PERSIST) === 'true';
}

/**
 * ログイン成功処理
 */
export function setAuthenticated(rememberMe = false) {
  sessionStorage.setItem(STORAGE_KEY_AUTH_SESSION, 'true');
  if (rememberMe) {
    localStorage.setItem(STORAGE_KEY_AUTH_PERSIST, 'true');
  } else {
    localStorage.removeItem(STORAGE_KEY_AUTH_PERSIST);
  }
}

/**
 * ログアウト処理
 */
export function logout() {
  sessionStorage.removeItem(STORAGE_KEY_AUTH_SESSION);
  localStorage.removeItem(STORAGE_KEY_AUTH_PERSIST);
}

/**
 * ログイン試行履歴（成功・失敗・日時・ユーザー名・端末情報）の記録
 */
export function recordLoginLog(success, attemptedUser = 'unknown') {
  try {
    let logs = [];
    const saved = localStorage.getItem(STORAGE_KEY_LOGIN_LOGS);
    if (saved) logs = JSON.parse(saved);

    // 最大100件まで保持
    const now = new Date();
    const entry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: Date.now(),
      dateStr: now.toLocaleString('ja-JP', { timeZoneName: 'short' }),
      success: !!success,
      user: attemptedUser || '(空欄)',
      device: getDeviceSummary()
    };

    logs.unshift(entry);
    if (logs.length > 100) logs = logs.slice(0, 100);
    localStorage.setItem(STORAGE_KEY_LOGIN_LOGS, JSON.stringify(logs));
    return entry;
  } catch (e) {
    console.warn("Failed to record login log", e);
  }
}

/**
 * ログイン履歴の全取得
 */
export function getLoginLogs() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_LOGIN_LOGS);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
}

/**
 * ログイン履歴のクリア
 */
export function clearLoginLogs() {
  try {
    localStorage.removeItem(STORAGE_KEY_LOGIN_LOGS);
  } catch (e) {}
}

function getDeviceSummary() {
  const ua = navigator.userAgent;
  let os = 'Unknown OS';
  if (ua.includes('Win')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Linux')) os = 'Linux';

  let browser = 'Unknown Browser';
  if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome/')) browser = 'Chrome';
  else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari';
  else if (ua.includes('Firefox/')) browser = 'Firefox';

  return `${os} / ${browser}`;
}

