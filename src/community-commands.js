import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { liveboard, scrapbookCard, vibeCard } from './cards.js';
import { LUMIVIBE_GUILD_ID, publicSocialChannel } from './channels.js';
import { schedule, upcoming } from './events.js';
import {
  excludedChannels,
  personality,
  scrapbookAllowed,
  setChannelAllowed,
  setPersonality,
  setScrapbookOptOut,
  setSetting,
  settings,
} from './features.js';
import {
  addHistory,
  addJoke,
  addMoment,
  deleteHistory,
  deleteJoke,
  deleteMoment,
  histories,
  jokes,
  moments,
  removeAuthorMoments,
} from './lore.js';

export async function personalityCommand(interaction) {
  if (!interaction.inGuild() || interaction.guild.ownerId !== interaction.user.id)
    return interaction.reply({ content: 'Owner only.', flags: MessageFlags.Ephemeral });
  if (interaction.options.getSubcommand() === 'set')
    await setPersonality(interaction.guildId, interaction.options.getString('style'));
  return interaction.reply({
    content: '🦋 Lumira personality: **' + personality(interaction.guildId) + '**',
    flags: MessageFlags.Ephemeral,
  });
}
export async function eventCommand(interaction) {
  if (!interaction.inGuild()) return interaction.reply({ content: 'Server only.', flags: MessageFlags.Ephemeral });
  const g = interaction.guildId,
    sub = interaction.options.getSubcommand();
  try {
    if (sub === 'schedule') {
      if (interaction.guild.ownerId !== interaction.user.id)
        return interaction.reply({ content: 'Owner only.', flags: MessageFlags.Ephemeral });
      if (!publicSocialChannel(interaction.channel)) throw Error('Schedule from a permitted public channel.');
      const iso = interaction.options.getString('utc'),
        when = Date.parse(iso);
      if (
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?Z$/.test(iso) ||
        !Number.isFinite(when) ||
        new Date(when).toISOString().slice(0, 16) !== iso.slice(0, 16)
      )
        throw Error('Use UTC ISO format, e.g. 2026-12-01T20:00:00Z');
      await schedule(g, interaction.channelId, interaction.options.getString('title'), when);
    }
    const list = upcoming(g)
      .map((e) => '• **' + e.title + '** <t:' + Math.floor(e.when / 1000) + ':F> in <#' + e.channel + '>')
      .join('\n');
    return interaction.reply({
      content:
        '📅 **LumiVibe Events**\n' +
        (list || 'No upcoming events.') +
        '\nOnly owner-scheduled reminders are posted.',
      allowedMentions: { parse: [] },
    });
  } catch (e) {
    return interaction.reply({ content: 'Event error: ' + e.message, flags: MessageFlags.Ephemeral });
  }
}
export async function channelsCommand(interaction) {
  if (!interaction.inGuild() || interaction.guild.ownerId !== interaction.user.id)
    return interaction.reply({ content: 'Server owner only.', flags: MessageFlags.Ephemeral });
  const g = interaction.guildId,
    sub = interaction.options.getSubcommand();
  try {
    if (sub !== 'list') {
      const ch = interaction.options.getChannel('channel');
      if (ch.guildId !== g) throw Error('Channel must belong to this server');
      await setChannelAllowed(g, ch.id, sub === 'include');
    }
    const ids = excludedChannels(g);
    return interaction.reply({
      content:
        '**Excluded channels**\n' +
        (ids.length ? ids.map((id) => '<#' + id + '>').join('\n') : 'None') +
        '\nExcluded channels are ignored for social monitoring, scrapbook, lore and recent context.',
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  } catch (e) {
    return interaction.reply({ content: 'Channel setting failed: ' + e.message, flags: MessageFlags.Ephemeral });
  }
}
export async function vibeCommand(interaction) {
  if (!interaction.inGuild())
    return interaction.reply({ content: 'Only available in LumiVibe.', flags: MessageFlags.Ephemeral });
  const g = interaction.guildId,
    sub = interaction.options.getSubcommand();
  if (sub === 'now') return interaction.reply(vibeCard(g));
  if (sub === 'gallery') return interaction.reply(scrapbookCard(g));
  const entries = moments(g)
    .slice(-5)
    .filter((m) => /^https:\/\/discord(?:app)?\.com\/channels\//.test(m.url || ''));
  const lines = entries.map((m, i) => i + 1 + '. ' + m.url).join('\n');
  return interaction.reply({
    content:
      '📸 **LumiVibe scrapbook recap**\n' +
      (lines || 'No public moments saved yet. The scrapbook will grow as members react to posts.') +
      '\nThese are saved links, not a summary of private conversations.',
    allowedMentions: { parse: [] },
  });
}
export async function controlCommand(interaction) {
  if (!interaction.inGuild() || interaction.guild.ownerId !== interaction.user.id)
    return interaction.reply({
      content: 'Only the server owner can use Lumira controls.',
      flags: MessageFlags.Ephemeral,
    });
  try {
    const sub = interaction.options.getSubcommand();
    if (sub === 'set')
      await setSetting(
        interaction.guildId,
        interaction.options.getString('feature'),
        interaction.options.getBoolean('enabled'),
      );
    if (sub === 'dashboard')
      return interaction.reply({ ...liveboard(interaction.guildId), flags: MessageFlags.Ephemeral });
    const s = settings(interaction.guildId);
    return interaction.reply({
      content:
        'Lumira controls (server owner only):\n' +
        Object.entries(s)
          .map(([k, v]) => k + ': ' + (v ? 'ON' : 'OFF'))
          .join('\n') +
        '\nThese switches take effect immediately.',
      flags: MessageFlags.Ephemeral,
    });
  } catch (e) {
    return interaction.reply({ content: 'Control error: ' + e.message, flags: MessageFlags.Ephemeral });
  }
}
export async function historyCommand(interaction) {
  if (!interaction.inGuild() || interaction.guildId !== LUMIVIBE_GUILD_ID)
    return interaction.reply({ content: 'Only available in LumiVibe.', flags: MessageFlags.Ephemeral });
  const sub = interaction.options.getSubcommand();
  const mod =
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
    interaction.guild.ownerId === interaction.user.id;
  try {
    if (sub === 'list') {
      const entries = histories(interaction.guildId);
      const output = entries.length
        ? entries.map((x, i) => i + 1 + '. ' + x.text).join('\\n\\n')
        : 'No additional server history saved yet.';
      return interaction.reply({
        content: output.slice(0, 1900),
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
      });
    }
    if (!mod) throw Error('Only the owner or moderators can edit server history');
    if (sub === 'add') {
      const story = interaction.options.getString('story').trim();
      if (story.length < 5) throw Error('Please enter at least five characters');
      await addHistory(interaction.guildId, story, interaction.user.id);
      return interaction.reply({
        content: '📖 Added to Lumira’s server history. 💙',
        flags: MessageFlags.Ephemeral,
      });
    }
    await deleteHistory(interaction.guildId, interaction.options.getInteger('number'));
    return interaction.reply({ content: 'History entry removed. 💙', flags: MessageFlags.Ephemeral });
  } catch (e) {
    return interaction.reply({ content: e.message, flags: MessageFlags.Ephemeral });
  }
}
export async function loreCommand(interaction) {
  if (!interaction.inGuild())
    return interaction.reply({ content: 'Only available in LumiVibe.', flags: MessageFlags.Ephemeral });
  const guild = interaction.guildId,
    sub = interaction.options.getSubcommand();
  const mod =
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
    interaction.guild?.ownerId === interaction.user.id;
  try {
    let result = '';
    if (interaction.commandName === 'lumira-lore') {
      if (sub === 'list') {
        const entries = jokes(guild);
        result = entries.length
          ? entries.map((x, i) => i + 1 + '. ' + x.text).join('\n')
          : 'No approved inside jokes yet.';
      }
      if (sub === 'add') {
        if (!mod) throw Error('Only moderators can approve server lore');
        await addJoke(guild, interaction.options.getString('joke').trim(), interaction.user.id);
        result = 'Added to Lumira’s approved inside-joke library. 💙';
      }
      if (sub === 'remove') {
        if (!mod) throw Error('Only moderators can remove server lore');
        await deleteJoke(guild, interaction.options.getInteger('number'));
        result = 'Inside joke removed. 💙';
      }
    } else {
      if (sub === 'list') {
        const entries = moments(guild);
        result = entries.length
          ? entries.map((x, i) => i + 1 + '. ' + x.url).join('\n')
          : 'No scrapbook moments saved yet.';
      }
      if (sub === 'optout') {
        await setScrapbookOptOut(guild, interaction.user.id, true);
        const removed = await removeAuthorMoments(guild, interaction.user.id);
        result =
          'Your public posts will no longer be automatically saved. Removed ' +
          removed +
          ' existing scrapbook links. 💙';
      }
      if (sub === 'optin') {
        await setScrapbookOptOut(guild, interaction.user.id, false);
        result = 'You can now appear in the automatic scrapbook again. 💙';
      }
      if (sub === 'save') {
        const link = interaction.options.getString('link').trim(),
          match = link.match(/^https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/channels\/(\d+)\/(\d+)\/(\d+)$/);
        if (!match || match[1] !== guild) throw Error('Provide a message link from this server');
        const channel = await interaction.guild.channels.fetch(match[2]);
        if (!channel || !publicSocialChannel(channel) || !channel.messages?.fetch)
          throw Error('Only public text-channel posts can be saved');
        const msg = await channel.messages.fetch(match[3]);
        if (!scrapbookAllowed(guild, msg.author.id)) throw Error('This member opted out of the scrapbook');
        if (msg.author.bot || !msg.content?.trim()) throw Error('Only text posts from members can be saved');
        if (msg.author.id !== interaction.user.id && !mod)
          throw Error('You can save your own posts; moderators can save other public posts');
        await addMoment(guild, {
          messageId: msg.id,
          url: msg.url,
          by: interaction.user.id,
          author: msg.author.id,
          at: Date.now(),
        });
        result = 'Moment saved to the scrapbook! 📸';
      }
      if (sub === 'remove') {
        const n = interaction.options.getInteger('number'),
          entry = moments(guild)[n - 1];
        if (!entry) throw Error('No moment with that number');
        if (!mod && entry.by !== interaction.user.id && entry.author !== interaction.user.id)
          throw Error('You can only remove your own saved moments');
        await deleteMoment(guild, n);
        result = 'Scrapbook moment removed. 💙';
      }
    }
    return interaction.reply({
      content: result.slice(0, 1900),
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  } catch (error) {
    console.error('Lore/scrapbook command:', error.message);
    return interaction.reply({
      content: 'Could not complete that: ' + error.message,
      flags: MessageFlags.Ephemeral,
    });
  }
}
export async function galleryButton(interaction) {
  if (!interaction.inGuild())
    return interaction.reply({ content: 'Only available in LumiVibe.', flags: MessageFlags.Ephemeral });
  const page = Number(interaction.customId.split(':')[2]);
  if (!Number.isSafeInteger(page) || page < 0)
    return interaction.reply({ content: 'Invalid page.', flags: MessageFlags.Ephemeral });
  return interaction.update(scrapbookCard(interaction.guildId, page));
}
export async function controlButton(interaction) {
  if (!interaction.inGuild() || interaction.guild.ownerId !== interaction.user.id)
    return interaction.reply({
      content: 'Only the server owner can change these settings.',
      flags: MessageFlags.Ephemeral,
    });
  const key = interaction.customId.split(':')[2];
  try {
    if (!['autoLore', 'autoScrapbook', 'spontaneous', 'roasts'].includes(key)) throw Error('Invalid control');
    await setSetting(interaction.guildId, key, !settings(interaction.guildId)[key]);
    return interaction.update(liveboard(interaction.guildId));
  } catch (e) {
    return interaction.reply({ content: 'Could not update: ' + e.message, flags: MessageFlags.Ephemeral });
  }
}
