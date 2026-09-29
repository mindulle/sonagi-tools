import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { Command } from '@sonagi-bots/shared';
import { galleryService } from '../../services/gallery.service';
import { Colors, createErrorEmbed } from '@sonagi-bots/shared';

export const galleryCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('gallery')
    .setDescription('Sonagi Eagle Gallery 관련 명령어')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('search')
        .setDescription('태그 또는 키워드로 디자인 레퍼런스를 검색합니다.')
        .addStringOption((option) =>
          option.setName('query').setDescription('검색할 태그나 키워드').setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'search': {
        const query = interaction.options.getString('query', true);
        await interaction.deferReply();

        const results = await galleryService.searchReferences(query);

        if (results.length === 0) {
          await interaction.editReply({
            embeds: [createErrorEmbed(`'${query}'에 대한 검색 결과가 없습니다.`)],
          });
          return;
        }

        const image = results[0];

        // Handle empty or too long tags safely for Discord Embed constraints
        let tagsValue = 'No tags';
        if (image.tags && image.tags.length > 0) {
          tagsValue = image.tags.map((t) => `\`${t}\``).join(' ');
          if (tagsValue.length > 1000) {
            tagsValue = tagsValue.substring(0, 1000) + '...';
          }
        }

        const embed = new EmbedBuilder()
          .setColor(Colors.PRIMARY)
          .setTitle(`🎨 Gallery: ${image.name}`)
          .setImage(image.url)
          .addFields({ name: 'Tags', value: tagsValue })
          .setFooter({ text: `Eagle Gallery Search Result • Keyword: ${query}` })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        break;
      }

      default:
        await interaction.reply({
          embeds: [createErrorEmbed('알 수 없는 서브커맨드입니다.')],
          ephemeral: true,
        });
    }
  },
};
