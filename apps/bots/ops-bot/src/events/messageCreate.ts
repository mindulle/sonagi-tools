import { Client, Events, Message } from 'discord.js';
import { logger } from '@sonagi-bots/shared';

const WEB_CLIP_CHANNEL_ID = process.env.WEB_CLIP_CHANNEL_ID || '1519250071764336650';

export function registerMessageCreateEvent(client: Client): void {
  client.on(Events.MessageCreate, (message: Message) => {
    void (async () => {
      // 봇이 작성한 메시지는 무시 (자기 자신 포함)
      if (message.author.bot) return;

      if (message.channelId === WEB_CLIP_CHANNEL_ID) {
        try {
          const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL_WEB_CLIP;
          if (!n8nWebhookUrl) {
            logger.error('N8N_WEBHOOK_URL_WEB_CLIP is not set');
            await message.reply('❌ n8n 웹훅 URL 설정이 누락되었습니다.');
            return;
          }

          // 처리 중임을 나타내는 모래시계 리액션
          await message.react('⏳');

          const payload = {
            content: message.content,
            author: message.author.username,
            channelId: message.channelId,
            messageId: message.id,
          };

          logger.info(`Auto-sending web clip payload to n8n for message ${message.id}`);

          const response = await fetch(n8nWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            logger.error(`n8n webhook returned status: ${response.status}`);
            await message.reply(`❌ 자동 저장 실패 (상태 코드: ${response.status})`);
          } else {
            logger.info('Successfully auto-forwarded clip to n8n');
            // 최종 성공 메시지는 n8n(Semaphore 작업 완료 후)에서 달게 됩니다.
          }
        } catch (error) {
          logger.error(`Error auto-saving web clip ${message.id}`, error);
          await message.reply('❌ 자동 저장 중 에러가 발생했습니다.');
        }
      }
    })();
  });
}
