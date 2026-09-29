import { visit } from 'unist-util-visit';
import type { Plugin } from 'unified';
import type { Root, Code } from 'mdast';

export const remarkPlayground: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, 'code', (node: Code, index, parent) => {
      if (node.lang === 'sonagi-playground') {
        let config: any = {};
        try {
          config = JSON.parse(node.value);
        } catch (e) {
          console.error('[remark-playground] Invalid JSON in code block:', e);
          return;
        }

        const newNode = {
          type: 'mdxJsxFlowElement',
          name: 'SonagiPlayground',
          attributes: [
            { type: 'mdxJsxAttribute', name: 'template', value: config.template || 'vanilla' },
            {
              type: 'mdxJsxAttribute',
              name: 'files',
              value: {
                type: 'mdxJsxAttributeValueExpression',
                value: JSON.stringify(config.files || {}),
              },
            },
            {
              type: 'mdxJsxAttribute',
              name: 'dependencies',
              value: {
                type: 'mdxJsxAttributeValueExpression',
                value: JSON.stringify(config.dependencies || {}),
              },
            },
            { type: 'mdxJsxAttribute', name: 'theme', value: config.theme || 'dark' },
          ],
          children: [],
        };

        if (parent && typeof index === 'number') {
          parent.children.splice(index, 1, newNode as any);
        }
      } else if (node.lang === 'sonagi-jupyter') {
        let notebook: any = {};
        try {
          notebook = JSON.parse(node.value);
        } catch (e) {
          console.error('[remark-playground] Invalid JSON in jupyter block:', e);
          return;
        }

        const newNode = {
          type: 'mdxJsxFlowElement',
          name: 'SonagiJupyterPlayground',
          attributes: [
            {
              type: 'mdxJsxAttribute',
              name: 'notebook',
              value: { type: 'mdxJsxAttributeValueExpression', value: JSON.stringify(notebook) },
            },
            {
              type: 'mdxJsxAttribute',
              name: 'executeEndpoint',
              value: notebook.executeEndpoint || '/api/execute',
            },
            { type: 'mdxJsxAttribute', name: 'theme', value: notebook.theme || 'dark' },
          ],
          children: [],
        };

        if (parent && typeof index === 'number') {
          parent.children.splice(index, 1, newNode as any);
        }
      }
    });
  };
};

export default remarkPlayground;
