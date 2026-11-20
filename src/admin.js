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
