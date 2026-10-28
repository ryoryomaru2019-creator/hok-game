// ============================================================================
// Google Analytics (GA4) 連携ヘルパーモジュール
// ============================================================================

/**
 * GA4 カスタムイベント送信
 * @param {string} eventName イベント名（例: 'game_start', 'game_over', 'admin_update_config'）
 * @param {object} params パラメーターオブジェクト
 */
export function trackEvent(eventName, params = {}) {
  try {
    if (typeof window.gtag === 'function') {
      window.gtag('event', eventName, {
        ...params,
        timestamp: Date.now()
      });
    }
  } catch (err) {
    console.debug('[GA4] Event dispatch skipped:', eventName, err);
  }
}

/**
 * ページビュー送信
 * @param {string} pageTitle ページタイトル
 * @param {string} pagePath ページパス
 */
export function trackPageView(pageTitle, pagePath) {
  try {
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', {
        page_title: pageTitle,
        page_location: window.location.href,
        page_path: pagePath || window.location.pathname
      });
    }
  } catch (err) {
    console.debug('[GA4] Pageview dispatch skipped:', err);
  }
}
