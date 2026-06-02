import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
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
  let panelMessage = null;

  // ── Embed ──────────────────────────────────────────────────────────────────
  function buildPanelEmbed() {
    const active = [...tempChannels.entries()];
    const embed = new EmbedBuilder()
      .setTitle('🎙️ Ses Kanalı Kontrol Paneli')
      .setColor(0x5865F2)
      .setTimestamp();

    if (active.length === 0) {
      embed.setDescription('Şu anda aktif özel ses kanalı yok.\n\nHub kanalına katılarak kendi kanalını oluştur!');
    } else {
      const lines = active.map(([chId, { ownerId }]) => `<#${chId}> — <@${ownerId}>`);
      embed.setDescription(
        `**Aktif Kanallar (${active.length})**\n${lines.join('\n')}\n\nKendi kanalını yönetmek için aşağıdaki butonları kullan.`
      );
    }
    embed.setFooter({ text: 'Yalnızca kanalın sahibi butonları kullanabilir.' });
    return embed;
  }

  // ── Buton satırları ────────────────────────────────────────────────────────
  // Satır 1: İsim Değiştir | Kilitle | Kilidi Aç | İzin Ver | İzin Kaldır
  // Satır 2: At | Limit
  function buildPanelRows() {
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('vc_rename').setLabel('İsim Değiştir').setStyle(ButtonStyle.Primary).setEmoji('✏️'),
      new ButtonBuilder().setCustomId('vc_lock').setLabel('Kilitle').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
      new ButtonBuilder().setCustomId('vc_unlock').setLabel('Kilidi Aç').setStyle(ButtonStyle.Success).setEmoji('🔓'),
      new ButtonBuilder().setCustomId('vc_allow').setLabel('İzin Ver').setStyle(ButtonStyle.Secondary).setEmoji('✅'),
      new ButtonBuilder().setCustomId('vc_deny').setLabel('İzin Kaldır').setStyle(ButtonStyle.Secondary).setEmoji('🚫'),
    );
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('vc_kick').setLabel('At').setStyle(ButtonStyle.Danger).setEmoji('👢'),
      new ButtonBuilder().setCustomId('vc_limit').setLabel('Limit').setStyle(ButtonStyle.Secondary).setEmoji('🔢'),
    );
    return [row1, row2];
  }

  async function refreshPanel() {
    if (!panelMessage) return;
    try {
      await panelMessage.edit({ embeds: [buildPanelEmbed()], components: buildPanelRows() });
    } catch (err) {
      console.error('[VoiceHub] Panel güncellenemedi:', err.message);
    }
  }

  // ── Başlangıç ─────────────────────────────────────────────────────────────
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
      panelMessage = await textChannel.send({ embeds: [buildPanelEmbed()], components: buildPanelRows() });
      saveData({ panelMessageId: panelMessage.id });
      console.log('[VoiceHub] Yeni panel mesajı gönderildi:', panelMessage.id);
    } else {
      await refreshPanel();
      console.log('[VoiceHub] Panel mesajı yenilendi:', panelMessage.id);
    }
  }

  // ── Hub'a katılım ──────────────────────────────────────────────────────────
  export async function handleVoiceChannelCreate(oldState, newState) {
    const HUB_ID = config.voiceHub?.hubChannelId;
    if (!HUB_ID || HUB_ID === 'placeholder_hub_id') return;
    if (newState.channelId !== HUB_ID) return;

    const member = newState.member;
    const guild  = newState.guild;

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

  // ── Kanaldan ayrılma ───────────────────────────────────────────────────────
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

  // ── Yardımcı: modal aç ────────────────────────────────────────────────────
  function makeModal(customId, title, inputId, label, placeholder, maxLength = 100) {
    const modal = new ModalBuilder().setCustomId(customId).setTitle(title);
    const input = new TextInputBuilder()
      .setCustomId(inputId)
      .setLabel(label)
      .setStyle(TextInputStyle.Short)
      .setMinLength(1)
      .setMaxLength(maxLength)
      .setPlaceholder(placeholder)
      .setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(input));
    return modal;
  }

  // ── Yardımcı: kullanıcı çöz ───────────────────────────────────────────────
  async function resolveMember(guild, raw) {
    const id = raw.replace(/[<@!>]/g, '').trim();
    return guild.members.fetch(id).catch(() => null);
  }

  const BUTTON_IDS = ['vc_rename', 'vc_lock', 'vc_unlock', 'vc_allow', 'vc_deny', 'vc_kick', 'vc_limit'];

  // ── Buton handler ──────────────────────────────────────────────────────────
  export async function handleVoiceHubButton(interaction) {
    const { customId, guild, user } = interaction;
    if (!BUTTON_IDS.includes(customId)) return false;

    const entry = [...tempChannels.entries()].find(([, v]) => v.ownerId === user.id);
    if (!entry) {
      await interaction.reply({ content: '❌ Aktif bir ses kanalın yok. Önce Hub kanalına katıl!', flags: 64 });
      return true;
    }

    const [channelId] = entry;

    // Modal açan butonlar
    const modalMap = {
      vc_rename: () => makeModal(`vc_rename_modal_${channelId}`, 'Kanal Adını Değiştir', 'vc_new_name', 'Yeni Kanal Adı', 'Örn: Müzik Odası'),
      vc_allow:  () => makeModal(`vc_allow_modal_${channelId}`,  'Kullanıcıya İzin Ver',   'vc_target',   'Kullanıcı ID veya @mention', 'Örn: 123456789012345678'),
      vc_deny:   () => makeModal(`vc_deny_modal_${channelId}`,   'İzin Kaldır',             'vc_target',   'Kullanıcı ID veya @mention', 'Örn: 123456789012345678'),
      vc_kick:   () => makeModal(`vc_kick_modal_${channelId}`,   'Kanaldan At',             'vc_target',   'Kullanıcı ID veya @mention', 'Örn: 123456789012345678'),
      vc_limit:  () => makeModal(`vc_limit_modal_${channelId}`,  'Kullanıcı Limiti',        'vc_limit_val','Limit (0 = sınırsız, 1–99)', 'Örn: 5', 2),
    };

    if (modalMap[customId]) {
      await interaction.showModal(modalMap[customId]());
      return true;
    }

    // Kanal gerektiren direkt butonlar (lock / unlock)
    const voiceChannel = guild.channels.cache.get(channelId)
      ?? await guild.channels.fetch(channelId).catch(() => null);

    if (!voiceChannel) {
      tempChannels.delete(channelId);
      await refreshPanel();
      await interaction.reply({ content: '❌ Ses kanalın artık mevcut değil.', flags: 64 });
      return true;
    }

    if (customId === 'vc_lock') {
      await voiceChannel.permissionOverwrites.edit(guild.roles.everyone, { Connect: false });
      await interaction.reply({ content: '🔒 Kanalın kilitlendi. Artık kimse katılamaz.', flags: 64 });
    } else if (customId === 'vc_unlock') {
      await voiceChannel.permissionOverwrites.edit(guild.roles.everyone, { Connect: true });
      await interaction.reply({ content: '🔓 Kanalının kilidi açıldı. Herkes katılabilir.', flags: 64 });
    }

    return true;
  }

  // ── Modal handler ──────────────────────────────────────────────────────────
  export async function handleVoiceHubModal(interaction) {
    const { customId, guild, user } = interaction;

    const prefixes = ['vc_rename_modal_', 'vc_allow_modal_', 'vc_deny_modal_', 'vc_kick_modal_', 'vc_limit_modal_'];
    const prefix = prefixes.find(p => customId.startsWith(p));
    if (!prefix) return false;

    const channelId = customId.replace(prefix, '');
    const entry = [...tempChannels.entries()].find(([id, v]) => id === channelId && v.ownerId === user.id);

    if (!entry) {
      await interaction.reply({ content: '❌ Bu kanal sana ait değil veya artık mevcut değil.', flags: 64 });
      return true;
    }

    const voiceChannel = guild.channels.cache.get(channelId)
      ?? await guild.channels.fetch(channelId).catch(() => null);

    if (!voiceChannel) {
      tempChannels.delete(channelId);
      await refreshPanel();
      await interaction.reply({ content: '❌ Ses kanalın artık mevcut değil.', flags: 64 });
      return true;
    }

    // ── İsim değiştir ──
    if (prefix === 'vc_rename_modal_') {
      const newName = interaction.fields.getTextInputValue('vc_new_name').trim();
      await voiceChannel.setName(`🔊 ${newName}`);
      await interaction.reply({ content: `✅ Kanal adın **🔊 ${newName}** olarak değiştirildi.`, flags: 64 });
      return true;
    }

    // ── İzin ver ──
    if (prefix === 'vc_allow_modal_') {
      const raw    = interaction.fields.getTextInputValue('vc_target');
      const target = await resolveMember(guild, raw);
      if (!target) {
        await interaction.reply({ content: `❌ "${raw}" kullanıcısı bu sunucuda bulunamadı.`, flags: 64 });
        return true;
      }
      await voiceChannel.permissionOverwrites.edit(target.user, { Connect: true });
      await interaction.reply({ content: `✅ **${target.displayName}** artık kanalına girebilir.`, flags: 64 });
      return true;
    }

    // ── İzin kaldır ──
    if (prefix === 'vc_deny_modal_') {
      const raw    = interaction.fields.getTextInputValue('vc_target');
      const target = await resolveMember(guild, raw);
      if (!target) {
        await interaction.reply({ content: `❌ "${raw}" kullanıcısı bu sunucuda bulunamadı.`, flags: 64 });
        return true;
      }
      // Override'ı tamamen kaldır (varsayılan izinlere döner)
      await voiceChannel.permissionOverwrites.delete(target.user);
      await interaction.reply({ content: `🚫 **${target.displayName}** için özel izin kaldırıldı.`, flags: 64 });
      return true;
    }

    // ── At ──
    if (prefix === 'vc_kick_modal_') {
      const raw    = interaction.fields.getTextInputValue('vc_target');
      const target = await resolveMember(guild, raw);
      if (!target) {
        await interaction.reply({ content: `❌ "${raw}" kullanıcısı bu sunucuda bulunamadı.`, flags: 64 });
        return true;
      }
      if (!target.voice.channelId) {
        await interaction.reply({ content: `❌ **${target.displayName}** zaten bir ses kanalında değil.`, flags: 64 });
        return true;
      }
      if (target.voice.channelId !== channelId) {
        await interaction.reply({ content: `❌ **${target.displayName}** senin kanalında değil.`, flags: 64 });
        return true;
      }
      await target.voice.disconnect();
      await interaction.reply({ content: `👢 **${target.displayName}** kanaldan atıldı.`, flags: 64 });
      return true;
    }

    // ── Limit ──
    if (prefix === 'vc_limit_modal_') {
      const raw   = interaction.fields.getTextInputValue('vc_limit_val').trim();
      const limit = parseInt(raw, 10);
      if (isNaN(limit) || limit < 0 || limit > 99) {
        await interaction.reply({ content: '❌ Geçersiz limit. 0 ile 99 arasında bir sayı girin (0 = sınırsız).', flags: 64 });
        return true;
      }
      await voiceChannel.setUserLimit(limit);
      const msg = limit === 0 ? '🔢 Kanal limiti kaldırıldı (sınırsız).' : `🔢 Kanal limiti **${limit}** kişi olarak ayarlandı.`;
      await interaction.reply({ content: msg, flags: 64 });
      return true;
    }

    return false;
  }

  export { tempChannels };
  