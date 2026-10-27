import { Client, Events, Message } from 'discord.js';
import { logger } from '@sonagi-bots/shared';

const WEB_CLIP_CHANNEL_ID = process.env.WEB_CLIP_CHANNEL_ID || '1519250071764336650';

export function registerMessageCreateEvent(client: Client): void {
  client.on(Events.MessageCreate, (message: Message) => {
    void (async () => {
      // 자기 자신(ops-bot)이 보낸 알림 메시지는 무시하여 무한 루프 방지
      if (message.author.id === client.user?.id) return;

      // 웹클립 채널이 아닌 일반 채널에서는 일반적인 봇 메시지 무시
      if (message.channelId !== WEB_CLIP_CHANNEL_ID && message.author.bot) return;

      if (message.channelId === WEB_CLIP_CHANNEL_ID) {
        try {
          const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL_WEB_CLIP;
          if (!n8nWebhookUrl) {
            logger.error('N8N_WEBHOOK_URL_WEB_CLIP is not set');
            return;
          }

          // 본문 또는 임베드 내용 추출
          let content = message.content;
          if (!content && message.embeds.length > 0) {
            const embed = message.embeds[0];
            content = [embed.title, embed.url, embed.description].filter(Boolean).join('\n');
          }

          if (!content.trim()) {
            logger.warn(`Skipping empty web clip message ${message.id}`);
            return;
          }

          // 처리 중임을 나타내는 모래시계 리액션
          try {
            await message.react('⏳');
          } catch {
            // 반응 추가 권한이 없거나 웹훅 메시지인 경우 무시
          }

          const payload = {
            content,
            author: message.author.username || 'Web Clip',
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
          } else {
            logger.info('Successfully auto-forwarded clip to n8n');
          }
        } catch (error) {
          logger.error(`Error auto-saving web clip ${message.id}`, error);
        }
      }
    })();
  });
}
