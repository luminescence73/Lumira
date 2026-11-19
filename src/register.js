import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';
const { DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID) throw new Error('Set DISCORD_TOKEN and DISCORD_CLIENT_ID');
const commands = [new SlashCommandBuilder().setName('lumira').setDescription('Chat with Lumira').addStringOption(o=>o.setName('message').setDescription('What would you like to say?').setRequired(true))].map(c=>c.toJSON());
const rest = new REST({version:'10'}).setToken(DISCORD_TOKEN);
const route = DISCORD_GUILD_ID ? Routes.applicationGuildCommands(DISCORD_CLIENT_ID,DISCORD_GUILD_ID) : Routes.applicationCommands(DISCORD_CLIENT_ID);
await rest.put(route,{body:commands});
console.log('Registered Lumira commands');
