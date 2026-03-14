/**
 * Inline diff overlay plugin for the editor.
 *
 * Shows diffs for RESOLVED changes (accepted/rejected) directly in the
 * editor text. Active changes already have visible marks and don't need this.
 *
 * - Surviving text gets a subtle highlight
 * - Removed text appears as "ghost" text with strikethrough
 */

import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorView } from '@tiptap/pm/view';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

export interface InlineDiffData {
  /** Text that survives in the document (to be highlighted) */
  survivingText: string;
  /** Text that was removed (shown as ghost/strikethrough) */
  ghostText: string;
  /** Context before the change for position finding */
  contextBefore: string;
  /** Context after the change for position finding */
  contextAfter: string;
  /** Whether the ghost text goes before or after the surviving text */
  ghostPosition: 'before' | 'after';
  /** The action that resolved this change */
  action: 'accepted' | 'rejected';
  /** Color for the author */
  authorColor?: string;
}

interface InlineDiffState {
  decorations: DecorationSet;
  activeData: InlineDiffData | null;
}

const INLINE_DIFF_KEY = new PluginKey<InlineDiffState>('inlineDiff');

const META_SET = 'inlineDiffSet';
const META_CLEAR = 'inlineDiffClear';

/**
 * Build a flat text representation of the document with position mapping.
 * Returns the flat text and an array mapping each character index to a doc position.
 */
function buildFlatText(doc: ProseMirrorNode): { flatText: string; posMap: number[] } {
  let flatText = '';
  const posMap: number[] = [];

  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      for (let i = 0; i < node.text.length; i++) {
        posMap.push(pos + i);
        flatText += node.text[i];
      }
    }
    return true;
  });

  return { flatText, posMap };
}

/**
 * Search the document for text matching the pattern:
 * contextBefore + survivingText + contextAfter
 *
 * Returns the position range of the survivingText within the document.
 */
function findTextPosition(
  doc: ProseMirrorNode,
  data: InlineDiffData,
): { from: number; to: number } | null {
  const { survivingText, contextBefore, contextAfter } = data;

  if (!survivingText && !contextBefore && !contextAfter) return null;

  const { flatText, posMap } = buildFlatText(doc);
  if (posMap.length === 0) return null;

  // Try full pattern first (most precise)
  const searchText = contextBefore + survivingText + contextAfter;
  if (searchText) {
    const searchIdx = flatText.indexOf(searchText);
    if (searchIdx !== -1) {
      return extractPosition(posMap, searchIdx + contextBefore.length, survivingText.length);
    }
  }

  // Fallback: search for surviving text without context
  if (survivingText) {
    const directIdx = flatText.indexOf(survivingText);
    if (directIdx !== -1) {
      return extractPosition(posMap, directIdx, survivingText.length);
    }
  }

  // Fallback: for pure deletions, find position after contextBefore
  if (!survivingText && contextBefore) {
    const ctxIdx = flatText.indexOf(contextBefore);
    if (ctxIdx !== -1) {
      const afterCtx = ctxIdx + contextBefore.length;
      const pos = afterCtx < posMap.length ? posMap[afterCtx] : posMap[posMap.length - 1] + 1;
      return { from: pos, to: pos };
    }
  }

  return null;
}

function extractPosition(
  posMap: number[],
  startIdx: number,
  length: number,
): { from: number; to: number } | null {
  if (length === 0) {
    const pos = startIdx < posMap.length ? posMap[startIdx] : posMap[posMap.length - 1] + 1;
    return { from: pos, to: pos };
  }
  if (startIdx >= posMap.length) return null;
  const from = posMap[startIdx];
  const endIdx = startIdx + length - 1;
  const to = endIdx < posMap.length ? posMap[endIdx] + 1 : from + length;
  return { from, to };
}

/**
 * Create decorations for the inline diff overlay.
 */
function createDecorations(
  doc: ProseMirrorNode,
  data: InlineDiffData,
): DecorationSet {
  const pos = findTextPosition(doc, data);
  if (!pos) return DecorationSet.empty;

  const decorations: Decoration[] = [];
  const isAccepted = data.action === 'accepted';

  // Highlight surviving text
  if (data.survivingText && pos.from < pos.to) {
    decorations.push(
      Decoration.inline(pos.from, pos.to, {
        class: `inline-diff-surviving ${isAccepted ? 'inline-diff-accepted' : 'inline-diff-rejected'}`,
      }),
    );
  }

  // Show ghost text (removed content) as a widget
  if (data.ghostText) {
    const widgetPos = data.ghostPosition === 'before' ? pos.from : pos.to;
    const ghostWidget = Decoration.widget(
      widgetPos,
      () => {
        const wrapper = document.createElement('span');
        wrapper.className = `inline-diff-ghost ${isAccepted ? 'inline-diff-ghost-del' : 'inline-diff-ghost-ins'}`;
        wrapper.textContent = data.ghostText;
        return wrapper;
      },
      {
        side: data.ghostPosition === 'before' ? -1 : 1,
        key: 'inline-diff-ghost',
      },
    );
    decorations.push(ghostWidget);
  }

  return DecorationSet.create(doc, decorations);
}

/**
 * Create the ProseMirror plugin for inline diff decorations.
 */
export function createInlineDiffPlugin(): Plugin {
  return new Plugin<InlineDiffState>({
    key: INLINE_DIFF_KEY,
    state: {
      init(): InlineDiffState {
        return { decorations: DecorationSet.empty, activeData: null };
      },
      apply(tr, prev): InlineDiffState {
        if (tr.getMeta(META_CLEAR)) {
          return { decorations: DecorationSet.empty, activeData: null };
        }

        const newData = tr.getMeta(META_SET) as InlineDiffData | undefined;
        if (newData) {
          return {
            decorations: createDecorations(tr.doc, newData),
            activeData: newData,
          };
        }

        // Auto-clear when the user edits the document
        if (tr.docChanged && prev.activeData) {
          return { decorations: DecorationSet.empty, activeData: null };
        }

        return prev;
      },
    },
    props: {
      decorations(state) {
        return INLINE_DIFF_KEY.getState(state)?.decorations ?? DecorationSet.empty;
      },
    },
  });
}

/**
 * Show an inline diff overlay in the editor.
 */
export function showInlineDiff(view: EditorView, data: InlineDiffData): void {
  const tr = view.state.tr.setMeta(META_SET, data);
  view.dispatch(tr);

  // Scroll to the diff after a frame
  requestAnimationFrame(() => {
    const el = view.dom.querySelector('.inline-diff-surviving, .inline-diff-ghost');
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  });
}

/**
 * Clear the inline diff overlay.
 */
export function clearInlineDiff(view: EditorView): void {
  const state = INLINE_DIFF_KEY.getState(view.state);
  if (state?.activeData) {
    const tr = view.state.tr.setMeta(META_CLEAR, true);
    view.dispatch(tr);
  }
}

/**
 * Check if an inline diff is currently active.
 */
export function hasInlineDiff(view: EditorView): boolean {
  const state = INLINE_DIFF_KEY.getState(view.state);
  return !!state?.activeData;
}
