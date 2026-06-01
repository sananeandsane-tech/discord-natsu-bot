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
  import { joinGiveaway, leaveGiveaway, getGiveaway, buildGiveawayEmbed, buildGiveawayRow } from './giveaway.js';
  import { openTicket, closeTicket } from './ticket.js';
  import { handleBang } from './bang.js';
  import {
    initVoiceHub,
    handleVoiceChannelCreate,
    handleVoiceChannelDelete,
    handleVoiceHubButton,
  } from './voicechannel.js';

  const OWNER_DM_ID = '1510414431824384193';

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

  // ── Ready ──────────────────────────────────────────────────────────────────
  client.once(Events.ClientReady, async (c) => {
    console.log(`✅ Logged in as ${c.user.tag}`);
    console.log(`📊 Serving ${c.guilds.cache.size} guild(s)`);
    c.user.setPresence({
      activities: [{ name: config.botStatus.text, type: ActivityType.Playing }],
      status: 'online',
    });
    console.log(`🎮 Status: Playing ${config.botStatus.text}`);

    // Voice Hub panel mesajını başlat / yenile
    await initVoiceHub(c);
  });

  // ── Messages ───────────────────────────────────────────────────────────────
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;
    await Promise.allSettled([
      handleXP(message),
      handleAutoMod(message),
      handleAntiSpam(message),
      handleBang(message),
    ]);
  });

  // ── Message logs ───────────────────────────────────────────────────────────
  client.on(Events.MessageDelete, logMessageDelete);
  client.on(Events.MessageUpdate, logMessageEdit);

  // ── Member events ──────────────────────────────────────────────────────────
  client.on(Events.GuildMemberAdd, async (member) => {
    await Promise.allSettled([logMemberJoin(member), sendWelcome(member)]);
  });
  client.on(Events.GuildMemberRemove, logMemberLeave);
  client.on(Events.GuildMemberUpdate, logRoleChange);

  // ── Voice ──────────────────────────────────────────────────────────────────
  client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    await Promise.allSettled([
      logVoiceState(oldState, newState),
      handleVoiceChannelCreate(oldState, newState),
      handleVoiceChannelDelete(oldState, newState),
    ]);
  });

  // ── Anti-nuke ──────────────────────────────────────────────────────────────
  client.on(Events.ChannelDelete,   handleChannelDelete);
  client.on(Events.GuildRoleDelete, handleRoleDelete);
  client.on(Events.GuildBanAdd,     (ban) => handleMemberBan(ban.guild, ban.user));
  client.on(Events.GuildRoleUpdate, handleRoleUpdate);
  client.on(Events.GuildUpdate,     handleGuildUpdate);

  // ── Interactions ───────────────────────────────────────────────────────────
  client.on(Events.InteractionCreate, async (interaction) => {
    // ── Buttons ──
    if (interaction.isButton()) {
      try {
        const id = interaction.customId;

        // Voice Hub butonları
        if (id === 'vc_rename' || id === 'vc_lock' || id === 'vc_unlock') {
          return await handleVoiceHubButton(interaction);
        }

        // Giveaway buttons
        if (id === 'giveaway_join' || id === 'giveaway_leave') {
          await interaction.deferUpdate();
          const ga = getGiveaway(interaction.message.id);
          if (!ga || ga.ended) {
            return interaction.followUp({ content: '❌ Bu çekiliş artık aktif değil.', flags: 64 });
          }
          const updated = id === 'giveaway_join'
            ? joinGiveaway(ga.messageId, interaction.user.id)
            : leaveGiveaway(ga.messageId, interaction.user.id);
          const embed = buildGiveawayEmbed(updated);
          await interaction.message.edit({ embeds: [embed], components: [buildGiveawayRow()] });
          const msg = id === 'giveaway_join' ? '✅ Çekilişe katıldın! 🎉' : '❌ Çekilişten ayrıldın.';
          return interaction.followUp({ content: msg, flags: 64 });
        }

        // Ticket buttons
        if (id === 'ticket_open')  return await openTicket(interaction);
        if (id === 'ticket_close') return await closeTicket(interaction);

      } catch (err) {
        console.error('Button handler error:', err);
      }
      return;
    }

    // ── Slash commands ──
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(`Error in /${interaction.commandName}:`, err);
      const msg = { content: '❌ Komut çalıştırılırken hata oluştu.', flags: 64 };
      try {
        if (interaction.replied || interaction.deferred) await interaction.followUp(msg);
        else await interaction.reply(msg);
      } catch { /* ignore secondary error */ }
    }
  });

  // ── Offline DM ─────────────────────────────────────────────────────────────
  async function sendOfflineDM(reason) {
    try {
      const user = await client.users.fetch(OWNER_DM_ID);
      await user.send('deaktif oldum');
      console.log(`📩 Offline DM gönderildi → ${OWNER_DM_ID}`);
    } catch (err) {
      console.error('Offline DM gönderilemedi:', err.message);
    }
  }

  process.on('SIGTERM', async () => {
    await sendOfflineDM('SIGTERM');
    client.destroy();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    await sendOfflineDM('SIGINT');
    client.destroy();
    process.exit(0);
  });

  process.on('uncaughtException', async (err) => {
    console.error('Uncaught exception:', err);
    await sendOfflineDM('uncaughtException').catch(() => {});
    client.destroy();
    process.exit(1);
  });

  // ── Login ──────────────────────────────────────────────────────────────────
  client.login(config.token);
  