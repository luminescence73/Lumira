import { SlashCommandBuilder } from 'discord.js';

export function commandDefinitions() {
  const chatCommand = new SlashCommandBuilder()
    .setName('lumira')
    .setDescription('Chat with Lumira')
    .addStringOption((o) =>
      o.setName('message').setDescription('What would you like to say?').setRequired(true).setMaxLength(1200),
    )
    .toJSON();
  const memoryCommand = new SlashCommandBuilder()
    .setName('lumira-memory')
    .setDescription('Manage your own opt-in long-term memories')
    .addSubcommand((s) => s.setName('enable').setDescription('Opt in to saving personal memories'))
    .addSubcommand((s) =>
      s
        .setName('save')
        .setDescription('Save one fact you choose')
        .addStringOption((o) =>
          o
            .setName('note')
            .setDescription('A non-sensitive fact about you (max 200 characters)')
            .setRequired(true)
            .setMaxLength(200),
        ),
    )
    .addSubcommand((s) => s.setName('view').setDescription('Privately view your saved memories'))
    .addSubcommand((s) =>
      s
        .setName('delete')
        .setDescription('Delete a numbered memory')
        .addIntegerOption((o) =>
          o
            .setName('number')
            .setDescription('Number from /lumira-memory view')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(15),
        ),
    )
    .addSubcommand((s) =>
      s.setName('disable').setDescription('Opt out and permanently delete all your saved memories'),
    )
    .toJSON();
  const loreCommand = new SlashCommandBuilder()
    .setName('lumira-lore')
    .setDescription('Browse server inside jokes; moderators manage entries')
    .addSubcommand((s) => s.setName('list').setDescription('View saved inside jokes'))
    .addSubcommand((s) =>
      s
        .setName('add')
        .setDescription('Moderator: approve an inside joke')
        .addStringOption((o) =>
          o.setName('joke').setDescription('Shared joke or reference').setRequired(true).setMaxLength(240),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('remove')
        .setDescription('Moderator: remove an inside joke')
        .addIntegerOption((o) =>
          o.setName('number').setDescription('Entry number').setRequired(true).setMinValue(1),
        ),
    )
    .toJSON();
  const historyCommand = new SlashCommandBuilder()
    .setName('lumira-history')
    .setDescription('Owner and moderators: manage LumiVibe history and lore')
    .addSubcommand((s) =>
      s
        .setName('add')
        .setDescription('Save an approved piece of server history')
        .addStringOption((o) =>
          o
            .setName('story')
            .setDescription('History, event, or lore (max 1500 characters)')
            .setRequired(true)
            .setMaxLength(1500),
        ),
    )
    .addSubcommand((s) => s.setName('list').setDescription('Read saved server history'))
    .addSubcommand((s) =>
      s
        .setName('remove')
        .setDescription('Remove a history entry')
        .addIntegerOption((o) =>
          o.setName('number').setDescription('Entry number').setRequired(true).setMinValue(1),
        ),
    )
    .toJSON();
  const profileCommand = new SlashCommandBuilder()
    .setName('lumira-profile')
    .setDescription('Create or manage your own card in #cards')
    .addSubcommand((s) =>
      s
        .setName('create')
        .setDescription('Publish or update your own profile')
        .addStringOption((o) =>
          o
            .setName('about')
            .setDescription('What would you like people to know?')
            .setRequired(true)
            .setMinLength(3)
            .setMaxLength(500),
        ),
    )
    .addSubcommand((s) => s.setName('view').setDescription('View your saved profile'))
    .addSubcommand((s) => s.setName('delete').setDescription('Remove your profile from #cards'))
    .toJSON();
  const scrapbookCommand = new SlashCommandBuilder()
    .setName('lumira-scrapbook')
    .setDescription('Save and browse memorable public posts')
    .addSubcommand((s) =>
      s
        .setName('save')
        .setDescription('Save a public message by its link')
        .addStringOption((o) => o.setName('link').setDescription('Discord message link').setRequired(true)),
    )
    .addSubcommand((s) => s.setName('list').setDescription('Browse saved moments'))
    .addSubcommand((s) =>
      s.setName('optout').setDescription('Stop automatic saving of your posts and remove old saved links'),
    )
    .addSubcommand((s) => s.setName('optin').setDescription('Allow your public posts to be auto-saved again'))
    .addSubcommand((s) =>
      s
        .setName('remove')
        .setDescription('Remove your saved moment, or moderator remove any')
        .addIntegerOption((o) =>
          o.setName('number').setDescription('Moment number').setRequired(true).setMinValue(1),
        ),
    )
    .toJSON();
  const egoCommand = new SlashCommandBuilder()
    .setName('lumira-ego')
    .setDescription('Your optional fictional LumiVibe alter ego')
    .addSubcommand((s) => s.setName('create').setDescription('Generate a funny fictional persona for yourself'))
    .addSubcommand((s) => s.setName('view').setDescription('View your persona'))
    .addSubcommand((s) => s.setName('reset').setDescription('Delete your persona'))
    .toJSON();
  const controlCommand = new SlashCommandBuilder()
    .setName('lumira-control')
    .setDescription('Server owner: manage Lumira feature switches')
    .addSubcommand((s) => s.setName('status').setDescription('View current feature settings'))
    .addSubcommand((s) => s.setName('dashboard').setDescription('Open the private interactive Liveboard'))
    .addSubcommand((s) =>
      s
        .setName('set')
        .setDescription('Enable or disable a feature')
        .addStringOption((o) =>
          o
            .setName('feature')
            .setDescription('Feature to configure')
            .setRequired(true)
            .addChoices(
              { name: 'Automatic lore', value: 'autoLore' },
              { name: 'Automatic scrapbook', value: 'autoScrapbook' },
              { name: 'Spontaneous comments', value: 'spontaneous' },
              { name: 'Roasts', value: 'roasts' },
            ),
        )
        .addBooleanOption((o) => o.setName('enabled').setDescription('On or off').setRequired(true)),
    )
    .toJSON();
  const vibeCommand = new SlashCommandBuilder()
    .setName('lumira-vibe')
    .setDescription('See LumiVibe activity and memorable moments')
    .addSubcommand((s) => s.setName('now').setDescription('See recent public chat activity'))
    .addSubcommand((s) => s.setName('recap').setDescription('Get a short recap from saved public scrapbook links'))
    .addSubcommand((s) => s.setName('gallery').setDescription('Browse scrapbook moments as interactive cards'))
    .toJSON();
  const privacyCommand = new SlashCommandBuilder()
    .setName('lumira-privacy')
    .setDescription('Control how Lumira interacts with you')
    .addSubcommand((s) =>
      s.setName('mute').setDescription('Stop Lumira from reacting to or learning from your messages'),
    )
    .addSubcommand((s) => s.setName('unmute').setDescription('Allow Lumira to interact with you again'))
    .addSubcommand((s) => s.setName('status').setDescription('View your privacy preferences'))
    .toJSON();
  const channelCommand = new SlashCommandBuilder()
    .setName('lumira-channels')
    .setDescription('Server owner: control which public channels Lumira observes')
    .addSubcommand((s) =>
      s
        .setName('exclude')
        .setDescription('Exclude a channel from Lumira social features')
        .addChannelOption((o) => o.setName('channel').setDescription('Channel to exclude').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('include')
        .setDescription('Allow Lumira in a previously excluded channel')
        .addChannelOption((o) => o.setName('channel').setDescription('Channel to include').setRequired(true)),
    )
    .addSubcommand((s) => s.setName('list').setDescription('Show excluded channels'))
    .toJSON();
  const studioCommand = new SlashCommandBuilder()
    .setName('lumira-studio')
    .setDescription('LumiVibe visual studio')
    .addSubcommand((s) =>
      s
        .setName('photo')
        .setDescription('Generate an original AI image (daily limit)')
        .addStringOption((o) =>
          o.setName('prompt').setDescription('Describe a fictional scene').setRequired(true).setMaxLength(400),
        ),
    )
    .addSubcommand((s) =>
      s.setName('character').setDescription('Make a PNG character card from your opt-in alter ego'),
    )
    .addSubcommand((s) =>
      s.setName('collage').setDescription('Preview a scrapbook-inspired visual recap (private)'),
    )
    .addSubcommand((s) => s.setName('dashboard').setDescription('Owner: open visual studio settings'))
    .toJSON();
  const playCommand = new SlashCommandBuilder()
    .setName('lumira-play')
    .setDescription('LumiVibe games and fictional awards')
    .addSubcommand((s) => s.setName('rather').setDescription('Start a Would You Rather vote'))
    .addSubcommand((s) => s.setName('trivia').setDescription('Start a trivia round'))
    .addSubcommand((s) => s.setName('roulette').setDescription('Get a party game prompt'))
    .addSubcommand((s) =>
      s
        .setName('court')
        .setDescription('Get a dramatic verdict on a silly dilemma')
        .addStringOption((o) =>
          o.setName('situation').setDescription('A harmless situation').setRequired(true).setMaxLength(400),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('roast')
        .setDescription('Opt into a friendly roast battle')
        .addStringOption((o) =>
          o.setName('comeback').setDescription('Optional comeback for your next round').setMaxLength(220),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('quote-add')
        .setDescription('Submit your own approved quote for Who Said That?')
        .addStringOption((o) =>
          o.setName('quote').setDescription('Your own quote').setRequired(true).setMaxLength(180),
        ),
    )
    .addSubcommand((s) => s.setName('who-said').setDescription('Play Who Said That? using approved quotes'))
    .addSubcommand((s) =>
      s
        .setName('guess')
        .setDescription('Guess who submitted the current quote')
        .addUserOption((o) => o.setName('member').setDescription('Who said it?').setRequired(true)),
    )
    .addSubcommand((s) => s.setName('reveal').setDescription('Reveal the current Who Said That? answer'))
    .addSubcommand((s) => s.setName('leaderboard').setDescription('See the trivia leaderboard'))
    .addSubcommand((s) =>
      s
        .setName('award')
        .setDescription('Give someone a silly fictional award')
        .addUserOption((o) => o.setName('member').setDescription('Recipient').setRequired(true))
        .addStringOption((o) =>
          o.setName('title').setDescription('Funny award title').setRequired(true).setMaxLength(75),
        ),
    )
    .addSubcommand((s) => s.setName('awards').setDescription('View recent fictional awards'))
    .toJSON();
  const personalityCommand = new SlashCommandBuilder()
    .setName('lumira-personality')
    .setDescription('Owner: choose Lumira chat style')
    .addSubcommand((s) => s.setName('view').setDescription('See current personality'))
    .addSubcommand((s) =>
      s
        .setName('set')
        .setDescription('Choose a personality')
        .addStringOption((o) =>
          o
            .setName('style')
            .setDescription('Personality')
            .setRequired(true)
            .addChoices(
              { name: 'Chaotic', value: 'chaotic' },
              { name: 'Cozy', value: 'cozy' },
              { name: 'Witty', value: 'witty' },
            ),
        ),
    )
    .toJSON();
  const eventCommand = new SlashCommandBuilder()
    .setName('lumira-event')
    .setDescription('Opt-in LumiVibe event reminders')
    .addSubcommand((s) =>
      s
        .setName('schedule')
        .setDescription('Owner: schedule one event reminder')
        .addStringOption((o) => o.setName('title').setDescription('Event name').setRequired(true).setMaxLength(80))
        .addStringOption((o) =>
          o.setName('utc').setDescription('UTC time, e.g. 2026-12-01T20:00:00Z').setRequired(true),
        ),
    )
    .addSubcommand((s) => s.setName('upcoming').setDescription('View upcoming events'))
    .toJSON();
  const rosterCommand = new SlashCommandBuilder()
    .setName('lumira-members')
    .setDescription('Owner: private saved Discord member ID directory')
    .addSubcommand((s) => s.setName('sync').setDescription('Refresh member IDs and names'))
    .addSubcommand((s) => s.setName('status').setDescription('Show directory completeness and count'))
    .addSubcommand((s) =>
      s
        .setName('find')
        .setDescription('Find a member by username or nickname')
        .addStringOption((o) => o.setName('name').setDescription('Member name').setRequired(true)),
    )
    .toJSON();
  const adminCommand = new SlashCommandBuilder()
    .setName('lumira-admin')
    .setDescription('Owner-only channel and expression administration')
    .addSubcommand((s) => s.setName('audit').setDescription('Preview permission restrictions'))
    .addSubcommand((s) => s.setName('apply').setDescription('Apply owner-approved permission changes'))
    .addSubcommand((s) => s.setName('layout').setDescription('Preview current server channel organization'))
    .addSubcommand((s) => s.setName('redesign').setDescription('Preview the planned full LumiVibe redesign'))
    .addSubcommand((s) => s.setName('redesign-apply').setDescription('Apply the approved LumiVibe redesign'))
    .addSubcommand((s) => s.setName('cleanup').setDescription('Review empty and duplicate channel names'))
    .addSubcommand((s) =>
      s
        .setName('rename')
        .setDescription('Rename a channel or category')
        .addChannelOption((o) => o.setName('channel').setDescription('Channel to rename').setRequired(true))
        .addStringOption((o) => o.setName('name').setDescription('New name').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('move')
        .setDescription('Move channel to another category')
        .addChannelOption((o) => o.setName('channel').setDescription('Channel to move').setRequired(true))
        .addChannelOption((o) => o.setName('category').setDescription('Destination category').setRequired(true))
        .addBooleanOption((o) =>
          o.setName('sync_permissions').setDescription('Sync permissions with destination? Defaults to no'),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('position')
        .setDescription('Change a channel position')
        .addChannelOption((o) => o.setName('channel').setDescription('Channel to reorder').setRequired(true))
        .addIntegerOption((o) =>
          o.setName('position').setDescription('Position starting at 1').setMinValue(1).setRequired(true),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('topic')
        .setDescription('Set a text channel topic')
        .addChannelOption((o) => o.setName('channel').setDescription('Text channel').setRequired(true))
        .addStringOption((o) =>
          o.setName('text').setDescription('New topic').setRequired(true).setMaxLength(1024),
        ),
    )
    .addSubcommand((s) =>
      s
        .setName('create')
        .setDescription('Create a channel')
        .addStringOption((o) => o.setName('name').setDescription('Lowercase name with hyphens').setRequired(true))
        .addStringOption((o) =>
          o
            .setName('kind')
            .setDescription('Channel type')
            .setRequired(true)
            .addChoices(
              { name: 'Text', value: 'text' },
              { name: 'Voice', value: 'voice' },
              { name: 'Category', value: 'category' },
            ),
        )
        .addChannelOption((o) => o.setName('category').setDescription('Optional parent category')),
    )
    .addSubcommand((s) =>
      s
        .setName('authorize')
        .setDescription('Grant or revoke a named member permission')
        .addUserOption((o) => o.setName('member').setDescription('Exact Discord member').setRequired(true))
        .addStringOption((o) =>
          o
            .setName('permission')
            .setDescription('Access type')
            .setRequired(true)
            .addChoices(
              { name: 'Stickers', value: 'sticker' },
              { name: 'Emojis', value: 'emoji' },
              { name: 'Invites', value: 'invite' },
            ),
        )
        .addBooleanOption((o) => o.setName('allow').setDescription('Grant access?').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('private')
        .setDescription('Authorize member for one private channel')
        .addChannelOption((o) => o.setName('channel').setDescription('Private channel').setRequired(true))
        .addUserOption((o) => o.setName('member').setDescription('Allowed member').setRequired(true))
        .addBooleanOption((o) => o.setName('allow').setDescription('Grant access?').setRequired(true)),
    )
    .addSubcommand((s) =>
      s.setName('emoji-review').setDescription('Owner: inspect visual emoji classification progress'),
    )
    .addSubcommand((s) =>
      s
        .setName('emoji')
        .setDescription('Upload a custom emoji from an image attachment')
        .addStringOption((o) => o.setName('name').setDescription('Emoji name').setRequired(true))
        .addAttachmentOption((o) => o.setName('image').setDescription('Image attachment').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('sticker')
        .setDescription('Upload a sticker from an image attachment')
        .addStringOption((o) => o.setName('name').setDescription('Sticker name').setRequired(true))
        .addStringOption((o) => o.setName('description').setDescription('Sticker description').setRequired(true))
        .addAttachmentOption((o) => o.setName('image').setDescription('Image attachment').setRequired(true)),
    )
    .toJSON();
  const copyCommand = new SlashCommandBuilder()
    .setName('lumira-copy')
    .setDescription('Copy a Discord sticker or custom emoji into LumiVibe');
  for (const kind of ['sticker', 'emoji']) {
    copyCommand.addSubcommand((s) =>
      s
        .setName(kind)
        .setDescription('Copy a Discord ' + kind)
        .addStringOption((o) =>
          o
            .setName('source')
            .setDescription('Discord message link, ' + kind + ' ID, asset link, or custom emoji code')
            .setRequired(true)
            .setMaxLength(300),
        )
        .addStringOption((o) =>
          o
            .setName('name')
            .setDescription('Optional new name')
            .setMaxLength(kind === 'sticker' ? 30 : 32),
        ),
    );
  }
  const forgetCommand = new SlashCommandBuilder()
    .setName('lumira-forget')
    .setDescription('Clear your recent Lumira conversation in this channel')
    .toJSON();
  const socialLoreCommand = new SlashCommandBuilder().setName('lumira-lorebook').setDescription('LumiVibe inside jokes, friendships and approved lore');
  for(const kind of ['joke','bond','moment']){
    socialLoreCommand.addSubcommand(s=>{
      s.setName(kind).setDescription('Propose an approved '+kind+' for the lorebook')
       .addStringOption(o=>o.setName('title').setDescription('Short title').setRequired(true).setMaxLength(70))
       .addStringOption(o=>o.setName('description').setDescription('The joke, story or friendship dynamic').setRequired(true).setMaxLength(400));
      if(kind==='bond')s.addUserOption(o=>o.setName('friend').setDescription('Other participant who must approve').setRequired(true));
      else s.addUserOption(o=>o.setName('friend').setDescription('Optional friend who must approve'));
      return s;
    });
  }
  socialLoreCommand.addSubcommand(s=>s.setName('browse').setDescription('Browse approved lore'));
  socialLoreCommand.addSubcommand(s=>s.setName('search').setDescription('Search approved lore').addStringOption(o=>o.setName('query').setDescription('Search phrase').setRequired(true)));
  socialLoreCommand.addSubcommand(s=>s.setName('pending').setDescription('View proposals awaiting your approval'));
  socialLoreCommand.addSubcommand(s=>s.setName('approve').setDescription('Approve a proposal mentioning you').addStringOption(o=>o.setName('id').setDescription('Proposal ID').setRequired(true)));
  socialLoreCommand.addSubcommand(s=>s.setName('remove').setDescription('Remove lore involving you or submitted by you').addStringOption(o=>o.setName('id').setDescription('Lore ID').setRequired(true)));
  return [
    socialLoreCommand.toJSON(),
    chatCommand,
    forgetCommand,
    memoryCommand,
    loreCommand,
    historyCommand,
    profileCommand,
    scrapbookCommand,
    egoCommand,
    controlCommand,
    vibeCommand,
    privacyCommand,
    channelCommand,
    studioCommand,
    playCommand,
    personalityCommand,
    eventCommand,
    rosterCommand,
    adminCommand,
    copyCommand.toJSON(),
  ];
}
