import { jsonStore } from './json-store.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
const store = jsonStore('playground.json');
let db = {};
const active = new Map();
export async function loadPlayground() {
  db = await store.load();
  console.log('Lumira playground ready');
}
const state = (g) => db[g] || (db[g] = { scores: {}, awards: [] });
function save() {
  return store.save(db);
}
const sets = {
  rather: [
    ['Would you rather have a pet dragon or a tiny personal thundercloud?', 'Pet dragon', 'Thundercloud'],
    ['Would you rather teleport everywhere or understand every animal?', 'Teleport', 'Talk to animals'],
    [
      'Would you rather always have dramatic entrance music or a personal spotlight?',
      'Entrance music',
      'Spotlight',
    ],
  ],
  trivia: [
    ['Which planet has the most prominent ring system?', 'Saturn', 'Mars', 'Venus', 'Mercury', 0],
    ['Which ocean is the largest?', 'Pacific', 'Atlantic', 'Indian', 'Arctic', 0],
    [
      'What does CPU stand for?',
      'Central Processing Unit',
      'Computer Power Utility',
      'Core Program Upload',
      'Central Program User',
      0,
    ],
    ['Which element has the chemical symbol Au?', 'Gold', 'Silver', 'Argon', 'Aluminum', 0],
  ],
  roulette: [
    ['Your fictional superpower comes with a ridiculous drawback. What is it?'],
    ['Name a harmless hill you would defend with your entire soul.'],
    ['Invent a terrible name for a luxury perfume.'],
    ['If this server were a sitcom, what would the title be?'],
  ],
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];
function shuffleTrivia([question, ...items]) {
  const answer = items[4];
  const choices = items.slice(0, 4).map((label, index) => ({ label, correct: index === answer }));
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return [question, ...choices.map((choice) => choice.label), choices.findIndex((choice) => choice.correct)];
}
export function gameCard(g, channel, kind, creator) {
  const key = g + ':' + channel;
  if (kind !== 'roulette' && active.has(key) && active.get(key).ends > Date.now())
    throw Error('There is already a live game in this channel.');
  const original = pick(sets[kind]);
  const q = kind === 'trivia' ? shuffleTrivia(original) : original;
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const game = { id, g, channel, kind, q, votes: {}, ends: Date.now() + 5 * 60000, creator };
  if (kind !== 'roulette') active.set(key, game);
  const embed = new EmbedBuilder()
    .setColor(0x88caff)
    .setTitle(
      kind === 'trivia' ? '🧠 Lumira Trivia' : kind === 'rather' ? '🦋 Would You Rather' : '🎲 Party Roulette',
    )
    .setDescription('**' + q[0] + '**')
    .setFooter({
      text:
        kind === 'roulette'
          ? 'A conversation starter • no scoring'
          : 'Voting closes in 5 minutes • one vote per person',
    });
  if (kind === 'roulette') return { embeds: [embed], allowedMentions: { parse: [] } };
  const labels = kind === 'trivia' ? q.slice(1, 5) : q.slice(1, 3);
  const row = new ActionRowBuilder().addComponents(
    labels.map((label, i) =>
      new ButtonBuilder()
        .setCustomId('lumira:game:' + id + ':' + i)
        .setLabel(label.slice(0, 75))
        .setStyle(ButtonStyle.Primary),
    ),
  );
  return { embeds: [embed], components: [row], allowedMentions: { parse: [] } };
}
export async function vote(g, channel, id, user, choice) {
  const game = active.get(g + ':' + channel);
  if (!game || game.id !== id || Date.now() > game.ends) throw Error('That round has expired. Start a new one!');
  if (game.kind === 'roulette') throw Error('This is not a voting game');
  if (!Number.isInteger(choice) || choice < 0 || choice >= (game.kind === 'trivia' ? 4 : 2))
    throw Error('Invalid choice');
  if (game.votes[user] !== undefined) throw Error('You already voted this round');
  game.votes[user] = choice;
  const counts = game.kind === 'trivia' ? [0, 0, 0, 0] : [0, 0];
  for (const v of Object.values(game.votes)) counts[v]++;
  let extra = 'Your vote was recorded. Total votes: ' + Object.keys(game.votes).length + '.';
  if (game.kind === 'trivia') {
    const correct = game.q[5];
    if (choice === correct) {
      state(g).scores[user] = (state(g).scores[user] || 0) + 1;
      await save();
      extra += ' Correct! +1 point 🎉';
    } else extra += ' Not quite! The correct answer was ' + game.q[1 + correct] + '.';
  }
  return extra;
}
export function leaderboard(g) {
  return (
    Object.entries(state(g).scores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([u, n], i) => i + 1 + '. <@' + u + '> • ' + n + ' pts')
      .join('\n') || 'No trivia scores yet.'
  );
}
export async function award(g, from, to, title) {
  const s = state(g);
  s.awards.push({ from, to, title: title.slice(0, 75), at: Date.now() });
  s.awards = s.awards.slice(-80);
  await save();
}
export function recentAwards(g) {
  return state(g).awards.slice(-5).reverse();
}
