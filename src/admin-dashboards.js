import { GatewayIntentBits } from 'discord.js';
import { ChannelType, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { save, state } from './admin-state.js';
import { norm } from './admin-layout.js';
export async function publishEmojiDirectoryOnce(guild) {
  const s = state(guild.id);
  if (s.emojiDirectoryVersion === 1) return { alreadyDone: true };
  const control = guild.channels.cache.find(
    (x) => x.type === ChannelType.GuildCategory && norm(x.name) === norm('✦ LUMIRA CONTROL'),
  );
  const channel = guild.channels.cache.find(
    (x) => x.type === ChannelType.GuildText && x.parentId === control?.id && norm(x.name) === 'liveboard',
  );
  if (!channel) throw Error('Liveboard not available for emoji directory');
  const emojis = [...(await guild.emojis.fetch()).values()].sort((a, b) => a.name.localeCompare(b.name));
  const groups = [
    ['Static', emojis.filter((x) => !x.animated)],
    ['Animated', emojis.filter((x) => x.animated)],
  ];
  const lines = [
    '🧩 **LumiVibe Emoji Directory**',
    'Organized by type and alphabetically. This does not rename emojis or change their IDs.',
  ];
  for (const [label, items] of groups) {
    lines.push('**' + label + ' (' + items.length + ')**');
    if (!items.length) {
      lines.push('None');
      continue;
    }
    for (const e of items) lines.push(e.toString() + ' `:' + e.name + ':`');
  }
  let page = '';
  let posted = 0;
  for (const line of lines) {
    if (page.length + line.length + 2 > 1750) {
      await channel.send({ content: page });
      posted++;
      page = '';
    }
    page += (page ? '\n' : '') + line;
  }
  if (page) {
    await channel.send({ content: page });
    posted++;
  }
  s.emojiDirectoryVersion = 1;
  await save();
  return { count: emojis.length, messages: posted };
}

export async function repairControlFormattingOnce(guild) {
  const s = state(guild.id);
  if (s.controlFormattingVersion === 1) return { alreadyDone: true };
  const control = guild.channels.cache.find(
    (x) => x.type === ChannelType.GuildCategory && norm(x.name) === norm('✦ LUMIRA CONTROL'),
  );
  if (!control) throw Error('Lumira Control category not found');
  const report = [];
  for (const name of ['liveboard', 'bot-logs']) {
    const channel = guild.channels.cache.find(
      (x) => x.type === ChannelType.GuildText && x.parentId === control.id && norm(x.name) === name,
    );
    if (!channel) throw Error(name + ' channel not found');
    const messages = await channel.messages.fetch({ limit: 100 });
    let repaired = 0;
    for (const message of messages.values()) {
      if (message.author.id !== guild.client.user.id || !message.content.includes(String.raw`\n`)) continue;
      await message.edit(message.content.split(String.raw`\n`).join('\n'));
      repaired++;
    }
    report.push(name + ': repaired ' + repaired + ' existing messages');
  }
  s.controlFormattingVersion = 1;
  await save();
  return { alreadyDone: false, report };
}

export async function refreshLiveboard(guild) {
  const s = state(guild.id);
  const control = guild.channels.cache.find(
    (x) => x.type === ChannelType.GuildCategory && norm(x.name) === norm('✦ LUMIRA CONTROL'),
  );
  const channel = guild.channels.cache.find(
    (x) => x.type === ChannelType.GuildText && x.parentId === control?.id && norm(x.name) === 'liveboard',
  );
  if (!channel) throw Error('Liveboard channel missing');
  const bot = await guild.members.fetchMe();
  if (!bot.permissionsIn(channel).has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]))
    throw Error('Lumira needs Send Messages and Embed Links in liveboard');
  const emojis = await guild.emojis.fetch();
  const stickers = await guild.stickers.fetch();
  const embed = new EmbedBuilder()
    .setColor(0x82b6fa)
    .setAuthor({ name: 'LUMIVIBE  •  PRIVATE CONTROL CENTER', iconURL: guild.iconURL() || undefined })
    .setTitle('✦  The LumiVibe Liveboard')
    .setDescription(
      'A little corner of the cosmos for everything happening around LumiVibe. ✨\n\n**SERVER SNAPSHOT**',
    )
    .addFields(
      { name: '👥 Members', value: String(guild.memberCount), inline: true },
      { name: '🎨 Emojis', value: String(emojis.size), inline: true },
      { name: '🧸 Stickers', value: String(stickers.size), inline: true },
      {
        name: '✦ QUICK NAVIGATION',
        value:
          '<#' +
          channel.id +
          '>  ·  ' +
          (guild.channels.cache.find((x) => norm(x.name) === 'bot-logs')?.toString() || 'Bot Logs'),
      },
      {
        name: '🦋 LUMIRA FEATURES',
        value: 'AI chat  •  Games & trivia  •  Scrapbook\nPersonal memories (opt-in)  •  Event reminders',
      },
      {
        name: '📌 STATUS',
        value:
          'Auto-refreshes approximately every 10 minutes while Lumira is online. Activity logs are in #bot-logs.',
      },
    )
    .setFooter({ text: 'Lumira • LumiVibe  |  Private staff view' })
    .setTimestamp(new Date());
  let msg = null;
  if (s.liveboardMessageId) {
    try {
      msg = await channel.messages.fetch(s.liveboardMessageId);
    } catch {}
  }
  if (!msg) {
    const recent = await channel.messages.fetch({ limit: 50 });
    msg =
      recent.find(
        (m) =>
          m.author.id === guild.client.user.id && m.embeds.some((e) => e.title === '✦  The LumiVibe Liveboard'),
      ) || null;
  }
  const updated = Boolean(msg);
  if (msg) await msg.edit({ content: '', embeds: [embed] });
  else {
    msg = await channel.send({ embeds: [embed] });
  }
  s.liveboardMessageId = msg.id;
  await save();
  return { messageId: msg.id, updated };
}

export async function authorizeGracieStickerImportOnce(guild) {
  const s = state(guild.id);
  if (s.gracieStickerAuthorizationVersion === 1) return { alreadyDone: true };
  // Match the member's Discord identity, not arbitrary references in channel names.
  const members =
    (guild.client?.options?.intents?.has(GatewayIntentBits.GuildMembers) ?? (process.env.LUMIRA_MEMBERS_INTENT === 'true'))
      ? await guild.members.fetch({ limit: 0 }).catch(() => guild.members.cache)
      : guild.members.cache;
  const matches = [...members.values()].filter(
    (m) =>
      !m.user.bot &&
      [m.user.username, m.user.globalName, m.displayName].some((n) =>
        /^(?:gracie|bgracie)(?:[ _.-].*)?$/i.test(n || ''),
      ),
  );
  if (matches.length !== 1) {
    console.warn('Gracie sticker access not assigned: matching members:', matches.length);
    return { assigned: false, matches: matches.length };
  }
  const id = matches[0].id;
  s.stickerManagers = [...new Set([...(s.stickerManagers || []), id])];
  s.gracieStickerAuthorizationVersion = 1;
  await save();
  console.log('Gracie sticker access verified:', s.stickerManagers.includes(id));
  return { assigned: true, memberId: id };
}
export async function refreshStickerDirectory(guild) {
  const s = state(guild.id);
  const cat = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && norm(c.name) === norm('✦ LUMIRA CONTROL'),
  );
  const channel = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildText && c.parentId === cat?.id && norm(c.name) === 'liveboard',
  );
  if (!channel) throw Error('Liveboard missing');
  const stickers = [...(await guild.stickers.fetch()).values()].sort((a, b) => a.name.localeCompare(b.name));
  const chunks = [];
  let current = '🧸 **LumiVibe Sticker Collection**\nAlphabetized inventory. Existing stickers are preserved.\n';
  for (const st of stickers) {
    const line = '• ' + st.name + '  (ID: ' + st.id + ')\n';
    if (current.length + line.length > 1700) {
      chunks.push(current);
      current = '**Stickers, continued**\n';
    }
    current += line;
  }
  chunks.push(current + (stickers.length ? '' : 'No stickers uploaded yet.'));
  // Only post once per count, avoiding duplicate inventory spam.
  const key = stickers.map((s) => s.id + ':' + s.name).join('|');
  if (s.stickerDirectoryKey === key) return { unchanged: true, count: stickers.length };
  for (const part of chunks) await channel.send({ content: part, allowedMentions: { parse: [] } });
  s.stickerDirectoryKey = key;
  await save();
  return { count: stickers.length, messages: chunks.length };
}
