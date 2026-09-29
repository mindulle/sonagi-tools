import { visit } from 'unist-util-visit';
import type { Plugin } from 'unified';
import type { Root, Code } from 'mdast';

/**
 * Remark plugin to transform ```sonagi-playground code blocks
 * into <SonagiPlayground /> MDX components.
 */
export const remarkPlayground: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, 'code', (node: Code, index, parent) => {
      if (node.lang === 'sonagi-playground') {
        let config: any = {};
        try {
          config = JSON.parse(node.value);
        } catch (e) {
          console.error('[remark-playground] Invalid JSON in code block:', e);
          // Leave the block as is if invalid
          return;
        }

        // Create the MDX JSX Element AST node
        const newNode = {
          type: 'mdxJsxFlowElement',
          name: 'SonagiPlayground',
          attributes: [
            {
              type: 'mdxJsxAttribute',
              name: 'template',
              value: config.template || 'vanilla',
            },
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
            {
              type: 'mdxJsxAttribute',
              name: 'theme',
              value: config.theme || 'dark',
            },
          ],
          children: [],
        };

        if (parent && typeof index === 'number') {
          // Replace the code block with the new MDX component
          parent.children.splice(index, 1, newNode as any);
        }
      }
    });
  };
};

export default remarkPlayground;
