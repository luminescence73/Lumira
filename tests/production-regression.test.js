import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Events, GatewayIntentBits } from 'discord.js';

test('production command definitions match registered handlers', async () => {
  const { commandDefinitions } = await import('../src/command-schema.js');
  const { commandNames } = await import('../src/interactions.js');
  const names = commandDefinitions().map(c => c.name);
  assert.equal(new Set(names).size, names.length);
  assert.deepEqual([...names].sort(), [...commandNames].sort());
});

test('production client enables expected intents and event wiring without login', async () => {
  const { createClient, installBot } = await import('../src/bot.js');
  const client = createClient({ memberEvents: true });
  try {
    for (const intent of [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]) assert.ok(client.options.intents.has(intent));
    installBot(client, { scheduleInterval: () => {}, scheduleTimeout: () => {} });
    for (const event of [Events.ClientReady, Events.MessageCreate, Events.InteractionCreate, Events.GuildMemberAdd, Events.GuildMemberRemove]) assert.ok(client.listenerCount(event) > 0, event);
  } finally { client.destroy(); }
});

test('JSON persistence round trips, serializes writes, and rejects corrupt data', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lumira-regression-'));
  const previous = process.env.LUMIRA_DATA_DIR;
  process.env.LUMIRA_DATA_DIR = dir;
  try {
    const { jsonStore } = await import('../src/json-store.js');
    const store = jsonStore('regression.json');
    assert.deepEqual(await store.load(), {});
    await Promise.all([store.save({ version: 1 }), store.save({ version: 2 })]);
    assert.deepEqual(await jsonStore('regression.json').load(), { version: 2 });
    await writeFile(join(dir, 'regression.json'), 'invalid');
    await assert.rejects(store.load());
  } finally {
    if (previous === undefined) delete process.env.LUMIRA_DATA_DIR;
    else process.env.LUMIRA_DATA_DIR = previous;
    await rm(dir, { recursive: true, force: true });
  }
});
