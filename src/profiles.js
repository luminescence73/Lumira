import {promises as fs} from 'node:fs';
import path from 'node:path';
import {EmbedBuilder} from 'discord.js';
const file=path.join(process.env.LUMIRA_DATA_DIR||'/data','profiles.json');
let db={},writes=Promise.resolve();
export async function loadProfiles(){try{db=JSON.parse(await fs.readFile(file,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e;db={}}}
function entries(g){return db[g]||(db[g]={})}
async function save(){const data=JSON.stringify(db);writes=writes.catch(()=>{}).then(async()=>{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file+'.tmp',data,{mode:0o600});await fs.rename(file+'.tmp',file)});await writes}
export function profile(g,u){return entries(g)[u]||null}
export async function setProfile(g,u,p){entries(g)[u]=p;await save()}
export async function removeProfile(g,u){entries(g)[u]={optedOut:true};await save()}
export function profileEmbed(user,bio){return new EmbedBuilder().setColor(0x8bbcff).setTitle('✦ '+(user.globalName||user.username).slice(0,80)+' • LumiVibe Profile').setThumbnail(user.displayAvatarURL({size:256})).setDescription(bio).addFields({name:'Member',value:'<@'+user.id+'>'}).setFooter({text:'LumiVibe member card • Customize or remove with /lumira-profile'}).setTimestamp()}
export async function profileChannel(guild){const channels=await guild.channels.fetch();return channels.find(c=>c.name==='cards'&&c.isTextBased()&&c.send)||null}

export async function populateMemberProfiles(guild,rosterData){
 const channel=await profileChannel(guild);if(!channel)throw Error('#cards not found');
 const members=Object.values(rosterData.members||{}).slice(0,150);
 const result={created:0,updated:0,skipped:0,errors:0};
 for(const m of members){
  const saved=profile(guild.id,m.id);
  const isOracle=[m.username,m.displayName,m.globalName].some(n=>String(n||'').trim().toLowerCase()==='oracle');
  if(isOracle){
   if(saved?.messageId&&saved.automatic!==false){try{await (await channel.messages.fetch(saved.messageId)).delete();await removeProfile(guild.id,m.id)}catch(e){console.warn('Oracle card cleanup:',e.message)}}
   result.skipped++;continue;
  }
  // Curated cards are maintained by publishCuratedCards; never replace their embeds with generic ones.
  if(saved?.optedOut||saved?.curated){result.skipped++;continue}
  try{
   const user=await guild.client.users.fetch(m.id);
   if(user.bot){result.skipped++;continue}
   const about=saved?.about||'Part of the LumiVibe community. ✦';
   const embed=profileEmbed(user,about);
   let post=null;
   if(saved?.messageId){try{post=await channel.messages.fetch(saved.messageId);await post.edit({embeds:[embed],allowedMentions:{parse:[]}});result.updated++}catch(e){post=null}}
   if(!post){post=await channel.send({embeds:[embed],allowedMentions:{parse:[]}});result.created++}
   await setProfile(guild.id,m.id,{about,messageId:post.id,updatedAt:Date.now(),automatic:saved?.automatic!==false});
   await new Promise(resolve=>setTimeout(resolve,400));
  }catch(e){result.errors++;console.warn('Member card',m.id,e.message)}
 }
 console.log('LumiVibe member cards:',JSON.stringify(result));return result;
}
