import { ApplicationFlags, ChannelType, PermissionFlagsBits, Routes } from 'discord.js';

const membersFlags = ApplicationFlags.GatewayGuildMembers | ApplicationFlags.GatewayGuildMembersLimited;

export async function memberEventsAvailable(token, { request = fetch, configure = false } = {}) {
  const url = 'https://discord.com/api/v10' + Routes.currentApplication();
  const headers = { Authorization: 'Bot ' + token, 'Content-Type': 'application/json' };
  const options = { headers, signal: AbortSignal.timeout(5000) };
  try {
    const response = await request(url, options);
    if (!response.ok) throw Error('application check HTTP ' + response.status);
    const app = await response.json();
    if (app.flags & membersFlags) return true;
    if (!configure || !process.env.DISCORD_CLIENT_ID || app.id !== process.env.DISCORD_CLIENT_ID) return false;
    const edited = await request(url, {
      ...options,
      signal: AbortSignal.timeout(5000),
      method: 'PATCH',
      body: JSON.stringify({ flags: app.flags | ApplicationFlags.GatewayGuildMembersLimited }),
    });
    if (!edited.ok) throw Error('member intent setup HTTP ' + edited.status);
    return Boolean((await edited.json()).flags & membersFlags);
  } catch (error) {
    console.warn('Lumira member event setup:', error.message);
    return false;
  }
}

const welcome = (name) => '✦ Welcome to LumiVibe, **' + name + '**! Grab a spot and make yourself at home. 💙';
const goodbye = (name) => '✦ **' + name + '** left LumiVibe. Take care, wherever you’re headed. 💙';
const escapeName = (name) =>
  String(name || 'A member')
    .replace(/[\\*_~`|]/g, '\\$&')
    .replace(/[\r\n]/g, ' ');

export async function announceMember(member, joined) {
  const name = joined ? 'welcome' : 'goodbye';
  const { guild, user } = member;
  const channels = guild.channels.cache;
  const matches = channels.filter((channel) => channel.type === ChannelType.GuildText && channel.name === name);
  const channel =
    matches.find((match) => match.parent?.name?.toLowerCase().includes('arrivals')) ||
    (matches.size === 1 ? matches.first() : null);
  if (!channel) throw Error('Missing or ambiguous #' + name + ' channel');
  const bot = await guild.members.fetchMe();
  if (!bot.permissionsIn(channel).has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
    throw Error('Missing permission to post in #' + name);
  }
  await channel.send({
    content: (joined ? welcome : goodbye)(escapeName(user?.username)),
    allowedMentions: { parse: [] },
  });
}
