import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getUser, setUser } from '../db.js';
import { getLevelForXP } from '../config.js';

export default {
  data: new SlashCommandBuilder()
    .setName('setxp')
    .setDescription('Set a user\'s XP (admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
    .addIntegerOption(o => o.setName('xp').setDescription('Amount of XP to set').setRequired(true).setMinValue(0)),

  async execute(interaction) {
    const target = interaction.options.getUser('user');
    const xp = interaction.options.getInteger('xp');
    const user = getUser(interaction.guildId, target.id);
    const level = getLevelForXP(xp);

    setUser(interaction.guildId, target.id, { ...user, xp, level: level.level });

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('✏️ XP Updated')
      .addFields(
        { name: 'User', value: `${target}`, inline: true },
        { name: 'New XP', value: `${xp.toLocaleString()}`, inline: true },
        { name: 'Level', value: `${level.level} — ${level.name}`, inline: true },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
