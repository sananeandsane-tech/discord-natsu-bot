import { PermissionFlagsBits } from 'discord.js';
import { logCeza } from './logger.js';

const BANNED_WORDS = [];
const INVITE_REGEX = /discord(?:\.gg|app\.com\/invite)\/[a-zA-Z0-9]+/i;
const MASS_MENTION_THRESHOLD = 5;

export async function handleAutoMod(message) {
  const { guild, member, content, channel } = message;
  if (!member) return;
  const isStaff = member.permissions.has(PermissionFlagsBits.ManageMessages);
  if (isStaff) return;

  const lower = content.toLowerCase();

  if (BANNED_WORDS.length && BANNED_WORDS.some(w => lower.includes(w))) {
    await autoDelete(message, 'Yasaklı kelime');
    return;
  }

  if (INVITE_REGEX.test(content)) {
    await autoDelete(message, 'İzinsiz Discord davet linki');
    return;
  }

  const mentionCount = message.mentions.users.size + message.mentions.roles.size;
  if (mentionCount >= MASS_MENTION_THRESHOLD) {
    await autoDelete(message, `Toplu mention (${mentionCount} ping)`);
  }
}

async function autoDelete(message, reason) {
  try { await message.delete(); } catch { return; }

  try {
    const warn = await message.channel.send(
      `⚠️ ${message.author}, mesajın kaldırıldı: **${reason}**`
    );
    setTimeout(() => warn.delete().catch(() => {}), 6000);
  } catch {}

  await logCeza(message.guild, {
    target: message.author,
    moderator: 'Auto-Mod',
    action: 'Mesaj Silindi',
    reason,
  });
}
