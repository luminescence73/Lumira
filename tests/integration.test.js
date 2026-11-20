import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ChannelType, Events, GatewayIntentBits, MessageFlags, Partials } from 'discord.js';
import sharp from 'sharp';

const directory = await mkdtemp(path.join(tmpdir(), 'lumira-integration-'));
process.env.LUMIRA_DATA_DIR = directory;
process.env.LUMIRA_SPONTANEOUS_ENABLED = 'true';
after(() => rm(directory, { recursive: true, force: true }));

const { startBot, createClient } = await import('../src/bot.js');
const { LUMIVIBE_GUILD_ID, publicSocialChannel } = await import('../src/channels.js');
const { commandDefinitions } = await import('../src/command-schema.js');
const { commandNames, handleInteraction } = await import('../src/interactions.js');
const { directAddress, handleDirectChat } = await import('../src/conversations.js');
const { socialStyle } = await import('../src/social-persona.js');
const { passiveOpportunity, socialReaction } = await import('../src/passive-chat.js');
const { setMemberMuted, setSetting } = await import('../src/features.js');
const { loadMemories } = await import('../src/memory.js');
const { profile, populateMemberProfiles, setProfile } = await import('../src/profiles.js');
const { publishCuratedCards } = await import('../src/curated-cards.js');
const { createReminderDelivery } = await import('../src/event-delivery.js');
const { dueEvents, loadEvents } = await import('../src/events.js');
const { createEmojiOrganizer } = await import('../src/emoji-visual.js');
const { classifyEmoji } = await import('../src/emoji-classifier.js');
const { courtPrompt, guessQuote, quoteSubmit, quoteRound, revealQuote, roastRound } =
  await import('../src/social-games.js');
const { renderCard } = await import('../src/visual.js');
const { jsonStore } = await import('../src/json-store.js');

const waitTurn = () => new Promise((resolve) => setImmediate(resolve));
const responses = () =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'A very Lumira reply.' }] } }] }));

function interaction(commandName, sub, overrides = {}) {
  const guild = { id: 'test-community', ownerId: 'owner', roles: { everyone: {} } };
  const calls = [];
  return {
    commandName,
    guildId: guild.id,
    guild,
    channelId: 'chat',
    channel: { guild, permissionsFor: () => ({ has: () => true }) },
    user: { id: 'member', username: 'Member' },
    options: { getSubcommand: () => sub, getString: () => null },
    isChatInputCommand: () => true,
    isButton: () => false,
    inGuild: () => true,
    async reply(payload) {
      assert.equal(this.deferred, undefined);
      calls.push(['reply', payload]);
      return payload;
    },
    async deferReply(payload) {
      this.deferred = true;
      calls.push(['defer', payload]);
    },
    async editReply(payload) {
      assert.equal(this.deferred, true);
      calls.push(['edit', payload]);
      return payload;
    },
    calls,
    ...overrides,
  };
}

test('startup loads persisted state, logs into the injected gateway and registers all commands', async () => {
  await writeFile(
    path.join(directory, 'features.json'),
    JSON.stringify({ 'legacy-guild': { settings: { roasts: false } } }),
  );
  const client = new EventEmitter();
  let commands;
  let connected;
  const timers = [];
  client.user = { id: '99', tag: 'Lumira#test' };
  client.guilds = { cache: new Map() };
  client.application = {
    commands: {
      set: async (defs) => {
        commands = defs;
      },
    },
  };
  client.login = async (token) => {
    connected = token;
    client.emit(Events.ClientReady, client);
  };
  await assert.rejects(startBot(), /DISCORD_TOKEN/);
  assert.equal(
    await startBot({ token: 'test-only', client, scheduleInterval: (fn, delay) => timers.push([fn, delay]) }),
    client,
  );
  await waitTurn();
  assert.equal(connected, 'test-only');
  assert.equal(client.listenerCount(Events.MessageCreate), 2);
  assert.equal(client.listenerCount(Events.MessageReactionAdd), 1);
  assert.equal(client.listenerCount(Events.InteractionCreate), 1);
  assert.deepEqual(
    timers.map(([, delay]) => delay),
    [600_000, 60_000],
  );
  assert.deepEqual(commands.map((command) => command.name).sort(), [...commandNames].sort());
  assert.equal(commandDefinitions().length, 18);
  assert.ok(createClient().options.intents.has(GatewayIntentBits.GuildExpressions));
  assert.ok(createClient().options.partials.includes(Partials.GuildMember));
  const { settings } = await import('../src/features.js');
  assert.equal(settings('legacy-guild').roasts, false);
  assert.equal(settings('legacy-guild').photoBooth, true);
});

test('history is reachable and member attempts to edit it are denied', async () => {
  const view = interaction('lumira-history', 'list', { guildId: LUMIVIBE_GUILD_ID });
  await handleInteraction(view);
  assert.match(view.calls[0][1].content, /No .*history/i);
  const denied = interaction('lumira-history', 'add', { guildId: LUMIVIBE_GUILD_ID });
  await handleInteraction(denied);
  assert.match(denied.calls[0][1].content, /owner or moderator/i);
  assert.equal(denied.calls[0][1].flags, MessageFlags.Ephemeral);
});

test('admin command remains owner-only', async () => {
  const denied = interaction('lumira-admin', 'apply');
  await handleInteraction(denied);
  assert.match(denied.calls[0][1].content, /Only the server owner/);
  assert.equal(denied.calls[0][1].flags, MessageFlags.Ephemeral);
});

test('name and mentions address Lumira without treating Lumi or third-person remarks as commands', () => {
  for (const text of [
    'Lumira hello',
    'Hey, Lumira! hello',
    '<@99> hello',
    '<@!99>, hello',
    'hello there, Lumira?',
  ]) {
    assert.deepEqual(directAddress(text, '99'), {
      prompt: text.startsWith('hello there') ? 'hello there' : 'hello',
    });
  }
  assert.equal(directAddress('Hey Lumi!', '99'), null);
  assert.equal(directAddress('I saw Lumira', '99'), null);
  assert.equal(directAddress('Lumiram hello', '99'), null);
  assert.deepEqual(directAddress('one more thing', '99', false, true), { prompt: 'one more thing' });
});

test('member personas include the requested friends and Megu’s stable ID', () => {
  for (const name of ['Lumi', 'Gracie', 'Meat Shield Moonie'])
    assert.equal(socialStyle({ displayName: name }), 'girls');
  for (const name of ['Shug', 'Tee', 'Mits', 'Dante', 'Megu'])
    assert.equal(socialStyle({ displayName: name }), 'diva');
  assert.equal(socialStyle({ userId: '237586130038423552', displayName: 'renamed-account' }), 'diva');
});

test('two rapid direct turns are serialized, share context and respect roast-off and mute settings', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const payload = JSON.parse(options.body);
    prompts.push(payload.contents[0].parts[0].text);
    return responses();
  });
  const prompts = [],
    replies = [];
  process.env.GEMINI_API_KEY = 'fake-test-key';
  const guild = { id: LUMIVIBE_GUILD_ID, ownerId: 'owner', roles: { everyone: {} } };
  const message = {
    guild,
    guildId: guild.id,
    channelId: 'direct',
    channel: { guild },
    author: { username: 'Megu', id: '237586130038423552' },
    mentions: { users: new Map() },
    reply: async (payload) => {
      replies.push(payload);
    },
  };
  await setSetting(guild.id, 'roasts', false);
  await Promise.all([
    handleDirectChat({ ...message, content: 'Lumira hello there' }, '99'),
    handleDirectChat({ ...message, content: 'Hey, Lumira, roast me again' }, '99'),
  ]);
  assert.equal(replies.length, 2);
  assert.deepEqual(replies[1].allowedMentions, { parse: [], repliedUser: false });
  assert.match(prompts[1], /hello there/);
  assert.match(prompts[1], /Roasts are disabled/);
  assert.match(prompts[1], /affectionate, witty diva/);
  await setMemberMuted(guild.id, message.author.id, true);
  await handleDirectChat({ ...message, content: 'Lumira still here?' }, '99');
  assert.equal(replies.length, 2);
  await setMemberMuted(guild.id, message.author.id, false);
});

test('a text reply with mention disabled continues chat when it references Lumira', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => responses());
  const guild = { id: LUMIVIBE_GUILD_ID, ownerId: 'owner', roles: { everyone: {} } };
  const replies = [];
  const message = {
    guild,
    guildId: guild.id,
    channelId: 'reply',
    channel: { guild },
    author: { username: 'Gracie', id: 'other-member' },
    content: 'I have a follow-up.',
    reference: { messageId: 'earlier' },
    mentions: { users: new Map() },
    fetchReference: async () => ({ author: { id: '99' } }),
    reply: async (payload) => replies.push(payload),
  };
  assert.equal(await handleDirectChat(message, '99'), true);
  assert.equal(replies.length, 1);
});

test('a public conversation opening after a quiet stretch can qualify with one message', () => {
  const now = 100_000_000,
    opportunity = {
      now,
      history: [{ author: 'member', text: 'The kitchen has entered its villain era' }],
      lastMessage: now - 60 * 60_000,
      thread: null,
      lastSpoke: 0,
      lastEvaluated: 0,
      publicChannel: true,
    };
  assert.equal(passiveOpportunity(opportunity).quiet, true);
  assert.equal(passiveOpportunity({ ...opportunity, publicChannel: false }), null);
  assert.equal(passiveOpportunity({ ...opportunity, lastMessage: now - 100 }), null);
});

test('emoji reactions avoid distress, private channels, and concurrent repeat reactions', async (t) => {
  t.mock.method(Math, 'random', () => 0);
  const guild = { id: LUMIVIBE_GUILD_ID, roles: { everyone: {} } };
  const channel = { guild, permissionsFor: () => ({ has: () => true }) };
  const results = [];
  const message = {
    guildId: guild.id,
    channelId: 'reaction-test',
    channel,
    author: { id: 'friend' },
    content: 'that was so funny lol',
    react: async (emoji) => {
      results.push(emoji);
      await waitTurn();
    },
  };
  await Promise.all([socialReaction(message), socialReaction(message)]);
  await socialReaction({ ...message, channelId: 'another', content: 'I am upset and crying lol' });
  await socialReaction({
    ...message,
    channelId: 'private',
    channel: { ...channel, type: ChannelType.PrivateThread },
  });
  assert.deepEqual(results, ['😭']);
  assert.equal(publicSocialChannel({ ...channel, type: ChannelType.PrivateThread }), false);
});

test('Tee can request a playful roast of Mitsuto by mention, and the roast switch still applies', async (t) => {
  const { friendRoastTarget } = await import('../src/social-persona.js');
  for (const name of ['Tee', 'Shug', 'Mitsuto', 'Megu', 'Dante', 'Kiz']) {
    assert.equal(friendRoastTarget('roast ' + name)?.name, name);
  }
  assert.equal(friendRoastTarget('roast Gracie for Tee'), null);
  assert.equal(friendRoastTarget('do not roast Tee'), null);
  const prompts = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    prompts.push(JSON.parse(options.body).contents[0].parts[0].text);
    return responses();
  });
  const guild = { id: LUMIVIBE_GUILD_ID, ownerId: 'owner', roles: { everyone: {} } };
  const message = {
    guild,
    guildId: guild.id,
    channelId: 'friend-roasts',
    channel: { guild },
    author: { id: 'tee', username: 'Tee' },
    mentions: {
      users: new Map([
        ['99', { id: '99' }],
        ['1495189750162657400', { id: '1495189750162657400', username: 'Mitsuto' }],
      ]),
    },
    content: '<@99> make fun of <@1495189750162657400> for me',
    reply: async ({ allowedMentions }) => assert.deepEqual(allowedMentions, { parse: [], repliedUser: false }),
  };
  await setSetting(guild.id, 'roasts', true);
  await handleDirectChat(message, '99');
  assert.match(prompts[0], /roast directed at Mitsuto only/i);
  await setMemberMuted(guild.id, '1495189750162657400', true);
  await handleDirectChat(message, '99');
  assert.equal(prompts.length, 1);
  await setMemberMuted(guild.id, '1495189750162657400', false);
  await setSetting(guild.id, 'roasts', false);
  await handleDirectChat(message, '99');
  assert.match(prompts[1], /Roasts are disabled/);
});

test('the boys can request affectionate teasing of Lumi, Gracie, and Moonie without changing other roast rules', async (t) => {
  const { gentleTeaseTarget } = await import('../src/social-persona.js');
  const tee = { userId: 'tee', username: 'Tee' };
  const ownerId = 'lumi-id';
  for (const name of ['Lumi', 'Gracie', 'Moonie']) {
    assert.equal(gentleTeaseTarget('tease ' + name, null, null, tee, ownerId)?.name, name);
  }
  assert.equal(gentleTeaseTarget('tease <@lumi-id>', null, null, tee, ownerId), null);
  assert.equal(gentleTeaseTarget('tease <@123>', null, null, tee, '123')?.name, 'Lumi');
  assert.equal(
    gentleTeaseTarget('tease <@456>', new Map([['456', { username: 'Gracie' }]]), null, tee, ownerId)?.name,
    'Gracie',
  );
  assert.equal(
    gentleTeaseTarget('tease Lumi', null, null, { userId: 'stranger', username: 'Stranger' }, ownerId),
    null,
  );
  const prompts = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    prompts.push(JSON.parse(options.body).contents[0].parts[0].text);
    return responses();
  });
  const guild = { id: LUMIVIBE_GUILD_ID, ownerId, roles: { everyone: {} } };
  const message = {
    guild,
    guildId: guild.id,
    channelId: 'gentle-tease',
    channel: { guild },
    author: { id: tee.userId, username: tee.username },
    mentions: { users: new Map() },
    content: 'Lumira make fun of Lumi for me',
    reply: async ({ allowedMentions }) => assert.deepEqual(allowedMentions, { parse: [], repliedUser: false }),
  };
  await setSetting(guild.id, 'roasts', true);
  await handleDirectChat(message, '99');
  assert.match(prompts[0], /GIRLS’ GIRL TEASING/);
  await setMemberMuted(guild.id, ownerId, true);
  await handleDirectChat(message, '99');
  assert.equal(prompts.length, 1);
  await setMemberMuted(guild.id, ownerId, false);
  await setSetting(guild.id, 'roasts', false);
  await handleDirectChat(message, '99');
  assert.match(prompts[1], /Roasts are disabled/);
});

test('Moonie’s self-mention cannot turn into a roast of Tee', async (t) => {
  const { gentleTeaseTarget } = await import('../src/social-persona.js');
  const moonie = { userId: '123', username: 'Moonie' };
  assert.deepEqual(gentleTeaseTarget('roast me', null, null, moonie, 'owner'), { name: 'Moonie', id: '123' });
  const replies = [];
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    requests.push(JSON.parse(options.body).contents[0].parts[0].text);
    return Response.json({
      candidates: [{ content: { parts: [{ text: 'Tee, your build needs a tutorial.' }] } }],
    });
  });
  const guild = { id: LUMIVIBE_GUILD_ID, ownerId: 'owner', roles: { everyone: {} } };
  await setSetting(guild.id, 'roasts', true);
  await handleDirectChat(
    {
      guild,
      guildId: guild.id,
      channelId: 'self-mention',
      channel: { guild },
      author: { id: '123', username: 'Moonie' },
      mentions: {
        users: new Map([
          ['99', { id: '99' }],
          ['123', { id: '123' }],
        ]),
      },
      content: '<@99> roast <@123>',
      reply: async (payload) => replies.push(payload),
    },
    '99',
  );
  assert.match(requests[0], /GIRLS’ GIRL TEASING.*Moonie/);
  assert.match(replies[0].content, /^Moonie,/);
  assert.doesNotMatch(replies[0].content, /Tee/);
  assert.deepEqual(replies[0].allowedMentions, { parse: [], repliedUser: false });
});

test('Diva Court responds once using the deferred interaction, including on provider failure', async (t) => {
  process.env.GEMINI_API_KEY = 'fake-test-key';
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => responses());
  const court = () =>
    interaction('lumira-play', 'court', {
      options: { getSubcommand: () => 'court', getString: () => 'Someone ate the last cookie' },
    });
  const success = court();
  await handleInteraction(success);
  assert.deepEqual(
    success.calls.map(([kind]) => kind),
    ['defer', 'edit'],
  );
  assert.match(success.calls[1][1].content, /Lumira reply/);
  fetchMock.mock.mockImplementation(async () => new Response('{}', { status: 404 }));
  const unsuccessful = court();
  await handleInteraction(unsuccessful);
  assert.deepEqual(
    unsuccessful.calls.map(([kind]) => kind),
    ['defer', 'edit'],
  );
  assert.match(unsuccessful.calls[1][1].content, /Game unavailable/);
  assert.match(courtPrompt('Someone ate the last cookie'), /DIVA COURT/);
});

test('roast battles honor the kill switch, keep comebacks, and roll back failed rounds', async () => {
  await setSetting('test-community', 'roasts', false);
  const blocked = interaction('lumira-play', 'roast');
  await handleInteraction(blocked);
  assert.match(blocked.calls[0][1].content, /disabled/);
  await assert.rejects(
    roastRound('games', 'chat', 'a', '', async () => {
      throw Error('provider down');
    }),
    /provider down/,
  );
  const answer = await roastRound(
    'games',
    'chat',
    'b',
    'Your crown is on backwards!',
    async (round) => round.prompt,
  );
  assert.match(answer, /ROUND 1/);
  assert.match(answer, /crown is on backwards/);
  assert.throws(() => roastRound('games', 'chat', 'a'), /has the stage/);
});

test('Who Said That prevents round overwrites and lets the host or a moderator reveal', (t) => {
  t.mock.method(Math, 'random', () => 0);
  quoteSubmit('games', 'quotes', 'a', 'The cookie court is now in session.');
  quoteSubmit('games', 'quotes', 'b', 'Sprite is a soup in the summer.');
  assert.throws(() => quoteSubmit('games', 'quotes', 'b', 'Sprite is a soup in the summer.'), /already/);
  assert.match(quoteRound('games', 'quotes', 'host').quote, /cookie court/);
  assert.throws(() => quoteRound('games', 'quotes', 'someone'), /already active/);
  assert.throws(() => revealQuote('games', 'quotes', 'someone'), /host or a moderator/);
  assert.equal(guessQuote('games', 'quotes', 'b').correct, false);
  assert.equal(guessQuote('games', 'quotes', 'a').correct, true);
  quoteRound('games', 'quotes', 'host');
  assert.equal(revealQuote('games', 'quotes', 'mod', true), 'a');
});

test('temporary reminder errors are retried, one failure does not block the next event, and existing records load', async () => {
  const legacy = { channel: 'first', title: 'First event', when: Date.now() - 1_000, sent: false };
  const second = { channel: 'second', title: 'Second event', when: legacy.when, sent: false };
  await writeFile(path.join(directory, 'events.json'), JSON.stringify({ guild: { events: [legacy, second] } }));
  await loadEvents();
  const delivered = [];
  let attempts = 0;
  const client = {
    channels: {
      fetch: async (id) => ({
        guildId: 'guild',
        isTextBased: () => true,
        send: async (payload) => {
          if (id === 'first' && ++attempts === 1) throw Error('transient');
          delivered.push([id, payload]);
        },
      }),
    },
  };
  const tick = createReminderDelivery(client, { channelAllowed: () => true, publicSocialChannel: () => true });
  await Promise.all([tick(), tick()]);
  assert.deepEqual(
    delivered.map(([id]) => id),
    ['second'],
  );
  assert.equal(dueEvents().length, 1);
  await tick();
  assert.deepEqual(
    delivered.map(([id]) => id),
    ['second', 'first'],
  );
  assert.ok(delivered.every(([, payload]) => payload.enforceNonce && payload.allowedMentions.parse.length === 0));
  assert.equal(dueEvents().length, 0);
  await loadEvents();
  assert.equal(dueEvents().length, 0);
});

test('legacy user-edited and opted-out profiles stay untouched and Megu’s card keeps its linked avatar', async () => {
  const guildId = 'card-test';
  let mutating = 0;
  const megu = {
    id: '237586130038423552',
    username: 'Megu',
    displayAvatarURL: () => 'https://example.test/megu.png',
  };
  const channel = {
    name: 'cards',
    isTextBased: () => true,
    client: { user: { id: '99' } },
    messages: {
      fetch: async (id) => ({
        id,
        author: { id: '99' },
        edit: async (payload) => {
          mutating++;
          await savePayload(payload);
        },
      }),
    },
    send: async (payload) => {
      await savePayload(payload);
      return { id: String(++mutating) };
    },
  };
  const guild = {
    id: guildId,
    channels: { fetch: async () => [channel] },
    client: {
      user: { id: '99' },
      users: { fetch: async (id) => (id === megu.id ? megu : Promise.reject(Error('no such member'))) },
    },
  };
  const embeds = [];
  const savePayload = async (payload) => embeds.push(payload.embeds[0].toJSON());
  await setProfile(guild.id, 'regular', { about: 'My custom bio', messageId: '42', automatic: false });
  await setProfile(guild.id, 'opt-out', { optedOut: true });
  const result = await populateMemberProfiles(guild, {
    members: { regular: { id: 'regular' }, out: { id: 'opt-out' } },
  });
  assert.equal(result.skipped, 2);
  assert.equal(mutating, 0);
  await publishCuratedCards(guild);
  assert.equal(profile(guild.id, megu.id).curated, true);
  assert.match(profile(guild.id, megu.id).about, /competitive gamer/);
  assert.ok(embeds.some((embed) => embed.title.includes('Megu') && embed.thumbnail?.url.endsWith('megu.png')));
});

test('image classifier sends actual PNG bytes without passing the old name to the model', async () => {
  const raw = await sharp({ create: { width: 12, height: 8, channels: 3, background: 'yellow' } })
    .png()
    .toBuffer();
  const emoji = {
    name: 'animal_wrong_old_name',
    animated: false,
    imageURL: (opts) => {
      assert.equal(opts.extension, 'png');
      return 'https://cdn.example.test/1.png';
    },
  };
  const result = await classifyEmoji(emoji, {
    key: 'fake',
    request: async (url, options) => {
      if (!options.method) return new Response(raw);
      assert.ok(!options.body.includes(emoji.name));
      const payload = JSON.parse(options.body);
      const { mimeType, data } = payload.contents[0].parts[1].inlineData;
      assert.equal(mimeType, 'image/png');
      assert.equal((await sharp(Buffer.from(data, 'base64')).metadata()).width, 128);
      return new Response(
        JSON.stringify({
          candidates: [
            {
              content: { parts: [{ text: '{"category":"pika","subject":"Pikachu smirking","confidence":0.98}' }] },
            },
          ],
        }),
      );
    },
  });
  assert.deepEqual(result, { category: 'pika', subject: 'pikachu_smirking', confidence: 0.98 });
});

test('visual batch renames legacy errors, resolves duplicate current names, and leaves managed emojis alone', async () => {
  const edits = [];
  const emoji = (id, name, managed = false) => ({
    id,
    name,
    managed,
    async edit({ name: target }) {
      edits.push([id, target]);
      this.name = target;
    },
  });
  const items = [
    emoji('1', 'pika_pikachu_wave'),
    emoji('2', 'pika_pikachu_wave'),
    emoji('3', 'managed', true),
    emoji('4', 'meme_wrong'),
  ];
  const data = { 'test-emojis': { 4: { status: 'verified', name: 'meme_wrong' } } };
  const storage = { load: async () => data, save: async () => {} };
  const guild = {
    id: 'test-emojis',
    members: { fetchMe: async () => ({ permissions: { has: () => true } }) },
    emojis: { fetch: async () => items },
  };
  const organize = createEmojiOrganizer({
    storage,
    wait: async () => {},
    hasKey: () => true,
    classify: async (e) =>
      e.id === '4'
        ? { category: 'unknown', confidence: 0, subject: '' }
        : { category: 'pika', subject: 'pikachu_wave', confidence: 0.99 },
  });
  const first = await organize(guild);
  assert.equal(first.scanned, 3);
  assert.equal(first.review, 1);
  assert.deepEqual(edits, [['1', 'pika_pikachu_wave_2']]);
  assert.equal(new Set(items.map((e) => e.name)).size, 4);
  const second = await organize(guild);
  assert.equal(second.scanned, 0);
  assert.equal(second.skipped, 4);
});

test('an emoji rate limit keeps resumable work and avoids reclassifying the same asset', async () => {
  const data = {};
  const storage = { load: async () => data, save: async () => {} };
  let attempts = 0;
  let scans = 0;
  const item = {
    id: '1',
    name: 'meme_old',
    async edit({ name }) {
      if (++attempts === 1) throw Object.assign(Error('rate limit'), { status: 429 });
      this.name = name;
    },
  };
  const guild = {
    id: 'retry-emoji',
    members: { fetchMe: async () => ({ permissions: { has: () => true } }) },
    emojis: { fetch: async () => [item] },
  };
  const organize = createEmojiOrganizer({
    storage,
    wait: async () => {},
    hasKey: () => true,
    classify: async () => {
      scans++;
      return { category: 'text', subject: 'nice', confidence: 0.99 };
    },
  });
  assert.equal((await organize(guild)).paused, true);
  assert.equal((await organize(guild)).renamed, 1);
  assert.equal(item.name, 'text_nice');
  assert.equal(scans, 1);
});

test('persistent writes are serialized and a broken store is not replaced silently', async () => {
  const store = jsonStore('regression-store.json');
  assert.deepEqual(await store.load(), {});
  await Promise.all([store.save({ value: 1 }), store.save({ value: 2 })]);
  assert.deepEqual(JSON.parse(await readFile(path.join(directory, 'regression-store.json'), 'utf8')), {
    value: 2,
  });
  await writeFile(path.join(directory, 'memories.json'), 'corrupt json');
  await assert.rejects(loadMemories(), /Could not read memories.json/);
});

test('the Railway-compatible native image dependency renders truncated text containing XML special characters', async () => {
  const asset = await renderCard({
    title: 'a'.repeat(29) + '&&&&&',
    subtitle: 'b'.repeat(46) + '<tag>',
    lines: ['Rock & roll'],
  });
  assert.equal((await sharp(asset.attachment).metadata()).format, 'png');
});

test('animated emoji previews send three distinct sampled frames', async () => {
  const { emojiPreview } = await import('../src/emoji-classifier.js');
  // Three 2x2 frames in red, green, and blue.
  const gif = Buffer.from(
    'R0lGODlhAgACAIEAAP8AAAAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh+QQACgAAACwAAAAAAgACAAAIBgABCAQQEAAh+QQBCgABACwAAAAAAgACAIEAgAAAAAAAAAAAAAAIBgABCAQQEAAh+QQBCgABACwAAAAAAgACAIEAAP8AAAAAAAAAAAAIBgABCAQQEAA7',
    'base64',
  );
  const image = await emojiPreview(gif, true);
  const { data, info } = await sharp(image).raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 384);
  const pixel = (x) => Array.from(data.subarray(4 * (64 * info.width + x), 4 * (64 * info.width + x) + 3));
  assert.deepEqual(pixel(64), [255, 0, 0]);
  assert.deepEqual(pixel(192), [0, 128, 0]);
  assert.deepEqual(pixel(320), [0, 0, 255]);
});

test('private access revocation clears only the reviewed member’s view override', async () => {
  const { applyGuild, privateAccess, stage } = await import('../src/admin.js');
  const guildId = 'permissions-test';
  await privateAccess(guildId, 'private', 'member', true);
  await privateAccess(guildId, 'private', 'member', false);
  await stage(guildId, { type: 'permissions' });
  const overwrites = [];
  const permissions = { bitfield: 1n, has: () => true };
  const channel = {
    permissionOverwrites: {
      cache: new Map([
        ['member', true],
        ['unrelated-member', true],
      ]),
      edit: async (id, change) => overwrites.push([id, change]),
    },
  };
  const highest = { position: 100 };
  const role = { position: 1, members: new Map(), setPermissions: async () => {} };
  const guild = {
    id: guildId,
    ownerId: 'owner',
    members: { fetchMe: async () => ({ id: 'bot', permissions, roles: { highest } }) },
    roles: { everyone: { id: guildId, permissions, setPermissions: async () => {} }, cache: { find: () => role } },
    channels: { fetch: async () => channel },
  };
  assert.deepEqual(await applyGuild(guild), { channels: 1 });
  assert.ok(overwrites.some(([id, change]) => id === 'member' && change.ViewChannel === null));
  assert.ok(!overwrites.some(([id]) => id === 'unrelated-member'));
});
