import {promises as fs} from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import {quotaReady,quotaDelay,isQuotaFailure} from './gemini-quota.js';
const file=path.join(process.env.LUMIRA_DATA_DIR||'/data','emoji-visual.json');
export const EMOJI_CATEGORIES=['pika','sxs','anime','animal','meme','cute','text'];
const allowed=EMOJI_CATEGORIES;
let db={};let writes=Promise.resolve();
async function load(){try{db=JSON.parse(await fs.readFile(file,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e;db={}}}
async function save(){const data=JSON.stringify(db);writes=writes.catch(()=>{}).then(async()=>{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file+'.tmp',data,{mode:0o600});await fs.rename(file+'.tmp',file)});await writes}
export function cleanName(s){return String(s||'').toLowerCase().replace(/[^a-z0-9_]/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'').slice(0,26)}
async function classify(emoji){
 const key=process.env.GEMINI_API_KEY;if(!key)throw Error('Gemini API key unavailable');
 const url=emoji.imageURL({extension:emoji.animated?'gif':'png',size:128});
 const res=await fetch(url,{signal:AbortSignal.timeout(10000)});
 if(!res.ok)throw Error('Emoji image unavailable '+res.status);
 const raw=Buffer.from(await res.arrayBuffer());if(raw.length>1000000)throw Error('Emoji image too large');
 const bytes=await sharp(raw,{animated:false}).resize(128,128,{fit:'contain'}).png().toBuffer();
 const mime='image/png';
 const instructions='Identify what this Discord emoji image DEPICTS, not the emotion. Categories: pika for Pikachu/Pichu/Raichu; sxs for Sword x Staff game characters, logos or icons; anime for identifiable anime art; animal for other animals; meme for obvious meme characters/images; text for mainly written words; cute for cute designs not fitting above. Return ONLY compact JSON {"category":"pika|sxs|anime|animal|meme|cute|text|unknown","subject":"short descriptive subject in lowercase snake_case","confidence":0.0}. If unsure or blurry, use unknown. Name the visible subject accurately; for a reaction face include the expression or action. Do not guess based on the original filename.';
 const model=process.env.GEMINI_MODEL||'gemini-3.5-flash-lite';
 if(!quotaReady(model))throw Error('Gemini quota cooldown active');
 const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{
  method:'POST',headers:{'x-goog-api-key':key,'Content-Type':'application/json'},signal:AbortSignal.timeout(25000),
  body:JSON.stringify({contents:[{role:'user',parts:[{text:instructions},{inlineData:{mimeType:mime,data:bytes.toString('base64')}}]}],generationConfig:{temperature:0,responseMimeType:'application/json',maxOutputTokens:150}})
 });
 if(!response.ok){const detail=await response.text().catch(()=> '');if(isQuotaFailure(response.status,detail))quotaDelay(model,60*60*1000);throw Error('Vision request '+response.status)}
 const body=await response.json();
 const responseText=body.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('')||'';
 const data=JSON.parse(responseText);
 if(!allowed.includes(data.category)||!Number.isFinite(Number(data.confidence)))return {category:'unknown',subject:'',confidence:0};
 return {category:data.category,subject:cleanName(data.subject),confidence:Number(data.confidence)};
}
// Revisit failures after a delay. Never mark an unknown image permanently completed.
const RETRY_MS=6*60*60*1000;
export function classificationAction(emoji,record,now=Date.now()){
 if(record?.status==='renamed'&&record.name===emoji.name)return 'skip';
 if(record?.status==='review'||record?.status==='error')return now-(record.at||0)<RETRY_MS?'skip':'scan';
 // Existing prefixes are not evidence of visual classification: review them once.
 if(record?.status==='verified'&&record.name===emoji.name)return 'skip';
 return 'scan';
}
export function uniqueEmojiName(category,subject,used,current){
 if(!allowed.includes(category))throw Error('Invalid emoji category');
 const base=cleanName(category+'_'+subject).slice(0,32);
 if(base.length<4||base===category+'_')throw Error('Emoji subject missing');
 let name=base,n=2;
 while(used.has(name)&&name!==current.toLowerCase()&&n<=100){const suffix='_'+n++;name=base.slice(0,32-suffix.length)+suffix}
 if(used.has(name)&&name!==current.toLowerCase())throw Error('No available emoji name');
 return name;
}
let running=false;
export async function organizeVisualEmojis(guild,{maxScans=8}={}){
 if(running)return {running:true};running=true;
 try{
  await load();
  const emojis=[...(await guild.emojis.fetch()).values()];
  const guildDb=db[guild.id]||(db[guild.id]={});
  const report={renamed:0,verified:0,review:0,skipped:0,errors:0,remaining:0};
  const used=new Set(emojis.map(e=>e.name.toLowerCase()));
  let scans=0;
  for(const emoji of emojis){
   const record=guildDb[emoji.id];
   if(classificationAction(emoji,record)==='skip'){report.skipped++;continue}
   if(scans>=maxScans){report.remaining++;continue}
   scans++;
   try{
    const result=await classify(emoji);
    if(result.category==='unknown'||result.confidence<0.88||!result.subject){
     guildDb[emoji.id]={status:'review',name:emoji.name,classification:result,at:Date.now()};report.review++;await save();continue;
    }
    const target=uniqueEmojiName(result.category,result.subject,used,emoji.name);
    if(target!==emoji.name){
     await emoji.edit({name:target,reason:'Owner-approved image-based emoji classification'});
     used.delete(emoji.name.toLowerCase());used.add(target);report.renamed++;
    }else report.verified++;
    guildDb[emoji.id]={status:'verified',name:target,previous:emoji.name,classification:result,at:Date.now()};
    await save();
   }catch(e){
    report.errors++;console.error('Visual emoji '+emoji.id+':',e.message);
    guildDb[emoji.id]={status:'error',name:emoji.name,reason:e.message,at:Date.now()};await save();
    if(/429|403|401|cooldown|Vision request 5/.test(e.message))break;
   }
  }
  console.log('LumiVibe visual emoji organization:',JSON.stringify(report));
  return report;
 }finally{running=false}
}
