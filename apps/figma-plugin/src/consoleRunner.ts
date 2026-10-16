import { getPortfolioLandingWireframe, renderWireframe } from './wireframe';

async function runPortfolioConsoleScript(): Promise<void> {
  try {
    console.log('🚀 [Sonagi V3] Starting Portfolio Landing Wireframe generation...');
    const wireframeNodes = getPortfolioLandingWireframe();
    await renderWireframe(wireframeNodes, 'dark');
    figma.notify('🎉 [CEO-1000] 소나기 포트폴리오 메인 랜딩 와이어프레임 생성 완료!');
    console.log('✅ Wireframe successfully rendered on Figma canvas!');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('❌ Failed to render wireframe:', err);
    figma.notify(`❌ Error: ${message}`);
  }
}

void runPortfolioConsoleScript();
