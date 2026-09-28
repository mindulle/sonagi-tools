import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  AutocompleteInteraction,
} from 'discord.js';
import type { Command } from '@sonagi-bots/shared';
import { Colors, createErrorEmbed } from '@sonagi-bots/shared';
import { logger } from '@sonagi-bots/shared';
import { NotionService } from '../../services/notion';

// 캐싱용 계좌 목록
let cachedAccounts: {
  income: { name: string; id: string }[];
  expense: { name: string; id: string }[];
} | null = null;

async function refreshAccounts() {
  if (!process.env.NOTION_API_KEY || !process.env.NOTION_LEDGER_DATA_SOURCE_ID) return;
  try {
    cachedAccounts = await NotionService.getLedgerAccounts();
  } catch (error) {
    logger.error('Failed to pre-fetch ledger accounts', error);
  }
}

// 봇 시작 시 한 번 호출하도록 설정 가능하지만, 여기서는 지연 초기화 사용
setTimeout(() => void refreshAccounts(), 5000);

export const ledgerCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('지출')
    .setDescription('노션(Notion) 가계부(Ledger)에 내역을 추가합니다.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('추가')
        .setDescription('가계부에 새로운 지출/수입 내역을 기록합니다.')
        .addNumberOption((option) =>
          option.setName('금액').setDescription('결제된 금액을 입력하세요.').setRequired(true)
        )
        .addStringOption((option) =>
          option.setName('사용처').setDescription('결제처나 내역을 입력하세요.').setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName('구분')
            .setDescription('지출인지 수입인지 선택하세요.')
            .setRequired(true)
            .addChoices(
              { name: '지출 (Expense)', value: 'Expense' },
              { name: '수입 (Income)', value: 'Income' }
            )
        )
        .addStringOption((option) =>
          option
            .setName('계좌')
            .setDescription('결제/입금된 계좌를 선택하세요 (자동완성)')
            .setRequired(false)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName('도메인')
            .setDescription('개인 용도인지 비즈니스 용도인지 선택하세요.')
            .setRequired(false)
            .addChoices({ name: '개인', value: '개인' }, { name: '비즈니스', value: '비즈니스' })
        )
        .addStringOption((option) =>
          option
            .setName('통화')
            .setDescription('통화를 선택하세요. (기본: WON)')
            .setRequired(false)
            .addChoices(
              { name: 'WON (원)', value: 'WON' },
              { name: 'USD (달러)', value: 'USD' },
              { name: 'AUD (호주달러)', value: 'AUD' },
              { name: 'None', value: 'None' }
            )
        )
    ),

  async autocomplete(interaction: AutocompleteInteraction) {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const typeStr = interaction.options.getString('구분');

    if (!cachedAccounts) {
      await refreshAccounts();
    }

    if (!cachedAccounts) {
      await interaction.respond([]);
      return;
    }

    // 구분에 따라 보여줄 계좌 목록 필터링
    let targetList = typeStr === 'Income' ? cachedAccounts.income : cachedAccounts.expense;

    // 만약 아직 '구분'을 선택하지 않았다면, 일단 전체(지출+수입)를 보여주거나 빈 배열
    if (!typeStr) {
      targetList = [...cachedAccounts.expense, ...cachedAccounts.income];
    }

    const filtered = targetList
      .filter((acc) => acc.name.toLowerCase().includes(focusedValue))
      .slice(0, 25);

    await interaction.respond(filtered.map((acc) => ({ name: acc.name, value: acc.id })));
  },

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    if (!process.env.NOTION_API_KEY || !process.env.NOTION_LEDGER_DATA_SOURCE_ID) {
      await interaction.reply({
        embeds: [
          createErrorEmbed(
            '현재 노션 연동이 비활성화되어 있습니다. (API 키 또는 데이터소스 ID 누락)'
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    if (subcommand === '추가') {
      const price = interaction.options.getNumber('금액', true);
      const name = interaction.options.getString('사용처', true);
      const type = interaction.options.getString('구분', true) as 'Income' | 'Expense';
      const accountId = interaction.options.getString('계좌') || undefined;
      const domain = (interaction.options.getString('도메인') || '개인') as '개인' | '비즈니스';
      const currency = (interaction.options.getString('통화') || 'WON') as
        'WON' | 'USD' | 'AUD' | 'None';

      await interaction.deferReply();

      try {
        await NotionService.addLedgerEntry({
          name,
          price,
          type,
          domain,
          currency,
          accountId,
        });

        // 계좌 이름 찾기
        let accountName = '선택 안 됨';
        if (accountId && cachedAccounts) {
          const acc = [...cachedAccounts.income, ...cachedAccounts.expense].find(
            (a) => a.id === accountId
          );
          if (acc) accountName = acc.name;
        }

        const embed = new EmbedBuilder()
          .setColor(type === 'Expense' ? Colors.WARNING : Colors.SUCCESS)
          .setTitle(`✅ ${type === 'Expense' ? '지출' : '수입'} 내역이 등록되었습니다.`)
          .addFields(
            { name: '사용처', value: name, inline: true },
            {
              name: '금액',
              value: `${price.toLocaleString()} ${currency === 'None' ? '' : currency}`,
              inline: true,
            },
            { name: '계좌', value: accountName, inline: true },
            { name: '도메인', value: domain, inline: true }
          )
          .setFooter({ text: 'Notion Ledger 연동' })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        logger.error('Error in /지출 추가 command:', error);
        await interaction.editReply({
          embeds: [createErrorEmbed('장부를 기록하는 중 서버 통신 오류가 발생했습니다.')],
        });
      }
    }
  },
};
