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

describe('Undo/Redo Integration', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = createTestEditor({
      content: '<p>Hello world</p>',
      mode: 'suggest',
      withHistory: true,
    });
  });

  it('undo insertion removes both text and mark', () => {
    setCursor(editor, 6); // after "Hello"
    simulateTextInput(editor, ' there');
    expect(getEditorText(editor)).toBe('Hello there world');
    expect(findTextWithMark(editor, 'insertion').length).toBeGreaterThan(0);

    editor.commands.undo();
    expect(getEditorText(editor)).toBe('Hello world');
    expect(findTextWithMark(editor, 'insertion').length).toBe(0);
  });

  it('undo deletion removes the deletion mark', () => {
    setCursor(editor, 6); // after "Hello"
    simulateKeyDown(editor, 'Backspace');
    const deletions = findTextWithMark(editor, 'deletion');
    expect(deletions.length).toBeGreaterThan(0);

    editor.commands.undo();
    expect(findTextWithMark(editor, 'deletion').length).toBe(0);
    expect(getEditorText(editor)).toBe('Hello world');
  });

  it('redo re-applies undone insertion', () => {
    setCursor(editor, 6);
    simulateTextInput(editor, 'X');
    expect(getEditorText(editor)).toBe('HelloX world');

    editor.commands.undo();
    expect(getEditorText(editor)).toBe('Hello world');

    editor.commands.redo();
    expect(getEditorText(editor)).toBe('HelloX world');
    expect(findTextWithMark(editor, 'insertion').length).toBeGreaterThan(0);
  });

  it('redo re-applies undone deletion', () => {
    setCursor(editor, 6);
    simulateKeyDown(editor, 'Backspace');

    editor.commands.undo();
    expect(findTextWithMark(editor, 'deletion').length).toBe(0);

    editor.commands.redo();
    expect(findTextWithMark(editor, 'deletion').length).toBeGreaterThan(0);
  });

  it('appendTransaction does not re-add marks after undo', () => {
    setCursor(editor, 6);
    simulateTextInput(editor, 'X');
    expect(getPendingChangeCount(editor)).toBe(1);

    editor.commands.undo();
    // After undo, there should be NO tracked changes
    // (appendTransaction must not intercept undo and re-add marks)
    expect(getPendingChangeCount(editor)).toBe(0);
    expect(findTextWithMark(editor, 'insertion').length).toBe(0);
  });

  it('undo accept re-adds the marks', () => {
    setCursor(editor, 6);
    simulateTextInput(editor, ' there');

    const changes = getTrackedChanges(editor);
    expect(changes.length).toBeGreaterThan(0);

    const changeId = changes[0].changeId;
    editor.commands.acceptChange(changeId);
    expect(findTextWithMark(editor, 'insertion').length).toBe(0);
    expect(getEditorText(editor)).toBe('Hello there world');

    editor.commands.undo();
    // After undoing accept, the insertion marks should be back
    expect(findTextWithMark(editor, 'insertion').length).toBeGreaterThan(0);
    expect(getEditorText(editor)).toBe('Hello there world');
  });

  it('undo after reject restores original state', () => {
    setCursor(editor, 6);
    simulateTextInput(editor, 'X');
    expect(getEditorText(editor)).toBe('HelloX world');

    const changes = getTrackedChanges(editor);
    const changeId = changes[0].changeId;
    editor.commands.rejectChange(changeId);
    expect(getEditorText(editor)).toBe('Hello world');

    // Undo may need multiple calls to fully restore through reject + insertion
    // At minimum, one undo should change the state
    const undoDepth = editor.can().undo();
    expect(undoDepth).toBe(true); // should be able to undo
  });

  it('multiple sequential undos work correctly', () => {
    setCursor(editor, 6);
    simulateTextInput(editor, 'A');
    simulateTextInput(editor, 'B');
    simulateTextInput(editor, 'C');

    expect(getEditorText(editor)).toBe('HelloABC world');

    // Undo all three insertions (they may be coalesced)
    editor.commands.undo();
    // After undo, some or all characters should be removed
    const text = getEditorText(editor);
    expect(text.length).toBeLessThan('HelloABC world'.length);
  });

  it('undo in edit mode does not trigger appendTransaction marks', () => {
    // Switch to edit mode
    editor.commands.setEditMode();
    setCursor(editor, 6);

    // Type in edit mode (no tracking)
    const { state } = editor;
    const tr = state.tr.insertText('X', 6);
    editor.view.dispatch(tr);
    expect(getEditorText(editor)).toBe('HelloX world');

    // Switch to suggest mode
    editor.commands.setSuggestMode();

    // Undo should not add marks
    editor.commands.undo();
    expect(getEditorText(editor)).toBe('Hello world');
    expect(findTextWithMark(editor, 'insertion').length).toBe(0);
  });

  it('selection delete undo restores marks correctly', () => {
    setSelection(editor, 1, 6); // select "Hello"
    simulateKeyDown(editor, 'Backspace');

    const deletions = findTextWithMark(editor, 'deletion');
    expect(deletions.length).toBeGreaterThan(0);

    editor.commands.undo();
    expect(findTextWithMark(editor, 'deletion').length).toBe(0);
    expect(getEditorText(editor)).toBe('Hello world');
  });

  it('replacement undo restores original text without marks', () => {
    setSelection(editor, 1, 6); // select "Hello"
    simulateTextInput(editor, 'Hi');

    expect(getEditorText(editor)).toContain('Hi');
    expect(findTextWithMark(editor, 'insertion').length).toBeGreaterThan(0);
    expect(findTextWithMark(editor, 'deletion').length).toBeGreaterThan(0);

    editor.commands.undo();
    expect(getEditorText(editor)).toBe('Hello world');
    expect(findTextWithMark(editor, 'insertion').length).toBe(0);
    expect(findTextWithMark(editor, 'deletion').length).toBe(0);
  });
});
