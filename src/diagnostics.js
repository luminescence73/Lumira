import { Events, GatewayIntentBits, PermissionFlagsBits, ChannelType } from 'discord.js';
import { LUMIVIBE_GUILD_ID } from './channels.js';
import { commandDefinitions } from './command-schema.js';
import { jsonStore } from './json-store.js';

export async function runDiagnostics(client) {
  const results = [];
  const check = async (name, fn) => {
    try { results.push({ name, status: await fn() ? 'PASS' : 'FAIL' }); }
    catch { results.push({ name, status: 'FAIL' }); }
  };
  await check('Discord gateway ready', () => client.isReady());
  await check('Member events intent', () => client.options.intents.has(GatewayIntentBits.GuildMembers));
  let guild, channels, bot;
  await check('LumiVibe access', async () => { guild = await client.guilds.fetch(LUMIVIBE_GUILD_ID); return !!guild; });
  await check('Channel and bot member access', async () => {
    if (!guild) return false;
    channels = await guild.channels.fetch(); bot = await guild.members.fetchMe(); return !!channels && !!bot;
  });
  await check('Global command names match', async () => {
    const actual = [...(await client.application.commands.fetch()).values()].map(c => c.name).sort();
    return JSON.stringify(actual) === JSON.stringify(commandDefinitions().map(c => c.name).sort());
  });
  const store = jsonStore('diagnostics-probe.json');
  await check('Storage read/write', async () => {
    const nonce = Date.now();
    await store.save({ nonce });
    return (await store.load()).nonce === nonce;
  });
  const privateChannel = name => channels?.find(c => c?.type === ChannelType.GuildText && c.name === name && c.permissionsFor(guild.roles.everyone)?.has(PermissionFlagsBits.ViewChannel) === false);
  const log = privateChannel('bot-logs');
  const canSend = ch => !!ch && !!bot && bot.permissionsIn(ch).has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]);
  await check('Private log channel writable', () => canSend(log));
  const testChannel = privateChannel('lumira-test');
  results.push({ name: 'Private test channel', status: canSend(testChannel) ? 'PASS' : 'NOT_CONFIGURED' });
  results.push({ name: 'Live member interactions', status: 'NOT_TESTED' });
  const report = 'Lumira diagnostics\n' + results.map(r => r.status + ' | ' + r.name).join('\n');
  console.log(report);
  if (canSend(log)) {
    try { await log.send({ content: report, allowedMentions: { parse: [] } }); }
    catch { console.warn('Lumira diagnostic report delivery failed'); }
  }
  return results;
}

export function installDiagnostics(client, scheduleInterval) {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try { await runDiagnostics(client); }
    catch { console.error('Lumira diagnostics failed'); }
    finally { running = false; }
  };
  client.once(Events.ClientReady, () => {
    // Wait for existing startup jobs and command registration to settle.
    setTimeout(run, 60_000).unref();
    scheduleInterval(run, 24 * 60 * 60 * 1000);
  });
}
