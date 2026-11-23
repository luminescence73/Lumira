import { createHash } from 'node:crypto';
import { dueEvents, finishEvent } from './events.js';

export function createReminderDelivery(
  client,
  { channelAllowed, publicSocialChannel, getDue = dueEvents, finish = finishEvent, now = Date.now },
) {
  let running = false;
  return async function deliverReminders() {
    if (running) return;
    running = true;
    try {
      for (const { guildId, event } of getDue(now())) {
        try {
          if (!channelAllowed(guildId, event.channel) || now() - event.when > 7 * 86400_000) {
            await finish(event);
            continue;
          }
          const channel = await client.channels.fetch(event.channel);
          if (channel?.guildId === guildId && publicSocialChannel(channel) && channel.isTextBased()) {
            // An enforced nonce avoids duplicate sends on immediate retries after a partial failure.
            await channel.send({
              content: '📅 **LumiVibe event:** ' + event.title,
              allowedMentions: { parse: [] },
              nonce:
                event.id ||
                createHash('sha256')
                  .update(event.channel + ':' + event.when + ':' + event.title)
                  .digest('hex')
                  .slice(0, 24),
              enforceNonce: true,
            });
          }
          await finish(event);
        } catch (error) {
          // Missing channels or permissions will not become valid by retrying each minute.
          if ([10003, 50001, 50013].includes(error.code)) await finish(event);
          else console.warn('Event reminder could not be delivered to', event.channel, error.message);
        }
      }
    } catch (error) {
      console.error('Event reminder tick failed:', error.message);
    } finally {
      running = false;
    }
  };
}
