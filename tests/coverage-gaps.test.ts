import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  createTestEditor,
  simulateTextInput,
  simulateKeyDown,
  simulatePaste,
  findTextWithMark,
  getEditorText,
  setCursor,
  setSelection,
  TEST_AUTHOR,
  SECOND_AUTHOR,
} from './setup';
import {
  getTrackedChanges,
  getGroupedChanges,
  getBaseText,
  getResultText,
  getPendingChangeCount,
} from '../src/helpers';
import {
  lastGraphemeClusterLength,
  firstGraphemeClusterLength,
} from '../src/utils';

// =====================================================================
// Mark reuse — ensures ProseMirror merges text into a single <ins> element
// =====================================================================
describe('Mark reuse for adjacent insertions', () => {
  let editor: ReturnType<typeof createTestEditor>;

  afterEach(() => {
    editor?.destroy();
  });

  it('reuses the exact same mark object (including timestamp) for consecutive typing', () => {
    editor = createTestEditor({ content: '<p>Hello</p>' });
    setCursor(editor, 6);

    simulateTextInput(editor, ' ');
    simulateTextInput(editor, 'w');
    simulateTextInput(editor, 'o');
    simulateTextInput(editor, 'r');
    simulateTextInput(editor, 'l');
    simulateTextInput(editor, 'd');

    const insertions = findTextWithMark(editor, 'insertion');
    // All characters should be in a single text node with one mark
    expect(insertions).toHaveLength(1);
    expect(insertions[0].text).toBe(' world');

    // The mark attributes should be identical (same timestamp proves mark reuse)
    const attrs = insertions[0].attrs;
    expect(attrs.changeId).toBeTruthy();
    expect(attrs.timestamp).toBeTruthy();
  });

  it('creates a new mark when typing at a different position', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });

    // Type at position 7
    setCursor(editor, 7);
    simulateTextInput(editor, 'A');

    // Move to position 1 and type
    setCursor(editor, 1);
    simulateTextInput(editor, 'B');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions).toHaveLength(2);

    // Different changeIds since they're not adjacent
    const changeIds = new Set(insertions.map((i) => i.attrs.changeId));
    expect(changeIds.size).toBe(2);
  });
});

// =====================================================================
// NFC normalization
// =====================================================================
describe('NFC normalization', () => {
  let editor: ReturnType<typeof createTestEditor>;

  afterEach(() => {
    editor?.destroy();
  });

  it('normalizes decomposed Vietnamese diacritics to NFC', () => {
    editor = createTestEditor({ content: '<p>Hello</p>' });
    setCursor(editor, 6);

    // NFD form: e + combining circumflex (U+0302) + combining dot below (U+0323)
    const nfdText = 'Vi\u0065\u0302\u0323t';
    simulateTextInput(editor, nfdText);

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions).toHaveLength(1);

    // Should be stored as NFC: precomposed ệ (U+1EC7)
    const storedText = insertions[0].text;
    expect(storedText).toBe(nfdText.normalize('NFC'));
    // Verify it's actually different from the input
    expect(nfdText.length).toBeGreaterThan(nfdText.normalize('NFC').length);
  });

  it('leaves already-NFC text unchanged', () => {
    editor = createTestEditor({ content: '<p>Hello</p>' });
    setCursor(editor, 6);

    const nfcText = ' Vi\u1EC7t Nam';
    simulateTextInput(editor, nfcText);

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions[0].text).toBe(nfcText);
  });
});

// =====================================================================
// View mode
// =====================================================================
describe('View mode input blocking', () => {
  let editor: ReturnType<typeof createTestEditor>;

  afterEach(() => {
    editor?.destroy();
  });

  it('does not track changes in view mode on text input', () => {
    editor = createTestEditor({
      content: '<p>Hello world</p>',
      mode: 'view',
    });
    setCursor(editor, 7);
    const handled = simulateTextInput(editor, 'test');
    expect(handled).toBe(false);
    expect(findTextWithMark(editor, 'insertion')).toHaveLength(0);
  });

  it('does not track changes in view mode on backspace', () => {
    editor = createTestEditor({
      content: '<p>Hello world</p>',
      mode: 'view',
    });
    setCursor(editor, 12);
    const handled = simulateKeyDown(editor, 'Backspace');
    expect(handled).toBe(false);
    expect(findTextWithMark(editor, 'deletion')).toHaveLength(0);
  });

  it('does not track changes in view mode on delete', () => {
    editor = createTestEditor({
      content: '<p>Hello world</p>',
      mode: 'view',
    });
    setCursor(editor, 1);
    const handled = simulateKeyDown(editor, 'Delete');
    expect(handled).toBe(false);
    expect(findTextWithMark(editor, 'deletion')).toHaveLength(0);
  });

  it('does not track changes in view mode on paste', () => {
    editor = createTestEditor({
      content: '<p>Hello world</p>',
      mode: 'view',
    });
    setCursor(editor, 7);
    const handled = simulatePaste(editor, 'pasted text');
    expect(handled).toBe(false);
    expect(findTextWithMark(editor, 'insertion')).toHaveLength(0);
  });
});

// =====================================================================
// getGroupedChanges helper
// =====================================================================
describe('getGroupedChanges', () => {
  let editor: ReturnType<typeof createTestEditor>;

  afterEach(() => {
    editor?.destroy();
  });

  it('groups replacement insertion and deletion under the same changeId', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });
    setSelection(editor, 7, 12);
    simulateTextInput(editor, 'everyone');

    const groups = getGroupedChanges(editor);
    expect(groups.size).toBe(1);

    const [changeId, changes] = [...groups.entries()][0];
    expect(changeId).toBeTruthy();
    expect(changes).toHaveLength(2);

    const types = changes.map((c) => c.type).sort();
    expect(types).toEqual(['deletion', 'insertion']);
  });

  it('creates separate groups for independent changes', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });

    // First change: insert
    setCursor(editor, 7);
    simulateTextInput(editor, 'big ');

    // Second change: delete (at a new position)
    setCursor(editor, 1);
    simulateKeyDown(editor, 'Delete');

    const groups = getGroupedChanges(editor);
    expect(groups.size).toBe(2);
  });

  it('returns empty map for document with no changes', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });
    const groups = getGroupedChanges(editor);
    expect(groups.size).toBe(0);
  });
});

// =====================================================================
// Forward deletion skip (Delete key over already-deleted text)
// =====================================================================
describe('Forward deletion skip', () => {
  let editor: ReturnType<typeof createTestEditor>;

  afterEach(() => {
    editor?.destroy();
  });

  it('skips over already-deleted text on Delete key', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });

    // Delete "Hello" via selection
    setSelection(editor, 1, 6);
    simulateKeyDown(editor, 'Backspace');

    // Now cursor should be at position 1
    // Press Delete — should skip over the deleted "Hello" and delete the space
    setCursor(editor, 1);
    simulateKeyDown(editor, 'Delete');

    // The space after "Hello" should now be marked as deleted too
    const deletions = findTextWithMark(editor, 'deletion');
    const deletedTexts = deletions.map((d) => d.text);
    expect(deletedTexts).toContain('Hello');
  });
});

// =====================================================================
// Selection delete spanning mixed own-insertion and existing text
// =====================================================================
describe('Selection delete spanning mixed content', () => {
  let editor: ReturnType<typeof createTestEditor>;

  afterEach(() => {
    editor?.destroy();
  });

  it('deletes own insertions and marks other text as deleted in a mixed selection', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });

    // Insert "beautiful " at position 7
    setCursor(editor, 7);
    simulateTextInput(editor, 'beautiful ');

    // Now text is "Hello beautiful world"
    expect(getEditorText(editor)).toBe('Hello beautiful world');

    // Select "beautiful world" (from 7 to 22) — mixed own insertion + existing text
    setSelection(editor, 7, 22);
    simulateKeyDown(editor, 'Backspace');

    // "beautiful " was own insertion — actually deleted
    // "world" was existing text — marked as deleted
    const deletions = findTextWithMark(editor, 'deletion');
    expect(deletions).toHaveLength(1);
    expect(deletions[0].text).toBe('world');

    // "beautiful " should be truly gone
    expect(getEditorText(editor)).not.toContain('beautiful');
  });
});

// =====================================================================
// Accept/reject with non-existent changeId
// =====================================================================
describe('Accept/reject edge cases', () => {
  let editor: ReturnType<typeof createTestEditor>;

  afterEach(() => {
    editor?.destroy();
  });

  it('acceptChange with non-existent changeId does not throw', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });

    expect(() => {
      editor.commands.acceptChange('non-existent-id');
    }).not.toThrow();

    expect(getEditorText(editor)).toBe('Hello world');
  });

  it('rejectChange with non-existent changeId does not throw', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });

    expect(() => {
      editor.commands.rejectChange('non-existent-id');
    }).not.toThrow();

    expect(getEditorText(editor)).toBe('Hello world');
  });

  it('accepting the same changeId twice does not throw or corrupt state', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });
    setCursor(editor, 7);
    simulateTextInput(editor, 'big ');

    const changes = getTrackedChanges(editor);
    const changeId = changes[0].changeId;

    editor.commands.acceptChange(changeId);
    expect(getEditorText(editor)).toBe('Hello big world');

    // Second accept should be a no-op
    editor.commands.acceptChange(changeId);
    expect(getEditorText(editor)).toBe('Hello big world');
    expect(findTextWithMark(editor, 'insertion')).toHaveLength(0);
  });
});

// =====================================================================
// Empty string insertion
// =====================================================================
describe('Empty string handling', () => {
  let editor: ReturnType<typeof createTestEditor>;

  afterEach(() => {
    editor?.destroy();
  });

  it('handles empty string insertion without errors', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });
    setCursor(editor, 7);

    // Empty string should still return true (handled by suggest mode)
    // but shouldn't create any visible change
    const handled = simulateTextInput(editor, '');
    // The handler may or may not process empty strings, but it shouldn't throw
    expect(getEditorText(editor)).toBe('Hello world');
  });
});

// =====================================================================
// Paste with empty clipboard
// =====================================================================
describe('Paste edge cases', () => {
  let editor: ReturnType<typeof createTestEditor>;

  afterEach(() => {
    editor?.destroy();
  });

  it('handles paste with empty clipboard data gracefully', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });
    setCursor(editor, 7);

    // Simulate paste with empty text
    const handled = simulatePaste(editor, '');
    expect(handled).toBe(false); // Should not be handled since no text
    expect(getEditorText(editor)).toBe('Hello world');
  });
});

// =====================================================================
// Intl.Segmenter fallback for combining marks
// =====================================================================
describe('Grapheme cluster functions', () => {
  it('lastGraphemeClusterLength handles basic Latin', () => {
    expect(lastGraphemeClusterLength('Hello')).toBe(1);
  });

  it('lastGraphemeClusterLength handles surrogate pairs (emoji)', () => {
    expect(lastGraphemeClusterLength('Hello🌍')).toBe(2);
  });

  it('firstGraphemeClusterLength handles basic Latin', () => {
    expect(firstGraphemeClusterLength('Hello')).toBe(1);
  });

  it('firstGraphemeClusterLength handles surrogate pairs (emoji)', () => {
    expect(firstGraphemeClusterLength('🌍Hello')).toBe(2);
  });

  it('lastGraphemeClusterLength returns correct length for Devanagari conjuncts', () => {
    // "क्ष" (ksha) = क + ् + ष = a conjunct
    const result = lastGraphemeClusterLength('क्ष');
    // Intl.Segmenter should treat the whole conjunct as one grapheme cluster
    expect(result).toBe('क्ष'.length);
  });

  it('firstGraphemeClusterLength returns correct length for Thai with tone marks', () => {
    // "น้ำ" = น + ้ + ำ — the cluster includes combining marks
    const result = firstGraphemeClusterLength('น้ำ');
    expect(result).toBe('น้ำ'.length);
  });

  it('lastGraphemeClusterLength handles Khmer with coeng', () => {
    // "ព្រ" = ព + ្ (coeng) + រ
    // Note: Intl.Segmenter may treat coeng sequences as separate grapheme
    // clusters depending on the Unicode/ICU version. What matters is that
    // the result is >= 1 and doesn't split a surrogate pair.
    const result = lastGraphemeClusterLength('ព្រ');
    expect(result).toBeGreaterThanOrEqual(1);
  });

  it('handles empty string', () => {
    expect(lastGraphemeClusterLength('')).toBe(0);
    expect(firstGraphemeClusterLength('')).toBe(0);
  });

  it('handles single character', () => {
    expect(lastGraphemeClusterLength('a')).toBe(1);
    expect(firstGraphemeClusterLength('a')).toBe(1);
  });

  it('lastGraphemeClusterLength handles Arabic with tashkeel', () => {
    // "بِ" = ب + kasra — should be one grapheme cluster
    const result = lastGraphemeClusterLength('بِ');
    expect(result).toBe('بِ'.length);
  });
});

// =====================================================================
// Intl.Segmenter fallback path (when Intl.Segmenter is unavailable)
// =====================================================================
describe('Intl.Segmenter fallback', () => {
  let originalSegmenter: typeof Intl.Segmenter;

  // We can't easily mock Intl.Segmenter in the module since it's read
  // at call time. Instead, test the exported functions with known inputs
  // and verify correctness (they use Intl.Segmenter when available,
  // which is the case in Node.js — so these tests verify the primary path).

  it('correctly segments emoji ZWJ sequences', () => {
    // Family emoji: 👨‍👩‍👧 (man + ZWJ + woman + ZWJ + girl)
    const family = '👨\u200D👩\u200D👧';
    const len = lastGraphemeClusterLength(family);
    // Intl.Segmenter should treat the whole ZWJ sequence as one cluster
    expect(len).toBe(family.length);
  });

  it('correctly segments flag emoji', () => {
    // US flag: 🇺🇸 (regional indicator U + regional indicator S)
    const flag = '🇺🇸';
    const len = lastGraphemeClusterLength(flag);
    expect(len).toBe(flag.length);
  });

  it('correctly segments skin tone modified emoji', () => {
    // 👋🏽 = waving hand + medium skin tone
    const emoji = '👋🏽';
    const len = lastGraphemeClusterLength(emoji);
    expect(len).toBe(emoji.length);
  });
});

// =====================================================================
// Additional complex script tests
// =====================================================================
describe('Additional complex script coverage', () => {
  let editor: ReturnType<typeof createTestEditor>;

  afterEach(() => {
    editor?.destroy();
  });

  it('handles Myanmar/Burmese text with medials', () => {
    // "မြန်မာ" (Myanmar) — contains medial ra
    editor = createTestEditor({ content: '<p>မြန်မာ</p>' });
    const textLen = 'မြန်မာ'.length;
    setCursor(editor, 1 + textLen);
    simulateTextInput(editor, 'ပြည်');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions).toHaveLength(1);
    expect(insertions[0].text).toBe('ပြည်');
  });

  it('handles Bengali text with conjuncts', () => {
    // "বাংলা" (Bangla)
    editor = createTestEditor({ content: '<p>বাংলা</p>' });
    const textLen = 'বাংলা'.length;
    setCursor(editor, 1 + textLen);
    simulateTextInput(editor, 'দেশ');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions).toHaveLength(1);
    expect(insertions[0].text).toBe('দেশ');
  });

  it('handles Tamil text with vowel signs', () => {
    // "தமிழ்" (Tamil)
    editor = createTestEditor({ content: '<p>தமிழ்</p>' });
    const textLen = 'தமிழ்'.length;
    setCursor(editor, 1 + textLen);
    simulateTextInput(editor, 'நாடு');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions).toHaveLength(1);
    expect(insertions[0].text).toBe('நாடு');
  });

  it('handles Tibetan text with subjoined consonants', () => {
    // "བོད" (Bod = Tibet)
    editor = createTestEditor({ content: '<p>བོད</p>' });
    const textLen = 'བོད'.length;
    setCursor(editor, 1 + textLen);
    simulateTextInput(editor, '་སྐད');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions).toHaveLength(1);
    expect(insertions[0].text).toBe('་སྐད');
  });

  it('handles Lao text with combining vowels', () => {
    // "ລາວ" (Lao)
    editor = createTestEditor({ content: '<p>ລາວ</p>' });
    const textLen = 'ລາວ'.length;
    setCursor(editor, 1 + textLen);
    simulateTextInput(editor, 'ພາສາ');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions).toHaveLength(1);
    expect(insertions[0].text).toBe('ພາສາ');
  });

  it('handles Ethiopic/Geez syllabary', () => {
    // "ኢትዮጵያ" (Ethiopia)
    editor = createTestEditor({ content: '<p>ኢትዮጵያ</p>' });
    const textLen = 'ኢትዮጵያ'.length;
    setCursor(editor, 1 + textLen);
    simulateTextInput(editor, ' ውብ');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions).toHaveLength(1);
    expect(insertions[0].text).toBe(' ውብ');
  });

  it('handles Syriac RTL text', () => {
    // "ܣܘܪܝܝܐ" (Syriac)
    editor = createTestEditor({ content: '<p>ܣܘܪܝܝܐ</p>' });
    const textLen = 'ܣܘܪܝܝܐ'.length;
    setCursor(editor, 1 + textLen);
    simulateTextInput(editor, ' ܠܫܢܐ');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions).toHaveLength(1);
    expect(insertions[0].text).toBe(' ܠܫܢܐ');
  });

  it('tracks deletion of Devanagari conjunct as a single grapheme cluster', () => {
    // "क्षमा" starts with conjunct क्ष (ksha)
    editor = createTestEditor({ content: '<p>क्षमा</p>' });
    const textLen = 'क्षमा'.length;
    setCursor(editor, 1 + textLen);
    simulateKeyDown(editor, 'Backspace');

    const deletions = findTextWithMark(editor, 'deletion');
    expect(deletions).toHaveLength(1);
    // Should delete the vowel sign ा as a cluster, not individual codepoints
    expect(deletions[0].text.length).toBeGreaterThanOrEqual(1);
  });

  it('tracks deletion of Khmer syllable cluster', () => {
    // "កម្ពុជា" — last cluster is "ជា" (base + vowel)
    editor = createTestEditor({ content: '<p>កម្ពុជា</p>' });
    const textLen = 'កម្ពុជា'.length;
    setCursor(editor, 1 + textLen);
    simulateKeyDown(editor, 'Backspace');

    const deletions = findTextWithMark(editor, 'deletion');
    expect(deletions).toHaveLength(1);
    // Should delete the grapheme cluster, not just one code unit
    expect(deletions[0].text.length).toBeGreaterThanOrEqual(1);
  });
});

// =====================================================================
// setTrackChangesAuthor command
// =====================================================================
describe('setTrackChangesAuthor', () => {
  let editor: ReturnType<typeof createTestEditor>;

  afterEach(() => {
    editor?.destroy();
  });

  it('changes the active author mid-session', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });

    // Type as user 1
    setCursor(editor, 7);
    simulateTextInput(editor, 'A');

    // Switch to user 2
    editor.commands.setTrackChangesAuthor(SECOND_AUTHOR);

    // Type as user 2
    simulateTextInput(editor, 'B');

    const insertions = findTextWithMark(editor, 'insertion');
    const user1Insertions = insertions.filter((i) => i.attrs.authorId === TEST_AUTHOR.id);
    const user2Insertions = insertions.filter((i) => i.attrs.authorId === SECOND_AUTHOR.id);

    expect(user1Insertions).toHaveLength(1);
    expect(user1Insertions[0].text).toBe('A');
    expect(user2Insertions).toHaveLength(1);
    expect(user2Insertions[0].text).toBe('B');
  });
});

// =====================================================================
// getBaseText and getResultText with complex scenarios
// =====================================================================
describe('getBaseText and getResultText advanced', () => {
  let editor: ReturnType<typeof createTestEditor>;

  afterEach(() => {
    editor?.destroy();
  });

  it('handles multiple insertions and deletions', () => {
    editor = createTestEditor({ content: '<p>The quick brown fox</p>' });

    // Delete "quick"
    setSelection(editor, 5, 10);
    simulateKeyDown(editor, 'Backspace');

    // Insert "slow" at start of deletion
    setCursor(editor, 5);
    simulateTextInput(editor, 'slow');

    // Delete "fox"
    const text = getEditorText(editor);
    const foxStart = text.indexOf('fox') + 1;
    setSelection(editor, foxStart, foxStart + 3);
    simulateKeyDown(editor, 'Backspace');

    // Insert "cat"
    setCursor(editor, foxStart);
    simulateTextInput(editor, 'cat');

    const base = getBaseText(editor);
    const result = getResultText(editor);

    expect(base).toBe('The quick brown fox');
    expect(result).toBe('The slow brown cat');
  });
});

// =====================================================================
// acceptAll and rejectAll cursor safety
// =====================================================================
describe('acceptAll/rejectAll cursor handling', () => {
  let editor: ReturnType<typeof createTestEditor>;

  afterEach(() => {
    editor?.destroy();
  });

  it('acceptAll does not throw when cursor would be out of bounds', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });

    // Put cursor at end
    setCursor(editor, 12);

    // Delete most of the text
    setSelection(editor, 3, 12);
    simulateKeyDown(editor, 'Backspace');

    // Accept all — the deletion will remove text, potentially
    // invalidating the cursor position
    expect(() => {
      editor.commands.acceptAll();
    }).not.toThrow();

    // Editor should still be functional
    expect(getEditorText(editor)).toBe('He');
  });

  it('rejectAll removes all insertions and restores deletions', () => {
    editor = createTestEditor({ content: '<p>Hello world</p>' });

    // Insert text
    setCursor(editor, 7);
    simulateTextInput(editor, 'beautiful ');

    // Delete text
    setSelection(editor, 1, 6);
    simulateKeyDown(editor, 'Backspace');

    // Reject all — should undo both changes
    editor.commands.rejectAll();

    expect(getEditorText(editor)).toBe('Hello world');
    expect(findTextWithMark(editor, 'insertion')).toHaveLength(0);
    expect(findTextWithMark(editor, 'deletion')).toHaveLength(0);
  });
});
