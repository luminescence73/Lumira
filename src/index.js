import 'dotenv/config';
import { startBot } from './bot.js';

await startBot({ token: process.env.DISCORD_TOKEN });
