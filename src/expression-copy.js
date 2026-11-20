import { AttachmentBuilder, MessageFlags, PermissionFlagsBits, StickerFormatType } from 'discord.js';
import { config } from './admin-state.js';
import { LUMIVIBE_GUILD_ID } from './channels.js';

const messageLink =
  /^https:\/\/(?:(?:canary|ptb)\.)?discord(?:app)?\.com\/channels\/(\d+)\/(\d+)\/(\d+)\/?(?:\?[^#]*)?$/i;
const cdnLink =
  /^https:\/\/(?:cdn\.discordapp\.com|media\.discordapp\.net)\/(emojis|stickers)\/(\d+)(?:\.(png|webp|gif|json))?(?:\?[^#]*)?$/i;
const emojiPattern = /<(a?):([a-z0-9_]{2,32}):(\d+)>/gi;
const activeCopies = new Set();

function emojiFromMarkup(match) {
  const [, animated, name, id] = match;
  return { id, name, animated: Boolean(animated) };
}

async function readSourceMessage(client, userId, [, guildId, channelId, messageId]) {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (channel?.guildId !== guildId || !channel.messages?.fetch)
    throw Error('Lumira cannot read that channel. Use a sticker ID or a custom emoji code instead.');
  const member = await channel.guild.members.fetch(userId).catch(() => null);
  if (
    !member ||
    !channel.permissionsFor(member)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory])
  )
    throw Error('You need access to read the source channel.');
  const message = await channel.messages.fetch(messageId).catch(() => null);
  if (!message) throw Error('Lumira could not read that message. Check the link and her channel permissions.');
  return message;
}

export async function resolveExpressionSource(client, kind, input, userId) {
  const source = input.trim().replace(/^<(https:\/\/[^<>]+)>$/i, '$1');
  const link = source.match(messageLink);
  if (link) {
    const message = await readSourceMessage(client, userId, link);
    if (kind === 'sticker') {
      const { stickers } = message;
      if (stickers.size !== 1) throw Error('Link to a message with one sticker or enter its sticker ID.');
      return stickers.first();
    }
    const found = [
      ...new Map(
        [...message.content.matchAll(emojiPattern)].map((match) => [match[3], emojiFromMarkup(match)]),
      ).values(),
    ];
    if (found.length !== 1) throw Error('Link to a message with one custom emoji or enter its emoji code.');
    return found[0];
  }
  if (kind === 'emoji') {
    const markup = [...source.matchAll(emojiPattern)].find((match) => match[0] === source);
    if (markup) return emojiFromMarkup(markup);
  }
  const cdn = source.match(cdnLink);
  const id = /^\d{16,22}$/.test(source) ? source : cdn?.[1].toLowerCase() === kind + 's' ? cdn[2] : null;
  if (!id) throw Error('Use a Discord message link, ' + kind + ' ID, or Discord CDN link.');
  if (kind === 'sticker') {
    return client.fetchSticker(id).catch(() => {
      throw Error('Discord could not find that sticker ID.');
    });
  }
  return { id, name: 'emoji_' + id, animated: cdn?.[3]?.toLowerCase() === 'gif' ? true : undefined };
}

const formatExtensions = {
  [StickerFormatType.PNG]: 'png',
  [StickerFormatType.APNG]: 'png',
  [StickerFormatType.GIF]: 'gif',
  [StickerFormatType.Lottie]: 'json',
};

async function readAsset(response, limit) {
  if (!response.ok) throw Error('Discord could not supply the original image (HTTP ' + response.status + ').');
  if (Number(response.headers.get('content-length')) > limit)
    throw Error('That image exceeds Discord’s upload limit.');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > limit) throw Error('That image is empty or exceeds Discord’s upload limit.');
  return bytes;
}

export async function copyExpression(guild, kind, source, customName, { request = fetch } = {}) {
  const sticker = kind === 'sticker';
  const maxName = sticker ? 30 : 32;
  const name =
    customName?.trim() ||
    (sticker
      ? source.name?.trim().slice(0, maxName)
      : source.name?.replace(/[^a-z0-9_]/gi, '_').slice(0, maxName));
  if (!name || name.length < 2 || name.length > maxName || (!sticker && !/^[a-z0-9_]+$/i.test(name)))
    throw Error(
      sticker
        ? 'Choose a sticker name between 2 and 30 characters.'
        : 'Choose 2–32 letters, digits or underscores for the emoji name.',
    );
  const manager = sticker ? guild.stickers : guild.emojis;
  const key = guild.id + ':' + kind + ':' + name.toLowerCase();
  if (activeCopies.has(key)) throw Error('A copy with that name is already in progress.');
  activeCopies.add(key);
  try {
    const existing = await manager.fetch();
    if (existing.some((item) => item.name.toLowerCase() === name.toLowerCase()))
      throw Error('That name is already taken. Enter a different name to copy it.');
    const fetchAsset = (url) => request(url, { signal: AbortSignal.timeout(10_000) });
    const reason = 'Owner-authorized Lumira ' + kind + ' copy';
    if (sticker) {
      const extension = formatExtensions[source.format];
      if (!extension) throw Error('This sticker has an unsupported format.');
      if (
        extension === 'json' &&
        !guild.features?.some((feature) => feature === 'VERIFIED' || feature === 'PARTNERED')
      )
        throw Error('Discord allows Lottie sticker uploads only on verified or partnered servers.');
      const assetUrl = source.url || 'https://cdn.discordapp.com/stickers/' + source.id + '.' + extension;
      const bytes = await readAsset(await fetchAsset(assetUrl), 512 * 1024);
      return await manager.create({
        name,
        file: new AttachmentBuilder(bytes, { name: 'sticker.' + extension }),
        tags: source.tags || '🦋',
        description: source.description || 'Copied by Lumira',
        reason,
      });
    }
    const base = 'https://cdn.discordapp.com/emojis/' + source.id;
    let response = await fetchAsset(base + (source.animated === false ? '.png' : '.gif'));
    if (source.animated === undefined && [400, 404, 415].includes(response.status))
      response = await fetchAsset(base + '.png');
    const bytes = await readAsset(response, 256 * 1024);
    return await manager.create({ attachment: bytes, name, reason });
  } finally {
    activeCopies.delete(key);
  }
}

export async function copyExpressionCommand(interaction) {
  const kind = interaction.options.getSubcommand();
  if (!interaction.inGuild() || interaction.guildId !== LUMIVIBE_GUILD_ID)
    return interaction.reply({ content: 'This command is available in LumiVibe.', flags: MessageFlags.Ephemeral });
  const authorized = config(interaction.guildId)[kind === 'sticker' ? 'stickerManagers' : 'emojiManagers'];
  if (interaction.user.id !== interaction.guild.ownerId && !authorized.includes(interaction.user.id))
    return interaction.reply({
      content: 'The server owner can authorize you to copy this type of expression.',
      flags: MessageFlags.Ephemeral,
    });
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const bot = await interaction.guild.members.fetchMe();
    if (!bot.permissions.has(PermissionFlagsBits.CreateGuildExpressions))
      throw Error('Lumira needs the Create Expressions permission.');
    const source = await resolveExpressionSource(
      interaction.client,
      kind,
      interaction.options.getString('source', true),
      interaction.user.id,
    );
    const copied = await copyExpression(interaction.guild, kind, source, interaction.options.getString('name'));
    return interaction.editReply({
      content: 'Copied ' + kind + ' **' + copied.name + '** into LumiVibe. 💙',
      allowedMentions: { parse: [] },
    });
  } catch (error) {
    const message =
      error.code === 30008 || error.code === 30039
        ? 'LumiVibe has reached its Discord ' + kind + ' limit.'
        : error.message;
    return interaction.editReply({
      content: 'Could not copy the ' + kind + '. ' + message,
      allowedMentions: { parse: [] },
    });
  }
}
