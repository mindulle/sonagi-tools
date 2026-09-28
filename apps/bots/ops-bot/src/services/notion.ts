import { Client, isFullPage } from '@notionhq/client';
import { CreatePageParameters } from '@notionhq/client/build/src/api-endpoints';
import { logger } from '@sonagi-bots/shared';

export interface ScheduleItem {
  id: string;
  title: string;
  date: string | null;
  category: string | null;
  location: string | null;
  isDone: boolean;
}

export class NotionService {
  private static getClient(): Client {
    const token = process.env.NOTION_API_KEY;
    if (!token) {
      throw new Error('NOTION_API_KEY is not configured.');
    }
    return new Client({ auth: token });
  }

  private static getDataSourceId(): string {
    const dataSourceId = process.env.NOTION_SCHEDULER_DATA_SOURCE_ID;
    if (!dataSourceId) {
      throw new Error('NOTION_SCHEDULER_DATA_SOURCE_ID is not configured.');
    }
    return dataSourceId;
  }

  private static getLedgerDataSourceId(): string {
    const dataSourceId = process.env.NOTION_LEDGER_DATA_SOURCE_ID;
    if (!dataSourceId) {
      throw new Error('NOTION_LEDGER_DATA_SOURCE_ID is not configured.');
    }
    return dataSourceId;
  }

  /**
   * 가계부(Ledger) DB의 수입/지출 계좌 목록을 조회합니다.
   * Autocomplete에 활용하기 위한 캐싱 용도입니다.
   */
  static async getLedgerAccounts(): Promise<{
    income: { name: string; id: string }[];
    expense: { name: string; id: string }[];
  }> {
    const notion = this.getClient();
    const dataSourceId = this.getLedgerDataSourceId();

    try {
      const response = await notion.dataSources.retrieve({
        data_source_id: dataSourceId,
      });

      const props = response.properties;

      // 사용자 오타 대응: 'Aaccount (Income)', 'Account (Expense)' 등
      const incomeProp = props['Aaccount (Income)'] || props['Account (Income)'];
      const expenseProp = props['Account (Expense)'] || props['Acoount (Expense)'];

      const incomeOptions = incomeProp?.type === 'select' ? incomeProp.select.options : [];
      const expenseOptions = expenseProp?.type === 'select' ? expenseProp.select.options : [];

      return {
        income: incomeOptions.map((opt) => ({ name: opt.name, id: opt.id })),
        expense: expenseOptions.map((opt) => ({ name: opt.name, id: opt.id })),
      };
    } catch (error) {
      logger.error('Failed to fetch Ledger accounts from Notion', error);
      return { income: [], expense: [] };
    }
  }

  /**
   * 가계부(Ledger)에 새로운 지출/수입 내역을 추가합니다.
   */
  static async addLedgerEntry(data: {
    name: string;
    price: number;
    type: 'Income' | 'Expense';
    domain: '개인' | '비즈니스';
    currency: 'WON' | 'USD' | 'AUD' | 'None';
    accountId?: string;
  }): Promise<string> {
    const notion = this.getClient();
    const dataSourceId = this.getLedgerDataSourceId();

    const today = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const todayKst = new Date(today.getTime() + kstOffset);
    const dateString = todayKst.toISOString().split('T')[0];

    const properties: CreatePageParameters['properties'] = {
      Name: {
        title: [
          {
            text: {
              content: data.name,
            },
          },
        ],
      },
      Price: {
        number: data.price,
      },
      Type: {
        select: {
          name: data.type,
        },
      },
      Domain: {
        select: {
          name: data.domain,
        },
      },
      Currency: {
        select: {
          name: data.currency,
        },
      },
      Date: {
        date: {
          start: dateString,
        },
      },
      Done: {
        checkbox: true, // 수동 입력이나 리액션으로 승인된 건이므로 완료 처리
      },
    };

    if (data.accountId) {
      if (data.type === 'Income') {
        // 기존 오타 대응
        properties['Aaccount (Income)'] = { select: { id: data.accountId } };
      } else {
        properties['Account (Expense)'] = { select: { id: data.accountId } };
      }
    }

    try {
      const response = await notion.pages.create({
        parent: { type: 'data_source_id', data_source_id: dataSourceId },
        properties,
      });

      return response.id;
    } catch (error) {
      logger.error('Failed to create ledger entry in Notion', error);
      throw new Error('Notion API Error');
    }
  }

  /**
   * 오늘 날짜의 일정을 모두 가져옵니다.
   */
  static async getTodaySchedules(): Promise<ScheduleItem[]> {
    const notion = this.getClient();
    const dataSourceId = this.getDataSourceId();

    const today = new Date();
    // KST 기준으로 오늘 날짜 YYYY-MM-DD 구하기
    const kstOffset = 9 * 60 * 60 * 1000;
    const todayKst = new Date(today.getTime() + kstOffset);
    const todayString = todayKst.toISOString().split('T')[0];

    try {
      const response = await notion.dataSources.query({
        data_source_id: dataSourceId,
        filter: {
          property: 'Date',
          date: {
            equals: todayString,
          },
        },
        sorts: [
          {
            property: 'Date',
            direction: 'ascending',
          },
        ],
      });

      return response.results.filter(isFullPage).map((page) => {
        const props = page.properties;

        let title = '제목 없음';
        if (props['이름']?.type === 'title' && props['이름'].title.length > 0) {
          title = props['이름'].title[0].plain_text;
        }

        let date = null;
        if (props['Date']?.type === 'date' && props['Date'].date) {
          date = props['Date'].date.start;
        }

        let category = null;
        if (props['카테고리']?.type === 'select' && props['카테고리'].select) {
          category = props['카테고리'].select.name;
        }

        let location = null;
        if (props['Location']?.type === 'rich_text' && props['Location'].rich_text.length > 0) {
          location = props['Location'].rich_text[0].plain_text;
        }

        let isDone = false;
        if (props['Done']?.type === 'checkbox') {
          isDone = props['Done'].checkbox;
        }

        return {
          id: page.id,
          title,
          date,
          category,
          location,
          isDone,
        };
      });
    } catch (error) {
      logger.error('Failed to fetch today schedules from Notion', error);
      throw new Error('Notion API Error');
    }
  }

  /**
   * 새로운 일정을 추가합니다.
   * @param title 일정 제목
   * @param date 일정 날짜 (YYYY-MM-DD 형식)
   * @param category 카테고리 (옵션)
   * @param location 장소 (옵션)
   */
  static async addSchedule(
    title: string,
    date: string,
    category?: string,
    location?: string
  ): Promise<string> {
    const notion = this.getClient();
    const dataSourceId = this.getDataSourceId();

    const properties: CreatePageParameters['properties'] = {
      이름: {
        title: [
          {
            text: {
              content: title,
            },
          },
        ],
      },
      Date: {
        date: {
          start: date,
        },
      },
    };

    if (category) {
      properties['카테고리'] = {
        select: {
          name: category,
        },
      };
    }

    if (location) {
      properties['Location'] = {
        rich_text: [
          {
            text: {
              content: location,
            },
          },
        ],
      };
    }

    try {
      const response = await notion.pages.create({
        parent: { type: 'data_source_id', data_source_id: dataSourceId },
        properties,
      });

      return response.id;
    } catch (error) {
      logger.error('Failed to create schedule in Notion', error);
      throw new Error('Notion API Error');
    }
  }

  /**
   * 일정 마감 기한 연장 (Snooze)
   */
  static async updateScheduleDate(pageId: string, newDateIsoString: string): Promise<void> {
    const notion = this.getClient();
    try {
      await notion.pages.update({
        page_id: pageId,
        properties: {
          Date: {
            date: {
              start: newDateIsoString,
            },
          },
        },
      });
    } catch (error) {
      logger.error('Failed to update schedule date', error);
      throw new Error('Notion API Error');
    }
  }

  /**
   * 일정 완료 처리
   */
  static async completeSchedule(pageId: string): Promise<void> {
    const notion = this.getClient();
    try {
      await notion.pages.update({
        page_id: pageId,
        properties: {
          Done: {
            checkbox: true,
          },
        },
      });
    } catch (error) {
      logger.error('Failed to complete schedule', error);
      throw new Error('Notion API Error');
    }
  }
}
