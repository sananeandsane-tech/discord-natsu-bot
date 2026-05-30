import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function loadCommands(client) {
  const commandsPath = join(__dirname, 'commands');
  const files = readdirSync(commandsPath).filter(f => f.endsWith('.js'));

  for (const file of files) {
    const mod = await import(`./commands/${file}`);
    const command = mod.default ?? mod;
    if (!command?.data || !command?.execute) {
      console.warn(`⚠️  Skipping ${file} — missing data or execute`);
      continue;
    }
    client.commands.set(command.data.name, command);
    console.log(`📦 Loaded command: /${command.data.name}`);
  }
}
