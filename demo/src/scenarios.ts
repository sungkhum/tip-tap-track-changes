import type { JSONContent } from '@tiptap/core';

export interface Scenario {
  id: string;
  name: string;
  description: string;
  content: JSONContent;
  dir?: 'ltr' | 'rtl';
}

// Helper to build text node with marks
function text(t: string, marks?: Array<{ type: string; attrs: Record<string, unknown> }>): JSONContent {
  const node: JSONContent = { type: 'text', text: t };
  if (marks) node.marks = marks;
  return node;
}

function insertionMark(changeId: string, authorId: string, authorName: string, authorColor: string) {
  return {
    type: 'insertion',
    attrs: {
      changeId,
      authorId,
      authorName,
      authorColor,
      timestamp: new Date().toISOString(),
    },
  };
}

function deletionMark(changeId: string, authorId: string, authorName: string, authorColor: string) {
  return {
    type: 'deletion',
    attrs: {
      changeId,
      authorId,
      authorName,
      authorColor,
      timestamp: new Date().toISOString(),
    },
  };
}

export const scenarios: Scenario[] = [
  {
    id: 'fresh',
    name: 'Start Fresh',
    description: 'Empty editor — start typing in suggest mode to see tracked changes in action.',
    content: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            text('The quick brown fox jumps over the lazy dog. Edit this text in suggest mode to see track changes working.'),
          ],
        },
      ],
    },
  },

  {
    id: 'translation-review',
    name: 'Translation Review',
    description: 'A reviewer has suggested changes to a translated theological text.',
    content: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            text('The '),
            text('alliance', [deletionMark('ch_tr1', 'user-2', 'Reviewer', '#dc2626')]),
            text('covenant', [insertionMark('ch_tr1', 'user-2', 'Reviewer', '#dc2626')]),
            text(' of grace was '),
            text('set up', [deletionMark('ch_tr2', 'user-2', 'Reviewer', '#dc2626')]),
            text('established', [insertionMark('ch_tr2', 'user-2', 'Reviewer', '#dc2626')]),
            text(' in the beginning, when God promised a '),
            text('savior', [deletionMark('ch_tr3', 'user-2', 'Reviewer', '#dc2626')]),
            text('Redeemer', [insertionMark('ch_tr3', 'user-2', 'Reviewer', '#dc2626')]),
            text(' who would come to '),
            text('fix', [deletionMark('ch_tr4', 'user-2', 'Reviewer', '#dc2626')]),
            text('restore', [insertionMark('ch_tr4', 'user-2', 'Reviewer', '#dc2626')]),
            text(' what was broken by sin.'),
          ],
        },
        {
          type: 'paragraph',
          content: [
            text('This '),
            text('agreement', [deletionMark('ch_tr5', 'user-2', 'Reviewer', '#dc2626')]),
            text('covenant', [insertionMark('ch_tr5', 'user-2', 'Reviewer', '#dc2626')]),
            text(' was not based on '),
            text('human effort', [deletionMark('ch_tr6', 'user-2', 'Reviewer', '#dc2626')]),
            text('the works of the law', [insertionMark('ch_tr6', 'user-2', 'Reviewer', '#dc2626')]),
            text(', but on the '),
            text('free gift', [deletionMark('ch_tr7', 'user-2', 'Reviewer', '#dc2626')]),
            text('unmerited favor', [insertionMark('ch_tr7', 'user-2', 'Reviewer', '#dc2626')]),
            text(' of God alone.'),
          ],
        },
      ],
    },
  },

  {
    id: 'multi-author',
    name: 'Multi-Author',
    description: 'Changes from three different contributors: translator, reviewer, and editor.',
    content: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            text('For God so loved the world, that he gave his '),
            text('one and only', [deletionMark('ch_ma1', 'user-2', 'Reviewer', '#dc2626')]),
            text('only begotten', [insertionMark('ch_ma1', 'user-2', 'Reviewer', '#dc2626')]),
            text(' Son, that whoever believes in him should not '),
            text('die', [deletionMark('ch_ma2', 'user-3', 'Editor', '#7c6b3b')]),
            text('perish', [insertionMark('ch_ma2', 'user-3', 'Editor', '#7c6b3b')]),
            text(', but have '),
            text('life that lasts forever', [deletionMark('ch_ma3', 'user-1', 'Translator', '#2563eb')]),
            text('eternal life', [insertionMark('ch_ma3', 'user-1', 'Translator', '#2563eb')]),
            text('.'),
          ],
        },
        {
          type: 'paragraph',
          content: [
            text('For God did not send his Son into the world to '),
            text('judge', [deletionMark('ch_ma4', 'user-2', 'Reviewer', '#dc2626')]),
            text('condemn', [insertionMark('ch_ma4', 'user-2', 'Reviewer', '#dc2626')]),
            text(' the world, but '),
            text('so that', [deletionMark('ch_ma5', 'user-3', 'Editor', '#7c6b3b')]),
            text('in order that', [insertionMark('ch_ma5', 'user-3', 'Editor', '#7c6b3b')]),
            text(' the world might be saved through him.'),
          ],
        },
      ],
    },
  },

  {
    id: 'complex-scripts',
    name: 'Complex Scripts & RTL',
    description: 'Track changes across Arabic, Hebrew, Chinese, Thai, Khmer, Hindi, and more.',
    content: {
      type: 'doc',
      content: [
        // Arabic (RTL)
        {
          type: 'paragraph',
          content: [
            text('Arabic: '),
            text('في البدء '),
            text('صنع', [deletionMark('ch_cs1', 'user-2', 'Reviewer', '#dc2626')]),
            text('خلق', [insertionMark('ch_cs1', 'user-2', 'Reviewer', '#dc2626')]),
            text(' الله السماوات والأرض.'),
          ],
        },
        // Hebrew
        {
          type: 'paragraph',
          content: [
            text('Hebrew: '),
            text('בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת '),
            text('העולם', [deletionMark('ch_cs2', 'user-1', 'Translator', '#2563eb')]),
            text('הַשָּׁמַיִם', [insertionMark('ch_cs2', 'user-1', 'Translator', '#2563eb')]),
            text(' וְאֵת הָאָרֶץ.'),
          ],
        },
        // Chinese
        {
          type: 'paragraph',
          content: [
            text('Chinese: 起初，'),
            text('上帝', [deletionMark('ch_cs3', 'user-2', 'Reviewer', '#dc2626')]),
            text('神', [insertionMark('ch_cs3', 'user-2', 'Reviewer', '#dc2626')]),
            text('创造天地。'),
          ],
        },
        // Thai
        {
          type: 'paragraph',
          content: [
            text('Thai: ในปฐมกาล'),
            text('พระเจ้า', [deletionMark('ch_cs4', 'user-2', 'Reviewer', '#dc2626')]),
            text('พระผู้เป็นเจ้า', [insertionMark('ch_cs4', 'user-2', 'Reviewer', '#dc2626')]),
            text('ทรงสร้างฟ้าและแผ่นดินโลก'),
          ],
        },
        // Khmer
        {
          type: 'paragraph',
          content: [
            text('Khmer: កាលដើមឡើយ '),
            text('ព្រះជាម្ចាស់', [deletionMark('ch_cs5', 'user-2', 'Reviewer', '#dc2626')]),
            text('ព្រះអង្គ', [insertionMark('ch_cs5', 'user-2', 'Reviewer', '#dc2626')]),
            text(' បានបង្កើតផ្ទៃមេឃនិងផែនដី។'),
          ],
        },
        // Hindi (Devanagari)
        {
          type: 'paragraph',
          content: [
            text('Hindi: आदि में '),
            text('ईश्वर', [deletionMark('ch_cs6', 'user-1', 'Translator', '#2563eb')]),
            text('परमेश्वर', [insertionMark('ch_cs6', 'user-1', 'Translator', '#2563eb')]),
            text(' ने आकाश और पृथ्वी की सृष्टि की।'),
          ],
        },
        // Korean
        {
          type: 'paragraph',
          content: [
            text('Korean: 태초에 하나님이 '),
            text('세상을', [deletionMark('ch_cs7', 'user-2', 'Reviewer', '#dc2626')]),
            text('천지를', [insertionMark('ch_cs7', 'user-2', 'Reviewer', '#dc2626')]),
            text(' 창조하시니라.'),
          ],
        },
        // Vietnamese
        {
          type: 'paragraph',
          content: [
            text('Vietnamese: Ban đầu, '),
            text('Chúa', [deletionMark('ch_cs8', 'user-2', 'Reviewer', '#dc2626')]),
            text('Đức Chúa Trời', [insertionMark('ch_cs8', 'user-2', 'Reviewer', '#dc2626')]),
            text(' dựng nên trời đất.'),
          ],
        },
        // Emoji
        {
          type: 'paragraph',
          content: [
            text('Emoji: The world '),
            text('🌍', [deletionMark('ch_cs9', 'user-1', 'Translator', '#2563eb')]),
            text('🌎', [insertionMark('ch_cs9', 'user-1', 'Translator', '#2563eb')]),
            text(' is beautiful '),
            text('✨', [insertionMark('ch_cs10', 'user-1', 'Translator', '#2563eb')]),
          ],
        },
      ],
    },
  },
];
