import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Collection, ChannelType } from 'discord.js';

test('lore remains private until participant and owner approval; rejection and reload work', async () => {
 const dir = await mkdtemp(join(tmpdir(), 'lumira-features-'));
 const old = process.env.LUMIRA_DATA_DIR;
 process.env.LUMIRA_DATA_DIR = dir;
 try {
  const lore = await import('../src/social-lore.js');
  await lore.loadSocialLore();
  const {entry} = await lore.proposeLore('g',{kind:'bond',title:'Friendship',text:'A fictional test friendship',author:'a',members:['a','b']});
  assert.equal(lore.loreEntries('g').length,0);
  await assert.rejects(lore.approveLore('g',entry.id,'owner',true));
  await assert.rejects(lore.approveLore('g',entry.id,'stranger'));
  assert.equal(await lore.approveLore('g',entry.id,'b'),false);
  assert.equal(lore.loreEntries('g').length,0);
  assert.equal(await lore.approveLore('g',entry.id,'owner',true),true);
  await lore.loadSocialLore();
  assert.equal(lore.loreEntries('g')[0].id,entry.id);
  const next = await lore.proposeLore('g',{kind:'joke',title:'Test joke',text:'A fictional joke',author:'a'});
  await lore.rejectLore('g',next.entry.id);
  assert.equal(lore.reviewLore('g').length,0);
  const memory = await import('../src/memory.js');
  await memory.loadMemories();
  await assert.rejects(memory.saveMemory('g','a','test'));
  await memory.enableMemory('g','a');
  await memory.saveMemory('g','a','test');
  await memory.loadMemories();
  assert.deepEqual(memory.memoryStatus('g','a').items,['test']);
  assert.equal(memory.memoryStatus('g','b').enabled,false);
  await memory.disableMemory('g','a');
  assert.equal(memory.memoryStatus('g','a').enabled,false);
 } finally {
  if(old===undefined) delete process.env.LUMIRA_DATA_DIR; else process.env.LUMIRA_DATA_DIR=old;
  await rm(dir,{recursive:true,force:true});
 }
});

test('welcome and goodbye route correctly, suppress mentions and respect permissions', async () => {
 const {announceMember} = await import('../src/member-events.js');
 const sent=[];
 let allowed=true;
 const channels=new Collection(['welcome','goodbye'].map(name=>[name,{name,type:ChannelType.GuildText,send:async payload=>sent.push({name,...payload})}]));
 const member={user:{username:'@everyone'},guild:{channels:{cache:channels},members:{fetchMe:async()=>({permissionsIn:()=>({has:()=>allowed})})}}};
 await announceMember(member,true);
 await announceMember(member,false);
 assert.deepEqual(sent.map(x=>x.name),['welcome','goodbye']);
 assert.ok(sent.every(x=>x.allowedMentions.parse.length===0));
 allowed=false;
 await assert.rejects(announceMember(member,true));
 assert.equal(sent.length,2);
});
