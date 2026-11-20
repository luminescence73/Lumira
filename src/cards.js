import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { publicSocialChannel } from './channels.js';
import { excludedChannels, settings } from './features.js';
import { jokes, moments } from './lore.js';
const activity = new Map();
const channelPulse = new Map();
export function pulse(message) {
  if (!message.inGuild() || message.author.bot || message.webhookId || !publicSocialChannel(message.channel))
    return;
  const key = message.guildId;
  const arr = (channelPulse.get(key) || []).filter((x) => Date.now() - x.time < 24 * 3600000);
  arr.push({ time: Date.now(), channel: message.channelId });
  channelPulse.set(key, arr.slice(-1500));
  bump(key, 'messages');
}
function vibe(g) {
  const items = (channelPulse.get(g) || []).filter((x) => Date.now() - x.time < 24 * 3600000);
  const channels = new Set(items.map((x) => x.channel)).size;
  const volume = items.length;
  return {
    volume,
    channels,
    label:
      volume < 5
        ? 'Quiet hours 🌙'
        : volume < 30
          ? 'Cozy chatter ☕'
          : volume < 100
            ? 'The group chat is awake 🦋'
            : 'Full chaos mode ⚡',
  };
}
export function bump(g, key) {
  const v = activity.get(g) || {
    messages: 0,
    mentions: 0,
    comments: 0,
    lore: 0,
    scrapbook: 0,
    started: Date.now(),
  };
  v[key] = (v[key] || 0) + 1;
  activity.set(g, v);
}
export function liveboard(g) {
  const s = settings(g),
    v = activity.get(g) || { messages: 0, mentions: 0, comments: 0, lore: 0, scrapbook: 0, started: Date.now() };
  const names = {
    autoLore: 'Auto Lore',
    autoScrapbook: 'Auto Scrapbook',
    spontaneous: 'Spontaneous Chat',
    roasts: 'Roast Mode',
  };
  const embed = new EmbedBuilder()
    .setColor(0x69b9f6)
    .setTitle('🦋 Lumira Liveboard')
    .setDescription('Private owner dashboard • switches apply immediately')
    .addFields(
      {
        name: 'Feature switches',
        value: Object.entries(names)
          .map(([k, n]) => (s[k] ? '🟢' : '⚫') + ' **' + n + '**')
          .join('\n'),
      },
      { name: 'Excluded channels', value: String(excludedChannels(g).length), inline: true },
      {
        name: 'Saved server lore',
        value: String(jokes(g).length) + ' jokes • ' + String(moments(g).length) + ' scrapbook moments',
        inline: true,
      },
      {
        name: 'Since last restart',
        value:
          v.messages +
          ' public messages • ' +
          v.mentions +
          ' mentions • ' +
          v.comments +
          ' comments • ' +
          v.lore +
          ' auto jokes • ' +
          v.scrapbook +
          ' auto moments',
        inline: false,
      },
    )
    .setFooter({ text: 'Private to server owner • live counters reset on restart' });
  const buttons = Object.entries(names).map(([k, n]) =>
    new ButtonBuilder()
      .setCustomId('lumira:toggle:' + k)
      .setLabel(n)
      .setStyle(s[k] ? ButtonStyle.Success : ButtonStyle.Secondary),
  );
  return {
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(buttons)],
    allowedMentions: { parse: [] },
  };
}

export function vibeCard(g) {
  const v = vibe(g);
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0x88caff)
        .setTitle('🦋 LumiVibe • Live Pulse')
        .setDescription('**' + v.label + '**')
        .addFields(
          { name: '💬 Public messages', value: String(v.volume), inline: true },
          { name: '🗂️ Active channels', value: String(v.channels), inline: true },
          { name: '📸 Saved moments', value: String(moments(g).length), inline: true },
        )
        .setFooter({ text: 'Last 24 hours since startup • excludes private channels' }),
    ],
    allowedMentions: { parse: [] },
  };
}
export function scrapbookCard(g, page = 0) {
  const entries = moments(g).slice().reverse(),
    total = entries.length;
  if (!total)
    return {
      embeds: [
        new EmbedBuilder()
          .setColor(0x88caff)
          .setTitle('📸 LumiVibe Scrapbook')
          .setDescription('No public moments saved yet. React to memorable posts to help fill this gallery!'),
      ],
      components: [],
    };
  const p = Math.max(0, Math.min(page, total - 1)),
    m = entries[p];
  const embed = new EmbedBuilder()
    .setColor(0x88caff)
    .setTitle('📸 LumiVibe Scrapbook')
    .setDescription('**Moment ' + (p + 1) + ' of ' + total + '**\n[Open original Discord message](' + m.url + ')')
    .setFooter({ text: 'Public message links only • no private message content stored' });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('lumira:gallery:' + Math.max(0, p - 1))
      .setLabel('◀ Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(p === 0),
    new ButtonBuilder()
      .setCustomId('lumira:gallery:' + Math.min(total - 1, p + 1))
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(p === total - 1),
  );
  return { embeds: [embed], components: [row], allowedMentions: { parse: [] } };
}
export function egoCard(ego, user) {
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0xa7b9ff)
        .setTitle('🎭 Lumira Alter Ego')
        .setDescription(ego)
        .setThumbnail(user.displayAvatarURL({ size: 128 }))
        .setFooter({ text: 'Fictional, opt-in and removable at any time' }),
    ],
    allowedMentions: { parse: [] },
  };
}
