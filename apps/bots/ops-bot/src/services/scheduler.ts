import cron from 'node-cron';
import { Client, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel } from 'discord.js';
import { NotionService } from './notion';
import { logger } from '@sonagi-bots/shared';
import axios from 'axios';

// 채널 ID: Web Clip Channel ID나 DASHBOARD_CHANNEL_ID 등 환경변수 활용 (여기선 임시로 지정)
// 실제 환경변수나 채널 ID에 맞게 수정
const BRIEFING_CHANNEL_ID = '1519250071764336650'; // Web Clip 채널을 예시로 사용 (사용자 설정 필요)
const USER_ID = '685516064037404683';

export function initScheduler(client: Client) {
  logger.info('Initializing Scheduler...');

  // 1. 아침 9시 데일리 브리핑
  cron.schedule('0 9 * * *', async () => {
    try {
      logger.info('Running daily briefing scheduler...');
      const channel = (await client.channels.fetch(BRIEFING_CHANNEL_ID)) as TextChannel;
      if (!channel) return;

      const schedules = await NotionService.getTodaySchedules();
      let msTodoResponse;
      try {
        msTodoResponse = await axios.get('https://n8n.sonagi.space/webhook/todo-today');
      } catch (e) {
        logger.error('Failed to fetch MS To Do', e);
      }

      const todos = msTodoResponse?.data?.tasks || [];

      let message = '🌅 **오늘의 통합 일정 브리핑** 🌅\n\n';

      message += '🟦 **[Notion 복잡한 일정/회의]**\n';
      if (schedules.length > 0) {
        schedules.forEach((item) => {
          message += `• ${item.title}\n`;
        });
      } else {
        message += '• 예정된 일정이 없습니다.\n';
      }

      message += '\n🟩 **[MS To Do 간단한 할 일]**\n';
      if (todos.length > 0) {
        todos.forEach((item: any) => {
          message += `• ${item.title}\n`;
        });
      } else {
        message += '• 예정된 할 일이 없습니다.\n';
      }

      await channel.send({ content: message });
    } catch (e) {
      logger.error('Daily briefing error:', e);
    }
  });

  // 2. 매 10분 마다 1시간/30분/10분 전 긴급 알림
  cron.schedule('*/10 * * * *', async () => {
    try {
      const schedules = await NotionService.getTodaySchedules();
      const now = new Date();

      for (const item of schedules) {
        if (!item.date || !item.date.includes('T') || item.isDone) continue;

        const dueTime = new Date(item.date);
        const diffMinutes = (dueTime.getTime() - now.getTime()) / (1000 * 60);

        let timeLeftStr = '';
        if (diffMinutes > 50 && diffMinutes <= 60) {
          timeLeftStr = '1시간';
        } else if (diffMinutes > 20 && diffMinutes <= 30) {
          timeLeftStr = '30분';
        } else if (diffMinutes > 0 && diffMinutes <= 10) {
          timeLeftStr = '10분';
        }

        if (timeLeftStr) {
          const user = await client.users.fetch(USER_ID);
          if (user) {
            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setCustomId(`snooze_1h_${item.id}`)
                .setLabel('⏰ 1시간 미루기')
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId(`snooze_1d_${item.id}`)
                .setLabel('🌅 내일로 미루기')
                .setStyle(ButtonStyle.Secondary),
              new ButtonBuilder()
                .setCustomId(`complete_task_${item.id}`)
                .setLabel('✅ 완료 처리')
                .setStyle(ButtonStyle.Success)
            );

            await user.send({
              content: `🚨 **마감 임박 긴급 알림** 🚨\n\n**${item.title}** 일정의 마감이 **${timeLeftStr}** 남았습니다!`,
              components: [row],
            });
          }
        }
      }
    } catch (e) {
      logger.error('Urgent alert scheduler error:', e);
    }
  });
}
