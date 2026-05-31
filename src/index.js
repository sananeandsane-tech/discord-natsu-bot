import { Client, GatewayIntentBits, Collection, Events, ActivityType } from 'discord.js';
import { config } from './config.js';
import { loadCommands } from './commandLoader.js';
import { handleXP } from './xp.js';
import { handleAutoMod } from './automod.js';
import { handleAntiSpam } from './antispam.js';
import {
  handleChannelDelete,
  handleRoleDelete,
  handleMemberBan,
  handleRoleUpdate,
  handleGuildUpdate,
} from './antinuke.js';
import {
  logMemberJoin,
  logMemberLeave,
  logMessageDelete,
  logMessageEdit,
  logVoiceState,
  logRoleChange,
} from './logger.js';
import { sendWelcome } from './welcome.js';

if (!config.token) {
  console.error('❌ DISCORD_BOT_TOKEN ayarlanmamış.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildBans,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration,
  ],
});

client.commands = new Collection();
await loadCommands(client);

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Logged in as ${c.user.tag}`);
  console.log(`📊 Serving ${c.guilds.cache.size} guild(s)`);
  c.user.setPresence({
    activities: [{ name: config.botStatus.text, type: ActivityType.Playing }],
    status: 'online',
  });
  console.log(`🎮 Status: Playing ${config.botStatus.text}`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;
  await Promise.allSettled([
    handleXP(message),
    handleAutoMod(message),
    handleAntiSpam(message),
  ]);
});

client.on(Events.MessageDelete, logMessageDelete);
client.on(Events.MessageUpdate, logMessageEdit);

client.on(Events.GuildMemberAdd, async (member) => {
  await Promise.allSettled([logMemberJoin(member), sendWelcome(member)]);
});
client.on(Events.GuildMemberRemove, logMemberLeave);
client.on(Events.GuildMemberUpdate, logRoleChange);

client.on(Events.VoiceStateUpdate, logVoiceState);

client.on(Events.ChannelDelete,  handleChannelDelete);
client.on(Events.GuildRoleDelete, handleRoleDelete);
client.on(Events.GuildBanAdd,    (ban) => handleMemberBan(ban.guild, ban.user));
client.on(Events.GuildRoleUpdate, handleRoleUpdate);
client.on(Events.GuildUpdate,    handleGuildUpdate);

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`Error in /${interaction.commandName}:`, err);
    const msg = { content: '❌ Komut çalıştırılırken hata oluştu.', ephemeral: true };
    if (interaction.replied || interaction.deferred) await interaction.followUp(msg);
    else await interaction.reply(msg);
  }
});

client.login(config.token);
