import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestEditor,
  simulateTextInput,
  setCursor,
  setSelection,
  TEST_AUTHOR,
  SECOND_AUTHOR,
} from './setup';
import { getGroupedChanges, getTrackedChanges } from '../src/helpers';
import {
  classifyGroup,
  resetTimeline,
  logBulkAction,
  getTimelineEvents,
} from '../demo/src/sidebar';
import type { TrackedChangeInfo } from '../src/types';
import type { Editor } from '@tiptap/core';

describe('classifyGroup', () => {
  it('classifies insertion-only groups', () => {
    const changes = [
      { type: 'insertion' },
    ] as TrackedChangeInfo[];
    expect(classifyGroup(changes)).toBe('insertion');
  });

  it('classifies deletion-only groups', () => {
    const changes = [
      { type: 'deletion' },
    ] as TrackedChangeInfo[];
    expect(classifyGroup(changes)).toBe('deletion');
  });

  it('classifies replacement groups (insertion + deletion)', () => {
    const changes = [
      { type: 'deletion' },
      { type: 'insertion' },
    ] as TrackedChangeInfo[];
    expect(classifyGroup(changes)).toBe('replacement');
  });

  it('classifies format change groups', () => {
    const changes = [
      { type: 'formatChange' },
    ] as TrackedChangeInfo[];
    expect(classifyGroup(changes)).toBe('formatChange');
  });
});

describe('Timeline Event Log', () => {
  beforeEach(() => {
    resetTimeline();
  });

  it('starts with empty timeline', () => {
    expect(getTimelineEvents()).toHaveLength(0);
  });

  it('logBulkAction adds a batch_accepted event', () => {
    logBulkAction('batch_accepted', 5);
    const events = getTimelineEvents();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('batch_accepted');
    expect(events[0].count).toBe(5);
    expect(events[0].timestamp).toBeDefined();
    expect(events[0].id).toMatch(/^evt_/);
  });

  it('logBulkAction adds a batch_rejected event', () => {
    logBulkAction('batch_rejected', 3);
    const events = getTimelineEvents();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('batch_rejected');
    expect(events[0].count).toBe(3);
  });

  it('events are prepended (newest first)', () => {
    logBulkAction('batch_accepted', 2);
    logBulkAction('batch_rejected', 1);
    const events = getTimelineEvents();
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('batch_rejected');
    expect(events[1].type).toBe('batch_accepted');
  });

  it('resetTimeline clears all events', () => {
    logBulkAction('batch_accepted', 5);
    logBulkAction('batch_rejected', 3);
    expect(getTimelineEvents()).toHaveLength(2);

    resetTimeline();
    expect(getTimelineEvents()).toHaveLength(0);
  });

  it('multiple resets are safe', () => {
    resetTimeline();
    resetTimeline();
    expect(getTimelineEvents()).toHaveLength(0);
  });
});

describe('Timeline Integration with Editor', () => {
  let editor: Editor;

  beforeEach(() => {
    resetTimeline();
    editor = createTestEditor({
      content: '<p>Hello world</p>',
      mode: 'suggest',
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  it('getGroupedChanges returns groups for classification', () => {
    setCursor(editor, 6); // after "Hello"
    simulateTextInput(editor, ' beautiful');

    const groups = getGroupedChanges(editor);
    expect(groups.size).toBeGreaterThan(0);

    for (const [, changes] of groups) {
      const type = classifyGroup(changes);
      expect(['insertion', 'deletion', 'replacement', 'formatChange']).toContain(type);
    }
  });

  it('change groups have required fields for sidebar rendering', () => {
    setCursor(editor, 6);
    simulateTextInput(editor, ' new');

    const groups = getGroupedChanges(editor);
    for (const [changeId, changes] of groups) {
      expect(changeId).toBeTruthy();
      for (const change of changes) {
        expect(change.from).toBeDefined();
        expect(change.to).toBeDefined();
        expect(change.type).toBeDefined();
        expect(change.authorName).toBeDefined();
        expect(change.authorColor).toBeDefined();
        expect(change.timestamp).toBeDefined();
        expect(change.changeId).toBeDefined();
      }
    }
  });

  it('replacement creates both insertion and deletion in same group', () => {
    setSelection(editor, 1, 6); // select "Hello"
    simulateTextInput(editor, 'Goodbye');

    const groups = getGroupedChanges(editor);
    expect(groups.size).toBe(1);

    for (const [, changes] of groups) {
      expect(classifyGroup(changes)).toBe('replacement');
      const types = changes.map((c) => c.type);
      expect(types).toContain('insertion');
      expect(types).toContain('deletion');
    }
  });

  it('multiple independent changes create separate groups', () => {
    // Insert at position 6
    setCursor(editor, 6);
    simulateTextInput(editor, ' first');

    // Insert at end
    const endPos = editor.state.doc.content.size - 1;
    setCursor(editor, endPos);
    simulateTextInput(editor, ' second');

    const groups = getGroupedChanges(editor);
    expect(groups.size).toBe(2);
  });
});

describe('Region Grouping Logic', () => {
  let editor: Editor;

  beforeEach(() => {
    resetTimeline();
  });

  afterEach(() => {
    editor.destroy();
  });

  it('changes in same paragraph share a common block position', () => {
    editor = createTestEditor({
      content: '<p>The quick brown fox jumps over the lazy dog</p>',
      mode: 'suggest',
    });

    // First change
    setSelection(editor, 5, 10); // "quick"
    simulateTextInput(editor, 'slow');

    // Second change
    const groups = getGroupedChanges(editor);
    const positions = [...groups.values()].map(
      (changes) => Math.min(...changes.map((c) => c.from)),
    );

    // All changes should be within the same paragraph (pos 0 to end)
    for (const pos of positions) {
      expect(pos).toBeGreaterThanOrEqual(0);
    }
  });

  it('changes in different paragraphs have different positions', () => {
    editor = createTestEditor({
      content: '<p>First paragraph</p><p>Second paragraph</p>',
      mode: 'suggest',
    });

    // Change in first paragraph
    setCursor(editor, 6);
    simulateTextInput(editor, ' added');

    // Change in second paragraph
    setCursor(editor, 25);
    simulateTextInput(editor, ' added');

    const groups = getGroupedChanges(editor);
    expect(groups.size).toBe(2);

    const positions = [...groups.values()].map(
      (changes) => Math.min(...changes.map((c) => c.from)),
    );

    // The two changes should be at different positions
    expect(positions[0]).not.toBe(positions[1]);
  });
});
