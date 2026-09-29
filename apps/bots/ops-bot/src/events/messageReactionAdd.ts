import {
  Client,
  Events,
  MessageReaction,
  PartialMessageReaction,
  User,
  PartialUser,
} from 'discord.js';
import axios from 'axios';
import { logger } from '@sonagi-bots/shared';
import { NotionService } from '../services/notion';

const WEB_CLIP_CHANNEL_ID = process.env.WEB_CLIP_CHANNEL_ID || '1519250071764336650';
const GALLERY_SERVER_URL = process.env.GALLERY_SERVER_URL || 'http://localhost:8000';
const DESIGN_CLIP_CHANNEL_ID = process.env.DESIGN_CLIP_CHANNEL_ID || '1528620974948225095';

export function registerMessageReactionAddEvent(client: Client): void {
  client.on(
    Events.MessageReactionAdd,
    (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
      void (async () => {
        // Ignore reactions from the bot itself
        if (user.id === client.user?.id) return;

        // ----------------------------------------------------
        // Web Clip 자동화 로직
        // ----------------------------------------------------
        if (reaction.emoji.name === '✅' && reaction.message.channelId === WEB_CLIP_CHANNEL_ID) {
          try {
            const message = reaction.message.partial
              ? await reaction.message.fetch()
              : reaction.message;
            const fullUser = user.partial ? await user.fetch() : user;

            const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL_WEB_CLIP;
            if (!n8nWebhookUrl) {
              logger.error('N8N_WEBHOOK_URL_WEB_CLIP environment variable is not set');
              await message.reply('❌ n8n 웹훅 URL 설정이 누락되어 클립을 저장할 수 없습니다.');
              return;
            }

            const payload = {
              content: message.content,
              author: fullUser.username,
              channelId: message.channelId,
              messageId: message.id,
            };

            logger.info(`Sending web clip payload to n8n for message ${message.id}`);

            const response = await fetch(n8nWebhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });

            if (!response.ok) {
              logger.error(
                `n8n webhook returned status: ${response.status} ${response.statusText}`
              );
              await message.reply(
                `❌ 웹 클립 전달 중 오류가 발생했습니다. (상태 코드: ${response.status})`
              );
            } else {
              logger.info('Successfully forwarded clip to n8n webhook');
              await message.reply('✅ 웹 클립이 성공적으로 전달되었습니다!');
            }
          } catch (error) {
            logger.error('Error handling web clip reaction', error);
            const msg = reaction.message.partial
              ? await reaction.message.fetch()
              : reaction.message;
            await msg.reply('❌ 웹 클립 처리 중 에러가 발생했습니다.');
          }
          return;
        }

        if (reaction.emoji.name === '❌' && reaction.message.channelId === WEB_CLIP_CHANNEL_ID) {
          try {
            const message = reaction.message.partial
              ? await reaction.message.fetch()
              : reaction.message;

            await message.reply('🗑️ 해당 클립 수집이 취소(스킵)되었습니다.');
            // 추가 액션이 필요하면 구현 (예: 메시지 삭제 또는 리액션 초기화)
          } catch (error) {
            logger.error('Error handling web clip cancel reaction', error);
          }
          return;
        }

        // ----------------------------------------------------
        // 🎨 디자인 클립 자동화 로직
        // 🎨 이모지를 클릭하면 메시지의 이미지와 텍스트를 🎨┆design-clip 채널로 큐레이션
        // ----------------------------------------------------
        if (reaction.emoji.name === '🎨') {
          try {
            const message = reaction.message.partial
              ? await reaction.message.fetch()
              : reaction.message;

            // 이미 큐레이션된 메시지는 무시
            const hasChecked = message.reactions.cache.has('✅');
            if (hasChecked) return;

            const targetChannel = await client.channels.fetch(DESIGN_CLIP_CHANNEL_ID);
            if (targetChannel && targetChannel.isTextBased()) {
              const textChannel = targetChannel as import('discord.js').TextChannel;
              const authorName = message.author ? message.author.username : 'Unknown';
              const content = message.content || '';

              // 첨부파일 중 이미지 추출
              const attachments = message.attachments
                .filter((a) => a.contentType?.startsWith('image/'))
                .map((a) => a.url);

              // 원본 메시지 링크
              const messageUrl = `https://discord.com/channels/${message.guildId || '@me'}/${message.channelId}/${message.id}`;

              const embed = {
                color: 0x3498db, // INFO
                author: {
                  name: authorName,
                  icon_url: message.author?.displayAvatarURL() || undefined,
                },
                description: content
                  ? `${content}\n\n[원본 메시지 이동](${messageUrl})`
                  : `[원본 메시지 이동](${messageUrl})`,
                image: attachments.length > 0 ? { url: attachments[0] } : undefined,
                timestamp: new Date().toISOString(),
              };

              const extraImages = attachments.slice(1).join('\n');
              const extraContent = extraImages ? `**추가 이미지:**\n${extraImages}` : undefined;

              await textChannel.send({ embeds: [embed], content: extraContent });

              // ----------------------------------------------------
              // Eagle Gallery 서버로 원본 이미지 및 메타데이터 전송
              // ----------------------------------------------------
              if (attachments.length > 0) {
                try {
                  const payload = {
                    imageUrl: attachments[0],
                    author: authorName,
                    content: content,
                    messageUrl: messageUrl,
                    tags: ['discord', 'design-clip'],
                  };
                  await axios.post(`${GALLERY_SERVER_URL}/api/import-url`, payload);
                  logger.info(`Successfully sent image to Gallery Server: ${attachments[0]}`);
                } catch (apiError) {
                  logger.error('Failed to send image to Gallery Server', apiError);
                }
              }

              await message.react('✅');
            }
          } catch (error) {
            logger.error('Error handling design clip curation', error);
          }
          return;
        }

        // ----------------------------------------------------
        // Ledger(가계부) 자동화 검증(Reaction) 로직
        // 📝 이모지를 클릭하면 메시지 파싱해서 노션 Ledger DB에 기록
        // ----------------------------------------------------
        if (reaction.emoji.name === '📝') {
          try {
            const message = reaction.message.partial
              ? await reaction.message.fetch()
              : reaction.message;

            // 이미 장부에 반영되었는지 확인 (✅ 이모지가 달려있으면 무시)
            const hasChecked = message.reactions.cache.has('✅');
            if (hasChecked) {
              return;
            }

            if (message.embeds.length > 0) {
              const embed = message.embeds[0];
              const title = embed.title || '';
              const description = embed.description || '';

              if (title.includes('결제 승인 대기')) {
                const nameMatch = description.match(/- 사용처:\s*(.+)/);
                const priceMatch = description.match(/- 금액:\s*([0-9,]+)/);
                const typeMatch = description.match(/- 구분:\s*(Income|Expense|지출|수입)/i);

                if (nameMatch && priceMatch) {
                  const name = nameMatch[1].trim();
                  const price = parseInt(priceMatch[1].replace(/,/g, ''), 10);

                  let type: 'Income' | 'Expense' = 'Expense';
                  if (typeMatch) {
                    const t = typeMatch[1].toLowerCase();
                    if (t === 'income' || t === '수입') type = 'Income';
                  }

                  await NotionService.addLedgerEntry({
                    name,
                    price,
                    type,
                    domain: '개인',
                    currency: 'WON',
                  });

                  // 중복 승인 방지를 위해 완료 마크(✅) 달기
                  await message.react('✅');
                  await message.reply(
                    `✅ **${name}** (${price.toLocaleString()}원) 장부 반영이 완료되었습니다!`
                  );
                  logger.info(
                    `Successfully recorded ledger entry from reaction: ${name} / ${price}`
                  );
                }
              }
            }
          } catch (error) {
            logger.error('Failed to parse or record ledger entry from reaction', error);
            // 에러 시 사용자에게 알림
            const msg = reaction.message.partial
              ? await reaction.message.fetch()
              : reaction.message;
            await msg.reply('❌ 장부 기록 중 에러가 발생했습니다.');
          }
        }
      })();
    }
  );
}
