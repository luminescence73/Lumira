import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { ApplicationFlags, ChannelType, Collection, Events } from 'discord.js';
import { memberEventsAvailable } from '../src/member-events.js';
import { installOperations } from '../src/operations.js';
import { LUMIVIBE_GUILD_ID } from '../src/channels.js';

test('enabling member events preserves other application flags', async () => {
  process.env.DISCORD_CLIENT_ID = 'app-id';
  const flag = ApplicationFlags.GatewayMessageContentLimited;
  const request = async (_url, options) => {
    if (!options.method) return Response.json({ id: 'app-id', flags: flag });
    assert.equal(options.method, 'PATCH');
    const { flags } = JSON.parse(options.body);
    assert.equal(flags, flag | ApplicationFlags.GatewayGuildMembersLimited);
    return Response.json({ id: 'app-id', flags });
  };
  assert.equal(await memberEventsAvailable('example', { request }), false);
  assert.equal(await memberEventsAvailable('example', { request, configure: true }), true);
  delete process.env.DISCORD_CLIENT_ID;
});

test('LumiVibe member joins and leaves post to the matching channels and private logger', async () => {
  const posts = [];
  const channels = new Collection();
  for (const name of ['welcome', 'goodbye', 'bot-logs'])
    channels.set(name, {
      name,
      type: ChannelType.GuildText,
      permissionsFor: () => ({ has: () => name !== 'bot-logs' }),
      send: async (payload) => posts.push([name, payload]),
    });
  const guild = {
    id: LUMIVIBE_GUILD_ID,
    channels: { cache: channels },
    roles: { everyone: {} },
    members: { fetchMe: async () => ({ permissionsIn: () => ({ has: () => true }) }) },
  };
  const client = new EventEmitter();
  installOperations(client, () => {});
  const member = { guild, user: { username: 'example' } };
  client.emit(Events.GuildMemberAdd, member);
  client.emit(Events.GuildMemberRemove, member);
  client.emit(Events.GuildMemberAdd, { ...member, guild: { id: 'another-server' } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(posts.filter(([name]) => name === 'welcome').length, 1);
  assert.equal(posts.filter(([name]) => name === 'goodbye').length, 1);
  const log = posts
    .filter(([name]) => name === 'bot-logs')
    .map(([, payload]) => payload.embeds[0].data.description)
    .join('\n');
  assert.match(log, /Member joined/);
  assert.match(log, /Member left/);
  assert.ok(posts.every(([, payload]) => payload.allowedMentions.parse.length === 0));
});
