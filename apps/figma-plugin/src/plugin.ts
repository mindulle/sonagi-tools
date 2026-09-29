import { exportTokens, importTokens } from './tokens';

figma.showUI(__html__, { width: 340, height: 600, themeColors: true });

// Send initial selection
function sendSelection() {
  const selection = figma.currentPage.selection;
  const texts = selection
    .map((node) => {
      if (node.type === 'TEXT') return node.characters;
      if (node.type === 'STICKY') return node.text.characters;
      if (node.type === 'SHAPE_WITH_TEXT') return node.text.characters;
      return null;
    })
    .filter(Boolean);

  figma.ui.postMessage({ type: 'selection-updated', texts });
}

figma.on('selectionchange', sendSelection);

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'insert-image') {
    const bytes = msg.bytes;
    const imageHash = figma.createImage(bytes).hash;
    const rect = figma.createRectangle();
    rect.resize(400, 400);
    rect.fills = [{ type: 'IMAGE', scaleMode: 'FIT', imageHash: imageHash }];
    rect.x = figma.viewport.center.x - rect.width / 2;
    rect.y = figma.viewport.center.y - rect.height / 2;
    figma.currentPage.appendChild(rect);
    figma.currentPage.selection = [rect];
  } else if (msg.type === 'insert-svg') {
    const svgText = msg.svg;
    const node = figma.createNodeFromSvg(svgText);
    node.x = figma.viewport.center.x - node.width / 2;
    node.y = figma.viewport.center.y - node.height / 2;
    figma.currentPage.appendChild(node);
    figma.currentPage.selection = [node];
  } else if (msg.type === 'create-sticky') {
    // Requires FigJam, or gracefully fail in Figma
    if (figma.editorType === 'figjam') {
      const sticky = figma.createSticky();
      sticky.text.characters = msg.text;
      sticky.x = figma.viewport.center.x;
      sticky.y = figma.viewport.center.y;
      figma.currentPage.appendChild(sticky);
      figma.currentPage.selection = [sticky];
      figma.viewport.scrollAndZoomIntoView([sticky]);
    } else {
      // Fallback for normal Figma
      const text = figma.createText();
      await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
      text.characters = msg.text;
      text.x = figma.viewport.center.x;
      text.y = figma.viewport.center.y;
      figma.currentPage.appendChild(text);
      figma.currentPage.selection = [text];
    }
  } else if (msg.type === 'create-wireframe') {
    // Generate simple wireframe boxes based on AI JSON
    const layout = msg.layout; // Array of { name, w, h }
    const nodes: SceneNode[] = [];
    let currentY = figma.viewport.center.y;
    const startX = figma.viewport.center.x;

    await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });

    for (const item of layout) {
      const frame = figma.createFrame();
      frame.resize(item.w || 300, item.h || 100);
      frame.x = startX;
      frame.y = currentY;
      frame.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.9, b: 0.9 } }];
      frame.strokes = [{ type: 'SOLID', color: { r: 0.6, g: 0.6, b: 0.6 } }];

      const text = figma.createText();
      text.characters = item.name;
      text.fontSize = 16;
      frame.appendChild(text);
      text.x = (frame.width - text.width) / 2;
      text.y = (frame.height - text.height) / 2;

      figma.currentPage.appendChild(frame);
      nodes.push(frame);
      currentY += frame.height + 20;
    }

    figma.currentPage.selection = nodes;
    figma.viewport.scrollAndZoomIntoView(nodes);
  } else if (msg.type === 'get-github-config') {
    const config = await figma.clientStorage.getAsync('github-config');
    figma.ui.postMessage({ type: 'github-config-loaded', config });
  } else if (msg.type === 'set-github-config') {
    await figma.clientStorage.setAsync('github-config', msg.config);
  } else if (msg.type === 'export-tokens') {
    try {
      const tokens = exportTokens();
      figma.ui.postMessage({ type: 'export-tokens-result', payload: tokens });
    } catch (e: any) {
      figma.ui.postMessage({ type: 'error', message: e.message });
    }
  } else if (msg.type === 'import-tokens') {
    try {
      importTokens(msg.payload);
    } catch (e: any) {
      figma.ui.postMessage({ type: 'error', message: e.message });
    }
  } else if (msg.type === 'export-svgs') {
    try {
      const selection = figma.currentPage.selection;
      let nodesToExport: SceneNode[] = [];

      if (selection.length > 0) {
        nodesToExport = selection.filter(
          (n) =>
            n.type === 'COMPONENT' ||
            n.type === 'INSTANCE' ||
            n.type === 'FRAME' ||
            n.type === 'VECTOR'
        ) as SceneNode[];
      } else {
        nodesToExport = figma.currentPage.findAll((n) => n.type === 'COMPONENT') as SceneNode[];
      }

      if (nodesToExport.length === 0) {
        throw new Error('No components found to export. Please select the icons.');
      }

      const results = [];
      for (const node of nodesToExport) {
        const svgBytes = await node.exportAsync({ format: 'SVG' });
        let svgString = '';
        for (let i = 0; i < svgBytes.length; i++) {
          svgString += String.fromCharCode(svgBytes[i]);
        }

        // Clean name to be a valid React Component name (e.g. "Icon / Home" -> "IconHome")
        let cleanName = node.name.replace(/[^a-zA-Z0-9]/g, '');
        // Capitalize first letter just in case
        cleanName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
        // Fallback name if it becomes empty
        if (!cleanName) cleanName = 'Icon' + Math.floor(Math.random() * 1000);

        results.push({ name: cleanName, svg: svgString });
      }

      figma.ui.postMessage({ type: 'export-svgs-result', payload: results });
    } catch (e: any) {
      figma.ui.postMessage({ type: 'error', message: e.message });
    }
  }
};
