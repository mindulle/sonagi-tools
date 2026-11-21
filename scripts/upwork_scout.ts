#!/usr/bin/env bun
/**
 * Upwork 공고 스캐너 (Jina 리더 경유)
 *
 * Upwork는 이 서버 IP를 Cloudflare로 차단한다(직접 요청·헤드리스 브라우저 모두 403).
 * 공개 RSS 피드도 410으로 폐지됐다. 그래서 r.jina.ai 를 경유한다.
 *
 * 핵심 파라미터:
 *   - X-Target-Selector: article.job-tile
 *     → 이걸 안 주면 Jina 마크다운에서 카드 제목/링크가 통째로 누락된다.
 *   - hourly_rate / amount URL 필터는 게스트에게 챌린지를 유발한다 → 파싱 후 클라이언트 필터.
 *   - contractor_tier 는 일부 쿼리에서 422를 낸다 → 필터를 떼고 재시도.
 *
 * 사용:
 *   bun scripts/upwork_scout.ts 'cloudflare' 'bun typescript' --tier 3 --top 8
 *   node --experimental-strip-types scripts/upwork_scout.ts 'figma design system' --json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const JINA = 'https://r.jina.ai/';
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

/** 포트폴리오 포지셔닝(Cloudflare·Bun·디자인 시스템) 기준 가중치 */
const PROFILE_TERMS: Record<string, number> = {
  cloudflare: 5,
  workers: 4,
  d1: 4,
  r2: 3,
  'durable objects': 4,
  bun: 4,
  typescript: 3,
  hono: 3,
  edge: 2,
  serverless: 2,
  react: 2,
  'next.js': 2,
  astro: 2,
  supabase: 2,
  postgres: 2,
  tldraw: 3,
  canvas: 1,
  'design system': 3,
  figma: 2,
  tailwind: 2,
  shopify: 1,
  graphql: 2,
  'api integration': 2,
  automation: 1,
};

export interface Job {
  id: string;
  title: string;
  url: string;
  posted: string;
  postedDays: number | null;
  budget: string;
  level: string;
  duration: string;
  skills: string;
  descHead: string;
  score: number;
  isNew?: boolean;
}

interface Args {
  queries: string[];
  tier: string;
  pages: number;
  minUsd: number | null;
  top: number;
  json: boolean;
  newOnly: boolean;
  maxAgeDays: number | null;
  statePath: string;
}

const HERE: string =
  (import.meta as unknown as { dir?: string }).dir ??
  path.dirname(new URL(import.meta.url).pathname);
const DEFAULT_STATE = path.resolve(HERE, '../tmp/upwork-scout-seen.json');

function parseArgs(argv: string[]): Args {
  const args: Args = {
    queries: [],
    tier: '',
    pages: 1,
    minUsd: null,
    top: 10,
    json: false,
    newOnly: false,
    maxAgeDays: null,
    statePath: DEFAULT_STATE,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    switch (a) {
      case '--tier':
        args.tier = argv[++i] ?? '';
        break;
      case '--pages':
        args.pages = Number(argv[++i] ?? 1);
        break;
      case '--min-usd':
        args.minUsd = Number(argv[++i]);
        break;
      case '--top':
        args.top = Number(argv[++i] ?? 10);
        break;
      case '--max-age-days':
        args.maxAgeDays = Number(argv[++i]);
        break;
      case '--json':
        args.json = true;
        break;
      case '--new-only':
        args.newOnly = true;
        break;
      case '--state':
        args.statePath = path.resolve(argv[++i] ?? DEFAULT_STATE);
        break;
      default:
        if (!a.startsWith('--')) args.queries.push(a);
        break;
    }
  }
  if (args.queries.length === 0) args.queries.push('cloudflare', 'bun typescript', 'design system figma');
  return args;
}

function log(msg: string): void {
  console.error(msg);
}

async function fetchJina(url: string): Promise<string> {
  const res = await fetch(JINA + url, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/plain',
      'X-Target-Selector': 'article.job-tile',
      'X-No-Cache': 'true',
      'X-Timeout': '30',
    },
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    // 422 + "No content available ... target selector" = 공고 타일이 0개라는 뜻이다.
    const zeroResults = res.status === 422 && body.includes('target selector');
    throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status, zeroResults });
  }
  return res.text();
}

const CARD_COUNT_RE = /^## \[[^\]]+\]\(https:\/\/www\.upwork\.com\/jobs\//gm;

async function fetchCards(url: string, tries = 4): Promise<string | null> {
  let target = url;
  let tierDropped = false;
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    try {
      const md = await fetchJina(target);
      const cards = (md.match(CARD_COUNT_RE) ?? []).length;
      if (cards > 0) return md;
      log(`    retry ${attempt}: empty/skeleton (${md.length}B)`);
    } catch (err) {
      const e = err as { status?: number; zeroResults?: boolean; message: string };
      if (e.zeroResults) {
        // 타일이 0개. tier 필터가 과하게 걸렸을 수 있으니 한 번만 떼보고, 그래도 0이면 종료.
        if (!tierDropped && target.includes('contractor_tier=')) {
          log('    결과 0건: contractor_tier 제거 후 재확인');
          target = target.replace(/&?contractor_tier=[^&]*/, '');
          tierDropped = true;
          continue;
        }
        log('    결과 0건 (공고 타일 없음)');
        return null;
      }
      log(`    retry ${attempt}: ${e.message}`);
    }
    // 캐시된 챌린지/스켈레톤 회피용 캐시버스터
    const [base, qs = ''] = target.split('?');
    target = `${base}?${qs}${qs ? '&' : ''}_r=${Math.floor(Math.random() * 90_000 + 10_000)}`;
    await new Promise((r) => setTimeout(r, 3_000 * attempt));
  }
  return null;
}

function toDays(posted: string): number | null {
  const m = posted.match(/(\d+)\s*(second|minute|hour|day|week|month)s?\s+ago/i);
  if (!m) return posted ? 0 : null;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  const mult: Record<string, number> = {
    second: 1 / 86_400,
    minute: 1 / 1_440,
    hour: 1 / 24,
    day: 1,
    week: 7,
    month: 30,
  };
  return Math.round(n * (mult[unit] ?? 1) * 10) / 10;
}

function jobId(url: string): string {
  return url.match(/~(\d+)/)?.[1] ?? url;
}

export function parseCards(md: string): Job[] {
  const cardRe = /^## \[([^\]]+)\]\((https:\/\/www\.upwork\.com\/jobs\/[^)]+)\)/gm;
  const matches = [...md.matchAll(cardRe)];
  const jobs: Job[] = [];
  matches.forEach((m, i) => {
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? md.length) : md.length;
    const body = md.slice(start, end);
    const pre = md.slice(0, m.index ?? 0);
    const postedHits = [...pre.matchAll(/Posted ([^\n]{1,40}? ago)/g)];

    const lines = body.split('\n').map((l) => l.trimEnd());
    const bullets = lines.filter((l) => l.startsWith('*   ')).map((l) => l.slice(4).trim());
    const strip = (s: string) => s.replace(/\*+/g, '').trim();

    const budget = strip(bullets.find((b) => b.includes('Hourly') || b.includes('$')) ?? '');
    const level = strip(
      bullets.find((b) => ['Entry Level', 'Intermediate', 'Expert'].includes(strip(b))) ?? '',
    );
    const duration = strip(bullets.find((b) => b.includes('Est. time')) ?? '').replace(
      'Est. time:',
      '',
    ).trim();

    let textLines = lines.filter((l) => l.trim() && !l.startsWith('*   '));
    let skills = '';
    const last = textLines.at(-1)?.trim() ?? '';
    if (last && last.length <= 140 && !last.includes('.') && !last.includes('http')) {
      skills = last;
      textLines = textLines.slice(0, -1);
    }
    const descHead = textLines
      .map((l) => l.trim())
      .join(' ')
      .replace(/\s{2,}/g, ' ')
      .slice(0, 800);

    const job: Job = {
      id: jobId(m[2]),
      title: m[1].trim(),
      url: m[2].split('?')[0],
      posted: postedHits.at(-1)?.[1] ?? '',
      postedDays: null,
      budget,
      level,
      duration,
      skills,
      descHead,
      score: 0,
    };
    job.postedDays = toDays(job.posted);
    job.score = scoreJob(job);
    jobs.push(job);
  });
  return jobs;
}

function scoreJob(j: Job): number {
  const blob = `${j.title} ${j.descHead} ${j.skills}`.toLowerCase();
  let s = 0;
  for (const [term, weight] of Object.entries(PROFILE_TERMS)) {
    if (blob.includes(term)) s += weight;
  }
  const rates = [...j.budget.matchAll(/\$(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
  if (rates.length && Math.max(...rates) >= 45) s += 3;
  if (j.level === 'Expert') s += 2;
  if (j.postedDays !== null && j.postedDays <= 7) s += 2;
  return s;
}

async function search(query: string, tier: string, pages: number): Promise<Job[]> {
  const out: Job[] = [];
  for (let page = 1; page <= pages; page += 1) {
    const qs = new URLSearchParams({ q: query, sort: 'recency', page: String(page) });
    if (tier) qs.set('contractor_tier', tier);
    const url = `https://www.upwork.com/nx/search/jobs/?${qs.toString()}`;
    const t0 = Date.now();
    const md = await fetchCards(url);
    if (!md) {
      log(`  · page ${page}: 결과 없음 (공고 0건 또는 차단)`);
      continue;
    }
    const jobs = parseCards(md);
    log(`  · page ${page}: ${md.length.toLocaleString()}B in ${((Date.now() - t0) / 1000).toFixed(1)}s → ${jobs.length} jobs`);
    out.push(...jobs);
  }
  return out;
}

function loadState(file: string): Record<string, string> {
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>;
  } catch {
    return {};
  }
}

function saveState(file: string, state: Record<string, string>): void {
  const cutoff = Date.now() - 60 * 86_400_000;
  const trimmed = Object.fromEntries(
    Object.entries(state).filter(([, iso]) => Date.parse(iso) > cutoff),
  );
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(trimmed, null, 2)}\n`);
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const collected: Job[] = [];

  for (const q of args.queries) {
    log(`[query] ${q}`);
    collected.push(...(await search(q, args.tier, args.pages)));
    await new Promise((r) => setTimeout(r, 2_000));
  }

  const seen = new Set<string>();
  let filtered = 0;
  const state = loadState(args.statePath);
  const unique: Job[] = [];

  for (const job of collected) {
    if (seen.has(job.id)) continue;
    seen.add(job.id);

    if (args.minUsd !== null) {
      const rates = [...job.budget.matchAll(/\$(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
      // 시간당 단가가 비공개("Hourly"만 표기)인 공고는 판단 불가라 통과시킨다
      if (rates.length && Math.max(...rates) < args.minUsd) {
        filtered += 1;
        continue;
      }
    }
    if (args.maxAgeDays !== null && job.postedDays !== null && job.postedDays > args.maxAgeDays) {
      filtered += 1;
      continue;
    }
    job.isNew = !(job.id in state);
    if (args.newOnly && !job.isNew) {
      filtered += 1;
      continue;
    }
    unique.push(job);
  }

  unique.sort((a, b) => b.score - a.score);
  const top = unique.slice(0, args.top);

  for (const job of top) state[job.id] = state[job.id] ?? new Date().toISOString();
  saveState(args.statePath, state);

  if (args.json) {
    console.log(JSON.stringify(top, null, 2));
    return 0;
  }

  console.log(
    `\n${collected.length}개 수집 · ${unique.length}개 표시 · ${filtered}개 제외 · ${top.filter((j) => j.isNew).length}개 신규\n`,
  );
  if (top.length === 0) {
    console.log('조건에 맞는 공고가 없습니다.');
    return 0;
  }
  top.forEach((j, i) => {
    const flag = j.isNew ? '🆕 ' : '';
    console.log(`${i + 1}. ${flag}[${j.score}] ${j.title}`);
    const meta = [j.budget || '예산 비공개', j.level, j.posted].filter(Boolean).join(' · ');
    console.log(`   ${meta}`);
    if (j.duration) console.log(`   ${j.duration}`);
    console.log(`   ${j.url}`);
  });
  return 0;
}

const BUN_MAIN = (import.meta as unknown as { main?: boolean }).main;
const isMain =
  typeof BUN_MAIN === 'boolean'
    ? BUN_MAIN
    : Boolean(process.argv[1]) &&
      path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);

if (isMain) {
  main().then((code) => process.exit(code));
}
