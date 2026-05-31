# Natsu Animanga Discord Bot

A full-featured Discord moderation, leveling and welcome bot built with discord.js v14.

## Features
- **Welcome System** — Rich embed welcome + role assign on join, `/welcometest`
- **Level / XP System** — XP per message, level-up announcements
- **Moderation** — `/ban`, `/kick`, `/mute`, `/warn`, `/warnings`, `/purge`
- **Anti-Nuke** — Mass channel/role deletes, mass bans, admin perm grants
- **Anti-Spam** — 10 msgs in 5s → 1 min timeout
- **Warn System** — Every 3rd warn = 1 hour timeout, others = 1 min
- **5 Log Channels** — Voice, messages, join/leave, roles, punishments (by channel ID)
- **Info Commands** — `/serverinfo`, `/userinfo`, `/rank`, `/leaderboard`, `/botinfo`

## Environment Variables
| Variable | Description |
|----------|-------------|
| `DISCORD_BOT_TOKEN` | Bot token from Discord Developer Portal |
| `KARSILAMA_ROLE_ID` | Role ID to assign + tag on member join |
| `KURALLAR_KANAL_ID` | Rules channel ID (linked in welcome embed) |
| `DUYURULAR_KANAL_ID` | Announcements channel ID (linked in welcome embed) |

## Setup
```bash
npm install
npm run deploy-commands
npm start
```

## Log Channel IDs (`src/config.js`)
| Key | Purpose |
|-----|---------|
| `SES_LOG` | Voice activity |
| `MESAJ_LOG` | Message edits & deletes |
| `GIRIS_CIKIS_LOG` | Joins, leaves & welcome messages |
| `ROL_LOG` | Role changes |
| `CEZA_LOG` | All punishments |
