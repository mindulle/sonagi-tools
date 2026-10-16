export type WireframeNodeType =
  'SECTION' | 'FRAME' | 'CARD' | 'BUTTON' | 'BADGE' | 'SHAPE' | 'STICKY' | 'TEXT' | 'COMPONENT';

export type LayoutDirection = 'HORIZONTAL' | 'VERTICAL' | 'NONE';
export type PrimaryAlign = 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
export type CounterAlign = 'MIN' | 'CENTER' | 'MAX' | 'BASELINE';
export type SizingMode = 'FIXED' | 'HUG' | 'FILL';

export interface LayoutConfig {
  direction?: LayoutDirection;
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
  primaryAlign?: PrimaryAlign;
  counterAlign?: CounterAlign;
  wrap?: boolean;
  horizontalSizing?: SizingMode;
  verticalSizing?: SizingMode;
}

export interface StyleConfig {
  borderWidth?: number; // V3 default: 2px
  borderColor?: string; // hex or semantic name
  borderRadius?: number; // V3 default: 4px
  backgroundColor?: string; // hex or semantic name
  opacity?: number;
  // Typography
  fontSize?: number;
  fontWeight?: 'Regular' | 'Medium' | 'SemiBold' | 'Bold';
  textColor?: string;
  textAlign?: 'LEFT' | 'CENTER' | 'RIGHT';
  lineHeight?: number;
}

export interface WireframeNode {
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
  layout?: LayoutConfig;
  style?: StyleConfig;
  v3Style?: boolean; // When true or default for UI primitives, applies V3 aesthetics
  theme?: 'dark' | 'light';
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost' | 'outline' | 'surface' | 'dandelion';
  color?: string; // semantic name or hex shortcut
  componentKey?: string;
  props?: Record<string, string>;
  children?: WireframeNode[];
}

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

// Sonagi Design System V3 Color Palette (OKLCH derived & WCAG verified)
export const SONAGI_V3_PALETTE: Record<string, { light: string; dark: string }> = {
  // Brand
  'brand-primary': { light: '#47211b', dark: '#d2645f' },
  'brand-accent': { light: '#d2645f', dark: '#e5867f' },
  rain: { light: '#4A90E2', dark: '#4A90E2' }, // Wild Sonagi rain blue
  cyan: { light: '#00ffcc', dark: '#00ffcc' },
  dandelion: { light: '#ffd166', dark: '#ffd166' }, // Warm dandelion yellow
  ink: { light: '#1e1311', dark: '#0a1128' },

  // Background
  'bg-base': { light: '#fcf2f0', dark: '#0d1117' },
  'bg-surface': { light: '#f5e5e2', dark: '#161b22' },
  'bg-elevated': { light: '#fefaf9', dark: '#21262d' },
  'bg-dark': { light: '#0d1117', dark: '#0d1117' },
  'bg-black': { light: '#05070a', dark: '#05070a' },
  'bg-white': { light: '#ffffff', dark: '#ffffff' },

  // Text
  'text-primary': { light: '#1e1311', dark: '#f0f6fc' },
  'text-secondary': { light: '#614f4b', dark: '#8b949e' },
  'text-muted': { light: '#756563', dark: '#6e7681' },
  'text-inverse': { light: '#fcf2f0', dark: '#0d1117' },

  // Border
  'border-default': { light: '#1e1311', dark: '#30363d' },
  'border-strong': { light: '#1e1311', dark: '#f0f6fc' },
  'border-subtle': { light: '#d7c5c2', dark: '#21262d' },
  'border-brand': { light: '#47211b', dark: '#d2645f' },
  'border-rain': { light: '#4A90E2', dark: '#4A90E2' },
};

export function hexToRgb(hex: string): RGBColor {
  let cleaned = hex.replace('#', '').trim();
  if (cleaned.length === 3) {
    cleaned = cleaned
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (cleaned.length === 8) {
    cleaned = cleaned.slice(0, 6);
  }
  const num = parseInt(cleaned, 16);
  if (isNaN(num)) {
    return { r: 0.5, g: 0.5, b: 0.5 };
  }
  return {
    r: ((num >> 16) & 255) / 255,
    g: ((num >> 8) & 255) / 255,
    b: (num & 255) / 255,
  };
}

export function resolveColor(colorStr?: string, theme: 'dark' | 'light' = 'dark'): RGBColor {
  if (!colorStr) {
    return theme === 'dark' ? { r: 0.1, g: 0.1, b: 0.12 } : { r: 0.95, g: 0.95, b: 0.95 };
  }

  if (colorStr.startsWith('#')) {
    return hexToRgb(colorStr);
  }

  const token = SONAGI_V3_PALETTE[colorStr];
  if (token) {
    return hexToRgb(token[theme]);
  }

  // Common color aliases
  const aliases: Record<string, string> = {
    gray: '#8b949e',
    blue: '#4A90E2',
    orange: '#d2645f',
    green: '#2ea043',
    yellow: '#ffd166',
    white: '#ffffff',
    black: '#000000',
    purple: '#a855f7',
  };

  if (aliases[colorStr]) {
    return hexToRgb(aliases[colorStr]);
  }

  return { r: 0.5, g: 0.5, b: 0.5 };
}

// Preload typography styles
export async function preloadFonts() {
  const styles = ['Regular', 'Medium', 'SemiBold', 'Bold'];
  for (const style of styles) {
    try {
      await figma.loadFontAsync({ family: 'Inter', style });
    } catch (e) {
      // Fallback: Inter Regular should always be loaded
      try {
        await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
      } catch (_) {
        // Ignore fallback font error
      }
    }
  }
}

export async function renderWireframe(
  nodes: WireframeNode[],
  defaultTheme: 'dark' | 'light' = 'dark'
) {
  await preloadFonts();

  const createdNodes: SceneNode[] = [];

  for (const node of nodes) {
    const figmaNode = await createNodeRecursively(node, defaultTheme);
    if (figmaNode) {
      figma.currentPage.appendChild(figmaNode);
      createdNodes.push(figmaNode);
    }
  }

  if (createdNodes.length > 0) {
    figma.currentPage.selection = createdNodes;
    figma.viewport.scrollAndZoomIntoView(createdNodes);
  }
}

async function createNodeRecursively(
  node: WireframeNode,
  parentTheme: 'dark' | 'light'
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
): Promise<SceneNode | null> {
  const theme = node.theme || parentTheme;
  const isV3 = node.v3Style !== false;
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  let figmaNode: SceneNode | null = null;

  switch (node.type) {
    case 'SECTION': {
      // If layout is specified, use a Frame so AutoLayout works seamlessly.
      // Otherwise fallback to Figma SectionNode.
      if (node.layout && node.layout.direction && node.layout.direction !== 'NONE') {
        const frame = figma.createFrame();
        frame.name = node.name;
        applyAutoLayout(frame, node.layout);
        applyStyles(frame, node, theme, isV3);
        figmaNode = frame;
      } else {
        try {
          const section = figma.createSection();
          section.name = node.name;
          const w = node.geometry?.width || 1440;
          const h = node.geometry?.height || 800;
          section.resize(w, h);
          figmaNode = section;
        } catch (e) {
          const frame = figma.createFrame();
          frame.name = node.name;
          applyStyles(frame, node, theme, isV3);
          figmaNode = frame;
        }
      }
      break;
    }

    case 'FRAME':
    case 'CARD': {
      const frame = figma.createFrame();
      frame.name = node.name;

      // Card defaults in Sonagi V3
      if (node.type === 'CARD') {
        const cardLayout: LayoutConfig = {
          direction: 'VERTICAL',
          spacing: 16,
          padding: 24,
          primaryAlign: 'MIN',
          counterAlign: 'MIN',
          ...node.layout,
        };
        applyAutoLayout(frame, cardLayout);

        // Card styling defaults
        const cardStyle: StyleConfig = {
          borderWidth: isV3 ? 2 : 1,
          borderColor: theme === 'dark' ? 'border-default' : 'border-default',
          borderRadius: isV3 ? 4 : 8,
          backgroundColor: node.color || node.style?.backgroundColor || 'bg-surface',
          ...node.style,
        };
        applyCustomStyles(frame, cardStyle, theme);
      } else {
        if (node.layout && node.layout.direction && node.layout.direction !== 'NONE') {
          applyAutoLayout(frame, node.layout);
        }
        applyStyles(frame, node, theme, isV3);
      }

      // Explicit geometry dimensions if provided and not auto-hugged
      if (node.geometry?.width && node.geometry?.height) {
        frame.resize(node.geometry.width, node.geometry.height);
      }
      figmaNode = frame;
      break;
    }

    case 'BUTTON': {
      const frame = figma.createFrame();
      frame.name = node.name || 'Button';

      const buttonLayout: LayoutConfig = {
        direction: 'HORIZONTAL',
        spacing: 8,
        padding: { horizontal: 20, vertical: 12 },
        primaryAlign: 'CENTER',
        counterAlign: 'CENTER',
        ...node.layout,
      };
      applyAutoLayout(frame, buttonLayout);

      const variant = node.variant || 'primary';
      let bgColor = 'brand-primary';
      let textColor = 'text-inverse';
      let borderColor = 'border-default';

      if (variant === 'primary') {
        bgColor = theme === 'dark' ? '#d2645f' : '#47211b';
        textColor = '#ffffff';
        borderColor = theme === 'dark' ? '#f0f6fc' : '#1e1311';
      } else if (variant === 'accent' || variant === 'dandelion') {
        bgColor = variant === 'dandelion' ? '#ffd166' : '#4A90E2';
        textColor = '#000000';
        borderColor = theme === 'dark' ? '#ffffff' : '#1e1311';
      } else if (variant === 'outline' || variant === 'secondary') {
        bgColor = 'transparent';
        textColor = theme === 'dark' ? '#f0f6fc' : '#1e1311';
        borderColor = theme === 'dark' ? '#30363d' : '#1e1311';
      } else if (variant === 'ghost') {
        bgColor = 'transparent';
        textColor = theme === 'dark' ? '#8b949e' : '#614f4b';
        borderColor = theme === 'dark' ? '#21262d' : '#d7c5c2';
      }

      const buttonStyle: StyleConfig = {
        borderWidth: isV3 ? 2 : 1,
        borderColor: node.style?.borderColor || borderColor,
        borderRadius: isV3 ? 4 : 6,
        backgroundColor: node.style?.backgroundColor || bgColor,
        ...node.style,
      };
      applyCustomStyles(frame, buttonStyle, theme);

      // Create button label
      const text = figma.createText();
      text.name = 'Label';
      text.characters = node.content || node.name;
      text.fontSize = node.style?.fontSize || 14;
      try {
        text.fontName = { family: 'Inter', style: 'SemiBold' };
      } catch (_) {
        // Ignore fallback font error
      }
      const txtRgb = resolveColor(node.style?.textColor || textColor, theme);
      text.fills = [{ type: 'SOLID', color: txtRgb }];
      frame.appendChild(text);

      figmaNode = frame;
      break;
    }

    case 'BADGE': {
      const frame = figma.createFrame();
      frame.name = node.name || 'Badge';

      const badgeLayout: LayoutConfig = {
        direction: 'HORIZONTAL',
        spacing: 6,
        padding: { horizontal: 10, vertical: 4 },
        primaryAlign: 'CENTER',
        counterAlign: 'CENTER',
        ...node.layout,
      };
      applyAutoLayout(frame, badgeLayout);

      const variant = node.variant || 'outline';
      let bgColor = 'transparent';
      let textColor = 'text-primary';
      let borderColor = 'border-default';

      if (variant === 'accent') {
        bgColor = '#00ffcc';
        textColor = '#000000';
        borderColor = '#00ffcc';
      } else if (variant === 'dandelion') {
        bgColor = '#ffd166';
        textColor = '#000000';
        borderColor = '#ffd166';
      } else {
        borderColor = theme === 'dark' ? '#00ffcc' : '#47211b';
        textColor = theme === 'dark' ? '#00ffcc' : '#47211b';
      }

      const badgeStyle: StyleConfig = {
        borderWidth: isV3 ? 2 : 1,
        borderColor: node.style?.borderColor || borderColor,
        borderRadius: 9999, // Pill shape
        backgroundColor: node.style?.backgroundColor || bgColor,
        ...node.style,
      };
      applyCustomStyles(frame, badgeStyle, theme);

      const text = figma.createText();
      text.name = 'BadgeText';
      text.characters = node.content || node.name;
      text.fontSize = node.style?.fontSize || 12;
      try {
        text.fontName = { family: 'Inter', style: 'Bold' };
      } catch (_) {
        // Ignore fallback font error
      }
      const txtRgb = resolveColor(node.style?.textColor || textColor, theme);
      text.fills = [{ type: 'SOLID', color: txtRgb }];
      frame.appendChild(text);

      figmaNode = frame;
      break;
    }

    case 'TEXT': {
      const text = figma.createText();
      text.name = node.name;
      text.characters = node.content || node.name;
      text.fontSize = node.style?.fontSize || 16;

      const weight = node.style?.fontWeight || 'Regular';
      try {
        text.fontName = { family: 'Inter', style: weight };
      } catch (e) {
        try {
          text.fontName = { family: 'Inter', style: 'Regular' };
        } catch (_) {
          // Ignore fallback font error
        }
      }

      if (node.style?.textAlign) {
        text.textAlignHorizontal = node.style.textAlign;
      }

      const txtColor = resolveColor(
        node.style?.textColor || (theme === 'dark' ? 'text-primary' : 'text-primary'),
        theme
      );
      text.fills = [{ type: 'SOLID', color: txtColor }];

      if (node.geometry?.width) {
        text.resize(node.geometry.width, text.height);
      }
      figmaNode = text;
      break;
    }

    case 'SHAPE': {
      if (figma.editorType === 'figjam') {
        const shape = figma.createShapeWithText();
        shape.name = node.name;
        shape.shapeType = 'SQUARE';
        shape.resize(node.geometry?.width || 200, node.geometry?.height || 200);
        if (node.content) shape.text.characters = node.content;
        const color = resolveColor(node.color || node.style?.backgroundColor, theme);
        shape.fills = [{ type: 'SOLID', color }];
        figmaNode = shape;
      } else {
        const frame = figma.createFrame();
        frame.name = node.name;
        frame.resize(node.geometry?.width || 200, node.geometry?.height || 200);
        applyStyles(frame, node, theme, isV3);
        if (node.content) {
          const text = figma.createText();
          text.characters = node.content;
          text.fontSize = 14;
          frame.appendChild(text);
          text.x = 16;
          text.y = 16;
        }
        figmaNode = frame;
      }
      break;
    }

    case 'STICKY': {
      if (figma.editorType === 'figjam') {
        const sticky = figma.createSticky();
        sticky.name = node.name;
        if (node.content) sticky.text.characters = node.content;
        figmaNode = sticky;
      } else {
        const frame = figma.createFrame();
        frame.name = node.name;
        frame.resize(node.geometry?.width || 240, node.geometry?.height || 240);
        frame.fills = [{ type: 'SOLID', color: { r: 1, g: 0.9, b: 0.6 } }];
        if (isV3) {
          frame.cornerRadius = 4;
          frame.strokeWeight = 2;
          frame.strokes = [{ type: 'SOLID', color: { r: 0.2, g: 0.2, b: 0.2 } }];
        }
        if (node.content) {
          const text = figma.createText();
          text.characters = node.content;
          text.fontSize = 14;
          text.x = 16;
          text.y = 16;
          frame.appendChild(text);
        }
        figmaNode = frame;
      }
      break;
    }

    case 'COMPONENT': {
      if (!node.componentKey) {
        console.error('Component node is missing componentKey');
        break;
      }
      try {
        const component = await figma.importComponentByKeyAsync(node.componentKey);
        const instance = component.createInstance();
        instance.name = node.name;
        if (node.geometry?.width && node.geometry?.height) {
          instance.resize(node.geometry.width, node.geometry.height);
        }
        if (node.props) {
          instance.setProperties(node.props);
        }
        figmaNode = instance;
      } catch (err) {
        console.error('Failed to import component:', err);
        const fallback = figma.createFrame();
        fallback.name = `Missing: ${node.name}`;
        fallback.resize(node.geometry?.width || 200, node.geometry?.height || 60);
        fallback.fills = [{ type: 'SOLID', color: { r: 1, g: 0.8, b: 0.8 } }];
        if (isV3) {
          fallback.strokeWeight = 2;
          fallback.strokes = [{ type: 'SOLID', color: { r: 0.8, g: 0.2, b: 0.2 } }];
          fallback.cornerRadius = 4;
        }
        figmaNode = fallback;
      }
      break;
    }
  }

  if (figmaNode) {
    if (node.geometry?.x !== undefined) figmaNode.x = node.geometry.x;
    if (node.geometry?.y !== undefined) figmaNode.y = node.geometry.y;

    // Recursively handle children
    if (node.children && node.children.length > 0 && 'appendChild' in figmaNode) {
      const parentFrame = figmaNode as FrameNode;
      const isAutoLayout = parentFrame.layoutMode && parentFrame.layoutMode !== 'NONE';

      for (const child of node.children) {
        const figmaChild = await createNodeRecursively(child, theme);
        if (figmaChild) {
          parentFrame.appendChild(figmaChild);

          if (!isAutoLayout) {
            // Absolute positioning inside non-autolayout frame
            if (child.geometry?.x !== undefined && node.geometry?.x !== undefined) {
              figmaChild.x = child.geometry.x - node.geometry.x;
            }
            if (child.geometry?.y !== undefined && node.geometry?.y !== undefined) {
              figmaChild.y = child.geometry.y - node.geometry.y;
            }
          } else {
            // Child AutoLayout constraints
            applyChildLayoutConstraints(parentFrame, figmaChild, child);
          }
        }
      }
    }
  }

  return figmaNode;
}

function applyAutoLayout(frame: FrameNode, layout: LayoutConfig) {
  frame.layoutMode = layout.direction || 'VERTICAL';

  if (layout.spacing !== undefined) {
    frame.itemSpacing = layout.spacing;
  }

  if (layout.padding !== undefined) {
    if (typeof layout.padding === 'number') {
      frame.paddingTop = layout.padding;
      frame.paddingRight = layout.padding;
      frame.paddingBottom = layout.padding;
      frame.paddingLeft = layout.padding;
    } else {
      const top = layout.padding.top ?? layout.padding.vertical ?? 0;
      const bottom = layout.padding.bottom ?? layout.padding.vertical ?? 0;
      const left = layout.padding.left ?? layout.padding.horizontal ?? 0;
      const right = layout.padding.right ?? layout.padding.horizontal ?? 0;
      frame.paddingTop = top;
      frame.paddingRight = right;
      frame.paddingBottom = bottom;
      frame.paddingLeft = left;
    }
  }

  if (layout.primaryAlign) {
    frame.primaryAxisAlignItems = layout.primaryAlign;
  }
  if (layout.counterAlign) {
    frame.counterAxisAlignItems = layout.counterAlign;
  }
  if (layout.wrap) {
    frame.layoutWrap = 'WRAP';
  }

  // Sizing mode (HUG vs FIXED)
  if (layout.horizontalSizing) {
    if (layout.direction === 'HORIZONTAL') {
      frame.primaryAxisSizingMode = layout.horizontalSizing === 'HUG' ? 'AUTO' : 'FIXED';
    } else {
      frame.counterAxisSizingMode = layout.horizontalSizing === 'HUG' ? 'AUTO' : 'FIXED';
    }
  }
  if (layout.verticalSizing) {
    if (layout.direction === 'VERTICAL') {
      frame.primaryAxisSizingMode = layout.verticalSizing === 'HUG' ? 'AUTO' : 'FIXED';
    } else {
      frame.counterAxisSizingMode = layout.verticalSizing === 'HUG' ? 'AUTO' : 'FIXED';
    }
  }
}

function applyChildLayoutConstraints(
  parent: FrameNode,
  childNode: SceneNode,
  childConfig: WireframeNode
) {
  const hSizing = childConfig.layout?.horizontalSizing;
  const vSizing = childConfig.layout?.verticalSizing;

  if ('layoutGrow' in childNode && 'layoutAlign' in childNode) {
    if (parent.layoutMode === 'HORIZONTAL') {
      if (hSizing === 'FILL') (childNode as any).layoutGrow = 1;
      if (vSizing === 'FILL') (childNode as any).layoutAlign = 'STRETCH';
    } else if (parent.layoutMode === 'VERTICAL') {
      if (vSizing === 'FILL') (childNode as any).layoutGrow = 1;
      if (hSizing === 'FILL') (childNode as any).layoutAlign = 'STRETCH';
    }
  }

  try {
    if (hSizing && 'layoutSizingHorizontal' in childNode) {
      (childNode as any).layoutSizingHorizontal = hSizing;
    }
    if (vSizing && 'layoutSizingVertical' in childNode) {
      (childNode as any).layoutSizingVertical = vSizing;
    }
  } catch (_) {
    // Ignore layout sizing fallback errors
  }
}

function applyStyles(
  node: FrameNode,
  config: WireframeNode,
  theme: 'dark' | 'light',
  isV3: boolean
) {
  const customStyle: StyleConfig = {
    borderWidth: config.style?.borderWidth ?? (isV3 ? 2 : 0),
    borderColor:
      config.style?.borderColor || (theme === 'dark' ? 'border-default' : 'border-default'),
    borderRadius: config.style?.borderRadius ?? (isV3 ? 4 : 0),
    backgroundColor:
      config.color || config.style?.backgroundColor || (theme === 'dark' ? 'bg-base' : 'bg-base'),
    ...config.style,
  };
  applyCustomStyles(node, customStyle, theme);
}

function applyCustomStyles(node: FrameNode, style: StyleConfig, theme: 'dark' | 'light') {
  // Fills / Background
  if (style.backgroundColor && style.backgroundColor !== 'transparent') {
    const bgRgb = resolveColor(style.backgroundColor, theme);
    node.fills = [{ type: 'SOLID', color: bgRgb, opacity: style.opacity ?? 1 }];
  } else if (style.backgroundColor === 'transparent') {
    node.fills = [];
  }

  // Border / Strokes
  const borderWidth = style.borderWidth ?? 0;
  if (borderWidth > 0) {
    node.strokeWeight = borderWidth;
    const borderRgb = resolveColor(style.borderColor || 'border-default', theme);
    node.strokes = [{ type: 'SOLID', color: borderRgb }];
  } else {
    node.strokes = [];
  }

  // Corner Radius
  if (style.borderRadius !== undefined) {
    node.cornerRadius = style.borderRadius;
  }
}

// -------------------------------------------------------------
// [CEO-1000] Portfolio Main Landing Wireframe Preset AST
// -------------------------------------------------------------
export function getPortfolioLandingWireframe(): WireframeNode[] {
  return [
    {
      id: 'portfolio-landing-root',
      type: 'FRAME',
      name: 'Sonagi Portfolio Landing (CEO-1000)',
      theme: 'dark',
      v3Style: true,
      geometry: { width: 1440, height: 3200 },
      layout: {
        direction: 'VERTICAL',
        spacing: 0,
        padding: 0,
        horizontalSizing: 'FIXED',
        verticalSizing: 'HUG',
      },
      style: {
        backgroundColor: '#060911',
      },
      children: [
        // 1. Navigation Header
        {
          id: 'nav-header',
          type: 'FRAME',
          name: '00. Navigation Bar',
          geometry: { width: 1440, height: 72 },
          layout: {
            direction: 'HORIZONTAL',
            spacing: 32,
            padding: { horizontal: 64, vertical: 16 },
            primaryAlign: 'SPACE_BETWEEN',
            counterAlign: 'CENTER',
            horizontalSizing: 'FILL',
          },
          style: {
            backgroundColor: '#090d16',
            borderWidth: 2,
            borderColor: '#1e2430',
          },
          children: [
            // Brand Logo
            {
              type: 'FRAME',
              name: 'Logo Group',
              layout: { direction: 'HORIZONTAL', spacing: 8, counterAlign: 'CENTER' },
              style: { backgroundColor: 'transparent' },
              children: [
                {
                  type: 'TEXT',
                  name: 'Wordmark',
                  content: '소나기 .',
                  style: { fontSize: 20, fontWeight: 'Bold', textColor: '#ffffff' },
                },
                {
                  type: 'BADGE',
                  name: 'Version Badge',
                  content: 'V3.0 Wild',
                  variant: 'accent',
                },
              ],
            },
            // Nav Links
            {
              type: 'FRAME',
              name: 'Nav Links',
              layout: { direction: 'HORIZONTAL', spacing: 24, counterAlign: 'CENTER' },
              style: { backgroundColor: 'transparent' },
              children: [
                {
                  type: 'TEXT',
                  name: 'Link 1',
                  content: 'About',
                  style: { fontSize: 14, textColor: '#8b949e' },
                },
                {
                  type: 'TEXT',
                  name: 'Link 2',
                  content: 'Philosophy',
                  style: { fontSize: 14, textColor: '#8b949e' },
                },
                {
                  type: 'TEXT',
                  name: 'Link 3',
                  content: 'Bento Lab',
                  style: { fontSize: 14, textColor: '#8b949e' },
                },
                {
                  type: 'TEXT',
                  name: 'Link 4',
                  content: 'Showroom',
                  style: { fontSize: 14, textColor: '#8b949e' },
                },
                {
                  type: 'TEXT',
                  name: 'Link 5',
                  content: 'Tokens',
                  style: { fontSize: 14, textColor: '#8b949e' },
                },
              ],
            },
            // Right CTA
            {
              type: 'FRAME',
              name: 'Nav Actions',
              layout: { direction: 'HORIZONTAL', spacing: 12, counterAlign: 'CENTER' },
              style: { backgroundColor: 'transparent' },
              children: [
                {
                  type: 'BUTTON',
                  name: 'GitHub Button',
                  content: 'GitHub',
                  variant: 'outline',
                },
                {
                  type: 'BUTTON',
                  name: 'Showroom Button',
                  content: 'Explore Showroom',
                  variant: 'accent',
                },
              ],
            },
          ],
        },

        // 2. Hero Section (소나기 Wild)
        {
          id: 'section-hero',
          type: 'FRAME',
          name: '01. Hero Section - Wild & Thin (소나기)',
          geometry: { width: 1440, height: 760 },
          layout: {
            direction: 'VERTICAL',
            spacing: 32,
            padding: { horizontal: 80, vertical: 80 },
            primaryAlign: 'CENTER',
            counterAlign: 'CENTER',
            horizontalSizing: 'FILL',
          },
          style: {
            backgroundColor: '#070a12',
            borderWidth: 2,
            borderColor: '#1e2430',
          },
          children: [
            {
              type: 'BADGE',
              name: 'Hero Eyebrow',
              content: 'SONAGI DESIGN SYSTEM & PORTFOLIO SHOWROOM',
              variant: 'accent',
            },
            {
              type: 'TEXT',
              name: 'Hero Headline',
              content: 'Wild & Thin.',
              style: {
                fontSize: 72,
                fontWeight: 'Bold',
                textColor: '#ffffff',
                textAlign: 'CENTER',
              },
            },
            {
              type: 'TEXT',
              name: 'Hero Subtitle',
              content:
                '얼어붙은 땅을 깨우는 벼락같은 몰입(Wild)과 콘크리트 틈에서 피어나는 다정함(Thin)',
              style: {
                fontSize: 22,
                fontWeight: 'Medium',
                textColor: '#8b949e',
                textAlign: 'CENTER',
              },
            },
            // 3D Canvas Mockup Frame (Three.js & Theatre.js)
            {
              type: 'CARD',
              name: '3D Canvas Metaphor Box (Three.js / Theatre.js)',
              geometry: { width: 960, height: 260 },
              layout: {
                direction: 'VERTICAL',
                spacing: 12,
                padding: 24,
                primaryAlign: 'CENTER',
                counterAlign: 'CENTER',
              },
              style: {
                backgroundColor: '#04060b',
                borderWidth: 2,
                borderColor: '#4A90E2',
                borderRadius: 4,
              },
              children: [
                {
                  type: 'TEXT',
                  name: 'Canvas Label',
                  content: '💧 Interactive 3D Sphere / Rain Ripple Particles (GPU Canvas)',
                  style: { fontSize: 18, fontWeight: 'SemiBold', textColor: '#4A90E2' },
                },
                {
                  type: 'TEXT',
                  name: 'Canvas Hint',
                  content: 'Drag to rotate 3D camera / Spacebar to trigger rain pulse',
                  style: { fontSize: 13, textColor: '#6e7681' },
                },
              ],
            },
            // CTA Button Group
            {
              type: 'FRAME',
              name: 'Hero CTA Group',
              layout: {
                direction: 'HORIZONTAL',
                spacing: 16,
                counterAlign: 'CENTER',
              },
              style: { backgroundColor: 'transparent' },
              children: [
                {
                  type: 'BUTTON',
                  name: 'Primary CTA',
                  content: '전시 쇼룸 둘러보기 (Showroom)',
                  variant: 'accent',
                },
                {
                  type: 'BUTTON',
                  name: 'Secondary CTA',
                  content: '디자인 토큰 가이드 (V3 Tokens)',
                  variant: 'outline',
                },
                {
                  type: 'BUTTON',
                  name: 'Motion Lab CTA',
                  content: '모션 랩 열기 (Motion Lab)',
                  variant: 'ghost',
                },
              ],
            },
          ],
        },

        // 3. Brand Story & Dual Philosophy (Wild ➔ Thin)
        {
          id: 'section-philosophy',
          type: 'FRAME',
          name: '02. Philosophy - Wild to Thin Transition',
          geometry: { width: 1440 },
          layout: {
            direction: 'VERTICAL',
            spacing: 40,
            padding: { horizontal: 80, vertical: 80 },
            counterAlign: 'CENTER',
            horizontalSizing: 'FILL',
          },
          style: {
            backgroundColor: '#090d16',
            borderWidth: 2,
            borderColor: '#1e2430',
          },
          children: [
            {
              type: 'BADGE',
              name: 'Philosophy Badge',
              content: 'DUAL ESSENCE OF SONAGI',
              variant: 'dandelion',
            },
            {
              type: 'TEXT',
              name: 'Section Title',
              content: '소나기와 민들레: 두 개의 세계관이 빚어내는 조화',
              style: { fontSize: 36, fontWeight: 'Bold', textColor: '#ffffff' },
            },
            // 2-Column Split Cards
            {
              type: 'FRAME',
              name: 'Philosophy Dual Columns',
              layout: {
                direction: 'HORIZONTAL',
                spacing: 32,
                primaryAlign: 'CENTER',
                horizontalSizing: 'FILL',
              },
              style: { backgroundColor: 'transparent' },
              children: [
                // Left Card: 소나기 (Wild)
                {
                  type: 'CARD',
                  name: 'Card: 소나기 (Wild)',
                  geometry: { width: 620, height: 320 },
                  layout: { direction: 'VERTICAL', spacing: 16, padding: 32 },
                  style: {
                    backgroundColor: '#070a12',
                    borderWidth: 2,
                    borderColor: '#4A90E2',
                    borderRadius: 4,
                  },
                  children: [
                    {
                      type: 'TEXT',
                      name: 'Wild Title',
                      content: '소나기 (Wild) — 벼락같은 몰입과 방패',
                      style: { fontSize: 24, fontWeight: 'Bold', textColor: '#4A90E2' },
                    },
                    {
                      type: 'FRAME',
                      name: 'Wild Tags',
                      layout: { direction: 'HORIZONTAL', spacing: 8 },
                      style: { backgroundColor: 'transparent' },
                      children: [
                        {
                          type: 'BADGE',
                          name: 'Tag 1',
                          content: 'Neo-Brutalism',
                          variant: 'outline',
                        },
                        {
                          type: 'BADGE',
                          name: 'Tag 2',
                          content: '2px Crisp Border',
                          variant: 'outline',
                        },
                        {
                          type: 'BADGE',
                          name: 'Tag 3',
                          content: 'High Contrast',
                          variant: 'outline',
                        },
                      ],
                    },
                    {
                      type: 'TEXT',
                      name: 'Wild Desc',
                      content:
                        '얼어붙은 땅을 깨우는 파괴적 추진력과 무결점의 엔지니어링 방패. 불필요한 장식과 그림자를 걷어내고, 2px의 단단한 선과 엄격한 토큰 체계로 작동합니다.',
                      style: { fontSize: 15, textColor: '#8b949e', lineHeight: 24 },
                    },
                  ],
                },
                // Right Card: 민들레 (Thin)
                {
                  type: 'CARD',
                  name: 'Card: 민들레 (Thin)',
                  geometry: { width: 620, height: 320 },
                  layout: { direction: 'VERTICAL', spacing: 16, padding: 32 },
                  style: {
                    backgroundColor: '#0e0d0a',
                    borderWidth: 2,
                    borderColor: '#ffd166',
                    borderRadius: 4,
                  },
                  children: [
                    {
                      type: 'TEXT',
                      name: 'Thin Title',
                      content: '민들레 (Thin) — 콘크리트 틈에서 피어나는 다정함',
                      style: { fontSize: 24, fontWeight: 'Bold', textColor: '#ffd166' },
                    },
                    {
                      type: 'FRAME',
                      name: 'Thin Tags',
                      layout: { direction: 'HORIZONTAL', spacing: 8 },
                      style: { backgroundColor: 'transparent' },
                      children: [
                        {
                          type: 'BADGE',
                          name: 'Tag 1',
                          content: 'Warm Glow',
                          variant: 'dandelion',
                        },
                        {
                          type: 'BADGE',
                          name: 'Tag 2',
                          content: 'Micro-Interactions',
                          variant: 'dandelion',
                        },
                        {
                          type: 'BADGE',
                          name: 'Tag 3',
                          content: 'Precise Spacing',
                          variant: 'dandelion',
                        },
                      ],
                    },
                    {
                      type: 'TEXT',
                      name: 'Thin Desc',
                      content:
                        '단단한 철학 속에서도 사람을 향해 피어나는 따뜻한 사용자 경험. 미세한 마이크로 인터랙션, 따뜻한 앰비언트 글로우, 숨결을 불어넣는 모션으로 완성됩니다.',
                      style: { fontSize: 15, textColor: '#8b949e', lineHeight: 24 },
                    },
                  ],
                },
              ],
            },
          ],
        },

        // 4. Bento Box Showcase (민들레 Thin & 6 Core Disciplines)
        {
          id: 'section-bento',
          type: 'FRAME',
          name: '03. Bento Showcase - 6 Core Disciplines',
          geometry: { width: 1440 },
          layout: {
            direction: 'VERTICAL',
            spacing: 32,
            padding: { horizontal: 80, vertical: 80 },
            counterAlign: 'CENTER',
            horizontalSizing: 'FILL',
          },
          style: {
            backgroundColor: '#060911',
            borderWidth: 2,
            borderColor: '#1e2430',
          },
          children: [
            {
              type: 'TEXT',
              name: 'Bento Title',
              content: 'Interactive Bento Showcase',
              style: { fontSize: 36, fontWeight: 'Bold', textColor: '#ffffff' },
            },
            {
              type: 'TEXT',
              name: 'Bento Subtitle',
              content: '디자인 시스템 V3와 3D·모션·AI 엔지니어링이 결합된 기술 캔버스',
              style: { fontSize: 18, textColor: '#8b949e' },
            },
            // Bento Row 1
            {
              type: 'FRAME',
              name: 'Bento Row 1',
              layout: {
                direction: 'HORIZONTAL',
                spacing: 24,
                primaryAlign: 'CENTER',
                horizontalSizing: 'FILL',
              },
              style: { backgroundColor: 'transparent' },
              children: [
                // Bento 1: 3D Motion Lab (Span 2)
                {
                  type: 'CARD',
                  name: 'Bento 1: WebGL & 3D Motion Lab',
                  geometry: { width: 820, height: 280 },
                  layout: { direction: 'VERTICAL', spacing: 14, padding: 24 },
                  style: {
                    backgroundColor: '#080d1a',
                    borderWidth: 2,
                    borderColor: '#4A90E2',
                    borderRadius: 4,
                  },
                  children: [
                    {
                      type: 'BADGE',
                      name: 'Category',
                      content: 'THREE.JS / THEATRE.JS / BLENDER',
                      variant: 'accent',
                    },
                    {
                      type: 'TEXT',
                      name: 'Title',
                      content: 'Cinematic 3D Motion Lab',
                      style: { fontSize: 24, fontWeight: 'Bold', textColor: '#ffffff' },
                    },
                    {
                      type: 'TEXT',
                      name: 'Desc',
                      content:
                        'Three.js 렌더러와 Theatre.js 타임라인 에디터를 결합하여 코드로 제어하는 시네마틱 3D 파이프라인.',
                      style: { fontSize: 14, textColor: '#8b949e' },
                    },
                    {
                      type: 'BUTTON',
                      name: 'Action',
                      content: 'Playground 실행',
                      variant: 'outline',
                    },
                  ],
                },
                // Bento 2: Design System Core (Span 1)
                {
                  type: 'CARD',
                  name: 'Bento 2: Design System V3',
                  geometry: { width: 436, height: 280 },
                  layout: { direction: 'VERTICAL', spacing: 14, padding: 24 },
                  style: {
                    backgroundColor: '#120d12',
                    borderWidth: 2,
                    borderColor: '#d2645f',
                    borderRadius: 4,
                  },
                  children: [
                    {
                      type: 'BADGE',
                      name: 'Category',
                      content: 'DESIGN SYSTEM V3',
                      variant: 'outline',
                    },
                    {
                      type: 'TEXT',
                      name: 'Title',
                      content: 'Tokens & Primitives',
                      style: { fontSize: 22, fontWeight: 'Bold', textColor: '#ffffff' },
                    },
                    {
                      type: 'TEXT',
                      name: 'Desc',
                      content: 'W3C 표준 디자인 토큰 컴파일러 및 OKLCH 기반 시맨틱 컬러 시스템.',
                      style: { fontSize: 14, textColor: '#8b949e' },
                    },
                    {
                      type: 'BUTTON',
                      name: 'Action',
                      content: 'Storybook 열기',
                      variant: 'primary',
                    },
                  ],
                },
              ],
            },
            // Bento Row 2
            {
              type: 'FRAME',
              name: 'Bento Row 2',
              layout: {
                direction: 'HORIZONTAL',
                spacing: 24,
                primaryAlign: 'CENTER',
                horizontalSizing: 'FILL',
              },
              style: { backgroundColor: 'transparent' },
              children: [
                // Bento 3: Sonagi Draw (Span 1)
                {
                  type: 'CARD',
                  name: 'Bento 3: Sonagi Draw Whiteboard',
                  geometry: { width: 436, height: 280 },
                  layout: { direction: 'VERTICAL', spacing: 14, padding: 24 },
                  style: {
                    backgroundColor: '#061313',
                    borderWidth: 2,
                    borderColor: '#00ffcc',
                    borderRadius: 4,
                  },
                  children: [
                    {
                      type: 'BADGE',
                      name: 'Category',
                      content: 'TLDRAW / MCP ENGINE',
                      variant: 'accent',
                    },
                    {
                      type: 'TEXT',
                      name: 'Title',
                      content: 'Sonagi Draw Canvas',
                      style: { fontSize: 22, fontWeight: 'Bold', textColor: '#ffffff' },
                    },
                    {
                      type: 'TEXT',
                      name: 'Desc',
                      content: 'tldraw 기반 커스텀 도형 스키마 및 AI 에이전트 연동 협업 캔버스.',
                      style: { fontSize: 14, textColor: '#8b949e' },
                    },
                    { type: 'BUTTON', name: 'Action', content: '캔버스 접속', variant: 'outline' },
                  ],
                },
                // Bento 4: AI & Infra Orchestration (Span 2)
                {
                  type: 'CARD',
                  name: 'Bento 4: AI Agent Orchestration',
                  geometry: { width: 820, height: 280 },
                  layout: { direction: 'VERTICAL', spacing: 14, padding: 24 },
                  style: {
                    backgroundColor: '#100a18',
                    borderWidth: 2,
                    borderColor: '#a855f7',
                    borderRadius: 4,
                  },
                  children: [
                    {
                      type: 'BADGE',
                      name: 'Category',
                      content: 'PAPERCLIP / KIMAKI / K3S IAC',
                      variant: 'outline',
                    },
                    {
                      type: 'TEXT',
                      name: 'Title',
                      content: 'Autonomous Agent Orchestration',
                      style: { fontSize: 24, fontWeight: 'Bold', textColor: '#ffffff' },
                    },
                    {
                      type: 'TEXT',
                      name: 'Desc',
                      content:
                        'Paperclip 거버넌스, Discord 웹 클리퍼, K3s 인프라 및 OpenCode 멀티 에이전트 자율 협업 파이프라인.',
                      style: { fontSize: 14, textColor: '#8b949e' },
                    },
                    {
                      type: 'BUTTON',
                      name: 'Action',
                      content: '아키텍처 문서 보기',
                      variant: 'outline',
                    },
                  ],
                },
              ],
            },
          ],
        },

        // 5. Featured Projects Showroom (CEO-1001)
        {
          id: 'section-showroom',
          type: 'FRAME',
          name: '04. Featured Projects Showroom',
          geometry: { width: 1440 },
          layout: {
            direction: 'VERTICAL',
            spacing: 32,
            padding: { horizontal: 80, vertical: 80 },
            counterAlign: 'CENTER',
            horizontalSizing: 'FILL',
          },
          style: {
            backgroundColor: '#090d16',
            borderWidth: 2,
            borderColor: '#1e2430',
          },
          children: [
            {
              type: 'TEXT',
              name: 'Showroom Title',
              content: 'Curated Works & Projects',
              style: { fontSize: 36, fontWeight: 'Bold', textColor: '#ffffff' },
            },
            // Filter Tabs
            {
              type: 'FRAME',
              name: 'Filter Tabs',
              layout: { direction: 'HORIZONTAL', spacing: 12 },
              style: { backgroundColor: 'transparent' },
              children: [
                { type: 'BADGE', name: 'Filter All', content: 'All (6)', variant: 'accent' },
                {
                  type: 'BADGE',
                  name: 'Filter DS',
                  content: 'Design System & Ops',
                  variant: 'outline',
                },
                { type: 'BADGE', name: 'Filter 3D', content: 'WebGL & Motion', variant: 'outline' },
                {
                  type: 'BADGE',
                  name: 'Filter AI',
                  content: 'AI & Cloudflare',
                  variant: 'outline',
                },
              ],
            },
            // Projects 3-Column Grid
            {
              type: 'FRAME',
              name: 'Projects Grid',
              layout: {
                direction: 'HORIZONTAL',
                spacing: 24,
                wrap: true,
                primaryAlign: 'CENTER',
                horizontalSizing: 'FILL',
              },
              style: { backgroundColor: 'transparent' },
              children: [
                // Project Card 1
                {
                  type: 'CARD',
                  name: 'Card: Sonagi Design System',
                  geometry: { width: 400, height: 340 },
                  layout: { direction: 'VERTICAL', spacing: 14, padding: 20 },
                  style: {
                    backgroundColor: '#070a12',
                    borderWidth: 2,
                    borderColor: '#30363d',
                    borderRadius: 4,
                  },
                  children: [
                    {
                      type: 'SHAPE',
                      name: 'Preview Box',
                      geometry: { width: 360, height: 160 },
                      color: '#161b22',
                    },
                    {
                      type: 'TEXT',
                      name: 'Title',
                      content: 'Sonagi Design System V3',
                      style: { fontSize: 18, fontWeight: 'Bold', textColor: '#ffffff' },
                    },
                    {
                      type: 'TEXT',
                      name: 'Subtitle',
                      content: '토큰 엔진, 컴포넌트 라이브러리 및 Figma 플러그인 통합 시스템.',
                      style: { fontSize: 13, textColor: '#8b949e' },
                    },
                    {
                      type: 'BUTTON',
                      name: 'View Project',
                      content: '자세히 보기',
                      variant: 'outline',
                    },
                  ],
                },
                // Project Card 2
                {
                  type: 'CARD',
                  name: 'Card: Sonagi Draw',
                  geometry: { width: 400, height: 340 },
                  layout: { direction: 'VERTICAL', spacing: 14, padding: 20 },
                  style: {
                    backgroundColor: '#070a12',
                    borderWidth: 2,
                    borderColor: '#30363d',
                    borderRadius: 4,
                  },
                  children: [
                    {
                      type: 'SHAPE',
                      name: 'Preview Box',
                      geometry: { width: 360, height: 160 },
                      color: '#161b22',
                    },
                    {
                      type: 'TEXT',
                      name: 'Title',
                      content: 'Sonagi Draw Collaboration',
                      style: { fontSize: 18, fontWeight: 'Bold', textColor: '#ffffff' },
                    },
                    {
                      type: 'TEXT',
                      name: 'Subtitle',
                      content: 'Cloudflare DO 기반의 실시간 화이트보드 및 AI 다이어그램 생성기.',
                      style: { fontSize: 13, textColor: '#8b949e' },
                    },
                    {
                      type: 'BUTTON',
                      name: 'View Project',
                      content: '자세히 보기',
                      variant: 'outline',
                    },
                  ],
                },
                // Project Card 3
                {
                  type: 'CARD',
                  name: 'Card: Sonagi Anvil',
                  geometry: { width: 400, height: 340 },
                  layout: { direction: 'VERTICAL', spacing: 14, padding: 20 },
                  style: {
                    backgroundColor: '#070a12',
                    borderWidth: 2,
                    borderColor: '#30363d',
                    borderRadius: 4,
                  },
                  children: [
                    {
                      type: 'SHAPE',
                      name: 'Preview Box',
                      geometry: { width: 360, height: 160 },
                      color: '#161b22',
                    },
                    {
                      type: 'TEXT',
                      name: 'Title',
                      content: 'Sonagi Anvil DSA Platform',
                      style: { fontSize: 18, fontWeight: 'Bold', textColor: '#ffffff' },
                    },
                    {
                      type: 'TEXT',
                      name: 'Subtitle',
                      content: '서버리스 기반의 알고리즘 TDD 훈련 및 인터랙티브 시각화 플랫폼.',
                      style: { fontSize: 13, textColor: '#8b949e' },
                    },
                    {
                      type: 'BUTTON',
                      name: 'View Project',
                      content: '자세히 보기',
                      variant: 'outline',
                    },
                  ],
                },
              ],
            },
          ],
        },

        // 6. Design System Token Specimen
        {
          id: 'section-specimen',
          type: 'FRAME',
          name: '05. V3 Token Specimen',
          geometry: { width: 1440 },
          layout: {
            direction: 'VERTICAL',
            spacing: 24,
            padding: { horizontal: 80, vertical: 64 },
            counterAlign: 'CENTER',
            horizontalSizing: 'FILL',
          },
          style: {
            backgroundColor: '#060911',
            borderWidth: 2,
            borderColor: '#1e2430',
          },
          children: [
            {
              type: 'TEXT',
              name: 'Specimen Title',
              content: 'Sonagi V3 Foundation Specimen',
              style: { fontSize: 28, fontWeight: 'Bold', textColor: '#ffffff' },
            },
            {
              type: 'FRAME',
              name: 'Palette Swatches',
              layout: { direction: 'HORIZONTAL', spacing: 16 },
              style: { backgroundColor: 'transparent' },
              children: [
                {
                  type: 'SHAPE',
                  name: 'Burgundy 800',
                  geometry: { width: 120, height: 50 },
                  color: '#47211b',
                },
                {
                  type: 'SHAPE',
                  name: 'Rain 500',
                  geometry: { width: 120, height: 50 },
                  color: '#4A90E2',
                },
                {
                  type: 'SHAPE',
                  name: 'Cyan 400',
                  geometry: { width: 120, height: 50 },
                  color: '#00ffcc',
                },
                {
                  type: 'SHAPE',
                  name: 'Dandelion 300',
                  geometry: { width: 120, height: 50 },
                  color: '#ffd166',
                },
                {
                  type: 'SHAPE',
                  name: 'Dark Surface',
                  geometry: { width: 120, height: 50 },
                  color: '#161b22',
                },
              ],
            },
          ],
        },

        // 7. Footer
        {
          id: 'section-footer',
          type: 'FRAME',
          name: '06. Footer',
          geometry: { width: 1440, height: 120 },
          layout: {
            direction: 'HORIZONTAL',
            spacing: 32,
            padding: { horizontal: 80, vertical: 40 },
            primaryAlign: 'SPACE_BETWEEN',
            counterAlign: 'CENTER',
            horizontalSizing: 'FILL',
          },
          style: {
            backgroundColor: '#04060b',
            borderWidth: 2,
            borderColor: '#1e2430',
          },
          children: [
            {
              type: 'TEXT',
              name: 'Copyright',
              content: '© 2026 Sonagi Ecosystem. Engineered with Wild & Thin philosophy.',
              style: { fontSize: 14, textColor: '#6e7681' },
            },
            {
              type: 'TEXT',
              name: 'Links',
              content: 'GitHub • Blog • Wiki • Status: Operational',
              style: { fontSize: 14, textColor: '#8b949e' },
            },
          ],
        },
      ],
    },
  ];
}
