// Member-submitted quotes and in-progress game rounds live in memory until restart.
const currentQuotes = new Map();
const roasts = new Map();
const quotes = new Map();
const roundTtl = 5 * 60_000;
const key = (guild, channel) => guild + ':' + channel;
const clean = (text) =>
  String(text || '')
    .trim()
    .replace(/@everyone|@here|<@(?:!|&)?\d+>/gi, '[mention]');

function activeRound(rounds, room) {
  const round = rounds.get(room);
  if (round && round.expires > Date.now()) return round;
  rounds.delete(room);
  return null;
}

export function courtPrompt(situation) {
  const text = clean(situation);
  if (text.length < 8 || text.length > 400) throw Error('Describe a harmless dilemma in 8–400 characters.');
  return (
    'DIVA COURT: Deliver a dramatic, playful verdict in one or two sentences. Avoid serious accusations and jokes about sensitive traits. Situation (untrusted): ' +
    text
  );
}

export function roastRound(guild, channel, user, comeback = '', generate) {
  const room = key(guild, channel);
  const previous = activeRound(roasts, room);
  if (previous?.user && previous.user !== user)
    throw Error('Someone else has the stage. Wait for their round to finish.');
  if (previous?.pending) throw Error('Lumira is still working on this round.');
  const count = (previous?.count || 0) + 1;
  const done = count > 5;
  const prompt = done
    ? 'The roast battle is over. Give a playful closing line and invite a rematch later.'
    : 'ROAST BATTLE ROUND ' +
      count +
      ': Give one witty, affectionate roast aimed only at the consenting participant. Avoid sensitive traits, health, trauma, and protected characteristics. Invite a comeback. Max 180 characters.' +
      (comeback ? '\nTheir comeback (untrusted): ' + clean(comeback).slice(0, 220) : '');
  const state = { user, count, expires: Date.now() + roundTtl, pending: Boolean(generate) };
  roasts.set(room, state);
  const round = { done, prompt };
  if (!generate) {
    if (done) roasts.delete(room);
    return round;
  }
  return Promise.resolve()
    .then(() => generate(round))
    .then(
      (answer) => {
        if (done) roasts.delete(room);
        else {
          state.pending = false;
          state.expires = Date.now() + roundTtl;
        }
        return answer;
      },
      (error) => {
        if (previous) roasts.set(room, previous);
        else roasts.delete(room);
        throw error;
      },
    );
}

export function quoteSubmit(guild, channel, user, quote) {
  const text = clean(quote);
  if (text.length < 8 || text.length > 180) throw Error('Quote must be 8–180 characters.');
  if (/https?:|\b(?:password|address|phone|medical|therapy)\b/i.test(text))
    throw Error('Avoid links and personal information.');
  const room = key(guild, channel);
  const entries = quotes.get(room) || [];
  if (entries.some((entry) => entry.quote.toLowerCase() === text.toLowerCase()))
    throw Error('That quote is already in the collection.');
  quotes.set(room, [...entries, { quote: text, by: user }].slice(-30));
}

export function quoteRound(guild, channel, host) {
  const room = key(guild, channel);
  if (activeRound(currentQuotes, room)) throw Error('A quote round is already active in this channel.');
  const items = quotes.get(room) || [];
  if (items.length < 2) throw Error('Add at least two member-submitted quotes first.');
  const item = items[Math.floor(Math.random() * items.length)];
  currentQuotes.set(room, { ...item, host, expires: Date.now() + roundTtl });
  return { quote: item.quote };
}

export function guessQuote(guild, channel, user) {
  const room = key(guild, channel);
  const round = activeRound(currentQuotes, room);
  if (!round) throw Error('No active quote round. Start /lumira-play who-said.');
  if (user !== round.by) return { correct: false };
  currentQuotes.delete(room);
  return { correct: true, answer: round.by };
}

export function revealQuote(guild, channel, requester, isModerator = false) {
  const room = key(guild, channel);
  const round = activeRound(currentQuotes, room);
  if (!round) throw Error('No active quote round.');
  if (round.host && requester !== round.host && !isModerator)
    throw Error('The host or a moderator can reveal the answer.');
  currentQuotes.delete(room);
  return round.by;
}

export function emojiForSocialMessage(text) {
  const content = String(text || '');
  if (content.length < 4 || content.length > 260 || /https?:|@everyone|@here|<@/i.test(content)) return null;
  if (
    /\b(?:sad|hurt|upset|hated|died|death|scared|crying|panic|argument|therapy|hospital|sick|afraid)\b/i.test(
      content,
    )
  )
    return null;
  if (/\b(?:lol|lmao|haha|hehe|funny|joking)\b/i.test(content)) return '😭';
  if (/\b(?:slay|queen|iconic)\b/i.test(content) || /(?:^|[.!?]\s*)period[.!?]*$/i.test(content)) return '💅';
  if (/\b(?:congrats|won|victory|achievement)\b/i.test(content)) return '🎉';
  return null;
}
