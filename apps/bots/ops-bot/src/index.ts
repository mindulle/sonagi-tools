/* eslint-disable */
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import dotenv from 'dotenv';
dotenv.config({ path: '/home/ubuntu/sonagi-bots/.env' });

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  integrations: [nodeProfilingIntegration()],
  tracesSampleRate: 0.1,
  profilesSampleRate: 0.1,
  beforeSend(event, hint) {
    const error = hint.originalException as Error;
    if (error && error.message) {
      if (
        error.message.includes('already been acknowledged') ||
        error.message.includes('Unknown interaction')
      ) {
        return null;
      }
    }
    const eventString = JSON.stringify(event);
    const token = process.env.OPS_BOT_TOKEN;
    if (token && eventString.includes(token)) {
      return JSON.parse(eventString.replace(new RegExp(token, 'g'), '[FILTERED_TOKEN]'));
    }
    return event;
  },
});

import { logger, assertEnvVariable, CommandMap } from '@sonagi-bots/shared';
import { registerReadyEvent } from './events/ready';
import { registerInteractionCreateEvent } from './events/interactionCreate';
import { registerMessageCreateEvent } from './events/messageCreate';
import { registerMessageReactionAddEvent } from './events/messageReactionAdd';
import { initScheduler } from './services/scheduler';

// Import commands
import { paperclipCommand } from './commands/paperclip/index';
import { paperclipApprovalCommand } from './commands/paperclip/approval';
import { paperclipAgentCommand } from './commands/paperclip/agent';
import { paperclipPlanCommand } from './commands/paperclip/plan';
import { scheduleCommand } from './commands/notion/index';
import { ledgerCommand } from './commands/notion/ledger';
import { todoCommand } from './commands/todo/index';
import { addTodoContextMenu } from './commands/todo/context-menu';
import { n8nCommand } from './commands/n8n/index';
import { infraCommand } from './commands/infra/index';
import { helpCommand } from './commands/help/index';

async function main() {
  try {
    logger.info('Starting Ops Bot...');

    const token = assertEnvVariable('OPS_BOT_TOKEN');
    assertEnvVariable('DISCORD_CLIENT_ID');

    if (!process.env.PAPERCLIP_API_TOKEN) {
      logger.warn('PAPERCLIP_API_TOKEN is not set.');
    }

    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
      ],
      partials: [Partials.Message, Partials.Reaction, Partials.User],
    });

    const commands: CommandMap = new Map([
      [paperclipCommand.data.name, paperclipCommand],
      [paperclipApprovalCommand.data.name, paperclipApprovalCommand],
      [paperclipAgentCommand.data.name, paperclipAgentCommand],
      [paperclipPlanCommand.data.name, paperclipPlanCommand],
      [scheduleCommand.data.name, scheduleCommand],
      [ledgerCommand.data.name, ledgerCommand],
      [todoCommand.data.name, todoCommand],
      [addTodoContextMenu.data.name, addTodoContextMenu],
      [n8nCommand.data.name, n8nCommand],
      [infraCommand.data.name, infraCommand],
      [helpCommand.data.name, helpCommand],
    ]);

    logger.info(`Registered ${commands.size} commands`);

    registerReadyEvent(client, commands);
    registerInteractionCreateEvent(client, commands);
    registerMessageCreateEvent(client);
    registerMessageReactionAddEvent(client);

    // Start Internal Scheduler
    initScheduler(client);

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
