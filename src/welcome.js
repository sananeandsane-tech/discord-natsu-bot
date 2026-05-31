import { EmbedBuilder } from 'discord.js';
import { config } from './config.js';

// Deduplication — prevents double welcome if two bot instances fire simultaneously
const recentWelcomes = new Set();

export async function sendWelcome(member) {
  const dedupeKey = `${member.guild.id}:${member.user.id}`;
  if (recentWelcomes.has(dedupeKey)) return;
  recentWelcomes.add(dedupeKey);
  setTimeout(() => recentWelcomes.delete(dedupeKey), 15_000);

  const { guild } = member;
  const { hosgeldinKanalId, karsilamaRoleId, kurallarKanalId, duyurularKanalId } = config.welcome;

  const welcomeCh = guild.channels.cache.get(hosgeldinKanalId);
  if (!welcomeCh) {
    console.warn('⚠️ HOSGELDIN_KANAL_ID bulunamadı, hoşgeldin mesajı gönderilemedi.');
    return;
  }

  // Only mention role if it actually exists in this guild (prevents "bilinmeyen rol")
  const role = karsilamaRoleId ? guild.roles.cache.get(karsilamaRoleId) : null;
  const roleMention = role ? `<@&${role.id}>` : '';

  const kurallarMention  = kurallarKanalId  ? `<#${kurallarKanalId}>`  : '`#kurallar`';
  const duyurularMention = duyurularKanalId ? `<#${duyurularKanalId}>` : '`#duyurular`';

  const embed = new EmbedBuilder()
    .setColor(0xff6b35)
    .setTitle('🎉 Natsu Animanga\'ya Hoşgeldin!')
    .setDescription(
      `Merhaba ${member}! **Natsu Animanga** ailesine katıldığın için çok mutluyuz! 🌟\n\n` +
      `📜 Kurallarımızı okumayı unutma: ${kurallarMention}\n` +
      `📢 Güncel duyurular için: ${duyurularMention}\n\n` +
      `Eğlenceli vakit geçirmeni dileriz! 🍜`
    )
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .addFields(
      { name: '👤 Kullanıcı',      value: `${member.user.tag}`,                                                inline: true },
      { name: '🆔 ID',             value: member.user.id,                                                      inline: true },
      { name: '📅 Hesap Oluşturma', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,         inline: true },
      { name: '👥 Üye Sayısı',     value: `${guild.memberCount}. üye`,                                        inline: true },
    )
    .setFooter({ text: 'Natsu Animanga • Hoş Geldin!' })
    .setTimestamp();

  // content: user ping + role ping (only if role exists)
  const content = `${member}${roleMention ? ` ${roleMention}` : ''}`;

  await welcomeCh.send({ content, embeds: [embed] }).catch(console.error);

  // Assign role after sending so the message always shows, even if role assign fails
  if (role) {
    await member.roles.add(role, 'Otomatik karşılama rolü').catch(() => {});
  }
}
