import { EmbedBuilder } from 'discord.js';
import { config, getLevelForXP, getNextLevel } from './config.js';
import { getUser, setUser, getCooldown, setCooldown, recordEvent } from './db.js';

export async function handleXP(message) {
  const { guild, author, channel } = message;
  const now = Date.now();
  const lastXP = getCooldown(guild.id, author.id);

  recordEvent(guild.id, 'message', author.id);

  if (now - lastXP < config.xpCooldownMs) return;

  const user = getUser(guild.id, author.id);
  const oldLevel = getLevelForXP(user.xp);

  user.xp += config.xpPerMessage;
  user.messages = (user.messages || 0) + 1;

  const newLevel = getLevelForXP(user.xp);
  user.level = newLevel.level;

  setUser(guild.id, author.id, user);
  setCooldown(guild.id, author.id, now);

  if (newLevel.level > oldLevel.level) {
    const next = getNextLevel(user.xp);
    const embed = new EmbedBuilder()
      .setColor(newLevel.color)
      .setTitle('⬆️ Seviye Atladı!')
      .setDescription(`${author} **${newLevel.level}. Seviye**'ye ulaştı — ${newLevel.name}!`)
      .addFields(
        { name: 'Toplam XP', value: `${user.xp.toLocaleString()}`, inline: true },
        { name: 'Sonraki Seviye', value: next ? `${next.xpRequired.toLocaleString()} XP (Seviye ${next.level})` : '🏆 Max seviye!', inline: true }
      )
      .setThumbnail(author.displayAvatarURL())
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  }
}
