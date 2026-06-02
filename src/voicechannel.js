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
    // Butonlar 2 satıra bölündü: ilk satır 3 buton, ikinci satır 1 buton
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('vc_rename').setLabel('İsim Değiştir').setStyle(ButtonStyle.Primary).setEmoji('✏️'),
      new ButtonBuilder().setCustomId('vc_lock').setLabel('Kilitle').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
      new ButtonBuilder().setCustomId('vc_unlock').setLabel('Kilidi Aç').setStyle(ButtonStyle.Success).setEmoji('🔓'),
    );
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('vc_allow').setLabel('İzin Ver').setStyle(ButtonStyle.Secondary).setEmoji('✅'),
    );
    return [row1, row2];
  }

  async function refreshPanel() {
    if (!panelMessage) return;
    try {
      await panelMessage.edit({ embeds: [buildPanelEmbed()], components: buildPanelRow() });
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
      panelMessage = await textChannel.send({ embeds: [buildPanelEmbed()], components: buildPanelRow() });
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
    if (!['vc_rename', 'vc_lock', 'vc_unlock', 'vc_allow'].includes(customId)) return false;

    const entry = [...tempChannels.entries()].find(([, v]) => v.ownerId === user.id);
    if (!entry) {
      await interaction.reply({ content: '❌ Aktif bir ses kanalın yok. Önce Hub kanalına katıl!', flags: 64 });
      return true;
    }

    const [channelId] = entry;

    // Modal gerektiren butonlar
    if (customId === 'vc_rename') {
      const modal = new ModalBuilder()
        .setCustomId(`vc_rename_modal_${channelId}`)
        .setTitle('Kanal Adını Değiştir');

      const nameInput = new TextInputBuilder()
        .setCustomId('vc_new_name')
        .setLabel('Yeni Kanal Adı')
        .setStyle(TextInputStyle.Short)
        .setMinLength(1)
        .setMaxLength(100)
        .setPlaceholder('Örn: Müzik Odası')
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
      await interaction.showModal(modal);
      return true;
    }

    if (customId === 'vc_allow') {
      const modal = new ModalBuilder()
        .setCustomId(`vc_allow_modal_${channelId}`)
        .setTitle('Kullanıcıya İzin Ver');

      const userInput = new TextInputBuilder()
        .setCustomId('vc_allow_target')
        .setLabel('Kullanıcı ID veya @mention')
        .setStyle(TextInputStyle.Short)
        .setMinLength(1)
        .setMaxLength(100)
        .setPlaceholder('Örn: 123456789012345678 veya @kullanıcı')
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(userInput));
      await interaction.showModal(modal);
      return true;
    }

    // Kanal gerektiren butonlar (lock/unlock)
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

  export async function handleVoiceHubModal(interaction) {
    const { customId, guild, user } = interaction;

    // ── İsim değiştir modal ──
    if (customId.startsWith('vc_rename_modal_')) {
      const channelId = customId.replace('vc_rename_modal_', '');
      const newName   = interaction.fields.getTextInputValue('vc_new_name').trim();

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

      await voiceChannel.setName(`🔊 ${newName}`);
      await interaction.reply({ content: `✅ Kanal adın **🔊 ${newName}** olarak değiştirildi.`, flags: 64 });
      return true;
    }

    // ── İzin ver modal ──
    if (customId.startsWith('vc_allow_modal_')) {
      const channelId  = customId.replace('vc_allow_modal_', '');
      const rawInput   = interaction.fields.getTextInputValue('vc_allow_target').trim();

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

      // ID'yi temizle: <@123...> veya düz ID
      const userId = rawInput.replace(/[<@!>]/g, '').trim();

      // Kullanıcıyı fetch et
      const target = await guild.members.fetch(userId).catch(() => null);
      if (!target) {
        await interaction.reply({ content: `❌ "${rawInput}" adlı kullanıcı bu sunucuda bulunamadı.`, flags: 64 });
        return true;
      }

      // Kanalın kilitli olup olmadığına bakılmaksızın o kullanıcıya Connect izni ver
      await voiceChannel.permissionOverwrites.edit(target.user, { Connect: true });
      await interaction.reply({
        content: `✅ **${target.displayName}** kilitli kanalına bile katılabilir.`,
        flags: 64,
      });
      return true;
    }

    return false;
  }

  export { tempChannels };
  