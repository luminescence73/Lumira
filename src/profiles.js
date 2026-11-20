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
export async function removeProfile(g,u){delete entries(g)[u];await save()}
export function profileEmbed(user,bio){return new EmbedBuilder().setColor(0x8bbcff).setTitle('✦ '+(user.globalName||user.username).slice(0,80)+' • LumiVibe Profile').setThumbnail(user.displayAvatarURL({size:256})).setDescription(bio).addFields({name:'Member',value:'<@'+user.id+'>'}).setFooter({text:'Created by this member • Edit or remove with /lumira-profile'}).setTimestamp()}
export async function profileChannel(guild){const channels=await guild.channels.fetch();return channels.find(c=>c.name==='cards'&&c.isTextBased()&&c.send)||null}
