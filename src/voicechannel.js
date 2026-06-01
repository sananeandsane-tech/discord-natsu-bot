import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
  } from 'discord.js';
  import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
  import { join, dirname } from 'path';
  import { fileURLToPath } from 'url';
  import { config } from './config.js';

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const DATA_DIR  = join(__dirname, '..', 'data');
  const HUB_FILE  = join(DATA_DIR, 'voicehub.json');

  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  function loadData() {
    if (!existsSync(HUB_FILE)) return { panelMessageId: null };
    try { return JSON.parse(readFileSync(HUB_FILE, 'utf8')); }
    catch { return { panelMessageId: null }; }
  }
  function saveData(d) { writeFileSync(HUB_FILE, JSON.stringify(d, null, 2)); }

  // channelId → { ownerId }
  const tempChannels = new Map();

  // Tek kalıcı panel mesajı
  let panelMessage = null;

  function buildPanelEmbed() {
    const active = [...tempChannels.entries()];
    const embed = new EmbedBuilder()
      .setTitle('🎙️ Ses Kanalı Kontrol Paneli')
      .setColor(0x5865F2)
      .setTimestamp();

    if (active.length === 0) {
      embed.setDescription(
        'Şu anda aktif özel ses kanalı yok.\n\nHub kanalına katılarak kendi kanalını oluştur!'
      );
    } else {
      const lines = active.map(([chId, { ownerId }]) => `<#${chId}> — <@${ownerId}>`);
      embed.setDescription(
        `**Aktif Kanallar (${active.length})**\n${lines.join('\n')}\n\n` +
        `Kendi kanalını yönetmek için aşağıdaki butonları kullan.`
      );
    }

    embed.setFooter({ text: 'Yalnızca kanalın sahibi butonları kullanabilir.' });
    return embed;
  }

  function buildPanelRow() {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('vc_rename').setLabel('İsim Değiştir').setStyle(ButtonStyle.Primary).setEmoji('✏️'),
      new ButtonBuilder().setCustomId('vc_lock').setLabel('Kilitle').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
      new ButtonBuilder().setCustomId('vc_unlock').setLabel('Kilidi Aç').setStyle(ButtonStyle.Success).setEmoji('🔓'),
    );
  }

  async function refreshPanel() {
    if (!panelMessage) return;
    try {
      await panelMessage.edit({ embeds: [buildPanelEmbed()], components: [buildPanelRow()] });
    } catch (err) {
      console.error('[VoiceHub] Panel güncellenemedi:', err.message);
    }
  }

  export async function initVoiceHub(client) {
    const TEXT_ID = config.voiceHub?.panelTextChannelId;
    if (!TEXT_ID || TEXT_ID === 'placeholder_text_id') {
      console.error('[VoiceHub] panelTextChannelId ayarlanmamış!');
      return;
    }

    let textChannel = null;
    for (const guild of client.guilds.cache.values()) {
      const ch = guild.channels.cache.get(TEXT_ID)
        ?? await guild.channels.fetch(TEXT_ID).catch(() => null);
      if (ch) { textChannel = ch; break; }
    }

    if (!textChannel) {
      console.error(`[VoiceHub] Panel metin kanalı bulunamadı: ${TEXT_ID}`);
      return;
    }

    const data = loadData();
    if (data.panelMessageId) {
      panelMessage = await textChannel.messages.fetch(data.panelMessageId).catch(() => null);
    }

    if (!panelMessage) {
      panelMessage = await textChannel.send({ embeds: [buildPanelEmbed()], components: [buildPanelRow()] });
      saveData({ panelMessageId: panelMessage.id });
      console.log('[VoiceHub] Yeni panel mesajı gönderildi:', panelMessage.id);
    } else {
      await refreshPanel();
      console.log('[VoiceHub] Panel mesajı yenilendi:', panelMessage.id);
    }
  }

  export async function handleVoiceChannelCreate(oldState, newState) {
    const HUB_ID = config.voiceHub?.hubChannelId;
    if (!HUB_ID || HUB_ID === 'placeholder_hub_id') return;
    if (newState.channelId !== HUB_ID) return;

    const member = newState.member;
    const guild  = newState.guild;

    // Kullanıcının zaten kanalı varsa oraya taşı
    const existing = [...tempChannels.entries()].find(([, v]) => v.ownerId === member.id);
    if (existing) {
      await member.voice.setChannel(existing[0]).catch(() => {});
      return;
    }

    try {
      const newChannel = await guild.channels.create({
        name: `🔊 ${member.displayName}'s Room`,
        type: ChannelType.GuildVoice,
        parent: newState.channel.parentId,
      });

      await member.voice.setChannel(newChannel);
      tempChannels.set(newChannel.id, { ownerId: member.id });
      await refreshPanel();
      console.log(`[VoiceHub] Kanal oluşturuldu: ${newChannel.name}`);
    } catch (err) {
      console.error('[VoiceHub] Kanal oluşturulurken hata:', err);
    }
  }

  export async function handleVoiceChannelDelete(oldState, newState) {
    const leftChannelId = oldState.channelId;
    if (!leftChannelId || !tempChannels.has(leftChannelId)) return;

    const channel = oldState.channel;
    if (!channel || channel.members.size > 0) return;

    tempChannels.delete(leftChannelId);

    try {
      await channel.delete('Geçici kanal boşaldı.');
      console.log('[VoiceHub] Kanal silindi.');
    } catch (err) {
      console.error('[VoiceHub] Kanal silinemedi:', err);
    }

    await refreshPanel();
  }

  export async function handleVoiceHubButton(interaction) {
    const { customId, guild, user } = interaction;
    if (!['vc_rename', 'vc_lock', 'vc_unlock'].includes(customId)) return false;

    const entry = [...tempChannels.entries()].find(([, v]) => v.ownerId === user.id);
    if (!entry) {
      await interaction.reply({ content: '❌ Aktif bir ses kanalın yok. Önce Hub kanalına katıl!', flags: 64 });
      return true;
    }

    const [channelId] = entry;
    const voiceChannel = guild.channels.cache.get(channelId)
      ?? await guild.channels.fetch(channelId).catch(() => null);

    if (!voiceChannel) {
      tempChannels.delete(channelId);
      await refreshPanel();
      await interaction.reply({ content: '❌ Ses kanalın artık mevcut değil.', flags: 64 });
      return true;
    }

    if (customId === 'vc_rename') {
      await interaction.reply({ content: '✏️ Yeni kanal adını **bu kanala** yazın (30 saniye süreniz var):', flags: 64 });
      try {
        const collected = await interaction.channel.awaitMessages({
          filter: (m) => m.author.id === user.id,
          max: 1,
          time: 30_000,
          errors: ['time'],
        });
        const newName = collected.first().content.trim().slice(0, 100);
        await collected.first().delete().catch(() => {});
        await voiceChannel.setName(`🔊 ${newName}`);
        await interaction.followUp({ content: `✅ Kanal adın **🔊 ${newName}** olarak değiştirildi.`, flags: 64 });
      } catch {
        await interaction.followUp({ content: '⏱️ Süre doldu, kanal adı değiştirilmedi.', flags: 64 });
      }
    } else if (customId === 'vc_lock') {
      await voiceChannel.permissionOverwrites.edit(guild.roles.everyone, { Connect: false });
      await interaction.reply({ content: '🔒 Kanalın kilitlendi. Artık kimse katılamaz.', flags: 64 });
    } else if (customId === 'vc_unlock') {
      await voiceChannel.permissionOverwrites.edit(guild.roles.everyone, { Connect: true });
      await interaction.reply({ content: '🔓 Kanalının kilidi açıldı. Herkes katılabilir.', flags: 64 });
    }

    return true;
  }

  export { tempChannels };
  