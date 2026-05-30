import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { logCeza } from '../logger.js';
import { recordEvent } from '../db.js';

export default {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Üyeyi sunucudan at')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(o => o.setName('user').setDescription('Atılacak üye').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Sebep').setRequired(false)),

  async execute(interaction) {
    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') ?? 'Sebep belirtilmedi';
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);

    if (!member) return interaction.reply({ content: '❌ Üye bulunamadı.', ephemeral: true });
    if (!member.kickable) return interaction.reply({ content: '❌ Bu üyeyi atamam.', ephemeral: true });

    try { await target.send(`👟 **${interaction.guild.name}** sunucusundan atıldın: ${reason}`); } catch {}
    await member.kick(reason);

    recordEvent(interaction.guildId, 'punishment', target.id);

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('👟 Üye Atıldı')
      .addFields(
        { name: 'Kullanıcı', value: `${target.tag} (${target.id})`, inline: true },
        { name: 'Yetkili', value: `${interaction.user.tag}`, inline: true },
        { name: 'Sebep', value: reason },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
    await logCeza(interaction.guild, {
      target,
      moderator: interaction.user,
      action: 'Kick',
      reason,
    });
  },
};
