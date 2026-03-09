import { Mark, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    deletion: {
      setDeletion: (attributes: Record<string, string>) => ReturnType;
      unsetDeletion: () => ReturnType;
    };
  }
}

export const DeletionMark = Mark.create({
  name: 'deletion',

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
    return [{ tag: 'del[data-change-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'del',
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
