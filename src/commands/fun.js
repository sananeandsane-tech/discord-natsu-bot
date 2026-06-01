import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

// ── GIF helper ───────────────────────────────────────────────────────────────
async function fetchGif(category) {
  try {
    const res  = await fetch(`https://nekos.best/api/v2/${category}?amount=1`);
    const data = await res.json();
    return data.results?.[0]?.url ?? null;
  } catch {
    return null;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function dn(memberOrUser) {
  if (!memberOrUser) return 'Bilinmeyen';
  return memberOrUser.displayName ?? memberOrUser.username ?? 'Bilinmeyen';
}

function mention(memberOrUser) {
  return memberOrUser?.toString() ?? '';
}

// ── Factory: interaction command with a target user ──────────────────────────
function makeTargetCmd({ name, description, category, text, color = 0xff6b35 }) {
  return {
    data: new SlashCommandBuilder()
      .setName(name)
      .setDescription(description)
      .addUserOption(o =>
        o.setName('kullanici').setDescription('Hedef kullanıcı').setRequired(true)
      ),
    async execute(interaction) {
      const targetUser   = interaction.options.getUser('kullanici');
      const targetMember = interaction.options.getMember('kullanici');
      const authorName   = dn(interaction.member ?? interaction.user);
      const targetName   = dn(targetMember ?? targetUser);
      const gif          = await fetchGif(category);

      const embed = new EmbedBuilder()
        .setColor(color)
        .setDescription(text(authorName, targetName))
        .setFooter({ text: 'Natsu Animanga • Fun 🎮' });
      if (gif) embed.setImage(gif);

      await interaction.reply({
        content: `${mention(interaction.member ?? interaction.user)} ➜ ${mention(targetMember ?? targetUser)}`,
        embeds: [embed],
      });
    },
  };
}

// ── Factory: self command (no target) ────────────────────────────────────────
function makeSelfCmd({ name, description, category, text, color = 0xff6b35 }) {
  return {
    data: new SlashCommandBuilder()
      .setName(name)
      .setDescription(description),
    async execute(interaction) {
      const authorName = dn(interaction.member ?? interaction.user);
      const gif        = await fetchGif(category);

      const embed = new EmbedBuilder()
        .setColor(color)
        .setDescription(text(authorName))
        .setFooter({ text: 'Natsu Animanga • Fun 🎮' });
      if (gif) embed.setImage(gif);

      await interaction.reply({
        content: mention(interaction.member ?? interaction.user),
        embeds: [embed],
      });
    },
  };
}

// ── Ship command ──────────────────────────────────────────────────────────────
function shipScore(id1, id2) {
  const sorted = [id1, id2].sort().join('');
  let hash = 5381;
  for (let i = 0; i < sorted.length; i++) {
    hash = ((hash << 5) + hash) + sorted.charCodeAt(i);
    hash = hash & hash; // 32-bit
  }
  return Math.abs(hash) % 101;
}

function shipBar(pct) {
  const filled = Math.round(pct / 10);
  return '💗'.repeat(filled) + '🖤'.repeat(10 - filled);
}

const shipCommand = {
  data: new SlashCommandBuilder()
    .setName('ship')
    .setDescription('İki kişinin uyumunu ölç! 💘')
    .addUserOption(o => o.setName('kullanici1').setDescription('Birinci kişi').setRequired(true))
    .addUserOption(o => o.setName('kullanici2').setDescription('İkinci kişi').setRequired(true)),

  async execute(interaction) {
    const u1 = interaction.options.getMember('kullanici1') ?? interaction.options.getUser('kullanici1');
    const u2 = interaction.options.getMember('kullanici2') ?? interaction.options.getUser('kullanici2');

    const name1 = dn(u1);
    const name2 = dn(u2);
    const id1   = (u1?.user ?? u1)?.id ?? '0';
    const id2   = (u2?.user ?? u2)?.id ?? '0';
    const score = shipScore(id1, id2);
    const bar   = shipBar(score);

    let mood, color;
    if      (score >= 90) { mood = '💞 Mükemmel eşleşme! Evlenin artık!';   color = 0xff69b4; }
    else if (score >= 70) { mood = '💗 Çok iyi gidiyorsunuz!';               color = 0xed4245; }
    else if (score >= 50) { mood = '💛 Fena değil, denesene!';               color = 0xfee75c; }
    else if (score >= 30) { mood = '💚 Arkadaş olarak kalsanız mı acaba?'; color = 0x57f287; }
    else                  { mood = '💀 Bu gemi batar, vazgeçin...';           color = 0x808080; }

    const gif = await fetchGif('kiss');

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`💘 ${name1} & ${name2}`)
      .setDescription(`${bar}\n\n**Uyum Oranı: ${score}%**\n\n${mood}`)
      .setFooter({ text: 'Natsu Animanga • Ship 💘' });
    if (gif) embed.setImage(gif);

    await interaction.reply({ content: `${mention(u1)} 💘 ${mention(u2)}`, embeds: [embed] });
  },
};

// ── All commands ─────────────────────────────────────────────────────────────
const commands = [
  // Target commands
  makeTargetCmd({ name: 'slap',      description: 'Birini tokat at! 💥',       category: 'slap',      color: 0xed4245, text: (a, t) => `**${a}** **${t}**'ye güçlü bir tokat attı! 💥👋`                        }),
  makeTargetCmd({ name: 'poke',      description: 'Birini dürt! 👉',            category: 'poke',      color: 0xfee75c, text: (a, t) => `**${a}** **${t}**'yi merakla dürtükledi! 👉`                          }),
  makeTargetCmd({ name: 'cuddle',    description: 'Birini kucakla! 🥰',         category: 'cuddle',    color: 0xff6b35, text: (a, t) => `**${a}** **${t}**'yi sıkıca kucakladı! 🥰💛`                          }),
  makeTargetCmd({ name: 'bite',      description: 'Birini ısır! 🦷',            category: 'bite',      color: 0xed4245, text: (a, t) => `**${a}** **${t}**'yi ısırdı! 🦷 Acıdı mı acaba?`                     }),
  makeTargetCmd({ name: 'highfive',  description: 'Çak bir beşlik! 🙌',         category: 'highfive',  color: 0x57f287, text: (a, t) => `**${a}** ve **${t}** harika bir beşlik çaktı! 🙌✨`                    }),
  makeTargetCmd({ name: 'wave',      description: 'Birine el salla! 👋',         category: 'wave',      color: 0x00b0f4, text: (a, t) => `**${a}** **${t}**'ye neşeyle el salladı! 👋😊`                       }),
  makeTargetCmd({ name: 'hug',       description: 'Birini sarıl! 🤗',            category: 'hug',       color: 0xff6b35, text: (a, t) => `**${a}** **${t}**'ye sımsıkı sarıldı! 🤗💛`                          }),
  makeTargetCmd({ name: 'kiss',      description: 'Birine öp! 💋',               category: 'kiss',      color: 0xff69b4, text: (a, t) => `**${a}** **${t}**'yi öptü! 💋😘`                                    }),
  makeTargetCmd({ name: 'pat',       description: 'Birinin başını okşa! 🥹',     category: 'pat',       color: 0xfee75c, text: (a, t) => `**${a}** sevgiyle **${t}**'nin başını okşadı! 🥹✨`                   }),
  // Self commands
  makeSelfCmd({ name: 'cry',    description: 'Ağla! 😢',         category: 'cry',   color: 0x00b0f4, text: a => `**${a}** hüngür hüngür ağlıyor! 😢💧`        }),
  makeSelfCmd({ name: 'dance',  description: 'Dans et! 💃',       category: 'dance', color: 0xf47fff, text: a => `**${a}** ateşli bir dans ediyor! 💃🎶`        }),
  makeSelfCmd({ name: 'blush',  description: 'Utanarak kızar! 😳', category: 'blush', color: 0xff6b6b, text: a => `**${a}** beeeedaviye kızardı! 😳🌸`           }),
  makeSelfCmd({ name: 'sleep',  description: 'Uyu! 😴',           category: 'sleep', color: 0x808080, text: a => `**${a}** derin bir uykuya daldı! 😴💤`         }),
  shipCommand,
];

export default commands;
