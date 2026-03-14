import { describe, it, expect, afterEach } from 'vitest';
import {
  createTestEditor,
  simulateTextInput,
  simulateKeyDown,
  simulatePaste,
  findTextWithMark,
  getEditorText,
  setCursor,
  setSelection,
} from './setup';
import {
  getTrackedChanges,
  getBaseText,
  getResultText,
  getPendingChangeCount,
} from '../src/helpers';

describe('Paste handling in suggest mode', () => {
  let editor: ReturnType<typeof createTestEditor>;

  afterEach(() => {
    editor?.destroy();
  });

  it('marks pasted text as an insertion', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });
    setCursor(editor, 7);
    simulatePaste(editor, 'beautiful ');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions).toHaveLength(1);
    expect(insertions[0].text).toBe('beautiful ');
  });

  it('handles paste replacing a selection', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });
    setSelection(editor, 7, 12); // select "world"
    simulatePaste(editor, 'everyone');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions[0].text).toBe('everyone');

    const deletions = findTextWithMark(editor, 'deletion');
    expect(deletions[0].text).toBe('world');
  });

  it('handles multi-line paste', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });
    setCursor(editor, 7);
    simulatePaste(editor, 'big\nwide');

    // Multi-line paste splits into paragraphs with tracked insertions
    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions).toHaveLength(2);
    expect(insertions[0].text).toBe('big');
    expect(insertions[1].text).toBe('wide');

    // The new paragraph should be tracked as inserted
    const doc = editor.state.doc;
    let foundTrackedParagraph = false;
    doc.descendants((node) => {
      if (node.isBlock && node.attrs.dataTracked?.originalType === 'paragraphInserted') {
        foundTrackedParagraph = true;
      }
    });
    expect(foundTrackedParagraph).toBe(true);
  });
});

describe('Mode switching', () => {
  let editor: ReturnType<typeof createTestEditor>;

  afterEach(() => {
    editor?.destroy();
  });

  it('switches from suggest to edit mode', () => {
    editor = createTestEditor({ mode: 'suggest' });
    expect(editor.storage.trackChanges.mode).toBe('suggest');

    editor.commands.setEditMode();
    expect(editor.storage.trackChanges.mode).toBe('edit');
  });

  it('switches from edit to suggest mode', () => {
    editor = createTestEditor({ mode: 'edit' });
    editor.commands.setSuggestMode();
    expect(editor.storage.trackChanges.mode).toBe('suggest');
  });

  it('does not track changes after switching to edit mode', () => {
    editor = createTestEditor({
      content: '<p>Hello world</p>',
      mode: 'suggest',
    });

    // Make a change in suggest mode
    setCursor(editor, 7);
    simulateTextInput(editor, 'big ');

    // Switch to edit mode
    editor.commands.setEditMode();

    // Type in edit mode — should NOT be tracked
    const handled = simulateTextInput(editor, 'test');
    expect(handled).toBe(false);
  });

  it('setTrackChangesMode works for all modes', () => {
    editor = createTestEditor({ mode: 'edit' });

    editor.commands.setTrackChangesMode('suggest');
    expect(editor.storage.trackChanges.mode).toBe('suggest');

    editor.commands.setTrackChangesMode('view');
    expect(editor.storage.trackChanges.mode).toBe('view');

    editor.commands.setTrackChangesMode('edit');
    expect(editor.storage.trackChanges.mode).toBe('edit');
  });
});

describe('Edge cases', () => {
  let editor: ReturnType<typeof createTestEditor>;

  afterEach(() => {
    editor?.destroy();
  });

  it('handles empty document', () => {
    editor = createTestEditor({ content: '<p></p>' });
    setCursor(editor, 1);
    simulateTextInput(editor, 'Hello');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions).toHaveLength(1);
    expect(insertions[0].text).toBe('Hello');
  });

  it('handles select-all and delete', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });
    setSelection(editor, 1, 12); // select all text
    simulateKeyDown(editor, 'Backspace');

    // Text should still exist but be marked as deleted
    expect(getEditorText(editor)).toBe('Hello world');

    const deletions = findTextWithMark(editor, 'deletion');
    expect(deletions).toHaveLength(1);
    expect(deletions[0].text).toBe('Hello world');
  });

  it('handles select-all and replace', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });
    setSelection(editor, 1, 12);
    simulateTextInput(editor, 'Goodbye');

    expect(getBaseText(editor)).toBe('Hello world');
    expect(getResultText(editor)).toBe('Goodbye');
  });

  it('handles very long text insertion', () => {
    editor = createTestEditor({ content: '<p>Hello</p>' });
    setCursor(editor, 6);
    const longText = ' ' + 'a'.repeat(5000);
    simulateTextInput(editor, longText);

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions).toHaveLength(1);
    expect(insertions[0].text).toBe(longText);
  });

  it('handles special characters', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });
    setCursor(editor, 7);
    simulateTextInput(editor, '<script>alert("xss")</script> ');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions).toHaveLength(1);
    // The text should be treated as plain text, not HTML
    expect(insertions[0].text).toBe('<script>alert("xss")</script> ');
  });

  it('handles newline characters in text', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });
    setCursor(editor, 7);
    simulateTextInput(editor, 'line1\nline2 ');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions.length).toBeGreaterThanOrEqual(1);
    // The text should contain both lines (TipTap may handle newlines differently)
    const allInsertedText = insertions.map((i) => i.text).join('');
    expect(allInsertedText).toContain('line1');
    expect(allInsertedText).toContain('line2');
  });

  it('multiple insertions at the same position', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });

    // Insert at position 7 twice with different text
    setCursor(editor, 7);
    simulateTextInput(editor, 'A ');
    // Now cursor is at 9, but let's move back
    setCursor(editor, 7);
    simulateTextInput(editor, 'B ');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions.length).toBe(2);
    const texts = insertions.map((i) => i.text);
    expect(texts).toContain('A ');
    expect(texts).toContain('B ');
  });

  it('handles inserting at a position that has a deletion mark from another author', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });

    // Delete "world"
    setSelection(editor, 7, 12);
    simulateKeyDown(editor, 'Backspace');

    // Now insert at the same position (should still work)
    setCursor(editor, 7);
    simulateTextInput(editor, 'everyone');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions).toHaveLength(1);
    expect(insertions[0].text).toBe('everyone');
  });

  it('getBaseText and getResultText are consistent', () => {
    editor = createTestEditor({
      content: '<p>The quick brown fox</p>',
    });

    // Delete "quick"
    setSelection(editor, 5, 10);
    simulateKeyDown(editor, 'Backspace');

    // Insert "slow"
    setCursor(editor, 5);
    simulateTextInput(editor, 'slow');

    const base = getBaseText(editor);
    const result = getResultText(editor);

    expect(base).toContain('quick');
    expect(base).not.toContain('slow');
    expect(result).toContain('slow');
    expect(result).not.toContain('quick');
  });

  it('accepting then rejecting different changes works correctly', () => {
    editor = createTestEditor({
      content: '<p>Hello world</p>',
    });

    // Insert "beautiful"
    setCursor(editor, 7);
    simulateTextInput(editor, 'beautiful ');

    // Delete "world" (need to find its new position)
    const text = getEditorText(editor);
    const worldStart = text.indexOf('world') + 1;
    const worldEnd = worldStart + 5;
    setSelection(editor, worldStart, worldEnd);
    simulateKeyDown(editor, 'Backspace');

    const changes = getTrackedChanges(editor);
    const insertion = changes.find((c) => c.type === 'insertion');
    const deletion = changes.find((c) => c.type === 'deletion');

    // Accept the insertion
    editor.commands.acceptChange(insertion!.changeId);

    // Reject the deletion
    editor.commands.rejectChange(deletion!.changeId);

    // Result: "Hello beautiful world" — insertion accepted, deletion rejected
    expect(getEditorText(editor)).toBe('Hello beautiful world');
    expect(findTextWithMark(editor, 'insertion')).toHaveLength(0);
    expect(findTextWithMark(editor, 'deletion')).toHaveLength(0);
  });

  it('handles zero pending changes gracefully', () => {
    editor = createTestEditor({ content: '<p>Hello</p>' });

    expect(getPendingChangeCount(editor)).toBe(0);
    expect(getTrackedChanges(editor)).toHaveLength(0);

    // Accept/reject all with no changes should not throw
    editor.commands.acceptAll();
    editor.commands.rejectAll();

    expect(getEditorText(editor)).toBe('Hello');
  });
});
