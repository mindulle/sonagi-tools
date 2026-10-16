import { describe, it, expect } from 'vitest';
import {
  wireframeNodesToCanvasShapes,
  canvasShapesToWireframeNodes,
  CanvasShape,
} from './canvasAdapter';
import { WireframeNode, getPortfolioLandingWireframe } from './wireframe';

describe('Sonagi Design Harness - Canvas Adapter', () => {
  it('converts basic WireframeNodes to valid Sonagi Draw shapes', () => {
    const nodes: WireframeNode[] = [
      {
        id: 'node-btn',
        type: 'BUTTON',
        name: 'CTA Button',
        content: 'Get Started',
        variant: 'accent',
      },
      {
        id: 'node-badge',
        type: 'BADGE',
        name: 'Status Badge',
        content: 'Sonagi V3',
        variant: 'primary',
      },
      {
        id: 'node-card',
        type: 'CARD',
        name: 'Feature Card',
        content: 'Bento Showcase',
      },
    ];

    const shapes = wireframeNodesToCanvasShapes(nodes, { startX: 100, startY: 100 });

    expect(shapes.length).toBe(3);
    expect(shapes[0].type).toBe('wired-button');
    expect(shapes[0].props.text).toBe('Get Started');
    expect(shapes[0].props.color).toBe('#4A90E2');

    expect(shapes[1].type).toBe('wired-status-badge');
    expect(shapes[1].props.label).toContain('Sonagi V3');

    expect(shapes[2].type).toBe('wired-card');
    expect(shapes[2].props.title).toBe('Feature Card');
  });

  it('correctly handles nested SECTION and AutoLayout coordinates', () => {
    const sectionNode: WireframeNode = {
      type: 'SECTION',
      name: 'Main Section',
      geometry: { width: 1280, height: 800 },
      layout: {
        direction: 'HORIZONTAL',
        spacing: 20,
        padding: 40,
      },
      children: [
        {
          type: 'BUTTON',
          name: 'Btn 1',
          content: 'First',
        },
        {
          type: 'BUTTON',
          name: 'Btn 2',
          content: 'Second',
        },
      ],
    };

    const shapes = wireframeNodesToCanvasShapes([sectionNode], { startX: 50, startY: 50 });

    // 1 browser frame + 2 buttons
    expect(shapes.length).toBe(3);
    expect(shapes[0].type).toBe('wired-browser-frame');
    expect(shapes[0].x).toBe(50);
    expect(shapes[0].y).toBe(50);

    // Button 1 position
    expect(shapes[1].type).toBe('wired-button');
    expect(shapes[1].x).toBe(50 + 40); // startX + padding

    // Button 2 position (horizontal offset from button 1)
    expect(shapes[2].type).toBe('wired-button');
    expect(shapes[2].x).toBeGreaterThan(shapes[1].x);
  });

  it('converts complete Portfolio Landing wireframe without schema errors', () => {
    const portfolioNodes = getPortfolioLandingWireframe();
    const shapes = wireframeNodesToCanvasShapes(portfolioNodes);

    expect(shapes.length).toBeGreaterThan(10);
    
    // Verify no forbidden tldraw standard shapes ('geo', 'text') are generated directly
    const types = shapes.map((s) => s.type);
    expect(types).not.toContain('geo');
    expect(types).not.toContain('text');

    // Verify all shapes have valid dimensions w, h
    shapes.forEach((s) => {
      expect(s.props.w).toBeGreaterThan(0);
      expect(s.props.h).toBeGreaterThan(0);
      expect(s.id).toMatch(/^shape:wf_/);
    });
  });

  it('performs reverse conversion from CanvasShape to WireframeNode AST', () => {
    const canvasShapes: CanvasShape[] = [
      {
        id: 'shape:card_1',
        type: 'wired-card',
        x: 100,
        y: 200,
        props: { w: 300, h: 220, title: 'Atelier Card' },
      },
      {
        id: 'shape:btn_1',
        type: 'wired-button',
        x: 100,
        y: 440,
        props: { w: 140, h: 44, text: 'Submit', color: '#ffd166' },
      },
    ];

    const astNodes = canvasShapesToWireframeNodes(canvasShapes);

    expect(astNodes.length).toBe(2);
    expect(astNodes[0].type).toBe('CARD');
    expect(astNodes[0].name).toBe('Atelier Card');
    expect(astNodes[0].geometry?.width).toBe(300);

    expect(astNodes[1].type).toBe('BUTTON');
    expect(astNodes[1].content).toBe('Submit');
    expect(astNodes[1].variant).toBe('dandelion');
  });
});
