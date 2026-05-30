import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { logCeza } from '../logger.js';
import { recordEvent } from '../db.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Sunucudan üye ban et')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(o => o.setName('user').setDescription('Ban edilecek üye').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Sebep').setRequired(false))
    .addIntegerOption(o =>
      o.setName('delete_days').setDescription('Kaç günlük mesaj silinsin (0–7)').setMinValue(0).setMaxValue(7)
    ),

  async execute(interaction) {
    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') ?? 'Sebep belirtilmedi';
    const deleteDays = interaction.options.getInteger('delete_days') ?? 0;
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);

    if (member && !member.bannable) {
      return interaction.reply({ content: '❌ Bu üyeyi ban edemem.', ephemeral: true });
    }

    try { await target.send(`🔨 **${interaction.guild.name}** sunucusundan ban yedin: ${reason}`); } catch {}
    await interaction.guild.members.ban(target.id, { reason, deleteMessageDays: deleteDays });

    recordEvent(interaction.guildId, 'punishment', target.id);

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('🔨 Üye Banlandı')
      .addFields(
        { name: 'Kullanıcı', value: `${target.tag} (${target.id})`, inline: true },
        { name: 'Yetkili', value: `${interaction.user.tag}`, inline: true },
        { name: 'Sebep', value: reason },
        { name: 'Silinen Mesaj', value: `${deleteDays} gün`, inline: true },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    await logCeza(interaction.guild, {
      target,
      moderator: interaction.user,
      action: 'Ban',
      reason,
      duration: 'Kalıcı',
    });
  },
};
