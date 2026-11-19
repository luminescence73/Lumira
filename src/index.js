import 'dotenv/config';
import { Client, GatewayIntentBits, Events, MessageFlags } from 'discord.js';
const token=process.env.DISCORD_TOKEN;
if(!token) throw new Error('DISCORD_TOKEN is required');
const allowed=new Set((process.env.LUMIRA_CHANNEL_IDS||'').split(',').map(s=>s.trim()).filter(Boolean));
const client=new Client({intents:[GatewayIntentBits.Guilds]});
const cooldown=new Map();
const SYSTEM='You are Lumira, a playful, witty, slightly chaotic but considerate Discord companion in a private adult friend group called LumiVibe. Keep replies brief and conversational. Be funny when appropriate, not mean or intrusive. Do not invent facts about members or their relationships. Do not make jokes about private drama, trauma or sensitive topics. Never pressure participation, never ask generic engagement questions, and never claim to remember messages you have not been given. Avoid pinging @everyone or @here.';
async function replyTo(text){
  if(!process.env.OPENAI_API_KEY) return 'Present and accounted for. ✨ My AI brain is still being connected, but I heard you.';
  const res=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-4.1-mini',messages:[{role:'system',content:SYSTEM},{role:'user',content:text.slice(0,1800)}],max_tokens:160})});
  if(!res.ok) throw new Error('AI request failed: '+res.status);
  const data=await res.json();return (data.choices?.[0]?.message?.content||'My thoughts have left the building.').slice(0,1800);
}
function permitted(channelId){return allowed.size===0||allowed.has(channelId)}
function canRespond(userId){const now=Date.now();if(now-(cooldown.get(userId)||0)<12000)return false;cooldown.set(userId,now);return true}
client.once(Events.ClientReady,c=>console.log('Lumira online as '+c.user.tag));
client.on(Events.InteractionCreate,async interaction=>{
 if(!interaction.isChatInputCommand()||interaction.commandName!=='lumira')return;
 if(!permitted(interaction.channelId))return interaction.reply({content:'Lumira is not enabled in this channel.',flags:MessageFlags.Ephemeral});
 if(!canRespond(interaction.user.id))return interaction.reply({content:'Give me a sec, my brain is buffering. 💙',flags:MessageFlags.Ephemeral});
 await interaction.deferReply();
 try{await interaction.editReply({content:await replyTo(interaction.options.getString('message')),allowedMentions:{parse:[]}})}catch(e){console.error(e);await interaction.editReply('I tripped over a cable. Try again in a moment. 💙')}
});
// Mention replies are disabled until the Message Content intent is authorized.
await client.login(token);
