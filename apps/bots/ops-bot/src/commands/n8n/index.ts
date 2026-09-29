/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import type { Command } from '@sonagi-bots/shared';
import { Colors, createErrorEmbed } from '@sonagi-bots/shared';
import { n8nClient } from '../../clients/n8n.client';

export const n8nCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('n8n')
    .setDescription('n8n 워크플로우 및 상태를 관리합니다.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((subcommand) =>
      subcommand.setName('상태').setDescription('n8n 서버의 상태(Health Check)를 확인합니다.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('실행')
        .setDescription('특정 n8n Webhook을 트리거합니다.')
        .addStringOption((option) =>
          option
            .setName('url')
            .setDescription('트리거할 Webhook URL을 입력하세요.')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('데이터')
            .setDescription('JSON 형태의 페이로드를 입력하세요.')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('기록').setDescription('최근 실행된 워크플로우 상태를 조회합니다.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('목록')
        .setDescription('워크플로우 목록을 조회합니다.')
        .addStringOption((option) =>
          option
            .setName('태그')
            .setDescription('조회할 워크플로우 태그 (예: Bot, System)')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('제어')
        .setDescription('워크플로우를 활성화 또는 비활성화합니다.')
        .addStringOption((option) =>
          option.setName('id').setDescription('제어할 워크플로우 ID').setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('상태')
            .setDescription('켜기(on) 또는 끄기(off)')
            .setRequired(true)
            .addChoices(
              { name: '켜기 (Activate)', value: 'on' },
              { name: '끄기 (Deactivate)', value: 'off' }
            )
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === '상태') {
      await interaction.deferReply();
      const isHealthy = await n8nClient.ping();

      const embed = new EmbedBuilder()
        .setTitle('🛠️ n8n 서버 상태')
        .setDescription(
          isHealthy
            ? 'n8n 서버가 **정상적으로 동작 중**입니다. ✅'
            : 'n8n 서버와 연결할 수 없습니다. ❌'
        )
        .setColor(isHealthy ? Colors.SUCCESS : Colors.ERROR)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } else if (subcommand === '실행') {
      const url = interaction.options.getString('url', true);
      const dataStr = interaction.options.getString('데이터') || '{}';

      let payload: unknown;
      try {
        payload = JSON.parse(dataStr);
      } catch (e) {
        await interaction.reply({
          embeds: [createErrorEmbed('잘못된 JSON 형식입니다.')],
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply();
      try {
        const responseData = await n8nClient.triggerWebhook(url, payload);
        const embed = new EmbedBuilder()
          .setTitle('✅ n8n Webhook 실행 성공')
          .setDescription(
            `\`\`\`json\n${JSON.stringify(responseData, null, 2).substring(0, 2000)}\n\`\`\``
          )
          .setColor(Colors.SUCCESS);
        await interaction.editReply({ embeds: [embed] });
      } catch (error: any) {
        await interaction.editReply({
          embeds: [createErrorEmbed(`Webhook 실패: ${error.message}`)],
        });
      }
    } else if (subcommand === '기록') {
      await interaction.deferReply();
      try {
        const executions = await n8nClient.getRecentExecutions(5);
        if (!executions || executions.length === 0) {
          await interaction.editReply({
            embeds: [new EmbedBuilder().setTitle('📋 기록 없음').setColor(Colors.INFO)],
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor(Colors.INFO)
          .setTitle('📋 최근 n8n 실행 기록 (5건)');
        let description = '';
        executions.forEach((exec: any, index) => {
          const statusIcon =
            exec.status === 'success' ? '✅' : exec.status === 'error' ? '❌' : '⏳';
          const workflowName = exec.workflowData?.name || `ID: ${exec.workflowId}`;
          const time = new Date(exec.startedAt || '').toLocaleString('ko-KR');
          description += `${index + 1}. ${statusIcon} **${workflowName}**\n   └ 상태: ${exec.status} | 시작: ${time}\n`;
        });
        embed.setDescription(description);
        await interaction.editReply({ embeds: [embed] });
      } catch (error: any) {
        await interaction.editReply({
          embeds: [createErrorEmbed(`기록 조회 실패: ${error.message}`)],
        });
      }
    } else if (subcommand === '목록') {
      await interaction.deferReply();
      const tag = interaction.options.getString('태그');
      try {
        const workflows = await n8nClient.getWorkflows(tag || undefined);
        const embed = new EmbedBuilder()
          .setColor(Colors.INFO)
          .setTitle(`📋 n8n 워크플로우 목록 ${tag ? `(태그: ${tag})` : ''}`);

        let description = '';
        workflows.slice(0, 20).forEach((wf: any) => {
          const status = wf.active ? '🟢' : '⏸️';
          description += `${status} **${wf.name}**\n   └ ID: \`${wf.id}\`\n`;
        });
        if (workflows.length > 20) description += `\n*...외 ${workflows.length - 20}개 생략됨*`;
        if (workflows.length === 0) description = '결과가 없습니다.';

        embed.setDescription(description);
        await interaction.editReply({ embeds: [embed] });
      } catch (error: any) {
        await interaction.editReply({
          embeds: [createErrorEmbed(`목록 조회 실패: ${error.message}`)],
        });
      }
    } else if (subcommand === '제어') {
      await interaction.deferReply();
      const id = interaction.options.getString('id', true);
      const action = interaction.options.getString('상태', true);
      const activate = action === 'on';

      try {
        await n8nClient.setWorkflowStatus(id, activate);
        const embed = new EmbedBuilder()
          .setColor(Colors.SUCCESS)
          .setTitle(`✅ 워크플로우 제어 완료`)
          .setDescription(
            `워크플로우(\`${id}\`)를 성공적으로 **${activate ? '활성화(ON)' : '비활성화(OFF)'}** 했습니다.`
          );
        await interaction.editReply({ embeds: [embed] });
      } catch (error: any) {
        await interaction.editReply({ embeds: [createErrorEmbed(`제어 실패: ${error.message}`)] });
      }
    }
  },
};
