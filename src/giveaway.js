import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const GA_FILE  = join(DATA_DIR, 'giveaways.json');

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

function loadGA() {
  if (!existsSync(GA_FILE)) return {};
  try { return JSON.parse(readFileSync(GA_FILE, 'utf8')); }
  catch { return {}; }
}
function saveGA(data) { writeFileSync(GA_FILE, JSON.stringify(data, null, 2)); }

export function createGiveaway({ messageId, channelId, guildId, prize, winnersCount, endsAt, hostId }) {
  const db = loadGA();
  db[messageId] = { messageId, channelId, guildId, prize, winnersCount, endsAt, hostId, participants: [], ended: false };
  saveGA(db);
  return db[messageId];
}

export function joinGiveaway(messageId, userId) {
  const db = loadGA();
  if (!db[messageId]) return null;
  if (!db[messageId].participants.includes(userId)) {
    db[messageId].participants.push(userId);
    saveGA(db);
  }
  return db[messageId];
}

export function leaveGiveaway(messageId, userId) {
  const db = loadGA();
  if (!db[messageId]) return null;
  db[messageId].participants = db[messageId].participants.filter(id => id !== userId);
  saveGA(db);
  return db[messageId];
}

export function getGiveaway(messageId) {
  return loadGA()[messageId] ?? null;
}

export function getAllActive(guildId) {
  const db = loadGA();
  return Object.values(db).filter(g => g.guildId === guildId && !g.ended && g.endsAt > Date.now());
}

export function endGiveaway(messageId) {
  const db = loadGA();
  if (!db[messageId]) return null;
  db[messageId].ended = true;
  saveGA(db);
  return db[messageId];
}

export function pickWinners(giveaway, count) {
  const pool = [...giveaway.participants];
  const winners = [];
  while (winners.length < count && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length);
    winners.push(pool.splice(idx, 1)[0]);
  }
  return winners;
}

export function buildGiveawayEmbed(giveaway, winners = null) {
  const timeLeft = giveaway.endsAt - Date.now();
  const embed = new EmbedBuilder()
    .setColor(winners ? 0x57f287 : 0xff6b35)
    .setTitle(`🎉 ÇEKİLİŞ: ${giveaway.prize}`)
    .setTimestamp(giveaway.endsAt);

  if (winners) {
    embed.setDescription(
      winners.length
        ? `🏆 **Kazanan(lar):** ${winners.map(id => `<@${id}>`).join(', ')}\n\n` +
          `🎁 **Ödül:** ${giveaway.prize}\n` +
          `👥 **Katılımcı:** ${giveaway.participants.length} kişi`
        : `😔 Yeterli katılımcı olmadığı için kazanan belirlenemedi.\n👥 Katılımcı: ${giveaway.participants.length} kişi`
    )
    .setFooter({ text: 'Çekiliş sona erdi' });
  } else {
    embed.setDescription(
      `🎁 **Ödül:** ${giveaway.prize}\n` +
      `🏆 **Kazanan:** ${giveaway.winnersCount} kişi\n` +
      `👥 **Katılımcı:** ${giveaway.participants.length} kişi\n` +
      `⏰ **Bitiş:** <t:${Math.floor(giveaway.endsAt / 1000)}:R>\n\n` +
      `Katılmak için 🎉 butonuna bas!`
    )
    .setFooter({ text: `Düzenleyen: Çekiliş Sistemi • Bitiş` });
  }

  return embed;
}

export function buildGiveawayRow(ended = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('giveaway_join')
      .setLabel('🎉 Katıl')
      .setStyle(ButtonStyle.Success)
      .setDisabled(ended),
    new ButtonBuilder()
      .setCustomId('giveaway_leave')
      .setLabel('❌ Ayrıl')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(ended),
  );
}

export async function finalizeGiveaway(client, messageId) {
  const ga = getGiveaway(messageId);
  if (!ga || ga.ended) return;
  endGiveaway(messageId);

  const channel = await client.channels.fetch(ga.channelId).catch(() => null);
  if (!channel) return;

  const message = await channel.messages.fetch(messageId).catch(() => null);
  if (!message) return;

  const winners = pickWinners(ga, ga.winnersCount);
  const embed   = buildGiveawayEmbed({ ...ga, ended: true }, winners);

  await message.edit({ embeds: [embed], components: [buildGiveawayRow(true)] }).catch(() => {});

  const winText = winners.length
    ? `🎉 Tebrikler ${winners.map(id => `<@${id}>`).join(', ')}! **${ga.prize}** çekilişini kazandın!`
    : `😔 **${ga.prize}** çekilişinde yeterli katılımcı olmadı.`;

  await channel.send({ content: winText }).catch(() => {});
}
