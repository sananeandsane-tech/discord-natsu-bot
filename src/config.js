export const config = {
  token: process.env.DISCORD_BOT_TOKEN,

  botStatus: {
    type: 'PLAYING',
    text: 'Natsu Animanga Yetkili Alım',
  },

  xpPerMessage: 15,
  xpCooldownMs: 60_000,

  levels: [
    { level: 1,  xpRequired: 0,     color: 0x808080, name: 'Newcomer' },
    { level: 2,  xpRequired: 100,   color: 0x00b0f4, name: 'Member' },
    { level: 5,  xpRequired: 500,   color: 0x57f287, name: 'Regular' },
    { level: 10, xpRequired: 1500,  color: 0xfee75c, name: 'Veteran' },
    { level: 20, xpRequired: 5000,  color: 0xed4245, name: 'Elite' },
    { level: 30, xpRequired: 12000, color: 0xf47fff, name: 'Legend' },
  ],

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
};

export function getLevelForXP(xp) {
  let current = config.levels[0];
  for (const lvl of config.levels) {
    if (xp >= lvl.xpRequired) current = lvl;
    else break;
  }
  return current;
}

export function getNextLevel(xp) {
  for (const lvl of config.levels) {
    if (xp < lvl.xpRequired) return lvl;
  }
  return null;
}
