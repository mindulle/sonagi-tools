import { Client, GatewayIntentBits, Partials } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config({ path: '/home/ubuntu/sonagi-bots/.env' });

import { logger, assertEnvVariable, CommandMap } from '@sonagi-bots/shared';
import { registerReadyEvent } from './events/ready';
import { registerInteractionCreateEvent } from './events/interactionCreate';
import { DashboardService } from './services/dashboard.service';

// Import commands
import { infraCommand } from './commands/infra/index';
import { playCommand } from './commands/playgrounds/index';
import { utilsCommand } from './commands/utils/index';
import { helpCommand } from './commands/help/index';

async function main() {
  try {
    logger.info('Starting Dev Bot...');

    const token = assertEnvVariable('DEV_BOT_TOKEN');
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
      [infraCommand.data.name, infraCommand],
      [playCommand.data.name, playCommand],
      [utilsCommand.data.name, utilsCommand],
      [helpCommand.data.name, helpCommand],
    ]);

    logger.info(`Registered ${commands.size} commands`);

    registerReadyEvent(client, commands);
    registerInteractionCreateEvent(client, commands);

    await client.login(token);

    void DashboardService.updateDashboard(client);
    setInterval(
      () => {
        void DashboardService.updateDashboard(client);
      },
      5 * 60 * 1000
    );

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
