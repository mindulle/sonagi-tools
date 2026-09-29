import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { Command } from '@sonagi-bots/shared';
import { Colors, createErrorEmbed } from '@sonagi-bots/shared';
import { logger } from '@sonagi-bots/shared';
import { PaperclipService } from '../../services/paperclip';

export const paperclipPlanCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('계획')
    .setDescription('페이퍼클립(Paperclip) 플랫폼의 이슈 계획(Plan)을 관리합니다.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('대기')
        .setDescription('페이퍼클립에 대기 중인 계획 목록(In Review)을 조회합니다.')
        .addStringOption((option) =>
          option
            .setName('회사')
            .setDescription('조회할 회사를 선택하세요. (기본: Mindulle Studio)')
            .setRequired(false)
            .addChoices(
              { name: 'Mindulle Studio (기본)', value: 'mindulle' },
              { name: 'LIFE (개인)', value: 'life' }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('승인')
        .setDescription('페이퍼클립의 대기 중인 계획을 승인(Confirm)합니다.')
        .addStringOption((option) =>
          option
            .setName('이슈id')
            .setDescription('승인할 이슈 ID(예: CEO-340)를 입력하세요.')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('거절')
        .setDescription('페이퍼클립의 대기 중인 계획을 거절(Decline)합니다.')
        .addStringOption((option) =>
          option
            .setName('이슈id')
            .setDescription('거절할 이슈 ID(예: CEO-340)를 입력하세요.')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('코멘트')
            .setDescription('거절 사유(코멘트)를 입력하세요. (선택사항)')
            .setRequired(false)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === '대기') {
      const companyId = PaperclipService.getCompanyIdFromInteraction(interaction);

      if (!process.env.PAPERCLIP_API_TOKEN || !companyId) {
        await interaction.reply({
          embeds: [
            createErrorEmbed(
              '현재 페이퍼클립 연동이 비활성화되어 있습니다. (API 토큰 또는 회사 ID 누락)'
            ),
          ],
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply();

      try {
        const issues = await PaperclipService.listInReviewIssues(companyId);

        if (!Array.isArray(issues) || issues.length === 0) {
          const emptyEmbed = new EmbedBuilder()
            .setColor(Colors.INFO)
            .setTitle('📋 계획(Plan) 리뷰 대기 목록')
            .setDescription('현재 리뷰 대기 중인 계획이 없습니다.')
            .setFooter({ text: 'Paperclip 연동' })
            .setTimestamp();

          await interaction.editReply({ embeds: [emptyEmbed] });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor(Colors.INFO)
          .setTitle(`📋 계획(Plan) 리뷰 대기 목록 (총 ${issues.length}건)`)
          .setFooter({ text: 'Paperclip 연동' })
          .setTimestamp();

        let description = '';
        const MAX_DISPLAY = 15;
        const displayIssues = issues.slice(0, MAX_DISPLAY);

        displayIssues.forEach((issue) => {
          description += `⏳ **[${issue.identifier || issue.id?.substring(0, 8)}]** ${issue.title || '제목 없음'}\n`;
        });

        if (issues.length > MAX_DISPLAY) {
          description += `\n*... 외 ${issues.length - MAX_DISPLAY}건의 계획 대기가 더 있습니다.*`;
        }

        embed.setDescription(description || '계획을 불러올 수 없습니다.');

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        logger.error('Error in /계획 대기 command:', error);
        await interaction.editReply({
          embeds: [createErrorEmbed('계획 대기 목록을 불러오는 중 서버 통신 오류가 발생했습니다.')],
        });
      }
    } else if (subcommand === '승인') {
      const issueId = interaction.options.getString('이슈id', true);

      if (!process.env.PAPERCLIP_API_TOKEN) {
        await interaction.reply({
          embeds: [createErrorEmbed('현재 페이퍼클립 연동이 비활성화되어 있습니다.')],
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply();

      try {
        // 1. Get interaction for this issue
        const interactionData = await PaperclipService.getPendingConfirmationInteraction(issueId);

        if (!interactionData) {
          await interaction.editReply({
            embeds: [
              createErrorEmbed(
                `해당 이슈(${issueId})에 승인 대기 중인 계획(Interaction)이 없습니다.`
              ),
            ],
          });
          return;
        }

        // 2. Accept Plan
        await PaperclipService.acceptPlan(issueId, interactionData.id);

        let heartbeatMsg = '';
        // 3. Invoke Agent Heartbeat to wake them up
        if (interactionData.agentId) {
          try {
            await PaperclipService.invokeAgentHeartbeat(interactionData.agentId);
            heartbeatMsg = '\n\n*(에이전트를 깨웠습니다. 곧 다음 작업을 시작합니다!)*';
          } catch (e) {
            logger.warn(`Failed to wake up agent ${interactionData.agentId}`, e);
          }
        }

        const embed = new EmbedBuilder()
          .setColor(Colors.SUCCESS)
          .setTitle('✅ 계획이 승인되었습니다.')
          .setDescription(`승인 처리가 완료되었습니다.${heartbeatMsg}`)
          .addFields({ name: '이슈 ID', value: issueId, inline: true })
          .setFooter({ text: 'Paperclip 연동' })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        logger.error('Error in /계획 승인 command:', error);
        await interaction.editReply({
          embeds: [
            createErrorEmbed('계획 승인 중 서버 통신 오류가 발생했습니다. 이슈 ID를 확인해주세요.'),
          ],
        });
      }
    } else if (subcommand === '거절') {
      const issueId = interaction.options.getString('이슈id', true);
      const comment = interaction.options.getString('코멘트') || '';

      if (!process.env.PAPERCLIP_API_TOKEN) {
        await interaction.reply({
          embeds: [createErrorEmbed('현재 페이퍼클립 연동이 비활성화되어 있습니다.')],
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply();

      try {
        // 1. Get interaction ID for this issue
        const interactionData = await PaperclipService.getPendingConfirmationInteraction(issueId);

        if (!interactionData) {
          await interaction.editReply({
            embeds: [
              createErrorEmbed(
                `해당 이슈(${issueId})에 거절할 대기 중인 계획(Interaction)이 없습니다.`
              ),
            ],
          });
          return;
        }

        // 2. Reject Plan
        await PaperclipService.rejectPlan(issueId, interactionData.id, comment);

        let heartbeatMsg = '';
        // 3. Invoke Agent Heartbeat to wake them up
        if (interactionData.agentId) {
          try {
            await PaperclipService.invokeAgentHeartbeat(interactionData.agentId);
            heartbeatMsg = '\n\n*(에이전트를 깨웠습니다. 곧 피드백을 반영하여 다시 작업합니다!)*';
          } catch (e) {
            logger.warn(`Failed to wake up agent ${interactionData.agentId}`, e);
          }
        }

        const embed = new EmbedBuilder()
          .setColor(Colors.WARNING)
          .setTitle('❌ 계획이 거절되었습니다.')
          .setDescription(`거절 처리 및 피드백 전송이 완료되었습니다.${heartbeatMsg}`)
          .addFields(
            { name: '이슈 ID', value: issueId, inline: true },
            { name: '사유(코멘트)', value: comment || '없음', inline: false }
          )
          .setFooter({ text: 'Paperclip 연동' })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        logger.error('Error in /계획 거절 command:', error);
        await interaction.editReply({
          embeds: [
            createErrorEmbed('계획 거절 중 서버 통신 오류가 발생했습니다. 이슈 ID를 확인해주세요.'),
          ],
        });
      }
    }
  },
};
