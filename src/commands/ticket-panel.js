import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { buildPanelEmbed, buildPanelRow } from '../ticket.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ticket-panel')
    .setDescription('Destek talebi panelini bu kanala gönder')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await interaction.channel.send({ embeds: [buildPanelEmbed()], components: [buildPanelRow()] });
    await interaction.reply({ content: '✅ Destek talebi paneli gönderildi.', ephemeral: true });
  },
};
