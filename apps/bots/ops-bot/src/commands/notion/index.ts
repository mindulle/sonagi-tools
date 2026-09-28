import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { Command } from '@sonagi-bots/shared';
import { Colors, createErrorEmbed } from '@sonagi-bots/shared';
import { logger } from '@sonagi-bots/shared';
import { NotionService } from '../../services/notion';

export const scheduleCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('일정')
    .setDescription('노션(Notion) 데이터베이스와 연동하여 일정을 관리합니다.')
    .addSubcommand((subcommand) =>
      subcommand.setName('오늘').setDescription('오늘 예정된 모든 일정을 노션에서 조회합니다.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('추가')
        .setDescription('새로운 일정을 노션에 추가합니다.')
        .addStringOption((option) =>
          option.setName('제목').setDescription('일정의 제목을 입력하세요.').setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('날짜')
            .setDescription('일정 날짜 (예: 2026-07-09). 입력하지 않으면 오늘 날짜로 지정됩니다.')
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName('카테고리')
            .setDescription('일정의 카테고리 (예: 업무, 가족, 개인 등)')
            .setRequired(false)
            .addChoices(
              { name: '업무', value: '업무' },
              { name: '개인/활동', value: '활동' },
              { name: '가족', value: '가족' },
              { name: '채용', value: '채용' },
              { name: '병원', value: '병원' },
              { name: '학사', value: '학사' },
              { name: '실습', value: '실습' }
            )
        )
        .addStringOption((option) =>
          option
            .setName('장소')
            .setDescription('일정이 진행되는 장소를 입력하세요.')
            .setRequired(false)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    if (!process.env.NOTION_API_KEY || !process.env.NOTION_SCHEDULER_DATA_SOURCE_ID) {
      await interaction.reply({
        embeds: [
          createErrorEmbed(
            '현재 노션 연동이 비활성화되어 있습니다. (API 키 또는 데이터 소스 ID 누락)'
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    if (subcommand === '오늘') {
      await interaction.deferReply();

      try {
        const schedules = await NotionService.getTodaySchedules();

        if (schedules.length === 0) {
          const emptyEmbed = new EmbedBuilder()
            .setColor(Colors.INFO)
            .setTitle('📅 오늘의 일정')
            .setDescription('오늘은 예정된 일정이 없습니다. 푹 쉬세요! ☕')
            .setFooter({ text: 'Notion 연동' })
            .setTimestamp();

          await interaction.editReply({ embeds: [emptyEmbed] });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor(Colors.SUCCESS)
          .setTitle(`📅 오늘의 일정 (총 ${schedules.length}건)`)
          .setFooter({ text: 'Notion 연동' })
          .setTimestamp();

        let description = '';
        schedules.forEach((schedule, index) => {
          const status = schedule.isDone ? '✅' : '⏳';
          const categoryTag = schedule.category ? `[${schedule.category}] ` : '';
          const locationText = schedule.location ? ` - 📍 ${schedule.location}` : '';
          description += `${index + 1}. ${status} **${categoryTag}${schedule.title}**${locationText}\n`;
        });

        embed.setDescription(description);

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        logger.error('Error in /일정 오늘 command:', error);
        await interaction.editReply({
          embeds: [createErrorEmbed('일정을 불러오는 중 서버 통신 오류가 발생했습니다.')],
        });
      }
    } else if (subcommand === '추가') {
      const title = interaction.options.getString('제목', true);
      const category = interaction.options.getString('카테고리') || undefined;
      const location = interaction.options.getString('장소') || undefined;

      let dateString = interaction.options.getString('날짜');
      if (!dateString) {
        // 입력하지 않았으면 오늘 날짜 (KST)
        const today = new Date();
        const kstOffset = 9 * 60 * 60 * 1000;
        const todayKst = new Date(today.getTime() + kstOffset);
        dateString = todayKst.toISOString().split('T')[0];
      } else {
        // 날짜 형식 검증 (간단하게 YYYY-MM-DD)
        const regex = /^\d{4}-\d{2}-\d{2}$/;
        if (!regex.test(dateString)) {
          await interaction.reply({
            embeds: [
              createErrorEmbed('날짜 형식이 올바르지 않습니다. YYYY-MM-DD 형식으로 입력해주세요.'),
            ],
            ephemeral: true,
          });
          return;
        }
      }

      await interaction.deferReply();

      try {
        await NotionService.addSchedule(title, dateString, category, location);

        const embed = new EmbedBuilder()
          .setColor(Colors.SUCCESS)
          .setTitle('✅ 새로운 일정이 추가되었습니다.')
          .addFields(
            { name: '제목', value: title, inline: true },
            { name: '날짜', value: dateString, inline: true }
          );

        if (category) embed.addFields({ name: '카테고리', value: category, inline: true });
        if (location) embed.addFields({ name: '장소', value: location, inline: true });

        embed.setFooter({ text: 'Notion 연동' }).setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        logger.error('Error in /일정 추가 command:', error);
        await interaction.editReply({
          embeds: [createErrorEmbed('일정을 추가하는 중 서버 통신 오류가 발생했습니다.')],
        });
      }
    }
  },
};
