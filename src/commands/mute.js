import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { logCeza } from '../logger.js';
import { recordEvent } from '../db.js';

const DURATIONS = {
  '60s': [60_000,              '60 saniye'],
  '5m':  [5  * 60_000,        '5 dakika'],
  '10m': [10 * 60_000,        '10 dakika'],
  '30m': [30 * 60_000,        '30 dakika'],
  '1h':  [60 * 60_000,        '1 saat'],
  '24h': [24 * 60 * 60_000,   '24 saat'],
  '1w':  [7 * 24 * 60 * 60_000, '1 hafta'],
};

export default {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Üyeyi sustur (timeout)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('Susturulacak üye').setRequired(true))
    .addStringOption(o =>
      o.setName('duration').setDescription('Süre').setRequired(true)
        .addChoices(
          { name: '60 saniye', value: '60s' },
          { name: '5 dakika',  value: '5m'  },
          { name: '10 dakika', value: '10m' },
          { name: '30 dakika', value: '30m' },
          { name: '1 saat',    value: '1h'  },
          { name: '24 saat',   value: '24h' },
          { name: '1 hafta',   value: '1w'  },
        )
    )
    .addStringOption(o => o.setName('reason').setDescription('Sebep').setRequired(false)),

  async execute(interaction) {
    const target      = interaction.options.getUser('user');
    const durationKey = interaction.options.getString('duration');
    const reason      = interaction.options.getString('reason') ?? 'Sebep belirtilmedi';
    const [ms, label] = DURATIONS[durationKey];

    const member = await interaction.guild.members.fetch(target.id).catch(() => null);
    if (!member)            return interaction.reply({ content: '❌ Üye bulunamadı.',         ephemeral: true });
    if (!member.moderatable) return interaction.reply({ content: '❌ Bu üyeyi susturamam.', ephemeral: true });

    await member.timeout(ms, reason);
    recordEvent(interaction.guildId, 'punishment', target.id);

    const embed = new EmbedBuilder()
      .setColor(0xffa500)
      .setTitle('🔇 Üye Susturuldu')
      .addFields(
        { name: 'Kullanıcı', value: `${target} (${target.id})`, inline: true },
        { name: 'Yetkili',   value: `${interaction.user}`,      inline: true },
        { name: 'Süre',      value: label,                      inline: true },
        { name: 'Sebep',     value: reason },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    await logCeza(interaction.guild, {
      target,
      moderator: interaction.user,
      action: 'Susturma',
      reason,
      duration: label,
    });
  },
};
