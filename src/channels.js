import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { channelAllowed } from './features.js';

export const LUMIVIBE_GUILD_ID = '1472157525490139174';
const ids = (value = '') =>
  new Set(
    value
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  );
const allowed = ids(process.env.LUMIRA_CHANNEL_IDS);
export const spontaneousEnabled = process.env.LUMIRA_SPONTANEOUS_ENABLED === 'true';
export const spontaneousChannels = ids(process.env.LUMIRA_SPONTANEOUS_CHANNEL_IDS);

export function permitted(channelId) {
  return allowed.size === 0 || allowed.has(channelId);
}

export function publicSocialChannel(channel) {
  return Boolean(
    channel?.guild &&
    channel.type !== ChannelType.PrivateThread &&
    channelAllowed(channel.guild.id, channel.id) &&
    (!channel.isThread?.() || (channel.parent && channelAllowed(channel.guild.id, channel.parent.id))) &&
    channel.permissionsFor?.(channel.guild.roles.everyone)?.has(PermissionFlagsBits.ViewChannel),
  );
}
