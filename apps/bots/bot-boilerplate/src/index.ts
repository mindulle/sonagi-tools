import { Client, GatewayIntentBits, Partials } from 'discord.js';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { logger, assertEnvVariable, CommandMap } from '@sonagi-bots/shared';
import { registerReadyEvent } from './events/ready';
import { registerInteractionCreateEvent } from './events/interactionCreate';

// Import commands
import { pingCommand } from './commands/ping';

async function main() {
  try {
    logger.info('Starting Bot Boilerplate...');

    const token = assertEnvVariable('BOT_TOKEN');
    assertEnvVariable('DISCORD_CLIENT_ID');

    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
      partials: [Partials.Message, Partials.User],
    });

    const commands: CommandMap = new Map([
      [pingCommand.data.name, pingCommand],
    ]);

    logger.info(`Registered ${commands.size} commands`);

    registerReadyEvent(client, commands);
    registerInteractionCreateEvent(client, commands);

    await client.login(token);

    process.on('SIGINT', () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      void client.destroy();
      process.exit(0);
    });
    process.on('SIGTERM', () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      void client.destroy();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to start bot', error);
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error('Unhandled error in main', error);
  process.exit(1);
});
