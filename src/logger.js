import { EmbedBuilder } from 'discord.js';
import { config } from './config.js';
import { recordEvent } from './db.js';

function getLogChannel(guild, key) {
  const id = config.logs[key];
  if (!id) return null;
  return guild.channels.cache.get(id) ?? null;
}

export async function logMemberJoin(member) {
  recordEvent(member.guild.id, 'join', member.user.id);
  const ch = getLogChannel(member.guild, 'GIRIS_CIKIS_LOG');
  if (!ch) return;
  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('✅ Üye Katıldı')
    .setThumbnail(member.user.displayAvatarURL())
    .addFields(
      { name: 'Kullanıcı', value: `${member.user} (${member.user.id})`, inline: true },
      { name: 'Hesap Oluşturma', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
      { name: 'Toplam Üye', value: `${member.guild.memberCount}`, inline: true },
    )
    .setTimestamp();
  ch.send({ embeds: [embed] }).catch(() => {});
}

export async function logMemberLeave(member) {
  recordEvent(member.guild.id, 'leave', member.user.id);
  const ch = getLogChannel(member.guild, 'GIRIS_CIKIS_LOG');
  if (!ch) return;
  const roles = member.roles.cache
    .filter(r => r.id !== member.guild.id)
    .map(r => r.toString())
    .join(', ') || 'Yok';
  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle('🚪 Üye Ayrıldı')
    .setThumbnail(member.user.displayAvatarURL())
    .addFields(
      { name: 'Kullanıcı', value: `${member.user} (${member.user.id})`, inline: true },
      { name: 'Katılma Tarihi', value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Bilinmiyor', inline: true },
      { name: 'Roller', value: roles.length > 1024 ? roles.slice(0, 1020) + '...' : roles },
    )
    .setTimestamp();
  ch.send({ embeds: [embed] }).catch(() => {});
}

export async function logMessageDelete(message) {
  if (message.author?.bot || !message.guild) return;
  const ch = getLogChannel(message.guild, 'MESAJ_LOG');
  if (!ch) return;
  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle('🗑️ Mesaj Silindi')
    .addFields(
      { name: 'Yazar', value: `${message.author} (${message.author.id})`, inline: true },
      { name: 'Kanal', value: `${message.channel}`, inline: true },
      { name: 'İçerik', value: message.content?.slice(0, 1020) || '*[Boş / Ek]*' },
    )
    .setTimestamp();
  ch.send({ embeds: [embed] }).catch(() => {});
}

export async function logMessageEdit(oldMsg, newMsg) {
  if (oldMsg.author?.bot || !oldMsg.guild) return;
  if (oldMsg.content === newMsg.content) return;
  const ch = getLogChannel(oldMsg.guild, 'MESAJ_LOG');
  if (!ch) return;
  const embed = new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle('✏️ Mesaj Düzenlendi')
    .setURL(newMsg.url)
    .addFields(
      { name: 'Yazar', value: `${oldMsg.author} (${oldMsg.author.id})`, inline: true },
      { name: 'Kanal', value: `${oldMsg.channel}`, inline: true },
      { name: 'Eski İçerik', value: oldMsg.content?.slice(0, 1020) || '*[Boş]*' },
      { name: 'Yeni İçerik', value: newMsg.content?.slice(0, 1020) || '*[Boş]*' },
    )
    .setTimestamp();
  ch.send({ embeds: [embed] }).catch(() => {});
}

export async function logVoiceState(oldState, newState) {
  const guild = newState.guild ?? oldState.guild;
  const ch = getLogChannel(guild, 'SES_LOG');
  if (!ch) return;
  const member = newState.member ?? oldState.member;
  let action, color;

  if (!oldState.channel && newState.channel) {
    action = `🔊 **${member.user.tag}** \`${newState.channel.name}\` kanalına katıldı`;
    color = 0x57f287;
  } else if (oldState.channel && !newState.channel) {
    action = `🔇 **${member.user.tag}** \`${oldState.channel.name}\` kanalından ayrıldı`;
    color = 0xed4245;
  } else if (oldState.channel?.id !== newState.channel?.id) {
    action = `🔄 **${member.user.tag}** \`${oldState.channel?.name}\` → \`${newState.channel?.name}\``;
    color = 0xfee75c;
  } else {
    return;
  }

  const embed = new EmbedBuilder().setColor(color).setDescription(action).setTimestamp();
  ch.send({ embeds: [embed] }).catch(() => {});
}

export async function logRoleChange(oldMember, newMember) {
  const ch = getLogChannel(newMember.guild, 'ROL_LOG');
  if (!ch) return;

  const oldRoles = oldMember.roles.cache;
  const newRoles = newMember.roles.cache;

  const added   = newRoles.filter(r => !oldRoles.has(r.id) && r.id !== newMember.guild.id);
  const removed = oldRoles.filter(r => !newRoles.has(r.id) && r.id !== newMember.guild.id);

  if (added.size === 0 && removed.size === 0) return;

  const embed = new EmbedBuilder()
    .setColor(added.size > 0 ? 0x57f287 : 0xed4245)
    .setTitle('🎭 Rol Değişikliği')
    .setThumbnail(newMember.user.displayAvatarURL())
    .addFields(
      { name: 'Üye', value: `${newMember.user} (${newMember.user.id})`, inline: true },
    );

  if (added.size > 0)   embed.addFields({ name: '➕ Eklenen Rol', value: added.map(r => r.toString()).join(', '), inline: true });
  if (removed.size > 0) embed.addFields({ name: '➖ Çıkarılan Rol', value: removed.map(r => r.toString()).join(', '), inline: true });

  embed.setTimestamp();
  ch.send({ embeds: [embed] }).catch(() => {});
}

export async function logCeza(guild, { target, moderator, action, reason, duration }) {
  recordEvent(guild.id, 'punishment', typeof target === 'object' ? target.id : target);
  const ch = getLogChannel(guild, 'CEZA_LOG');
  if (!ch) return;

  const fields = [
    { name: 'Kullanıcı', value: `${target}`,    inline: true },
    { name: 'Yetkili',   value: `${moderator}`, inline: true },
    { name: 'İşlem',     value: action,          inline: true },
    { name: 'Sebep',     value: reason || 'Belirtilmedi' },
  ];
  if (duration) fields.push({ name: 'Süre', value: duration, inline: true });

  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle('🛡️ Ceza Logu')
    .addFields(fields)
    .setTimestamp();
  ch.send({ embeds: [embed] }).catch(() => {});
}
