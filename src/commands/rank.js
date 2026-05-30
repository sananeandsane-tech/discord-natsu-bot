import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getUser, getLeaderboard } from '../db.js';
import { getLevelForXP, getNextLevel } from '../config.js';

export default {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Check your XP rank or another user\'s')
    .addUserOption(o => o.setName('user').setDescription('User to check (defaults to you)')),

  async execute(interaction) {
    const target = interaction.options.getUser('user') ?? interaction.user;
    const user = getUser(interaction.guildId, target.id);
    const level = getLevelForXP(user.xp);
    const next = getNextLevel(user.xp);

    const lb = getLeaderboard(interaction.guildId, 1000);
    const rank = lb.findIndex(u => u.userId === target.id) + 1;

    const progress = next
      ? Math.floor(((user.xp - level.xpRequired) / (next.xpRequired - level.xpRequired)) * 100)
      : 100;

    const bar = buildBar(progress);

    const embed = new EmbedBuilder()
      .setColor(level.color)
      .setAuthor({ name: target.displayName, iconURL: target.displayAvatarURL() })
      .setTitle(`Level ${level.level} — ${level.name}`)
      .addFields(
        { name: '📊 XP', value: `${user.xp.toLocaleString()}`, inline: true },
        { name: '🏅 Server Rank', value: rank > 0 ? `#${rank}` : 'Unranked', inline: true },
        { name: '💬 Messages', value: `${(user.messages || 0).toLocaleString()}`, inline: true },
        {
          name: `Progress to Level ${next?.level ?? '(MAX)'}`,
          value: `${bar} ${progress}%\n${user.xp.toLocaleString()} / ${next ? next.xpRequired.toLocaleString() : '∞'} XP`,
        }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

function buildBar(percent, length = 20) {
  const filled = Math.round((percent / 100) * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}
