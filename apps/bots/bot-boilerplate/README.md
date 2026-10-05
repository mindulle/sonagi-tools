# Sonagi Discord Bot Boilerplate

Sonagi 모노레포 내에서 새로운 디스코드 봇을 빠르게 찍어내기 위한 기본 뼈대입니다.
공통 모듈인 `@sonagi-bots/shared`를 사용하여 로깅과 커맨드 핸들링을 표준화했습니다.

## 🚀 빠른 시작 (Quick Start)

### 1. 환경 변수 설정

이 폴더 안에 있는 `.env.example`을 복사하여 `.env` 파일을 만들고, 디스코드 개발자 포털에서 발급받은 토큰과 클라이언트 ID를 입력합니다.

```env
BOT_TOKEN=당신의_봇_토큰
DISCORD_CLIENT_ID=당신의_클라이언트_ID
```

_(참고: 루트 디렉토리의 `.env`를 공통으로 사용할 수도 있습니다. `src/index.ts`의 dotenv 경로를 확인하세요.)_

### 2. 로컬 개발 실행

아래 명령어를 실행하면 봇이 켜지고 핫 리로딩 모드가 작동합니다.

```bash
pnpm --filter @sonagi-bots/boilerplate dev
```

### 3. 커맨드 추가 방법

1. `src/commands/` 폴더 안에 새로운 커맨드 파일(예: `hello.ts`)을 만듭니다.
2. `SlashCommandBuilder`를 사용해 커맨드를 정의합니다. (현재 `ping.ts` 참고)
3. `src/index.ts`에서 새로운 커맨드를 불러와 `commands` Map 객체에 추가해주면 자동으로 디스코드 길드에 배포 및 등록됩니다.

## 🏗 빌드 및 배포

```bash
pnpm --filter @sonagi-bots/boilerplate build
pnpm --filter @sonagi-bots/boilerplate start
```
