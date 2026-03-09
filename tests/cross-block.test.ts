import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestEditor,
  simulateKeyDown,
  getEditorText,
  setCursor,
} from './setup';
import { getTrackedChanges, getPendingChangeCount } from '../src/helpers';
import type { Editor } from '@tiptap/core';

describe('Cross-Block Deletion', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = createTestEditor({
      content: '<p>First paragraph</p><p>Second paragraph</p>',
      mode: 'suggest',
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  it('Backspace at start of second paragraph adds dataTracked', () => {
    // First paragraph: pos 1-16, closing at 17. Second paragraph starts at 17, text at 18.
    setCursor(editor, 18); // start of second paragraph text
    simulateKeyDown(editor, 'Backspace');

    // Should still have two paragraphs (not joined yet)
    expect(editor.state.doc.childCount).toBe(2);

    // Second paragraph should have dataTracked with boundaryDeleted
    const secondPara = editor.state.doc.child(1);
    expect(secondPara.attrs.dataTracked).toBeDefined();
    expect(secondPara.attrs.dataTracked.originalType).toBe('boundaryDeleted');
  });

  it('Delete at end of first paragraph adds dataTracked to next paragraph', () => {
    setCursor(editor, 16); // end of "First paragraph"
    simulateKeyDown(editor, 'Delete');

    // Should still have two paragraphs
    expect(editor.state.doc.childCount).toBe(2);

    // Second paragraph should have dataTracked with boundaryDeleted
    const secondPara = editor.state.doc.child(1);
    expect(secondPara.attrs.dataTracked).toBeDefined();
    expect(secondPara.attrs.dataTracked.originalType).toBe('boundaryDeleted');
  });

  it('boundary deletion is tracked as pending change', () => {
    setCursor(editor, 18); // start of second paragraph
    simulateKeyDown(editor, 'Backspace');

    expect(getPendingChangeCount(editor)).toBeGreaterThan(0);
  });

  it('accept boundary deletion joins paragraphs', () => {
    setCursor(editor, 18);
    simulateKeyDown(editor, 'Backspace');

    const changes = getTrackedChanges(editor);
    const nodeChange = changes.find(
      (c) => c.type === 'deletion',
    );
    expect(nodeChange).toBeDefined();

    editor.commands.acceptChange(nodeChange!.changeId);

    // Should now be one paragraph
    expect(editor.state.doc.childCount).toBe(1);
    expect(editor.state.doc.child(0).textContent).toBe('First paragraphSecond paragraph');
  });

  it('reject boundary deletion keeps paragraphs separate', () => {
    setCursor(editor, 18);
    simulateKeyDown(editor, 'Backspace');

    const changes = getTrackedChanges(editor);
    const nodeChange = changes.find(
      (c) => c.type === 'deletion',
    );
    expect(nodeChange).toBeDefined();

    editor.commands.rejectChange(nodeChange!.changeId);

    // Should still have two separate paragraphs
    expect(editor.state.doc.childCount).toBe(2);
    expect(editor.state.doc.child(0).textContent).toBe('First paragraph');
    expect(editor.state.doc.child(1).textContent).toBe('Second paragraph');
  });

  it('Backspace at start of first paragraph does nothing', () => {
    setCursor(editor, 1); // very start of first paragraph
    const handled = simulateKeyDown(editor, 'Backspace');

    // Should not be handled (no previous block to join with)
    expect(handled).toBe(false);
    expect(editor.state.doc.childCount).toBe(2);
  });

  it('Delete at end of last paragraph does nothing', () => {
    setCursor(editor, 34); // end of "Second paragraph"
    const handled = simulateKeyDown(editor, 'Delete');

    // Should not be handled (no next block to join with)
    expect(handled).toBe(false);
    expect(editor.state.doc.childCount).toBe(2);
  });

  it('acceptAll handles boundary deletions', () => {
    setCursor(editor, 18);
    simulateKeyDown(editor, 'Backspace');

    editor.commands.acceptAll();

    // Should be one paragraph
    expect(editor.state.doc.childCount).toBe(1);
  });

  it('rejectAll handles boundary deletions', () => {
    setCursor(editor, 18);
    simulateKeyDown(editor, 'Backspace');

    editor.commands.rejectAll();

    // Should still be two paragraphs
    expect(editor.state.doc.childCount).toBe(2);
    expect(editor.state.doc.child(0).textContent).toBe('First paragraph');
    expect(editor.state.doc.child(1).textContent).toBe('Second paragraph');
  });

  it('multiple boundary deletions tracked independently', () => {
    // Create 3 paragraphs
    editor = createTestEditor({
      content: '<p>First</p><p>Second</p><p>Third</p>',
      mode: 'suggest',
    });

    // Delete at end of first paragraph
    setCursor(editor, 6); // end of "First"
    simulateKeyDown(editor, 'Delete');

    // Backspace at start of third paragraph
    setCursor(editor, 16); // start of "Third"
    simulateKeyDown(editor, 'Backspace');

    const changes = getTrackedChanges(editor);
    const deletions = changes.filter((c) => c.type === 'deletion');
    expect(deletions.length).toBe(2);
  });
});
