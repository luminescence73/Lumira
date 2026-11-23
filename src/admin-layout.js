import { ChannelType, PermissionFlagsBits } from 'discord.js';
export function layoutPreview(guild) {
  return guild.channels.cache
    .filter((c) => !c.isThread?.())
    .sort((a, b) => a.rawPosition - b.rawPosition)
    .map((c) => ({ id: c.id, name: c.name, type: c.type, category: c.parent?.name || null }))
    .slice(0, 70);
}
export async function makeChannel(guild, name, kind, parent) {
  if (!/^[a-z0-9-]{2,70}$/.test(name)) throw Error('Use 2–70 lowercase letters, digits or hyphens');
  const type =
    kind === 'category'
      ? ChannelType.GuildCategory
      : kind === 'voice'
        ? ChannelType.GuildVoice
        : ChannelType.GuildText;
  return guild.channels.create({
    name,
    type,
    parent: kind === 'category' ? null : parent || null,
    reason: 'Lumira owner-requested channel',
  });
}
export const plannedLayout = [
  { category: '✦ ARRIVALS', channels: ['welcome', 'goodbye'] },
  { category: '✦ COMMONS', channels: ['general', 'talk', 'media', 'music', "i'm-pissed-off"] },
  {
    category: '✦ INTERESTS',
    channels: ['anime-manga', "shug's-kitchen", "lumi's-art", "gracie's-horoscopes", 'cards'],
  },
  { category: '✦ GAMING', channels: ['game-updates'] },
  { category: '✦ ARCHIVES', channels: ['scrapbook', 'milestones'] },
  { category: '✦ VOICE LOUNGE', channels: [] },
  { category: '✦ PRIVATE GALLERIES', channels: [], private: true },
  { category: '✦ LUMIRA CONTROL', channels: ['liveboard', 'bot-logs'], private: true },
];
export const norm = (s) =>
  s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const aliases = {
  'gracie-s-horoscopes': ['astrology', 'horoscopes', 'gracie-astrology'],
  'i-m-pissed-off': ['im-pissed-off', 'pissed-off'],
  'shug-s-kitchen': ['shugs-kitchen'],
  'lumi-s-art': ['lumis-art'],
};
export function layoutPlan(guild) {
  const lines = [];
  for (const section of plannedLayout) {
    const category = guild.channels.cache.find(
      (x) => x.type === ChannelType.GuildCategory && norm(x.name) === norm(section.category),
    );
    lines.push(section.category + (category ? ' [existing]' : ' [new]'));
    for (const name of section.channels) {
      const keys = [norm(name), ...(aliases[norm(name)] || [])];
      const existing = guild.channels.cache.find(
        (x) => x.type === ChannelType.GuildText && keys.includes(norm(x.name)),
      );
      lines.push('  #' + name + (existing ? ' [move/rename ' + existing.name + ']' : ' [new]'));
    }
  }
  return lines;
}
export async function applyLayout(guild) {
  const bot = await guild.members.fetchMe();
  if (!bot.permissions.has(PermissionFlagsBits.ManageChannels)) throw Error('Lumira needs Manage Channels');
  const report = [];
  for (let i = 0; i < plannedLayout.length; i++) {
    const section = plannedLayout[i];
    let cat = guild.channels.cache.find(
      (x) => x.type === ChannelType.GuildCategory && norm(x.name) === norm(section.category),
    );
    if (!cat) {
      cat = await guild.channels.create({
        name: section.category,
        type: ChannelType.GuildCategory,
        permissionOverwrites: section.private
          ? [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }]
          : [],
        reason: 'Owner-approved LumiVibe layout',
      });
      report.push('Created category ' + section.category);
    }
    await cat.setPosition(i, { reason: 'Owner-approved category order' });
    if (section.private) {
      if (!cat.permissionOverwrites.cache.has(guild.roles.everyone.id)) {
        await cat.permissionOverwrites.edit(
          guild.roles.everyone.id,
          { ViewChannel: false },
          { reason: 'Keep new private category hidden' },
        );
      }
      continue;
    }
    for (let j = 0; j < section.channels.length; j++) {
      const name = section.channels[j],
        keys = [norm(name), ...(aliases[norm(name)] || [])];
      let ch = guild.channels.cache.find((x) => x.type === ChannelType.GuildText && keys.includes(norm(x.name)));
      if (!ch) {
        ch = await guild.channels.create({
          name,
          type: ChannelType.GuildText,
          parent: cat.id,
          reason: 'Owner-approved LumiVibe layout',
        });
        report.push('Created #' + name);
      } else {
        if (ch.parentId !== cat.id) {
          await ch.setParent(cat.id, {
            lockPermissions: false,
            reason: 'Owner-approved layout; preserve channel permissions',
          });
          report.push('Moved #' + ch.name);
        }
        if (norm(ch.name) !== norm(name)) await ch.setName(name, 'Owner-approved LumiVibe naming');
      }
      await ch.setPosition(j, { reason: 'Owner-approved channel order' });
    }
  }
  return report;
}
