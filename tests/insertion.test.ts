import { describe, it, expect, afterEach } from 'vitest';
import {
  createTestEditor,
  simulateTextInput,
  findTextWithMark,
  getEditorText,
  setCursor,
  TEST_AUTHOR,
} from './setup';

describe('Insertion tracking in suggest mode', () => {
  let editor: ReturnType<typeof createTestEditor>;

  afterEach(() => {
    editor?.destroy();
  });

  it('marks typed text as an insertion', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });
    // "Hello world" → positions: 1=H, 2=e, 3=l, 4=l, 5=o, 6= , 7=w, 8=o, 9=r, 10=l, 11=d
    // Set cursor after "Hello " (position 7)
    setCursor(editor, 7);
    simulateTextInput(editor, 'beautiful ');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions).toHaveLength(1);
    expect(insertions[0].text).toBe('beautiful ');
    expect(insertions[0].attrs.authorId).toBe(TEST_AUTHOR.id);
    expect(insertions[0].attrs.authorName).toBe(TEST_AUTHOR.name);
    expect(insertions[0].attrs.authorColor).toBe(TEST_AUTHOR.color);
    expect(insertions[0].attrs.changeId).toBeTruthy();
    expect(insertions[0].attrs.timestamp).toBeTruthy();
  });

  it('preserves existing text unchanged', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });
    setCursor(editor, 7);
    simulateTextInput(editor, 'big ');

    const fullText = getEditorText(editor);
    expect(fullText).toBe('Hello big world');
  });

  it('inserts at the beginning of text', () => {
    editor = createTestEditor({ content: '<p>world</p>' });
    setCursor(editor, 1); // before "w"
    simulateTextInput(editor, 'Hello ');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions).toHaveLength(1);
    expect(insertions[0].text).toBe('Hello ');
    expect(getEditorText(editor)).toBe('Hello world');
  });

  it('inserts at the end of text', () => {
    editor = createTestEditor({ content: '<p>Hello</p>' });
    setCursor(editor, 6); // after "o"
    simulateTextInput(editor, ' world');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions).toHaveLength(1);
    expect(insertions[0].text).toBe(' world');
    expect(getEditorText(editor)).toBe('Hello world');
  });

  it('coalesces consecutive insertions from the same author', () => {
    editor = createTestEditor({ content: '<p>Hello</p>' });
    setCursor(editor, 6);

    // Type character by character
    simulateTextInput(editor, ' ');
    simulateTextInput(editor, 'w');
    simulateTextInput(editor, 'o');
    simulateTextInput(editor, 'r');
    simulateTextInput(editor, 'l');
    simulateTextInput(editor, 'd');

    const insertions = findTextWithMark(editor, 'insertion');
    // All should share the same changeId (coalesced)
    const changeIds = new Set(insertions.map((i) => i.attrs.changeId));
    expect(changeIds.size).toBe(1);

    expect(getEditorText(editor)).toBe('Hello world');
  });

  it('does not create insertion marks in edit mode', () => {
    editor = createTestEditor({
      content: '<p>Hello world</p>',
      mode: 'edit',
    });
    setCursor(editor, 7);

    // handleTextInput should return false (not handled) in edit mode
    const handled = simulateTextInput(editor, 'big ');
    expect(handled).toBe(false);
  });

  it('inserts into empty paragraph', () => {
    editor = createTestEditor({ content: '<p></p>' });
    setCursor(editor, 1);
    simulateTextInput(editor, 'Hello');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions).toHaveLength(1);
    expect(insertions[0].text).toBe('Hello');
  });

  it('handles multi-character input (like paste via handleTextInput)', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });
    setCursor(editor, 6);
    simulateTextInput(editor, ' beautiful and wonderful');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions).toHaveLength(1);
    expect(insertions[0].text).toBe(' beautiful and wonderful');
    expect(getEditorText(editor)).toBe('Hello beautiful and wonderful world');
  });

  it('sets cursor position after insertion', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });
    setCursor(editor, 7);
    simulateTextInput(editor, 'big ');

    // Cursor should be after the inserted text
    expect(editor.state.selection.from).toBe(11); // 7 + 4 ("big ")
  });

  it('timestamps each insertion', () => {
    editor = createTestEditor({ content: '<p>Hello</p>' });
    setCursor(editor, 6);
    simulateTextInput(editor, ' world');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions[0].attrs.timestamp).toBeTruthy();

    // Validate it's a parseable ISO date
    const date = new Date(insertions[0].attrs.timestamp as string);
    expect(date.getTime()).not.toBeNaN();
  });
});
