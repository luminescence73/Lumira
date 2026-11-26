import { createHolidayDelivery } from './holidays.js';
import { installDiagnostics } from './diagnostics.js';
import { commandDefinitions } from './command-schema.js';
import { loadSocialLore } from './social-lore.js';
import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import { loadAdmin } from './admin.js';
import { installAutomaticLore } from './automatic-lore.js';
import { bump, pulse } from './cards.js';
import { publicSocialChannel } from './channels.js';
import { handleDirectChat } from './conversations.js';
import { createReminderDelivery } from './event-delivery.js';
import { handleExpressionCopyMessage } from './expression-copy.js';
import { loadEvents } from './events.js';
import { channelAllowed, loadFeatures } from './features.js';
import { handleInteraction } from './interactions.js';
import { loadLore } from './lore.js';
import { loadMemories } from './memory.js';
import { memberEventsAvailable } from './member-events.js';
import { installOperations } from './operations.js';
import { noteDirectConversation, socialReaction, spontaneousChat } from './passive-chat.js';
import { loadPlayground } from './playground.js';
import { loadProfiles } from './profiles.js';
import { loadRoster } from './roster.js';
import { installReadyJobs } from './startup-jobs.js';
import { handleStickerChat } from './sticker-chat.js';

const interval = (callback, time) => setInterval(callback, time).unref();
const timeout = (callback, time) => setTimeout(callback, time).unref();

export function createClient({ memberEvents = process.env.LUMIRA_MEMBERS_INTENT === 'true' } = {}) {
  const intents = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildExpressions,
    GatewayIntentBits.GuildVoiceStates,
  ];
  if (memberEvents) intents.push(GatewayIntentBits.GuildMembers);
  return new Client({
    intents,
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.GuildMember],
  });
}

export function installBot(client, { scheduleInterval = interval, scheduleTimeout = timeout } = {}) {
  installOperations(client, scheduleInterval);
  installDiagnostics(client, scheduleInterval);
  installReadyJobs(client, scheduleInterval, scheduleTimeout);
  installAutomaticLore(client);
  client.on(Events.InteractionCreate, handleInteraction);
  client.on(Events.MessageCreate, async (message) => {
    if (!message.inGuild() || message.author.bot || message.webhookId || !client.user) return;
    try {
      pulse(message);
      if (await handleExpressionCopyMessage(message, client)) return;
      if (await handleStickerChat(message, client)) return;
      if (
        await handleDirectChat(message, client.user.id, () => {
          bump(message.guildId, 'mentions');
          noteDirectConversation(message.channelId);
        })
      )
        return;
      await Promise.all([spontaneousChat(message), socialReaction(message)]);
    } catch (error) {
      console.error('Discord message handler:', error.message);
    }
  });
  const deliver = createReminderDelivery(client, { channelAllowed, publicSocialChannel });
  const celebrate = createHolidayDelivery(client);
  client.once(Events.ClientReady, () => scheduleInterval(async () => { await Promise.all([deliver(), celebrate()]); }, 60_000));
}

export async function startBot({ token, client, scheduleInterval, scheduleTimeout } = {}) {
  if (!token) throw Error('DISCORD_TOKEN is required');
  await Promise.all([
    loadMemories(),
    loadLore(),
    loadSocialLore(),
    loadFeatures(),
    loadPlayground(),
    loadEvents(),
    loadRoster(),
    loadProfiles(),
    loadAdmin(),
  ]);
  if (!client) {
    const setting = process.env.LUMIRA_MEMBERS_INTENT;
    const memberEvents =
      setting !== 'false' &&
      (await memberEventsAvailable(token, {
        configure: setting === 'true' || process.env.RAILWAY_SERVICE_NAME === 'lumira-bot',
      }));
    console.log('Lumira Discord member events:', memberEvents ? 'enabled' : 'unavailable or disabled');
    client = createClient({ memberEvents });
  }
  installBot(client, { scheduleInterval, scheduleTimeout });
  client.once(Events.ClientReady, async () => {
    try {
      // Replace stale global commands, then remove guild-scoped duplicates.
      await client.application.commands.set(commandDefinitions());
      for (const guild of client.guilds.cache.values()) {
        await guild.commands.set([]);
      }
      console.log('Lumira slash commands synchronized');
    } catch (error) {
      console.error('Lumira slash command synchronization failed:',error.message);
    }
  });
  await client.login(token);
  return client;
}
