# Sonagi Design Tools (Figma Plugin)

Sonagi 생태계의 디자인 파이프라인을 자동화하고, 코드(Code)와 디자인(Figma) 간의 양방향 SSOT(Single Source of Truth)를 유지하기 위한 통합 컨트롤 타워 플러그인입니다.

## 🚀 주요 역할 (Core Features)

1. **Variables ↔ JSON 양방향 동기화**: 피그마 Variables를 W3C 포맷으로 추출하거나, 코드 측 변경 사항을 피그마에 덮어씁니다.
2. **에셋 렌더링**: Assets API를 연동해 커스텀 에셋(SVG, 이미지)을 캔버스에 직접 배치합니다.
3. **Open-Pencil (Generative Wireframe)**: 로컬 위키 컨텍스트를 이해하고 자동으로 와이어프레임을 스케치합니다.

---

## 🪄 Generative Wireframe

기존 FigJam AI의 한계를 극복하고, 우리의 기획 문서(Wiki)와 디자인 시스템을 이해하는 자체 생성형 와이어프레임 렌더러입니다.

### 아키텍처 흐름 (Architecture Flow)

1. **[사용자 입력]**: 플러그인 UI에서 위키 경로 등 프롬프트 입력
2. **[로컬 API 호출]**: 플러그인이 로컬 `CLIproxyAPI` 엔드포인트로 요청 전송
3. **[JSON AST 반환]**: 로컬 에이전트가 문서를 파싱해 `WireframeNode` 규격의 JSON 배열 반환
4. **[자동 렌더링]**: 플러그인 Sandbox가 JSON을 해석하여 Figma API(`createSection`, `createShape` 등)를 통해 캔버스에 드로잉

### 📝 JSON AST 통신 규격 (`WireframeNode` V3)

로컬 에이전트와 플러그인이 통신하는 표준 JSON 페이로드 구조입니다. AutoLayout 및 Sonagi V3 네오 브루탈리즘(2px 보더, 4px 라디우스, 8px 그리드)을 정식 지원합니다.

```typescript
type WireframeNodeType =
  'SECTION' | 'FRAME' | 'CARD' | 'BUTTON' | 'BADGE' | 'SHAPE' | 'STICKY' | 'TEXT' | 'COMPONENT';

interface WireframeNode {
  id?: string;
  type: WireframeNodeType;
  name: string;
  content?: string;
  geometry?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
  layout?: {
    direction?: 'HORIZONTAL' | 'VERTICAL' | 'NONE';
    spacing?: number;
    padding?:
      | number
      | {
          top?: number;
          right?: number;
          bottom?: number;
          left?: number;
          horizontal?: number;
          vertical?: number;
        };
    primaryAlign?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
    counterAlign?: 'MIN' | 'CENTER' | 'MAX' | 'BASELINE';
    horizontalSizing?: 'FIXED' | 'HUG' | 'FILL';
    verticalSizing?: 'FIXED' | 'HUG' | 'FILL';
    wrap?: boolean;
  };
  style?: {
    borderWidth?: number; // V3 default: 2px
    borderColor?: string; // hex or token (e.g. 'border-default', '#4A90E2')
    borderRadius?: number; // V3 default: 4px
    backgroundColor?: string; // hex or token (e.g. 'bg-base', 'bg-surface')
    fontSize?: number;
    fontWeight?: 'Regular' | 'Medium' | 'SemiBold' | 'Bold';
    textColor?: string;
    textAlign?: 'LEFT' | 'CENTER' | 'RIGHT';
  };
  v3Style?: boolean; // true면 2px 보더 및 4px 라디우스 자동 적용
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost' | 'outline' | 'dandelion';
  theme?: 'dark' | 'light';
  children?: WireframeNode[];
}
```

---

## 💻 Figma Console 1-Click 실행 (Figma 개발자도구 콘솔)

플러그인 GUI를 띄우지 않고, Figma 데스크톱 또는 브라우저 콘솔(`Ctrl+Shift+I` / `F12`)에서 직접 와이어프레임을 렌더링하려면 빌드된 콘솔 스크립트를 바로 붙여넣을 수 있습니다:

```bash
# 콘솔 스크립트 빌드
npm run build:console
# dist/figma-console-portfolio.js 내용을 Figma DevTools Console에 복사-붙여넣기
```

---

## 🛠️ 개발 및 빌드 가이드 (Development)

이 플러그인은 Vite와 React 환경으로 구성되어 있습니다. UI와 Figma Sandbox 코드가 독립적으로 빌드됩니다.

### 설치 및 실행

```bash
# 의존성 설치 (모노레포 루트 또는 플러그인 디렉토리에서)
pnpm install

# 개발 모드 (UI 및 Plugin 실시간 빌드 - Watch 모드)
npm run dev

# 프로덕션 빌드
npm run build
```

### Figma에 플러그인 연결하기

1. Figma 데스크톱 앱 실행
2. 메뉴 > `Plugins` > `Development` > `Import plugin from manifest...`
3. `apps/figma-plugin/manifest.json` 파일 선택
