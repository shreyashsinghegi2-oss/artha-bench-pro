/**
 * Web-search setting shared by every AI chat. "Auto" searches when a question needs current facts
 * (prices, rates, news, new rules); "On" always searches; "Off" answers from the model and app data only.
 * The setting is sent with each AI request (see aiFetchResilience) and applied on the server.
 * Kept free of UI and finance imports so the request guard can load at startup cheaply.
 */
export type WebSearchMode = 'auto' | 'on' | 'off';
const KEY = 'artha.ai.webSearch';
export const WEB_SEARCH_EVENT = 'artha:web-search-mode';

export function getWebSearchMode(): WebSearchMode {
  try { const v = localStorage.getItem(KEY); return v === 'on' || v === 'off' ? v : 'auto'; } catch { return 'auto'; }
}
export function setWebSearchMode(mode: WebSearchMode) {
  try { localStorage.setItem(KEY, mode); } catch { /* storage unavailable: keep for this page only */ }
  window.dispatchEvent(new CustomEvent(WEB_SEARCH_EVENT, { detail: mode }));
}
