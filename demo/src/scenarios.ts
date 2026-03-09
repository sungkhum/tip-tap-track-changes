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
    id: 'article-review',
    name: 'Article Review',
    description: 'An editor has suggested improvements to a draft article.',
    content: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            text('The '),
            text('new', [deletionMark('ch_tr1', 'user-2', 'Reviewer', '#dc2626')]),
            text('emerging', [insertionMark('ch_tr1', 'user-2', 'Reviewer', '#dc2626')]),
            text(' framework was '),
            text('made', [deletionMark('ch_tr2', 'user-2', 'Reviewer', '#dc2626')]),
            text('designed', [insertionMark('ch_tr2', 'user-2', 'Reviewer', '#dc2626')]),
            text(' from the ground up, with a focus on '),
            text('speed', [deletionMark('ch_tr3', 'user-2', 'Reviewer', '#dc2626')]),
            text('performance', [insertionMark('ch_tr3', 'user-2', 'Reviewer', '#dc2626')]),
            text(' and '),
            text('ease of use', [deletionMark('ch_tr4', 'user-2', 'Reviewer', '#dc2626')]),
            text('developer experience', [insertionMark('ch_tr4', 'user-2', 'Reviewer', '#dc2626')]),
            text(' at every level.'),
          ],
        },
        {
          type: 'paragraph',
          content: [
            text('Its '),
            text('setup', [deletionMark('ch_tr5', 'user-2', 'Reviewer', '#dc2626')]),
            text('architecture', [insertionMark('ch_tr5', 'user-2', 'Reviewer', '#dc2626')]),
            text(' is not based on '),
            text('old patterns', [deletionMark('ch_tr6', 'user-2', 'Reviewer', '#dc2626')]),
            text('legacy conventions', [insertionMark('ch_tr6', 'user-2', 'Reviewer', '#dc2626')]),
            text(', but on '),
            text('modern ideas', [deletionMark('ch_tr7', 'user-2', 'Reviewer', '#dc2626')]),
            text('first principles', [insertionMark('ch_tr7', 'user-2', 'Reviewer', '#dc2626')]),
            text(' alone.'),
          ],
        },
      ],
    },
  },

  {
    id: 'multi-author',
    name: 'Multi-Author',
    description: 'Changes from three different contributors: author, reviewer, and editor.',
    content: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            text('The open-source community has '),
            text('changed', [deletionMark('ch_ma1', 'user-2', 'Reviewer', '#dc2626')]),
            text('transformed', [insertionMark('ch_ma1', 'user-2', 'Reviewer', '#dc2626')]),
            text(' how software is built, enabling developers to '),
            text('work on', [deletionMark('ch_ma2', 'user-3', 'Editor', '#7c6b3b')]),
            text('collaborate on', [insertionMark('ch_ma2', 'user-3', 'Editor', '#7c6b3b')]),
            text(' projects that '),
            text('help lots of people', [deletionMark('ch_ma3', 'user-1', 'Author', '#2563eb')]),
            text('serve millions of users', [insertionMark('ch_ma3', 'user-1', 'Author', '#2563eb')]),
            text('.'),
          ],
        },
        {
          type: 'paragraph',
          content: [
            text('These projects are not meant to '),
            text('replace', [deletionMark('ch_ma4', 'user-2', 'Reviewer', '#dc2626')]),
            text('compete with', [insertionMark('ch_ma4', 'user-2', 'Reviewer', '#dc2626')]),
            text(' commercial software, but '),
            text('to give', [deletionMark('ch_ma5', 'user-3', 'Editor', '#7c6b3b')]),
            text('rather to provide', [insertionMark('ch_ma5', 'user-3', 'Editor', '#7c6b3b')]),
            text(' alternatives that anyone can use and improve.'),
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
            text('المصدر المفتوح '),
            text('غيّر', [deletionMark('ch_cs1', 'user-2', 'Reviewer', '#dc2626')]),
            text('أحدث ثورة في', [insertionMark('ch_cs1', 'user-2', 'Reviewer', '#dc2626')]),
            text(' طريقة بناء البرمجيات.'),
          ],
        },
        // Hebrew
        {
          type: 'paragraph',
          content: [
            text('Hebrew: '),
            text('קוד פתוח שינה את '),
            text('העולם', [deletionMark('ch_cs2', 'user-1', 'Author', '#2563eb')]),
            text('התעשייה', [insertionMark('ch_cs2', 'user-1', 'Author', '#2563eb')]),
            text(' של הטכנולוגיה.'),
          ],
        },
        // Chinese
        {
          type: 'paragraph',
          content: [
            text('Chinese: 开源软件'),
            text('改变了', [deletionMark('ch_cs3', 'user-2', 'Reviewer', '#dc2626')]),
            text('革新了', [insertionMark('ch_cs3', 'user-2', 'Reviewer', '#dc2626')]),
            text('现代开发方式。'),
          ],
        },
        // Thai
        {
          type: 'paragraph',
          content: [
            text('Thai: ซอฟต์แวร์โอเพนซอร์ส'),
            text('เปลี่ยน', [deletionMark('ch_cs4', 'user-2', 'Reviewer', '#dc2626')]),
            text('ปฏิวัติ', [insertionMark('ch_cs4', 'user-2', 'Reviewer', '#dc2626')]),
            text('วิธีการพัฒนาซอฟต์แวร์'),
          ],
        },
        // Khmer
        {
          type: 'paragraph',
          content: [
            text('Khmer: កម្មវិធីកូដចំហ '),
            text('បានផ្លាស់ប្តូរ', [deletionMark('ch_cs5', 'user-2', 'Reviewer', '#dc2626')]),
            text('បានធ្វើបដិវត្តន៍', [insertionMark('ch_cs5', 'user-2', 'Reviewer', '#dc2626')]),
            text(' វិធីសាស្រ្តអភិវឌ្ឍន៍។'),
          ],
        },
        // Hindi (Devanagari)
        {
          type: 'paragraph',
          content: [
            text('Hindi: ओपन सोर्स ने '),
            text('बदल दिया', [deletionMark('ch_cs6', 'user-1', 'Author', '#2563eb')]),
            text('क्रांति ला दी', [insertionMark('ch_cs6', 'user-1', 'Author', '#2563eb')]),
            text(' सॉफ्टवेयर विकास की दुनिया में।'),
          ],
        },
        // Korean
        {
          type: 'paragraph',
          content: [
            text('Korean: 오픈소스는 소프트웨어 '),
            text('개발을', [deletionMark('ch_cs7', 'user-2', 'Reviewer', '#dc2626')]),
            text('개발 방식을', [insertionMark('ch_cs7', 'user-2', 'Reviewer', '#dc2626')]),
            text(' 혁신했습니다.'),
          ],
        },
        // Vietnamese
        {
          type: 'paragraph',
          content: [
            text('Vietnamese: Mã nguồn mở đã '),
            text('thay đổi', [deletionMark('ch_cs8', 'user-2', 'Reviewer', '#dc2626')]),
            text('cách mạng hóa', [insertionMark('ch_cs8', 'user-2', 'Reviewer', '#dc2626')]),
            text(' cách phát triển phần mềm.'),
          ],
        },
        // Emoji
        {
          type: 'paragraph',
          content: [
            text('Emoji: The world '),
            text('🌍', [deletionMark('ch_cs9', 'user-1', 'Author', '#2563eb')]),
            text('🌎', [insertionMark('ch_cs9', 'user-1', 'Author', '#2563eb')]),
            text(' is beautiful '),
            text('✨', [insertionMark('ch_cs10', 'user-1', 'Author', '#2563eb')]),
          ],
        },
      ],
    },
  },
];
