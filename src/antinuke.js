import { AuditLogEvent, PermissionFlagsBits } from 'discord.js';
import { config } from './config.js';
import { logCeza } from './logger.js';

const actionTracker = new Map();

function track(guildId, userId, type) {
  const key = `${guildId}:${userId}:${type}`;
  const now = Date.now();
  const { windowMs } = config.antinuke;
  if (!actionTracker.has(key)) actionTracker.set(key, []);
  const times = actionTracker.get(key).filter(t => now - t < windowMs);
  times.push(now);
  actionTracker.set(key, times);
  return times.length;
}

async function punish(guild, executor, reason) {
  if (!executor) return;
  const member = await guild.members.fetch(executor.id).catch(() => null);
  if (!member) return;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) {
    const owner = await guild.fetchOwner().catch(() => null);
    if (owner?.id === executor.id) return;
  }

  try {
    if (config.antinuke.punishAction === 'ban') {
      await guild.members.ban(executor.id, { reason });
    } else {
      await member.timeout(60 * 60_000, reason);
    }
  } catch (err) {
    console.warn('Anti-nuke punish failed:', err.message);
    return;
  }

  await logCeza(guild, {
    target: executor,
    moderator: guild.members.me ?? 'Bot',
    action: `Anti-Nuke: ${config.antinuke.punishAction === 'ban' ? 'Ban' : 'Timeout'}`,
    reason,
    duration: config.antinuke.punishAction === 'ban' ? 'Kalıcı' : '1 saat',
  });

  console.log(`🛡️ Anti-Nuke triggered on ${executor.tag} — ${reason}`);
}

export async function handleChannelDelete(channel) {
  const { guild } = channel;
  try {
    const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.ChannelDelete, limit: 1 });
    const entry = logs.entries.first();
    if (!entry || Date.now() - entry.createdTimestamp > 5000) return;
    const executor = entry.executor;
    if (executor?.id === guild.members.me?.id) return;

    const count = track(guild.id, executor.id, 'channelDelete');
    if (count >= config.antinuke.channelDeleteThreshold) {
      actionTracker.delete(`${guild.id}:${executor.id}:channelDelete`);
      await punish(guild, executor, `Anti-Nuke: ${count} kanal silindi`);
    }
  } catch (err) {
    console.warn('Anti-nuke channelDelete error:', err.message);
  }
}

export async function handleRoleDelete(role) {
  const { guild } = role;
  try {
    const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.RoleDelete, limit: 1 });
    const entry = logs.entries.first();
    if (!entry || Date.now() - entry.createdTimestamp > 5000) return;
    const executor = entry.executor;
    if (executor?.id === guild.members.me?.id) return;

    const count = track(guild.id, executor.id, 'roleDelete');
    if (count >= config.antinuke.roleDeleteThreshold) {
      actionTracker.delete(`${guild.id}:${executor.id}:roleDelete`);
      await punish(guild, executor, `Anti-Nuke: ${count} rol silindi`);
    }
  } catch (err) {
    console.warn('Anti-nuke roleDelete error:', err.message);
  }
}

export async function handleMemberBan(guild, user) {
  try {
    const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MemberBan, limit: 1 });
    const entry = logs.entries.first();
    if (!entry || Date.now() - entry.createdTimestamp > 5000) return;
    const executor = entry.executor;
    if (executor?.id === guild.members.me?.id) return;

    const count = track(guild.id, executor.id, 'ban');
    if (count >= config.antinuke.banThreshold) {
      actionTracker.delete(`${guild.id}:${executor.id}:ban`);
      await punish(guild, executor, `Anti-Nuke: ${count} üye ban edildi`);
    }
  } catch (err) {
    console.warn('Anti-nuke memberBan error:', err.message);
  }
}

export async function handleRoleUpdate(oldRole, newRole) {
  const { guild } = newRole;
  const gainedAdmin =
    !oldRole.permissions.has(PermissionFlagsBits.Administrator) &&
    newRole.permissions.has(PermissionFlagsBits.Administrator);
  if (!gainedAdmin) return;

  try {
    const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.RoleUpdate, limit: 1 });
    const entry = logs.entries.first();
    if (!entry || Date.now() - entry.createdTimestamp > 5000) return;
    const executor = entry.executor;
    if (executor?.id === guild.members.me?.id) return;
    if (executor?.id === guild.ownerId) return;

    await newRole.setPermissions(oldRole.permissions, 'Anti-Nuke: Admin izni geri alındı').catch(() => {});
    await punish(guild, executor, `Anti-Nuke: Role Admin yetkisi verildi (${newRole.name})`);
  } catch (err) {
    console.warn('Anti-nuke roleUpdate error:', err.message);
  }
}

export async function handleGuildUpdate(oldGuild, newGuild) {
  if (oldGuild.ownerId !== newGuild.ownerId) {
    console.warn(`⚠️ Guild owner changed in ${newGuild.name}`);
  }
}
