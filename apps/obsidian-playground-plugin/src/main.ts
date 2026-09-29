import { Plugin } from 'obsidian';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { SonagiPlayground, SonagiJupyterPlayground } from '@sonagi-tools/playground-core';

export default class SonagiPlaygroundPlugin extends Plugin {
  onload() {
    console.log('Loading Sonagi Playground Plugin');

    this.registerMarkdownCodeBlockProcessor('sonagi-playground', (source, el) => {
      this.processPlaygroundCodeBlock(source, el);
    });

    this.registerMarkdownCodeBlockProcessor('sonagi-jupyter', (source, el) => {
      this.processJupyterCodeBlock(source, el);
    });
  }

  unload() {
    console.log('Unloading Sonagi Playground Plugin');
  }

  private processPlaygroundCodeBlock(source: string, el: HTMLElement) {
    let config;
    try {
      config = JSON.parse(source);
    } catch (e: any) {
      el.createEl('div', {
        text: `[sonagi-playground] Failed to parse JSON config: ${e.message}`,
        cls: 'playground-error',
        attr: { style: 'color: red; padding: 10px; border: 1px solid red;' },
      });
      return;
    }

    const container = el.createEl('div', { cls: 'sonagi-playground-wrapper' });
    const root = createRoot(container);
    root.render(
      React.createElement(SonagiPlayground, {
        template: config.template || 'vanilla',
        files: config.files || {},
        dependencies: config.dependencies || {},
        theme: config.theme || 'dark',
        showTabs: config.showTabs !== false,
        showLineNumbers: config.showLineNumbers !== false,
        editorHeight: config.editorHeight || 400,
      })
    );
  }

  private processJupyterCodeBlock(source: string, el: HTMLElement) {
    let notebook;
    try {
      notebook = JSON.parse(source);
    } catch (e: any) {
      el.createEl('div', {
        text: `[sonagi-jupyter] Failed to parse JSON config: ${e.message}`,
        cls: 'jupyter-error',
        attr: { style: 'color: red; padding: 10px; border: 1px solid red;' },
      });
      return;
    }

    const container = el.createEl('div', { cls: 'sonagi-jupyter-wrapper' });
    const root = createRoot(container);
    root.render(
      React.createElement(SonagiJupyterPlayground, {
        notebook,
        executeEndpoint: notebook.executeEndpoint || '/api/execute',
        theme: notebook.theme || 'dark',
      })
    );
  }
}
