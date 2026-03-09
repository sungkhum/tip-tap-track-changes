import { describe, it, expect, afterEach } from 'vitest';
import {
  createTestEditor,
  simulateTextInput,
  simulateKeyDown,
  findTextWithMark,
  getEditorText,
  setCursor,
  setSelection,
  TEST_AUTHOR,
} from './setup';

describe('Deletion tracking in suggest mode', () => {
  let editor: ReturnType<typeof createTestEditor>;

  afterEach(() => {
    editor?.destroy();
  });

  it('marks a character as deleted on Backspace (not actually deleted)', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });
    // Position 12 is after "d" in "Hello world"
    setCursor(editor, 12);
    simulateKeyDown(editor, 'Backspace');

    // Text should still contain "d"
    expect(getEditorText(editor)).toBe('Hello world');

    const deletions = findTextWithMark(editor, 'deletion');
    expect(deletions).toHaveLength(1);
    expect(deletions[0].text).toBe('d');
    expect(deletions[0].attrs.authorId).toBe(TEST_AUTHOR.id);
  });

  it('marks a character as deleted on Delete key', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });
    setCursor(editor, 1); // before "H"
    simulateKeyDown(editor, 'Delete');

    expect(getEditorText(editor)).toBe('Hello world');

    const deletions = findTextWithMark(editor, 'deletion');
    expect(deletions).toHaveLength(1);
    expect(deletions[0].text).toBe('H');
  });

  it('marks entire selection as deleted on Backspace', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });
    setSelection(editor, 7, 12); // select "world"
    simulateKeyDown(editor, 'Backspace');

    expect(getEditorText(editor)).toBe('Hello world');

    const deletions = findTextWithMark(editor, 'deletion');
    expect(deletions).toHaveLength(1);
    expect(deletions[0].text).toBe('world');
  });

  it('marks entire selection as deleted on Delete key', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });
    setSelection(editor, 1, 6); // select "Hello"
    simulateKeyDown(editor, 'Delete');

    expect(getEditorText(editor)).toBe('Hello world');

    const deletions = findTextWithMark(editor, 'deletion');
    expect(deletions).toHaveLength(1);
    expect(deletions[0].text).toBe('Hello');
  });

  it('actually deletes own pending insertions on Backspace', () => {
    editor = createTestEditor({ content: '<p>Hello</p>' });
    // simulateTextInput already imported at top

    // First insert some text
    setCursor(editor, 6);
    simulateTextInput(editor, ' world');

    expect(getEditorText(editor)).toBe('Hello world');

    // Now backspace the last character of our insertion
    simulateKeyDown(editor, 'Backspace');

    // The "d" should be actually deleted (not just marked)
    expect(getEditorText(editor)).toBe('Hello worl');

    // No deletion marks — the character was truly removed
    const deletions = findTextWithMark(editor, 'deletion');
    expect(deletions).toHaveLength(0);
  });

  it('skips over already-deleted text on Backspace', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });

    // Delete "world" via selection
    setSelection(editor, 7, 12);
    simulateKeyDown(editor, 'Backspace');

    // Cursor should be at position 7 (before "world")
    // Now backspace again — should skip over the deleted "world"
    // and delete the space before it
    const cursorBefore = editor.state.selection.from;
    simulateKeyDown(editor, 'Backspace');

    // Cursor should have skipped past the deleted "world" and landed
    // before the deletion boundary (position 6, before the space)
    expect(editor.state.selection.from).toBeLessThan(cursorBefore);
  });

  it('does not create deletion marks in edit mode', () => {
    editor = createTestEditor({
      content: '<p>Hello world</p>',
      mode: 'edit',
    });
    setCursor(editor, 12);
    const handled = simulateKeyDown(editor, 'Backspace');

    expect(handled).toBe(false);

    const deletions = findTextWithMark(editor, 'deletion');
    expect(deletions).toHaveLength(0);
  });

  it('does not delete at start of text on Backspace', () => {
    editor = createTestEditor({ content: '<p>Hello</p>' });
    setCursor(editor, 1); // before "H"
    const handled = simulateKeyDown(editor, 'Backspace');

    // Should return false (not handled, at start of textblock)
    expect(handled).toBe(false);
    expect(getEditorText(editor)).toBe('Hello');
  });

  it('does not delete at end of text on Delete', () => {
    editor = createTestEditor({ content: '<p>Hello</p>' });
    setCursor(editor, 6); // after "o"
    const handled = simulateKeyDown(editor, 'Delete');

    expect(handled).toBe(false);
    expect(getEditorText(editor)).toBe('Hello');
  });

  it('sets cursor before the deleted character on Backspace', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });
    setCursor(editor, 12); // after "d"
    simulateKeyDown(editor, 'Backspace');

    // Cursor should be before "d" (position 11)
    expect(editor.state.selection.from).toBe(11);
  });

  it('handles multiple consecutive deletions', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });
    setCursor(editor, 12); // after "d"

    // Delete "d", "l", "r" via backspace
    simulateKeyDown(editor, 'Backspace'); // marks "d"
    simulateKeyDown(editor, 'Backspace'); // marks "l"
    simulateKeyDown(editor, 'Backspace'); // marks "r"

    expect(getEditorText(editor)).toBe('Hello world');

    const deletions = findTextWithMark(editor, 'deletion');
    // Each character gets a deletion mark
    const deletedText = deletions.map((d) => d.text).join('');
    expect(deletedText).toContain('r');
    expect(deletedText).toContain('l');
    expect(deletedText).toContain('d');
  });
});
