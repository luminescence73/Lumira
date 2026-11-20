// Shared in-process quota and availability protection. No API keys logged.
const until = new Map();
export function quotaReady(model) {
  return Date.now() >= (until.get(model) || 0);
}
export function quotaDelay(model, ms = 90000) {
  until.set(model, Math.max(until.get(model) || 0, Date.now() + ms));
  console.warn('Gemini cooldown', model, 'seconds', Math.ceil(ms / 1000));
}
export function quotaWaitMs(model) {
  return Math.max(0, (until.get(model) || 0) - Date.now());
}
export function isQuotaFailure(status, message = '') {
  return status === 429 || (/quota|rate.limit|resource.exhausted/i.test(message) && status === 403);
}
export function retryDelay(response, message = '') {
  const header = response.headers.get('retry-after');
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(3600000, Math.max(1000, seconds * 1000));
    const date = Date.parse(header);
    if (Number.isFinite(date)) return Math.min(3600000, Math.max(1000, date - Date.now()));
  }
  const match = String(message).match(/retry(?:Delay| after| in)?[^0-9]{0,20}(\d+(?:\.\d+)?)\s*s/i);
  if (match) return Math.min(3600000, Math.max(1000, Number(match[1]) * 1000));
  return /per day|daily|RPD|billing|current quota/i.test(message) ? 3600000 : 90000;
}
