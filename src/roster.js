import {promises as fs} from 'node:fs';
import path from 'node:path';
const file=path.join(process.env.LUMIRA_DATA_DIR||'/data','member-roster.json');
let db={},queue=Promise.resolve();
export async function loadRoster(){try{db=JSON.parse(await fs.readFile(file,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e;db={}}console.log('Lumira private member directory loaded')}
async function save(){const data=JSON.stringify(db);queue=queue.catch(()=>{}).then(async()=>{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file+'.tmp',data,{mode:0o600});await fs.rename(file+'.tmp',file)});await queue}
export async function syncRoster(guild){
 const found=new Map();let complete=false;
 try{const members=await guild.members.fetch({limit:0,withPresences:false});for(const m of members.values())if(!m.user.bot)found.set(m.id,m);complete=true}
 catch(e){console.warn('Full roster fetch unavailable; enable Server Members Intent in Discord Developer Portal and set LUMIRA_MEMBERS_INTENT=true:',e.message);for(const m of guild.members.cache.values())if(!m.user.bot)found.set(m.id,m)}
// When privileged member-list access is unavailable, discover authors of recent
 // public messages only. Do not scan staff or restricted channels.
 if(!complete){
  try{
   const channels=await guild.channels.fetch();
   const everyone=guild.roles.everyone;
   let scanned=0;
   for(const ch of channels.values()){
    if(scanned>=16)break;
    if(!ch?.isTextBased?.()||!ch.messages?.fetch||ch.isThread?.())continue;
    if(!ch.permissionsFor(everyone)?.has('ViewChannel'))continue;
    if(!ch.permissionsFor(guild.members.me)?.has(['ViewChannel','ReadMessageHistory']))continue;
    if(/private|staff|logs|control|bot-|lumi-|heart-of|father|cards/i.test(ch.name))continue;
    scanned++;
    const messages=await ch.messages.fetch({limit:100}).catch(()=>null);
    if(!messages)continue;
    for(const msg of messages.values()){
     if(!msg.author||msg.author.bot)continue;
     found.set(msg.author.id,{id:msg.author.id,user:msg.author,displayName:msg.member?.displayName||msg.author.globalName||msg.author.username});
    }
   }
   console.log('Member directory fallback: public channels scanned',scanned,'authors',found.size);
  }catch(e){console.warn('Public message member discovery failed:',e.message)}
 }
 const prior=db[guild.id]?.members||{};
 const members=complete?{}:{...prior};
 for(const m of found.values())members[m.id]={id:m.id,username:m.user.username,displayName:m.displayName,globalName:m.user.globalName||null,updatedAt:Date.now()};
 db[guild.id]={members,lastSynced:Date.now(),complete};await save();
 console.log('Member directory synced:',found.size,'complete:',complete);
 return {count:Object.keys(members).length,complete};
}
export function roster(g){return db[g]||{members:{},complete:false,lastSynced:null}}
export function findMembers(g,term){const q=term.trim().toLowerCase();if(!q)return [];return Object.values(roster(g).members).filter(m=>[m.id,m.username,m.displayName,m.globalName].some(x=>String(x||'').toLowerCase().includes(q))).slice(0,20)}
