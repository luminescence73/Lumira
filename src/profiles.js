import { fetchProfilePost, putProfilePost, deleteProfilePost } from './profile-posts.js';
import { jsonStore } from './json-store.js';
import { EmbedBuilder } from 'discord.js';
const store = jsonStore('profiles.json');
let db = {};
export async function loadProfiles() {
  db = await store.load();
}
function entries(g) {
  return db[g] || (db[g] = {});
}
function save() {
  return store.save(db);
}
export function profile(g, u) {
  return entries(g)[u] || null;
}
export async function setProfile(g, u, p) {
  entries(g)[u] = p;
  await save();
}
export async function removeProfile(g, u) {
  entries(g)[u] = { optedOut: true };
  await save();
}
export function profileEmbed(user, bio) {
  return new EmbedBuilder()
    .setColor(0x8bbcff)
    .setTitle('✦ ' + (user.globalName || user.username).slice(0, 80) + ' • LumiVibe Profile')
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .setDescription(bio)
    .addFields({ name: 'Member', value: '<@' + user.id + '>' })
    .setFooter({ text: 'LumiVibe member card • Customize or remove with /lumira-profile' })
    .setTimestamp();
}
export async function profileChannel(guild) {
  const channels = await guild.channels.fetch();
  return channels.find((c) => c.name === 'cards' && c.isTextBased() && c.send) || null;
}

const writes = new Map();
export async function withProfileWrite(guildId, userId, write) {
  const key = guildId + ':' + userId;
  const next = (writes.get(key) || Promise.resolve()).catch(() => {}).then(write);
  writes.set(key, next);
  try {
    return await next;
  } finally {
    if (writes.get(key) === next) writes.delete(key);
  }
}

export async function populateMemberProfiles(guild, rosterData) {
  const channel = await profileChannel(guild);
  if (!channel) throw Error('#cards not found');
  const members = Object.values(rosterData.members || {}).slice(0, 150);
  const result = { created: 0, updated: 0, skipped: 0, errors: 0 };
  for (const m of members) {
    await withProfileWrite(guild.id, m.id, async () => {
      const saved = profile(guild.id, m.id);
      const isOracle = [m.username, m.displayName, m.globalName].some(
        (n) =>
          String(n || '')
            .trim()
            .toLowerCase() === 'oracle',
      );
      if (isOracle) {
        if (saved?.messageId && saved.automatic !== false) {
          try {
            await deleteProfilePost(channel, saved.messageId);
            await removeProfile(guild.id, m.id);
          } catch (e) {
            console.warn('Oracle card cleanup:', e.message);
          }
        }
        result.skipped++;
        return;
      }
      // Curated cards are maintained by publishCuratedCards; never replace their embeds with generic ones.
      if (saved?.optedOut || saved?.curated || saved?.automatic === false) {
        result.skipped++;
        return;
      }
      try {
        const user = await guild.client.users.fetch(m.id);
        if (user.bot) {
          result.skipped++;
          return;
        }
        const about = saved?.about || 'Part of the LumiVibe community. ✦';
        const embed = profileEmbed(user, about);
        const original = await fetchProfilePost(channel, saved?.messageId);
        const post = await putProfilePost(channel, original, embed);
        result[original ? 'updated' : 'created']++;
        await setProfile(guild.id, m.id, {
          about,
          messageId: post.id,
          updatedAt: Date.now(),
          automatic: saved?.automatic !== false,
        });
      } catch (e) {
        result.errors++;
        console.warn('Member card', m.id, e.message);
      }
    });
  }
  console.log('LumiVibe member cards:', JSON.stringify(result));
  return result;
}
