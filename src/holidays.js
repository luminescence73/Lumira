import { createHash } from 'node:crypto';
import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { LUMIVIBE_GUILD_ID, publicSocialChannel } from './channels.js';
import { jsonStore } from './json-store.js';

const fixed = {
 '01-01':['🎆 New Year','What is one tiny goal or ridiculous prediction for this year?'],
 '02-14':['💌 Friendship Valentine','Give a friend a wholesome compliment or invent a terrible pickup line.'],
 '04-01':['🃏 April Fools','Invent an absurd fake patch note for our friend group. Keep pranks harmless!'],
 '07-04':['🎇 Fourth of July','Describe your ideal summer cookout or vote for the best snack.'],
 '10-31':['🎃 Halloween','Pitch a spooky costume for yourself or share a favorite spooky story.'],
 '12-24':['🕯️ Christmas Eve','Share a cozy tradition, favorite winter snack, or fictional gift.'],
 '12-25':['🎄 Christmas','Give someone a fictional gift or share your favorite holiday memory.'],
 '12-31':['✨ New Year’s Eve','Nominate a funny moment from this year or predict next year’s group lore.'],
};
export function holidayFor(now = new Date()) {
 const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short'}).formatToParts(now).map(p=>[p.type,p.value]));
 const {year,month,day,weekday}=parts;
 const event = month==='11' && weekday==='Thu' && Number(day)>=22 && Number(day)<=28
 ? ['🦃 LumiVibe Friendsgiving','**Gratitude table:** Give a friend a little appreciation.\n**Dinner debate:** Which food deserves to be banned from Thanksgiving?\n**Friendsgiving awards:** Nominate someone for funniest moment or best teammate.'] : fixed[month+'-'+day];
 return event ? {key:year+'-'+month+'-'+day,title:event[0],prompt:event[1]} : null;
}
export function createHolidayDelivery(client,{store=jsonStore('holiday-celebrations.json'),now=()=>new Date()}={}) {
 let running=false;
 return async ()=>{
 if(running)return;
 running=true;
 try {
 const event=holidayFor(now());
 if(!event)return;
 const guild=client.guilds.cache.get(LUMIVIBE_GUILD_ID);
 if(!guild)return;
 const state=await store.load();
 if(state[event.key])return;
 const channels=await guild.channels.fetch();
 const me=await guild.members.fetchMe();
 const candidates=[...channels.values()].filter(c=>c?.type===ChannelType.GuildText && publicSocialChannel(c) && me.permissionsIn(c).has([PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages]));
 const normalize=c=>c.name.toLowerCase().replace(/[^a-z]/g,'');
 const channel=candidates.find(c=>['general','generalchat','chat','mainchat','lounge','social','hangout'].includes(normalize(c))) || candidates.find(c=>/generalchat|general|lounge|mainchat/.test(normalize(c)));
 if(!channel){console.warn('Lumira holiday: no eligible general chat');return;}
 const message=await channel.send({content:'## '+event.title+'\n'+event.prompt+'\n\nJoin in if you feel like it! No pressure. 💙',allowedMentions:{parse:[]},nonce:createHash('sha256').update(guild.id+event.key).digest('hex').slice(0,24),enforceNonce:true});
 state[event.key]=message.id;
 await store.save(state);
 console.log('Lumira holiday delivered:',event.key,channel.id);
 }catch(error){console.error('Lumira holiday:',error.message);}
 finally{running=false;}
 };
}
