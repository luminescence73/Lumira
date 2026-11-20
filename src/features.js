import {promises as fs} from 'node:fs';
import path from 'node:path';
const file=path.join(process.env.LUMIRA_DATA_DIR||'/data','features.json');
let db={};let queue=Promise.resolve();
export async function loadFeatures(){try{db=JSON.parse(await fs.readFile(file,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e;db={}}console.log('Lumira feature controls loaded')}
function state(g){return db[g]||(db[g]={settings:{autoLore:true,autoScrapbook:true,spontaneous:true,roasts:true,photoBooth:true,characterCards:true,collages:true},egos:{},scrapbookOptOut:{},excludedChannels:[],mutedMembers:{}})}
export function settings(g){return {...state(g).settings}}
export async function setSetting(g,k,v){if(!['autoLore','autoScrapbook','spontaneous','roasts','photoBooth','characterCards','collages'].includes(k))throw Error('Unknown setting');state(g).settings[k]=v;await save()}
export function scrapbookAllowed(g,u){return !state(g).scrapbookOptOut?.[u]}
export async function setScrapbookOptOut(g,u,off){const s=state(g);s.scrapbookOptOut||={};if(off)s.scrapbookOptOut[u]=true;else delete s.scrapbookOptOut[u];await save()}
export function channelAllowed(g,c){return !(state(g).excludedChannels||[]).includes(c)}
export function excludedChannels(g){return [...(state(g).excludedChannels||[])]}
export async function setChannelAllowed(g,c,allowed){const s=state(g);s.excludedChannels||=[];s.excludedChannels=s.excludedChannels.filter(x=>x!==c);if(!allowed)s.excludedChannels.push(c);await save()}
export function memberMuted(g,u){return Boolean(state(g).mutedMembers?.[u])}
export async function setMemberMuted(g,u,muted){const s=state(g);s.mutedMembers||={};if(muted)s.mutedMembers[u]=true;else delete s.mutedMembers[u];await save()}
export function personality(g){return state(g).personality||'chaotic'}
export async function setPersonality(g,value){if(!['chaotic','cozy','witty'].includes(value))throw Error('Unknown personality');state(g).personality=value;await save()}
export function getEgo(g,u){return state(g).egos[u]||null}
export async function setEgo(g,u,value){state(g).egos[u]=value;await save()}
export async function clearEgo(g,u){delete state(g).egos[u];await save()}
async function save(){const payload=JSON.stringify(db);queue=queue.catch(()=>{}).then(async()=>{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file+'.tmp',payload,{mode:0o600});await fs.rename(file+'.tmp',file)});await queue}
