import { jsonStore } from './json-store.js';
const store = jsonStore('features.json');
let db = {};
export async function loadFeatures() {
  db = await store.load();
  console.log('Lumira feature controls loaded');
}
const defaults = {
  autoLore: true,
  autoScrapbook: true,
  spontaneous: true,
  roasts: true,
  photoBooth: true,
  characterCards: true,
  collages: true,
};
function state(g) {
  return (db[g] ??= {});
}
export function settings(g) {
  return { ...defaults, ...state(g).settings };
}
export async function setSetting(g, k, v) {
  if (!Object.hasOwn(defaults, k)) throw Error('Unknown setting');
  const guild = state(g);
  (guild.settings ??= {})[k] = v;
  await save();
}
export function scrapbookAllowed(g, u) {
  return !state(g).scrapbookOptOut?.[u];
}
export async function setScrapbookOptOut(g, u, off) {
  const s = state(g);
  s.scrapbookOptOut ||= {};
  if (off) s.scrapbookOptOut[u] = true;
  else delete s.scrapbookOptOut[u];
  await save();
}
export function channelAllowed(g, c) {
  return !(state(g).excludedChannels || []).includes(c);
}
export function excludedChannels(g) {
  return [...(state(g).excludedChannels || [])];
}
export async function setChannelAllowed(g, c, allowed) {
  const s = state(g);
  s.excludedChannels ||= [];
  s.excludedChannels = s.excludedChannels.filter((x) => x !== c);
  if (!allowed) s.excludedChannels.push(c);
  await save();
}
export function memberMuted(g, u) {
  return Boolean(state(g).mutedMembers?.[u]);
}
export async function setMemberMuted(g, u, muted) {
  const s = state(g);
  s.mutedMembers ||= {};
  if (muted) s.mutedMembers[u] = true;
  else delete s.mutedMembers[u];
  await save();
}
export function personality(g) {
  return state(g).personality || 'chaotic';
}
export async function setPersonality(g, value) {
  if (!['chaotic', 'cozy', 'witty'].includes(value)) throw Error('Unknown personality');
  state(g).personality = value;
  await save();
}
export function getEgo(g, u) {
  return state(g).egos?.[u] || null;
}
export async function setEgo(g, u, value) {
  (state(g).egos ??= {})[u] = value;
  await save();
}
export async function clearEgo(g, u) {
  delete state(g).egos?.[u];
  await save();
}
function save() {
  return store.save(db);
}
