import {promises as fs} from 'node:fs';
import path from 'node:path';
const file=path.join(process.env.LUMIRA_DATA_DIR||'/data','lore.json');
let db={};let queue=Promise.resolve();
export async function loadLore(){try{db=JSON.parse(await fs.readFile(file,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e;db={}}console.log('LumiVibe lore store ready')}
function state(g){return db[g]||(db[g]={jokes:[],moments:[]})}
async function save(){const payload=JSON.stringify(db);queue=queue.catch(()=>{}).then(async()=>{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file+'.tmp',payload,{mode:0o600});await fs.rename(file+'.tmp',file)});await queue}
export function jokes(g){return state(g).jokes.slice(-30)}
export function moments(g){return state(g).moments.slice(-30)}
export async function addJoke(g,text,by){const s=state(g);if(s.jokes.length>=60)throw Error('Lore library full (60). Remove an entry first.');s.jokes.push({text,by,at:Date.now()});await save()}
export async function deleteJoke(g,index){const s=state(g);if(index<1||index>s.jokes.length)throw Error('No joke with that number');s.jokes.splice(index-1,1);await save()}
export async function addMoment(g,m){const s=state(g);if(s.moments.some(x=>x.messageId===m.messageId))throw Error('That moment is already saved');s.moments.push(m);if(s.moments.length>60)s.moments.shift();await save()}
export async function deleteMoment(g,index){const s=state(g);if(index<1||index>s.moments.length)throw Error('No moment with that number');s.moments.splice(index-1,1);await save()}
