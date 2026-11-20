import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { save, state } from './admin-state.js';
import { applyLayout, norm } from './admin-layout.js';

export async function applyLayoutOnce(guild) {
  const s = state(guild.id);
  if (s.layoutVersion >= 1) return { alreadyDone: true };
  const report = await applyLayout(guild);
  s.layoutVersion = 1;
  await save();
  return { alreadyDone: false, report };
}

const extraChannelDestinations = {
  'game-announcements': '✦ GAMING',
  'gift-codes': '✦ GAMING',
  'bot-carl-private': '✦ PRIVATE GALLERIES',
  'carl-bot': '✦ COMMONS',
  'lumi-sxs': '✦ PRIVATE GALLERIES',
  'lumi-private': '✦ PRIVATE GALLERIES',
  'heart-of-the-sea': '✦ PRIVATE GALLERIES',
  'a-father-s-promise': '✦ PRIVATE GALLERIES',
  'sage-sxs': '✦ PRIVATE GALLERIES',
};
export async function finishLayoutOnce(guild) {
  const s = state(guild.id);
  if (s.layoutVersion >= 2) return { alreadyDone: true };
  const report = [];
  const bot = await guild.members.fetchMe();
  if (!bot.permissions.has(PermissionFlagsBits.ManageChannels)) throw Error('Lumira needs Manage Channels');
  for (const ch of guild.channels.cache.values()) {
    if (ch.type !== ChannelType.GuildText) continue;
    const dest = extraChannelDestinations[norm(ch.name)];
    if (!dest) continue;
    const cat = guild.channels.cache.find(
      (x) => x.type === ChannelType.GuildCategory && norm(x.name) === norm(dest),
    );
    if (!cat) {
      report.push('Missing category ' + dest);
      continue;
    }
    if (ch.parentId === cat.id) continue;
    // Preserve existing per-channel overrides. Never sync with parent when relocating private channels.
    await ch.setParent(cat.id, { lockPermissions: false, reason: 'Owner-requested LumiVibe sidebar cleanup' });
    report.push('Moved ' + ch.name + ' to ' + dest);
  }
  s.layoutVersion = 2;
  await save();
  return { alreadyDone: false, report };
}

export async function populateEmptySectionsOnce(guild) {
  const s = state(guild.id);
  if (s.layoutVersion >= 3) return { alreadyDone: true };
  const me = await guild.members.fetchMe();
  if (!me.permissions.has(PermissionFlagsBits.ManageChannels)) throw Error('Lumira needs Manage Channels');
  const report = [];
  const findCat = (name) =>
    guild.channels.cache.find((x) => x.type === ChannelType.GuildCategory && norm(x.name) === norm(name));
  const voice = findCat('✦ VOICE LOUNGE');
  const control = findCat('✦ LUMIRA CONTROL');
  if (!voice || !control) throw Error('Voice Lounge or Lumira Control category missing');
  const voiceNames = ['Voice', 'Gaming', 'Chilling', 'music'];
  for (let i = 0; i < voiceNames.length; i++) {
    const name = voiceNames[i];
    let ch = guild.channels.cache.find((x) => x.type === ChannelType.GuildVoice && norm(x.name) === norm(name));
    if (!ch) {
      ch = await guild.channels.create({
        name,
        type: ChannelType.GuildVoice,
        parent: voice.id,
        reason: 'Owner-requested voice lounge channels',
      });
      report.push('Created voice ' + name);
    } else if (ch.parentId !== voice.id) {
      await ch.setParent(voice.id, { lockPermissions: false, reason: 'Owner-requested voice lounge' });
      report.push('Moved voice ' + name);
    }
    await ch.setPosition(i, { reason: 'LumiVibe voice lounge order' });
  }
  // Explicitly deny general visibility. Only the owner and bot receive new access grants.
  await control.permissionOverwrites.edit(
    guild.roles.everyone.id,
    { ViewChannel: false },
    { reason: 'Private bot control category' },
  );
  await control.permissionOverwrites.edit(
    await guild.fetchOwner(),
    { ViewChannel: true },
    { reason: 'Owner access to bot control' },
  );
  await control.permissionOverwrites.edit(
    me,
    { ViewChannel: true, ManageChannels: true },
    { reason: 'Lumira access to bot control' },
  );
  for (const name of ['liveboard', 'bot-logs']) {
    let ch = guild.channels.cache.find((x) => x.type === ChannelType.GuildText && norm(x.name) === norm(name));
    if (!ch) {
      ch = await guild.channels.create({
        name,
        type: ChannelType.GuildText,
        parent: control.id,
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: guild.ownerId, allow: [PermissionFlagsBits.ViewChannel] },
          { id: me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels] },
        ],
        reason: 'Owner-requested private Lumira control',
      });
      report.push('Created private #' + name);
    } else if (ch.parentId !== control.id) {
      await ch.setParent(control.id, { lockPermissions: false, reason: 'Owner-requested Lumira control' });
      report.push('Moved #' + name);
    }
    await ch.permissionOverwrites.edit(
      guild.roles.everyone.id,
      { ViewChannel: false },
      { reason: 'Keep Lumira control private' },
    );
    await ch.permissionOverwrites.edit(
      await guild.fetchOwner(),
      { ViewChannel: true },
      { reason: 'Owner-only Lumira control' },
    );
    await ch.permissionOverwrites.edit(me, { ViewChannel: true }, { reason: 'Lumira bot control access' });
  }
  s.layoutVersion = 3;
  await save();
  return { alreadyDone: false, report };
}

export async function reconcileLegacyChannelsOnce(guild) {
  const s = state(guild.id);
  if (s.layoutVersion >= 4) return { alreadyDone: true };
  const me = await guild.members.fetchMe();
  if (!me.permissions.has(PermissionFlagsBits.ManageChannels)) throw Error('Manage Channels permission required');
  const report = [];
  const destinations = [
    ['✦ GAMING', ['sword-x-staff', 'general-gaming']],
    ['✦ ARRIVALS', ['new-members']],
    ['✦ INTERESTS', ['stars-charts-and-hoe-roscopes']],
    ['✦ VOICE LOUNGE', ['voice', 'gaming', 'chilling', 'music']],
  ];
  for (const [name, names] of destinations) {
    const cat = guild.channels.cache.find(
      (x) => x.type === ChannelType.GuildCategory && norm(x.name) === norm(name),
    );
    if (!cat) {
      report.push('Category missing: ' + name);
      continue;
    }
    for (const ch of guild.channels.cache.values()) {
      if (ch.type !== ChannelType.GuildText && ch.type !== ChannelType.GuildVoice) continue;
      if (!names.includes(norm(ch.name))) continue;
      if (ch.parentId === cat.id) continue;
      await ch.setParent(cat.id, {
        lockPermissions: false,
        reason: 'Owner-requested final LumiVibe organization',
      });
      report.push('Moved ' + ch.name + ' into ' + name);
    }
  }
  // Do not create duplicate voice rooms if the original ones are still present.
  const lounge = guild.channels.cache.find(
    (x) => x.type === ChannelType.GuildCategory && norm(x.name) === norm('✦ VOICE LOUNGE'),
  );
  if (lounge) {
    for (const name of ['General VC', 'Gaming VC', 'Chill VC']) {
      const duplicate = guild.channels.cache.find(
        (x) => x.type === ChannelType.GuildVoice && norm(x.name) === norm(name) && x.parentId === lounge.id,
      );
      if (duplicate) {
        report.push('Extra voice room retained: ' + name);
      }
    }
  }
  s.layoutVersion = 4;
  await save();
  return { alreadyDone: false, report };
}

export async function organizeEverythingOnce(guild) {
  const s = state(guild.id);
  if (s.organizedVersion === 1) return { alreadyDone: true };
  const me = await guild.members.fetchMe();
  if (!me.permissions.has(PermissionFlagsBits.ManageChannels)) throw Error('Manage Channels required');
  const groups = [
    { cat: '✦ ARRIVALS', names: ['welcome', 'new-members', 'goodbye'] },
    { cat: '✦ COMMONS', names: ['general', 'talk', 'media', 'music', 'i-m-pissed-off', 'carl-bot'] },
    { cat: '✦ INTERESTS', names: ['anime-manga', 'shug-s-kitchen', 'lumi-s-art', 'cosmic-chaos', 'cards'] },
    { cat: '✦ GAMING', names: ['game-updates', 'gift-codes', 'sword-x-staff', 'general-gaming'] },
    { cat: '✦ ARCHIVES', names: ['scrapbook', 'milestones'] },
    { cat: '✦ VOICE LOUNGE', names: ['voice', 'gaming', 'chilling', 'music'] },
    {
      cat: '✦ PRIVATE GALLERIES',
      names: [
        'lumi-private',
        'lumi-sxs',
        'sage-sxs',
        'heart-of-the-sea',
        'a-father-s-promise',
        'bot-carl-private',
      ],
    },
    { cat: '✦ LUMIRA CONTROL', names: ['liveboard', 'bot-logs'] },
  ];
  const report = [];
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i],
      cat = guild.channels.cache.find(
        (x) => x.type === ChannelType.GuildCategory && norm(x.name) === norm(group.cat),
      );
    if (!cat) {
      report.push('Missing ' + group.cat);
      continue;
    }
    await cat.setPosition(i, { reason: 'Owner-requested LumiVibe category organization' });
    for (let j = 0; j < group.names.length; j++) {
      const key = group.names[j];
      const candidates = guild.channels.cache.filter(
        (x) => (x.type === ChannelType.GuildVoice || x.type === ChannelType.GuildText) && norm(x.name) === key,
      );
      const ch = candidates.find((x) =>
        group.cat === '✦ VOICE LOUNGE' ? x.type === ChannelType.GuildVoice : x.type === ChannelType.GuildText,
      );
      if (!ch) continue;
      if (ch.parentId !== cat.id) {
        await ch.setParent(cat.id, { lockPermissions: false, reason: 'Owner-requested organized sidebar' });
        report.push('Moved ' + ch.name + ' to ' + group.cat);
      }
      await ch.setPosition(j, { reason: 'Owner-requested organized channel order' });
    }
  }
  s.organizedVersion = 1;
  await save();
  return { alreadyDone: false, report };
}

export async function restoreOriginalChannelsOnce(guild) {
  const s = state(guild.id);
  if (s.originalChannelFixVersion === 1) return { alreadyDone: true };
  const report = [];
  const all = () => [...guild.channels.cache.values()].filter((x) => x.type === ChannelType.GuildText);
  const originalAstro = all().find((x) => norm(x.name) === 'stars-charts-and-hoe-roscopes');
  const originalGame = all().find((x) => norm(x.name) === 'game-announcements');
  if (!originalAstro || !originalGame)
    throw Error('Original channels not found; refusing to delete or replace anything');
  const preserveOrRemove = async (ch, tag) => {
    // Never erase existing messages or files: only delete provably empty newly created duplicates.
    let empty = false;
    try {
      const messages = await ch.messages.fetch({ limit: 1 });
      empty = messages.size === 0;
    } catch (e) {
      report.push('Could not inspect ' + ch.name + ': ' + e.message);
    }
    if (empty) {
      await ch.delete('Remove empty Lumira-created duplicate; original channel retained');
      report.push('Removed empty duplicate ' + tag);
    } else {
      await ch.setName(
        'archive-' + tag + '-' + ch.id.slice(-4),
        'Preserve existing duplicate content pending review',
      );
      report.push('Archived nonempty duplicate ' + tag);
    }
  };
  for (const ch of all().filter(
    (x) =>
      ['gracies-horoscopes', 'gracie-s-horoscopes', 'cosmic-chaos'].includes(norm(x.name)) &&
      x.id !== originalAstro.id,
  ))
    await preserveOrRemove(ch, 'horoscopes');
  for (const ch of all().filter((x) => norm(x.name) === 'game-updates' && x.id !== originalGame.id))
    await preserveOrRemove(ch, 'game-updates');
  await originalAstro.setName(
    'cosmic-chaos',
    'Owner-requested rename preserving Gracie original astrology history',
  );
  report.push('Renamed original astrology channel to cosmic-chaos');
  await originalGame.setName(
    'game-updates',
    'Owner-requested rename preserving original game announcements history',
  );
  report.push('Renamed original game-announcements to game-updates');
  const interest = guild.channels.cache.find(
    (x) => x.type === ChannelType.GuildCategory && norm(x.name) === norm('✦ INTERESTS'),
  );
  const gaming = guild.channels.cache.find(
    (x) => x.type === ChannelType.GuildCategory && norm(x.name) === norm('✦ GAMING'),
  );
  if (interest && originalAstro.parentId !== interest.id)
    await originalAstro.setParent(interest.id, { lockPermissions: false });
  if (gaming && originalGame.parentId !== gaming.id)
    await originalGame.setParent(gaming.id, { lockPermissions: false });
  s.originalChannelFixVersion = 1;
  await save();
  return { alreadyDone: false, report };
}

export async function finishCleanupAndControlOnce(guild) {
  const s = state(guild.id);
  if (s.finalCleanupVersion === 1) return { alreadyDone: true };
  const report = [];
  const all = () => [...guild.channels.cache.values()];
  const originalAstro = all().find((x) => x.type === ChannelType.GuildText && norm(x.name) === 'cosmic-chaos');
  const originalGame = all().find((x) => x.type === ChannelType.GuildText && norm(x.name) === 'game-updates');
  if (!originalAstro || !originalGame) throw Error('Preserved original channels not found; cleanup halted');
  // User explicitly requested removal of duplicate channels, including the archived game-updates duplicate.
  for (const ch of all()) {
    if (ch.type !== ChannelType.GuildText) continue;
    if (ch.id === originalAstro.id || ch.id === originalGame.id) continue;
    if (
      /^archive-(horoscopes|game-updates)-[a-z0-9]+$/.test(ch.name) ||
      ['gracies-horoscopes', 'gracie-s-horoscopes', 'stars-charts-and-hoe-roscopes'].includes(norm(ch.name))
    ) {
      await ch.delete('Owner requested duplicate channel removal; original channels preserved');
      report.push('Deleted duplicate #' + ch.name);
    }
  }
  const voice = guild.channels.cache.find(
    (x) => x.type === ChannelType.GuildCategory && norm(x.name) === norm('✦ VOICE LOUNGE'),
  );
  if (voice) {
    const originals = ['voice', 'gaming', 'chilling', 'music']
      .map((n) => all().find((x) => x.type === ChannelType.GuildVoice && norm(x.name) === n))
      .filter(Boolean);
    // Extra voice channels were introduced by Lumira; never remove an occupied voice channel.
    for (const name of ['general-vc', 'gaming-vc', 'chill-vc']) {
      const ch = all().find(
        (x) => x.type === ChannelType.GuildVoice && norm(x.name) === name && x.parentId === voice.id,
      );
      if (ch && originals.length === 4) {
        if (ch.members.size === 0) {
          await ch.delete('Remove redundant Lumira-created voice room');
          report.push('Deleted duplicate voice ' + ch.name);
        } else report.push('Kept occupied voice ' + ch.name);
      }
    }
  }
  // Remove only empty categories, never a category still holding channels.
  for (const cat of all().filter((x) => x.type === ChannelType.GuildCategory)) {
    if (!guild.channels.cache.some((x) => x.parentId === cat.id)) {
      await cat.delete('Owner requested removal of empty categories');
      report.push('Deleted empty category ' + cat.name);
    }
  }
  const control = guild.channels.cache.find(
    (x) => x.type === ChannelType.GuildCategory && norm(x.name) === norm('✦ LUMIRA CONTROL'),
  );
  if (!control) throw Error('Lumira Control category missing');
  const live = all().find(
    (x) => x.type === ChannelType.GuildText && norm(x.name) === 'liveboard' && x.parentId === control.id,
  );
  const logs = all().find(
    (x) => x.type === ChannelType.GuildText && norm(x.name) === 'bot-logs' && x.parentId === control.id,
  );
  if (!live || !logs) throw Error('Lumira Control channels missing');
  const me = await guild.members.fetchMe();
  if (
    !me.permissionsIn(live).has(PermissionFlagsBits.SendMessages) ||
    !me.permissionsIn(logs).has(PermissionFlagsBits.SendMessages)
  )
    throw Error('Lumira cannot send messages in control channels');
  await live.send({
    content:
      '🦋 **LumiVibe Liveboard**\nThis is the private home for Lumira activity and server highlights.\n\n**Available now:** member directory, scrapbook, games, event reminders, and server customization.\n**Note:** This is a setup board, not a live-updating dashboard yet.',
  });
  await logs.send({
    content:
      '🔐 **Lumira Bot Logs**\nPrivate administrative log channel initialized.\n**Completed setup:** organized server channels, preserved original #cosmic-chaos and #game-updates, removed requested duplicates and empty categories.\nFurther bot activity logging will require event handlers; this message confirms setup only.',
  });
  report.push('Posted setup messages in liveboard and bot-logs');
  s.finalCleanupVersion = 1;
  await save();
  return { alreadyDone: false, report };
}
