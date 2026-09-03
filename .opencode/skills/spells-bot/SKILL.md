# Spells Bot - Infra & DevOps Agent Skill

이 문서는 `spells-bot` 저장소에서 작업할 때 AI 에이전트(Opencode 등)가 준수해야 할 가이드라인입니다.

## 1. 프로젝트 정체성

- `spells-bot`은 Sonagi 생태계의 **인프라 관제 및 DevOps 유틸리티 봇**입니다.
- 주요 목적: K3s 상태 확인, n8n 파이프라인 헬스체크, MinIO 기반 CDN 및 스토리지 제어, Eagle Gallery 레퍼런스 조회.

## 2. 디렉토리 구조 및 컨벤션

- **`src/commands/infra/`**: K3s, n8n 등 내부 인프라 상태 제어 및 조회 (`/infra`)
- **`src/commands/cdn/`**: MinIO 스토리지 연동, 버킷 상태 및 파일 관리 (`/cdn`)
- **`src/commands/gallery/`**: Eagle API 연동 디자인/레퍼런스 검색 (`/gallery`)
- **`src/services/`**: 각 도메인별 API 통신 로직 격리 (`minio.service.ts`, `k3s.service.ts`, `eagle.service.ts` 등)

## 3. 코드 컨벤션

- **TypeScript & Discord.js v14**: 모든 명령어는 `SlashCommandBuilder`를 사용합니다.
- **Git Hooks**: `husky`와 `lint-staged`가 구성되어 있습니다. 커밋 시 자동으로 ESLint와 Prettier가 실행됩니다.
- **비동기 처리**: Promise 반환 시 불필요한 `async`를 피하고, Floating Promise가 발생하지 않도록 `void` 또는 `await`를 명시적으로 사용합니다.

## 4. 커맨드 구현 패턴

명령어는 항상 다음 인터페이스를 따릅니다:

```typescript
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '../../types/commands';

export const commandName: Command = {
  data: new SlashCommandBuilder().setName('name').setDescription('description'),
  async execute(interaction: ChatInputCommandInteraction) {
    // 로직
  },
};
```

## 5. 지식 위키 조회 규칙 (Knowledge Wiki Lookup)

인프라 구성, 봇 명세, 또는 팀 내 표준 절차에 대한 맥락이 필요할 때 **반드시** 위키를 먼저 조회하십시오.

```bash
# ripgrep(rg)을 사용한 개발/인프라 개념 검색 (대소문자 무시)
rg -i "<검색할 개념>" /home/ubuntu/llm-wiki/20_Wiki/Develop/ /home/ubuntu/llm-wiki/20_Wiki/_concepts/
```
