# Sonagi Obsidian Plugin (Boilerplate)

Sonagi 모노레포 내에서 Obsidian 플러그인을 개발하기 위한 기본 템플릿(보일러플레이트) 앱입니다.
루트의 pnpm 워크스페이스 설정, 린트, 타입스크립트 설정을 공유합니다.

## 🚀 빠른 시작 (Quick Start)

### 1. 로컬 Vault 설정 (Hot-Reloading)

로컬에서 플러그인을 개발할 때, 코드를 저장하면 자동으로 옵시디언 앱에 반영되도록 핫 리로딩을 설정해야 합니다.

1. 이 폴더 안에 있는 `.env.example` 파일을 복사하여 `.env` 파일을 만듭니다.
2. 테스트할 옵시디언 볼트(Vault)의 플러그인 폴더 경로를 `OBSIDIAN_VAULT_PLUGIN_DIR`에 입력합니다.

**`.env` 파일 예시:**

```env
# 마지막에 플러그인 폴더명(sonagi-obsidian-plugin)까지 포함해야 합니다.
OBSIDIAN_VAULT_PLUGIN_DIR=/Users/YourName/Documents/MyVault/.obsidian/plugins/sonagi-obsidian-plugin
```

### 2. 개발 및 빌드 명령어

모노레포 루트 또는 현재 폴더에서 다음 명령어를 사용합니다.

- **개발 모드 (Watch & Auto-copy):**

  ```bash
  pnpm --filter @sonagi/obsidian-plugin dev
  ```

  파일을 수정할 때마다 esbuild가 빠르게 재빌드하고, `.env`에 설정된 Vault 경로로 `main.js`, `manifest.json`, `styles.css`를 자동으로 복사합니다.

- **프로덕션 빌드:**
  ```bash
  pnpm --filter @sonagi/obsidian-plugin build
  ```
  배포용으로 소스맵 없이 최적화된 빌드를 수행합니다.

## 🏗️ 아키텍처 및 설정 안내 (For AI Agents)

- **빌드 시스템:** `esbuild.config.mjs`를 사용합니다. 자체 제작한 `copyToVaultPlugin`이 빌드 완료 시 `.env`의 경로로 파일을 복사합니다.
- **타입스크립트:** 루트의 `tsconfig.base.json`을 상속받습니다.
- **의존성:** `obsidian` 공식 API 패키지를 사용하며, 모노레포 환경을 위해 `pnpm workspace` 로 묶여 있습니다.
- 새로운 파일이나 기능을 추가할 때는 `src/main.ts`를 진입점(Entry Point)으로 사용하세요.
