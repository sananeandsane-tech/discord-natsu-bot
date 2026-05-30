import { REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const token = process.env.DISCORD_BOT_TOKEN;

if (!token) {
  console.error('❌ DISCORD_BOT_TOKEN not set');
  process.exit(1);
}

const commands = [];
const commandsPath = join(__dirname, 'commands');
const files = readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of files) {
  const mod = await import(`./commands/${file}`);
  const cmd = mod.default ?? mod;
  if (cmd?.data) commands.push(cmd.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(token);

console.log(`📤 Registering ${commands.length} global slash command(s)...`);

try {
  const clientId = (await rest.get(Routes.user())).id;
  await rest.put(Routes.applicationCommands(clientId), { body: commands });
  console.log('✅ Slash commands registered globally (may take up to 1 hour to propagate).');
  console.log('💡 Tip: For instant testing, register to a specific guild instead.');
} catch (err) {
  console.error('❌ Failed to register commands:', err);
}
