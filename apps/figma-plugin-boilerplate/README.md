# Sonagi Figma Plugin Boilerplate

Sonagi 모노레포 내에서 새로운 Figma / FigJam 플러그인을 개발하기 위한 깨끗한 기본 뼈대입니다.

## 🛠 기술 스택

- **UI (프론트엔드):** React 19, TailwindCSS, Vite
- **Plugin Logic (백엔드):** TypeScript, esbuild, Figma Plugin API

## 🚀 빠른 시작 (Quick Start)

### 1. 개발 서버 실행 (Watch 모드)

플러그인 UI와 로직을 수정할 때마다 자동으로 빌드되도록 아래 명령어를 실행합니다.

```bash
pnpm --filter @sonagi/figma-plugin-boilerplate dev
```

(이 명령어는 UI용 Vite 서버를 띄우고, 백엔드 로직용 esbuild watch 모드를 동시에 실행합니다.)

### 2. 피그마(Figma) 앱에 플러그인 등록

1. Figma 데스크톱 앱을 엽니다.
2. 상단 메뉴에서 **Plugins > Development > Import plugin from manifest...** 를 클릭합니다.
3. 이 폴더(`apps/figma-plugin-boilerplate`) 안에 있는 `manifest.json` 파일을 선택합니다.
4. 캔버스에서 우클릭 후 **Plugins > Development > Sonagi Figma Boilerplate** 를 실행하여 테스트합니다.

### 3. 프로덕션 빌드

배포를 위한 최종 파일을 생성할 때 사용합니다.

```bash
pnpm --filter @sonagi/figma-plugin-boilerplate build
```

## 🏗 폴더 구조 안내

- `src/ui.html`, `src/App.tsx`: 피그마 화면에 띄워지는 실제 UI (React) 입니다.
- `src/plugin.ts`: 피그마 캔버스를 직접 조작하는 백엔드 로직입니다.
- 두 환경은 서로 직접 접근할 수 없으며, `parent.postMessage`와 `figma.ui.onmessage`를 통해 메시지를 주고받습니다.
