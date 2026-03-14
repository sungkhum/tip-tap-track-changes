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
import { getBaseText, getResultText } from '../src/helpers';
import {
  lastGraphemeClusterLength,
  firstGraphemeClusterLength,
} from '../src/utils';

describe('Arabic (RTL) script', () => {
  let editor: ReturnType<typeof createTestEditor>;

  afterEach(() => {
    editor?.destroy();
  });

  it('tracks insertion of Arabic text', () => {
    editor = createTestEditor({ content: '<p>مرحبا</p>' });
    // "مرحبا" = 5 characters, positions 1-5
    setCursor(editor, 6); // after last character
    simulateTextInput(editor, ' بالعالم');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions).toHaveLength(1);
    expect(insertions[0].text).toBe(' بالعالم');
    expect(getEditorText(editor)).toBe('مرحبا بالعالم');
  });

  it('tracks deletion of Arabic text', () => {
    editor = createTestEditor({ content: '<p>مرحبا بالعالم</p>' });
    setCursor(editor, 14); // after last char
    simulateKeyDown(editor, 'Backspace');

    const deletions = findTextWithMark(editor, 'deletion');
    expect(deletions).toHaveLength(1);
    // Should delete one grapheme cluster (the last character م)
    expect(deletions[0].text).toBe('م');
  });

  it('tracks replacement of Arabic text', () => {
    editor = createTestEditor({ content: '<p>مرحبا بالعالم</p>' });
    // Select "بالعالم" (7 chars starting at position 7)
    setSelection(editor, 7, 14);
    simulateTextInput(editor, 'بالجميع');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions[0].text).toBe('بالجميع');

    const deletions = findTextWithMark(editor, 'deletion');
    expect(deletions[0].text).toBe('بالعالم');
  });

  it('preserves Arabic text with tashkeel (diacritics)', () => {
    // "بِسْمِ اللَّهِ" - with tashkeel marks
    const textWithTashkeel = 'بِسْمِ اللَّهِ';
    editor = createTestEditor({
      content: `<p>${textWithTashkeel}</p>`,
    });

    setCursor(editor, 1 + textWithTashkeel.length);
    simulateTextInput(editor, ' الرَّحْمَنِ');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions[0].text).toBe(' الرَّحْمَنِ');
  });
});

describe('Khmer script', () => {
  let editor: ReturnType<typeof createTestEditor>;

  afterEach(() => {
    editor?.destroy();
  });

  it('tracks insertion of Khmer text', () => {
    // "ព្រះ" (preah = "sacred/holy")
    editor = createTestEditor({ content: '<p>ព្រះ</p>' });
    const textLen = 'ព្រះ'.length;
    setCursor(editor, 1 + textLen);
    simulateTextInput(editor, 'ពុទ្ធ');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions).toHaveLength(1);
    expect(insertions[0].text).toBe('ពុទ្ធ');
  });

  it('tracks deletion of Khmer text with stacking consonants', () => {
    // "កម្ពុជា" (kampuchea = "Cambodia") - contains stacking consonant ម្ព
    editor = createTestEditor({ content: '<p>កម្ពុជា</p>' });
    const textLen = 'កម្ពុជា'.length;
    setCursor(editor, 1 + textLen);
    simulateKeyDown(editor, 'Backspace');

    // Should delete a grapheme cluster, not just a code point
    const deletions = findTextWithMark(editor, 'deletion');
    expect(deletions).toHaveLength(1);
    expect(deletions[0].text.length).toBeGreaterThanOrEqual(1);
  });

  it('handles Khmer text without word boundaries', () => {
    // Khmer doesn't use spaces between words
    // "សូមស្វាគមន៍" = "Welcome"
    const khmerText = 'សូមស្វាគមន៍';
    editor = createTestEditor({
      content: `<p>${khmerText}</p>`,
    });

    const textLen = khmerText.length;
    setCursor(editor, 1 + textLen);
    simulateTextInput(editor, 'មកកម្ពុជា');

    expect(getEditorText(editor)).toBe(khmerText + 'មកកម្ពុជា');
    expect(findTextWithMark(editor, 'insertion')).toHaveLength(1);
  });

  it('preserves Khmer vowel reordering characters', () => {
    // េ (vowel sign e) visually appears before the consonant it follows
    // "កែ" = consonant ក + vowel េ
    editor = createTestEditor({ content: '<p>កែ</p>' });
    const textLen = 'កែ'.length;
    setCursor(editor, 1 + textLen);
    simulateTextInput(editor, 'ខ្មែរ');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions[0].text).toBe('ខ្មែរ');
  });
});

describe('Thai script', () => {
  let editor: ReturnType<typeof createTestEditor>;

  afterEach(() => {
    editor?.destroy();
  });

  it('tracks insertion of Thai text', () => {
    // "สวัสดี" = "Hello"
    editor = createTestEditor({ content: '<p>สวัสดี</p>' });
    const textLen = 'สวัสดี'.length;
    setCursor(editor, 1 + textLen);
    simulateTextInput(editor, 'ครับ');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions[0].text).toBe('ครับ');
  });

  it('handles Thai text without word boundaries', () => {
    // "ประเทศไทย" = "Thailand" (no spaces between words)
    const thaiText = 'ประเทศไทย';
    editor = createTestEditor({
      content: `<p>${thaiText}</p>`,
    });
    const textLen = thaiText.length;
    setCursor(editor, 1 + textLen);
    simulateTextInput(editor, 'สวยงาม');

    expect(getEditorText(editor)).toBe(thaiText + 'สวยงาม');
  });

  it('tracks deletion of Thai text with tone marks', () => {
    // "น้ำ" = "water" - contains tone mark
    editor = createTestEditor({ content: '<p>น้ำ</p>' });
    const textLen = 'น้ำ'.length;
    setCursor(editor, 1 + textLen);
    simulateKeyDown(editor, 'Backspace');

    const deletions = findTextWithMark(editor, 'deletion');
    expect(deletions).toHaveLength(1);
  });
});

describe('CJK scripts', () => {
  let editor: ReturnType<typeof createTestEditor>;

  afterEach(() => {
    editor?.destroy();
  });

  it('tracks insertion of Chinese characters', () => {
    editor = createTestEditor({ content: '<p>你好</p>' });
    setCursor(editor, 3); // after 好
    simulateTextInput(editor, '世界');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions[0].text).toBe('世界');
    expect(getEditorText(editor)).toBe('你好世界');
  });

  it('tracks deletion of Chinese character', () => {
    editor = createTestEditor({ content: '<p>你好世界</p>' });
    setCursor(editor, 5); // after 界
    simulateKeyDown(editor, 'Backspace');

    const deletions = findTextWithMark(editor, 'deletion');
    expect(deletions).toHaveLength(1);
    expect(deletions[0].text).toBe('界');
  });

  it('tracks Japanese text with mixed scripts', () => {
    // Mix of kanji, hiragana, katakana
    editor = createTestEditor({ content: '<p>東京タワー</p>' });
    const textLen = '東京タワー'.length;
    setCursor(editor, 1 + textLen);
    simulateTextInput(editor, 'は高い');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions[0].text).toBe('は高い');
  });

  it('tracks Korean text', () => {
    editor = createTestEditor({ content: '<p>안녕하세요</p>' });
    const textLen = '안녕하세요'.length;
    setCursor(editor, 1 + textLen);
    simulateTextInput(editor, ' 세계');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions[0].text).toBe(' 세계');
  });

  it('handles replacement of CJK text', () => {
    editor = createTestEditor({ content: '<p>你好世界</p>' });
    setSelection(editor, 3, 5); // select "世界"
    simulateTextInput(editor, '地球');

    expect(getResultText(editor)).toBe('你好地球');
    expect(getBaseText(editor)).toBe('你好世界');
  });
});

describe('Devanagari (Hindi) script', () => {
  let editor: ReturnType<typeof createTestEditor>;

  afterEach(() => {
    editor?.destroy();
  });

  it('tracks insertion of Hindi text', () => {
    // "नमस्ते" = "Namaste"
    editor = createTestEditor({ content: '<p>नमस्ते</p>' });
    const textLen = 'नमस्ते'.length;
    setCursor(editor, 1 + textLen);
    simulateTextInput(editor, ' दुनिया');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions[0].text).toBe(' दुनिया');
  });

  it('handles conjunct characters in Devanagari', () => {
    // "क्ष" is a conjunct (ksha) - two consonants combined
    editor = createTestEditor({ content: '<p>क्षमा</p>' });
    const textLen = 'क्षमा'.length;
    setCursor(editor, 1 + textLen);
    simulateTextInput(editor, 'करें');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions[0].text).toBe('करें');
  });
});

describe('Vietnamese text', () => {
  let editor: ReturnType<typeof createTestEditor>;

  afterEach(() => {
    editor?.destroy();
  });

  it('handles Vietnamese with stacking diacritics', () => {
    // "Việt Nam" - ệ has combining circumflex + combining dot below
    editor = createTestEditor({ content: '<p>Việt Nam</p>' });
    const textLen = 'Việt Nam'.length;
    setCursor(editor, 1 + textLen);
    simulateTextInput(editor, ' đẹp');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions[0].text).toBe(' đẹp');
  });

  it('tracks replacement of Vietnamese text with diacritics', () => {
    editor = createTestEditor({ content: '<p>Việt Nam</p>' });
    setSelection(editor, 1, 5); // select "Việt"
    simulateTextInput(editor, 'Nước');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions[0].text).toBe('Nước');

    const deletions = findTextWithMark(editor, 'deletion');
    expect(deletions[0].text).toBe('Việt');
  });
});

describe('Hebrew script', () => {
  let editor: ReturnType<typeof createTestEditor>;

  afterEach(() => {
    editor?.destroy();
  });

  it('tracks insertion of Hebrew text', () => {
    // "שלום" = "Shalom"
    editor = createTestEditor({ content: '<p>שלום</p>' });
    const textLen = 'שלום'.length;
    setCursor(editor, 1 + textLen);
    simulateTextInput(editor, ' עולם');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions[0].text).toBe(' עולם');
  });

  it('handles Hebrew with nikkud (vowel marks)', () => {
    // "שָׁלוֹם" with nikkud
    const textWithNikkud = 'שָׁלוֹם';
    editor = createTestEditor({
      content: `<p>${textWithNikkud}</p>`,
    });
    const textLen = textWithNikkud.length;
    setCursor(editor, 1 + textLen);
    simulateTextInput(editor, ' עוֹלָם');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions[0].text).toBe(' עוֹלָם');
  });
});

describe('Mixed BiDi content', () => {
  let editor: ReturnType<typeof createTestEditor>;

  afterEach(() => {
    editor?.destroy();
  });

  it('handles English text inside Arabic text', () => {
    // Brand name in English within Arabic
    editor = createTestEditor({
      content: '<p>شركة Google الأمريكية</p>',
    });
    const textLen = 'شركة Google الأمريكية'.length;
    setCursor(editor, 1 + textLen);
    simulateTextInput(editor, ' الكبيرة');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions[0].text).toBe(' الكبيرة');
  });

  it('handles Arabic text inside English text', () => {
    editor = createTestEditor({
      content: '<p>The word شلوم means peace</p>',
    });
    setSelection(editor, 10, 14); // select "שלום" (approximately)
    // This tests mixed bidi replacement
    const textLen = 'The word '.length;
    const arabicLen = 'شلوم'.length;
    setSelection(editor, 1 + textLen, 1 + textLen + arabicLen);
    simulateTextInput(editor, 'سلام');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions[0].text).toBe('سلام');
  });
});

describe('Emoji and special Unicode', () => {
  let editor: ReturnType<typeof createTestEditor>;

  afterEach(() => {
    editor?.destroy();
  });

  it('handles emoji characters (surrogate pairs)', () => {
    editor = createTestEditor({ content: '<p>Hello 🌍</p>' });
    const textLen = 'Hello 🌍'.length;
    setCursor(editor, 1 + textLen);
    simulateTextInput(editor, '🎉');

    const insertions = findTextWithMark(editor, 'insertion');
    expect(insertions[0].text).toBe('🎉');
  });

  it('handles emoji deletion', () => {
    editor = createTestEditor({ content: '<p>Hello 🌍</p>' });
    const textLen = 'Hello 🌍'.length;
    setCursor(editor, 1 + textLen); // after emoji
    simulateKeyDown(editor, 'Backspace');

    const deletions = findTextWithMark(editor, 'deletion');
    expect(deletions).toHaveLength(1);
    // The deleted text should be the full emoji, not half a surrogate pair
    expect(deletions[0].text).toBe('🌍');
  });
});

describe('Grapheme cluster utility functions', () => {
  describe('Khmer grapheme clusters', () => {
    it('lastGraphemeClusterLength treats coeng as extending the base', () => {
      // ម្ org = ម (U+1798) + ្ (U+17D2 coeng) — coeng extends the base
      // but the subscript consonant ព starts a new cluster per Unicode
      const text = 'ម្ព';
      const len = lastGraphemeClusterLength(text);
      // Last cluster is ព (1 char), not the whole string
      expect(len).toBe(1);
    });

    it('firstGraphemeClusterLength treats base + coeng as one cluster', () => {
      // ម + ្ (coeng) = one grapheme cluster; ព starts the next
      const text = 'ម្ព';
      const len = firstGraphemeClusterLength(text);
      expect(len).toBe(2); // ម + ្
    });

    it('handles Khmer vowel sign extending a consonant', () => {
      // ពុ = ព + ុ (consonant + vowel sign) — one cluster
      const text = 'ពុ';
      const len = lastGraphemeClusterLength(text);
      expect(len).toBe(2);
    });

    it('handles Khmer consonant + multiple combining marks', () => {
      // ក + ្ (coeng) = cluster of 2
      const text = 'ក្';
      const len = lastGraphemeClusterLength(text);
      expect(len).toBe(2);
    });
  });

  describe('Arabic Extended-A combining marks', () => {
    it('treats Arabic Extended-A marks as combining', () => {
      // U+08F0 (Arabic open kasratan) is in the Extended-A range
      const base = '\u0628'; // ba
      const extMark = '\u08F0'; // Arabic open kasratan
      const text = 'x' + base + extMark;
      const len = lastGraphemeClusterLength(text);
      // base + combining mark should be one cluster
      expect(len).toBe(2);
    });
  });

  describe('Khmer sign atthacan (U+17DD)', () => {
    it('treats U+17DD as a combining mark', () => {
      const base = '\u1780'; // Khmer consonant ka
      const atthacan = '\u17DD';
      const text = 'x' + base + atthacan;
      const len = lastGraphemeClusterLength(text);
      expect(len).toBe(2); // base + atthacan = one cluster
    });
  });

  describe('ZWJ and ZWNJ handling', () => {
    it('treats ZWNJ (U+200C) as part of a cluster', () => {
      // Devanagari: क + ् (virama) + ZWNJ — prevents conjunct
      const text = 'x\u0915\u094D\u200C';
      const len = lastGraphemeClusterLength(text);
      // virama + ZWNJ should stay with the base
      expect(len).toBe(3); // क + ् + ZWNJ
    });

    it('treats ZWJ (U+200D) as part of a cluster', () => {
      // Devanagari: क + ् (virama) + ZWJ — forces half form
      const text = 'x\u0915\u094D\u200D';
      const len = lastGraphemeClusterLength(text);
      expect(len).toBe(3); // क + ् + ZWJ
    });
  });

  describe('Combining Diacritical Marks Extended (U+1AB0-U+1AFF)', () => {
    it('treats extended combining marks as combining', () => {
      const text = 'a\u1AB0'; // a + combining doubled circumflex accent
      const len = lastGraphemeClusterLength(text);
      expect(len).toBe(2);
    });
  });

  describe('Surrogate pair validation in fallback', () => {
    it('handles emoji as base character at end of string', () => {
      const text = 'Hello🌍';
      const len = lastGraphemeClusterLength(text);
      expect(len).toBe(2); // surrogate pair = 2 code units
    });

    it('handles emoji followed by combining marks', () => {
      // emoji + combining enclosing keycap (U+20E3) — though unusual
      const text = 'x\u0023\u20E3'; // # + combining enclosing keycap
      const len = lastGraphemeClusterLength(text);
      expect(len).toBe(2); // # + keycap = one cluster
    });
  });

  describe('firstGraphemeClusterLength with surrogate pairs', () => {
    it('handles emoji as first character', () => {
      const text = '🌍Hello';
      const len = firstGraphemeClusterLength(text);
      expect(len).toBe(2); // surrogate pair = 2 code units
    });

    it('handles base character followed by combining marks', () => {
      // e + combining acute accent + combining dot below
      const text = 'e\u0301\u0323rest';
      const len = firstGraphemeClusterLength(text);
      expect(len).toBe(3); // e + 2 combining marks
    });
  });

  describe('Devanagari Extended (U+A8E0-U+A8F7)', () => {
    it('treats Devanagari Extended marks as combining', () => {
      const text = '\u0915\uA8E0'; // ka + Devanagari combining digit zero
      const len = lastGraphemeClusterLength(text);
      expect(len).toBe(2);
    });
  });

  describe('Cyrillic Extended-B (U+2DE0-U+2DFF)', () => {
    it('treats Cyrillic Extended-B marks as combining', () => {
      const text = '\u0430\u2DE0'; // Cyrillic a + combining Cyrillic letter be
      const len = lastGraphemeClusterLength(text);
      expect(len).toBe(2);
    });
  });
});
