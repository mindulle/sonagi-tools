# ✨ Spells Bot (Infra & DevOps Edition)

Sonagi 생태계의 인프라 제어, CDN 관리, 그리고 유틸리티 접근을 위한 통합 Discord 봇입니다.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat&logo=typescript&logoColor=white)
![Discord.js](https://img.shields.io/badge/Discord.js-5865F2?style=flat&logo=discord&logoColor=white)

## 🎯 주요 기능 (예정)

### 🏗️ 인프라 제어 (`/infra`)

- K3s 클러스터 헬스체크 및 노드/파드 상태 점검
- n8n 웹훅 및 워크플로우 상태 모니터링

### 🌐 CDN 관리 (`/cdn`)

- MinIO 스토리지 상태 및 파일 퍼지
- MinIO 버킷 상태 및 용량 모니터링

### 🎨 갤러리 검색 (`/gallery`)

- Sonagi Eagle Gallery API 연동
- 태그 기반 디자인 레퍼런스 즉시 검색

## 🎨 Figma & FigJam Tools

이 레포지토리는 인프라 봇 외에도 디자이너와 기획자를 위한 Figma/FigJam 확장 도구를 포함합니다.

- **[Sonagi Brainstorm Widget](./apps/brainstorm-widget)**: 사내 LLM 프록시(`CLIproxyAPI`)와 연동하여 FigJam 환경에서 아이데이션을 돕는 위젯입니다. 생성된 아이디어를 캔버스에 직접 스티키 노트(Sticky Note)로 추출하는 기능을 제공합니다.
- **[Sonagi Design Tools](./apps/figma-plugin)**: Asset Hub 등 사내 에셋과 연동되는 범용 Figma 플러그인입니다.
- **[Sonagi Figma Boilerplate](./apps/figma-plugin-boilerplate)**: 새로운 피그마 플러그인을 빠르게 만들기 위한 순수 템플릿(React+Vite)입니다.
- **[Sonagi Obsidian Plugin](./apps/obsidian-plugin)**: PKM(지식 관리) 환경 확장을 위한 옵시디언 플러그인 개발 보일러플레이트입니다.
- **[Sonagi Bot Boilerplate](./apps/bots/bot-boilerplate)**: 새로운 디스코드 봇을 만들기 위한 순수 템플릿입니다.

---

## 🚀 Quick Start

### 1. 설치 및 환경 설정

```bash
git clone https://github.com/mindulle/spells-bot.git
cd spells-bot
npm install
cp .env.example .env
```

### 2. 환경 변수 (`.env`)

```env
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_client_id
DISCORD_GUILD_ID=your_guild_id
```

### 3. 명령어 배포 및 실행

```bash
npm run deploy-commands
npm run dev
```

## 🏗️ 프로젝트 구조

```text
spells-bot/
├── apps/
│   ├── brainstorm-widget/    # FigJam LLM 브레인스토밍 위젯 (CLIproxyAPI 연동)
│   └── figma-plugin/         # Figma / FigJam 다목적 디자인 도구 플러그인
├── src/
│   ├── commands/              # 디스코드 슬래시 커맨드
│   │   ├── infra/            # K3s, n8n 상태 제어
│   │   ├── cdn/              # MinIO CDN 관리
│   │   ├── gallery/          # Eagle Gallery 연동 검색
│   │   ├── design/           # 디자인 관련 기능 (Blur 등)
│   │   └── utils/            # 공통/일반 커맨드
│   ├── services/             # 외부 API 연동 계층 (MinIO, K3s 등)
│   ├── utils/                # 유틸리티 (로거, 임베드 빌더 등)
│   ├── types/                # TypeScript 타입 정의
│   ├── events/               # Discord.js 이벤트 핸들러
│   └── index.ts              # 메인 봇 엔트리포인트
├── .opencode/
│   └── skills/               # AI 에이전트 작업 가이드 (SKILL.md)
├── scripts/
│   └── deploy-commands.ts    # 커맨드 전역 배포 스크립트
└── package.json
```

### 📌 아키텍처 결정 사항: Web Clip 파이프라인

- **기능**: Discord 채널(`web-clip`)에서 ✅ 이모지 리액션 시 위키 지식 베이스(Obsidian)에 자동 저장
- **파이프라인 구조**: `Sonagi Ops Bot` (이모지 감지) ➔ `n8n` (비즈니스 로직 및 라우팅) ➔ `Ansible Semaphore` (실제 .md 파일 생성 및 Git Push)
- **결정 사유**: 봇 코드 내부(`messageReactionAdd.ts`)에 Semaphore API 호출을 직접 구현할 수 있으나, 향후 LLM 요약 추가, 노션 동시 저장 등 파이프라인 확장성을 고려하여 **n8n을 오케스트레이터로 유지**하기로 결정함.
