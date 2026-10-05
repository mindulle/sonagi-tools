import { SlashCommandBuilder } from 'discord.js';

export const pingCommand = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong! (Boilerplate test command)'),
  async execute(interaction: any) {
    await interaction.reply({ content: 'Pong! 🏓', ephemeral: true });
  },
};
