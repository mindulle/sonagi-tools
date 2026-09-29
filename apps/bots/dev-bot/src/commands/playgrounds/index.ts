import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AutocompleteInteraction,
} from 'discord.js';
import axios, { AxiosError } from 'axios';
import type { Command } from '@sonagi-bots/shared';
import { Colors, createErrorEmbed } from '@sonagi-bots/shared';
import { logger } from '@sonagi-bots/shared';

interface SandboxApiResponse {
  status: string;
  message?: string;
  sandbox_url?: string;
  preview_url?: string;
  sandbox_id?: string;
}

interface PistonResponse {
  language: string;
  version: string;
  run?: {
    output: string;
    code: number;
    stdout: string;
    stderr: string;
    signal: string;
  };
  message?: string;
}

interface ErrorResponseData {
  error?: string;
  message?: string;
}

// GitHub 트리 캐싱 (API Rate Limit 방지)
let cachedPaths: string[] = [];
let cacheTimestamp = 0;

async function fetchPlaygroundPaths() {
  const now = Date.now();
  // 5분 캐시
  if (cachedPaths.length > 0 && now - cacheTimestamp < 5 * 60 * 1000) {
    return cachedPaths;
  }
  try {
    const res = await axios.get(
      'https://api.github.com/repos/mindulle/sonagi-playgrounds/git/trees/main?recursive=1',
      {
        timeout: 5000,
      }
    );

    // .ipynb 파일이거나 package.json이 있는 폴더(JS/React) 추출
    const paths = res.data.tree
      .filter(
        (item: any) =>
          item.type === 'blob' &&
          (item.path.endsWith('.ipynb') || item.path.endsWith('package.json'))
      )
      .map((item: any) => {
        if (item.path.endsWith('.ipynb')) return item.path.replace(/^examples\//, '');
        return item.path.replace('/package.json', '').replace('^examples/', '');
      });

    cachedPaths = paths;
    cacheTimestamp = now;
    return cachedPaths;
  } catch (err) {
    logger.error('Failed to fetch tree from GitHub for autocomplete', err);
    return cachedPaths;
  }
}

export const playCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Sonagi Playgrounds 연동 커맨드')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('sandbox')
        .setDescription('GitHub의 예제 코드를 CodeSandbox 혹은 JupyterLite 환경으로 띄웁니다.')
        .addStringOption((option) =>
          option
            .setName('path')
            .setDescription('실행할 예제의 경로 (자동완성 지원)')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('project')
        .setDescription('프로젝트 경로를 받아 Sandbox API를 호출하고 Preview URL을 제공합니다.')
        .addStringOption((option) =>
          option
            .setName('path')
            .setDescription('실행할 프로젝트 경로 (자동완성 지원)')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('run')
        .setDescription('코드를 즉시 실행하고 콘솔 결과를 확인합니다 (I Run Code 대체)')
        .addStringOption((option) =>
          option
            .setName('language')
            .setDescription('실행할 언어 (예: python, javascript, typescript, cpp)')
            .setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('code').setDescription('실행할 코드 내용').setRequired(true)
        )
    ),

  async autocomplete(interaction: AutocompleteInteraction) {
    const focusedValue = interaction.options.getFocused();
    const paths = await fetchPlaygroundPaths();

    // 필터링 및 최대 25개 반환 (디스코드 API 제한)
    const filtered = paths
      .filter((choice) => choice.toLowerCase().includes(focusedValue.toLowerCase()))
      .slice(0, 25);

    await interaction.respond(filtered.map((choice) => ({ name: choice, value: choice })));
  },

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'sandbox': {
        const examplePath = interaction.options.getString('path', true);
        await interaction.deferReply();

        try {
          // 파이썬 노트북 분기 처리
          if (examplePath.endsWith('.ipynb')) {
            const jupyterDomain =
              process.env.JUPYTERLITE_DOMAIN || 'https://mindulle.github.io/sonagi-playgrounds';
            const jupyterUrl = `${jupyterDomain}/lab/index.html?path=${examplePath}`;

            const embed = new EmbedBuilder()
              .setColor(Colors.SUCCESS)
              .setTitle('🐍 JupyterLite 샌드박스')
              .setDescription(
                `\`${examplePath}\` 파이썬 노트북이 브라우저 실행 환경(JupyterLite)으로 준비되었습니다!`
              )
              .setTimestamp();

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setLabel('Open in JupyterLite')
                .setStyle(ButtonStyle.Link)
                .setURL(jupyterUrl)
            );

            await interaction.editReply({ embeds: [embed], components: [row] });
            return;
          }

          // 기존 JS/React CodeSandbox 처리
          const apiUrl =
            process.env.PLAYGROUNDS_API_URL || 'https://sonagi-playgrounds.sonagi-dev.workers.dev';
          const response = await axios.get<SandboxApiResponse>(`${apiUrl}/sandbox`, {
            params: { path: examplePath },
            timeout: 10000,
          });

          const data = response.data;

          if (data.status === 'success' && data.sandbox_url && data.preview_url) {
            const embed = new EmbedBuilder()
              .setColor(Colors.SUCCESS)
              .setTitle('🎡 CodeSandbox 샌드박스')
              .setDescription(
                `\`${examplePath}\` 예제 코드가 라이브 환경에 성공적으로 세팅되었습니다!`
              )
              .addFields({ name: 'Preview URL', value: data.preview_url })
              .setTimestamp();

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setLabel('Open in CodeSandbox')
                .setStyle(ButtonStyle.Link)
                .setURL(data.sandbox_url)
            );

            await interaction.editReply({ embeds: [embed], components: [row] });
          } else {
            throw new Error(data.message || 'Unknown error from Playgrounds API');
          }
        } catch (_error: unknown) {
          logger.error(`Failed to generate sandbox for ${examplePath}`, _error);

          let errorMsg = '샌드박스 생성에 실패했습니다.';
          if (axios.isAxiosError(_error)) {
            const axiosErr = _error as AxiosError<ErrorResponseData>;
            errorMsg =
              axiosErr.response?.data?.error ||
              axiosErr.response?.data?.message ||
              axiosErr.message;
          } else if (_error instanceof Error) {
            errorMsg = _error.message;
          }

          await interaction.editReply({ embeds: [createErrorEmbed(`API 통신 에러: ${errorMsg}`)] });
        }
        break;
      }
      case 'project': {
        const examplePath = interaction.options.getString('path', true);
        await interaction.deferReply();

        try {
          const apiUrl =
            process.env.PLAYGROUNDS_API_URL || 'https://sonagi-playgrounds.sonagi-dev.workers.dev';
          const response = await axios.get<SandboxApiResponse>(`${apiUrl}/sandbox`, {
            params: { path: examplePath },
            timeout: 10000,
          });

          const data = response.data;

          if (data.status === 'success' && data.preview_url) {
            const embed = new EmbedBuilder()
              .setColor(Colors.SUCCESS)
              .setTitle('📦 프로젝트 샌드박스')
              .setDescription(`\`${examplePath}\` 프로젝트가 샌드박스 환경에 세팅되었습니다!`)
              .addFields(
                { name: 'Preview URL', value: data.preview_url },
                ...(data.sandbox_url ? [{ name: 'Sandbox URL', value: data.sandbox_url }] : [])
              )
              .setTimestamp();

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder()
                .setLabel('Open Preview')
                .setStyle(ButtonStyle.Link)
                .setURL(data.preview_url)
            );

            await interaction.editReply({ embeds: [embed], components: [row] });
          } else {
            throw new Error(data.message || 'Unknown error from Playgrounds API');
          }
        } catch (_error: unknown) {
          logger.error(`Failed to generate project sandbox for ${examplePath}`, _error);

          let errorMsg = '프로젝트 샌드박스 생성에 실패했습니다.';
          if (axios.isAxiosError(_error)) {
            const axiosErr = _error as AxiosError<ErrorResponseData>;
            errorMsg =
              axiosErr.response?.data?.error ||
              axiosErr.response?.data?.message ||
              axiosErr.message;
          } else if (_error instanceof Error) {
            errorMsg = _error.message;
          }

          await interaction.editReply({ embeds: [createErrorEmbed(`API 통신 에러: ${errorMsg}`)] });
        }
        break;
      }
      case 'run': {
        const language = interaction.options.getString('language', true);
        let code = interaction.options.getString('code', true);

        code = code
          .replace(/^```[a-z]*\n/i, '')
          .replace(/\n```$/i, '')
          .trim();

        await interaction.deferReply();

        try {
          const pistonBaseUrl = process.env.PISTON_API_URL || 'http://piston:2000';
          const pistonApiUrl = `${pistonBaseUrl.replace(/\/$/, '')}/api/v2/execute`;

          const response = await axios.post<PistonResponse>(
            pistonApiUrl,
            {
              language: language,
              version: '*',
              files: [
                {
                  content: code,
                },
              ],
            },
            { timeout: 10000 }
          );

          const data = response.data;
          if (data.run) {
            const output = data.run.output ? data.run.output.replace(/```/g, "'''") : 'No output';
            const truncatedOutput =
              output.length > 2000 ? output.substring(0, 1997) + '...' : output;

            const embed = new EmbedBuilder()
              .setColor(data.run.code === 0 ? Colors.SUCCESS : Colors.ERROR)
              .setTitle(`🖥️ Code Execution Result (${data.language} ${data.version})`)
              .setDescription(`\`\`\`\n${truncatedOutput}\n\`\`\``)
              .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
          } else {
            throw new Error(data.message || 'Execution failed');
          }
        } catch (_error: unknown) {
          logger.error(`Failed to execute code for ${language}`, _error);

          let errorMsg = '코드 실행에 실패했습니다.';
          if (axios.isAxiosError(_error)) {
            const axiosErr = _error as AxiosError<ErrorResponseData>;
            if (axiosErr.response?.status === 429) {
              errorMsg =
                '무료 API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요. (429 Too Many Requests)';
            } else {
              errorMsg =
                axiosErr.response?.data?.error ||
                axiosErr.response?.data?.message ||
                axiosErr.message;
            }
          } else if (_error instanceof Error) {
            errorMsg = _error.message;
          }

          await interaction.editReply({
            embeds: [createErrorEmbed(`Piston API 에러: ${errorMsg}`)],
          });
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
