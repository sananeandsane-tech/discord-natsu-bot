import { PermissionFlagsBits } from 'discord.js';

const BANG_GIF = 'https://media.tenor.com/lGJGFCtQ3WQAAAAC/shaula-rezero.gif';

export async function handleBang(message) {
  if (!message.content.toLowerCase().startsWith('-bang')) return;
  if (!message.guild) return;

  const member = message.member;
  if (!member || !member.permissions.has(PermissionFlagsBits.BanMembers)) return;

  const target = message.mentions.members.first();
  if (!target) return;

  try {
    await target.ban({ reason: `${message.author.tag} tarafından -bang komutuyla yasaklandı.` });
    await message.channel.send({ content: `${target.user} 💥\n${BANG_GIF}` });
  } catch {
    await message.channel.send({ content: 'bu kişiyi banlayamıyorum' });
  }
}
