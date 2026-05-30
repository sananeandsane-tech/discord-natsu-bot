import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getUser, getLeaderboard, getWarnings, getUserWeeklyStats } from '../db.js';
import { getLevelForXP, getNextLevel } from '../config.js';

export default {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Kullanıcı hakkında detaylı bilgi ve haftalık istatistikler')
    .addUserOption(o => o.setName('user').setDescription('Kullanıcı (varsayılan: sen)').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply();
    const target = interaction.options.getUser('user') ?? interaction.user;
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);

    const dbUser  = getUser(interaction.guildId, target.id);
    const level   = getLevelForXP(dbUser.xp);
    const next    = getNextLevel(dbUser.xp);
    const lb      = getLeaderboard(interaction.guildId, 1000);
    const rank    = lb.findIndex(u => u.userId === target.id) + 1;
    const warns   = getWarnings(interaction.guildId, target.id);
    const weekly  = getUserWeeklyStats(interaction.guildId, target.id);

    const progress = next
      ? Math.floor(((dbUser.xp - level.xpRequired) / (next.xpRequired - level.xpRequired)) * 100)
      : 100;
    const bar = '█'.repeat(Math.round(progress / 5)) + '░'.repeat(20 - Math.round(progress / 5));

    const roles = member
      ? member.roles.cache
          .filter(r => r.id !== interaction.guildId)
          .sort((a, b) => b.position - a.position)
          .map(r => r.toString())
          .slice(0, 10)
          .join(' ') || 'Yok'
      : 'Bilinmiyor';

    const flags = target.flags?.toArray().map(f => flagLabel(f)).filter(Boolean).join(', ') || 'Yok';

    const embed = new EmbedBuilder()
      .setColor(member?.displayColor || level.color)
      .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
      .setThumbnail(target.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: '🆔 Kullanıcı ID', value: target.id, inline: true },
        { name: '🤖 Bot?', value: target.bot ? 'Evet' : 'Hayır', inline: true },
        { name: '🏷️ Rozet', value: flags, inline: true },

        { name: '📅 Hesap Oluşturma', value: `<t:${Math.floor(target.createdTimestamp / 1000)}:D>`, inline: true },
        { name: '📥 Katılma Tarihi', value: member?.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>` : 'Bilinmiyor', inline: true },
        { name: '🎨 Renk', value: member?.displayHexColor ?? '#000000', inline: true },

        {
          name: `🎮 Seviye ${level.level} — ${level.name}`,
          value: `${bar} **${progress}%**\n${dbUser.xp.toLocaleString()} / ${next ? next.xpRequired.toLocaleString() : '∞'} XP · Sıra: **${rank > 0 ? `#${rank}` : '—'}**`,
        },

        {
          name: '📊 Haftalık İstatistikler (7 gün)',
          value: [
            `💬 Mesaj: **${weekly.messages}**`,
            `⚠️ Uyarı: **${weekly.warns}**`,
          ].join(' · '),
          inline: false,
        },

        { name: `⚠️ Uyarılar (${warns.length})`, value: warns.length ? warns.slice(-3).map((w, i) => `${i + 1}. ${w.reason}`).join('\n') : 'Uyarı yok', inline: false },
        { name: `🎭 Roller (${member?.roles.cache.size ? member.roles.cache.size - 1 : 0})`, value: roles },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

function flagLabel(flag) {
  const map = {
    Staff: '👨‍💼 Discord Staff',
    Partner: '🤝 Partner',
    Hypesquad: '🏠 HypeSquad',
    BugHunterLevel1: '🐛 Bug Hunter',
    BugHunterLevel2: '🐛 Bug Hunter Gold',
    HypeSquadOnlineHouse1: '🏠 Bravery',
    HypeSquadOnlineHouse2: '🏠 Brilliance',
    HypeSquadOnlineHouse3: '🏠 Balance',
    PremiumEarlySupporter: '💎 Early Supporter',
    VerifiedBot: '✅ Verified Bot',
    VerifiedDeveloper: '🛠️ Verified Developer',
    ActiveDeveloper: '⚡ Active Developer',
  };
  return map[flag] ?? null;
}
