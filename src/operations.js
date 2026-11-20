import { EmbedBuilder, Events, PermissionFlagsBits, ChannelType } from 'discord.js';
import { refreshLiveboard } from './admin.js';

import { LUMIVIBE_GUILD_ID as TARGET } from './channels.js';
const last = new Map();
let pending = [],
  flushing = false,
  refreshing = false;
function control(guild, name) {
  const cat = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && c.name.includes('LUMIRA CONTROL'),
  );
  return guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildText && c.parentId === cat?.id && c.name === name,
  );
}
function clean(value) {
  return String(value ?? 'unknown')
    .replace(/@/g, '＠')
    .replace(/\n/g, ' ')
    .slice(0, 180);
}
async function flush(guild) {
  if (flushing) return;
  flushing = true;
  try {
    const ch = control(guild, 'bot-logs');
    if (!ch) return;
    const bot = await guild.members.fetchMe();
    if (
      !bot
        .permissionsIn(ch)
        .has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])
    )
      return;
    while (pending.length) {
      const batch = pending.slice(0, 8);
      const embed = new EmbedBuilder()
        .setColor(0x819edc)
        .setTitle('✦ LumiVibe activity')
        .setDescription(batch.map((e) => '• **' + clean(e.type) + '**  ' + clean(e.detail)).join('\n'))
        .setTimestamp()
        .setFooter({ text: 'Lumira • Server activity' });
      await ch.send({ embeds: [embed], allowedMentions: { parse: [] } });
      pending = pending.filter((entry) => !batch.includes(entry));
    }
  } catch (e) {
    console.error('Lumira log delivery failed:', e.message);
  } finally {
    flushing = false;
  }
}
function record(guild, type, detail) {
  if (guild?.id !== TARGET) return;
  const key = type + ':' + detail;
  const now = Date.now();
  if (now - (last.get(key) || 0) < 15000) return;
  last.set(key, now);
  if (last.size > 500) {
    for (const [k, v] of last) if (now - v > 60000) last.delete(k);
  }
  pending.push({ type, detail });
  if (pending.length > 100) pending = pending.slice(-100);
  void flush(guild);
}
export function installOperations(client, scheduleInterval) {
  const guildOf = (x) => (x?.guild?.id === TARGET ? x.guild : null);
  client.on(Events.ChannelCreate, (ch) => record(guildOf(ch), 'Channel created', ch.name));
  client.on(Events.ChannelDelete, (ch) => record(guildOf(ch), 'Channel removed', ch.name));
  client.on(Events.ChannelUpdate, (before, after) => {
    const changes = [];
    if (before.name !== after.name) changes.push('renamed ' + before.name + ' → ' + after.name);
    if (before.parentId !== after.parentId) changes.push('moved ' + after.name);
    if (before.permissionOverwrites?.cache?.size !== after.permissionOverwrites?.cache?.size)
      changes.push('permission overwrites changed on ' + after.name);
    if (changes.length) record(guildOf(after), 'Channel update', changes.join('; '));
  });
  client.on(Events.GuildEmojiCreate, (e) => record(e.guild, 'Emoji added', e.name));
  client.on(Events.GuildEmojiDelete, (e) => record(e.guild, 'Emoji removed', e.name));
  client.on(Events.GuildEmojiUpdate, (a, b) => {
    if (a.name !== b.name) record(b.guild, 'Emoji renamed', a.name + ' → ' + b.name);
  });
  client.on(Events.GuildStickerCreate, (s) => record(s.guild, 'Sticker added', s.name));
  client.on(Events.GuildStickerDelete, (s) => record(s.guild, 'Sticker removed', s.name));
  client.on(Events.GuildStickerUpdate, (a, b) => {
    if (a.name !== b.name) record(b.guild, 'Sticker renamed', a.name + ' → ' + b.name);
  });
  client.on(Events.GuildRoleCreate, (r) => record(r.guild, 'Role created', r.name));
  client.on(Events.GuildRoleDelete, (r) => record(r.guild, 'Role deleted', r.name));
  client.on(Events.GuildRoleUpdate, (a, b) => {
    if (a.permissions.bitfield !== b.permissions.bitfield) record(b.guild, 'Role permissions changed', b.name);
  });
  client.on(Events.GuildMemberAdd, (m) => record(m.guild, 'Member joined', m.user.username));
  client.on(Events.GuildMemberRemove, (m) => record(m.guild, 'Member left', m.user.username));
  client.on(Events.Error, (e) => console.error('Lumira gateway error:', e.message));
  client.once(Events.ClientReady, () => {
    const tick = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const guild = client.guilds.cache.get(TARGET);
        if (guild) await refreshLiveboard(guild);
      } catch (e) {
        console.error('Lumira liveboard refresh failed:', e.message);
      } finally {
        refreshing = false;
      }
    };
    scheduleInterval(tick, 10 * 60 * 1000);
    const guild = client.guilds.cache.get(TARGET);
    if (guild)
      record(guild, 'Monitoring active', 'Channel, role, emoji, sticker and member activity logging enabled');
  });
}
