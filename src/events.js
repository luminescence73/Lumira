import { randomBytes } from 'node:crypto';
import { jsonStore } from './json-store.js';

const store = jsonStore('events.json');
const minute = 60_000;
const day = 24 * 60 * minute;
let db = {};

export async function loadEvents() {
  db = await store.load();
}

function eventsFor(guildId) {
  return ((db[guildId] ??= {}).events ??= []);
}

export async function schedule(guildId, channel, title, when) {
  if (!Number.isFinite(when) || when < Date.now() + minute || when > Date.now() + 90 * day) {
    throw Error('Choose a time 1 minute to 90 days in the future');
  }
  const events = eventsFor(guildId);
  if (events.filter((event) => !event.sent).length >= 10) throw Error('Maximum 10 pending events');
  events.push({ id: randomBytes(8).toString('hex'), channel, title: title.slice(0, 80), when, sent: false });
  await store.save(db);
}

export function upcoming(guildId, now = Date.now()) {
  return eventsFor(guildId)
    .filter((event) => !event.sent && event.when > now)
    .sort((a, b) => a.when - b.when)
    .slice(0, 10);
}

export function dueEvents(now = Date.now()) {
  const due = [];
  for (const guildId of Object.keys(db)) {
    for (const event of eventsFor(guildId)) {
      if (!event.sent && event.when <= now) due.push({ guildId, event });
    }
  }
  return due;
}

export async function finishEvent(event) {
  event.sent = true;
  for (const state of Object.values(db)) {
    state.events = (state.events || []).filter((entry) => !entry.sent || entry.when > Date.now() - 7 * day);
  }
  await store.save(db);
}
