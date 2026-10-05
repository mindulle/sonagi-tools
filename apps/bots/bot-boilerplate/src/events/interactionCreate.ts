import { Client, Events, Interaction, ChatInputCommandInteraction } from 'discord.js';
import { logger, handleCommandError, CommandMap } from '@sonagi-bots/shared';

export function registerInteractionCreateEvent(client: Client, commands: CommandMap): void {
  client.on(Events.InteractionCreate, (interaction: Interaction) => {
    void (async () => {
      if (interaction.isChatInputCommand() || interaction.isContextMenuCommand()) {
        const command = commands.get(interaction.commandName);
        if (!command) return;

        try {
          await command.execute(interaction);
        } catch (error) {
          logger.error('Command execution failed', error);
          await handleCommandError(interaction as ChatInputCommandInteraction, error);
        }
      } else if (interaction.isAutocomplete()) {
        const command = commands.get(interaction.commandName);
        if (!command || !command.autocomplete) return;
        try {
          await command.autocomplete(interaction);
        } catch (error) {
          logger.error('Autocomplete failed', error);
        }
      }
    })();
  });
}
