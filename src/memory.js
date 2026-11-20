import { jsonStore } from './json-store.js';
const store = jsonStore('memories.json');
let records = {};
export async function loadMemories() {
  records = await store.load();
}
function id(guild, user) {
  return guild + ':' + user;
}
export function memoryStatus(guild, user) {
  const r = records[id(guild, user)];
  return { enabled: r?.enabled === true, items: Array.isArray(r?.items) ? r.items : [] };
}
function persist() {
  return store.save(records);
}
export async function enableMemory(guild, user) {
  const k = id(guild, user);
  records[k] = { enabled: true, items: records[k]?.items || [] };
  await persist();
}
export async function saveMemory(guild, user, note) {
  const k = id(guild, user);
  if (records[k]?.enabled !== true) throw Error('Memory is not enabled');
  const items = records[k].items || [];
  if (items.length >= 15) throw Error('Memory limit reached (15). Delete a memory first.');
  items.push(note);
  await persist();
}
export async function removeMemory(guild, user, index) {
  const k = id(guild, user);
  if (records[k]?.enabled !== true) throw Error('Memory is not enabled');
  if (!Number.isInteger(index) || index < 1 || index > records[k].items.length)
    throw Error('Memory number not found');
  records[k].items.splice(index - 1, 1);
  await persist();
}
export async function disableMemory(guild, user) {
  delete records[id(guild, user)];
  await persist();
}
