import { WireframeNode, SONAGI_V3_PALETTE } from './wireframe';

/**
 * Sonagi Draw Custom Shape definitions matching apps/web/src/Wired*Shape.tsx
 * Rules: Never use Tldraw standard shapes ('geo', 'text') directly to prevent schema crashes.
 * Always use custom components (e.g. 'wired-button', 'wired-card', 'wired-status-badge').
 */
export type CanvasShapeType =
  | 'wired-button'
  | 'wired-card'
  | 'wired-status-badge'
  | 'wired-browser-frame'
  | 'wired-container'
  | 'wired-input'
  | 'wired-copy-note'
  | 'wired-progress'
  | 'wired-toggle';

export interface CanvasShape {
  id: string;
  type: CanvasShapeType;
  x: number;
  y: number;
  props: Record<string, any>;
  parentId?: string;
  index?: string;
}

export interface CanvasAdapterOptions {
  startX?: number;
  startY?: number;
  gap?: number;
  theme?: 'dark' | 'light';
  roomPrefix?: string;
}

/**
 * Resolves semantic color token to hex string
 */
function resolveColorHex(variant?: string, colorName?: string, theme: 'dark' | 'light' = 'dark'): string {
  if (colorName && colorName.startsWith('#')) return colorName;
  if (colorName && SONAGI_V3_PALETTE[colorName]) {
    return SONAGI_V3_PALETTE[colorName][theme];
  }
  if (variant === 'accent' || variant === 'primary') return '#4A90E2'; // Sonagi Rain
  if (variant === 'dandelion') return '#ffd166'; // Mindulle Dandelion
  if (variant === 'outline') return '#30363d';
  if (variant === 'ghost') return 'transparent';
  return '#4A90E2';
}

/**
 * Converts a WireframeNode tree from Figma Plugin to a flat list of Sonagi Draw Canvas Shapes.
 * Performs layout position calculation for horizontal and vertical flex containers.
 */
export function wireframeNodesToCanvasShapes(
  nodes: WireframeNode[],
  options: CanvasAdapterOptions = {}
): CanvasShape[] {
  const { startX = 100, startY = 100, gap = 40, theme = 'dark' } = options;
  const shapes: CanvasShape[] = [];
  let currentY = startY;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const generated = processNode(node, startX, currentY, theme, `s${i}`);
    shapes.push(...generated.shapes);
    currentY += generated.height + gap;
  }

  return shapes;
}

interface ProcessResult {
  shapes: CanvasShape[];
  width: number;
  height: number;
}

function processNode(
  node: WireframeNode,
  x: number,
  y: number,
  theme: 'dark' | 'light',
  idPrefix: string
): ProcessResult {
  const shapes: CanvasShape[] = [];
  const uniqueId = `shape:wf_${node.type.toLowerCase()}_${idPrefix}_${Math.random().toString(36).substring(2, 7)}`;

  // Default dimensions
  let width = node.geometry?.width || 320;
  let height = node.geometry?.height || 200;

  switch (node.type) {
    case 'SECTION':
    case 'FRAME': {
      const isTopLevel = width >= 800 || height >= 500;
      const frameType: CanvasShapeType = isTopLevel ? 'wired-browser-frame' : 'wired-container';
      
      width = node.geometry?.width || (isTopLevel ? 1280 : 400);
      height = node.geometry?.height || (isTopLevel ? 800 : 300);

      // Add container shape first
      shapes.push({
        id: uniqueId,
        type: frameType,
        x,
        y,
        props: {
          w: width,
          h: height,
        },
      });

      // Layout children if present
      if (node.children && node.children.length > 0) {
        const direction = node.layout?.direction || 'VERTICAL';
        const spacing = node.layout?.spacing || 24;
        const padding = typeof node.layout?.padding === 'number'
          ? node.layout.padding
          : (node.layout?.padding?.top || 32);

        let childX = x + padding;
        let childY = y + padding + (isTopLevel ? 48 : 16); // Title bar offset if browser frame

        for (let j = 0; j < node.children.length; j++) {
          const child = node.children[j];
          const childResult = processNode(child, childX, childY, theme, `${idPrefix}_${j}`);
          shapes.push(...childResult.shapes);

          if (direction === 'HORIZONTAL') {
            childX += childResult.width + spacing;
          } else {
            childY += childResult.height + spacing;
          }
        }
      }
      break;
    }

    case 'CARD': {
      width = node.geometry?.width || 280;
      height = node.geometry?.height || 220;

      shapes.push({
        id: uniqueId,
        type: 'wired-card',
        x,
        y,
        props: {
          w: width,
          h: height,
          title: node.name || node.content || 'Card',
        },
      });

      // Internal elements in card (like action button or badge)
      if (node.children && node.children.length > 0) {
        let innerY = y + 70;
        for (let j = 0; j < node.children.length; j++) {
          const child = node.children[j];
          const childResult = processNode(child, x + 16, innerY, theme, `${idPrefix}_c${j}`);
          shapes.push(...childResult.shapes);
          innerY += childResult.height + 12;
        }
      }
      break;
    }

    case 'BUTTON': {
      width = node.geometry?.width || 140;
      height = node.geometry?.height || 44;
      const color = resolveColorHex(node.variant, node.style?.backgroundColor, theme);

      shapes.push({
        id: uniqueId,
        type: 'wired-button',
        x,
        y,
        props: {
          w: width,
          h: height,
          text: node.content || node.name || 'Button',
          color,
        },
      });
      break;
    }

    case 'BADGE': {
      width = node.geometry?.width || 130;
      height = node.geometry?.height || 32;
      const label = node.content || node.name || 'Badge';
      let status = 'Ready';
      if (node.variant === 'accent' || node.variant === 'primary') status = 'Review';
      else if (node.variant === 'ghost' || node.variant === 'outline') status = 'Draft';

      shapes.push({
        id: uniqueId,
        type: 'wired-status-badge',
        x,
        y,
        props: {
          w: width,
          h: height,
          status,
          label: `🏷️ ${label}`,
        },
      });
      break;
    }

    case 'STICKY':
    case 'TEXT': {
      width = node.geometry?.width || 240;
      height = node.geometry?.height || 100;
      const isTitle = (node.style?.fontSize || 16) >= 24;

      shapes.push({
        id: uniqueId,
        type: 'wired-copy-note',
        x,
        y,
        props: {
          w: width,
          h: height,
          text: node.content || node.name || 'Text Note',
          noteType: isTitle ? 'Headline' : (node.type === 'STICKY' ? 'Atelier Note' : 'UX Copy'),
        },
      });
      break;
    }

    case 'COMPONENT':
    case 'SHAPE':
    default: {
      width = node.geometry?.width || 200;
      height = node.geometry?.height || 60;

      shapes.push({
        id: uniqueId,
        type: 'wired-container',
        x,
        y,
        props: {
          w: width,
          h: height,
        },
      });
      break;
    }
  }

  return { shapes, width, height };
}

/**
 * Converts a list of Sonagi Draw Canvas Shapes back into Figma WireframeNode AST.
 * Useful for 2-way round-tripping from whiteboard sketches into Figma auto-layout components.
 */
export function canvasShapesToWireframeNodes(shapes: CanvasShape[]): WireframeNode[] {
  const nodes: WireframeNode[] = [];

  for (const shape of shapes) {
    const { type, x, y, props } = shape;
    const w = props.w || 200;
    const h = props.h || 100;

    switch (type) {
      case 'wired-card':
        nodes.push({
          id: shape.id,
          type: 'CARD',
          name: props.title || 'Card',
          content: props.title,
          geometry: { x, y, width: w, height: h },
          v3Style: true,
          style: {
            borderWidth: 2,
            borderColor: '#1e2430',
            borderRadius: 4,
            backgroundColor: '#090d16',
          },
        });
        break;

      case 'wired-button':
        nodes.push({
          id: shape.id,
          type: 'BUTTON',
          name: props.text || 'Button',
          content: props.text,
          geometry: { x, y, width: w, height: h },
          variant: props.color?.includes('ffd166') ? 'dandelion' : 'accent',
          v3Style: true,
          style: {
            borderWidth: 2,
            borderRadius: 4,
            backgroundColor: props.color || '#4A90E2',
          },
        });
        break;

      case 'wired-status-badge':
        nodes.push({
          id: shape.id,
          type: 'BADGE',
          name: props.label || 'Badge',
          content: (props.label || '').replace(/^.*? /, ''), // remove emoji prefix
          geometry: { x, y, width: w, height: h },
          variant: 'accent',
          v3Style: true,
        });
        break;

      case 'wired-copy-note':
        nodes.push({
          id: shape.id,
          type: 'STICKY',
          name: props.noteType || 'Note',
          content: props.text,
          geometry: { x, y, width: w, height: h },
          style: {
            fontSize: 14,
            textColor: '#ffd166',
            backgroundColor: '#161b26',
            borderWidth: 2,
            borderColor: '#30363d',
            borderRadius: 4,
          },
        });
        break;

      case 'wired-browser-frame':
        nodes.push({
          id: shape.id,
          type: 'SECTION',
          name: 'Browser Window Frame',
          geometry: { x, y, width: w, height: h },
          v3Style: true,
          layout: {
            direction: 'VERTICAL',
            spacing: 24,
            padding: 32,
          },
          style: {
            backgroundColor: '#060911',
            borderWidth: 2,
            borderColor: '#1e2430',
          },
        });
        break;

      case 'wired-container':
      default:
        nodes.push({
          id: shape.id,
          type: 'FRAME',
          name: 'Container Box',
          geometry: { x, y, width: w, height: h },
          v3Style: true,
          style: {
            borderWidth: 2,
            borderColor: '#30363d',
            borderRadius: 4,
          },
        });
        break;
    }
  }

  return nodes;
}

/**
 * Client-side pusher for dispatching wireframe shapes to Sonagi Draw through the SSE hub.
 */
export async function pushShapesToSonagiDraw(
  shapes: CanvasShape[],
  roomId?: string,
  apiEndpoint: string = 'https://assets.sonagi.space/api/canvas-push'
): Promise<{ ok: boolean; message: string }> {
  try {
    const payload = {
      shapes,
      target_room_id: roomId || undefined,
    };

    const res = await fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    return { ok: true, message: data.result || 'Shapes successfully pushed to Sonagi Draw.' };
  } catch (err: any) {
    return { ok: false, message: `Failed to push to Draw: ${err.message}` };
  }
}
