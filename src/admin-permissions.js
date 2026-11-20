import { PermissionFlagsBits } from 'discord.js';
import { save, discard, state } from './admin-state.js';
export function preview(guild) {
  const s = state(guild.id);
  const changes = [];
  const everyone = guild.roles.everyone;
  for (const p of [PermissionFlagsBits.CreateInstantInvite, PermissionFlagsBits.CreateGuildExpressions])
    if (everyone.permissions.has(p))
      changes.push(
        'Remove ' +
          (p === PermissionFlagsBits.CreateInstantInvite ? 'invite creation' : 'emoji/sticker creation') +
          ' from @everyone',
      );
  for (const channel of guild.channels.cache.values()) {
    if (channel.isThread?.()) continue;
    const allowed = s.privateChannels[channel.id];
    if (!allowed) continue;
    changes.push('Restrict ' + channel.name + ' to owner, bot and ' + allowed.length + ' named members');
  }
  return changes;
}
export async function applyGuild(guild) {
  const s = state(guild.id),
    bot = await guild.members.fetchMe();
  if (!bot.permissions.has(PermissionFlagsBits.ManageRoles)) throw Error('Bot needs Manage Roles');
  const everyone = guild.roles.everyone;
  const remove = PermissionFlagsBits.CreateInstantInvite | PermissionFlagsBits.CreateGuildExpressions;
  await everyone.setPermissions(
    everyone.permissions.bitfield & ~remove,
    'Lumira owner-approved server invite/expression policy',
  );
  const grantRole = async (kind, perm) => {
    const ids = s[kind];
    const roleName = 'Lumira ' + kind.replace('Managers', ' Managers');
    let role = guild.roles.cache.find((r) => r.name === roleName && !r.managed);
    if (!role)
      role = await guild.roles.create({
        name: roleName,
        permissions: [],
        reason: 'Lumira owner-approved delegated access',
      });
    if (role.position >= bot.roles.highest.position) throw Error('Bot role must be above ' + roleName);
    await role.setPermissions([perm], 'Lumira delegated access');
    for (const member of role.members.values())
      if (!ids.includes(member.id)) await member.roles.remove(role, 'Lumira access revoked');
    for (const id of ids) {
      const member = await guild.members.fetch(id).catch(() => null);
      if (member) await member.roles.add(role, 'Lumira owner-approved delegated access');
    }
  };
  await grantRole('stickerManagers', PermissionFlagsBits.CreateGuildExpressions);
  await grantRole('emojiManagers', PermissionFlagsBits.CreateGuildExpressions);
  await grantRole('inviteManagers', PermissionFlagsBits.CreateInstantInvite);
  let channels = 0;
  for (const [id, ids] of Object.entries(s.privateChannels)) {
    const channel = await guild.channels.fetch(id).catch(() => null);
    if (!channel || channel.isThread?.() || !channel.permissionOverwrites) continue;
    await channel.permissionOverwrites.edit(
      guild.roles.everyone.id,
      { ViewChannel: false },
      { reason: 'Lumira owner-approved private channel' },
    );
    await channel.permissionOverwrites.edit(
      bot.id,
      { ViewChannel: true, ManageChannels: true },
      { reason: 'Lumira private channel bot access' },
    );

    for (const userId of s.privateRevocations?.[id] || []) {
      if (userId === guild.ownerId || userId === bot.id || ids.includes(userId)) continue;
      if (channel.permissionOverwrites.cache.has(userId)) {
        await channel.permissionOverwrites.edit(
          userId,
          { ViewChannel: null },
          { reason: 'Lumira private access revoked' },
        );
      }
    }
    if (s.privateRevocations?.[id]) {
      delete s.privateRevocations[id];
      await save();
    }
    for (const uid of ids) {
      const member = await guild.members.fetch(uid).catch(() => null);
      if (member)
        await channel.permissionOverwrites.edit(
          uid,
          { ViewChannel: true },
          { reason: 'Lumira explicitly authorized access' },
        );
    }
    channels++;
  }
  await discard(guild.id);
  return { channels };
}
