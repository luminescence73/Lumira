import test from 'node:test';
import assert from 'node:assert/strict';
import { Collection, StickerFormatType } from 'discord.js';
import { copyExpression, resolveExpressionSource } from '../src/expression-copy.js';

test('copies a custom emoji code with animation intact', async () => {
  const source = await resolveExpressionSource({}, 'emoji', '<a:dance:123456789012345678>', 'user');
  assert.deepEqual(source, { id: '123456789012345678', name: 'dance', animated: true });
  const bytes = Buffer.from('GIF89a fixture');
  const guild = { id: 'dest', emojis: { fetch: async () => [], create: async (payload) => payload } };
  const result = await copyExpression(guild, 'emoji', source, 'new_dance', {
    request: async (url) => {
      assert.match(url, /\/emojis\/123456789012345678\.gif$/);
      return new Response(bytes);
    },
  });
  assert.deepEqual(result.attachment, bytes);
  assert.equal(result.name, 'new_dance');
});

test('copies a cross-server sticker from a readable linked message in its original format', async () => {
  const input = 'https://discord.com/channels/10/20/30';
  const sticker = { id: '123456789012345678', name: 'Sparkle Dance', format: StickerFormatType.APNG, tags: '✨' };
  const channel = {
    guildId: '10',
    guild: { members: { fetch: async (id) => ({ id }) } },
    permissionsFor: (member) => ({ has: () => member.id === 'authorized-reader' }),
    messages: { fetch: async () => ({ stickers: new Collection([[sticker.id, sticker]]) }) },
  };
  const client = { channels: { fetch: async () => channel } };
  await assert.rejects(resolveExpressionSource(client, 'sticker', input, 'other-user'), /access to read/);
  const source = await resolveExpressionSource(client, 'sticker', input, 'authorized-reader');
  const bytes = Buffer.from('APNG fixture');
  const guild = { id: 'dest', stickers: { fetch: async () => [], create: async (payload) => payload } };
  const result = await copyExpression(guild, 'sticker', source, null, {
    request: async (url) => {
      assert.match(url, /\/stickers\/123456789012345678\.png$/);
      return new Response(bytes);
    },
  });
  assert.equal(result.name, 'Sparkle Dance');
  assert.equal(result.tags, '✨');
  assert.equal(result.file.name, 'sticker.png');
  assert.deepEqual(result.file.attachment, bytes);
});

test('accepts sticker IDs independently of whether the bot can read the original message', async () => {
  const client = { fetchSticker: async (id) => ({ id, name: 'Test Sticker' }) };
  assert.equal(
    (await resolveExpressionSource(client, 'sticker', '123456789012345678', 'user')).name,
    'Test Sticker',
  );
  await assert.rejects(
    resolveExpressionSource(client, 'sticker', 'https://example.com/stickers/123456789012345678.png', 'user'),
    /Discord message link/,
  );
});

test('the copy slash command is available directly in the LumiVibe guild', async () => {
  const { registerLumiVibeCopyCommand } = await import('../src/startup-jobs.js');
  let local;
  const guild = {
    id: 'test-guild',
    commands: {
      create: async (definition) => (local = { ...definition, id: 'copy-command' }),
      fetch: async (id) => {
        assert.equal(id, 'copy-command');
        return local;
      },
    },
  };
  const registered = await registerLumiVibeCopyCommand(guild);
  assert.equal(registered.name, 'lumira-copy');
  assert.deepEqual(
    registered.options.map((option) => option.name),
    ['sticker', 'emoji'],
  );
});

test('a plain text copy request works even before slash commands appear', async (t) => {
  const { handleExpressionCopyMessage } = await import('../src/expression-copy.js');
  const { LUMIVIBE_GUILD_ID } = await import('../src/channels.js');
  t.mock.method(globalThis, 'fetch', async () => new Response(Buffer.from('image bytes')));
  let reply;
  const message = {
    content: 'Lumira copy emoji <:dance:123456789012345678>',
    guildId: LUMIVIBE_GUILD_ID,
    author: { id: 'owner' },
    guild: {
      id: LUMIVIBE_GUILD_ID,
      ownerId: 'owner',
      members: { fetchMe: async () => ({ permissions: { has: () => true } }) },
      emojis: { fetch: async () => [], create: async (payload) => payload },
    },
    reply: async (payload) => {
      reply = payload;
    },
  };
  assert.equal(await handleExpressionCopyMessage(message, { user: { id: 'bot' } }), true);
  assert.match(reply.content, /Copied emoji \*\*dance\*\*/);
  assert.deepEqual(reply.allowedMentions, { parse: [], repliedUser: false });
});
