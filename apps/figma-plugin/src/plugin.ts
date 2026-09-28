figma.showUI(__html__, { width: 340, height: 500, themeColors: true });

figma.ui.onmessage = (msg) => {
  if (msg.type === 'insert-image') {
    const bytes = msg.bytes;
    
    // Create image from bytes
    const imageHash = figma.createImage(bytes).hash;
    
    // Create a rectangle to hold the image
    const rect = figma.createRectangle();
    
    // Set standard size, or try to get original image dimensions if possible
    // Figma's createImage doesn't give dimensions directly synchronously without async getImage()
    rect.resize(400, 400); 
    
    rect.fills = [{
      type: 'IMAGE',
      scaleMode: 'FIT',
      imageHash: imageHash
    }];
    
    // Place it in the center of the viewport
    rect.x = figma.viewport.center.x - (rect.width / 2);
    rect.y = figma.viewport.center.y - (rect.height / 2);
    
    figma.currentPage.appendChild(rect);
    figma.currentPage.selection = [rect];
    // We don't close plugin so user can insert multiple
  }
};
