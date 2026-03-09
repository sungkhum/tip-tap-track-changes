import { describe, it, expect, beforeEach } from 'vitest';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Heading from '@tiptap/extension-heading';
import { TrackChangesExtension } from '../src/extension';
import { getTrackedChanges, getPendingChangeCount } from '../src/helpers';
import type { ChangeAuthor } from '../src/types';

const TEST_AUTHOR: ChangeAuthor = {
  id: 'user-1',
  name: 'Test User',
  color: '#4285f4',
};

function createNodeTrackingEditor(content: string, mode: 'suggest' | 'edit' = 'suggest') {
  return new Editor({
    extensions: [
      Document,
      Paragraph,
      Text,
      Heading,
      TrackChangesExtension.configure({
        author: TEST_AUTHOR,
        mode,
      }),
    ],
    content,
  });
}

describe('Node-Level Change Tracking (Phase 1)', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = createNodeTrackingEditor('<p>Hello world</p>');
  });

  it('trackSetNode changes paragraph to heading with tracking', () => {
    editor.commands.setTextSelection(1);
    editor.commands.trackSetNode('heading', { level: 1 });

    // Node should now be a heading
    const firstNode = editor.state.doc.child(0);
    expect(firstNode.type.name).toBe('heading');

    // Should have dataTracked attribute
    expect(firstNode.attrs.dataTracked).toBeDefined();
    expect(firstNode.attrs.dataTracked.originalType).toBe('paragraph');
  });

  it('tracked node change appears in getTrackedChanges', () => {
    editor.commands.setTextSelection(1);
    editor.commands.trackSetNode('heading', { level: 1 });

    const changes = getTrackedChanges(editor);
    const nodeChange = changes.find((c) => c.type === 'nodeChange');
    expect(nodeChange).toBeDefined();
    expect(nodeChange!.text).toBe('Hello world');
  });

  it('tracked node change increments pending change count', () => {
    const before = getPendingChangeCount(editor);
    editor.commands.setTextSelection(1);
    editor.commands.trackSetNode('heading', { level: 1 });
    expect(getPendingChangeCount(editor)).toBe(before + 1);
  });

  it('accept node change keeps new type and clears tracking', () => {
    editor.commands.setTextSelection(1);
    editor.commands.trackSetNode('heading', { level: 1 });

    const changes = getTrackedChanges(editor);
    const nodeChange = changes.find((c) => c.type === 'nodeChange');
    expect(nodeChange).toBeDefined();

    editor.commands.acceptChange(nodeChange!.changeId);

    // Should still be heading
    const firstNode = editor.state.doc.child(0);
    expect(firstNode.type.name).toBe('heading');
    // But no tracking
    expect(firstNode.attrs.dataTracked).toBeNull();
  });

  it('reject node change reverts to original type', () => {
    editor.commands.setTextSelection(1);
    editor.commands.trackSetNode('heading', { level: 1 });

    const changes = getTrackedChanges(editor);
    const nodeChange = changes.find((c) => c.type === 'nodeChange');
    expect(nodeChange).toBeDefined();

    editor.commands.rejectChange(nodeChange!.changeId);

    // Should be back to paragraph
    const firstNode = editor.state.doc.child(0);
    expect(firstNode.type.name).toBe('paragraph');
    expect(firstNode.attrs.dataTracked).toBeNull();
  });

  it('reverting to original type in suggest mode clears tracking', () => {
    editor.commands.setTextSelection(1);
    editor.commands.trackSetNode('heading', { level: 1 });

    // Now set back to paragraph
    editor.commands.trackSetNode('paragraph');

    // Should be paragraph with no tracking
    const firstNode = editor.state.doc.child(0);
    expect(firstNode.type.name).toBe('paragraph');
    expect(firstNode.attrs.dataTracked).toBeNull();
  });

  it('changing back to paragraph from heading clears tracking', () => {
    editor.commands.setTextSelection(1);
    editor.commands.trackSetNode('heading', { level: 1 });

    // Change back to paragraph — should clear tracking
    editor.commands.trackSetNode('paragraph');

    const firstNode = editor.state.doc.child(0);
    expect(firstNode.type.name).toBe('paragraph');
    // Tracking should be cleared since we reverted
    expect(firstNode.attrs.dataTracked).toBeNull();
  });

  it('trackSetNode in edit mode does direct change without tracking', () => {
    editor = createNodeTrackingEditor('<p>Hello world</p>', 'edit');
    editor.commands.setTextSelection(1);
    editor.commands.trackSetNode('heading', { level: 1 });

    const firstNode = editor.state.doc.child(0);
    expect(firstNode.type.name).toBe('heading');
    expect(firstNode.attrs.dataTracked).toBeNull();
  });
});
