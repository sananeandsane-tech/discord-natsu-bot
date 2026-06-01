import {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
  } from 'discord.js';
  import { config } from './config.js';

  // Geçici kanalları takip et: channelId → { ownerId, panelMessageId }
  const tempChannels = new Map();

  async function fetchTextChannel(guild, id) {
    // Önce cache'e bak, yoksa Discord API'den çek
    return guild.channels.cache.get(id) ?? await guild.channels.fetch(id).catch(() => null);
  }

  /**
   * Hub kanalına birisi katıldığında çağrılır.
   * Yeni geçici kanal oluşturur, kullanıcıyı taşır, kontrol paneli gönderir.
   */
  export async function handleVoiceChannelCreate(oldState, newState) {
    const HUB_ID  = config.voiceHub?.hubChannelId;
    const TEXT_ID = config.voiceHub?.panelTextChannelId;

    if (!HUB_ID || !TEXT_ID) {
      console.error('[VoiceHub] hubChannelId veya panelTextChannelId config.js içinde tanımlı değil!');
      return;
    }
    if (newState.channelId !== HUB_ID) return;

    const member = newState.member;
    const guild  = newState.guild;

    try {
      // Yeni geçici ses kanalı oluştur
      const newChannel = await guild.channels.create({
        name: `🔊 ${member.displayName}'s Room`,
        type: ChannelType.GuildVoice,
        parent: newState.channel.parentId,
      });

      // Kullanıcıyı yeni kanala taşı
      await member.voice.setChannel(newChannel);

      // Kontrol paneli embed + butonları gönder
      const embed = new EmbedBuilder()
        .setTitle('🎙️ Ses Kanalı Kontrol Paneli')
        .setDescription(`<@${member.id}> kanalının sahibisiniz.\nAşağıdaki butonları kullanarak kanalınızı yönetebilirsiniz.`)
        .setColor(0x5865F2)
        .addFields(
          { name: '📛 Kanal', value: `<#${newChannel.id}>`, inline: true },
          { name: '👤 Sahip', value: `<@${member.id}>`, inline: true },
        )
        .setFooter({ text: 'Kanal boşaldığında otomatik silinecek.' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`vc_rename_${newChannel.id}`)
          .setLabel('İsim Değiştir')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('✏️'),
        new ButtonBuilder()
          .setCustomId(`vc_lock_${newChannel.id}`)
          .setLabel('Kilitle')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔒'),
        new ButtonBuilder()
          .setCustomId(`vc_unlock_${newChannel.id}`)
          .setLabel('Kilidi Aç')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🔓'),
      );

      // Cache'den bulamazsa API'den zorla çek
      const textChannel = await fetchTextChannel(guild, TEXT_ID);
      if (!textChannel) {
        console.error(`[VoiceHub] Panel metin kanalı bulunamadı! ID: ${TEXT_ID}`);
        return;
      }

      const panelMessage = await textChannel.send({ embeds: [embed], components: [row] });

      // Geçici kanalı kaydet
      tempChannels.set(newChannel.id, {
        ownerId: member.id,
        panelMessageId: panelMessage.id,
      });

      console.log(`[VoiceHub] Kanal oluşturuldu: ${newChannel.name} | Sahip: ${member.displayName}`);

    } catch (err) {
      console.error('[VoiceHub] Kanal oluşturulurken hata:', err);
    }
  }

  /**
   * Birisi ses kanalından ayrıldığında çağrılır.
   * Geçici kanal boşaldıysa kanalı ve kontrol panelini siler.
   */
  export async function handleVoiceChannelDelete(oldState, newState) {
    const TEXT_ID = config.voiceHub?.panelTextChannelId;
    if (!TEXT_ID) return;

    const leftChannelId = oldState.channelId;
    if (!leftChannelId) return;
    if (!tempChannels.has(leftChannelId)) return;

    const channel = oldState.channel;
    if (!channel) {
      tempChannels.delete(leftChannelId);
      return;
    }

    // Kanal boş mu kontrol et
    if (channel.members.size > 0) return;

    const { panelMessageId } = tempChannels.get(leftChannelId);
    tempChannels.delete(leftChannelId);

    try {
      await channel.delete('Geçici kanal boşaldı.');
      console.log(`[VoiceHub] Geçici kanal silindi: ${channel.name}`);
    } catch (err) {
      console.error('[VoiceHub] Kanal silinemedi:', err);
    }

    try {
      const textChannel = await fetchTextChannel(oldState.guild, TEXT_ID);
      if (textChannel) {
        const panelMsg = await textChannel.messages.fetch(panelMessageId).catch(() => null);
        if (panelMsg) await panelMsg.delete();
      }
    } catch (err) {
      console.error('[VoiceHub] Panel mesajı silinemedi:', err);
    }
  }

  /**
   * Buton etkileşimlerini işler.
   */
  export async function handleVoiceHubButton(interaction) {
    const { customId, guild, user } = interaction;

    let action, channelId;

    if (customId.startsWith('vc_rename_')) {
      action    = 'rename';
      channelId = customId.replace('vc_rename_', '');
    } else if (customId.startsWith('vc_lock_')) {
      action    = 'lock';
      channelId = customId.replace('vc_lock_', '');
    } else if (customId.startsWith('vc_unlock_')) {
      action    = 'unlock';
      channelId = customId.replace('vc_unlock_', '');
    } else {
      return false;
    }

    const channelData = tempChannels.get(channelId);
    if (!channelData) {
      await interaction.reply({ content: '❌ Bu kanal artık mevcut değil.', flags: 64 });
      return true;
    }

    if (channelData.ownerId !== user.id) {
      await interaction.reply({
        content: '❌ Bu kanalın sahibi değilsiniz, bu butonları kullanamazsınız.',
        flags: 64,
      });
      return true;
    }

    const voiceChannel = guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId).catch(() => null);
    if (!voiceChannel) {
      await interaction.reply({ content: '❌ Ses kanalı bulunamadı.', flags: 64 });
      return true;
    }

    if (action === 'rename') {
      await interaction.reply({
        content: '✏️ Yeni kanal adını bu kanala yazın (30 saniye süreniz var):',
        flags: 64,
      });

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
        await interaction.followUp({ content: `✅ Kanal adı **🔊 ${newName}** olarak değiştirildi.`, flags: 64 });

      } catch {
        await interaction.followUp({ content: '⏱️ Süre doldu, kanal adı değiştirilmedi.', flags: 64 });
      }

    } else if (action === 'lock') {
      await voiceChannel.permissionOverwrites.edit(guild.roles.everyone, { Connect: false });
      await interaction.reply({ content: '🔒 Kanal kilitlendi. Artık kimse katılamaz.', flags: 64 });

    } else if (action === 'unlock') {
      await voiceChannel.permissionOverwrites.edit(guild.roles.everyone, { Connect: true });
      await interaction.reply({ content: '🔓 Kanal kilidi açıldı. Herkes katılabilir.', flags: 64 });
    }

    return true;
  }

  export { tempChannels };
  