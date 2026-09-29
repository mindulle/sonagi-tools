import {
  Client,
  Events,
  Interaction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import { logger } from '@sonagi-bots/shared';
import { NotionService } from '../services/notion';
import { handleCommandError } from '@sonagi-bots/shared';
import { PaperclipService } from '../services/paperclip';
import { Colors, createErrorEmbed } from '@sonagi-bots/shared';
import { createIssueSuccessEmbed } from '../commands/paperclip/index';
import type { CommandMap } from '@sonagi-bots/shared';

export function registerInteractionCreateEvent(client: Client, commands: CommandMap): void {
  client.on(Events.InteractionCreate, (interaction: Interaction) => {
    void (async () => {
      if (interaction.isChatInputCommand() || interaction.isContextMenuCommand()) {
        const command = commands.get(interaction.commandName);

        if (!command) {
          logger.warn(`Unknown command: ${interaction.commandName}`);
          return;
        }

        try {
          logger.info('Command execution started', {
            command: interaction.commandName,
            user: interaction.user.tag,
            guild: interaction.guild?.name,
          });

          await command.execute(interaction);

          logger.info('Command execution completed', {
            command: interaction.commandName,
          });
        } catch (error) {
          logger.error('Command execution failed', error);
          await handleCommandError(interaction as ChatInputCommandInteraction, error);
        }
      } else if (interaction.isAutocomplete()) {
        const command = commands.get(interaction.commandName);

        if (!command || !command.autocomplete) {
          return;
        }

        try {
          await command.autocomplete(interaction);
        } catch (error) {
          logger.error('Autocomplete failed', error);
        }
      } else if (interaction.isButton()) {
        const customId = interaction.customId;

        if (customId.startsWith('approve_')) {
          const approvalId = customId.replace('approve_', '');
          try {
            await interaction.deferUpdate(); // Update message state
            await PaperclipService.approve(approvalId, '디스코드 버튼을 통해 승인되었습니다.');

            const originalEmbed = interaction.message?.embeds[0];
            const embed = originalEmbed
              ? EmbedBuilder.from(originalEmbed)
                  .setColor(Colors.SUCCESS)
                  .setTitle(originalEmbed.title?.replace('⏳', '✅') || '✅ 결재 승인 완료')
              : new EmbedBuilder()
                  .setColor(Colors.SUCCESS)
                  .setTitle('✅ 결재 승인 완료')
                  .setDescription(`결재 ID \`${approvalId}\`가 승인되었습니다.`);

            await interaction.editReply({ embeds: [embed], components: [] });
          } catch (error) {
            logger.error('Failed to approve via button', error);
            await interaction.followUp({
              content: '❌ 승인 처리 중 오류가 발생했습니다.',
              ephemeral: true,
            });
          }
        } else if (customId.startsWith('snooze_1h_')) {
          const pageId = customId.replace('snooze_1h_', '');
          try {
            await interaction.deferUpdate();
            // Get original message content or embed to update it
            const originalContent = interaction.message.content;

            // Calculate new date (1 hour from now)

            // Format to ISO without Z, e.g., "2026-08-09T20:45:00+09:00"
            // Wait, Notion accepts standard ISO string. We can just pass the original UTC time and it handles it!
            // Actually let's just send the exact UTC string which Notion parses easily:
            const newDateString = new Date(Date.now() + 60 * 60 * 1000).toISOString();

            await NotionService.updateScheduleDate(pageId, newDateString);

            await interaction.editReply({
              content: originalContent + '\n\n✅ **마감 시간을 1시간 뒤로 연기했습니다!**',
              components: [],
            });
          } catch (error) {
            logger.error('Failed to snooze 1h', error);
            await interaction.followUp({
              content: '❌ 스누즈 처리 중 오류가 발생했습니다.',
              ephemeral: true,
            });
          }
        } else if (customId.startsWith('snooze_1d_')) {
          const pageId = customId.replace('snooze_1d_', '');
          try {
            await interaction.deferUpdate();
            const originalContent = interaction.message.content;

            const newDateString = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            await NotionService.updateScheduleDate(pageId, newDateString);

            await interaction.editReply({
              content: originalContent + '\n\n✅ **마감 시간을 내일로 연기했습니다!**',
              components: [],
            });
          } catch (error) {
            logger.error('Failed to snooze 1d', error);
            await interaction.followUp({
              content: '❌ 스누즈 처리 중 오류가 발생했습니다.',
              ephemeral: true,
            });
          }
        } else if (customId.startsWith('complete_task_')) {
          const pageId = customId.replace('complete_task_', '');
          try {
            await interaction.deferUpdate();
            const originalContent = interaction.message.content;

            await NotionService.completeSchedule(pageId);

            await interaction.editReply({
              content: originalContent + '\n\n🎉 **완료 처리되었습니다! 고생하셨습니다.**',
              components: [],
            });
          } catch (error) {
            logger.error('Failed to complete schedule via button', error);
            await interaction.followUp({
              content: '❌ 완료 처리 중 오류가 발생했습니다.',
              ephemeral: true,
            });
          }
        } else if (customId.startsWith('reject_init_')) {
          const approvalId = customId.replace('reject_init_', '');

          const modal = new ModalBuilder()
            .setCustomId(`modal_reject_${approvalId}`)
            .setTitle('반려 사유 입력');

          const reasonInput = new TextInputBuilder()
            .setCustomId('reject_reason')
            .setLabel('어떤 점을 수정해야 하나요?')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000);

          const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
            reasonInput
          );
          modal.addComponents(firstActionRow);

          await interaction.showModal(modal);
        }
      } else if (interaction.isModalSubmit()) {
        const customId = interaction.customId;

        if (customId.startsWith('modal_reject_')) {
          const approvalId = customId.replace('modal_reject_', '');
          const reason = interaction.fields.getTextInputValue('reject_reason');

          try {
            await interaction.deferUpdate();
            await PaperclipService.reject(approvalId, reason);

            const originalEmbed = interaction.message?.embeds[0];
            const embed = originalEmbed
              ? EmbedBuilder.from(originalEmbed)
                  .setColor(Colors.ERROR)
                  .setTitle(originalEmbed.title?.replace('⏳', '❌') || '❌ 결재 반려 완료')
                  .addFields({ name: '반려 사유', value: reason, inline: false })
              : new EmbedBuilder()
                  .setColor(Colors.WARNING)
                  .setTitle('❌ 결재 반려 완료')
                  .setDescription(
                    `결재 ID \`${approvalId}\`가 다음 사유로 반려되었습니다:\n> ${reason}`
                  );

            await interaction.editReply({ embeds: [embed], components: [] });
          } catch (error) {
            logger.error('Failed to reject via modal', error);
            await interaction.followUp({
              content: '❌ 반려 처리 중 오류가 발생했습니다.',
              ephemeral: true,
            });
          }
        } else if (customId.startsWith('modal_issue_create_')) {
          const companyId = customId.replace('modal_issue_create_', '');
          const title = interaction.fields.getTextInputValue('issue_title');
          const description = interaction.fields.getTextInputValue('issue_description');

          try {
            await interaction.deferReply();

            const issue = await PaperclipService.createIssue(companyId, title, description);

            const embed = createIssueSuccessEmbed(issue);

            await interaction.editReply({ embeds: [embed] });
          } catch (error) {
            logger.error('Failed to create issue via modal', error);
            await interaction.editReply({
              embeds: [createErrorEmbed('이슈를 생성하는 중 서버 통신 오류가 발생했습니다.')],
            });
          }
        }
      }
    })();
  });
}
