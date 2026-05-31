import {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ChannelType, PermissionFlagsBits,
} from 'discord.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = join(__dirname, '..', 'data');
const TK_FILE   = join(DATA_DIR, 'tickets.json');

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

function loadTK() {
  if (!existsSync(TK_FILE)) return { counter: 0, tickets: {} };
  try { return JSON.parse(readFileSync(TK_FILE, 'utf8')); }
  catch { return { counter: 0, tickets: {} }; }
}
function saveTK(data) { writeFileSync(TK_FILE, JSON.stringify(data, null, 2)); }

export function getNextTicketNumber() {
  const db = loadTK();
  db.counter = (db.counter || 0) + 1;
  saveTK(db);
  return db.counter;
}

export function saveTicket(channelId, data) {
  const db = loadTK();
  db.tickets[channelId] = data;
  saveTK(db);
}

export function getTicket(channelId) {
  return loadTK().tickets[channelId] ?? null;
}

export function closeTicketRecord(channelId) {
  const db = loadTK();
  if (db.tickets[channelId]) db.tickets[channelId].closed = true;
  saveTK(db);
}

export function buildPanelEmbed() {
  return new EmbedBuilder()
    .setColor(0xff6b35)
    .setTitle('🎫 Destek Talebi')
    .setDescription(
      'Bir sorunun mu var? Yardıma mı ihtiyacın var?\n\n' +
      '📩 Aşağıdaki butona tıklayarak özel bir destek kanalı aç.\n' +
      'Ekibimiz en kısa sürede sana yardımcı olacak!'
    )
    .setFooter({ text: 'Natsu Animanga • Destek Sistemi' })
    .setTimestamp();
}

export function buildPanelRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_open')
      .setLabel('🎫 Destek Talebi Aç')
      .setStyle(ButtonStyle.Primary),
  );
}

export function buildTicketEmbed(member) {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('🎫 Destek Talebi Oluşturuldu')
    .setDescription(
      `Merhaba ${member}! Destek talebini aldık.\n\n` +
      `📝 Lütfen sorununuzu/talebinizi detaylı olarak açıklayın.\n` +
      `Ekibimiz en kısa sürede size yardımcı olacak.\n\n` +
      `❌ Talebi kapatmak için aşağıdaki butonu kullanabilirsiniz.`
    )
    .setFooter({ text: 'Natsu Animanga • Destek Sistemi' })
    .setTimestamp();
}

export function buildTicketRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket_close')
      .setLabel('🔒 Talebi Kapat')
      .setStyle(ButtonStyle.Danger),
  );
}

export async function openTicket(interaction) {
  const { guild, member } = interaction;
  const kategoriId  = process.env.TICKET_KATEGORI_ID;
  const yetkiRoleId = process.env.TICKET_YETKI_ROLE_ID;

  const existing = guild.channels.cache.find(
    ch => ch.topic === `ticket-${member.user.id}` && !getTicket(ch.id)?.closed
  );
  if (existing) {
    return interaction.reply({ content: `❌ Zaten açık bir destek talebiniz var: ${existing}`, flags: 64 });
  }

  const num = getNextTicketNumber();
  const channelName = `ticket-${num.toString().padStart(4, '0')}-${member.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

  const permissionOverwrites = [
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: member.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
  ];
  if (yetkiRoleId) {
    permissionOverwrites.push({
      id: yetkiRoleId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages],
    });
  }

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    topic: `ticket-${member.user.id}`,
    parent: kategoriId || null,
    permissionOverwrites,
  });

  saveTicket(channel.id, { channelId: channel.id, userId: member.user.id, guildId: guild.id, number: num, openedAt: Date.now(), closed: false });

  const embed = buildTicketEmbed(member);
  const row   = buildTicketRow();

  await channel.send({ content: `${member} ${yetkiRoleId ? `<@&${yetkiRoleId}>` : ''}`, embeds: [embed], components: [row] });
  await interaction.reply({ content: `✅ Destek talebiniz oluşturuldu: ${channel}`, flags: 64 });
}

export async function closeTicket(interaction) {
  const { channel, guild, member } = interaction;
  const ticket = getTicket(channel.id);

  if (!ticket) return interaction.reply({ content: '❌ Bu bir destek kanalı değil.', flags: 64 });
  if (ticket.closed) return interaction.reply({ content: '❌ Bu talep zaten kapatılmış.', flags: 64 });

  await interaction.reply({ content: '🔒 Talep kapatılıyor, transkript hazırlanıyor...' });

  const messages = await channel.messages.fetch({ limit: 100 });
  const transcript = [...messages.values()]
    .reverse()
    .filter(m => !m.author.bot || m.embeds.length)
    .map(m => `[${new Date(m.createdTimestamp).toISOString()}] ${m.author.tag}: ${m.content || (m.embeds[0]?.title ?? '')}`)
    .join('\n');

  const logKanalId = process.env.DESTEK_LOG_KANAL_ID;
  if (logKanalId) {
    const logCh = guild.channels.cache.get(logKanalId);
    if (logCh) {
      const logEmbed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle(`🎫 Ticket #${String(ticket.number).padStart(4,'0')} Kapatıldı`)
        .addFields(
          { name: '👤 Açan', value: `<@${ticket.userId}>`, inline: true },
          { name: '🔒 Kapatan', value: `${member}`, inline: true },
          { name: '📅 Açılış', value: `<t:${Math.floor(ticket.openedAt / 1000)}:F>`, inline: true },
        )
        .setTimestamp();

      const transcriptBuffer = Buffer.from(transcript || '(Mesaj yok)', 'utf8');
      await logCh.send({
        embeds: [logEmbed],
        files: [{ attachment: transcriptBuffer, name: `ticket-${ticket.number}.txt` }],
      }).catch(() => {});
    }
  }

  closeTicketRecord(channel.id);
  await new Promise(r => setTimeout(r, 3000));
  await channel.delete('Ticket kapatıldı').catch(() => {});
}
