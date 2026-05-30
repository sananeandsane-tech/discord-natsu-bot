import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getWarnings, clearWarnings } from '../db.js';

export default {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('View or clear a member\'s warnings')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all warnings for a user')
        .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('clear')
        .setDescription('Clear all warnings for a user')
        .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const target = interaction.options.getUser('user');

    if (sub === 'list') {
      const warns = getWarnings(interaction.guildId, target.id);
      if (warns.length === 0) {
        return interaction.reply({ content: `✅ ${target} has no warnings.`, ephemeral: true });
      }

      const rows = warns.map((w, i) => {
        const date = new Date(w.timestamp).toDateString();
        return `**${i + 1}.** ${w.reason} — by <@${w.moderatorId}> on ${date}`;
      });

      const embed = new EmbedBuilder()
        .setColor(0xfee75c)
        .setTitle(`⚠️ Warnings for ${target.displayName}`)
        .setThumbnail(target.displayAvatarURL())
        .setDescription(rows.join('\n'))
        .setFooter({ text: `${warns.length} total warning(s)` })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'clear') {
      clearWarnings(interaction.guildId, target.id);
      return interaction.reply({
        content: `✅ Cleared all warnings for ${target}.`,
        ephemeral: true,
      });
    }
  },
};
