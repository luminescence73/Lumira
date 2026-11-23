import { checkChatProvider } from './ai.js';
import { Events } from 'discord.js';
import {
  applyLayoutOnce,
  finishLayoutOnce,
  populateEmptySectionsOnce,
  reconcileLegacyChannelsOnce,
  organizeEverythingOnce,
  restoreOriginalChannelsOnce,
  finishCleanupAndControlOnce,
  publishEmojiDirectoryOnce,
  repairControlFormattingOnce,
  refreshLiveboard,
  authorizeGracieStickerImportOnce,
  refreshStickerDirectory,
} from './admin.js';
import { LUMIVIBE_GUILD_ID } from './channels.js';
import { commandDefinitions } from './command-schema.js';
import { publishMemberCommands } from './member-command-directory.js';
import { publishCuratedCards } from './curated-cards.js';
import { organizeVisualEmojis } from './emoji-visual.js';
import { populateMemberProfiles } from './profiles.js';
import { roster, syncRoster } from './roster.js';

const migrations = [
  ['layout', applyLayoutOnce],
  ['legacy cleanup', finishLayoutOnce],
  ['voice and control', populateEmptySectionsOnce],
  ['legacy organization', reconcileLegacyChannelsOnce],
  ['full organization', organizeEverythingOnce],
  ['restore original channel names', restoreOriginalChannelsOnce],
  ['duplicate cleanup and control posts', finishCleanupAndControlOnce],
  ['Gracie sticker authorization', authorizeGracieStickerImportOnce],
  ['sticker directory', refreshStickerDirectory],
  ['emoji directory', publishEmojiDirectoryOnce],
  ['repair control formatting', repairControlFormattingOnce],
  ['liveboard design', refreshLiveboard],
];

async function runJob(label, job) {
  try {
    return await job();
  } catch (error) {
    console.error('Lumira ' + label + ':', error.message);
  }
}

async function prepareGuild(guild) {
  if (guild.id !== LUMIVIBE_GUILD_ID) {
    await runJob('member directory', () => syncRoster(guild));
    return;
  }

  // Start member discovery while the server layout is reconciled.
  const memberSync = runJob('member directory', () => syncRoster(guild));
  for (const [label, job] of migrations) {
    await runJob(label, () => job(guild));
  }

  await memberSync;
  await runJob('member command directory', () => publishMemberCommands(guild));
  await runJob('curated cards', () => publishCuratedCards(guild));
  await runJob('automatic member cards', () => populateMemberProfiles(guild, roster(guild.id)));
}

export async function registerLumiVibeCopyCommand(guild) {
  const definition = commandDefinitions().find((command) => command.name === 'lumira-copy');
  const registered = await guild.commands.create(definition);
  const confirmed = await guild.commands.fetch(registered.id, { force: true });
  if (
    confirmed.name !== definition.name ||
    !['emoji', 'sticker'].every((kind) => confirmed.options.some((option) => option.name === kind))
  )
    throw Error('Discord did not return both copy subcommands');
  console.log('Verified LumiVibe #' + guild.id + ' slash command /lumira-copy ' + confirmed.id);
  return confirmed;
}

export function installReadyJobs(client, scheduleInterval, scheduleTimeout) {
  client.once(Events.ClientReady, (readyClient) => {
    console.log('Lumira online as ' + readyClient.user.tag);
    void checkChatProvider();
    void runJob('slash command registration', async () => {
      const guildId = process.env.DISCORD_GUILD_ID;
      const commands = guildId
        ? (await readyClient.guilds.fetch(guildId)).commands
        : readyClient.application.commands;
      await commands.set(commandDefinitions());
      console.log('Registered Lumira slash commands' + (guildId ? ' in configured guild' : ' globally'));
    });
    for (const guild of readyClient.guilds.cache.values()) {
      void prepareGuild(guild);
      if (guild.id === LUMIVIBE_GUILD_ID) {
        void runJob('LumiVibe copy command registration', () => registerLumiVibeCopyCommand(guild));
        const classify = async () => {
          const result = await runJob('emoji organization', () => organizeVisualEmojis(guild));
          if (result) console.log('LumiVibe emoji organization:', JSON.stringify(result));
        };
        scheduleTimeout(classify, 5_000);
        scheduleInterval(classify, 60_000);
      }
    }
  });
}
