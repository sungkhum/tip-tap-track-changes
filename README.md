# tiptap-track-changes

[![npm version](https://img.shields.io/npm/v/tiptap-track-changes.svg)](https://www.npmjs.com/package/tiptap-track-changes)
[![license](https://img.shields.io/npm/l/tiptap-track-changes.svg)](https://github.com/sungkhum/tip-tap-track-changes/blob/main/LICENSE)

Open-source track changes / suggesting mode extension for [Tiptap](https://tiptap.dev). Adds Google Docs-style change tracking to any Tiptap editor — insertions, deletions, replacements, and format changes are recorded as inline marks that can be individually accepted or rejected.

**[Live Demo](https://sungkhum.github.io/tip-tap-track-changes/)** | **[npm](https://www.npmjs.com/package/tiptap-track-changes)**

## Install

```bash
npm install tiptap-track-changes
```

```bash
yarn add tiptap-track-changes
```

```bash
pnpm add tiptap-track-changes
```

> Peer dependencies: `@tiptap/core` and `@tiptap/pm` (v2+). You probably already have these if you're using Tiptap.

## Features

- **Three editor modes**: `edit` (direct changes), `suggest` (tracked proposals), `view` (read-only)
- **Inline change tracking**: Insertions, deletions, replacements, and format changes (bold, italic, etc.)
- **Per-change accept/reject**: Accept or reject individual changes, or batch accept/reject all
- **Multi-author support**: Each author gets a name, ID, and color — changes are attributed and color-coded
- **Node-level tracking**: Paragraph splits (Enter key), block boundary deletions (Backspace/Delete across paragraphs), and block type changes (paragraph to heading)
- **Undo/redo integration**: Tracked changes work correctly with Tiptap's built-in history extension
- **Complex script support**: Tested with RTL (Arabic, Hebrew), Khmer, Thai, CJK, Devanagari, and other complex scripts
- **200+ tests**: Comprehensive test suite covering edge cases, multi-author scenarios, and complex scripts

## Quick Start

```ts
import { Editor } from '@tiptap/core'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import History from '@tiptap/extension-history'
import { TrackChangesExtension } from 'tiptap-track-changes'

const editor = new Editor({
  element: document.querySelector('#editor'),
  extensions: [
    Document,
    Paragraph,
    Text,
    History,
    TrackChangesExtension.configure({
      author: {
        id: 'user-1',
        name: 'Alice',
        color: '#2d5fce',
      },
      mode: 'suggest', // start in suggesting mode
      onStatusChange: (changeId, status) => {
        console.log(`Change ${changeId} was ${status}`)
      },
    }),
  ],
  content: '<p>Hello world</p>',
})
```

Any edits made while in `suggest` mode are tracked as proposed changes with inline visual markers.

## Commands

```ts
// Switch modes
editor.commands.setSuggestMode()
editor.commands.setEditMode()
editor.commands.setViewMode()
editor.commands.setTrackChangesMode('suggest') // programmatic

// Change author (e.g., when switching users)
editor.commands.setTrackChangesAuthor({
  id: 'user-2',
  name: 'Bob',
  color: '#c4362c',
})

// Accept/reject individual changes
editor.commands.acceptChange('change-id-here')
editor.commands.rejectChange('change-id-here')

// Accept/reject all pending changes
editor.commands.acceptAll()
editor.commands.rejectAll()
```

## Reading Changes

```ts
import {
  getTrackedChanges,
  getGroupedChanges,
  getPendingChangeCount,
  getBaseText,
  getResultText,
} from 'tiptap-track-changes'

// Get all individual tracked change marks
const changes = getTrackedChanges(editor)
// => TrackedChangeInfo[] with changeId, type, authorId, from, to, text, etc.

// Get changes grouped by changeId (insertion + deletion = replacement)
const groups = getGroupedChanges(editor)
// => Map<string, TrackedChangeInfo[]>

// Count pending changes
const count = getPendingChangeCount(editor) // => number

// Get document text with all changes rejected (original) or accepted (result)
const original = getBaseText(editor)
const result = getResultText(editor)
```

## Types

```ts
interface ChangeAuthor {
  id: string
  name: string
  color: string
}

type TrackChangesMode = 'edit' | 'suggest' | 'view'

interface TrackChangesOptions {
  author: ChangeAuthor
  mode?: TrackChangesMode
  onStatusChange?: (changeId: string, status: 'accepted' | 'rejected') => void
}

interface TrackedChangeInfo {
  changeId: string
  type: 'insertion' | 'deletion' | 'formatChange' | 'nodeChange'
  authorId: string
  authorName: string
  authorColor: string
  timestamp: string
  from: number
  to: number
  text: string
  formatAdded?: string
  formatRemoved?: string
}
```

## How It Works

In **suggest mode**, the extension intercepts text input, deletions, Enter key, and format toggles. Instead of modifying the document directly, it wraps changes in inline marks:

- **Insertions**: Text is inserted and wrapped in an `insertion` mark (rendered as `<ins>`)
- **Deletions**: Text is kept in the document but wrapped in a `deletion` mark (rendered as `<del>` with CSS to hide it visually)
- **Replacements**: A deletion mark on the old text + an insertion mark on the new text, sharing the same `changeId`
- **Format changes**: The format is applied, and a `formatChange` mark records what was added/removed

When a change is **accepted**, its marks are removed (insertions become normal text, deletions are removed from the document). When **rejected**, the opposite happens (insertions are removed, deletions become normal text).

## Running the Demo Locally

The `demo/` directory contains a full interactive demo with a review sidebar, timeline view, keyboard navigation, and pre-built scenarios.

```bash
git clone https://github.com/sungkhum/tip-tap-track-changes.git
cd tip-tap-track-changes
npm install
cd demo && npm install
cd .. && npm run dev
```

Or try the **[hosted demo](https://sungkhum.github.io/tip-tap-track-changes/)** directly.

## Running Tests

```bash
npm test          # single run
npm run test:watch # watch mode
```

## Contributing

Contributions are welcome. Please open an issue first to discuss what you'd like to change.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/my-feature`)
3. Run the tests (`npm test`)
4. Commit your changes
5. Open a pull request

## License

[MIT](LICENSE)
