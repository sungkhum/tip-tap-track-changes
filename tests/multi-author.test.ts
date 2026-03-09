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
  SECOND_AUTHOR,
} from './setup';
import type { ChangeAuthor } from '../src/types';

const THIRD_AUTHOR: ChangeAuthor = {
  id: 'user-3',
  name: 'Editor',
  color: '#7c6b3b',
};
import { getTrackedChanges } from '../src/helpers';

describe('Multi-author track changes', () => {
  let editor: ReturnType<typeof createTestEditor>;

  afterEach(() => {
    editor?.destroy();
  });

  it('tracks changes from different authors with distinct attribution', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });

    // Author 1 makes an insertion
    setCursor(editor, 7);
    simulateTextInput(editor, 'beautiful ');

    // Switch author
    editor.commands.setTrackChangesAuthor(SECOND_AUTHOR);

    // Author 2 makes an insertion
    setCursor(editor, 1);
    simulateTextInput(editor, 'Oh, ');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions.length).toBe(2);

    const author1Insertions = insertions.filter(
      (i) => i.attrs.authorId === TEST_AUTHOR.id,
    );
    const author2Insertions = insertions.filter(
      (i) => i.attrs.authorId === SECOND_AUTHOR.id,
    );

    expect(author1Insertions).toHaveLength(1);
    expect(author1Insertions[0].text).toBe('beautiful ');
    expect(author1Insertions[0].attrs.authorColor).toBe(TEST_AUTHOR.color);

    expect(author2Insertions).toHaveLength(1);
    expect(author2Insertions[0].text).toBe('Oh, ');
    expect(author2Insertions[0].attrs.authorColor).toBe(SECOND_AUTHOR.color);
  });

  it('tracks a third author with distinct identity', () => {
    editor = createTestEditor({
      content: '<p>The alliance of mercy was established</p>',
      author: THIRD_AUTHOR,
    });

    // Third author suggests replacing "alliance" with "covenant"
    setSelection(editor, 5, 13); // select "alliance"
    simulateTextInput(editor, 'covenant');

    const changes = getTrackedChanges(editor);
    const thirdAuthorChanges = changes.filter((c) => c.authorId === THIRD_AUTHOR.id);
    expect(thirdAuthorChanges.length).toBeGreaterThan(0);

    const insertion = thirdAuthorChanges.find((c) => c.type === 'insertion');
    expect(insertion?.text).toBe('covenant');
    expect(insertion?.authorColor).toBe(THIRD_AUTHOR.color);
  });

  it('accepting one authors change does not affect anothers', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });

    // Author 1 inserts
    setCursor(editor, 7);
    simulateTextInput(editor, 'beautiful ');

    // Switch to author 2
    editor.commands.setTrackChangesAuthor(SECOND_AUTHOR);
    setCursor(editor, 1);
    simulateTextInput(editor, 'Oh, ');

    // Accept author 1's change
    const changes = getTrackedChanges(editor);
    const author1Change = changes.find(
      (c) => c.authorId === TEST_AUTHOR.id,
    );
    editor.commands.acceptChange(author1Change!.changeId);

    // Author 1's insertion should be accepted (no mark)
    const remainingInsertions = findTextWithMark(editor, 'insertion');
    const author1Remaining = remainingInsertions.filter(
      (i) => i.attrs.authorId === TEST_AUTHOR.id,
    );
    expect(author1Remaining).toHaveLength(0);

    // Author 2's insertion should still be pending
    const author2Remaining = remainingInsertions.filter(
      (i) => i.attrs.authorId === SECOND_AUTHOR.id,
    );
    expect(author2Remaining).toHaveLength(1);
  });

  it('author 2 can delete author 1s text (marks as deletion, not removes insertion)', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });

    // Switch to author 2 who wants to delete "world"
    editor.commands.setTrackChangesAuthor(SECOND_AUTHOR);
    setSelection(editor, 7, 12);
    simulateKeyDown(editor, 'Backspace');

    const deletions = findTextWithMark(editor, 'deletion');
    expect(deletions).toHaveLength(1);
    expect(deletions[0].text).toBe('world');
    expect(deletions[0].attrs.authorId).toBe(SECOND_AUTHOR.id);
  });

  it('different authors get different changeIds', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });

    setCursor(editor, 7);
    simulateTextInput(editor, 'A ');

    editor.commands.setTrackChangesAuthor(SECOND_AUTHOR);
    setCursor(editor, 1);
    simulateTextInput(editor, 'B ');

    const changes = getTrackedChanges(editor);
    const changeIds = new Set(changes.map((c) => c.changeId));
    expect(changeIds.size).toBe(2);
  });

  it('handles three authors making changes to the same text', () => {
    editor = createTestEditor({ content: '<p>The quick brown fox</p>' });

    // Author 1: insert at beginning
    setCursor(editor, 1);
    simulateTextInput(editor, 'Once, ');

    // Author 2: delete "quick"
    editor.commands.setTrackChangesAuthor(SECOND_AUTHOR);
    setSelection(editor, 11, 16); // "quick" (shifted by "Once, ")
    simulateKeyDown(editor, 'Backspace');

    // Third author: insert after "brown"
    editor.commands.setTrackChangesAuthor(THIRD_AUTHOR);
    // Find position after "brown"
    const text = getEditorText(editor);
    const brownEnd = text.indexOf('brown') + 'brown'.length + 1;
    setCursor(editor, brownEnd);
    simulateTextInput(editor, ' lazy');

    const changes = getTrackedChanges(editor);
    const authorIds = new Set(changes.map((c) => c.authorId));
    expect(authorIds.size).toBe(3);
    expect(authorIds.has(TEST_AUTHOR.id)).toBe(true);
    expect(authorIds.has(SECOND_AUTHOR.id)).toBe(true);
    expect(authorIds.has(THIRD_AUTHOR.id)).toBe(true);
  });
});
