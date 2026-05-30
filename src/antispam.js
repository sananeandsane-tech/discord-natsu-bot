import { PermissionFlagsBits } from 'discord.js';
import { config } from './config.js';
import { logCeza } from './logger.js';

const messageTracker = new Map();

export async function handleAntiSpam(message) {
  const { guild, author, member, channel } = message;
  if (!member || author.bot) return;
  if (member.permissions.has(PermissionFlagsBits.ManageMessages)) return;

  const key = `${guild.id}:${author.id}`;
  const now = Date.now();
  const { windowMs, messageLimit, timeoutMs } = config.antispam;

  if (!messageTracker.has(key)) messageTracker.set(key, []);
  const timestamps = messageTracker.get(key).filter(t => now - t < windowMs);
  timestamps.push(now);
  messageTracker.set(key, timestamps);

  if (timestamps.length >= messageLimit) {
    messageTracker.delete(key);

    if (!member.moderatable) return;

    try {
      await member.timeout(timeoutMs, 'Anti-Spam: Çok hızlı mesaj gönderimi');
    } catch (err) {
      console.warn('Antispam timeout failed:', err.message);
      return;
    }

    try {
      const msgs = await channel.messages.fetch({ limit: 20 });
      const userMsgs = msgs.filter(m => m.author.id === author.id);
      await channel.bulkDelete(userMsgs, true).catch(() => {});
    } catch {}

    try {
      await author.send(`⏱️ **Anti-Spam:** Çok hızlı mesaj gönderdin! 1 dakika susturuldun.`);
    } catch {}

    await logCeza(guild, {
      target: author,
      moderator: guild.members.me ?? 'Bot',
      action: 'Susturma (Anti-Spam)',
      reason: `${messageLimit} mesaj ${windowMs / 1000}s içinde`,
      duration: '1 dakika',
    });

    try {
      const warn = await channel.send(`⚠️ ${author}, spam yaptığın için 1 dakika susturuldun.`);
      setTimeout(() => warn.delete().catch(() => {}), 6000);
    } catch {}
  }
}
