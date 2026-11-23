import { Fragment, type ReactElement, type ReactNode } from 'react';
import {
  parseSafeMarkdown,
  type MarkdownBlockNode,
  type MarkdownInlineNode,
} from '../utils/safeMarkdown.js';

interface SafeMarkdownProps {
  text: string;
}

function renderInlineNodes(nodes: readonly MarkdownInlineNode[], keyPrefix: string): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-i-${index}`;
    if (node.type === 'text') {
      return <Fragment key={key}>{node.value}</Fragment>;
    }
    if (node.type === 'br') {
      return <br key={key} />;
    }
    if (node.type === 'strong') {
      return (
        <strong key={key} className="font-semibold text-slate-900 dark:text-slate-100">
          {renderInlineNodes(node.children, key)}
        </strong>
      );
    }
    return (
      <em key={key} className="italic">
        {renderInlineNodes(node.children, key)}
      </em>
    );
  });
}

function renderBlockNode(block: MarkdownBlockNode, index: number): ReactElement {
  const key = `md-b-${index}`;
  if (block.type === 'ul') {
    return (
      <ul key={key} className="list-disc pl-5 space-y-1">
        {block.items.map((itemNodes, itemIdx) => (
          <li key={`${key}-li-${itemIdx}`}>
            {renderInlineNodes(itemNodes, `${key}-li-${itemIdx}`)}
          </li>
        ))}
      </ul>
    );
  }
  if (block.type === 'ol') {
    return (
      <ol key={key} className="list-decimal pl-5 space-y-1">
        {block.items.map((itemNodes, itemIdx) => (
          <li key={`${key}-li-${itemIdx}`}>
            {renderInlineNodes(itemNodes, `${key}-li-${itemIdx}`)}
          </li>
        ))}
      </ol>
    );
  }
  return <p key={key}>{renderInlineNodes(block.children, key)}</p>;
}

/**
 * Pure React markdown renderer supporting bold, italic, ordered/unordered lists,
 * and line breaks without `dangerouslySetInnerHTML` or raw HTML evaluation.
 *
 * @param props - Raw AI markdown text string.
 * @returns Rendered React elements safely escaped against XSS.
 */
export function SafeMarkdown({ text }: Readonly<SafeMarkdownProps>): ReactElement {
  const blocks = parseSafeMarkdown(text);
  return <div className="space-y-2">{blocks.map(renderBlockNode)}</div>;
}
