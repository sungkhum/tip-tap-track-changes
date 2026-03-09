import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestEditor,
  simulateTextInput,
  simulateKeyDown,
  findTextWithMark,
  getEditorText,
  setCursor,
  setSelection,
} from './setup';
import { getTrackedChanges, getPendingChangeCount } from '../src/helpers';
import type { Editor } from '@tiptap/core';

describe('Enter Key Tracking', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = createTestEditor({
      content: '<p>Hello world</p>',
      mode: 'suggest',
    });
  });

  it('Enter in middle of paragraph creates tracked split', () => {
    setCursor(editor, 6); // after "Hello"
    simulateKeyDown(editor, 'Enter');

    // Should have two paragraphs now
    expect(editor.state.doc.childCount).toBe(2);
    expect(editor.state.doc.child(0).textContent).toBe('Hello');
    expect(editor.state.doc.child(1).textContent).toBe(' world');

    // The second paragraph should have dataTracked with paragraphInserted
    const secondPara = editor.state.doc.child(1);
    expect(secondPara.attrs.dataTracked).toBeDefined();
    expect(secondPara.attrs.dataTracked.originalType).toBe('paragraphInserted');
  });

  it('Enter at start of paragraph creates tracked empty paragraph', () => {
    setCursor(editor, 1); // at start of text
    simulateKeyDown(editor, 'Enter');

    expect(editor.state.doc.childCount).toBe(2);
    // First paragraph should be empty and have dataTracked
    const firstPara = editor.state.doc.child(0);
    expect(firstPara.textContent).toBe('');
    expect(firstPara.attrs.dataTracked).toBeDefined();
    expect(firstPara.attrs.dataTracked.originalType).toBe('paragraphInserted');
  });

  it('Enter at end of paragraph creates tracked empty paragraph', () => {
    setCursor(editor, 12); // at end of "Hello world"
    simulateKeyDown(editor, 'Enter');

    expect(editor.state.doc.childCount).toBe(2);
    // Second paragraph should be empty and have dataTracked
    const secondPara = editor.state.doc.child(1);
    expect(secondPara.textContent).toBe('');
    expect(secondPara.attrs.dataTracked).toBeDefined();
    expect(secondPara.attrs.dataTracked.originalType).toBe('paragraphInserted');
  });

  it('Enter is tracked as a pending change', () => {
    setCursor(editor, 6);
    simulateKeyDown(editor, 'Enter');

    expect(getPendingChangeCount(editor)).toBeGreaterThan(0);
  });

  it('accept Enter keeps the split', () => {
    setCursor(editor, 6);
    simulateKeyDown(editor, 'Enter');

    const changes = getTrackedChanges(editor);
    const nodeChange = changes.find(
      (c) => c.type === 'insertion',
    );
    expect(nodeChange).toBeDefined();

    editor.commands.acceptChange(nodeChange!.changeId);

    // Split should remain
    expect(editor.state.doc.childCount).toBe(2);
    // But no dataTracked should remain
    const secondPara = editor.state.doc.child(1);
    expect(secondPara.attrs.dataTracked).toBeNull();
  });

  it('reject Enter rejoins the paragraphs', () => {
    setCursor(editor, 6);
    simulateKeyDown(editor, 'Enter');

    const changes = getTrackedChanges(editor);
    const nodeChange = changes.find(
      (c) => c.type === 'insertion',
    );
    expect(nodeChange).toBeDefined();

    editor.commands.rejectChange(nodeChange!.changeId);

    // Paragraphs should be rejoined
    expect(editor.state.doc.childCount).toBe(1);
    expect(editor.state.doc.child(0).textContent).toBe('Hello world');
  });

  it('Enter with active selection deletes then splits', () => {
    setSelection(editor, 3, 8); // select "llo w"
    simulateKeyDown(editor, 'Enter');

    // Should have two paragraphs
    expect(editor.state.doc.childCount).toBe(2);

    // The selected text should be marked as deleted
    const deletions = findTextWithMark(editor, 'deletion');
    expect(deletions.length).toBeGreaterThan(0);
  });

  it('cursor is placed at start of second paragraph after Enter', () => {
    setCursor(editor, 6);
    simulateKeyDown(editor, 'Enter');

    // Cursor should be in the second paragraph
    const cursorPos = editor.state.selection.from;
    const $pos = editor.state.doc.resolve(cursorPos);
    // Should be in the second paragraph (index 1)
    expect($pos.parent).toBe(editor.state.doc.child(1));
  });

  it('Enter inside existing insertion-marked text splits correctly', () => {
    // First insert some tracked text
    setCursor(editor, 6);
    simulateTextInput(editor, ' there');
    expect(getEditorText(editor)).toBe('Hello there world');

    // Now put cursor in the middle of "there" and press Enter
    setCursor(editor, 9); // middle of "there"
    simulateKeyDown(editor, 'Enter');

    // Should now have two paragraphs
    expect(editor.state.doc.childCount).toBe(2);
  });

  it('Shift+Enter is not intercepted (left as default behavior)', () => {
    setCursor(editor, 6);
    const handled = simulateKeyDown(editor, 'Enter', { shiftKey: true });
    // Should NOT be handled by our plugin
    expect(handled).toBe(false);
  });
});
