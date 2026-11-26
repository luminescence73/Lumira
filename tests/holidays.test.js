import test from 'node:test';
import assert from 'node:assert/strict';
import { ChannelType } from 'discord.js';
import { holidayFor, createHolidayDelivery } from '../src/holidays.js';
import { LUMIVIBE_GUILD_ID } from '../src/channels.js';
test('Thanksgiving follows fourth Thursday in Central time',()=>{
 assert.match(holidayFor(new Date('2026-11-26T19:00:00Z')).title,/Friendsgiving/);
 assert.equal(holidayFor(new Date('2026-11-26T05:59:00Z')),null);
 assert.match(holidayFor(new Date('2027-11-25T19:00:00Z')).title,/Friendsgiving/);
 assert.match(holidayFor(new Date('2026-12-25T19:00:00Z')).title,/Christmas/);
});
test('celebrations send once across restart, without mentions',async()=>{
 let state={};const sent=[];
 const guild={id:LUMIVIBE_GUILD_ID,roles:{everyone:{}},members:{fetchMe:async()=>({permissionsIn:()=>({has:()=>true})})}};
 const channel={id:'holiday-test',name:'general',type:ChannelType.GuildText,guild,permissionsFor:()=>({has:()=>true}),send:async p=>{sent.push(p);return {id:'sent'}}};
 guild.channels={fetch:async()=>new Map([[channel.id,channel]])};
 const client={guilds:{cache:new Map([[guild.id,guild]])}};
 const options={store:{load:async()=>({...state}),save:async x=>{state=x}},now:()=>new Date('2026-11-26T19:00:00Z')};
 await createHolidayDelivery(client,options)();
 await createHolidayDelivery(client,options)();
 assert.equal(sent.length,1);
 assert.deepEqual(sent[0].allowedMentions,{parse:[]});
 assert.equal(sent[0].enforceNonce,true);
});
