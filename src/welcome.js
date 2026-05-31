import { EmbedBuilder } from 'discord.js';
import { config } from './config.js';

export async function sendWelcome(member) {
  const { guild } = member;
  const { hosgeldinKanalId, karsilamaRoleId, kurallarKanalId, duyurularKanalId } = config.welcome;

  const welcomeCh = guild.channels.cache.get(hosgeldinKanalId);
  if (!welcomeCh) {
    console.warn('⚠️ HOSGELDIN_KANAL_ID bulunamadı, hoşgeldin mesajı gönderilemedi.');
    return;
  }

  const kurallarMention  = kurallarKanalId  ? `<#${kurallarKanalId}>`  : '`#kurallar`';
  const duyurularMention = duyurularKanalId ? `<#${duyurularKanalId}>` : '`#duyurular`';
  const roleMention      = karsilamaRoleId  ? `<@&${karsilamaRoleId}>` : '';

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
      { name: '👤 Kullanıcı', value: `${member.user.tag}`, inline: true },
      { name: '🆔 ID',        value: member.user.id,        inline: true },
      { name: '📅 Hesap Oluşturma', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
      { name: '👥 Üye Sayısı', value: `${guild.memberCount}. üye`, inline: true },
    )
    .setFooter({ text: 'Natsu Animanga • Hoş Geldin!' })
    .setTimestamp();

  const content = `${member}${roleMention ? ` ${roleMention}` : ''}`;

  await welcomeCh.send({ content, embeds: [embed] }).catch(console.error);

  if (karsilamaRoleId) {
    const role = guild.roles.cache.get(karsilamaRoleId);
    if (role) await member.roles.add(role, 'Otomatik karşılama rolü').catch(() => {});
  }
}
