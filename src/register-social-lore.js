import { REST, Routes } from 'discord.js';
import { commandDefinitions } from './command-schema.js';
export async function registerSocialLoreCommand(){
 const token=process.env.DISCORD_TOKEN,clientId=process.env.DISCORD_CLIENT_ID,guildId=process.env.DISCORD_GUILD_ID;
 if(!token||!clientId||!guildId){console.warn('Lorebook slash command registration skipped: missing Discord application or guild ID');return false}
 const command=commandDefinitions().find(c=>c.name==='lumira-lorebook');
 if(!command)throw Error('Lorebook command schema missing');
 await new REST({version:'10'}).setToken(token).post(Routes.applicationGuildCommands(clientId,guildId),{body:command});
 console.log('LumiVibe Lorebook slash command registered');
 return true;
}
