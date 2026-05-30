# Natsu Animanga Discord Bot

A full-featured Discord moderation and leveling bot built with discord.js v14.

## Features
- **Level / XP System** — XP per message, level-up announcements
- **Moderation** — `/ban`, `/kick`, `/mute`, `/warn`, `/warnings`, `/purge`
- **Anti-Nuke** — Detects mass channel/role deletes, mass bans, admin perm grants
- **Anti-Spam** — 10 msgs in 5s → 1 min timeout
- **Warn System** — Every 3rd warn = 1 hour timeout, others = 1 min
- **5 Log Channels** — Voice, messages, join/leave, roles, punishments (by channel ID)
- **Info Commands** — `/serverinfo`, `/userinfo` with weekly stats, `/rank`, `/leaderboard`, `/botinfo`

## Setup
```bash
npm install
# Set DISCORD_BOT_TOKEN as environment variable
npm run deploy-commands
npm start
```

## Log Channel IDs (configure in `src/config.js`)
| Key | Purpose |
|-----|---------|
| `SES_LOG` | Voice activity |
| `MESAJ_LOG` | Message edits & deletes |
| `GIRIS_CIKIS_LOG` | Member joins & leaves |
| `ROL_LOG` | Role changes |
| `CEZA_LOG` | All punishments |

## Bot Status
`Playing Natsu Animanga Yetkili Alım`
