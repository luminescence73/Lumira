# Lumira 💙

Lumira is the Discord companion for the LumiVibe friend server. She supports direct chat by name, mention, reply, and `/lumira`. Spontaneous chat and emoji reactions are opt-in and respect channel and member controls.

## Development

1. Install Node.js 22 and run `npm ci`.
2. Copy `.env.example` to `.env`. For interactive testing, use a separate Discord application and test guild. Enable the Message Content intent for conversation features.
3. Run `npm run check` for syntax and regression checks. Integration tests use temporary data directories and mock Discord and Gemini.
4. Run `npm start`. Lumira registers the full slash command set when the gateway is ready. `npm run register` can also register that same set without starting the bot.

Discord command definitions and their handlers live separately from chat, scheduled jobs, admin migrations, and persistence. The JSON stores use the existing filenames and guild/member keys. Railway runs `npm start` and uses the mounted `/data` volume unless `LUMIRA_DATA_DIR` is set. Run one bot replica per Discord token and data volume. Keep credentials in environment variables.

## LumiVibe features

- Member cards, curated profiles, private opt-in memory, fictional alter egos, server lore, public scrapbook, and owner controls.
- Would You Rather, Trivia, Party Roulette, fictional awards, Diva Court, Roast Battles, and Who Said That. Quote submissions and active rounds last until restart.
- Owner-scheduled event reminders, visual studio, private activity logs, liveboard, channel layout, and sticker/emoji administration.
- Visual emoji organization samples static images and animated frames. It applies descriptive prefixes such as `pika_`, `sxs_`, `anime_`, `animal_`, `meme_`, `cute_`, and `text_`. It edits names on the existing emoji objects and retries uncertain images. The server owner can see progress with `/lumira-admin emoji-review`. Renaming uses the bot's Manage Expressions permission.

The historical layout jobs and the automatic visual emoji organizer target LumiVibe's production guild ID. Their behavior can be exercised with mocks. A separate Discord guild without that ID will register commands but will not run those production jobs.
