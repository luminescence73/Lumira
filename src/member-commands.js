import { MessageFlags } from 'discord.js';
import { queuedReply } from './ai.js';
import { egoCard } from './cards.js';
import { LUMIVIBE_GUILD_ID } from './channels.js';
import {
  getEgo,
  setEgo,
  clearEgo,
  scrapbookAllowed,
  memberMuted,
  setMemberMuted,
  setScrapbookOptOut,
} from './features.js';
import { enableMemory, memoryStatus, saveMemory, removeMemory, disableMemory } from './memory.js';
import { clearMemberConversations } from './conversations.js';
import { removeAuthorMoments } from './lore.js';
import { deleteProfilePost, fetchProfilePost, putProfilePost } from './profile-posts.js';
import { profile, profileChannel, profileEmbed, removeProfile, setProfile, withProfileWrite } from './profiles.js';

export async function privacyCommand(interaction) {
  if (!interaction.inGuild())
    return interaction.reply({ content: 'Only available in LumiVibe.', flags: MessageFlags.Ephemeral });
  const g = interaction.guildId,
    u = interaction.user.id,
    sub = interaction.options.getSubcommand();
  try {
    if (sub === 'mute') {
      await setMemberMuted(g, u, true);
      await setScrapbookOptOut(g, u, true);
      await removeAuthorMoments(g, u);
      clearMemberConversations(g, u);
    }
    if (sub === 'unmute') await setMemberMuted(g, u, false);
    return interaction.reply({
      content:
        'Privacy preferences: ' +
        (memberMuted(g, u)
          ? 'Lumira will not respond to your mentions, use your messages for auto lore, or save your posts to the scrapbook.'
          : 'Lumira interactions enabled.') +
        '\nScrapbook auto-saving: ' +
        (scrapbookAllowed(g, u) ? 'allowed' : 'off') +
        '\nYou can manage personal saved facts separately with /lumira-memory.',
      flags: MessageFlags.Ephemeral,
    });
  } catch (e) {
    return interaction.reply({ content: 'Privacy update failed: ' + e.message, flags: MessageFlags.Ephemeral });
  }
}
export async function egoCommand(interaction) {
  if (!interaction.inGuild())
    return interaction.reply({ content: 'Only available in LumiVibe.', flags: MessageFlags.Ephemeral });
  const sub = interaction.options.getSubcommand(),
    g = interaction.guildId,
    u = interaction.user.id;
  try {
    if (sub === 'reset') {
      await clearEgo(g, u);
      return interaction.reply({
        content: 'Your fictional alter ego has been deleted. 💙',
        flags: MessageFlags.Ephemeral,
      });
    }
    if (sub === 'view') {
      const ego = getEgo(g, u);
      return interaction.reply(
        ego
          ? { ...egoCard(ego, interaction.user), flags: MessageFlags.Ephemeral }
          : { content: 'You have no alter ego yet. Use /lumira-ego create!', flags: MessageFlags.Ephemeral },
      );
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const generated = (
      await queuedReply(
        'Invent a ridiculous but affectionate fictional alter ego for a Discord member. This is consensual fiction, not a factual personality assessment. Output ONLY a funny title and a single punchy sentence, under 200 characters. No real personal facts or protected traits.',
      )
    ).slice(0, 220);
    await setEgo(g, u, generated);
    return interaction.editReply(egoCard(generated, interaction.user));
  } catch (e) {
    console.error('Alter ego error:', e.message);
    return interaction.deferred
      ? interaction.editReply({ content: 'Alter ego failed. Try again.' })
      : interaction.reply({ content: 'Alter ego failed. Try again.', flags: MessageFlags.Ephemeral });
  }
}
export async function profileCommand(interaction) {
  if (!interaction.inGuild() || interaction.guildId !== LUMIVIBE_GUILD_ID)
    return interaction.reply({ content: 'Only available in LumiVibe.', flags: MessageFlags.Ephemeral });
  const sub = interaction.options.getSubcommand(),
    g = interaction.guildId,
    u = interaction.user.id;
  if (sub === 'view') {
    const saved = profile(g, u);
    return interaction.reply({
      content: saved?.about
        ? 'Your profile: ' + saved.about
        : 'You have no profile yet. Use /lumira-profile create.',
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    return await withProfileWrite(g, u, async () => {
      const saved = profile(g, u);
      const channel = await profileChannel(interaction.guild);
      if (!channel) throw Error('The #cards channel was not found');
      if (sub === 'delete') {
        await deleteProfilePost(channel, saved?.messageId);
        await removeProfile(g, u);
        return interaction.editReply({ content: 'Your profile was removed from #cards. 💙' });
      }
      const about = interaction.options
        .getString('about')
        .trim()
        .replace(/@everyone|@here/gi, '[mention removed]');
      if (about.length < 3) throw Error('Write at least three characters for your profile.');
      const original = await fetchProfilePost(channel, saved?.messageId);
      const post = await putProfilePost(channel, original, profileEmbed(interaction.user, about));
      await setProfile(g, u, {
        about,
        messageId: post.id,
        updatedAt: Date.now(),
        automatic: false,
        curated: false,
      });
      return interaction.editReply({
        content: 'Your profile card is live in <#' + channel.id + '>! 💙',
        allowedMentions: { parse: [] },
      });
    });
  } catch (error) {
    console.error('Profile command:', error.message);
    return interaction.editReply({
      content: 'Could not update profile: ' + error.message,
      allowedMentions: { parse: [] },
    });
  }
}
export async function memoryCommand(interaction) {
  const guild = interaction.guildId;
  if (!guild)
    return interaction.reply({
      content: 'Memory is only available in LumiVibe server channels.',
      flags: MessageFlags.Ephemeral,
    });
  const sub = interaction.options.getSubcommand();
  try {
    let result = '';
    if (sub === 'enable') {
      await enableMemory(guild, interaction.user.id);
      result =
        'Memory enabled! 💙 Nothing is saved automatically. Use /lumira-memory save to choose what I remember.';
    }
    if (sub === 'save') {
      const note = interaction.options.getString('note').trim();
      if (!note || note.length > 200) throw Error('Enter a note of 1–200 characters');
      await saveMemory(guild, interaction.user.id, note);
      result = 'Saved your note privately. 💙';
    }
    if (sub === 'view') {
      const state = memoryStatus(guild, interaction.user.id);
      result = state.enabled
        ? state.items.length
          ? 'Your saved memories:\n' + state.items.map((v, i) => i + 1 + '. ' + v).join('\n')
          : 'Memory is enabled, but nothing is saved yet.'
        : 'Memory is off. Use /lumira-memory enable to opt in.';
    }
    if (sub === 'delete') {
      await removeMemory(guild, interaction.user.id, interaction.options.getInteger('number'));
      result = 'That memory was deleted. 💙';
    }
    if (sub === 'disable') {
      await disableMemory(guild, interaction.user.id);
      result = 'Long-term memory disabled and all your saved memories deleted. 💙';
    }
    return interaction.reply({
      content: result.slice(0, 1900),
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  } catch (error) {
    console.error('Memory command failed:', error.message);
    return interaction.reply({
      content: 'Memory change could not be completed: ' + error.message,
      flags: MessageFlags.Ephemeral,
    });
  }
}
