import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { commandDefinitions } from './command-schema.js';

const { DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID) throw Error('Set DISCORD_TOKEN and DISCORD_CLIENT_ID');
const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
const route = DISCORD_GUILD_ID
  ? Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID)
  : Routes.applicationCommands(DISCORD_CLIENT_ID);
await rest.put(route, { body: commandDefinitions() });
console.log('Registered Lumira commands');
