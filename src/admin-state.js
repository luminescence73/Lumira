import { jsonStore } from './json-store.js';
const store = jsonStore('admin.json');
let db = {};
export async function loadAdmin() {
  db = await store.load();
  console.log('Lumira admin configuration ready');
}
export function state(guildId) {
  const guild = (db[guildId] ??= {});
  guild.stickerManagers ??= [];
  guild.inviteManagers ??= [];
  guild.emojiManagers ??= [];
  guild.privateChannels ??= {};
  return guild;
}
export function save() {
  return store.save(db);
}
export function config(g) {
  return state(g);
}
export async function authorize(g, kind, user, enabled) {
  const key = { sticker: 'stickerManagers', emoji: 'emojiManagers', invite: 'inviteManagers' }[kind];
  if (!key) throw Error('Invalid access type');
  const s = state(g);
  s[key] = s[key].filter((x) => x !== user);
  if (enabled) s[key].push(user);
  await save();
}
export async function privateAccess(guildId, channelId, userId, enabled) {
  const guild = state(guildId);
  const allowed = new Set(guild.privateChannels[channelId] || []);
  guild.privateRevocations ??= {};
  const revoked = new Set(guild.privateRevocations[channelId] || []);
  if (enabled) {
    allowed.add(userId);
    revoked.delete(userId);
  } else {
    allowed.delete(userId);
    revoked.add(userId);
  }
  guild.privateChannels[channelId] = [...allowed];
  guild.privateRevocations[channelId] = [...revoked];
  await save();
}
export function proposals(g) {
  return state(g).pending;
}
export async function stage(g, proposal) {
  state(g).pending = { ...proposal, createdAt: Date.now() };
  await save();
}
export async function discard(g) {
  state(g).pending = null;
  await save();
}
