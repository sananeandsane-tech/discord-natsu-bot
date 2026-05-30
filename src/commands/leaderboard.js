import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getLeaderboard } from '../db.js';
import { getLevelForXP } from '../config.js';

export default {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the top XP earners in this server')
    .addIntegerOption(o =>
      o.setName('limit').setDescription('How many to show (default 10, max 25)').setMinValue(1).setMaxValue(25)
    ),

  async execute(interaction) {
    const limit = interaction.options.getInteger('limit') ?? 10;
    const lb = getLeaderboard(interaction.guildId, limit);

    if (lb.length === 0) {
      return interaction.reply({ content: 'No XP data yet — start chatting!', ephemeral: true });
    }

    const medals = ['🥇', '🥈', '🥉'];

    const rows = await Promise.all(
      lb.map(async (u, i) => {
        const level = getLevelForXP(u.xp);
        let name = `<@${u.userId}>`;
        try {
          const member = await interaction.guild.members.fetch(u.userId).catch(() => null);
          if (member) name = member.displayName;
        } catch {}
        const prefix = medals[i] ?? `**#${i + 1}**`;
        return `${prefix} ${name} — Lv.${level.level} · ${u.xp.toLocaleString()} XP`;
      })
    );

    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle('🏆 XP Leaderboard')
      .setDescription(rows.join('\n'))
      .setFooter({ text: `Top ${lb.length} members` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
