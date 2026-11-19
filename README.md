# Lumira 💙

A playful, witty Discord companion for the private LumiVibe friend server.

## Phase 1
- Respond when mentioned or through `/lumira`.
- Stay quiet by default; never flood channels.
- Keep private member galleries private.
- Owner-only Liveboard planned; not yet deployed.
- No message history collection, recording, or automatic personal memory in this starter.

## Local setup
1. Install Node.js 20+ and run `npm install`.
2. Copy `.env.example` to `.env` and set the Discord bot token, application ID, and optional guild ID.
3. Run `npm run register` to register the `/lumira` command.
4. Run `npm start`.

Invite the Discord application with the `bot` and `applications.commands` scopes, granting View Channels, Send Messages, and Read Message History only in approved channels. Do not commit tokens.

Railway deployment requires a separate service and `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, and optionally `DISCORD_GUILD_ID`. No service has been created yet.
