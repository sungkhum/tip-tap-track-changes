import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Bold from '@tiptap/extension-bold';
import Italic from '@tiptap/extension-italic';
import Strike from '@tiptap/extension-strike';
import History from '@tiptap/extension-history';
import { TrackChangesExtension } from '../src/extension';
import type { ChangeAuthor, TrackChangesMode } from '../src/types';

export const TEST_AUTHOR: ChangeAuthor = {
  id: 'user-1',
  name: 'Test User',
  color: '#4285f4',
};

export const SECOND_AUTHOR: ChangeAuthor = {
  id: 'user-2',
  name: 'Jane Smith',
  color: '#ea4335',
};

export interface CreateEditorOptions {
  content?: string;
  mode?: TrackChangesMode;
  author?: ChangeAuthor;
  withFormatting?: boolean;
  withHistory?: boolean;
}

export function createTestEditor(options: CreateEditorOptions = {}): Editor {
  const {
    content = '<p>Hello world</p>',
    mode = 'suggest',
    author = TEST_AUTHOR,
    withFormatting = false,
    withHistory = false,
  } = options;

  const extensions = [
    Document,
    Paragraph,
    Text,
    TrackChangesExtension.configure({
      author,
      mode,
    }),
  ];

  if (withFormatting) {
    extensions.push(Bold, Italic, Strike);
  }

  if (withHistory) {
    extensions.push(History);
  }

  return new Editor({
    extensions,
    content,
  });
}

/**
 * Simulate text input through the editor's handleTextInput handler.
 * Returns true if the handler processed the input.
 */
export function simulateTextInput(
  editor: Editor,
  text: string,
  from?: number,
  to?: number,
): boolean {
  const resolvedFrom = from ?? editor.state.selection.from;
  const resolvedTo = to ?? editor.state.selection.to;

  const result = editor.view.someProp('handleTextInput', (handler) =>
    handler(editor.view, resolvedFrom, resolvedTo, text),
  );

  return result ?? false;
}

/**
 * Simulate a keydown event through the editor's handleKeyDown handler.
 */
export function simulateKeyDown(
  editor: Editor,
  key: string,
  modifiers: { ctrlKey?: boolean; shiftKey?: boolean; metaKey?: boolean } = {},
): boolean {
  const event = new KeyboardEvent('keydown', {
    key,
    ...modifiers,
    bubbles: true,
  });

  const result = editor.view.someProp('handleKeyDown', (handler) =>
    handler(editor.view, event),
  );

  return result ?? false;
}

/**
 * Simulate paste through the editor's handlePaste handler.
 */
export function simulatePaste(editor: Editor, text: string): boolean {
  // jsdom doesn't have ClipboardEvent/DataTransfer, so build a full mock
  const clipboardData = {
    getData: (type: string) => (type === 'text/plain' ? text : ''),
    setData: () => {},
    types: ['text/plain'],
  };

  const event = new Event('paste', { bubbles: true }) as unknown as ClipboardEvent;
  Object.defineProperty(event, 'clipboardData', { value: clipboardData });

  const result = editor.view.someProp('handlePaste', (handler) =>
    handler(editor.view, event, editor.view.state.doc.slice(0)),
  );

  return result ?? false;
}

/**
 * Find all text nodes in the document that have a specific mark type.
 */
export function findTextWithMark(
  editor: Editor,
  markName: string,
): Array<{ text: string; attrs: Record<string, unknown>; from: number; to: number }> {
  const results: Array<{
    text: string;
    attrs: Record<string, unknown>;
    from: number;
    to: number;
  }> = [];

  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return;

    const mark = node.marks.find((m) => m.type.name === markName);
    if (mark) {
      results.push({
        text: node.text ?? '',
        attrs: mark.attrs,
        from: pos,
        to: pos + node.nodeSize,
      });
    }
  });

  return results;
}

/**
 * Get the full text content of the editor, ignoring marks.
 */
export function getEditorText(editor: Editor): string {
  return editor.state.doc.textContent;
}

/**
 * Set the cursor to a specific position.
 */
export function setCursor(editor: Editor, pos: number): void {
  editor.commands.setTextSelection(pos);
}

/**
 * Set a text selection range.
 */
export function setSelection(editor: Editor, from: number, to: number): void {
  editor.commands.setTextSelection({ from, to });
}
