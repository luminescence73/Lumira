import 'dotenv/config';
import { Client, GatewayIntentBits, Events, MessageFlags, SlashCommandBuilder } from 'discord.js';
const token=process.env.DISCORD_TOKEN;
if(!token) throw new Error('DISCORD_TOKEN is required');
const allowed=new Set((process.env.LUMIRA_CHANNEL_IDS||'').split(',').map(s=>s.trim()).filter(Boolean));
const client=new Client({intents:[GatewayIntentBits.Guilds]});
const cooldown=new Map();
const SYSTEM='You are Lumira, a playful, witty, slightly chaotic but considerate Discord companion in a private adult friend group called LumiVibe. Keep replies brief and conversational. Be funny when appropriate, not mean or intrusive. Do not invent facts about members or their relationships. Do not make jokes about private drama, trauma or sensitive topics. Never pressure participation, never ask generic engagement questions, and never claim to remember messages you have not been given. Avoid pinging @everyone or @here.';
async function replyTo(text){
  const key=process.env.GEMINI_API_KEY;
  if(!key) return 'Present and accounted for. ✨ My Gemini brain is waiting for its API key, but I heard you.';
  const preferredModel=process.env.GEMINI_MODEL||'gemini-3.8-flash';
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),20000);
  try {
    const listRes=await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=100',{headers:{'x-goog-api-key':key},signal:controller.signal});
    if(!listRes.ok){console.error('Gemini model discovery failed with HTTP',listRes.status);throw new Error('Gemini API key or model access problem')}
    const catalog=await listRes.json();
    const models=(catalog.models||[]).filter(m=>m.supportedGenerationMethods?.includes('generateContent')).map(m=>m.name.replace('models/',''));
    const candidates=[...new Set([preferredModel,'gemini-3.8-flash','gemini-3.5-flash-lite','gemini-3.1-pro-preview',...models.filter(m=>/flash|pro/.test(m))])].filter(m=>models.includes(m)&&!/tts|audio|image|embedding|live|robotics/i.test(m)).slice(0,8);
    if(!candidates.length){console.error('No supported Gemini text models');throw new Error('No supported Gemini model')}
    let res;
    for(const model of candidates){
      res=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{
        method:'POST',signal:controller.signal,
        headers:{'x-goog-api-key':key,'Content-Type':'application/json'},
        body:JSON.stringify({systemInstruction:{parts:[{text:SYSTEM}]},contents:[{role:'user',parts:[{text:text.slice(0,1800)}]}],generationConfig:{maxOutputTokens:350,temperature:0.9}})
      });
      if(res.ok)break;
      const errorBody=await res.json().catch(()=>({}));
      console.error('Gemini HTTP',res.status,'model',model,'reason',String(errorBody.error?.message||'unknown').slice(0,250));
      if(res.status!==404 && res.status!==400)throw new Error('Gemini API error '+res.status);
    }
    if(!res?.ok)throw new Error('No Gemini model succeeded');
    const data=await res.json();
    const answer=data.candidates?.[0]?.content?.parts?.filter(p=>typeof p.text==='string').map(p=>p.text).join('').trim();
    return (answer||'The cosmic gears are turning, but I have no words right now. ✨').slice(0,1800);
  }finally{clearTimeout(timeout)}
}
function permitted(channelId){return allowed.size===0||allowed.has(channelId)}
function canRespond(userId){const now=Date.now();if(now-(cooldown.get(userId)||0)<12000)return false;cooldown.set(userId,now);return true}
client.once(Events.ClientReady,async c=>{
 console.log('Lumira online as '+c.user.tag);
 const command=new SlashCommandBuilder().setName('lumira').setDescription('Chat with Lumira').addStringOption(o=>o.setName('message').setDescription('What would you like to say?').setRequired(true)).toJSON();
 try {
   if(process.env.DISCORD_GUILD_ID){
     const guild=await c.guilds.fetch(process.env.DISCORD_GUILD_ID);
     await guild.commands.set([command]);
     console.log('Registered /lumira in configured guild');
   } else {
     await c.application.commands.set([command]);
     console.log('Registered /lumira globally (may take time to appear)');
   }
 }catch(error){console.error('Slash command registration failed:',error)}
});
client.on(Events.InteractionCreate,async interaction=>{
 if(!interaction.isChatInputCommand()||interaction.commandName!=='lumira')return;
 if(!permitted(interaction.channelId))return interaction.reply({content:'Lumira is not enabled in this channel.',flags:MessageFlags.Ephemeral});
 if(!canRespond(interaction.user.id))return interaction.reply({content:'Give me a sec, my brain is buffering. 💙',flags:MessageFlags.Ephemeral});
 await interaction.deferReply();
 try{await interaction.editReply({content:await replyTo(interaction.options.getString('message')),allowedMentions:{parse:[]}})}catch(e){console.error(e);await interaction.editReply('I tripped over a cable. Try again in a moment. 💙')}
});
// Mention replies are disabled until the Message Content intent is authorized.
await client.login(token);
