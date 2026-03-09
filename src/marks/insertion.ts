import { Mark, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    insertion: {
      setInsertion: (attributes: Record<string, string>) => ReturnType;
      unsetInsertion: () => ReturnType;
    };
  }
}

export const InsertionMark = Mark.create({
  name: 'insertion',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      changeId: { default: null },
      authorId: { default: null },
      authorName: { default: null },
      authorColor: { default: null },
      timestamp: { default: null },
    };
  },

  inclusive() {
    return false;
  },

  parseHTML() {
    return [{ tag: 'ins[data-change-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'ins',
      mergeAttributes(this.options.HTMLAttributes, {
        'data-change-id': HTMLAttributes.changeId,
        'data-author-id': HTMLAttributes.authorId,
        'data-author-name': HTMLAttributes.authorName,
        style: `--author-color: ${HTMLAttributes.authorColor};`,
      }),
      0,
    ];
  },
});
