export const config = {
    token: process.env.DISCORD_BOT_TOKEN,

    botStatus: {
      type: 'PLAYING',
      text: 'Natsu Animanga Yetkili Alım',
    },

    logs: {
      SES_LOG:         '1495410308968091850',
      MESAJ_LOG:       '1495410309978918975',
      GIRIS_CIKIS_LOG: '1495410311572750357',
      ROL_LOG:         '1495410313489551571',
      CEZA_LOG:        '1510280387472003232',
    },

    welcome: {
      hosgeldinKanalId: process.env.HOSGELDIN_KANAL_ID  ?? '',
      karsilamaRoleId:  process.env.KARSILAMA_ROLE_ID   ?? '',
      kurallarKanalId:  process.env.KURALLAR_KANAL_ID   ?? '',
      duyurularKanalId: process.env.DUYURULAR_KANAL_ID  ?? '',
    },

    antispam: {
      messageLimit: 10,
      windowMs: 5_000,
      timeoutMs: 60_000,
    },

    antinuke: {
      channelDeleteThreshold: 3,
      roleDeleteThreshold: 3,
      banThreshold: 3,
      windowMs: 10_000,
      punishAction: 'ban',
    },

    warn: {
      onEvery3rd: 60 * 60_000,
      otherwise:  60_000,
    },

    // ── Voice Hub ──────────────────────────────────────────────────────────────
    // hubChannelId      : Kullanıcıların katılacağı "Hub" ses kanalının ID'si
    // panelTextChannelId: Kontrol panelinin gönderileceği metin kanalının ID'si
    voiceHub: {
      hubChannelId:       process.env.VOICE_HUB_CHANNEL_ID       ?? 'placeholder_hub_id',
      panelTextChannelId: process.env.VOICE_PANEL_TEXT_CHANNEL_ID ?? 'placeholder_text_id',
    },
  };
  