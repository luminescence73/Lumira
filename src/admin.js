import {promises as fs} from 'node:fs';
import path from 'node:path';
import {PermissionFlagsBits,ChannelType} from 'discord.js';
import sharp from 'sharp';
const file=path.join(process.env.LUMIRA_DATA_DIR||'/data','admin.json');let db={},queue=Promise.resolve();
export async function loadAdmin(){try{db=JSON.parse(await fs.readFile(file,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e;db={}}console.log('Lumira admin configuration ready')}
const state=g=>db[g]||(db[g]={stickerManagers:[],inviteManagers:[],emojiManagers:[],privateChannels:{},pending:null});
async function save(){const data=JSON.stringify(db);queue=queue.catch(()=>{}).then(async()=>{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file+'.tmp',data,{mode:0o600});await fs.rename(file+'.tmp',file)});await queue}
export function config(g){return state(g)}
export async function authorize(g,kind,user,enabled){const key={sticker:'stickerManagers',emoji:'emojiManagers',invite:'inviteManagers'}[kind];if(!key)throw Error('Invalid access type');const s=state(g);s[key]=s[key].filter(x=>x!==user);if(enabled)s[key].push(user);await save()}
export async function privateAccess(g,channel,user,enabled){const s=state(g);const ids=s.privateChannels[channel]||[];s.privateChannels[channel]=ids.filter(x=>x!==user);if(enabled)s.privateChannels[channel].push(user);await save()}
export function proposals(g){return state(g).pending}
export async function stage(g,proposal){state(g).pending={...proposal,createdAt:Date.now()};await save()}
export async function discard(g){state(g).pending=null;await save()}
export function preview(guild){const s=state(guild.id);const changes=[];const everyone=guild.roles.everyone;
 for(const p of [PermissionFlagsBits.CreateInstantInvite,PermissionFlagsBits.CreateGuildExpressions])if(everyone.permissions.has(p))changes.push('Remove '+(p===PermissionFlagsBits.CreateInstantInvite?'invite creation':'emoji/sticker creation')+' from @everyone');
 for(const channel of guild.channels.cache.values()){if(channel.isThread?.())continue;const allowed=s.privateChannels[channel.id];if(!allowed)continue;changes.push('Restrict '+channel.name+' to owner, bot and '+allowed.length+' named members')}
 return changes}
export async function applyGuild(guild){
 const s=state(guild.id),bot=await guild.members.fetchMe();if(!bot.permissions.has(PermissionFlagsBits.ManageRoles))throw Error('Bot needs Manage Roles');
 const everyone=guild.roles.everyone;
 const remove=PermissionFlagsBits.CreateInstantInvite|PermissionFlagsBits.CreateGuildExpressions;
 await everyone.setPermissions(everyone.permissions.remove(remove),'Lumira owner-approved server invite/expression policy');
 const protectedIds=new Set([guild.ownerId,bot.id]);
 const grantRole=async(kind,perm)=>{const ids=s[kind];const roleName='Lumira '+kind.replace('Managers',' Managers');let role=guild.roles.cache.find(r=>r.name===roleName&&!r.managed);
 if(!role)role=await guild.roles.create({name:roleName,permissions:[],reason:'Lumira owner-approved delegated access'});
 if(role.position>=bot.roles.highest.position)throw Error('Bot role must be above '+roleName);
 await role.setPermissions([perm],'Lumira delegated access');
 for(const member of role.members.values())if(!ids.includes(member.id))await member.roles.remove(role,'Lumira access revoked');
 for(const id of ids){const member=await guild.members.fetch(id).catch(()=>null);if(member)await member.roles.add(role,'Lumira owner-approved delegated access')}
 };
 await grantRole('stickerManagers',PermissionFlagsBits.CreateGuildExpressions);
 await grantRole('emojiManagers',PermissionFlagsBits.CreateGuildExpressions);
 await grantRole('inviteManagers',PermissionFlagsBits.CreateInstantInvite);
 let channels=0;
 for(const [id,ids] of Object.entries(s.privateChannels)){const channel=await guild.channels.fetch(id).catch(()=>null);if(!channel||channel.isThread?.()||!channel.permissionOverwrites)continue;
 await channel.permissionOverwrites.edit(guild.roles.everyone.id,{ViewChannel:false}, {reason:'Lumira owner-approved private channel'});
 await channel.permissionOverwrites.edit(bot.id,{ViewChannel:true,ManageChannels:true},{reason:'Lumira private channel bot access'});

 for(const uid of ids){const member=await guild.members.fetch(uid).catch(()=>null);if(member)await channel.permissionOverwrites.edit(uid,{ViewChannel:true},{reason:'Lumira explicitly authorized access'})}
 channels++;
 }
 await discard(guild.id);return {channels};
}
export function layoutPreview(guild){return guild.channels.cache.filter(c=>!c.isThread?.()).sort((a,b)=>a.rawPosition-b.rawPosition).map(c=>({id:c.id,name:c.name,type:c.type,category:c.parent?.name||null})).slice(0,70)}
export async function makeChannel(guild,name,kind,parent){if(!/^[a-z0-9-]{2,70}$/.test(name))throw Error('Use 2–70 lowercase letters, digits or hyphens');const type=kind==='category'?ChannelType.GuildCategory:kind==='voice'?ChannelType.GuildVoice:ChannelType.GuildText;return guild.channels.create({name,type,parent:kind==='category'?null:parent||null,reason:'Lumira owner-requested channel'})}
export async function imageForEmoji(imageUrl){const res=await fetch(imageUrl);if(!res.ok)throw Error('Could not fetch image');const bytes=Buffer.from(await res.arrayBuffer());if(bytes.length>5e6)throw Error('Image too large');return sharp(bytes).resize(128,128,{fit:'contain',background:'#00000000'}).png().toBuffer()}
export async function imageForSticker(imageUrl){const res=await fetch(imageUrl);if(!res.ok)throw Error('Could not fetch image');const bytes=Buffer.from(await res.arrayBuffer());if(bytes.length>5e6)throw Error('Image too large');const out=await sharp(bytes).resize(320,320,{fit:'contain',background:'#00000000'}).png().toBuffer();if(out.length>512*1024)throw Error('Sticker exceeds Discord 512 KB limit');return out}

export const plannedLayout=[
 {category:'✦ ARRIVALS',channels:['welcome','goodbye']},
 {category:'✦ COMMONS',channels:['general','talk','media','music',"i'm-pissed-off"]},
 {category:'✦ INTERESTS',channels:['anime-manga',"shug's-kitchen","lumi's-art","gracie's-horoscopes",'cards']},
 {category:'✦ GAMING',channels:['game-updates']},
 {category:'✦ ARCHIVES',channels:['scrapbook','milestones']},
 {category:'✦ VOICE LOUNGE',channels:[]},
 {category:'✦ PRIVATE GALLERIES',channels:[],private:true},
 {category:'✦ LUMIRA CONTROL',channels:['liveboard','bot-logs'],private:true}
];
const norm=s=>s.toLowerCase().replace(/[’‘]/g,"'").replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const aliases={"gracie-s-horoscopes":['astrology','horoscopes','gracie-astrology'],"i-m-pissed-off":['im-pissed-off','pissed-off'],"shug-s-kitchen":['shugs-kitchen'],"lumi-s-art":['lumis-art']};
export function layoutPlan(guild){const lines=[];for(const section of plannedLayout){const category=guild.channels.cache.find(x=>x.type===ChannelType.GuildCategory&&norm(x.name)===norm(section.category));lines.push(section.category+(category?' [existing]':' [new]'));for(const name of section.channels){const keys=[norm(name),...(aliases[norm(name)]||[])];const existing=guild.channels.cache.find(x=>x.type===ChannelType.GuildText&&keys.includes(norm(x.name)));lines.push('  #'+name+(existing?' [move/rename '+existing.name+']':' [new]'))}}return lines}
export async function applyLayout(guild){const bot=await guild.members.fetchMe();if(!bot.permissions.has(PermissionFlagsBits.ManageChannels))throw Error('Lumira needs Manage Channels');const report=[];for(let i=0;i<plannedLayout.length;i++){const section=plannedLayout[i];let cat=guild.channels.cache.find(x=>x.type===ChannelType.GuildCategory&&norm(x.name)===norm(section.category));if(!cat){cat=await guild.channels.create({name:section.category,type:ChannelType.GuildCategory,permissionOverwrites:section.private?[{id:guild.roles.everyone.id,deny:[PermissionFlagsBits.ViewChannel]}]:[],reason:'Owner-approved LumiVibe layout'});report.push('Created category '+section.category)}await cat.setPosition(i,{reason:'Owner-approved category order'});if(section.private){if(!cat.permissionOverwrites.cache.has(guild.roles.everyone.id)){await cat.permissionOverwrites.edit(guild.roles.everyone.id,{ViewChannel:false},{reason:'Keep new private category hidden'})}continue}
for(let j=0;j<section.channels.length;j++){const name=section.channels[j],keys=[norm(name),...(aliases[norm(name)]||[])];let ch=guild.channels.cache.find(x=>x.type===ChannelType.GuildText&&keys.includes(norm(x.name)));if(!ch){ch=await guild.channels.create({name,type:ChannelType.GuildText,parent:cat.id,reason:'Owner-approved LumiVibe layout'});report.push('Created #'+name)}else{if(ch.parentId!==cat.id){await ch.setParent(cat.id,{lockPermissions:false,reason:'Owner-approved layout; preserve channel permissions'});report.push('Moved #'+ch.name)}if(norm(ch.name)!==norm(name))await ch.setName(name,'Owner-approved LumiVibe naming')}await ch.setPosition(j,{reason:'Owner-approved channel order'})}
}return report}

export async function applyLayoutOnce(guild){const s=state(guild.id);if(s.layoutVersion>=1)return {alreadyDone:true};const report=await applyLayout(guild);s.layoutVersion=1;await save();return {alreadyDone:false,report}}

const extraChannelDestinations={
 'game-announcements':'✦ GAMING','gift-codes':'✦ GAMING',
 'bot-carl-private':'✦ PRIVATE GALLERIES','carl-bot':'✦ COMMONS',
 'lumi-sxs':'✦ PRIVATE GALLERIES','lumi-private':'✦ PRIVATE GALLERIES',
 'heart-of-the-sea':'✦ PRIVATE GALLERIES','a-father-s-promise':'✦ PRIVATE GALLERIES',
 'sage-sxs':'✦ PRIVATE GALLERIES'
};
export async function finishLayoutOnce(guild){
 const s=state(guild.id);if(s.layoutVersion>=2)return {alreadyDone:true};
 const report=[];const bot=await guild.members.fetchMe();
 if(!bot.permissions.has(PermissionFlagsBits.ManageChannels))throw Error('Lumira needs Manage Channels');
 for(const ch of guild.channels.cache.values()){
  if(ch.type!==ChannelType.GuildText)continue;
  const dest=extraChannelDestinations[norm(ch.name)];if(!dest)continue;
  const cat=guild.channels.cache.find(x=>x.type===ChannelType.GuildCategory&&norm(x.name)===norm(dest));if(!cat){report.push('Missing category '+dest);continue}
  if(ch.parentId===cat.id)continue;
  // Preserve existing per-channel overrides. Never sync with parent when relocating private channels.
  await ch.setParent(cat.id,{lockPermissions:false,reason:'Owner-requested LumiVibe sidebar cleanup'});
  report.push('Moved '+ch.name+' to '+dest);
 }
 s.layoutVersion=2;await save();return {alreadyDone:false,report};
}

export async function populateEmptySectionsOnce(guild){
 const s=state(guild.id);if(s.layoutVersion>=3)return {alreadyDone:true};
 const me=await guild.members.fetchMe();if(!me.permissions.has(PermissionFlagsBits.ManageChannels))throw Error('Lumira needs Manage Channels');
 const report=[];const findCat=name=>guild.channels.cache.find(x=>x.type===ChannelType.GuildCategory&&norm(x.name)===norm(name));
 const voice=findCat('✦ VOICE LOUNGE');const control=findCat('✦ LUMIRA CONTROL');
 if(!voice||!control)throw Error('Voice Lounge or Lumira Control category missing');
 const voiceNames=['Voice','Gaming','Chilling','music'];
 for(let i=0;i<voiceNames.length;i++){
  const name=voiceNames[i];let ch=guild.channels.cache.find(x=>x.type===ChannelType.GuildVoice&&norm(x.name)===norm(name));
  if(!ch){ch=await guild.channels.create({name,type:ChannelType.GuildVoice,parent:voice.id,reason:'Owner-requested voice lounge channels'});report.push('Created voice '+name)}
  else if(ch.parentId!==voice.id){await ch.setParent(voice.id,{lockPermissions:false,reason:'Owner-requested voice lounge'});report.push('Moved voice '+name)}
  await ch.setPosition(i,{reason:'LumiVibe voice lounge order'});
 }
 // Explicitly deny general visibility. Only the owner and bot receive new access grants.
 await control.permissionOverwrites.edit(guild.roles.everyone.id,{ViewChannel:false},{reason:'Private bot control category'});
 await control.permissionOverwrites.edit(await guild.fetchOwner(),{ViewChannel:true},{reason:'Owner access to bot control'});
 await control.permissionOverwrites.edit(me,{ViewChannel:true,ManageChannels:true},{reason:'Lumira access to bot control'});
 for(const name of ['liveboard','bot-logs']){
  let ch=guild.channels.cache.find(x=>x.type===ChannelType.GuildText&&norm(x.name)===norm(name));
  if(!ch){ch=await guild.channels.create({name,type:ChannelType.GuildText,parent:control.id,permissionOverwrites:[
   {id:guild.roles.everyone.id,deny:[PermissionFlagsBits.ViewChannel]},
   {id:guild.ownerId,allow:[PermissionFlagsBits.ViewChannel]},
   {id:me.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.ManageChannels]}
  ],reason:'Owner-requested private Lumira control'});report.push('Created private #'+name)}
  else if(ch.parentId!==control.id){await ch.setParent(control.id,{lockPermissions:false,reason:'Owner-requested Lumira control'});report.push('Moved #'+name)}
  await ch.permissionOverwrites.edit(guild.roles.everyone.id,{ViewChannel:false},{reason:'Keep Lumira control private'});
  await ch.permissionOverwrites.edit(await guild.fetchOwner(),{ViewChannel:true},{reason:'Owner-only Lumira control'});
  await ch.permissionOverwrites.edit(me,{ViewChannel:true},{reason:'Lumira bot control access'});
 }
 s.layoutVersion=3;await save();return {alreadyDone:false,report};
}

export async function reconcileLegacyChannelsOnce(guild){
 const s=state(guild.id);if(s.layoutVersion>=4)return {alreadyDone:true};
 const me=await guild.members.fetchMe();if(!me.permissions.has(PermissionFlagsBits.ManageChannels))throw Error('Manage Channels permission required');
 const report=[];const destinations=[
 ['✦ GAMING',['sword-x-staff','general-gaming']],
 ['✦ ARRIVALS',['new-members']],
 ['✦ INTERESTS',['stars-charts-and-hoe-roscopes']],
 ['✦ VOICE LOUNGE',['voice','gaming','chilling','music']]
 ];
 for(const [name,names] of destinations){
  const cat=guild.channels.cache.find(x=>x.type===ChannelType.GuildCategory&&norm(x.name)===norm(name));if(!cat){report.push('Category missing: '+name);continue}
  for(const ch of guild.channels.cache.values()){
   if(ch.type!==ChannelType.GuildText&&ch.type!==ChannelType.GuildVoice)continue;
   if(!names.includes(norm(ch.name)))continue;
   if(ch.parentId===cat.id)continue;
   await ch.setParent(cat.id,{lockPermissions:false,reason:'Owner-requested final LumiVibe organization'});
   report.push('Moved '+ch.name+' into '+name);
  }
 }
 // Do not create duplicate voice rooms if the original ones are still present.
 const lounge=guild.channels.cache.find(x=>x.type===ChannelType.GuildCategory&&norm(x.name)===norm('✦ VOICE LOUNGE'));
 if(lounge){
  for(const name of ['General VC','Gaming VC','Chill VC']){
   const duplicate=guild.channels.cache.find(x=>x.type===ChannelType.GuildVoice&&norm(x.name)===norm(name)&&x.parentId===lounge.id);
   if(duplicate){report.push('Extra voice room retained: '+name)}
  }
 }
 s.layoutVersion=4;await save();return {alreadyDone:false,report};
}

export async function organizeEverythingOnce(guild){
 const s=state(guild.id);if(s.organizedVersion===1)return {alreadyDone:true};
 const me=await guild.members.fetchMe();if(!me.permissions.has(PermissionFlagsBits.ManageChannels))throw Error('Manage Channels required');
 const groups=[
  {cat:'✦ ARRIVALS',names:['welcome','new-members','goodbye']},
  {cat:'✦ COMMONS',names:['general','talk','media','music','i-m-pissed-off','carl-bot']},
  {cat:'✦ INTERESTS',names:['anime-manga','shug-s-kitchen','lumi-s-art','cosmic-chaos','cards']},
  {cat:'✦ GAMING',names:['game-updates','gift-codes','sword-x-staff','general-gaming']},
  {cat:'✦ ARCHIVES',names:['scrapbook','milestones']},
  {cat:'✦ VOICE LOUNGE',names:['voice','gaming','chilling','music']},
  {cat:'✦ PRIVATE GALLERIES',names:['lumi-private','lumi-sxs','sage-sxs','heart-of-the-sea','a-father-s-promise','bot-carl-private']},
  {cat:'✦ LUMIRA CONTROL',names:['liveboard','bot-logs']}
 ];
 const report=[];
 for(let i=0;i<groups.length;i++){
  const group=groups[i],cat=guild.channels.cache.find(x=>x.type===ChannelType.GuildCategory&&norm(x.name)===norm(group.cat));
  if(!cat){report.push('Missing '+group.cat);continue}
  await cat.setPosition(i,{reason:'Owner-requested LumiVibe category organization'});
  for(let j=0;j<group.names.length;j++){
   const key=group.names[j];
   const candidates=guild.channels.cache.filter(x=>(x.type===ChannelType.GuildVoice||x.type===ChannelType.GuildText)&&norm(x.name)===key);
   const ch=candidates.find(x=>group.cat==='✦ VOICE LOUNGE'?x.type===ChannelType.GuildVoice:x.type===ChannelType.GuildText);
   if(!ch)continue;
   if(ch.parentId!==cat.id){await ch.setParent(cat.id,{lockPermissions:false,reason:'Owner-requested organized sidebar'});report.push('Moved '+ch.name+' to '+group.cat)}
   await ch.setPosition(j,{reason:'Owner-requested organized channel order'});
  }
 }
 s.organizedVersion=1;await save();return {alreadyDone:false,report};
}

export async function restoreOriginalChannelsOnce(guild){
 const s=state(guild.id);if(s.originalChannelFixVersion===1)return {alreadyDone:true};
 const report=[];const all=()=>[...guild.channels.cache.values()].filter(x=>x.type===ChannelType.GuildText);
 const originalAstro=all().find(x=>norm(x.name)==='stars-charts-and-hoe-roscopes');
 const originalGame=all().find(x=>norm(x.name)==='game-announcements');
 if(!originalAstro||!originalGame)throw Error('Original channels not found; refusing to delete or replace anything');
 const preserveOrRemove=async(ch,tag)=>{
  // Never erase existing messages or files: only delete provably empty newly created duplicates.
  let empty=false;try{const messages=await ch.messages.fetch({limit:1});empty=messages.size===0}catch(e){report.push('Could not inspect '+ch.name+': '+e.message)}
  if(empty){await ch.delete('Remove empty Lumira-created duplicate; original channel retained');report.push('Removed empty duplicate '+tag)}
  else{await ch.setName('archive-'+tag+'-'+ch.id.slice(-4),'Preserve existing duplicate content pending review');report.push('Archived nonempty duplicate '+tag)}
 };
 for(const ch of all().filter(x=>['gracies-horoscopes','gracie-s-horoscopes','cosmic-chaos'].includes(norm(x.name))&&x.id!==originalAstro.id))await preserveOrRemove(ch,'horoscopes');
 for(const ch of all().filter(x=>norm(x.name)==='game-updates'&&x.id!==originalGame.id))await preserveOrRemove(ch,'game-updates');
 await originalAstro.setName('cosmic-chaos','Owner-requested rename preserving Gracie original astrology history');
 report.push('Renamed original astrology channel to cosmic-chaos');
 await originalGame.setName('game-updates','Owner-requested rename preserving original game announcements history');
 report.push('Renamed original game-announcements to game-updates');
 const interest=guild.channels.cache.find(x=>x.type===ChannelType.GuildCategory&&norm(x.name)===norm('✦ INTERESTS'));
 const gaming=guild.channels.cache.find(x=>x.type===ChannelType.GuildCategory&&norm(x.name)===norm('✦ GAMING'));
 if(interest&&originalAstro.parentId!==interest.id)await originalAstro.setParent(interest.id,{lockPermissions:false});
 if(gaming&&originalGame.parentId!==gaming.id)await originalGame.setParent(gaming.id,{lockPermissions:false});
 s.originalChannelFixVersion=1;await save();return {alreadyDone:false,report};
}

export async function finishCleanupAndControlOnce(guild){
 const s=state(guild.id);if(s.finalCleanupVersion===1)return {alreadyDone:true};
 const report=[];const all=()=>[...guild.channels.cache.values()];
 const originalAstro=all().find(x=>x.type===ChannelType.GuildText&&norm(x.name)==='cosmic-chaos');
 const originalGame=all().find(x=>x.type===ChannelType.GuildText&&norm(x.name)==='game-updates');
 if(!originalAstro||!originalGame)throw Error('Preserved original channels not found; cleanup halted');
 // User explicitly requested removal of duplicate channels, including the archived game-updates duplicate.
 for(const ch of all()){
  if(ch.type!==ChannelType.GuildText)continue;
  if(ch.id===originalAstro.id||ch.id===originalGame.id)continue;
  if(/^archive-(horoscopes|game-updates)-[a-z0-9]+$/.test(ch.name)||['gracies-horoscopes','gracie-s-horoscopes','stars-charts-and-hoe-roscopes'].includes(norm(ch.name))){
   await ch.delete('Owner requested duplicate channel removal; original channels preserved');report.push('Deleted duplicate #'+ch.name);
  }
 }
 const voice=guild.channels.cache.find(x=>x.type===ChannelType.GuildCategory&&norm(x.name)===norm('✦ VOICE LOUNGE'));
 if(voice){
  const originals=['voice','gaming','chilling','music'].map(n=>all().find(x=>x.type===ChannelType.GuildVoice&&norm(x.name)===n)).filter(Boolean);
  // Extra voice channels were introduced by Lumira; never remove an occupied voice channel.
  for(const name of ['general-vc','gaming-vc','chill-vc']){
   const ch=all().find(x=>x.type===ChannelType.GuildVoice&&norm(x.name)===name&&x.parentId===voice.id);
   if(ch&&originals.length===4){if(ch.members.size===0){await ch.delete('Remove redundant Lumira-created voice room');report.push('Deleted duplicate voice '+ch.name)}else report.push('Kept occupied voice '+ch.name)}
  }
 }
 // Remove only empty categories, never a category still holding channels.
 for(const cat of all().filter(x=>x.type===ChannelType.GuildCategory)){
  if(!guild.channels.cache.some(x=>x.parentId===cat.id)){
   await cat.delete('Owner requested removal of empty categories');report.push('Deleted empty category '+cat.name);
  }
 }
 const control=guild.channels.cache.find(x=>x.type===ChannelType.GuildCategory&&norm(x.name)===norm('✦ LUMIRA CONTROL'));
 if(!control)throw Error('Lumira Control category missing');
 const live=all().find(x=>x.type===ChannelType.GuildText&&norm(x.name)==='liveboard'&&x.parentId===control.id);
 const logs=all().find(x=>x.type===ChannelType.GuildText&&norm(x.name)==='bot-logs'&&x.parentId===control.id);
 if(!live||!logs)throw Error('Lumira Control channels missing');
 const me=await guild.members.fetchMe();
 if(!me.permissionsIn(live).has(PermissionFlagsBits.SendMessages)||!me.permissionsIn(logs).has(PermissionFlagsBits.SendMessages))throw Error('Lumira cannot send messages in control channels');
 await live.send({content:'🦋 **LumiVibe Liveboard**\\nThis is the private home for Lumira activity and server highlights.\\n\\n**Available now:** member directory, scrapbook, games, event reminders, and server customization.\\n**Note:** This is a setup board, not a live-updating dashboard yet.'});
 await logs.send({content:'🔐 **Lumira Bot Logs**\\nPrivate administrative log channel initialized.\\n**Completed setup:** organized server channels, preserved original #cosmic-chaos and #game-updates, removed requested duplicates and empty categories.\\nFurther bot activity logging will require event handlers; this message confirms setup only.'});
 report.push('Posted setup messages in liveboard and bot-logs');
 s.finalCleanupVersion=1;await save();return {alreadyDone:false,report};
}

export async function publishEmojiDirectoryOnce(guild){
 const s=state(guild.id);if(s.emojiDirectoryVersion===1)return {alreadyDone:true};
 const control=guild.channels.cache.find(x=>x.type===ChannelType.GuildCategory&&norm(x.name)===norm('✦ LUMIRA CONTROL'));
 const channel=guild.channels.cache.find(x=>x.type===ChannelType.GuildText&&x.parentId===control?.id&&norm(x.name)==='liveboard');
 if(!channel)throw Error('Liveboard not available for emoji directory');
 const emojis=[...(await guild.emojis.fetch()).values()].sort((a,b)=>a.name.localeCompare(b.name));
 const groups=[['Static',emojis.filter(x=>!x.animated)],['Animated',emojis.filter(x=>x.animated)]];
 const lines=['🧩 **LumiVibe Emoji Directory**','Organized by type and alphabetically. This does not rename emojis or change their IDs.'];
 for(const [label,items] of groups){lines.push('**'+label+' ('+items.length+')**');if(!items.length){lines.push('None');continue}for(const e of items)lines.push(e.toString()+' `:'+e.name+':`')}
 let page='';let posted=0;
 for(const line of lines){if(page.length+line.length+2>1750){await channel.send({content:page});posted++;page=''}page+=(page?'\n':'')+line}
 if(page){await channel.send({content:page});posted++}
 s.emojiDirectoryVersion=1;await save();return {count:emojis.length,messages:posted};
}
