import { fetchProfilePost, putProfilePost } from './profile-posts.js';
import { EmbedBuilder } from 'discord.js';
import { roster } from './roster.js';
import { profileChannel, profile, setProfile, withProfileWrite } from './profiles.js';
// Public-facing descriptions based on Lumi's accounts. No allegations or sensitive personal details.
const cards = [
  {
    name: 'Lumi',
    aliases: ['lumi', 'luminescence73'],
    title: 'The Creative Spark',
    about:
      'LumiVibe’s founder. Loves anime, drawing, and Sword x Staff. Chatty, playful, and frequently popping in and out of conversations.',
    tags: '🎨 Art • Anime • SxS',
  },
  {
    name: 'Gracie',
    aliases: ['gracie', 'bgracie'],
    title: 'The Social Stargazer',
    about:
      'Outgoing and welcoming, with a love for astrology and Sword x Staff. A familiar face in the group and a go-to friend for game discussions.',
    tags: '✨ Astrology • SxS • Community',
  },
  {
    name: 'Megu',
    discordId: '237586130038423552',
    aliases: ['megu', 'megumin'],
    title: 'The Competitive Connoisseur',
    about: 'Gracie’s sibling. A generous, competitive gamer who enjoys anime, food, and sharing everyday photos.',
    tags: '🎮 Gaming • Anime • Food',
  },
  {
    name: 'Shug',
    aliases: ['shug'],
    title: 'The Laid-Back Wildcard',
    about:
      'Easygoing, funny, and always ready with an unexpected comment. Loves music, especially older tracks and metal.',
    tags: '🎸 Music • Humor',
  },
  {
    name: 'Mitsuto',
    discordId: '1495189750162657400',
    aliases: ['mitsuto', 'mits'],
    title: 'The Dry-Humor Specialist',
    about:
      'Known for sarcasm, offbeat commentary, and a kind side that shows once you get to know him. Enjoys older music and metal.',
    tags: '🎵 Music • Sarcasm',
  },
  {
    name: 'Tee',
    aliases: ['tee'],
    title: 'The Loyal Teaser',
    about: 'Loyal, friendly, and fond of teasing the group. Enjoys music and testing Sword x Staff builds.',
    tags: '🛡️ SxS Builds • Music',
  },
  {
    name: 'Moonie',
    aliases: ['moonie', 'moony'],
    title: 'Meat Shield Moonie',
    about:
      'A sweet, sociable presence in the group, famous for the Meat Shield Moonie nickname and frequent “I’m bored” moments.',
    tags: '💬 Social • Inside Jokes',
  },
  {
    name: 'Dante',
    discordId: '1272841728952369172',
    aliases: ['dante'],
    title: 'The Playful Instigator',
    about: 'A friend in the wider community, known for playful banter. Dante is a member of Ashen Warriors.',
    tags: '😈 Banter • Community',
  },
  {
    name: 'Kiz',
    discordId: '224399760616980481',
    aliases: ['kiz'],
    title: 'The Competitive Player',
    about:
      'A more reserved, competitive gamer who loves rock climbing, Call of Duty, testing Sword x Staff builds, and strats.',
    tags: '🧗 Rock Climbing • SxS Builds • strats • Call of Duty',
  },
];
const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
export async function publishCuratedCards(guild) {
  const channel = await profileChannel(guild);
  if (!channel) throw Error('#cards not found');
  const directory = Object.values(roster(guild.id).members || {});
  const result = { published: 0, updated: 0, unmatched: [], ambiguous: [], errors: [] };
  for (const item of cards) {
    const aliases = new Set(item.aliases.map(norm));
    const linkedUser = item.discordId ? await guild.client.users.fetch(item.discordId).catch(() => null) : null;
    const matches = directory.filter((m) =>
      [m.username, m.displayName, m.globalName].some((v) => {
        const n = norm(v);
        return (
          aliases.has(n) ||
          item.aliases.some(
            (a) =>
              a.length >= 4 && new RegExp('(?:^|[^a-z0-9])' + a + '(?:$|[^a-z0-9])', 'i').test(String(v || '')),
          )
        );
      }),
    );
    if (!linkedUser && matches.length !== 1) {
      // Owner-provided cards can be published without linking a Discord account.
      // Keep a stable synthetic key to avoid duplicate messages on restart.
      const key = 'curated:' + norm(item.name);
      const saved = profile(guild.id, key);
      if (saved?.migratedTo) {
        result.unmatched.push(item.name);
        continue;
      }
      const embed = new EmbedBuilder()
        .setColor(0x9ebdff)
        .setTitle('✦ ' + item.name + ' | ' + item.title)
        .setDescription(item.about)
        .addFields({ name: 'Known for', value: item.tags })
        .setFooter({ text: 'LumiVibe community card • Discord account not linked' });
      try {
        const original = await fetchProfilePost(channel, saved?.messageId);
        const post = await putProfilePost(channel, original, embed);
        result[original ? 'updated' : 'published']++;
        await setProfile(guild.id, key, {
          about: item.about,
          messageId: post.id,
          curated: true,
          updatedAt: Date.now(),
        });
      } catch (e) {
        result.errors.push(item.name + ': ' + e.message);
      }
      result[matches.length ? 'ambiguous' : 'unmatched'].push(item.name);
      continue;
    }
    const entry = linkedUser ? { id: item.discordId } : matches[0];
    await withProfileWrite(guild.id, entry.id, async () => {
      const existing = profile(guild.id, entry.id);
      // Respect members' own edited profiles. Never overwrite a member-created card.
      if (existing?.optedOut || existing?.automatic === false) return;
      const user = linkedUser || (await guild.client.users.fetch(entry.id).catch(() => null));
      if (!user) {
        result.errors.push(item.name + ': user unavailable');
        return;
      }
      const embed = new EmbedBuilder()
        .setColor(0x9ebdff)
        .setTitle('✦ ' + item.name + ' | ' + item.title)
        .setThumbnail(user.displayAvatarURL({ size: 256 }))
        .setDescription(item.about)
        .addFields({ name: 'Known for', value: item.tags })
        .setFooter({
          text: 'LumiVibe community card • Based on shared group stories • /lumira-profile to customize or delete',
        });
      try {
        const unlinked = profile(guild.id, 'curated:' + norm(item.name));
        const original =
          (await fetchProfilePost(channel, existing?.messageId)) ||
          (await fetchProfilePost(channel, unlinked?.messageId));
        const message = await putProfilePost(channel, original, embed);
        result[original ? 'updated' : 'published']++;
        await setProfile(guild.id, entry.id, {
          about: item.about,
          messageId: message.id,
          curated: true,
          updatedAt: Date.now(),
        });
        if (unlinked?.messageId) {
          if (unlinked.messageId !== message.id) {
            const duplicate = await fetchProfilePost(channel, unlinked.messageId);
            if (duplicate?.author?.id === guild.client.user.id) await duplicate.delete();
          }
          await setProfile(guild.id, 'curated:' + norm(item.name), {
            migratedTo: entry.id,
            updatedAt: Date.now(),
          });
        }
      } catch (e) {
        result.errors.push(item.name + ': ' + e.message);
      }
    });
  }
  console.log('LumiVibe curated cards:', JSON.stringify(result));
  return result;
}
