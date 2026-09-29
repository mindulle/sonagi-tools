import { Client, Events, REST, Routes } from 'discord.js';
import { logger, CommandMap } from '@sonagi-bots/shared';

export function registerReadyEvent(client: Client, commands: CommandMap): void {
  client.once(Events.ClientReady, (readyClient) => {
    logger.info(`Logged in as ${readyClient.user.tag}`);
    logger.info(`Serving ${readyClient.guilds.cache.size} guilds`);

    readyClient.user.setPresence({
      activities: [{ name: 'Sonagi Bot System' }],
      status: 'online',
    });

    // 길드별 슬래시 커맨드 자동 등록
    const clientId = process.env.DISCORD_CLIENT_ID!;
    const token = process.env.OPS_BOT_TOKEN!;
    const rest = new REST().setToken(token);
    const commandData = [...commands.values()].map((cmd) => cmd.data.toJSON());

    void (async () => {
      for (const guild of readyClient.guilds.cache.values()) {
        try {
          await rest.put(Routes.applicationGuildCommands(clientId, guild.id), {
            body: commandData,
          });
          logger.info(`Deployed ${commandData.length} commands to guild: ${guild.name}`);
        } catch (error) {
          logger.error(`Failed to deploy commands to guild ${guild.name}`, error);
        }
      }
    })();
  });
}
