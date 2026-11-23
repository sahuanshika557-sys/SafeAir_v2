/**
 * Inline markdown node representing plain text, bold, italic, or line breaks.
 * Never holds raw HTML or `dangerouslySetInnerHTML` strings.
 */
export type MarkdownInlineNode =
  | { type: 'text'; value: string }
  | { type: 'strong'; children: MarkdownInlineNode[] }
  | { type: 'em'; children: MarkdownInlineNode[] }
  | { type: 'br' };

const BOLD_MARKER_LEN = 2;

function pushMergedText(nodes: MarkdownInlineNode[], chunk: string): void {
  if (!chunk) {
    return;
  }
  const last = nodes.at(-1);
  if (last && last.type === 'text') {
    last.value += chunk;
  } else {
    nodes.push({ type: 'text', value: chunk });
  }
}

function tryConsumeBold(
  text: string,
  cursor: number,
  nodes: MarkdownInlineNode[],
): number | null {
  if (!text.startsWith('**', cursor)) {
    return null;
  }
  const closeIdx = text.indexOf('**', cursor + BOLD_MARKER_LEN);
  if (closeIdx > cursor + BOLD_MARKER_LEN) {
    const inner = text.slice(cursor + BOLD_MARKER_LEN, closeIdx);
    if (!inner.includes('\n')) {
      nodes.push({ type: 'strong', children: parseInlineMarkdown(inner) });
      return closeIdx + BOLD_MARKER_LEN;
    }
  }
  return cursor + BOLD_MARKER_LEN;
}

function tryConsumeStarItalic(
  text: string,
  cursor: number,
  nodes: MarkdownInlineNode[],
): number | null {
  if (text[cursor] !== '*' || text[cursor + 1] === '*') {
    return null;
  }
  const closeIdx = text.indexOf('*', cursor + 1);
  if (closeIdx > cursor + 1) {
    const inner = text.slice(cursor + 1, closeIdx);
    if (!inner.includes('\n') && !inner.startsWith(' ') && !inner.endsWith(' ')) {
      nodes.push({ type: 'em', children: parseInlineMarkdown(inner) });
      return closeIdx + 1;
    }
  }
  pushMergedText(nodes, '*');
  return cursor + 1;
}

function tryConsumeUnderscoreItalic(
  text: string,
  cursor: number,
  nodes: MarkdownInlineNode[],
): number | null {
  if (text[cursor] !== '_') {
    return null;
  }
  const prevChar = cursor > 0 ? (text[cursor - 1] ?? '') : '';
  const isLeftBoundary = !prevChar || /[\s([{'"“‘]/.test(prevChar);
  if (isLeftBoundary) {
    const closeIdx = text.indexOf('_', cursor + 1);
    const nextChar = closeIdx !== -1 ? (text[closeIdx + 1] ?? '') : '';
    const isRightBoundary =
      closeIdx > cursor + 1 && (!nextChar || /[\s.,!?;:)\]}'"”’।]/.test(nextChar));
    if (isRightBoundary) {
      const inner = text.slice(cursor + 1, closeIdx);
      if (!inner.includes('\n') && inner.trim().length > 0) {
        nodes.push({ type: 'em', children: parseInlineMarkdown(inner) });
        return closeIdx + 1;
      }
    }
  }
  pushMergedText(nodes, '_');
  return cursor + 1;
}

/**
 * Parses inline formatting (`**bold**`, `*italic*`, `_italic_`, and line breaks) into safe nodes.
 * Works seamlessly across Latin, Devanagari (Hindi), and mixed technical strings (`PM2.5`, `N95`).
 *
 * @param text - Normalized single block or line string.
 * @returns Ordered array of {@link MarkdownInlineNode} elements.
 */
export function parseInlineMarkdown(text: string): MarkdownInlineNode[] {
  const nodes: MarkdownInlineNode[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    if (text[cursor] === '\n') {
      nodes.push({ type: 'br' });
      cursor += 1;
      continue;
    }

    const nextCursor =
      tryConsumeBold(text, cursor, nodes) ??
      tryConsumeStarItalic(text, cursor, nodes) ??
      tryConsumeUnderscoreItalic(text, cursor, nodes);

    if (nextCursor !== null) {
      cursor = nextCursor;
      continue;
    }

    let nextMarker = cursor + 1;
    while (
      nextMarker < text.length &&
      text[nextMarker] !== '*' &&
      text[nextMarker] !== '_' &&
      text[nextMarker] !== '\n'
    ) {
      nextMarker += 1;
    }
    pushMergedText(nodes, text.slice(cursor, nextMarker));
    cursor = nextMarker;
  }

  return nodes;
}
