import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';
import axios from 'axios';
import type { Command } from '@sonagi-bots/shared';
import { Colors, createErrorEmbed } from '@sonagi-bots/shared';
import { logger } from '@sonagi-bots/shared';
import { DEFAULT_USER_AGENT } from '@sonagi-bots/shared';
import POKEMON_LIST_JSON from './pokemon-list.json';

interface WikiSearchResponse {
  query?: {
    search?: Array<{
      title: string;
      snippet: string;
    }>;
  };
}

interface PokeApiResponse {
  id: number;
  name: string;
  sprites: {
    other: {
      'official-artwork': {
        front_default: string;
      };
    };
  };
  types: Array<{ type: { name: string } }>;
  height: number;
  weight: number;
}

interface PokemonEntry {
  name: string;
  label: string;
}

const POKEMON_LIST: PokemonEntry[] = POKEMON_LIST_JSON as PokemonEntry[];

export const utilsCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('utils')
    .setDescription('통합 유틸리티 커맨드 (Wiki, Photo, Food, Dog, Cat 등)')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('wiki')
        .setDescription('위키백과에서 문서 검색 결과를 가져옵니다.')
        .addStringOption((option) =>
          option.setName('query').setDescription('검색할 키워드를 입력하세요.').setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('photo')
        .setDescription('랜덤 사진(포토박스/풍경)을 가져옵니다.')
        .addStringOption((option) =>
          option
            .setName('query')
            .setDescription('사진 주제 (영단어, 예: nature, city, cat). 미입력시 완전 랜덤.')
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('food').setDescription('침샘을 자극하는 음식 사진을 무작위로 보여줍니다.')
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('dog').setDescription('귀여운 강아지 사진을 보여줍니다.')
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('cat').setDescription('귀여운 고양이 사진을 보여줍니다.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('pokemon')
        .setDescription('특정 포켓몬스터의 이미지와 정보를 가져옵니다.')
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('포켓몬 이름을 영문으로 검색 (자동완성 지원)')
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),

  async autocomplete(interaction: AutocompleteInteraction) {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const filtered = POKEMON_LIST.filter(
      (poke: PokemonEntry) =>
        poke.name.toLowerCase().includes(focusedValue) ||
        poke.label.toLowerCase().includes(focusedValue)
    ).slice(0, 25);

    await interaction.respond(filtered.map((poke) => ({ name: poke.label, value: poke.name })));
  },

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'wiki': {
        const query = interaction.options.getString('query', true);
        await interaction.deferReply();

        try {
          const response = await axios.get<WikiSearchResponse>(
            `https://ko.wikipedia.org/w/api.php`,
            {
              params: {
                action: 'query',
                list: 'search',
                srsearch: query,
                utf8: 1,
                format: 'json',
              },
              headers: {
                'User-Agent': DEFAULT_USER_AGENT,
              },
              timeout: 5000,
            }
          );

          const searchResults = response.data.query?.search;

          if (!searchResults || searchResults.length === 0) {
            await interaction.editReply({
              embeds: [createErrorEmbed(`'${query}'에 대한 위키백과 검색 결과가 없습니다.`)],
            });
            return;
          }

          const topResult = searchResults[0];
          // Strip HTML tags from snippet
          const cleanSnippet = topResult.snippet.replace(/<[^>]*>?/gm, '');
          const encodedTitle = encodeURIComponent(topResult.title);

          const embed = new EmbedBuilder()
            .setColor(Colors.INFO)
            .setTitle(`📚 ${topResult.title}`)
            .setURL(`https://ko.wikipedia.org/wiki/${encodedTitle}`)
            .setDescription(cleanSnippet + '...')
            .setFooter({ text: 'Powered by Wikipedia' });

          await interaction.editReply({ embeds: [embed] });
        } catch (error) {
          logger.error('Wiki API fetch failed', error);
          await interaction.editReply({
            embeds: [createErrorEmbed('위키백과 검색 중 오류가 발생했습니다.')],
          });
        }
        break;
      }

      case 'photo': {
        const query = interaction.options.getString('query');
        await interaction.deferReply();

        try {
          // Use source.unsplash.com or alternative random image service
          // Using Unsplash Source API (redirects to image)
          const url = query
            ? `https://source.unsplash.com/featured/?${encodeURIComponent(query)}`
            : 'https://source.unsplash.com/random';

          // Axios redirect handling is transparent, but we just need the final URL or we can directly embed the URL.
          // However, Discord handles image URLs natively if we just send the URL in embed image.
          // We add timestamp to bypass caching.
          const imageUrl = `${url}${query ? '&' : '?'}t=${Date.now()}`;

          const embed = new EmbedBuilder()
            .setColor(Colors.INFO)
            .setTitle(query ? `📷 갤러리 - ${query}` : '📷 무작위 사진 갤러리')
            .setImage(imageUrl)
            .setFooter({ text: 'Powered by Unsplash' });

          await interaction.editReply({ embeds: [embed] });
        } catch (error) {
          logger.error('Photo fetch failed', error);
          await interaction.editReply({
            embeds: [createErrorEmbed('사진을 가져오는 중 오류가 발생했습니다.')],
          });
        }
        break;
      }

      case 'food': {
        await interaction.deferReply();
        try {
          const response = await axios.get<{ image: string }>('https://foodish-api.com/api/', {
            headers: { 'User-Agent': DEFAULT_USER_AGENT },
            timeout: 5000,
          });

          const embed = new EmbedBuilder()
            .setColor(Colors.SUCCESS)
            .setTitle('🍔 군침 도는 음식 사진!')
            .setImage(response.data.image)
            .setFooter({ text: 'Powered by Foodish API' });

          await interaction.editReply({ embeds: [embed] });
        } catch (error) {
          logger.error('Food API fetch failed', error);
          await interaction.editReply({
            embeds: [createErrorEmbed('음식 사진을 가져오는 중 오류가 발생했습니다.')],
          });
        }
        break;
      }

      case 'dog': {
        await interaction.deferReply();
        try {
          // random.dog API 사용하되, mp4, webm 등 동영상 필터링
          const response = await axios.get<{ url: string }>(
            'https://random.dog/woof.json?filter=mp4,webm,gif',
            {
              headers: { 'User-Agent': DEFAULT_USER_AGENT },
              timeout: 5000,
            }
          );

          const embed = new EmbedBuilder()
            .setColor(Colors.SUCCESS)
            .setTitle('🐶 멍멍!')
            .setImage(response.data.url)
            .setFooter({ text: 'Powered by random.dog' });

          await interaction.editReply({ embeds: [embed] });
        } catch (error) {
          logger.error('Dog API fetch failed', error);
          await interaction.editReply({
            embeds: [createErrorEmbed('강아지 사진을 가져오는 중 오류가 발생했습니다.')],
          });
        }
        break;
      }

      case 'cat': {
        await interaction.deferReply();
        try {
          const response = await axios.get<Array<{ url: string }>>(
            'https://api.thecatapi.com/v1/images/search',
            {
              headers: { 'User-Agent': DEFAULT_USER_AGENT },
              timeout: 5000,
            }
          );

          const embed = new EmbedBuilder()
            .setColor(Colors.SUCCESS)
            .setTitle('🐱 야옹!')
            .setImage(response.data[0].url)
            .setFooter({ text: 'Powered by The Cat API' });

          await interaction.editReply({ embeds: [embed] });
        } catch (error) {
          logger.error('Cat API fetch failed', error);
          await interaction.editReply({
            embeds: [createErrorEmbed('고양이 사진을 가져오는 중 오류가 발생했습니다.')],
          });
        }
        break;
      }

      case 'pokemon': {
        const name = interaction.options.getString('name', true);
        await interaction.deferReply();

        try {
          const response = await axios.get<PokeApiResponse>(
            `https://pokeapi.co/api/v2/pokemon/${name}`,
            {
              headers: { 'User-Agent': DEFAULT_USER_AGENT },
              timeout: 5000,
            }
          );

          const data = response.data;
          const imageUrl = data.sprites.other['official-artwork'].front_default;
          const types = data.types.map((t) => t.type.name).join(', ');

          const embed = new EmbedBuilder()
            .setColor(Colors.INFO)
            .setTitle(`Pokédex: ${data.name.toUpperCase()} (#${data.id})`)
            .addFields(
              { name: 'Type', value: types, inline: true },
              { name: 'Height', value: `${data.height / 10} m`, inline: true },
              { name: 'Weight', value: `${data.weight / 10} kg`, inline: true }
            )
            .setImage(imageUrl)
            .setFooter({ text: 'Powered by PokeAPI' });

          await interaction.editReply({ embeds: [embed] });
        } catch (error) {
          logger.error('Pokemon API fetch failed', error);
          if (axios.isAxiosError(error) && error.response?.status === 404) {
            await interaction.editReply({
              embeds: [createErrorEmbed(`'${name}'(이)라는 이름의 포켓몬을 찾을 수 없습니다.`)],
            });
          } else {
            await interaction.editReply({
              embeds: [createErrorEmbed('포켓몬 정보를 가져오는 중 오류가 발생했습니다.')],
            });
          }
        }
        break;
      }

      default:
        await interaction.reply({
          embeds: [createErrorEmbed('알 수 없는 서브커맨드입니다.')],
          ephemeral: true,
        });
    }
  },
};
