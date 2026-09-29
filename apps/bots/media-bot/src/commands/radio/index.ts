import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  GuildMember,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ComponentType,
  ButtonBuilder,
  ButtonStyle,
  Message,
  ButtonInteraction,
} from 'discord.js';
import axios from 'axios';
import Parser from 'rss-parser';
import { Track, GuildQueue } from 'discord-player';
import { player } from '../../index';
import type { Command } from '@sonagi-bots/shared';
import { Colors, createErrorEmbed } from '@sonagi-bots/shared';
import { logger } from '@sonagi-bots/shared';

// Interfaces for API responses
interface ITunesResult {
  feedUrl?: string;
  collectionName?: string;
  artworkUrl600?: string;
  artworkUrl100?: string;
}

const rssParser = new Parser();

// Helper to add player controls
function getPlayerControlRow() {
  const pauseBtn = new ButtonBuilder()
    .setCustomId('radio_control_pause')
    .setLabel('일시정지')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('⏸️');
  const resumeBtn = new ButtonBuilder()
    .setCustomId('radio_control_resume')
    .setLabel('재생')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('▶️');
  const stopBtn = new ButtonBuilder()
    .setCustomId('radio_control_stop')
    .setLabel('종료')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('⏹️');

  return new ActionRowBuilder<ButtonBuilder>().addComponents(pauseBtn, resumeBtn, stopBtn);
}

function attachPlayerControlsCollector(message: Message, guildId: string, userId: string) {
  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 12 * 60 * 60 * 1000, // 12 hours
  });

  collector.on('collect', (i: ButtonInteraction) => {
    void (async () => {
      // 1. 디스코드 응답 지연(Timeout)을 우회하기 위해 가장 먼저 deferUpdate 호출
      try {
        await i.deferUpdate();
      } catch (e) {
        logger.warn('Failed to defer update, interaction timed out.', e);
        return;
      }

      try {
        if (i.user.id !== userId) {
          await i.followUp({
            content: '명령어를 입력한 사용자만 조작할 수 있습니다.',
            ephemeral: true,
          });
          return;
        }

        const currentQueue = player.nodes.get(guildId);
        if (!currentQueue) {
          await i.followUp({ content: '현재 재생 중인 라디오가 없습니다.', ephemeral: true });
          return;
        }

        if (i.customId === 'radio_control_pause') {
          currentQueue.node.setPaused(true);
          await i.followUp({ content: '⏸️ 라디오를 일시정지했습니다.', ephemeral: true });
        } else if (i.customId === 'radio_control_resume') {
          // 2. Resume 버퍼링 지연을 대비하여 상태 체크 추가
          const success = currentQueue.node.setPaused(false);
          if (success !== false) {
            await i.followUp({ content: '▶️ 라디오 재생을 계속합니다.', ephemeral: true });
          } else {
            await i.followUp({
              content: '⚠️ 라디오 재생 재개에 실패했거나 지연되고 있습니다...',
              ephemeral: true,
            });
          }
        } else if (i.customId === 'radio_control_stop') {
          currentQueue.delete();
          await i.editReply({ components: [] }).catch(() => {});
          collector.stop();
          await i.followUp({ content: '⏹️ 라디오 재생을 종료합니다.', ephemeral: true });
        }
      } catch (err) {
        logger.error('Failed to handle player control', err);
        await i
          .followUp({ content: '조작 중 오류가 발생했습니다.', ephemeral: true })
          .catch(() => {});
      }
    })();
  });

  collector.on('end', () => {
    void message.edit({ components: [] }).catch(() => {});
  });

  // 3. 큐가 파괴(Destroy/Empty)되거나 외부 요인으로 끊기면 버튼 상태 동기화 (Cleanup)
  const cleanupListener = (q: GuildQueue) => {
    if (q && q.guild && q.guild.id === guildId) {
      if (!collector.ended) collector.stop();
      player.events.removeListener('emptyQueue', cleanupListener);
      player.events.removeListener('disconnect', cleanupListener);
      player.events.removeListener('playerError', cleanupListener);
    }
  };

  player.events.on('emptyQueue', cleanupListener);
  player.events.on('disconnect', cleanupListener);
  player.events.on('playerError', cleanupListener);
}

export const radioCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('radio')
    .setDescription('MBC 라디오 및 팟캐스트(다시듣기)를 관리합니다.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('play')
        .setDescription('실시간 라디오 재생을 시작합니다.')
        .addStringOption((option) =>
          option
            .setName('channel')
            .setDescription('재생할 채널을 선택하세요')
            .setRequired(true)
            .addChoices(
              { name: 'MBC FM4U (옥상달빛 등)', value: 'mfm' },
              { name: 'MBC 표준FM', value: 'sfm' },
              { name: 'MBC 올댓뮤직', value: 'chm' }
            )
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('vod')
        .setDescription('팟캐스트(다시듣기) 에피소드를 검색하고 재생합니다.')
        .addStringOption((option) =>
          option
            .setName('query')
            .setDescription('검색할 프로그램명 (예: 푸른밤, 배철수)')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('song')
        .setDescription('다시듣기 도중 원곡을 검색해서 끼어들기(새치기) 재생합니다.')
        .addStringOption((option) =>
          option
            .setName('title')
            .setDescription('재생할 원곡의 제목 (가수 + 제목)')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('stop').setDescription('재생을 중지하고 음성 채널에서 나갑니다.')
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (!guildId) {
      await interaction.reply({
        embeds: [createErrorEmbed('이 명령어는 서버 내의 음성 채널에서만 사용할 수 있습니다.')],
        ephemeral: true,
      });
      return;
    }

    const member = interaction.member as GuildMember;
    const voiceChannel = member.voice.channel;

    // --- STOP ---
    if (subcommand === 'stop') {
      const queue = player.nodes.get(guildId);
      if (queue && queue.isPlaying()) {
        queue.delete();
        const embed = new EmbedBuilder()
          .setColor(Colors.SUCCESS)
          .setTitle('📻 라디오 종료')
          .setDescription('재생을 중지하고 음성 채널에서 나갔습니다.');
        await interaction.reply({ embeds: [embed] });
      } else {
        await interaction.reply({
          embeds: [createErrorEmbed('현재 재생 중인 라디오가 없습니다.')],
          ephemeral: true,
        });
      }
      return;
    }

    // Must be in a voice channel for the other commands
    if (!voiceChannel) {
      await interaction.reply({
        embeds: [createErrorEmbed('먼저 음성 채널에 접속해 주세요!')],
        ephemeral: true,
      });
      return;
    }

    // --- PLAY (LIVE) ---
    if (subcommand === 'play') {
      const channel = interaction.options.getString('channel', true);
      await interaction.deferReply();

      try {
        const existingQueue = player.nodes.get(guildId);
        if (existingQueue && existingQueue.isPlaying()) existingQueue.delete();

        const response = await axios.get<string>(
          `https://sminiplay.imbc.com/aacplay.ashx?agent=webapp&channel=${channel}`,
          { timeout: 5000, responseType: 'text' }
        );

        const streamUrl = response.data.trim();
        if (!streamUrl || !streamUrl.startsWith('http')) {
          throw new Error('유효한 스트리밍 주소를 가져오지 못했습니다.');
        }

        const channelName =
          channel === 'mfm' ? 'MBC FM4U' : channel === 'sfm' ? 'MBC 표준FM' : 'MBC 올댓뮤직';

        logger.info(`Playing ${channelName} stream via discord-player: ${streamUrl}`);

        const track = new Track(player, {
          title: channelName,
          description: 'MBC Live Radio',
          author: 'MBC',
          url: streamUrl,
          source: 'arbitrary',
          engine: streamUrl, // Required by AttachmentExtractor
          thumbnail: 'https://i.imgur.com/8QGZ2u1.png',
          duration: '0:00',
          views: 0,
          requestedBy: interaction.user,
        });

        await player.play(voiceChannel, track, {
          nodeOptions: { metadata: interaction, selfDeaf: false, leaveOnEmpty: true },
        });

        const embed = new EmbedBuilder()
          .setColor(Colors.SUCCESS)
          .setTitle(`📻 ${channelName} 재생 시작`)
          .setDescription(`음성 채널 **${voiceChannel.name}**에서 실시간 라디오를 재생합니다.`);
        const msg = await interaction.editReply({
          embeds: [embed],
          components: [getPlayerControlRow()],
        });
        attachPlayerControlsCollector(msg, guildId, interaction.user.id);
      } catch (error: unknown) {
        logger.error('Failed to play radio', error);
        await interaction.editReply({
          embeds: [
            createErrorEmbed(
              `라디오 재생 실패: ${error instanceof Error ? error.message : '알 수 없는 에러'}`
            ),
          ],
        });
      }
    }

    // --- VOD (PODCAST) ---
    if (subcommand === 'vod') {
      const query = interaction.options.getString('query', true);
      await interaction.deferReply();

      try {
        // 1. Search iTunes for the podcast
        const searchRes = await axios.get<{ results: ITunesResult[] }>(
          `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=podcast&limit=3`
        );
        const results = searchRes.data.results;

        if (!results || results.length === 0) {
          await interaction.editReply({
            embeds: [createErrorEmbed(`'${query}'에 해당하는 팟캐스트를 찾을 수 없습니다.`)],
          });
          return;
        }

        const feedUrl = results[0].feedUrl;
        const podcastName = results[0].collectionName;
        const artworkUrl = results[0].artworkUrl600 || results[0].artworkUrl100;

        if (!feedUrl || !podcastName) {
          throw new Error('팟캐스트 메타데이터가 부족합니다.');
        }

        // 2. Parse RSS Feed
        const feed = await rssParser.parseURL(feedUrl);
        const validEpisodes = feed.items.filter(
          (ep) => ep.enclosure?.url && ep.enclosure.url.startsWith('http')
        );

        if (validEpisodes.length === 0) {
          await interaction.editReply({
            embeds: [createErrorEmbed('이 팟캐스트에 재생 가능한 에피소드가 없습니다.')],
          });
          return;
        }

        // Pagination setup
        let currentPage = 0;
        const itemsPerPage = 25;
        const maxPage = Math.ceil(validEpisodes.length / itemsPerPage) - 1;

        const generateComponents = (page: number) => {
          const start = page * itemsPerPage;
          const end = start + itemsPerPage;
          const currentEpisodes = validEpisodes.slice(start, end);

          const selectOptions = currentEpisodes.map((ep, index) => {
            let label = ep.title || `에피소드 ${start + index + 1}`;
            if (label.length > 100) label = label.substring(0, 97) + '...';
            const value = ep.enclosure?.url || '';

            return new StringSelectMenuOptionBuilder()
              .setLabel(label)
              .setDescription(
                ep.pubDate ? new Date(ep.pubDate).toLocaleDateString('ko-KR') : '날짜 없음'
              )
              .setValue(value.length > 100 ? value.substring(0, 100) : value);
          });

          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('radio_vod_select')
            .setPlaceholder(`에피소드 선택 (페이지 ${page + 1}/${maxPage + 1})`)
            .addOptions(selectOptions);

          const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

          const prevButton = new ButtonBuilder()
            .setCustomId('radio_vod_prev')
            .setLabel('이전 페이지')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0);

          const nextButton = new ButtonBuilder()
            .setCustomId('radio_vod_next')
            .setLabel('다음 페이지')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(page === maxPage);

          const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(prevButton, nextButton);

          return [row1, row2];
        };

        const embed = new EmbedBuilder()
          .setColor(Colors.PRIMARY)
          .setTitle(`🎙️ ${podcastName} 다시듣기`)
          .setDescription(
            `총 **${validEpisodes.length}개**의 에피소드가 있습니다.\n아래 메뉴에서 다시 듣고 싶은 에피소드를 선택해 주세요!`
          )
          .setThumbnail(artworkUrl || null);

        const response = await interaction.editReply({
          embeds: [embed],
          components: generateComponents(currentPage),
        });

        // 4. Collect Interaction
        const collector = response.createMessageComponentCollector({
          time: 120000, // 2 minutes
        });

        collector.on('collect', (i) => {
          void (async () => {
            if (i.user.id !== interaction.user.id) {
              await i.reply({
                content: '명령어를 입력한 사용자만 조작할 수 있습니다.',
                ephemeral: true,
              });
              return;
            }

            if (i.isButton()) {
              if (i.customId === 'radio_vod_prev' && currentPage > 0) {
                currentPage--;
              } else if (i.customId === 'radio_vod_next' && currentPage < maxPage) {
                currentPage++;
              }
              await i.update({ components: generateComponents(currentPage) });
              return;
            }

            if (i.isStringSelectMenu() && i.customId === 'radio_vod_select') {
              const selectedUrl = i.values[0];
              const episode = validEpisodes.find((ep) =>
                ep.enclosure?.url?.startsWith(selectedUrl)
              );

              await i.deferUpdate();

              try {
                const existingQueue = player.nodes.get(guildId);
                if (existingQueue && existingQueue.isPlaying()) existingQueue.delete();

                const track = new Track(player, {
                  title: episode?.title || podcastName,
                  description: 'MBC VOD (다시듣기)',
                  author: podcastName,
                  url: episode?.enclosure?.url || selectedUrl,
                  source: 'arbitrary',
                  engine: episode?.enclosure?.url || selectedUrl, // Required by AttachmentExtractor
                  thumbnail: artworkUrl || 'https://i.imgur.com/8QGZ2u1.png',
                  duration: '0:00',
                  views: 0,
                  requestedBy: i.user,
                });

                await player.play(voiceChannel, track, {
                  nodeOptions: { metadata: interaction, selfDeaf: false, leaveOnEmpty: true },
                });

                const playEmbed = new EmbedBuilder()
                  .setColor(Colors.SUCCESS)
                  .setTitle(`🎙️ 재생 시작: ${episode?.title || podcastName}`)
                  .setDescription(
                    `음성 채널 **${voiceChannel.name}**에서 다시듣기를 재생합니다.\n\n*(노래가 나오면 \`/radio song [제목]\` 명령어로 원곡을 튼 후 이어서 들을 수 있습니다!)*`
                  )
                  .setThumbnail(artworkUrl || null);

                const msg = await i.editReply({
                  embeds: [playEmbed],
                  components: [getPlayerControlRow()],
                });
                attachPlayerControlsCollector(msg, guildId, interaction.user.id);
              } catch (err) {
                logger.error('Failed to play VOD', err);
                await i.editReply({
                  embeds: [createErrorEmbed('에피소드 재생에 실패했습니다.')],
                  components: [],
                });
              }
            } // Close if (i.isStringSelectMenu())
          })();
        });

        collector.on('end', (collected) => {
          if (collected.size === 0) {
            void interaction.editReply({ components: [] }).catch(() => {});
          }
        });
      } catch (error: unknown) {
        logger.error('Failed to fetch VOD', error);
        await interaction.editReply({
          embeds: [createErrorEmbed('팟캐스트 정보를 가져오는데 실패했습니다.')],
        });
      }
    }

    // --- SONG (INSERT/RESUME) ---
    if (subcommand === 'song') {
      const songTitle = interaction.options.getString('title', true);
      const queue = player.nodes.get(guildId);

      if (!queue || !queue.isPlaying()) {
        await interaction.reply({
          embeds: [createErrorEmbed('현재 재생 중인 라디오/팟캐스트가 없습니다.')],
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply();

      try {
        // 1. Search for the song
        const searchResult = await player.search(songTitle, { requestedBy: interaction.user });
        if (!searchResult || !searchResult.tracks.length) {
          await interaction.editReply({
            embeds: [createErrorEmbed(`'${songTitle}' 곡을 찾을 수 없습니다.`)],
          });
          return;
        }

        const songTrack = searchResult.tracks[0];
        const currentTrack = queue.currentTrack;
        const currentTimeMs = queue.node.streamTime;

        if (currentTrack) {
          // 2. Clone the current VOD/Radio track and add `resumeFrom` metadata
          const clonedVOD = new Track(player, {
            title: currentTrack.title,
            author: currentTrack.author,
            url: currentTrack.url,
            source: currentTrack.source as 'arbitrary',
            engine: String(
              (currentTrack.raw as Record<string, unknown> | null | undefined)?.engine ||
                currentTrack.url
            ),
            thumbnail: currentTrack.thumbnail,
            duration: currentTrack.duration,
            views: currentTrack.views,
            description: currentTrack.description,
            requestedBy: interaction.user,
          });

          // Metadata is readonly in types, but mutable in JS. Bypass TS strict check.
          Object.assign(clonedVOD, { metadata: { resumeFrom: currentTimeMs } });

          // 3. Queue manipulation
          queue.insertTrack(songTrack, 0); // Next song to play is the requested song
          queue.insertTrack(clonedVOD, 1); // After that, resume the VOD

          // Skip the current track to start the song immediately
          queue.node.skip();

          const embed = new EmbedBuilder()
            .setColor(Colors.SUCCESS)
            .setTitle(`🎶 팟캐스트 일시정지 & 원곡 재생`)
            .setDescription(
              `**${songTrack.title}** 재생을 시작합니다!\n원곡이 끝나면 아까 듣던 팟캐스트로 자동 복귀합니다.`
            )
            .setThumbnail(songTrack.thumbnail || null);

          const msg = await interaction.editReply({
            embeds: [embed],
            components: [getPlayerControlRow()],
          });
          attachPlayerControlsCollector(msg, guildId, interaction.user.id);
        } else {
          await interaction.editReply({
            content: '현재 트랙 정보를 찾을 수 없어 끼어들기를 할 수 없습니다.',
          });
        }
      } catch (error: unknown) {
        logger.error('Failed to insert song', error);
        await interaction.editReply({ embeds: [createErrorEmbed('곡 끼어들기에 실패했습니다.')] });
      }
    }
  },
};
