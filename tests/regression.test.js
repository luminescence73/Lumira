import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isQuotaFailure,retryDelay} from '../src/gemini-quota.js';
import {lumiVibeCanonContext} from '../src/lumivibe-canon.js';

test('Gemini quota fallback recognizes rate limits',()=>{
  assert.equal(isQuotaFailure(429),true);
  assert.equal(isQuotaFailure(403,'RESOURCE_EXHAUSTED quota'),true);
  assert.equal(isQuotaFailure(403,'forbidden'),false);
  assert.equal(retryDelay({headers:new Headers({'retry-after':'3'})}),3000);
});

test('permanent canon retains owner corrections',()=>{
  const lore=lumiVibeCanonContext();
  for(const phrase of ['Meguka','Megumin','Meat Shield Moonie','Dante','Ashen Warriors','Kiz','rock climbing','strats']){
    assert.ok(lore.includes(phrase),'Missing lore: '+phrase);
  }
});

test('curated cards retain Discord IDs and member opt-out',()=>{
  const cards=readFileSync(new URL('../src/curated-cards.js',import.meta.url),'utf8');
  for(const id of ['1495189750162657400','1272841728952369172','224399760616980481'])assert.ok(cards.includes(id));
  assert.ok(cards.includes('optedOut'));
  assert.ok(cards.includes('duplicate.delete()'));
});

test('member sync never overwrites curated profile cards',()=>{
  const profiles=readFileSync(new URL('../src/profiles.js',import.meta.url),'utf8');
  assert.ok(profiles.includes('saved?.curated'));
});
