import {EmbedBuilder} from 'discord.js';
import {roster} from './roster.js';
import {profileChannel,profile,setProfile} from './profiles.js';
// Public-facing descriptions based on Lumi's accounts. No allegations or sensitive personal details.
const cards=[
 {name:'Lumi',aliases:['lumi','luminescence73'],title:'The Creative Spark',about:'LumiVibe’s founder. Loves anime, drawing, and Sword x Staff. Chatty, playful, and frequently popping in and out of conversations.',tags:'🎨 Art • Anime • SxS'},
 {name:'Gracie',aliases:['gracie','bgracie'],title:'The Social Stargazer',about:'Outgoing and welcoming, with a love for astrology and Sword x Staff. A familiar face in the group and a go-to friend for game discussions.',tags:'✨ Astrology • SxS • Community'},
 {name:'Meguka',aliases:['meguka','megumin','megu'],title:'The Competitive Gamer',about:'A dedicated gamer who loves anime, Sword x Staff strategies, and sharing everyday photos and food finds.',tags:'🎮 Gaming • Anime • Strategy'},
 {name:'Shug',aliases:['shug'],title:'The Laid-Back Wildcard',about:'Easygoing, funny, and always ready with an unexpected comment. Loves music, especially older tracks and metal.',tags:'🎸 Music • Humor'},
 {name:'Mitsuto',aliases:['mitsuto','mits'],title:'The Dry-Humor Specialist',about:'Known for sarcasm, offbeat commentary, and a kind side that shows once you get to know him. Enjoys older music and metal.',tags:'🎵 Music • Sarcasm'},
 {name:'Tee',aliases:['tee'],title:'The Loyal Teaser',about:'Loyal, friendly, and fond of teasing the group. Enjoys music and testing Sword x Staff builds.',tags:'🛡️ SxS Builds • Music'},
 {name:'Moonie',aliases:['moonie','moony'],title:'Meat Shield Moony',about:'A sweet, sociable presence in the group, famous for the Meat Shield Moony nickname and frequent “I’m bored” moments.',tags:'💬 Social • Inside Jokes'},
 {name:'Dante',aliases:['dante'],title:'The Playful Instigator',about:'Known for friendly teasing and stirring up laughs in the group.',tags:'😈 Banter • Community'},
 {name:'Kiz',aliases:['kiz'],title:'The Competitive Player',about:'A more reserved gamer who enjoys competitive Sword x Staff and Call of Duty.',tags:'🎮 SxS • Call of Duty'},
 {name:'Oracle',aliases:['oracle'],title:'Hot Tub',about:'A familiar part of the group’s early Sword x Staff history, immortalized by the nickname “Hot Tub.”',tags:'♨️ Inside Jokes • SxS'}
];
const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
export async function publishCuratedCards(guild){
 const channel=await profileChannel(guild);if(!channel)throw Error('#cards not found');
 const directory=Object.values(roster(guild.id).members||{});
 const result={published:0,updated:0,unmatched:[],ambiguous:[],errors:[]};
 for(const item of cards){
  const aliases=new Set(item.aliases.map(norm));
  const matches=directory.filter(m=>[m.username,m.displayName,m.globalName].some(v=>aliases.has(norm(v))));
  if(matches.length!==1){(matches.length?'ambiguous':'unmatched').push(item.name);continue}
  const entry=matches[0],existing=profile(guild.id,entry.id);
  // Respect members' own edited profiles. Never overwrite a member-created card.
  if(existing&&!existing.curated)continue;
  const user=await guild.client.users.fetch(entry.id).catch(()=>null);if(!user){result.errors.push(item.name+': user unavailable');continue}
  const embed=new EmbedBuilder().setColor(0x9ebdff).setTitle('✦ '+item.name+' | '+item.title).setThumbnail(user.displayAvatarURL({size:256})).setDescription(item.about).addFields({name:'Known for',value:item.tags}).setFooter({text:'LumiVibe community card • Based on shared group stories • /lumira-profile to customize or delete'});
  try{
   let message=null;
   if(existing?.messageId)message=await channel.messages.fetch(existing.messageId).catch(()=>null);
   if(message){await message.edit({embeds:[embed],allowedMentions:{parse:[]}});result.updated++}
   else{message=await channel.send({embeds:[embed],allowedMentions:{parse:[]}});result.published++}
   await setProfile(guild.id,entry.id,{about:item.about,messageId:message.id,curated:true,updatedAt:Date.now()});
  }catch(e){result.errors.push(item.name+': '+e.message)}
 }
 console.log('LumiVibe curated cards:',JSON.stringify(result));return result;
}
