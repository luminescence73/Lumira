import { PermissionFlagsBits } from 'discord.js';
import { classifyEmoji, cleanName, EMOJI_CATEGORIES, visionUnavailable } from './emoji-classifier.js';
import { jsonStore } from './json-store.js';

export { EMOJI_CATEGORIES };
const store = jsonStore('emoji-visual.json');
const version = 2;
const reviewBackoff = 6 * 60 * 60_000;
const editSpacing = 5_000;
const running = new Set();

export function classificationAction(emoji, record, now = Date.now()) {
  if (emoji.managed) return 'skip';
  if (record?.version !== version) return 'scan';
  if (record.status === 'verified' && record.name === emoji.name) return 'skip';
  if (record.status === 'pending' && [record.previous, record.name].includes(emoji.name)) return 'resume';
  if (['review', 'error'].includes(record.status) && record.name === emoji.name && now < record.retryAt)
    return 'skip';
  return 'scan';
}

export function uniqueEmojiName(category, subject, used, current) {
  if (!EMOJI_CATEGORIES.includes(category)) throw Error('Invalid emoji category');
  const suffix = cleanName(subject).replace(new RegExp('^' + category + '_'), '');
  if (!suffix) throw Error('Emoji subject missing');
  const base = (category + '_' + suffix).slice(0, 32).replace(/_$/, '');
  const occupied = (name) =>
    used instanceof Map
      ? (used.get(name) || 0) > (name === current.toLowerCase() ? 1 : 0)
      : used.has(name) && name !== current.toLowerCase();
  let name = base;
  for (let n = 2; occupied(name) && n <= 1000; n++) {
    const number = '_' + n;
    name = base.slice(0, 32 - number.length).replace(/_$/, '') + number;
  }
  if (occupied(name)) throw Error('No available emoji name');
  return name;
}

function countNames(emojis) {
  const names = new Map();
  for (const emoji of emojis) {
    const name = emoji.name.toLowerCase();
    names.set(name, (names.get(name) || 0) + 1);
  }
  return names;
}

function describeClassification(name, status, extra = {}) {
  return { version, status, name, at: Date.now(), ...extra };
}

export function createEmojiOrganizer({
  storage = store,
  classify = classifyEmoji,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  hasKey = () => Boolean(process.env.GEMINI_API_KEY),
} = {}) {
  // A shared state file must have a single reader/writer for the duration of a batch.
  return async function organizeVisualEmojis(guild, { maxScans = 8, maxRenames = 4 } = {}) {
    if (running.size) return { running: true };
    if (!hasKey()) return { unavailable: 'Gemini vision is unconfigured' };
    running.add(guild.id);
    try {
      const member = await guild.members.fetchMe();
      if (!member.permissions.has(PermissionFlagsBits.ManageGuildExpressions)) {
        return { unavailable: 'Lumira needs Manage Expressions to rename emojis' };
      }
      const data = await storage.load();
      const records = (data[guild.id] ??= {});
      const emojis = [...(await guild.emojis.fetch()).values()];
      const names = countNames(emojis);
      const report = { scanned: 0, renamed: 0, verified: 0, review: 0, skipped: 0, errors: 0, remaining: 0 };
      // New inventory goes before rechecks so uncertain images cannot starve later items.
      const work = emojis
        .map((emoji) => ({
          emoji,
          record: records[emoji.id],
          action: classificationAction(emoji, records[emoji.id]),
        }))
        .sort((a, b) => (a.record?.at || 0) - (b.record?.at || 0));
      for (const { emoji, record, action } of work) {
        if (action === 'skip') {
          report.skipped++;
          continue;
        }
        if (report.scanned >= maxScans || report.renamed >= maxRenames || report.paused) {
          report.remaining++;
          continue;
        }
        let result = record?.classification;
        let planned;
        try {
          if (action === 'scan') {
            report.scanned++;
            result = await classify(emoji);
          }
          if (
            !result ||
            !EMOJI_CATEGORIES.includes(result.category) ||
            !Number.isFinite(result.confidence) ||
            result.confidence < 0.88 ||
            !result.subject
          ) {
            records[emoji.id] = describeClassification(emoji.name, 'review', {
              classification: result,
              retryAt: Date.now() + reviewBackoff,
            });
            report.review++;
            await storage.save(data);
            continue;
          }
          const original = emoji.name;
          const target = uniqueEmojiName(result.category, result.subject, names, original);
          planned = describeClassification(target, 'pending', {
            classification: result,
            previous: action === 'resume' ? record.previous : original,
          });
          if (original !== target) {
            if (report.renamed) await wait(editSpacing);
            // Save the visual decision before the edit so a restarted worker can resume.
            records[emoji.id] = planned;
            await storage.save(data);
            await emoji.edit({ name: target, reason: 'Owner-approved image-based emoji classification' });
            const oldName = original.toLowerCase();
            names.set(oldName, names.get(oldName) - 1);
            names.set(target, (names.get(target) || 0) + 1);
            report.renamed++;
          } else {
            report.verified++;
          }
          records[emoji.id] = { ...planned, status: 'verified' };
          await storage.save(data);
        } catch (error) {
          if (visionUnavailable(error) || error.status === 429 || [50001, 50013].includes(error.code)) {
            report.paused = true;
            report.remaining++;
            console.warn('Visual emoji batch paused:', error.message);
            continue;
          }
          report.errors++;
          console.warn('Visual emoji scan failed:', emoji.id, error.message);
          // A saved rename plan is reusable after a transient Discord error.
          records[emoji.id] =
            planned ?? describeClassification(emoji.name, 'error', { retryAt: Date.now() + reviewBackoff });
          await storage.save(data);
        }
      }
      return report;
    } finally {
      running.delete(guild.id);
    }
  };
}

export const organizeVisualEmojis = createEmojiOrganizer();

export async function emojiReview(guild) {
  const records = (await store.load())[guild.id] || {};
  const report = { verified: 0, review: [], pending: 0, managed: 0 };
  for (const emoji of (await guild.emojis.fetch()).values()) {
    const record = records[emoji.id];
    if (emoji.managed) report.managed++;
    else if (record?.version === version && record.status === 'verified' && record.name === emoji.name)
      report.verified++;
    else if (record?.version === version && ['review', 'error'].includes(record.status))
      report.review.push(emoji.name);
    else report.pending++;
  }
  return report;
}
