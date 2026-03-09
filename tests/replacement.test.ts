import { describe, it, expect, afterEach } from 'vitest';
import {
  createTestEditor,
  simulateTextInput,
  findTextWithMark,
  getEditorText,
  setSelection,
  TEST_AUTHOR,
} from './setup';

describe('Replacement tracking in suggest mode', () => {
  let editor: ReturnType<typeof createTestEditor>;

  afterEach(() => {
    editor?.destroy();
  });

  it('marks selected text as deleted and new text as inserted', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });
    setSelection(editor, 7, 12); // select "world"
    simulateTextInput(editor, 'everyone');

    // Original text should still be there (marked as deleted)
    const fullText = getEditorText(editor);
    expect(fullText).toContain('world');
    expect(fullText).toContain('everyone');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions).toHaveLength(1);
    expect(insertions[0].text).toBe('everyone');

    const deletions = findTextWithMark(editor, 'deletion');
    expect(deletions).toHaveLength(1);
    expect(deletions[0].text).toBe('world');
  });

  it('uses the same changeId for insertion and deletion in a replacement', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });
    setSelection(editor, 7, 12); // select "world"
    simulateTextInput(editor, 'everyone');

    const insertions = findTextWithMark(editor, 'insertion');
    const deletions = findTextWithMark(editor, 'deletion');

    expect(insertions[0].attrs.changeId).toBe(deletions[0].attrs.changeId);
  });

  it('places cursor after the inserted text', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });
    setSelection(editor, 7, 12); // select "world"
    simulateTextInput(editor, 'everyone');

    // "world" stays (deletion mark), "everyone" inserted after it
    // Cursor should be after "everyone"
    const insertions = findTextWithMark(editor, 'insertion');
    expect(editor.state.selection.from).toBe(insertions[0].to);
  });

  it('handles replacing entire document text', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });
    setSelection(editor, 1, 12); // select everything
    simulateTextInput(editor, 'Goodbye');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions).toHaveLength(1);
    expect(insertions[0].text).toBe('Goodbye');

    const deletions = findTextWithMark(editor, 'deletion');
    expect(deletions).toHaveLength(1);
    expect(deletions[0].text).toBe('Hello world');
  });

  it('handles replacing a single character', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });
    setSelection(editor, 1, 2); // select "H"
    simulateTextInput(editor, 'h');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions).toHaveLength(1);
    expect(insertions[0].text).toBe('h');

    const deletions = findTextWithMark(editor, 'deletion');
    expect(deletions).toHaveLength(1);
    expect(deletions[0].text).toBe('H');
  });

  it('handles replacing with longer text', () => {
    editor = createTestEditor({ content: '<p>Hi</p>' });
    setSelection(editor, 1, 3); // select "Hi"
    simulateTextInput(editor, 'Hello there');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions[0].text).toBe('Hello there');

    const deletions = findTextWithMark(editor, 'deletion');
    expect(deletions[0].text).toBe('Hi');
  });

  it('handles replacing with shorter text', () => {
    editor = createTestEditor({ content: '<p>Hello there</p>' });
    setSelection(editor, 1, 12); // select "Hello there"
    simulateTextInput(editor, 'Hi');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions[0].text).toBe('Hi');

    const deletions = findTextWithMark(editor, 'deletion');
    expect(deletions[0].text).toBe('Hello there');
  });

  it('attributes replacement to the correct author', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });
    setSelection(editor, 7, 12);
    simulateTextInput(editor, 'everyone');

    const insertions = findTextWithMark(editor, 'insertion');
    const deletions = findTextWithMark(editor, 'deletion');

    expect(insertions[0].attrs.authorId).toBe(TEST_AUTHOR.id);
    expect(deletions[0].attrs.authorId).toBe(TEST_AUTHOR.id);
  });
});
