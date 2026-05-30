import { SlashCommandBuilder, EmbedBuilder, ChannelType } from 'discord.js';
import { getWeeklyStats } from '../db.js';

export default {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Sunucu hakkında detaylı bilgi ve haftalık istatistikler'),

  async execute(interaction) {
    await interaction.deferReply();
    const { guild } = interaction;

    await guild.fetch();
    const members = await guild.members.fetch();

    const bots   = members.filter(m => m.user.bot).size;
    const humans = members.size - bots;
    const online = members.filter(m => m.presence?.status !== 'offline' && !m.user.bot).size;

    const textChannels  = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
    const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
    const categories    = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size;

    const stats = getWeeklyStats(guild.id);

    const boostBar = '⬆️'.repeat(Math.min(guild.premiumSubscriptionCount ?? 0, 10));

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📋 ${guild.name}`)
      .setThumbnail(guild.iconURL({ size: 256 }))
      .setImage(guild.bannerURL({ size: 1024 }) ?? null)
      .addFields(
        { name: '🆔 Sunucu ID', value: guild.id, inline: true },
        { name: '👑 Sahip', value: `<@${guild.ownerId}>`, inline: true },
        { name: '📅 Oluşturma', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },

        { name: '👥 Üyeler', value: `Toplam: **${members.size}**\nİnsan: **${humans}** · Bot: **${bots}**\nÇevrimiçi: **${online}**`, inline: true },
        { name: '📺 Kanallar', value: `Metin: **${textChannels}**\nSes: **${voiceChannels}**\nKategori: **${categories}**`, inline: true },
        { name: '🎭 Roller', value: `**${guild.roles.cache.size}** rol`, inline: true },

        { name: '✨ Nitro Boost', value: `Seviye **${guild.premiumTier}** · **${guild.premiumSubscriptionCount ?? 0}** boost\n${boostBar || 'Boost yok'}`, inline: true },
        { name: '🔒 Doğrulama', value: verificationLabel(guild.verificationLevel), inline: true },
        { name: '😀 Emojiler', value: `**${guild.emojis.cache.size}** emoji`, inline: true },

        {
          name: '📊 Haftalık İstatistikler (7 gün)',
          value: [
            `💬 Gönderilen mesaj: **${stats.messages.toLocaleString()}**`,
            `🆕 Katılan üye: **${stats.joins}**`,
            `🚪 Ayrılan üye: **${stats.leaves}**`,
            `🛡️ Ceza sayısı: **${stats.punishments}**`,
          ].join('\n'),
        },
      )
      .setFooter({ text: `Özellik: ${guild.features.length > 0 ? guild.features.slice(0, 3).join(', ') : 'Yok'}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

function verificationLabel(level) {
  return ['Yok', 'Düşük', 'Orta', 'Yüksek', 'Çok Yüksek'][level] ?? 'Bilinmiyor';
}
