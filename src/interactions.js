import { copyExpressionCommand } from './expression-copy.js';
import { egoCommand, memoryCommand, privacyCommand, profileCommand } from './member-commands.js';
import { MessageFlags } from 'discord.js';
import { adminCommand, membersCommand } from './admin-commands.js';
import { chatCommand, forgetCommand } from './conversations.js';
import { playCommand, studioCommand, studioButton, voteButton } from './play-commands.js';
import {
  channelsCommand,
  controlButton,
  controlCommand,
  eventCommand,
  galleryButton,
  historyCommand,
  loreCommand,
  personalityCommand,
  vibeCommand,
} from './community-commands.js';

const commands = new Map([
  ['lumira', chatCommand],
  ['lumira-admin', adminCommand],
  ['lumira-copy', copyExpressionCommand],
  ['lumira-channels', channelsCommand],
  ['lumira-control', controlCommand],
  ['lumira-ego', egoCommand],
  ['lumira-event', eventCommand],
  ['lumira-forget', forgetCommand],
  ['lumira-history', historyCommand],
  ['lumira-lore', loreCommand],
  ['lumira-members', membersCommand],
  ['lumira-memory', memoryCommand],
  ['lumira-personality', personalityCommand],
  ['lumira-play', playCommand],
  ['lumira-privacy', privacyCommand],
  ['lumira-profile', profileCommand],
  ['lumira-scrapbook', loreCommand],
  ['lumira-studio', studioCommand],
  ['lumira-vibe', vibeCommand],
]);

const buttons = new Map([
  ['game', voteButton],
  ['studio', studioButton],
  ['gallery', galleryButton],
  ['toggle', controlButton],
]);

export const commandNames = [...commands.keys()];

export async function handleInteraction(interaction) {
  let handler;
  if (interaction.isChatInputCommand()) handler = commands.get(interaction.commandName);
  if (interaction.isButton() && interaction.customId.startsWith('lumira:')) {
    handler = buttons.get(interaction.customId.split(':')[1]);
  }
  if (!handler) return;

  try {
    await handler(interaction);
  } catch (error) {
    console.error('Interaction failed:', interaction.commandName || interaction.customId, error.message);
    const content = 'Lumira could not complete that. Please try again.';
    try {
      if (interaction.replied) await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
      else if (interaction.deferred) await interaction.editReply({ content });
      else await interaction.reply({ content, flags: MessageFlags.Ephemeral });
    } catch (replyError) {
      console.warn('Could not acknowledge Discord interaction:', replyError.message);
    }
  }
}
