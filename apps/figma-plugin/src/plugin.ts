figma.showUI(__html__, { width: 340, height: 600, themeColors: true });

figma.ui.onmessage = (msg) => {
  if (msg.type === 'insert-image') {
    const bytes = msg.bytes;
    
    // Create image from bytes
    const imageHash = figma.createImage(bytes).hash;
    
    // Create a rectangle to hold the image
    const rect = figma.createRectangle();
    rect.resize(400, 400); 
    
    rect.fills = [{
      type: 'IMAGE',
      scaleMode: 'FIT',
      imageHash: imageHash
    }];
    
    rect.x = figma.viewport.center.x - (rect.width / 2);
    rect.y = figma.viewport.center.y - (rect.height / 2);
    
    figma.currentPage.appendChild(rect);
    figma.currentPage.selection = [rect];
  } 
  else if (msg.type === 'insert-svg') {
    const svgText = msg.svg;
    const node = figma.createNodeFromSvg(svgText);
    
    node.x = figma.viewport.center.x - (node.width / 2);
    node.y = figma.viewport.center.y - (node.height / 2);
    
    figma.currentPage.appendChild(node);
    figma.currentPage.selection = [node];
  }
};
