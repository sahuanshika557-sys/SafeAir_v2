import { parseInlineMarkdown, type MarkdownInlineNode } from './safeMarkdownInline.js';

export { parseInlineMarkdown, type MarkdownInlineNode } from './safeMarkdownInline.js';

/** Block markdown node supporting only paragraphs, unordered lists, and ordered lists. */
export type MarkdownBlockNode =
  | { type: 'paragraph'; children: MarkdownInlineNode[] }
  | { type: 'ul'; items: MarkdownInlineNode[][] }
  | { type: 'ol'; items: MarkdownInlineNode[][] };

const ORDERED_LIST_RE = /^\s*(?:\d+|[\u0966-\u096F]+)[.)]\s+(\S.*)$/;
const UNORDERED_LIST_RE = /^\s*[-*•]\s+(\S.*)$/;
const INDENTED_CONTINUATION_RE = /^\s{2,}\S/;
const BOLD_MARKER_PARITY = 2;

/**
 * Normalizes malformed AI markdown markers while preserving plain language text (including Hindi).
 */
export function normalizeMarkdownText(input: string): string {
  if (!input) {
    return '';
  }

  const lines = input.replace(/\r\n?/g, '\n').split('\n');
  const normalizedLines = lines.map((line) => {
    let out = line.replace(/\*\*\s*\*\*/g, '');
    out = out.replace(/\*\*([^*\n]+?)\*\*/g, (_full, inner: string) => {
      const trimmed = inner.trim();
      return trimmed ? `**${trimmed}**` : '';
    });

    const matches = out.match(/\*\*/g);
    if (matches && matches.length % BOLD_MARKER_PARITY === 1) {
      const lastIdx = out.lastIndexOf('**');
      if (lastIdx !== -1) {
        out = out.slice(0, lastIdx) + out.slice(lastIdx + BOLD_MARKER_PARITY);
      }
    }
    return out;
  });

  return normalizedLines.join('\n').trim();
}

interface BlockParserState {
  blocks: MarkdownBlockNode[];
  paragraphLines: string[];
  listType: 'ul' | 'ol' | null;
  listItems: string[];
}

function flushParagraph(state: BlockParserState): void {
  if (state.paragraphLines.length === 0) {
    return;
  }
  state.blocks.push({
    type: 'paragraph',
    children: parseInlineMarkdown(state.paragraphLines.join('\n')),
  });
  state.paragraphLines = [];
}

function flushList(state: BlockParserState): void {
  if (!state.listType || state.listItems.length === 0) {
    state.listType = null;
    state.listItems = [];
    return;
  }
  state.blocks.push({
    type: state.listType,
    items: state.listItems.map((item) => parseInlineMarkdown(item)),
  });
  state.listType = null;
  state.listItems = [];
}

function appendListEntry(state: BlockParserState, nextType: 'ul' | 'ol', text: string): void {
  flushParagraph(state);
  if (state.listType && state.listType !== nextType) {
    flushList(state);
  }
  state.listType = nextType;
  state.listItems.push(text);
}

function processMarkdownLine(state: BlockParserState, line: string): void {
  const trimmed = line.trim();
  if (!trimmed) {
    flushParagraph(state);
    flushList(state);
    return;
  }

  const orderedMatch = ORDERED_LIST_RE.exec(trimmed);
  if (orderedMatch?.[1] !== undefined) {
    appendListEntry(state, 'ol', orderedMatch[1]);
    return;
  }

  const unorderedMatch = UNORDERED_LIST_RE.exec(trimmed);
  if (unorderedMatch?.[1] !== undefined) {
    appendListEntry(state, 'ul', unorderedMatch[1]);
    return;
  }

  if (state.listType && state.listItems.length > 0 && INDENTED_CONTINUATION_RE.test(line)) {
    const lastIdx = state.listItems.length - 1;
    state.listItems[lastIdx] = `${state.listItems[lastIdx] ?? ''}\n${trimmed}`;
    return;
  }

  flushList(state);
  state.paragraphLines.push(trimmed);
}

/**
 * Parses safe markdown into structured block AST nodes (paragraphs, bold, italic, lists, line breaks).
 */
export function parseSafeMarkdown(raw: string): MarkdownBlockNode[] {
  const normalized = normalizeMarkdownText(raw);
  if (!normalized) {
    return [];
  }

  const state: BlockParserState = {
    blocks: [],
    paragraphLines: [],
    listType: null,
    listItems: [],
  };

  for (const line of normalized.split('\n')) {
    processMarkdownLine(state, line);
  }

  flushParagraph(state);
  flushList(state);
  return state.blocks;
}
