import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTestEditor,
  findTextWithMark,
  getEditorText,
  setCursor,
  setSelection,
} from './setup';
import { getTrackedChanges, getPendingChangeCount } from '../src/helpers';
import type { Editor } from '@tiptap/core';

describe('Format Change Tracking', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = createTestEditor({
      content: '<p>Hello world</p>',
      mode: 'suggest',
      withFormatting: true,
    });
  });

  it('toggling bold in suggest mode creates formatChange mark', () => {
    setSelection(editor, 1, 6); // select "Hello"
    editor.commands.toggleBold();

    const formatChanges = findTextWithMark(editor, 'formatChange');
    expect(formatChanges.length).toBeGreaterThan(0);
    expect(formatChanges[0].attrs.formatAdded).toBe('bold');
  });

  it('toggling italic in suggest mode creates formatChange mark', () => {
    setSelection(editor, 1, 6);
    editor.commands.toggleItalic();

    const formatChanges = findTextWithMark(editor, 'formatChange');
    expect(formatChanges.length).toBeGreaterThan(0);
    expect(formatChanges[0].attrs.formatAdded).toBe('italic');
  });

  it('removing bold from bold text creates formatChange with formatRemoved', () => {
    // First set content with bold text
    editor = createTestEditor({
      content: '<p><strong>Hello</strong> world</p>',
      mode: 'suggest',
      withFormatting: true,
    });

    setSelection(editor, 1, 6); // select "Hello"
    editor.commands.toggleBold(); // remove bold

    const formatChanges = findTextWithMark(editor, 'formatChange');
    expect(formatChanges.length).toBeGreaterThan(0);
    expect(formatChanges[0].attrs.formatRemoved).toBe('bold');
  });

  it('format change is tracked as pending change', () => {
    setSelection(editor, 1, 6);
    editor.commands.toggleBold();

    expect(getPendingChangeCount(editor)).toBeGreaterThan(0);
  });

  it('accept formatChange keeps the formatting', () => {
    setSelection(editor, 1, 6);
    editor.commands.toggleBold();

    const changes = getTrackedChanges(editor);
    const formatChange = changes.find((c) => c.type === 'formatChange');
    expect(formatChange).toBeDefined();

    editor.commands.acceptChange(formatChange!.changeId);

    // Bold should remain
    const boldMarks = findTextWithMark(editor, 'bold');
    expect(boldMarks.length).toBeGreaterThan(0);

    // formatChange mark should be gone
    const formatChanges = findTextWithMark(editor, 'formatChange');
    expect(formatChanges.length).toBe(0);
  });

  it('reject formatChange added bold removes the bold', () => {
    setSelection(editor, 1, 6);
    editor.commands.toggleBold();

    const changes = getTrackedChanges(editor);
    const formatChange = changes.find((c) => c.type === 'formatChange');
    expect(formatChange).toBeDefined();

    editor.commands.rejectChange(formatChange!.changeId);

    // Bold should be removed
    const boldMarks = findTextWithMark(editor, 'bold');
    expect(boldMarks.length).toBe(0);

    // formatChange mark should be gone
    expect(findTextWithMark(editor, 'formatChange').length).toBe(0);
  });

  it('reject formatChange removed bold re-adds the bold', () => {
    editor = createTestEditor({
      content: '<p><strong>Hello</strong> world</p>',
      mode: 'suggest',
      withFormatting: true,
    });

    setSelection(editor, 1, 6);
    editor.commands.toggleBold(); // remove bold

    const changes = getTrackedChanges(editor);
    const formatChange = changes.find((c) => c.type === 'formatChange');
    expect(formatChange).toBeDefined();

    editor.commands.rejectChange(formatChange!.changeId);

    // Bold should be restored
    const boldMarks = findTextWithMark(editor, 'bold');
    expect(boldMarks.length).toBeGreaterThan(0);
  });

  it('format changes appear in getTrackedChanges', () => {
    setSelection(editor, 1, 6);
    editor.commands.toggleBold();

    const changes = getTrackedChanges(editor);
    const formatChange = changes.find((c) => c.type === 'formatChange');
    expect(formatChange).toBeDefined();
    expect(formatChange!.formatAdded).toBe('bold');
    expect(formatChange!.text).toBe('Hello');
  });

  it('format change in edit mode does not create tracking mark', () => {
    editor.commands.setEditMode();
    setSelection(editor, 1, 6);
    editor.commands.toggleBold();

    const formatChanges = findTextWithMark(editor, 'formatChange');
    expect(formatChanges.length).toBe(0);
  });

  it('acceptAll handles format changes', () => {
    setSelection(editor, 1, 6);
    editor.commands.toggleBold();

    editor.commands.acceptAll();

    // Bold stays, formatChange mark gone
    expect(findTextWithMark(editor, 'bold').length).toBeGreaterThan(0);
    expect(findTextWithMark(editor, 'formatChange').length).toBe(0);
  });

  it('rejectAll handles format changes', () => {
    setSelection(editor, 1, 6);
    editor.commands.toggleBold();

    editor.commands.rejectAll();

    // Bold removed, formatChange mark gone
    expect(findTextWithMark(editor, 'bold').length).toBe(0);
    expect(findTextWithMark(editor, 'formatChange').length).toBe(0);
  });

  it('toggle strike in suggest mode is tracked', () => {
    setSelection(editor, 1, 6);
    editor.commands.toggleStrike();

    const formatChanges = findTextWithMark(editor, 'formatChange');
    expect(formatChanges.length).toBeGreaterThan(0);
    expect(formatChanges[0].attrs.formatAdded).toBe('strike');
  });
});
