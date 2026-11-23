import { Events } from 'discord.js';
import { bump } from './cards.js';
import { publicSocialChannel } from './channels.js';
import { memberMuted, scrapbookAllowed, settings } from './features.js';
import { addJoke, addMoment, jokes, moments, removeMessageMoment } from './lore.js';

export function installAutomaticLore(client) {
  const phraseSignals = new Map();
  const automaticMomentCooldown = new Set();
  function safeSharedPhrase(text) {
    const t = text.trim().replace(/\s+/g, ' ');
    if (t.length < 9 || t.length > 85 || t.split(' ').length < 2 || t.split(' ').length > 12) return null;
    if (
      /https?:|www\.|@|<|>|\d{3,}|\b(?:address|phone|password|diagnos\w*|suicid\w*|medicat\w*|trauma|hospital|therapy|pregnan\w*|abuse)\b/i.test(
        t,
      )
    )
      return null;
    if (/[?!]{3,}/.test(t)) return null;
    return t;
  }
  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (user.bot) return;
    try {
      if (reaction.partial) reaction = await reaction.fetch();
      const message = reaction.message.partial ? await reaction.message.fetch() : reaction.message;
      if (
        !message.inGuild() ||
        message.author.bot ||
        !publicSocialChannel(message.channel) ||
        !settings(message.guildId).autoScrapbook ||
        memberMuted(message.guildId, message.author.id) ||
        !scrapbookAllowed(message.guildId, message.author.id) ||
        !message.content?.trim()
      )
        return;
      if (
        message.content.length > 1000 ||
        /\b(?:password|address|phone number|medical|therapy)\b/i.test(message.content)
      )
        return;
      const unique = new Set();
      for (const r of message.reactions.cache.values()) {
        if (r.count < 2) continue;
        const users = await r.users.fetch({ limit: 50 });
        for (const u of users.values()) if (!u.bot) unique.add(u.id);
        if (unique.size >= 5) break;
      }
      if (
        !publicSocialChannel(message.channel) ||
        memberMuted(message.guildId, message.author.id) ||
        !scrapbookAllowed(message.guildId, message.author.id) ||
        unique.size < 5 ||
        automaticMomentCooldown.has(message.id) ||
        moments(message.guildId).some((m) => m.messageId === message.id)
      )
        return;
      automaticMomentCooldown.add(message.id);
      if (automaticMomentCooldown.size > 2000) automaticMomentCooldown.clear();
      await addMoment(message.guildId, {
        messageId: message.id,
        url: message.url,
        by: 'auto',
        author: message.author.id,
        at: Date.now(),
      });
      bump(message.guildId, 'scrapbook');
      console.log('Auto-saved highly reacted public scrapbook moment');
    } catch (e) {
      console.error('Auto scrapbook skipped:', e.message);
    }
  });

  client.on(Events.MessageDelete, async (message) => {
    if (!message.guildId) return;
    try {
      await removeMessageMoment(message.guildId, message.id);
    } catch (e) {
      console.error('Scrapbook deletion sync:', e.message);
    }
  });
}
