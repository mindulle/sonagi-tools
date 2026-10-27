import { Command } from 'commander';
import chalk from 'chalk';
import axios from 'axios';

const SEARXNG_URL = process.env.SEARXNG_URL || 'http://100.91.9.83:8080';
const INBOX_API_URL = process.env.INBOX_API_URL || 'http://100.91.9.83:13888/v0/inbox';

export const researchCommand = new Command('research').description(
  'Perform deep web research using SearXNG + Jina Reader pipeline'
);

researchCommand
  .argument('<query>', 'Search query or research topic')
  .option('-s, --save', 'Save research output directly to LLM-Wiki 10_Sources/Inbox')
  .action(async (query: string, options) => {
    console.log(chalk.bold.cyan(`\n🌐 Sonagi Web Research: "${query}"...\n`));

    try {
      // 1. SearXNG
      const searchUrl = `${SEARXNG_URL.replace(/\/$/, '')}/search?q=${encodeURIComponent(query)}&format=json`;
      const searchRes = await axios.get(searchUrl, { timeout: 10000 });
      const results = searchRes.data?.results || [];
      const topResults = results.slice(0, 3);

      if (topResults.length === 0) {
        console.log(chalk.yellow('No web search results found.'));
        return;
      }

      console.log(chalk.bold('Top Sources Discovered:'));
      for (const [i, r] of topResults.entries()) {
        console.log(`  ${chalk.green(`[${i + 1}]`)} ${chalk.bold(r.title || r.url)}`);
        console.log(`      ${chalk.gray(r.url)}`);
      }
      console.log('');

      // 2. Jina Reader Fetch
      const articles: { title: string; url: string; content: string }[] = [];
      for (const r of topResults) {
        console.log(chalk.blue(`Fetching content via Jina Reader: ${r.url}...`));
        try {
          const jinaRes = await axios.get(`https://r.jina.ai/${r.url}`, {
            timeout: 12000,
            headers: { 'User-Agent': 'Sonagi-CLI/0.1.0' },
          });
          articles.push({
            title: r.title || r.url,
            url: r.url,
            content: String(jinaRes.data || ''),
          });
        } catch (e: any) {
          articles.push({
            title: r.title || r.url,
            url: r.url,
            content: r.content || 'Content extraction failed.',
          });
        }
      }

      // Display previews
      console.log(chalk.bold('\n--- Research Insights ---'));
      for (const a of articles) {
        console.log(chalk.bold.yellow(`\n### ${a.title} ###`));
        console.log(chalk.gray(`Source: ${a.url}\n`));
        console.log(a.content.substring(0, 500).trim() + '...\n');
      }

      // 3. Save to Inbox if requested
      if (options.save) {
        console.log(chalk.cyan('Saving research findings to LLM-Wiki 10_Sources/Inbox...'));
        const combined = articles
          .map((a) => `## [${a.title}](${a.url})\n\n${a.content.substring(0, 4000)}\n\n---\n`)
          .join('\n');

        const inboxRes = await axios.post(
          INBOX_API_URL,
          {
            title: `Web Research: ${query}`,
            content: combined,
            author: 'Sonagi CLI',
            source: 'Sonagi CLI (sonagi research)',
            url: topResults[0]?.url || '',
            tags: ['inbox', 'research', 'cli-collected'],
          },
          { timeout: 5000 }
        );

        if (inboxRes.data?.status === 'ok') {
          console.log(chalk.green(`\n✅ Saved to LLM-Wiki: ${inboxRes.data.path}`));
        } else {
          console.log(chalk.red(`\n❌ Failed to save to Inbox: ${inboxRes.data?.message}`));
        }
      }
    } catch (e: any) {
      console.log(chalk.red(`\n❌ Research error: ${e.message}`));
    }
  });
