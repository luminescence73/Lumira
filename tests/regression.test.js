import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isQuotaFailure, retryDelay } from '../src/gemini-quota.js';
import { lumiVibeCanonContext } from '../src/lumivibe-canon.js';

test('Gemini quota fallback recognizes rate limits', () => {
  assert.equal(isQuotaFailure(429), true);
  assert.equal(isQuotaFailure(403, 'RESOURCE_EXHAUSTED quota'), true);
  assert.equal(isQuotaFailure(403, 'forbidden'), false);
  assert.equal(retryDelay({ headers: new Headers({ 'retry-after': '3' }) }), 3000);
});

test('permanent canon retains owner corrections', () => {
  const lore = lumiVibeCanonContext();
  for (const phrase of [
    'Meguka',
    'Megumin',
    'Meat Shield Moonie',
    'Dante',
    'Ashen Warriors',
    'Kiz',
    'rock climbing',
    'strats',
  ]) {
    assert.ok(lore.includes(phrase), 'Missing lore: ' + phrase);
  }
});

test('curated cards retain Discord IDs and member opt-out', () => {
  const cards = readFileSync(new URL('../src/curated-cards.js', import.meta.url), 'utf8');
  for (const id of ['1495189750162657400', '1272841728952369172', '224399760616980481', '237586130038423552'])
    assert.ok(cards.includes(id));
  assert.ok(cards.includes('optedOut'));
  assert.ok(cards.includes('duplicate.delete()'));
});

test('member sync never overwrites curated profile cards', () => {
  const profiles = readFileSync(new URL('../src/profiles.js', import.meta.url), 'utf8');
  assert.ok(profiles.includes('saved?.curated'));
});

import {
  courtPrompt,
  roastRound,
  quoteSubmit,
  quoteRound,
  guessQuote,
  emojiForSocialMessage,
} from '../src/social-games.js';
test('diva court validates low-stakes prompts', () => {
  assert.match(courtPrompt('Someone ate the last cookie'), /DIVA COURT/);
  assert.throws(() => courtPrompt('no'), /8–400/);
});
test('roast battles only target a consenting participant and have a round limit', () => {
  const g = 'test-roast',
    c = 'test';
  assert.equal(roastRound(g, c, 'a').done, false);
  assert.throws(() => roastRound(g, c, 'b'), /stage/);
  for (let i = 0; i < 4; i++) roastRound(g, c, 'a');
  assert.equal(roastRound(g, c, 'a').done, true);
});
test('Who Said That uses submitted quotes and checks guesses', () => {
  const g = 'test-quote',
    c = 'test';
  quoteSubmit(g, c, 'a', 'I am the cookie queen');
  quoteSubmit(g, c, 'b', 'My dragon ate the homework');
  const round = quoteRound(g, c);
  assert.ok(round.quote);
  assert.equal(guessQuote(g, c, 'someone-else').correct, false);
});
test('emoji reactions use low-risk social triggers', () => {
  assert.equal(emojiForSocialMessage('that was so funny lol'), '😭');
  assert.equal(emojiForSocialMessage('slay queen'), '💅');
  assert.equal(emojiForSocialMessage('here is my private link https://example.com'), null);
});

import { classificationAction, uniqueEmojiName } from '../src/emoji-visual.js';
test('emoji classifier revisits legacy prefixes and stale review entries', () => {
  assert.equal(classificationAction({ name: 'pika_unknown' }, undefined), 'scan');
  assert.equal(classificationAction({ name: 'pika_old' }, { status: 'renamed', name: 'pika_old' }), 'scan');
  assert.equal(classificationAction({ name: 'anime_old' }, { status: 'review', at: 1 }, Date.now()), 'scan');
  assert.equal(
    classificationAction({ name: 'animal_cat' }, { version: 2, status: 'verified', name: 'animal_cat' }),
    'skip',
  );
});
test('emoji naming produces unique subject-based names', () => {
  assert.equal(uniqueEmojiName('pika', 'pikachu_laughing', new Set(), 'old'), 'pika_pikachu_laughing');
  assert.equal(
    uniqueEmojiName('meme', 'pepe_laughing', new Set(['meme_pepe_laughing']), 'old'),
    'meme_pepe_laughing_2',
  );
  assert.throws(() => uniqueEmojiName('unknown', 'face', new Set(), 'old'));
});


test('social lore requires both members to approve friendship dynamics',async()=>{
 process.env.LUMIRA_DATA_DIR = (await import('node:fs/promises')).mkdtemp
   ? await (await import('node:fs/promises')).mkdtemp((await import('node:path')).join((await import('node:os')).tmpdir(), 'lumira-social-lore-'))
   : '/tmp/lumira-regression-social-lore';
 const {loadSocialLore,proposeLore,loreEntries,pendingLore,approveLore,deleteSocialLore,socialLoreContext} = await import('../src/social-lore.js');
 await loadSocialLore();
 const guild='test-'+Date.now();
 const {entry,pending}=await proposeLore(guild,{kind:'bond',title:'Gaming duo',text:'They always queue together for games',author:'100',members:['100','200']});
 assert.equal(pending,true);
 assert.equal(loreEntries(guild).length,0);
 assert.equal(pendingLore(guild,'200').length,1);
 assert.equal(await approveLore(guild,entry.id,'200'),true);
 assert.equal(loreEntries(guild,{memberId:'100'}).length,1);
 assert.match(socialLoreContext(guild,'200'),/Gaming duo/);
 await deleteSocialLore(guild,entry.id,'200');
 assert.equal(loreEntries(guild).length,0);
});
