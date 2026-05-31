import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import {
  createGiveaway, getGiveaway, finalizeGiveaway, pickWinners,
  buildGiveawayEmbed, buildGiveawayRow, getAllActive,
} from '../giveaway.js';

export default {
  data: new SlashCommandBuilder()
    .setName('cekilis')
    .setDescription('Çekiliş sistemi')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('basla')
        .setDescription('Yeni bir çekiliş başlat')
        .addStringOption(o => o.setName('odul').setDescription('Çekiliş ödülü').setRequired(true))
        .addIntegerOption(o => o.setName('sure').setDescription('Süre (dakika)').setRequired(true).setMinValue(1).setMaxValue(10080))
        .addIntegerOption(o => o.setName('kazanan').setDescription('Kazanan sayısı').setRequired(false).setMinValue(1).setMaxValue(20))
    )
    .addSubcommand(sub =>
      sub.setName('bitir')
        .setDescription('Aktif bir çekilişi erken bitir')
        .addStringOption(o => o.setName('mesaj_id').setDescription('Çekiliş mesajının ID\'si').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('yeniden-cek')
        .setDescription('Biten çekilişte yeni kazanan seç')
        .addStringOption(o => o.setName('mesaj_id').setDescription('Çekiliş mesajının ID\'si').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('liste')
        .setDescription('Aktif çekilişleri listele')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'basla') {
      // Defer first to avoid 3-second timeout while sending giveaway message
      await interaction.deferReply({ flags: 64 });

      const prize        = interaction.options.getString('odul');
      const durationMin  = interaction.options.getInteger('sure');
      const winnersCount = interaction.options.getInteger('kazanan') ?? 1;
      const endsAt       = Date.now() + durationMin * 60_000;

      const embed = buildGiveawayEmbed({ prize, winnersCount, endsAt, participants: [] });
      const row   = buildGiveawayRow();
      const msg   = await interaction.channel.send({ embeds: [embed], components: [row] });

      createGiveaway({
        messageId: msg.id,
        channelId: interaction.channelId,
        guildId: interaction.guildId,
        prize, winnersCount, endsAt,
        hostId: interaction.user.id,
      });

      const timeout = Math.min(durationMin * 60_000, 2_147_483_647);
      setTimeout(() => finalizeGiveaway(interaction.client, msg.id), timeout);

      await interaction.editReply({ content: `✅ Çekiliş başlatıldı! 🎉 **${prize}** — ${durationMin} dakika` });
    }

    else if (sub === 'bitir') {
      const messageId = interaction.options.getString('mesaj_id');
      const ga = getGiveaway(messageId);
      if (!ga) return interaction.reply({ content: '❌ Bu ID\'ye ait çekiliş bulunamadı.', flags: 64 });
      if (ga.ended) return interaction.reply({ content: '❌ Bu çekiliş zaten bitti.', flags: 64 });

      await interaction.deferReply({ flags: 64 });
      await finalizeGiveaway(interaction.client, messageId);
      await interaction.editReply({ content: '✅ Çekiliş sonlandırıldı.' });
    }

    else if (sub === 'yeniden-cek') {
      const messageId = interaction.options.getString('mesaj_id');
      const ga = getGiveaway(messageId);
      if (!ga) return interaction.reply({ content: '❌ Çekiliş bulunamadı.', flags: 64 });
      if (!ga.ended) return interaction.reply({ content: '❌ Çekiliş henüz bitmedi. Önce `/cekilis bitir` kullan.', flags: 64 });

      const winners = pickWinners(ga, ga.winnersCount);
      const winText = winners.length
        ? `🎉 **Yeniden Çekiliş!** ${winners.map(id => `<@${id}>`).join(', ')} tebrikler! **${ga.prize}** kazandınız!`
        : '😔 Yeterli katılımcı yok.';

      await interaction.reply({ content: winText });
    }

    else if (sub === 'liste') {
      const active = getAllActive(interaction.guildId);
      if (!active.length) return interaction.reply({ content: '📭 Aktif çekiliş yok.', flags: 64 });

      const list = active.map((g, i) =>
        `${i + 1}. **${g.prize}** — ${g.participants.length} katılımcı — <t:${Math.floor(g.endsAt / 1000)}:R> — Mesaj ID: \`${g.messageId}\``
      ).join('\n');

      await interaction.reply({ content: `🎉 **Aktif Çekilişler:**\n${list}`, flags: 64 });
    }
  },
};
