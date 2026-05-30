import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { addWarning, getWarnings } from '../db.js';
import { logCeza } from '../logger.js';

export default {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Üyeye uyarı ver')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('Uyarılacak üye').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Uyarı sebebi').setRequired(true)),

  async execute(interaction) {
    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason');
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);

    if (!member) return interaction.reply({ content: '❌ Üye bulunamadı.', ephemeral: true });
    if (member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({ content: '❌ Yetkililere uyarı veremezsin.', ephemeral: true });
    }

    const warnings = addWarning(interaction.guildId, target.id, reason, interaction.user.id);
    const count = warnings.length;

    const isThird = count % 3 === 0;
    const timeoutMs = isThird ? 60 * 60_000 : 60_000;
    const durationLabel = isThird ? '1 saat' : '1 dakika';

    let timedOut = false;
    if (member.moderatable) {
      try {
        await member.timeout(timeoutMs, `Uyarı #${count}: ${reason}`);
        timedOut = true;
      } catch (err) {
        console.warn('Warn timeout failed:', err.message);
      }
    }

    const embed = new EmbedBuilder()
      .setColor(isThird ? 0xed4245 : 0xfee75c)
      .setTitle(isThird ? '⚠️ 3. Uyarı — Susturma!' : '⚠️ Uyarı Verildi')
      .addFields(
        { name: 'Kullanıcı', value: `${target} (${target.id})`, inline: true },
        { name: 'Yetkili', value: `${interaction.user}`, inline: true },
        { name: 'Sebep', value: reason },
        { name: 'Toplam Uyarı', value: `${count}`, inline: true },
        { name: 'Susturma', value: timedOut ? durationLabel : 'Uygulanamadı', inline: true },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });

    try {
      await target.send(
        `⚠️ **${interaction.guild.name}** sunucusunda uyarı aldın!\n` +
        `Sebep: ${reason}\nToplam uyarı: ${count}\n` +
        (timedOut ? `Susturma süresi: ${durationLabel}` : '')
      );
    } catch {}

    await logCeza(interaction.guild, {
      target,
      moderator: interaction.user,
      action: `Uyarı #${count}`,
      reason,
      duration: timedOut ? durationLabel : undefined,
    });
  },
};
