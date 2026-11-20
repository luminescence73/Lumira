// Shared in-process Gemini quota circuit breaker. Never log API keys.
const until=new Map();
export function quotaReady(model){return Date.now()>=(until.get(model)||0)}
export function quotaDelay(model,ms=60*60*1000){until.set(model,Math.max(until.get(model)||0,Date.now()+ms));console.warn('Gemini quota cooldown active for',model,'minutes',Math.ceil(ms/60000))}
export function quotaWaitMs(model){return Math.max(0,(until.get(model)||0)-Date.now())}
export function isQuotaFailure(status,message=''){return status===429||(/quota|rate.limit|resource.exhausted/i.test(message)&&status===403)}
