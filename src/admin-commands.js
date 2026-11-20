import { emojiReview } from './emoji-visual.js';
import { LUMIVIBE_GUILD_ID } from './channels.js';
import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import {
  authorize,
  privateAccess,
  stage,
  discard,
  proposals,
  preview,
  applyGuild,
  layoutPreview,
  makeChannel,
  imageForEmoji,
  imageForSticker,
  layoutPlan,
  applyLayout,
} from './admin.js';
import { syncRoster, roster, findMembers } from './roster.js';
export async function adminCommand(interaction) {
  if (!interaction.inGuild() || interaction.guild.ownerId !== interaction.user.id)
    return interaction.reply({
      content: 'Only the server owner can administer LumiVibe.',
      flags: MessageFlags.Ephemeral,
    });
  const g = interaction.guildId,
    sub = interaction.options.getSubcommand();
  try {
    if (sub === 'emoji-review') {
      if (g !== LUMIVIBE_GUILD_ID) throw Error('Visual emoji organization is only enabled in LumiVibe.');
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const report = await emojiReview(interaction.guild);
      return interaction.editReply({
        content: [
          '**Visual emoji organization**',
          'Image-verified ' + report.verified + ' • pending ' + report.pending + ' • managed ' + report.managed,
          'Needs another image pass ' + report.review.length,
          ...report.review.slice(0, 30).map((name) => '`:' + name + ':`'),
        ].join('\n'),
        allowedMentions: { parse: [] },
      });
    }
    if (sub === 'audit') {
      const changes = preview(interaction.guild);
      await stage(g, { type: 'permissions' });
      return interaction.reply({
        content:
          '🔐 **Permission preview**\n' +
          (changes.join('\n') || 'Baseline permissions already appear restricted.') +
          '\n**Important:** Existing elevated roles, channel overrides and Discord Administrator permission can bypass these defaults. /lumira-admin apply will change the @everyone baseline and explicitly configured private channels only. Sticker and emoji creation share a Discord permission; authorized creators may be able to create both.\nUse /lumira-admin apply to confirm.',
        flags: MessageFlags.Ephemeral,
      });
    }
    if (sub === 'apply') {
      const p = proposals(g);
      if (!p || p.type !== 'permissions' || Date.now() - p.createdAt > 60 * 60000)
        throw Error('Run /lumira-admin audit within 60 minutes first.');
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const result = await applyGuild(interaction.guild);
      return interaction.editReply(
        '🔐 Applied baseline restrictions and ' +
          result.channels +
          ' explicitly configured private channels. Review elevated roles and overrides manually for any bypasses.',
      );
    }
    if (sub === 'redesign') {
      const lines = layoutPlan(interaction.guild);
      await stage(g, { type: 'redesign' });
      return interaction.reply({
        content:
          '🦋 **Planned LumiVibe redesign**\n' +
          lines.join('\n') +
          '\nExisting channel messages and channel-specific permissions are preserved. Unmatched channels are not deleted. New private categories will be hidden from @everyone. Review carefully, then run /lumira-admin redesign-apply within 60 minutes.',
        flags: MessageFlags.Ephemeral,
      });
    }
    if (sub === 'redesign-apply') {
      const p = proposals(g);
      if (!p || p.type !== 'redesign' || Date.now() - p.createdAt > 15 * 60000)
        throw Error('Run /lumira-admin redesign first, then apply within 15 minutes.');
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const result = await applyLayout(interaction.guild);
      await discard(g);
      return interaction.editReply(
        '🦋 LumiVibe redesign applied. ' +
          (result.length ? result.join('; ') : 'Existing channels reorganized.') +
          ' Unmatched channels were preserved.',
      );
    }
    if (sub === 'layout') {
      const rows = layoutPreview(interaction.guild);
      return interaction.reply({
        content:
          '🗂️ **Current channel layout**\n' +
          rows
            .slice(0, 35)
            .map((x) => (x.category ? '[' + x.category + '] ' : '') + x.name)
            .join('\n') +
          '\nPreview only. No channel moved or renamed.',
        flags: MessageFlags.Ephemeral,
      });
    }
    if (sub === 'cleanup') {
      const channels = layoutPreview(interaction.guild),
        seen = new Set(),
        duplicates = [];
      for (const x of channels) {
        const k = x.category + ':' + x.name;
        if (seen.has(k)) duplicates.push(x.name);
        seen.add(k);
      }
      return interaction.reply({
        content:
          '🧹 **Cleanup preview**\nDuplicate names in same category: ' +
          (duplicates.join(', ') || 'None detected') +
          '\nNo channels were deleted.',
        flags: MessageFlags.Ephemeral,
      });
    }
    if (sub === 'authorize') {
      const user = interaction.options.getUser('member'),
        kind = interaction.options.getString('permission'),
        allow = interaction.options.getBoolean('allow');
      await authorize(g, kind, user.id, allow);
      return interaction.reply({
        content:
          (allow ? 'Saved authorization for ' : 'Revoked authorization for ') +
          user.username +
          ' (' +
          kind +
          '). Run /lumira-admin audit then apply to enforce role permissions.',
        flags: MessageFlags.Ephemeral,
      });
    }
    if (sub === 'private') {
      const channel = interaction.options.getChannel('channel'),
        user = interaction.options.getUser('member'),
        allow = interaction.options.getBoolean('allow');
      if (channel.guildId !== g) throw Error('Channel must be in this server');
      await privateAccess(g, channel.id, user.id, allow);
      return interaction.reply({
        content:
          'Private access preference saved for ' +
          user.username +
          ' in ' +
          channel.name +
          '. Run audit then apply to enforce.',
        flags: MessageFlags.Ephemeral,
      });
    }
    if (['rename', 'move', 'position', 'topic'].includes(sub)) {
      const channel = interaction.options.getChannel('channel');
      if (channel.guildId !== g || channel.isThread?.()) throw Error('Choose a server channel, not a thread');
      const me = await interaction.guild.members.fetchMe();
      if (!me.permissionsIn(channel).has(PermissionFlagsBits.ManageChannels))
        throw Error('Lumira needs Manage Channels');
      if (sub === 'rename') {
        const name = interaction.options.getString('name');
        if (name.length > 100 || name.length < 1) throw Error('Name must be 1–100 characters');
        await channel.setName(name, 'Lumira owner-requested rename');
        return interaction.reply({ content: 'Renamed channel to ' + name, flags: MessageFlags.Ephemeral });
      }
      if (sub === 'move') {
        const parent = interaction.options.getChannel('category');
        if (parent.guildId !== g || parent.type !== 4 || channel.type === 4)
          throw Error('Select a category and a non-category channel');
        const sync = interaction.options.getBoolean('sync_permissions') === true;
        await channel.setParent(parent.id, {
          lockPermissions: sync,
          reason: 'Lumira owner-requested channel move',
        });
        return interaction.reply({
          content:
            'Moved ' +
            channel.name +
            ' into ' +
            parent.name +
            '. Permissions ' +
            (sync ? 'synced to destination' : 'preserved') +
            '.',
          flags: MessageFlags.Ephemeral,
        });
      }
      if (sub === 'position') {
        const position = interaction.options.getInteger('position');
        await channel.setPosition(position - 1, { reason: 'Lumira owner-requested channel reorder' });
        return interaction.reply({
          content: 'Moved ' + channel.name + ' to position ' + position + ' within its section.',
          flags: MessageFlags.Ephemeral,
        });
      }
      if (sub === 'topic') {
        if (typeof channel.setTopic !== 'function') throw Error('This channel does not support topics');
        await channel.setTopic(interaction.options.getString('text'), 'Lumira owner-requested channel topic');
        return interaction.reply({ content: 'Updated topic for ' + channel.name, flags: MessageFlags.Ephemeral });
      }
    }
    if (sub === 'create') {
      const name = interaction.options.getString('name'),
        kind = interaction.options.getString('kind'),
        parent = interaction.options.getChannel('category');
      if (parent && parent.type !== 4) throw Error('Parent must be a category');
      const ch = await makeChannel(interaction.guild, name, kind, parent?.id);
      return interaction.reply({ content: 'Created ' + ch.name + '.', flags: MessageFlags.Ephemeral });
    }
    if (sub === 'emoji' || sub === 'sticker') {
      const a = interaction.options.getAttachment('image'),
        name = interaction.options.getString('name');
      if (!/^[a-zA-Z0-9_]{2,32}$/.test(name)) throw Error('Use 2–32 letters, digits or underscores');
      if (!a.contentType?.startsWith('image/') || a.size > 5e6) throw Error('Attach an image under 5 MB.');
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      if (sub === 'emoji') {
        const bytes = await imageForEmoji(a.url);
        await interaction.guild.emojis.create({ attachment: bytes, name, reason: 'Owner-approved Lumira emoji' });
      } else {
        const bytes = await imageForSticker(a.url);
        await interaction.guild.stickers.create({
          file: bytes,
          name,
          description: interaction.options.getString('description'),
          tags: '🦋',
          reason: 'Owner-approved Lumira sticker',
        });
      }
      return interaction.editReply('✨ Uploaded ' + sub + ' **' + name + '**.');
    }
  } catch (e) {
    console.error('Lumira admin:', e.message);
    return interaction.deferred
      ? interaction.editReply({ content: 'Admin action failed: ' + e.message })
      : interaction.reply({ content: 'Admin action failed: ' + e.message, flags: MessageFlags.Ephemeral });
  }
}
export async function membersCommand(interaction) {
  if (!interaction.inGuild() || interaction.guild.ownerId !== interaction.user.id)
    return interaction.reply({ content: 'Server owner only.', flags: MessageFlags.Ephemeral });
  const sub = interaction.options.getSubcommand(),
    g = interaction.guildId;
  if (sub === 'sync') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const result = await syncRoster(interaction.guild);
    return interaction.editReply({
      content:
        '🔐 Saved ' +
        result.count +
        ' member IDs in Railway private storage. ' +
        (result.complete
          ? 'Full server roster confirmed.'
          : 'Partial roster only. Enable the Server Members Intent for a complete fetch.'),
    });
  }
  if (sub === 'find') {
    const matches = findMembers(g, interaction.options.getString('name'));
    return interaction.reply({
      content: matches.length
        ? matches.map((m) => m.displayName + ' (@' + m.username + '): ' + m.id).join('\n')
        : 'No matches in saved directory.',
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  }
  const info = roster(g);
  return interaction.reply({
    content:
      '🔐 Stored members: ' +
      Object.keys(info.members).length +
      '\nFull sync: ' +
      (info.complete ? 'yes' : 'not yet') +
      '\nLast sync: ' +
      (info.lastSynced ? new Date(info.lastSynced).toISOString() : 'never'),
    flags: MessageFlags.Ephemeral,
  });
}
