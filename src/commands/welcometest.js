import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { sendWelcome } from '../welcome.js';

export default {
  data: new SlashCommandBuilder()
    .setName('welcometest')
    .setDescription('Hoşgeldin mesajını test et (komutu kullanan kişi hedef alınır)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await interaction.reply({ content: '✅ Hoşgeldin mesajı gönderiliyor...', flags: 64 });
    await sendWelcome(interaction.member);
  },
};
