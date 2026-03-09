import { describe, it, expect, afterEach } from 'vitest';
import {
  createTestEditor,
  simulateTextInput,
  simulateKeyDown,
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

describe('Accept changes', () => {
  let editor: ReturnType<typeof createTestEditor>;

  afterEach(() => {
    editor?.destroy();
  });

  it('accepts an insertion — mark removed, text stays', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });
    setCursor(editor, 7);
    simulateTextInput(editor, 'beautiful ');

    const changes = getTrackedChanges(editor);
    const insertionChange = changes.find((c) => c.type === 'insertion');
    expect(insertionChange).toBeTruthy();

    editor.commands.acceptChange(insertionChange!.changeId);

    // Text should remain
    expect(getEditorText(editor)).toBe('Hello beautiful world');

    // No more insertion marks
    const remainingInsertions = findTextWithMark(editor, 'insertion');
    expect(remainingInsertions).toHaveLength(0);
  });

  it('accepts a deletion — text is actually deleted', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });
    setSelection(editor, 7, 12); // select "world"
    simulateKeyDown(editor, 'Backspace');

    const changes = getTrackedChanges(editor);
    const deletionChange = changes.find((c) => c.type === 'deletion');
    expect(deletionChange).toBeTruthy();

    editor.commands.acceptChange(deletionChange!.changeId);

    // "world" should be actually gone
    expect(getEditorText(editor)).toBe('Hello ');
  });

  it('accepts a replacement — insertion stays, deletion removed', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });
    setSelection(editor, 7, 12); // select "world"
    simulateTextInput(editor, 'everyone');

    const changes = getTrackedChanges(editor);
    const changeId = changes[0].changeId;

    editor.commands.acceptChange(changeId);

    // "world" should be gone, "everyone" should remain without marks
    expect(getEditorText(editor)).toBe('Hello everyone');
    expect(findTextWithMark(editor, 'insertion')).toHaveLength(0);
    expect(findTextWithMark(editor, 'deletion')).toHaveLength(0);
  });

  it('acceptAll removes all tracked changes', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });

    // Make multiple changes
    setCursor(editor, 7);
    simulateTextInput(editor, 'beautiful ');

    setCursor(editor, 1);
    simulateTextInput(editor, 'Oh, ');

    expect(getPendingChangeCount(editor)).toBe(2);

    editor.commands.acceptAll();

    expect(findTextWithMark(editor, 'insertion')).toHaveLength(0);
    expect(findTextWithMark(editor, 'deletion')).toHaveLength(0);
    expect(getEditorText(editor)).toContain('Oh,');
    expect(getEditorText(editor)).toContain('beautiful');
  });
});

describe('Reject changes', () => {
  let editor: ReturnType<typeof createTestEditor>;

  afterEach(() => {
    editor?.destroy();
  });

  it('rejects an insertion — text is removed', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });
    setCursor(editor, 7);
    simulateTextInput(editor, 'beautiful ');

    const changes = getTrackedChanges(editor);
    const insertionChange = changes.find((c) => c.type === 'insertion');

    editor.commands.rejectChange(insertionChange!.changeId);

    // Inserted text should be gone
    expect(getEditorText(editor)).toBe('Hello world');
    expect(findTextWithMark(editor, 'insertion')).toHaveLength(0);
  });

  it('rejects a deletion — mark removed, text restored', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });
    setSelection(editor, 7, 12); // select "world"
    simulateKeyDown(editor, 'Backspace');

    const changes = getTrackedChanges(editor);
    const deletionChange = changes.find((c) => c.type === 'deletion');

    editor.commands.rejectChange(deletionChange!.changeId);

    // Text should remain without deletion marks
    expect(getEditorText(editor)).toBe('Hello world');
    expect(findTextWithMark(editor, 'deletion')).toHaveLength(0);
  });

  it('rejects a replacement — insertion removed, deletion unmarked', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });
    setSelection(editor, 7, 12); // select "world"
    simulateTextInput(editor, 'everyone');

    const changes = getTrackedChanges(editor);
    const changeId = changes[0].changeId;

    editor.commands.rejectChange(changeId);

    // "everyone" should be gone, "world" should remain without marks
    expect(getEditorText(editor)).toBe('Hello world');
    expect(findTextWithMark(editor, 'insertion')).toHaveLength(0);
    expect(findTextWithMark(editor, 'deletion')).toHaveLength(0);
  });

  it('rejectAll removes all tracked changes', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });

    // Make an insertion
    setCursor(editor, 7);
    simulateTextInput(editor, 'beautiful ');

    // Make a deletion
    setSelection(editor, 1, 6);
    simulateKeyDown(editor, 'Backspace');

    expect(getPendingChangeCount(editor)).toBe(2);

    editor.commands.rejectAll();

    // All changes undone — back to original
    expect(getEditorText(editor)).toBe('Hello world');
    expect(findTextWithMark(editor, 'insertion')).toHaveLength(0);
    expect(findTextWithMark(editor, 'deletion')).toHaveLength(0);
  });
});

describe('Helper functions', () => {
  let editor: ReturnType<typeof createTestEditor>;

  afterEach(() => {
    editor?.destroy();
  });

  it('getBaseText returns original text without insertions', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });
    setCursor(editor, 7);
    simulateTextInput(editor, 'beautiful ');

    expect(getBaseText(editor)).toBe('Hello world');
  });

  it('getResultText returns text with insertions and without deletions', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });
    setSelection(editor, 7, 12);
    simulateTextInput(editor, 'everyone');

    expect(getResultText(editor)).toBe('Hello everyone');
  });

  it('getPendingChangeCount returns correct count', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });

    expect(getPendingChangeCount(editor)).toBe(0);

    setCursor(editor, 7);
    simulateTextInput(editor, 'beautiful ');

    expect(getPendingChangeCount(editor)).toBe(1);
  });

  it('getTrackedChanges returns all changes with metadata', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });
    setCursor(editor, 7);
    simulateTextInput(editor, 'big ');

    const changes = getTrackedChanges(editor);
    expect(changes).toHaveLength(1);

    const insertion = changes[0];
    expect(insertion.type).toBe('insertion');
    expect(insertion.text).toBe('big ');
    expect(insertion.authorId).toBe('user-1');
    expect(insertion.authorName).toBe('Test User');
    expect(insertion.authorColor).toBe('#4285f4');
    expect(new Date(insertion.timestamp).getTime()).not.toBeNaN();
  });
});
