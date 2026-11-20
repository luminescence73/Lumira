import {promises as fs} from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
const file=path.join(process.env.LUMIRA_DATA_DIR||'/data','emoji-visual.json');
const allowed=['pika','sxs','anime','animal','meme','cute','text'];
let db={};let writes=Promise.resolve();
async function load(){try{db=JSON.parse(await fs.readFile(file,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e;db={}}}
async function save(){const data=JSON.stringify(db);writes=writes.catch(()=>{}).then(async()=>{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file+'.tmp',data,{mode:0o600});await fs.rename(file+'.tmp',file)});await writes}
function cleanName(s){return String(s||'').toLowerCase().replace(/[^a-z0-9_]/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'').slice(0,26)}
async function classify(emoji){
 const key=process.env.GEMINI_API_KEY;if(!key)throw Error('Gemini API key unavailable');
 const url=emoji.imageURL({extension:emoji.animated?'gif':'png',size:128});
 const res=await fetch(url,{signal:AbortSignal.timeout(10000)});
 if(!res.ok)throw Error('Emoji image unavailable '+res.status);
 const raw=Buffer.from(await res.arrayBuffer());if(raw.length>1000000)throw Error('Emoji image too large');
 const bytes=await sharp(raw,{animated:false}).resize(128,128,{fit:'contain'}).png().toBuffer();
 const mime='image/png';
 const instructions='Identify what this Discord emoji image DEPICTS, not the emotion. Categories: pika for Pikachu/Pichu/Raichu; sxs for Sword x Staff game characters, logos or icons; anime for identifiable anime art; animal for other animals; meme for obvious meme characters/images; text for mainly written words; cute for cute designs not fitting above. Return ONLY compact JSON {"category":"pika|sxs|anime|animal|meme|cute|text|unknown","subject":"short descriptive subject in lowercase snake_case","confidence":0.0}. If unsure or blurry, use unknown. Do not guess based on the original filename.';
 const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(process.env.GEMINI_MODEL||'gemini-3.5-flash-lite')+':generateContent',{
  method:'POST',headers:{'x-goog-api-key':key,'Content-Type':'application/json'},signal:AbortSignal.timeout(25000),
  body:JSON.stringify({contents:[{role:'user',parts:[{text:instructions},{inlineData:{mimeType:mime,data:bytes.toString('base64')}}]}],generationConfig:{temperature:0,responseMimeType:'application/json',maxOutputTokens:150}})
 });
 if(!response.ok)throw Error('Vision request '+response.status);
 const body=await response.json();
 const responseText=body.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('')||'';
 const data=JSON.parse(responseText);
 if(!allowed.includes(data.category)||!Number.isFinite(Number(data.confidence)))return {category:'unknown',subject:'',confidence:0};
 return {category:data.category,subject:cleanName(data.subject),confidence:Number(data.confidence)};
}
let running=false;
export async function organizeVisualEmojis(guild){
 if(running)return {running:true};running=true;
 try{
  await load();
  const emojis=[...(await guild.emojis.fetch()).values()];
  const guildDb=db[guild.id]||(db[guild.id]={});
  const report={renamed:0,review:0,skipped:0,errors:0};
  const used=new Set(emojis.map(e=>e.name.toLowerCase()));
  for(const emoji of emojis){
   const record=guildDb[emoji.id];
   if(record?.status==='renamed'||record?.status==='review')continue;
   if(allowed.some(p=>emoji.name.toLowerCase().startsWith(p+'_'))){guildDb[emoji.id]={status:'renamed',name:emoji.name};report.skipped++;continue}
   try{
    const result=await classify(emoji);
    if(result.category==='unknown'||result.confidence<0.88||!result.subject){
     guildDb[emoji.id]={status:'review',name:emoji.name,classification:result};report.review++;await save();continue;
    }
    let base=cleanName(result.category+'_'+result.subject).slice(0,32);
    if(base.length<2){guildDb[emoji.id]={status:'review',name:emoji.name,classification:result};report.review++;await save();continue}
    let target=base,n=2;
    while(used.has(target)&&n<100){const suffix='_'+n++;target=base.slice(0,32-suffix.length)+suffix}
    if(used.has(target))throw Error('Could not find unique emoji name');
    await emoji.edit({name:target,reason:'LumiVibe owner-requested subject-based visual emoji organization'});
    used.add(target);guildDb[emoji.id]={status:'renamed',name:target,previous:emoji.name,classification:result};report.renamed++;
    await save();
   }catch(e){
    report.errors++;console.error('Visual emoji '+emoji.id+':',e.message);
    guildDb[emoji.id]={status:'error',name:emoji.name,reason:e.message,at:Date.now()};await save();
    if(/429|403|401|Vision request 5/.test(e.message))break;
   }
  }
  console.log('LumiVibe visual emoji organization:',JSON.stringify(report));
  return report;
 }finally{running=false}
}
