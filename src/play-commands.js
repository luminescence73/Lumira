import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { queuedReply } from './ai.js';
import { publicSocialChannel } from './channels.js';
import { settings, setSetting, getEgo, scrapbookAllowed, memberMuted, personality } from './features.js';
import { courtPrompt, roastRound, quoteSubmit, quoteRound, guessQuote, revealQuote } from './social-games.js';
import { socialDirection } from './social-persona.js';
import { gameCard, vote, leaderboard, award, recentAwards } from './playground.js';
import { renderCard, studioBoard, generateImage } from './visual.js';
import { moments } from './lore.js';
const imageQuota = new Map();
let quotaDate;
function imageAvailable(user) {
  const date = new Date().toISOString().slice(0, 10);
  if (date !== quotaDate) {
    imageQuota.clear();
    quotaDate = date;
  }
  const key = date + ':' + user,
    limit = Math.max(1, Math.min(10, Math.floor(Number(process.env.LUMIRA_IMAGE_DAILY_LIMIT) || 2)));
  return { key, limit, remaining: Math.max(0, limit - (imageQuota.get(key) || 0)) };
}
export async function playCommand(interaction) {
  if (!interaction.inGuild() || !publicSocialChannel(interaction.channel))
    return interaction.reply({
      content: 'Games are only available in permitted public channels.',
      flags: MessageFlags.Ephemeral,
    });
  if (memberMuted(interaction.guildId, interaction.user.id))
    return interaction.reply({ content: 'Unmute Lumira to play.', flags: MessageFlags.Ephemeral });
  const sub = interaction.options.getSubcommand(),
    g = interaction.guildId;
  try {
    if (['rather', 'trivia', 'roulette'].includes(sub))
      return interaction.reply(gameCard(g, interaction.channelId, sub, interaction.user.id));
    if (sub === 'court' || sub === 'roast') {
      const tone = socialDirection({
        userId: interaction.user.id,
        ownerId: interaction.guild.ownerId,
        displayName: interaction.member?.displayName,
        username: interaction.user.username,
      });
      const verdict = sub === 'court' ? courtPrompt(interaction.options.getString('situation')) : null;
      if (sub === 'roast' && !settings(g).roasts) throw Error('Roast battles are disabled by the server owner.');
      await interaction.deferReply();
      const reply = async (instruction, limit) => {
        const answer = await queuedReply(tone + instruction, personality(g));
        if (
          memberMuted(g, interaction.user.id) ||
          !publicSocialChannel(interaction.channel) ||
          (sub === 'roast' && !settings(g).roasts)
        )
          throw Error('This activity was disabled while Lumira was responding.');
        return interaction.editReply({ content: answer.slice(0, limit), allowedMentions: { parse: [] } });
      };
      if (verdict) return await reply(verdict, 300);
      return await roastRound(
        g,
        interaction.channelId,
        interaction.user.id,
        interaction.options.getString('comeback'),
        (round) => reply(round.prompt, 180),
      );
    }
    if (sub === 'quote-add') {
      quoteSubmit(g, interaction.channelId, interaction.user.id, interaction.options.getString('quote'));
      return interaction.reply({
        content: '📜 Your quote was added to this channel’s opt-in Who Said That? collection (until restart).',
        flags: MessageFlags.Ephemeral,
      });
    }
    if (sub === 'who-said') {
      const round = quoteRound(g, interaction.channelId, interaction.user.id);
      return interaction.reply({
        content:
          '🕵️ **Who Said That?**\n“' +
          round.quote +
          '”\nGuess who submitted this quote! The answer is hidden for now. Use /lumira-play guess to make your guess, or /lumira-play reveal for the answer.',
        allowedMentions: { parse: [] },
      });
    }
    if (sub === 'guess') {
      const result = guessQuote(g, interaction.channelId, interaction.options.getUser('member').id);
      return interaction.reply({
        content: result.correct
          ? '🎉 Correct! The quote was submitted by ' + interaction.options.getUser('member').username + '.'
          : 'Not quite! Try another guess.',
        allowedMentions: { parse: [] },
      });
    }
    if (sub === 'reveal') {
      const mod =
        interaction.guild.ownerId === interaction.user.id ||
        interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
      const answer = revealQuote(g, interaction.channelId, interaction.user.id, mod);
      return interaction.reply({
        content: '🎭 The quote was submitted by <@' + answer + '>!',
        allowedMentions: { parse: [] },
      });
    }
    if (sub === 'leaderboard')
      return interaction.reply({
        content: '🏆 **LumiVibe Trivia Leaderboard**\n' + leaderboard(g),
        allowedMentions: { parse: [] },
      });
    if (sub === 'awards')
      return interaction.reply({
        content:
          '🏅 **Recent Fictional Awards**\n' +
          (recentAwards(g)
            .map((a) => '<@' + a.to + '>: ' + a.title)
            .join('\n') || 'No awards yet.'),
        allowedMentions: { parse: [] },
      });
    const target = interaction.options.getUser('member'),
      title = interaction.options.getString('title');
    if (target.bot || memberMuted(g, target.id)) throw Error('This member cannot receive an award.');
    if (/@everyone|@here|<@|https?:/i.test(title)) throw Error('Keep awards free of mentions and links.');
    await award(g, interaction.user.id, target.id, title);
    const card = await renderCard({
      title: 'LumiVibe Award',
      subtitle: 'Awarded to ' + target.username,
      lines: [title],
      kind: 'Fictional Award',
    });
    return interaction.reply({
      content: '🏅 A fictional award for ' + target.username + '!',
      files: [card],
      allowedMentions: { parse: [] },
    });
  } catch (e) {
    const content = 'Game unavailable: ' + e.message;
    return interaction.deferred
      ? interaction.editReply({ content })
      : interaction.reply({ content, flags: MessageFlags.Ephemeral });
  }
}
export async function studioCommand(interaction) {
  if (!interaction.inGuild())
    return interaction.reply({ content: 'Only available in LumiVibe.', flags: MessageFlags.Ephemeral });
  const g = interaction.guildId,
    sub = interaction.options.getSubcommand(),
    s = settings(g);
  if (sub === 'dashboard') {
    if (interaction.guild.ownerId !== interaction.user.id)
      return interaction.reply({ content: 'Owner only.', flags: MessageFlags.Ephemeral });
    return interaction.reply({
      ...studioBoard(g, s, {
        imageReady: Boolean(process.env.GEMINI_IMAGE_API_KEY || process.env.GEMINI_API_KEY),
        dailyLimit: imageAvailable(interaction.user.id).limit,
        moments: moments(g).length,
      }),
      flags: MessageFlags.Ephemeral,
    });
  }
  const enabled = { photo: 'photoBooth', character: 'characterCards', collage: 'collages' }[sub];
  if (!s[enabled])
    return interaction.reply({
      content: 'That studio feature is currently disabled.',
      flags: MessageFlags.Ephemeral,
    });
  if (memberMuted(g, interaction.user.id))
    return interaction.reply({
      content: 'You muted Lumira. Unmute before using the studio.',
      flags: MessageFlags.Ephemeral,
    });
  const quota = imageAvailable(interaction.user.id);
  if (sub === 'photo' && quota.remaining < 1)
    return interaction.reply({
      content: 'Your image quota is used up for today. Try tomorrow! 🦋',
      flags: MessageFlags.Ephemeral,
    });
  if (sub === 'photo') imageQuota.set(quota.key, (imageQuota.get(quota.key) || 0) + 1);
  let imageGenerated = false;
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (sub === 'photo') {
      const prompt = interaction.options.getString('prompt');
      if (/(?:nudity|porn|sexual minor|gore|realistic violence)/i.test(prompt))
        throw Error('Please choose a safe fictional art prompt.');
      const image = await generateImage(prompt);
      imageGenerated = true;
      return interaction.editReply({ content: '🦋 **Lumira Photo Booth** • private preview', files: [image] });
    }
    if (sub === 'character') {
      const ego = getEgo(g, interaction.user.id);
      if (!ego) throw Error('Create your alter ego with /lumira-ego create first.');
      const image = await renderCard({
        title: interaction.user.username,
        subtitle: 'Fictional Alter Ego',
        lines: [ego],
        kind: 'Character Card',
      });
      return interaction.editReply({ content: '🎭 **Your character card**', files: [image] });
    }
    const entries = moments(g)
      .slice(-4)
      .filter((m) => m.url && m.author && scrapbookAllowed(g, m.author) && !memberMuted(g, m.author));
    const image = await renderCard({
      title: 'LumiVibe Memories',
      subtitle: 'Scrapbook recap • private preview',
      lines: entries.length
        ? entries.map((m, i) => 'Moment ' + (i + 1) + ' • saved public post')
        : ['No eligible saved moments yet'],
      kind: 'Memory Collage',
    });
    return interaction.editReply({
      content:
        '📸 **Private collage preview**\n' +
        entries.map((m, i) => i + 1 + '. ' + m.url).join('\n') +
        '\nNothing was automatically published.',
      files: [image],
      allowedMentions: { parse: [] },
    });
  } catch (e) {
    console.error('Visual studio:', e.message);
    if (!interaction.deferred) throw e;
    return interaction.editReply({ content: 'Visual Studio could not finish: ' + e.message });
  } finally {
    if (sub === 'photo' && !imageGenerated)
      imageQuota.set(quota.key, Math.max(0, (imageQuota.get(quota.key) || 1) - 1));
  }
}
export async function voteButton(interaction) {
  if (
    !interaction.inGuild() ||
    !publicSocialChannel(interaction.channel) ||
    memberMuted(interaction.guildId, interaction.user.id)
  )
    return interaction.reply({ content: 'You cannot vote while Lumira is muted.', flags: MessageFlags.Ephemeral });
  try {
    const [, , id, n] = interaction.customId.split(':');
    const response = await vote(interaction.guildId, interaction.channelId, id, interaction.user.id, Number(n));
    return interaction.reply({ content: response, flags: MessageFlags.Ephemeral });
  } catch (e) {
    return interaction.reply({ content: e.message, flags: MessageFlags.Ephemeral });
  }
}
export async function studioButton(interaction) {
  if (!interaction.inGuild() || interaction.guild.ownerId !== interaction.user.id)
    return interaction.reply({ content: 'Owner only.', flags: MessageFlags.Ephemeral });
  const key = interaction.customId.split(':')[2];
  if (!['photoBooth', 'characterCards', 'collages'].includes(key))
    return interaction.reply({ content: 'Unknown setting.', flags: MessageFlags.Ephemeral });
  await setSetting(interaction.guildId, key, !settings(interaction.guildId)[key]);
  return interaction.update(
    studioBoard(interaction.guildId, settings(interaction.guildId), {
      imageReady: Boolean(process.env.GEMINI_IMAGE_API_KEY || process.env.GEMINI_API_KEY),
      dailyLimit: imageAvailable(interaction.user.id).limit,
      moments: moments(interaction.guildId).length,
    }),
  );
}
