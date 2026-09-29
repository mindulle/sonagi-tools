import { Plugin } from 'obsidian';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { SonagiPlayground } from '@sonagi-tools/playground-core';

export default class SonagiPlaygroundPlugin extends Plugin {
    onload() {
        console.log('Loading Sonagi Playground Plugin');

        this.registerMarkdownCodeBlockProcessor('sonagi-playground', (source, el) => {
            this.processPlaygroundCodeBlock(source, el);
        });
    }

    unload() {
        console.log('Unloading Sonagi Playground Plugin');
    }

    private processPlaygroundCodeBlock(source: string, el: HTMLElement) {
        let config;
        try {
            // For MVP, we assume the source string inside the codeblock is a valid JSON config
            config = JSON.parse(source);
        } catch (e: any) {
            el.createEl('div', { 
                text: `[sonagi-playground] Failed to parse JSON config: ${e.message}`, 
                cls: 'playground-error',
                attr: { style: 'color: red; padding: 10px; border: 1px solid red;' }
            });
            return;
        }

        const container = el.createEl('div', { cls: 'sonagi-playground-wrapper' });
        
        // Render the generic React playground component into Obsidian's DOM
        const root = createRoot(container);
        root.render(
            React.createElement(SonagiPlayground, {
                template: config.template || 'vanilla',
                files: config.files || {},
                dependencies: config.dependencies || {},
                theme: config.theme || 'dark',
                showTabs: config.showTabs !== false,
                showLineNumbers: config.showLineNumbers !== false,
                editorHeight: config.editorHeight || 400
            })
        );

        // Optional: We can hook into Obsidian's node unloading to properly unmount React
        // ctx.addChild is the standard way to handle cleanup in PostProcessors, but requires wrapping in a MarkdownRenderChild.
        // For simplicity in this early stage, we just render it.
    }
}
