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
  await runJob('curated cards', () => publishCuratedCards(guild));
  await runJob('automatic member cards', () => populateMemberProfiles(guild, roster(guild.id)));
}

export function installReadyJobs(client, scheduleInterval, scheduleTimeout) {
  client.once(Events.ClientReady, (readyClient) => {
    console.log('Lumira online as ' + readyClient.user.tag);
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
        const classify = async () => {
          const result = await runJob('emoji organization', () => organizeVisualEmojis(guild));
          if (result) console.log('LumiVibe emoji organization:', JSON.stringify(result));
        };
        scheduleTimeout(classify, 60_000);
        scheduleInterval(classify, 30 * 60_000);
      }
    }
  });
}
