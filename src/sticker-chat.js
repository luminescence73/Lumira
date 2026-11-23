import { PermissionFlagsBits } from 'discord.js';
import { authorize, config, imageForSticker } from './admin.js';
import { LUMIVIBE_GUILD_ID } from './channels.js';

export async function handleStickerChat(message, client) {
  if (
    !message.inGuild() ||
    message.guildId !== LUMIVIBE_GUILD_ID ||
    message.author.bot ||
    !message.mentions.users.has(client.user.id)
  )
    return;
  const body = (message.content || '')
    .replace(/<@!?\d+>/g, '')
    .trim()
    .toLowerCase();
  const owner = message.author.id === message.guild.ownerId;
  const managers = config(message.guildId).stickerManagers || [];
  if (owner && /^(allow|authorize) stickers?/.test(body)) {
    const target = message.mentions.users.filter((u) => u.id !== client.user.id).first();
    if (!target)
      return message.reply({
        content: 'Mention the person you want to authorize, such as @Lumira allow stickers @Gracie.',
        allowedMentions: { repliedUser: false },
      });
    await authorize(message.guildId, 'sticker', target.id, true);
    return message.reply({
      content:
        '🔐 ' + target.username + ' can now ask me to import stickers. No server-wide sticker permission granted.',
      allowedMentions: { parse: [] },
    });
  }
  if (owner && /^(revoke|remove) sticker access/.test(body)) {
    const target = message.mentions.users.filter((u) => u.id !== client.user.id).first();
    if (!target)
      return message.reply({
        content: 'Mention the member whose sticker access you want to revoke.',
        allowedMentions: { parse: [] },
      });
    await authorize(message.guildId, 'sticker', target.id, false);
    return message.reply({
      content: 'Sticker import access revoked for ' + target.username + '.',
      allowedMentions: { parse: [] },
    });
  }
  if (!/^(save|import|add) sticker/.test(body)) return;
  if (!owner && !managers.includes(message.author.id))
    return message.reply({
      content: 'Only the owner or someone they authorize can import stickers.',
      allowedMentions: { repliedUser: false },
    });
  try {
    const me = await message.guild.members.fetchMe();
    if (!me.permissions.has(PermissionFlagsBits.ManageGuildExpressions))
      throw Error('Lumira needs Manage Expressions permission.');
    let source = message;
    if (!source.stickers.size && !source.attachments.size && message.reference?.messageId)
      source = await message.channel.messages.fetch(message.reference.messageId);
    const sticker = source.stickers.first(),
      attachment = source.attachments.find((a) => a.contentType?.startsWith('image/'));
    if (!sticker && !attachment)
      throw Error('Attach a PNG/WebP image or reply to a message containing a sticker.');
    const name = ('lumi_' + (sticker?.name || attachment?.name?.replace(/\.[^.]+$/, '') || 'sticker'))
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .slice(0, 30);
    const existing = await message.guild.stickers.fetch();
    if (existing.some((s) => s.name.toLowerCase() === name.toLowerCase()))
      throw Error('A sticker with that name already exists.');
    const url = sticker?.url || attachment.url;
    if (!url || sticker?.format === 3) throw Error('Lottie stickers are not supported for direct import.');
    const data = await imageForSticker(url);
    const created = await message.guild.stickers.create({
      file: data,
      name,
      description: 'Imported by Lumira',
      tags: '🦋',
      reason: 'Authorized sticker import',
    });
    return message.reply({
      content: '🦋 Sticker **' + created.name + '** added to LumiVibe!',
      allowedMentions: { parse: [] },
    });
  } catch (e) {
    console.error('Sticker import failed:', e.message);
    return message.reply({ content: 'Could not import sticker: ' + e.message, allowedMentions: { parse: [] } });
  }
}
