import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from 'discord.js';
import type { Command } from '@sonagi-bots/shared';
import { Colors, createErrorEmbed } from '@sonagi-bots/shared';
import { logger } from '@sonagi-bots/shared';
import { PaperclipService, PaperclipIssueResponse } from '../../services/paperclip';

export function createIssueSuccessEmbed(issue: PaperclipIssueResponse) {
  return new EmbedBuilder()
    .setColor(Colors.SUCCESS)
    .setTitle('✅ 새로운 이슈가 페이퍼클립에 등록되었습니다.')
    .setDescription(`**${issue.title}**\n\n${issue.description}`)
    .addFields(
      { name: '이슈 ID', value: issue.id || 'N/A', inline: true },
      { name: '상태', value: issue.status || 'Backlog', inline: true }
    )
    .setFooter({ text: 'Paperclip 연동' })
    .setTimestamp();
}

const AGENTS = [
  { name: 'Nuri (CTO)', value: '4ec5a12a-49bf-4047-8207-96a4a0723423' },
  { name: 'Money (PM)', value: '416efb4b-c17d-4397-8367-8c21681df4ce' },
  { name: 'Jenny (Designer)', value: 'fe04b047-99f7-46cd-af74-94000c5ebe3f' },
  { name: 'Maru (Librarian)', value: '9b25dc6d-a677-449d-8420-6c07476d7bb8' },
  { name: 'CEO', value: 'cc885508-8981-4930-9b70-4f2e1ffb1e6b' },
] as const;

const AGENT_NAME_MAP = Object.fromEntries(AGENTS.map((a) => [a.value, a.name])) as Record<
  string,
  string
>;

export const paperclipCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('이슈')
    .setDescription('페이퍼클립(Paperclip) 플랫폼과 연동하여 이슈를 관리합니다.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('생성')
        .setDescription('새로운 이슈(백로그)를 생성합니다. (입력 없이 엔터 시 팝업창이 뜹니다!)')
        .addStringOption((option) =>
          option
            .setName('제목')
            .setDescription('빠른 생성을 원할 경우 제목을 입력하세요.')
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName('내용')
            .setDescription('빠른 생성을 원할 경우 내용을 입력하세요.')
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName('회사')
            .setDescription('생성할 회사를 선택하세요. (기본: Mindulle Studio)')
            .setRequired(false)
            .addChoices(
              { name: 'Mindulle Studio (기본)', value: 'mindulle' },
              { name: 'LIFE (개인)', value: 'life' }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('조회')
        .setDescription('페이퍼클립에 등록된 최근 이슈 목록을 조회합니다.')
        .addIntegerOption((option) =>
          option
            .setName('개수')
            .setDescription('조회할 이슈 개수 (기본 5개, 최대 20개)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(20)
        )
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
        .addStringOption((option) =>
          option
            .setName('상태')
            .setDescription('조회할 이슈의 상태를 선택하세요. (기본: 모두 보기)')
            .setRequired(false)
            .addChoices(
              { name: '모두 보기 (기본)', value: 'all' },
              { name: '진행 중', value: 'in_progress' },
              { name: '리뷰 대기', value: 'in_review' },
              { name: '백로그', value: 'backlog' },
              { name: '할 일', value: 'todo' },
              { name: '완료됨', value: 'done' },
              { name: '차단됨', value: 'blocked' },
              { name: '취소됨', value: 'cancelled' }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('상세')
        .setDescription('페이퍼클립 이슈의 상세 내용을 조회합니다.')
        .addStringOption((option) =>
          option
            .setName('이슈id')
            .setDescription('상세 내용을 확인할 이슈 ID를 입력하세요.')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('할당')
        .setDescription('페이퍼클립 이슈를 에이전트에게 할당합니다.')
        .addStringOption((option) =>
          option
            .setName('이슈id')
            .setDescription('할당할 이슈 ID (예: CEO-335)를 입력하세요.')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('에이전트')
            .setDescription('이슈를 담당할 에이전트를 선택하세요.')
            .setRequired(true)
            .addChoices(...AGENTS, { name: '할당 해제 (Unassign)', value: 'unassign' })
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('상태')
        .setDescription('페이퍼클립 이슈의 진행 상태를 변경합니다.')
        .addStringOption((option) =>
          option
            .setName('이슈id')
            .setDescription('상태를 변경할 이슈 ID (예: CEO-335)를 입력하세요.')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('상태')
            .setDescription('변경할 상태를 선택하세요.')
            .setRequired(true)
            .addChoices(
              { name: '할 일 (todo)', value: 'todo' },
              { name: '진행 중 (in_progress)', value: 'in_progress' },
              { name: '리뷰 대기 (in_review)', value: 'in_review' },
              { name: '백로그 (backlog)', value: 'backlog' },
              { name: '완료됨 (done)', value: 'done' },
              { name: '차단됨 (blocked)', value: 'blocked' },
              { name: '취소됨 (cancelled)', value: 'cancelled' }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('코멘트')
        .setDescription('페이퍼클립 이슈에 코멘트를 추가합니다.')
        .addStringOption((option) =>
          option
            .setName('이슈id')
            .setDescription('코멘트를 남길 이슈 ID를 입력하세요.')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('내용').setDescription('코멘트 내용을 입력하세요.').setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === '생성') {
      const title = interaction.options.getString('제목');
      const rawDescription = interaction.options.getString('내용');
      const description = rawDescription || '상세 내용 없음';
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

      // 제목이 입력되지 않았다면 모달 팝업 띄우기
      if (!title) {
        const modal = new ModalBuilder()
          .setCustomId(`modal_issue_create_${companyId}`)
          .setTitle('새로운 이슈 생성');

        const titleInput = new TextInputBuilder()
          .setCustomId('issue_title')
          .setLabel('이슈 제목')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('예: 홈페이지 메인 배너 디자인 수정');

        const descInput = new TextInputBuilder()
          .setCustomId('issue_description')
          .setLabel('상세 내용 (프롬프트/지시사항)')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setPlaceholder('에이전트가 이해할 수 있도록 최대한 상세히 적어주세요.')
          .setMaxLength(2000); // 디스코드 모달 텍스트 길이 제한 감안

        if (rawDescription) {
          descInput.setValue(rawDescription);
        }

        const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput);
        const secondActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(descInput);

        modal.addComponents(firstActionRow, secondActionRow);

        await interaction.showModal(modal);
        return;
      }

      // 제목이 입력되었다면 기존처럼 빠른 생성 (Quick Create)
      await interaction.deferReply();

      try {
        const issue = await PaperclipService.createIssue(companyId, title, description);

        const embed = createIssueSuccessEmbed(issue);

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        logger.error('Error in /이슈 생성 command:', error);
        await interaction.editReply({
          embeds: [createErrorEmbed('이슈를 생성하는 중 서버 통신 오류가 발생했습니다.')],
        });
      }
    } else if (subcommand === '조회') {
      const limit = interaction.options.getInteger('개수') || 5;
      const status = interaction.options.getString('상태') || 'all';
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
        const issues = await PaperclipService.listIssues(companyId, limit, status);

        if (!Array.isArray(issues) || issues.length === 0) {
          const emptyEmbed = new EmbedBuilder()
            .setColor(Colors.INFO)
            .setTitle('📋 이슈 목록')
            .setDescription('현재 등록된 이슈가 없습니다.')
            .setFooter({ text: 'Paperclip 연동' })
            .setTimestamp();

          await interaction.editReply({ embeds: [emptyEmbed] });
          return;
        }

        const statusLabelMap: Record<string, string> = {
          all: '전체',
          in_progress: '진행 중',
          in_review: '리뷰 대기',
          backlog: '백로그',
          todo: '할 일',
          done: '완료됨',
          blocked: '차단됨',
          cancelled: '취소됨',
        };
        const statusLabel = statusLabelMap[status] || '전체';

        const embed = new EmbedBuilder()
          .setColor(Colors.INFO)
          .setTitle(`📋 최근 이슈 목록 [${statusLabel}] (Top ${issues.length})`)
          .setFooter({ text: 'Paperclip 연동' })
          .setTimestamp();

        let description = '';
        issues.forEach((issue) => {
          // 상태에 따른 이모지 표시
          let statusEmoji = '⚪';
          if (issue.status === 'done' || issue.status === 'completed') statusEmoji = '✅';
          else if (issue.status === 'in_progress') statusEmoji = '🏃';
          else if (issue.status === 'blocked') statusEmoji = '🚫';
          else if (issue.status === 'cancelled') statusEmoji = '❌';

          const displayId = issue.identifier || issue.id?.substring(0, 8) || 'N/A';
          description += `${statusEmoji} **[${displayId}]** ${issue.title || '제목 없음'}\n`;
        });

        embed.setDescription(description || '이슈를 불러올 수 없습니다.');

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        logger.error('Error in /이슈 조회 command:', error);
        await interaction.editReply({
          embeds: [createErrorEmbed('이슈 목록을 불러오는 중 서버 통신 오류가 발생했습니다.')],
        });
      }
    } else if (subcommand === '상세') {
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
        const issue = await PaperclipService.getIssue(issueId);

        let statusEmoji = '⚪';
        if (issue.status === 'done' || issue.status === 'completed') statusEmoji = '✅';
        else if (issue.status === 'in_progress') statusEmoji = '🏃';
        else if (issue.status === 'blocked') statusEmoji = '🚫';
        else if (issue.status === 'cancelled') statusEmoji = '❌';

        const embed = new EmbedBuilder()
          .setColor(Colors.INFO)
          .setTitle(`${statusEmoji} ${issue.title || '제목 없음'}`)
          .setDescription(
            issue.description ? issue.description.substring(0, 4000) : '상세 내용이 없습니다.'
          )
          .addFields(
            { name: '이슈 ID', value: issue.id || 'N/A', inline: true },
            { name: '상태', value: issue.status || 'N/A', inline: true }
          )
          .setFooter({ text: 'Paperclip 연동' })
          .setTimestamp();

        // Paperclip API에서 createdAt, updatedAt 등의 추가 정보가 있다면 필드 추가
        if (issue.createdAt) {
          const dateValue =
            typeof issue.createdAt === 'number' ? issue.createdAt : String(issue.createdAt);
          const date = new Date(dateValue);
          if (!isNaN(date.getTime())) {
            embed.addFields({
              name: '생성일',
              value: date.toLocaleDateString(),
              inline: true,
            });
          }
        }
        if (issue.priority) {
          embed.addFields({ name: '우선순위', value: String(issue.priority), inline: true });
        }

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        logger.error('Error in /이슈 상세 command:', error);
        await interaction.editReply({
          embeds: [
            createErrorEmbed(
              '이슈 상세 정보를 불러오는 중 오류가 발생했습니다. 이슈 ID를 다시 확인해주세요.'
            ),
          ],
        });
      }
    } else if (subcommand === '할당') {
      const issueId = interaction.options.getString('이슈id', true);
      const agentId = interaction.options.getString('에이전트', true);

      if (!process.env.PAPERCLIP_API_TOKEN) {
        await interaction.reply({
          embeds: [createErrorEmbed('현재 페이퍼클립 연동이 비활성화되어 있습니다.')],
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply();

      try {
        const assigneeAgentId = agentId === 'unassign' ? null : agentId;
        const issue = await PaperclipService.updateIssue(issueId, { assigneeAgentId });

        const displayAgentName =
          agentId === 'unassign' ? '할당 해제됨 (Unassigned)' : AGENT_NAME_MAP[agentId] || agentId;

        const embed = new EmbedBuilder()
          .setColor(Colors.SUCCESS)
          .setTitle('✅ 이슈가 성공적으로 할당되었습니다.')
          .setDescription(`**[${issue.identifier || issue.id?.substring(0, 8)}]** ${issue.title}`)
          .addFields({ name: '담당 에이전트', value: displayAgentName, inline: true })
          .setFooter({ text: 'Paperclip 연동' })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        logger.error('Error in /이슈 할당 command:', error);
        const errorMsg =
          error instanceof Error && error.message !== 'Unknown error'
            ? `\n(사유: ${error.message})`
            : '';
        await interaction.editReply({
          embeds: [
            createErrorEmbed(
              `이슈를 할당하는 중 오류가 발생했습니다. 이슈 ID를 다시 확인해주세요.${errorMsg}`
            ),
          ],
        });
      }
    } else if (subcommand === '상태') {
      const issueId = interaction.options.getString('이슈id', true);
      const status = interaction.options.getString('상태', true);

      if (!process.env.PAPERCLIP_API_TOKEN) {
        await interaction.reply({
          embeds: [createErrorEmbed('현재 페이퍼클립 연동이 비활성화되어 있습니다.')],
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply();

      try {
        const issue = await PaperclipService.updateIssue(issueId, { status });

        // 상태에 따른 이모지 및 한글 라벨 표시
        const statusLabelMap: Record<string, string> = {
          todo: '할 일 (todo)',
          in_progress: '진행 중 (in_progress)',
          in_review: '리뷰 대기 (in_review)',
          backlog: '백로그 (backlog)',
          done: '완료됨 (done)',
          completed: '완료됨 (completed)',
          blocked: '차단됨 (blocked)',
          cancelled: '취소됨 (cancelled)',
        };

        let statusEmoji = '⚪';
        if (issue.status === 'done' || issue.status === 'completed') statusEmoji = '✅';
        else if (issue.status === 'in_progress') statusEmoji = '🏃';
        else if (issue.status === 'blocked') statusEmoji = '🚫';
        else if (issue.status === 'cancelled') statusEmoji = '❌';

        const displayStatus = statusLabelMap[issue.status] || issue.status || status;

        const embed = new EmbedBuilder()
          .setColor(Colors.SUCCESS)
          .setTitle(`${statusEmoji} 이슈 상태가 변경되었습니다.`)
          .setDescription(`**[${issue.identifier || issue.id?.substring(0, 8)}]** ${issue.title}`)
          .addFields({ name: '변경된 상태', value: displayStatus, inline: true })
          .setFooter({ text: 'Paperclip 연동' })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        logger.error('Error in /이슈 상태 command:', error);
        const errorMsg =
          error instanceof Error && error.message !== 'Unknown error'
            ? `\n(사유: ${error.message})`
            : '';
        await interaction.editReply({
          embeds: [
            createErrorEmbed(
              `이슈 상태를 변경하는 중 오류가 발생했습니다. 이슈 ID를 다시 확인해주세요.${errorMsg}`
            ),
          ],
        });
      }
    } else if (subcommand === '코멘트') {
      const issueId = interaction.options.getString('이슈id', true);
      const content = interaction.options.getString('내용', true);

      if (!process.env.PAPERCLIP_API_TOKEN) {
        await interaction.reply({
          embeds: [createErrorEmbed('현재 페이퍼클립 연동이 비활성화되어 있습니다.')],
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply();

      try {
        await PaperclipService.commentOnIssue(issueId, content);

        const embed = new EmbedBuilder()
          .setColor(Colors.SUCCESS)
          .setTitle('✅ 이슈 코멘트가 등록되었습니다.')
          .addFields(
            { name: '이슈 ID', value: issueId, inline: true },
            { name: '코멘트', value: content, inline: false }
          )
          .setFooter({ text: 'Paperclip 연동' })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        logger.error('Error in /이슈 코멘트 command:', error);
        await interaction.editReply({
          embeds: [
            createErrorEmbed(
              '이슈에 코멘트를 등록하는 중 서버 통신 오류가 발생했습니다. 이슈 ID를 확인해주세요.'
            ),
          ],
        });
      }
    }
  },
};
