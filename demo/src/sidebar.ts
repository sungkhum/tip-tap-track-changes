import type { Editor } from '@tiptap/core';
import type { EditorView } from '@tiptap/pm/view';
import { getGroupedChanges, type TrackedChangeInfo } from 'tiptap-track-changes';
import { showInlineDiff, clearInlineDiff } from './inline-diff';

// --- Timeline event log ---

export interface TimelineEvent {
  id: string;
  type: 'created' | 'accepted' | 'rejected' | 'batch_accepted' | 'batch_rejected';
  timestamp: string;
  changeId?: string;
  changeType?: string;
  text?: string;
  insertedText?: string;
  deletedText?: string;
  authorName?: string;
  authorColor?: string;
  count?: number;
  /** Context before the change for position finding */
  contextBefore?: string;
  /** Context after the change for position finding */
  contextAfter?: string;
  /** Document snapshot (JSON) at time of this event — for version restore */
  snapshot?: unknown;
}

const timelineEvents: TimelineEvent[] = [];
let knownChangeIds = new Set<string>();
let activeTab: 'review' | 'timeline' = 'review';
// Track which regions are expanded (persists across re-renders)
const expandedRegions = new Set<string>();

// Track the currently selected timeline event for persistent highlighting
let selectedTimelineChangeId: string | null = null;

// Editor view reference for inline diff decorations
let editorView: EditorView | null = null;

/** Set the editor view reference (called from main.ts after editor creation) */
export function setEditorView(view: EditorView): void {
  editorView = view;
}

function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function logEvent(event: Omit<TimelineEvent, 'id' | 'timestamp'>): void {
  timelineEvents.unshift({
    ...event,
    id: generateEventId(),
    timestamp: new Date().toISOString(),
  });
  // Keep a reasonable max
  if (timelineEvents.length > 200) timelineEvents.length = 200;
}

/**
 * Extract surrounding context text for a change group.
 * Used for finding the change position later after it's been resolved.
 */
function getChangeContext(
  editor: Editor,
  changes: TrackedChangeInfo[],
): { contextBefore: string; contextAfter: string } {
  const doc = editor.state.doc;
  const minFrom = Math.min(...changes.map((c) => c.from));
  const maxTo = Math.max(...changes.map((c) => c.to));
  let contextBefore = '';
  let contextAfter = '';

  try {
    const $from = doc.resolve(minFrom);
    const parentStart = $from.start($from.depth);
    if (minFrom > parentStart) {
      const raw = doc.textBetween(parentStart, minFrom, '', '');
      contextBefore = raw.slice(-40);
    }
    const $to = doc.resolve(maxTo);
    const parentEnd = $to.end($to.depth);
    if (maxTo < parentEnd) {
      const raw = doc.textBetween(maxTo, parentEnd, '', '');
      contextAfter = raw.slice(0, 40);
    }
  } catch {
    // Ignore position errors
  }

  return { contextBefore, contextAfter };
}

function detectNewChanges(editor: Editor): void {
  const groups = getGroupedChanges(editor);
  const currentIds = new Set(groups.keys());

  for (const [changeId, changes] of groups) {
    if (!knownChangeIds.has(changeId)) {
      const groupType = classifyGroup(changes);
      const insertedText = changes.find((c) => c.type === 'insertion')?.text ?? '';
      const deletedText = changes.find((c) => c.type === 'deletion')?.text ?? '';
      const textPreview = insertedText || deletedText;
      const { contextBefore, contextAfter } = getChangeContext(editor, changes);
      logEvent({
        type: 'created',
        changeId,
        changeType: groupType,
        text: textPreview.slice(0, 50),
        insertedText: insertedText.slice(0, 120),
        deletedText: deletedText.slice(0, 120),
        authorName: changes[0].authorName,
        authorColor: changes[0].authorColor,
        contextBefore,
        contextAfter,
      });
    }
  }

  knownChangeIds = currentIds;
}

export function logBulkAction(
  type: 'batch_accepted' | 'batch_rejected',
  count: number,
  snapshot?: unknown,
): void {
  logEvent({ type, count, snapshot });
}

export function resetTimeline(): void {
  timelineEvents.length = 0;
  knownChangeIds.clear();
  expandedRegions.clear();
  clearTimelineSelection();
}

export function getTimelineEvents(): readonly TimelineEvent[] {
  return timelineEvents;
}

// --- Tab switching ---

function activateTab(tab: 'review' | 'timeline'): void {
  activeTab = tab;
  // Clear persistent timeline highlight when switching tabs
  clearTimelineSelection();
  const tabBtns = document.querySelectorAll<HTMLButtonElement>('.sidebar-tab');
  const reviewPanel = document.getElementById('panel-review');
  const timelinePanel = document.getElementById('panel-timeline');
  const navBtns = document.getElementById('sidebar-nav-group');

  tabBtns.forEach((b) => {
    const isActive = b.dataset.tab === tab;
    b.classList.toggle('active', isActive);
    b.setAttribute('aria-selected', String(isActive));
    b.setAttribute('tabindex', isActive ? '0' : '-1');
  });

  if (reviewPanel && timelinePanel) {
    reviewPanel.style.display = tab === 'review' ? 'block' : 'none';
    timelinePanel.style.display = tab === 'timeline' ? 'block' : 'none';
  }

  // Hide prev/next nav buttons in timeline view (M2)
  if (navBtns) {
    navBtns.style.display = tab === 'review' ? 'flex' : 'none';
  }
}

export function initSidebarTabs(): void {
  const tabBtns = document.querySelectorAll<HTMLButtonElement>('.sidebar-tab');
  const tabArr = [...tabBtns];

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      activateTab(btn.dataset.tab as 'review' | 'timeline');
      btn.focus();
    });

    // C2: Arrow key navigation between tabs (WAI-ARIA Tabs pattern)
    btn.addEventListener('keydown', (e) => {
      const idx = tabArr.indexOf(btn);
      let target: HTMLButtonElement | undefined;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        target = tabArr[(idx + 1) % tabArr.length];
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        target = tabArr[(idx - 1 + tabArr.length) % tabArr.length];
      } else if (e.key === 'Home') {
        e.preventDefault();
        target = tabArr[0];
      } else if (e.key === 'End') {
        e.preventDefault();
        target = tabArr[tabArr.length - 1];
      }

      if (target) {
        activateTab(target.dataset.tab as 'review' | 'timeline');
        target.focus();
      }
    });
  });
}

// --- Utilities ---

function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len) + '\u2026' : str;
}

function relativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diff = now - then;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function classifyGroup(
  changes: TrackedChangeInfo[],
): 'insertion' | 'deletion' | 'replacement' | 'formatChange' {
  const types = new Set(changes.map((c) => c.type));
  if (types.has('insertion') && types.has('deletion')) return 'replacement';
  if (types.has('formatChange')) return 'formatChange';
  if (types.has('insertion')) return 'insertion';
  return 'deletion';
}

const TYPE_LABELS: Record<string, string> = {
  replacement: 'replace',
  insertion: 'insert',
  deletion: 'delete',
  formatChange: 'format',
};

let announceTimer = 0;
function announce(message: string) {
  const region = document.getElementById('aria-announcements');
  if (region) {
    clearTimeout(announceTimer);
    region.textContent = message;
    announceTimer = window.setTimeout(() => {
      region.textContent = '';
    }, 5000);
  }
}

// --- Region grouping ---

interface ChangeGroup {
  changeId: string;
  changes: TrackedChangeInfo[];
}

interface Region {
  blockPos: number;
  groups: ChangeGroup[];
  from: number;
  to: number;
}

function getRegionKey(region: Region): string {
  return region.groups
    .map((g) => g.changeId)
    .sort()
    .join('|');
}

function getContainingBlockPos(editor: Editor, pos: number): number {
  try {
    const doc = editor.state.doc;
    const resolvePos = Math.min(Math.max(pos, 0), doc.content.size);
    const $pos = doc.resolve(resolvePos);
    for (let d = $pos.depth; d > 0; d--) {
      if ($pos.node(d).isBlock) {
        return $pos.before(d);
      }
    }
    const node = doc.nodeAt(resolvePos);
    if (node && node.isBlock) return resolvePos;
  } catch {
    // fallback
  }
  return pos;
}

function groupIntoRegions(
  sortedGroups: Array<[string, TrackedChangeInfo[]]>,
  editor: Editor,
): Region[] {
  const regionMap = new Map<number, Region>();
  const regions: Region[] = [];

  for (const [changeId, changes] of sortedGroups) {
    const minFrom = Math.min(...changes.map((c) => c.from));
    const maxTo = Math.max(...changes.map((c) => c.to));
    const blockPos = getContainingBlockPos(editor, minFrom);

    let region = regionMap.get(blockPos);
    if (!region) {
      region = { blockPos, groups: [], from: minFrom, to: maxTo };
      regionMap.set(blockPos, region);
      regions.push(region);
    }

    region.groups.push({ changeId, changes });
    region.from = Math.min(region.from, minFrom);
    region.to = Math.max(region.to, maxTo);
  }

  regions.sort((a, b) => a.from - b.from);
  return regions;
}

// --- Context extraction ---

function getContext(
  editor: Editor,
  from: number,
  to: number,
): { before: string; after: string } {
  const doc = editor.state.doc;
  let before = '';
  let after = '';

  try {
    const $from = doc.resolve(from);
    const parentStart = $from.start($from.depth);
    if (from > parentStart) {
      const raw = doc.textBetween(parentStart, from, '', '');
      const trimmed =
        raw.length > 30
          ? '\u2026' + raw.slice(-30).replace(/^\S*\s/, '')
          : raw;
      before = trimmed;
    }

    const $to = doc.resolve(to);
    const parentEnd = $to.end($to.depth);
    if (to < parentEnd) {
      const raw = doc.textBetween(to, parentEnd, '', '');
      const trimmed =
        raw.length > 30
          ? raw.slice(0, 30).replace(/\s\S*$/, '') + '\u2026'
          : raw;
      after = trimmed;
    }
  } catch {
    // Ignore position errors
  }

  return { before, after };
}

// --- Check if a change group represents a block-level change ---

function isBlockLevelGroup(
  changes: TrackedChangeInfo[],
  editor: Editor,
): boolean {
  if (changes.length !== 1) return false;
  try {
    const node = editor.state.doc.nodeAt(changes[0].from);
    return !!(node && node.isBlock);
  } catch {
    return false;
  }
}

// --- Hover helpers ---
// CRITICAL: We must NOT add/remove classes directly on elements inside ProseMirror's
// contenteditable DOM. Doing so triggers ProseMirror's MutationObserver, which
// re-parses the DOM and can strip marks — causing changes to vanish.
// Instead, we inject dynamic CSS rules that target existing data-change-id attributes.

const hoverStyleEl = document.createElement('style');
hoverStyleEl.id = 'track-changes-hover-styles';
document.head.appendChild(hoverStyleEl);

function highlightChange(changeId: string): void {
  // Escape the changeId for use in CSS selectors
  const escaped = CSS.escape(changeId);
  hoverStyleEl.textContent += `
    #editor ins[data-change-id="${escaped}"],
    #editor del[data-change-id="${escaped}"],
    #editor span[data-change-id="${escaped}"] {
      background: rgba(45, 95, 206, 0.15) !important;
      outline: 2px solid rgba(45, 95, 206, 0.3);
      outline-offset: 0;
      border-radius: 2px;
    }
  `;
}

function clearAllHighlights(): void {
  hoverStyleEl.textContent = '';
}

function clearTimelineSelection(): void {
  selectedTimelineChangeId = null;
  clearAllHighlights();
  // Remove active class from all timeline events
  document.querySelectorAll('.timeline-event.timeline-selected').forEach((el) => {
    el.classList.remove('timeline-selected');
  });
  // Clear any inline diff decorations
  if (editorView) clearInlineDiff(editorView);
}

/**
 * Find a change's position in the editor by changeId and navigate to it.
 * Returns true if the change was found and navigated to.
 */
function navigateToChangeById(editor: Editor, changeId: string): boolean {
  const groups = getGroupedChanges(editor);
  const changes = groups.get(changeId);
  if (!changes || changes.length === 0) return false;

  const firstChange = changes[0];
  try {
    editor.commands.setTextSelection(firstChange.from);
    editor.commands.focus();

    // Scroll the change element into view in the editor
    requestAnimationFrame(() => {
      const el = document.querySelector(
        `#editor [data-change-id="${CSS.escape(changeId)}"]`,
      );
      if (el) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Select a timeline event: persistently highlight it and navigate to it.
 */
function selectTimelineEvent(
  editor: Editor,
  changeId: string,
  eventElement: HTMLElement,
): void {
  // Clear any previous selection
  clearTimelineSelection();

  // Set new selection
  selectedTimelineChangeId = changeId;
  eventElement.classList.add('timeline-selected');
  highlightChange(changeId);

  // Try to navigate to the change in the editor
  navigateToChangeById(editor, changeId);
}

// --- Render change preview content ---

function renderPreviewContent(
  groupType: string,
  changes: TrackedChangeInfo[],
  container: HTMLElement,
  maxLen = 35,
): void {
  const deletedText = changes.find((c) => c.type === 'deletion')?.text ?? '';
  const insertedText = changes.find((c) => c.type === 'insertion')?.text ?? '';

  if (groupType === 'replacement') {
    const del = document.createElement('span');
    del.className = 'del-text';
    del.textContent = truncate(deletedText, maxLen);
    const ins = document.createElement('span');
    ins.className = 'ins-text';
    ins.textContent = truncate(insertedText, maxLen);
    container.append(del, ins);
  } else if (groupType === 'insertion') {
    const ins = document.createElement('span');
    ins.className = 'ins-text';
    ins.textContent = truncate(insertedText, maxLen + 15);
    container.append(ins);
  } else if (groupType === 'formatChange') {
    const fmt = document.createElement('span');
    fmt.className = 'format-text';
    const fc = changes.find((c) => c.type === 'formatChange');
    if (fc?.formatAdded) {
      fmt.textContent = `+${fc.formatAdded}`;
      fmt.classList.add('format-added');
    } else if (fc?.formatRemoved) {
      fmt.textContent = `-${fc.formatRemoved}`;
      fmt.classList.add('format-removed');
    }
    container.append(fmt);
  } else {
    const del = document.createElement('span');
    del.className = 'del-text';
    del.textContent = truncate(deletedText, maxLen + 15);
    container.append(del);
  }
}

// --- Render a single change card (for regions with 1 change group) ---

function renderChangeCard(
  changeId: string,
  changes: TrackedChangeInfo[],
  editor: Editor,
  index: number,
): HTMLElement {
  const card = document.createElement('div');
  card.className = 'change-card';
  card.dataset.changeId = changeId;
  card.style.animationDelay = `${index * 30}ms`;
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'article');
  card.setAttribute('aria-label', `${TYPE_LABELS[classifyGroup(changes)] ?? 'change'} by ${changes[0].authorName}`);

  const groupType = classifyGroup(changes);
  const firstChange = changes[0];
  const minFrom = Math.min(...changes.map((c) => c.from));
  const maxTo = Math.max(...changes.map((c) => c.to));
  card.dataset.from = String(minFrom);
  card.dataset.to = String(maxTo);
  card.style.borderLeftColor = firstChange.authorColor;

  // Header
  const header = document.createElement('div');
  header.className = 'change-card-header';

  const dot = document.createElement('span');
  dot.className = 'author-dot';
  dot.style.backgroundColor = firstChange.authorColor;

  const author = document.createElement('span');
  author.className = 'change-author';
  author.textContent = firstChange.authorName;

  const typeBadge = document.createElement('span');
  typeBadge.className = `change-type ${groupType}`;
  typeBadge.textContent = TYPE_LABELS[groupType] ?? groupType;

  header.append(dot, author, typeBadge);

  // Preview with context
  const context = getContext(editor, minFrom, maxTo);
  const preview = document.createElement('div');
  preview.className = 'change-preview';

  if (context.before) {
    const ctx = document.createElement('span');
    ctx.className = 'change-context';
    ctx.textContent = context.before;
    preview.append(ctx);
  }

  renderPreviewContent(groupType, changes, preview);

  if (context.after) {
    const ctx = document.createElement('span');
    ctx.className = 'change-context';
    ctx.textContent = context.after;
    preview.append(ctx);
  }

  // Meta
  const meta = document.createElement('div');
  meta.className = 'change-meta';

  const ts = document.createElement('span');
  ts.className = 'change-timestamp';
  ts.textContent = relativeTime(firstChange.timestamp);

  const actions = document.createElement('div');
  actions.className = 'change-actions';

  const acceptBtn = createActionButton('accept', () => {
    card.style.transition = 'all 0.25s ease';
    card.style.opacity = '0';
    card.style.transform = 'translateX(-12px) scale(0.97)';
    card.style.background = 'var(--accept-bg)';
    announce(`Change accepted: ${TYPE_LABELS[groupType]}`);
    const insText = changes.find((c) => c.type === 'insertion')?.text ?? '';
    const delText = changes.find((c) => c.type === 'deletion')?.text ?? '';
    const { contextBefore, contextAfter } = getChangeContext(editor, changes);
    // Snapshot before the action for version restore
    const snapshot = editor.getJSON();
    logEvent({
      type: 'accepted',
      changeId,
      changeType: groupType,
      text: (insText || delText).slice(0, 50),
      insertedText: insText.slice(0, 120),
      deletedText: delText.slice(0, 120),
      authorName: firstChange.authorName,
      authorColor: firstChange.authorColor,
      contextBefore,
      contextAfter,
      snapshot,
    });
    setTimeout(() => editor.commands.acceptChange(changeId), 200);
  });

  const rejectBtn = createActionButton('reject', () => {
    card.style.transition = 'all 0.25s ease';
    card.style.opacity = '0';
    card.style.transform = 'translateX(12px) scale(0.97)';
    card.style.background = 'var(--reject-bg)';
    announce(`Change rejected: ${TYPE_LABELS[groupType]}`);
    const insText = changes.find((c) => c.type === 'insertion')?.text ?? '';
    const delText = changes.find((c) => c.type === 'deletion')?.text ?? '';
    const { contextBefore, contextAfter } = getChangeContext(editor, changes);
    const snapshot = editor.getJSON();
    logEvent({
      type: 'rejected',
      changeId,
      changeType: groupType,
      text: (insText || delText).slice(0, 50),
      insertedText: insText.slice(0, 120),
      deletedText: delText.slice(0, 120),
      authorName: firstChange.authorName,
      authorColor: firstChange.authorColor,
      contextBefore,
      contextAfter,
      snapshot,
    });
    setTimeout(() => editor.commands.rejectChange(changeId), 200);
  });

  actions.append(acceptBtn, rejectBtn);
  meta.append(ts, actions);

  // Interactions
  const focusChange = () => {
    editor.commands.setTextSelection(firstChange.from);
    editor.commands.focus();
  };
  card.addEventListener('click', focusChange);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      focusChange();
    }
  });

  card.addEventListener('mouseenter', () => highlightChange(changeId));
  card.addEventListener('mouseleave', clearAllHighlights);

  card.append(header, preview, meta);
  return card;
}

// --- Action button factory ---

function createActionButton(
  type: 'accept' | 'reject',
  onClick: () => void,
  size = 12,
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = `change-action-btn change-${type}-btn`;
  if (type === 'accept') {
    btn.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    btn.title = 'Accept';
    btn.setAttribute('aria-label', 'Accept change');
  } else {
    btn.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    btn.title = 'Reject';
    btn.setAttribute('aria-label', 'Reject change');
  }
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  return btn;
}

// --- Region card: net-effect inline diff preview ---

function renderRegionPreview(editor: Editor, region: Region): HTMLElement {
  const preview = document.createElement('div');
  preview.className = 'change-preview region-diff';

  const doc = editor.state.doc;

  // Sort groups by position
  const sortedGroups = [...region.groups].sort((a, b) => {
    const aFrom = Math.min(...a.changes.map((c) => c.from));
    const bFrom = Math.min(...b.changes.map((c) => c.from));
    return aFrom - bFrom;
  });

  // Filter to text-level changes for inline preview
  const textGroups = sortedGroups.filter(
    (g) => !isBlockLevelGroup(g.changes, editor),
  );

  if (textGroups.length === 0) {
    const desc = document.createElement('span');
    desc.className = 'change-context';
    desc.textContent = `${region.groups.length} structural change${region.groups.length !== 1 ? 's' : ''}`;
    preview.append(desc);
    return preview;
  }

  // Get paragraph boundaries
  const firstFrom = Math.min(...textGroups[0].changes.map((c) => c.from));
  let parentStart: number;
  let parentEnd: number;
  try {
    const $from = doc.resolve(firstFrom);
    parentStart = $from.start($from.depth);
    parentEnd = $from.end($from.depth);
  } catch {
    parentStart = firstFrom;
    parentEnd = Math.max(
      ...textGroups[textGroups.length - 1].changes.map((c) => c.to),
    );
  }

  const maxCtx = 15;

  // Leading context
  if (parentStart < firstFrom) {
    try {
      let text = doc.textBetween(parentStart, firstFrom, '', '');
      if (text.length > maxCtx) text = '\u2026' + text.slice(-maxCtx);
      if (text) {
        const ctx = document.createElement('span');
        ctx.className = 'change-context';
        ctx.textContent = text;
        preview.append(ctx);
      }
    } catch {
      /* ignore */
    }
  }

  // Each change group inline
  for (let i = 0; i < textGroups.length; i++) {
    const group = textGroups[i];
    const minFrom = Math.min(...group.changes.map((c) => c.from));
    const maxTo = Math.max(...group.changes.map((c) => c.to));

    // Inter-change context
    if (i > 0) {
      const prevTo = Math.max(
        ...textGroups[i - 1].changes.map((c) => c.to),
      );
      if (prevTo < minFrom) {
        try {
          let text = doc.textBetween(prevTo, minFrom, '', '');
          if (text.length > maxCtx * 2)
            text = '\u2026' + text.slice(-maxCtx);
          if (text) {
            const ctx = document.createElement('span');
            ctx.className = 'change-context';
            ctx.textContent = text;
            preview.append(ctx);
          }
        } catch {
          /* ignore */
        }
      }
    }

    const groupType = classifyGroup(group.changes);
    renderPreviewContent(groupType, group.changes, preview, 20);
  }

  // Trailing context
  const lastTo = Math.max(
    ...textGroups[textGroups.length - 1].changes.map((c) => c.to),
  );
  if (lastTo < parentEnd) {
    try {
      let text = doc.textBetween(lastTo, parentEnd, '', '');
      if (text.length > maxCtx) text = text.slice(0, maxCtx) + '\u2026';
      if (text) {
        const ctx = document.createElement('span');
        ctx.className = 'change-context';
        ctx.textContent = text;
        preview.append(ctx);
      }
    } catch {
      /* ignore */
    }
  }

  return preview;
}

// --- Region card: revision item (compact, for timeline) ---

function renderRevisionItem(
  group: ChangeGroup,
  editor: Editor,
): HTMLElement {
  const item = document.createElement('div');
  item.className = 'revision-item';
  item.setAttribute('tabindex', '0');
  item.setAttribute('role', 'article');
  item.setAttribute('aria-label', `${TYPE_LABELS[classifyGroup(group.changes)] ?? 'change'} by ${group.changes[0].authorName}`);

  const groupType = classifyGroup(group.changes);
  const firstChange = group.changes[0];

  // Timeline dot
  const dot = document.createElement('div');
  dot.className = 'revision-dot';
  dot.style.backgroundColor = firstChange.authorColor;

  // Body
  const body = document.createElement('div');
  body.className = 'revision-body';

  // Header: author + type badge
  const header = document.createElement('div');
  header.className = 'revision-header';

  const authorName = document.createElement('span');
  authorName.className = 'revision-author';
  authorName.textContent = firstChange.authorName;

  const typeBadge = document.createElement('span');
  typeBadge.className = `change-type ${groupType}`;
  typeBadge.textContent = TYPE_LABELS[groupType] ?? groupType;

  header.append(authorName, typeBadge);

  // Preview
  const preview = document.createElement('div');
  preview.className = 'change-preview';
  renderPreviewContent(groupType, group.changes, preview, 25);

  // Meta: timestamp + individual actions
  const meta = document.createElement('div');
  meta.className = 'revision-meta';

  const ts = document.createElement('span');
  ts.className = 'revision-time';
  ts.textContent = relativeTime(firstChange.timestamp);

  const actions = document.createElement('div');
  actions.className = 'change-actions';

  const acceptBtn = createActionButton(
    'accept',
    () => {
      announce(`Revision accepted: ${TYPE_LABELS[groupType]}`);
      editor.commands.acceptChange(group.changeId);
    },
    11,
  );

  const rejectBtn = createActionButton(
    'reject',
    () => {
      announce(`Revision rejected: ${TYPE_LABELS[groupType]}`);
      editor.commands.rejectChange(group.changeId);
    },
    11,
  );

  actions.append(acceptBtn, rejectBtn);
  meta.append(ts, actions);

  body.append(header, preview, meta);
  item.append(dot, body);

  // Hover: highlight just this change in the editor
  item.addEventListener('mouseenter', () => {
    clearAllHighlights();
    highlightChange(group.changeId);
  });
  item.addEventListener('mouseleave', clearAllHighlights);

  // Click/keyboard: focus this change
  const focusRevision = () => {
    editor.commands.setTextSelection(firstChange.from);
    editor.commands.focus();
  };
  item.addEventListener('click', (e) => {
    e.stopPropagation();
    focusRevision();
  });
  item.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      focusRevision();
    }
  });

  return item;
}

// --- Region card (multi-change paragraph) ---

function renderRegionCard(
  region: Region,
  editor: Editor,
  index: number,
): HTMLElement {
  const card = document.createElement('div');
  card.className = 'change-card region-card';
  card.style.animationDelay = `${index * 30}ms`;
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'article');
  card.setAttribute(
    'aria-label',
    `Paragraph with ${region.groups.length} changes`,
  );

  const regionKey = getRegionKey(region);
  if (expandedRegions.has(regionKey)) card.classList.add('expanded');

  card.dataset.from = String(region.from);
  card.dataset.to = String(region.to);

  // Left border: most recent author's color
  const sortedByTime = [...region.groups].sort(
    (a, b) =>
      new Date(b.changes[0].timestamp).getTime() -
      new Date(a.changes[0].timestamp).getTime(),
  );
  card.style.borderLeftColor = sortedByTime[0].changes[0].authorColor;

  // --- Header ---
  const header = document.createElement('div');
  header.className = 'region-header';

  const authorsSection = document.createElement('div');
  authorsSection.className = 'region-authors';

  // Unique authors with overlapping dots
  const uniqueAuthors = new Map<string, { name: string; color: string }>();
  for (const group of region.groups) {
    const c = group.changes[0];
    if (!uniqueAuthors.has(c.authorId)) {
      uniqueAuthors.set(c.authorId, {
        name: c.authorName,
        color: c.authorColor,
      });
    }
  }

  const dotsWrap = document.createElement('div');
  dotsWrap.className = 'region-author-dots';
  for (const { color } of uniqueAuthors.values()) {
    const dot = document.createElement('span');
    dot.className = 'author-dot';
    dot.style.backgroundColor = color;
    dotsWrap.append(dot);
  }

  const authorNamesEl = document.createElement('span');
  authorNamesEl.className = 'region-author-names';
  authorNamesEl.textContent = [...uniqueAuthors.values()]
    .map((a) => a.name)
    .join(', ');

  authorsSection.append(dotsWrap, authorNamesEl);

  // Revision toggle
  const toggle = document.createElement('button');
  toggle.className = 'revision-toggle';
  toggle.setAttribute(
    'aria-expanded',
    String(expandedRegions.has(regionKey)),
  );
  toggle.innerHTML = `<span class="revision-count">${region.groups.length}</span><span>revision${region.groups.length !== 1 ? 's' : ''}</span><svg class="chevron-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const nowExpanded = card.classList.toggle('expanded');
    toggle.setAttribute('aria-expanded', String(nowExpanded));
    if (nowExpanded) {
      expandedRegions.add(regionKey);
    } else {
      expandedRegions.delete(regionKey);
      clearAllHighlights();
    }
  });

  header.append(authorsSection, toggle);

  // --- Net-effect preview ---
  const preview = renderRegionPreview(editor, region);

  // --- Meta: time range + bulk actions ---
  const meta = document.createElement('div');
  meta.className = 'change-meta';

  const timestamps = region.groups.map((g) =>
    new Date(g.changes[0].timestamp).getTime(),
  );
  const earliest = Math.min(...timestamps);
  const latest = Math.max(...timestamps);
  const ts = document.createElement('span');
  ts.className = 'change-timestamp';
  if (latest - earliest < 1000) {
    ts.textContent = relativeTime(new Date(latest).toISOString());
  } else {
    ts.textContent = `${relativeTime(new Date(earliest).toISOString())} \u2013 ${relativeTime(new Date(latest).toISOString())}`;
  }

  const actions = document.createElement('div');
  actions.className = 'change-actions';

  const acceptAllBtn = createActionButton('accept', () => {
    card.style.transition = 'all 0.25s ease';
    card.style.opacity = '0';
    card.style.transform = 'translateX(-12px) scale(0.97)';
    card.style.background = 'var(--accept-bg)';
    announce(`All ${region.groups.length} changes accepted`);
    logEvent({
      type: 'batch_accepted',
      count: region.groups.length,
      snapshot: editor.getJSON(),
    });
    setTimeout(() => {
      for (const g of [...region.groups].reverse()) {
        editor.commands.acceptChange(g.changeId);
      }
    }, 200);
  });
  acceptAllBtn.title = 'Accept all in region';
  acceptAllBtn.setAttribute(
    'aria-label',
    'Accept all changes in this region',
  );

  const rejectAllBtn = createActionButton('reject', () => {
    card.style.transition = 'all 0.25s ease';
    card.style.opacity = '0';
    card.style.transform = 'translateX(12px) scale(0.97)';
    card.style.background = 'var(--reject-bg)';
    announce(`All ${region.groups.length} changes rejected`);
    logEvent({
      type: 'batch_rejected',
      count: region.groups.length,
      snapshot: editor.getJSON(),
    });
    setTimeout(() => {
      for (const g of [...region.groups].reverse()) {
        editor.commands.rejectChange(g.changeId);
      }
    }, 200);
  });
  rejectAllBtn.title = 'Reject all in region';
  rejectAllBtn.setAttribute(
    'aria-label',
    'Reject all changes in this region',
  );

  actions.append(acceptAllBtn, rejectAllBtn);
  meta.append(ts, actions);

  // --- Expandable revision timeline ---
  const timeline = document.createElement('div');
  timeline.className = 'revision-timeline';

  // Sort revisions chronologically (oldest first)
  const chronoGroups = [...region.groups].sort(
    (a, b) =>
      new Date(a.changes[0].timestamp).getTime() -
      new Date(b.changes[0].timestamp).getTime(),
  );

  for (const group of chronoGroups) {
    timeline.append(renderRevisionItem(group, editor));
  }

  // --- Interactions ---
  const focusChange = () => {
    const pos = region.groups[0].changes[0].from;
    editor.commands.setTextSelection(pos);
    editor.commands.focus();
  };
  card.addEventListener('click', focusChange);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      focusChange();
    }
  });

  // Hover: highlight all changes when collapsed, none when expanded
  // (expanded revisions handle their own highlighting)
  card.addEventListener('mouseenter', () => {
    if (!card.classList.contains('expanded')) {
      for (const { changeId } of region.groups) {
        highlightChange(changeId);
      }
    }
  });
  card.addEventListener('mouseleave', clearAllHighlights);

  card.append(header, preview, meta, timeline);
  return card;
}

// --- Navigation (B2) ---

export function navigateToChange(
  editor: Editor,
  direction: 'next' | 'prev',
): void {
  const groups = getGroupedChanges(editor);
  if (groups.size === 0) return;

  const sortedGroups = [...groups.entries()].sort((a, b) => {
    const aPos = Math.min(...a[1].map((c) => c.from));
    const bPos = Math.min(...b[1].map((c) => c.from));
    return aPos - bPos;
  });

  const cursorPos = editor.state.selection.from;

  if (direction === 'next') {
    const next = sortedGroups.find(
      ([, changes]) =>
        Math.min(...changes.map((c) => c.from)) > cursorPos,
    );
    const target = next ?? sortedGroups[0];
    if (target) {
      const pos = Math.min(...target[1].map((c) => c.from));
      editor.commands.setTextSelection(pos);
      editor.commands.focus();
    }
  } else {
    const prev = [...sortedGroups]
      .reverse()
      .find(
        ([, changes]) =>
          Math.min(...changes.map((c) => c.from)) < cursorPos,
      );
    const target = prev ?? sortedGroups[sortedGroups.length - 1];
    if (target) {
      const pos = Math.min(...target[1].map((c) => c.from));
      editor.commands.setTextSelection(pos);
      editor.commands.focus();
    }
  }
}

// --- Panel update ---

export function updateChangesPanel(editor: Editor): void {
  // Detect new changes for the timeline
  detectNewChanges(editor);

  const container = document.getElementById('changes-list')!;
  const noChanges = document.getElementById('no-changes')!;
  const countEl = document.getElementById('change-count')!;
  const sidebarCount = document.getElementById('sidebar-count')!;

  const groups = getGroupedChanges(editor);
  const count = groups.size;

  countEl.textContent = `${count} change${count !== 1 ? 's' : ''}`;
  sidebarCount.textContent = count > 0 ? `${count}` : '';

  if (count === 0) {
    container.style.display = 'none';
    noChanges.style.display = activeTab === 'review' ? 'block' : 'none';
  } else {
    container.style.display = 'block';
    noChanges.style.display = 'none';
    container.innerHTML = '';

    const sortedGroups = [...groups.entries()].sort((a, b) => {
      const aPos = Math.min(...a[1].map((c) => c.from));
      const bPos = Math.min(...b[1].map((c) => c.from));
      return aPos - bPos;
    });

    // Group into regions by paragraph for visual proximity grouping
    const regions = groupIntoRegions(sortedGroups, editor);
    const cursorPos = editor.state.selection.from;
    let cardIndex = 0;

    regions.forEach((region) => {
      region.groups.forEach((group, groupIdx) => {
        const card = renderChangeCard(
          group.changeId,
          group.changes,
          editor,
          cardIndex++,
        );

        // Add visual grouping classes for multi-change regions
        if (region.groups.length > 1) {
          card.classList.add('region-grouped');
          if (groupIdx === 0) card.classList.add('region-first');
          else if (groupIdx === region.groups.length - 1)
            card.classList.add('region-last');
          else card.classList.add('region-middle');
        }

        // Active card highlight based on cursor position
        const minFrom = Math.min(...group.changes.map((c) => c.from));
        const maxTo = Math.max(...group.changes.map((c) => c.to));
        if (cursorPos >= minFrom && cursorPos <= maxTo) {
          card.classList.add('active-change');
          requestAnimationFrame(() => {
            card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          });
        }

        container.appendChild(card);
      });
    });
  }

  // Update timeline panel
  updateTimelinePanel(editor);
}

// --- Timeline rendering ---

const EVENT_ICONS: Record<string, string> = {
  created:
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
  accepted:
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  rejected:
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  batch_accepted:
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/><polyline points="20 12 9 23 4 18" opacity="0.5"/></svg>',
  batch_rejected:
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/><circle cx="12" cy="12" r="10" opacity="0.3"/></svg>',
};

const EVENT_LABELS: Record<string, string> = {
  created: 'Change created',
  accepted: 'Accepted',
  rejected: 'Rejected',
  batch_accepted: 'Batch accepted',
  batch_rejected: 'Batch rejected',
};

const EVENT_COLORS: Record<string, string> = {
  created: 'var(--author-user)',
  accepted: 'var(--accept)',
  rejected: 'var(--reject)',
  batch_accepted: 'var(--accept)',
  batch_rejected: 'var(--reject)',
};

function getDayLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const diff = today.getTime() - eventDay.getTime();
  const dayMs = 86_400_000;

  if (diff < dayMs) return 'Today';
  if (diff < dayMs * 2) return 'Yesterday';
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Trigger an inline diff for resolved changes only.
 * Active ("created") changes already have visible marks — no overlay needed.
 */
function triggerInlineDiff(event: TimelineEvent): void {
  if (!editorView) return;

  // Only show inline diff for resolved changes
  if (event.type !== 'accepted' && event.type !== 'rejected') return;
  if (!event.insertedText && !event.deletedText) return;

  let survivingText: string;
  let ghostText: string;
  let ghostPosition: 'before' | 'after';
  let action: 'accepted' | 'rejected';

  if (event.type === 'accepted') {
    // Accepted: inserted text survives, deleted text is gone
    survivingText = event.insertedText ?? '';
    ghostText = event.deletedText ?? '';
    ghostPosition = 'before';
    action = 'accepted';
  } else {
    // Rejected: original (deleted) text is restored, inserted text is gone
    survivingText = event.deletedText ?? '';
    ghostText = event.insertedText ?? '';
    ghostPosition = 'after';
    action = 'rejected';
  }

  if (!survivingText && !ghostText) return;

  showInlineDiff(editorView, {
    survivingText,
    ghostText,
    contextBefore: event.contextBefore ?? '',
    contextAfter: event.contextAfter ?? '',
    ghostPosition,
    action,
    authorColor: event.authorColor,
  });
}

function renderTimelineEvent(event: TimelineEvent, editor?: Editor): HTMLElement {
  const item = document.createElement('div');
  item.className = `timeline-event timeline-event-${event.type}`;
  item.setAttribute('tabindex', '0');
  item.setAttribute('role', 'article');
  item.setAttribute('aria-label', `${EVENT_LABELS[event.type] ?? event.type}${event.text ? ': ' + event.text : ''}`);

  const iconWrap = document.createElement('div');
  iconWrap.className = 'timeline-event-icon';
  iconWrap.style.color = EVENT_COLORS[event.type] ?? 'var(--ink-muted)';
  iconWrap.innerHTML = EVENT_ICONS[event.type] ?? '';

  const body = document.createElement('div');
  body.className = 'timeline-event-body';

  const label = document.createElement('span');
  label.className = 'timeline-event-label';

  if (event.type === 'batch_accepted' || event.type === 'batch_rejected') {
    const action = event.type === 'batch_accepted' ? 'Accepted' : 'Rejected';
    label.textContent = `${action} ${event.count} change${event.count !== 1 ? 's' : ''}`;
  } else {
    label.textContent = EVENT_LABELS[event.type] ?? event.type;
  }

  body.appendChild(label);

  // Change details — varies by event type
  const isResolved = event.type === 'accepted' || event.type === 'rejected';

  if (isResolved && (event.deletedText || event.insertedText)) {
    // Resolved: show type badge + compact diff summary (replaces text preview)
    const detail = document.createElement('div');
    detail.className = 'timeline-event-detail';

    if (event.changeType) {
      const badge = document.createElement('span');
      badge.className = `change-type ${event.changeType}`;
      badge.textContent = TYPE_LABELS[event.changeType] ?? event.changeType;
      detail.appendChild(badge);
    }

    body.appendChild(detail);

    const diffSummary = document.createElement('div');
    diffSummary.className = 'timeline-diff-summary';

    if (event.deletedText) {
      const del = document.createElement('span');
      del.className = 'timeline-diff-del';
      del.textContent = truncate(event.deletedText, 25);
      diffSummary.appendChild(del);
    }
    if (event.deletedText && event.insertedText) {
      const arrow = document.createElement('span');
      arrow.className = 'timeline-diff-arrow';
      arrow.textContent = '\u2192';
      diffSummary.appendChild(arrow);
    }
    if (event.insertedText) {
      const ins = document.createElement('span');
      ins.className = 'timeline-diff-ins';
      ins.textContent = truncate(event.insertedText, 25);
      diffSummary.appendChild(ins);
    }

    body.appendChild(diffSummary);
  } else if (event.changeType || event.text) {
    // Active/other: show type badge + text preview
    const detail = document.createElement('div');
    detail.className = 'timeline-event-detail';

    if (event.changeType) {
      const badge = document.createElement('span');
      badge.className = `change-type ${event.changeType}`;
      badge.textContent = TYPE_LABELS[event.changeType] ?? event.changeType;
      detail.appendChild(badge);
    }

    if (event.text) {
      const text = document.createElement('span');
      text.className = 'timeline-event-text';
      text.textContent = truncate(event.text, 30);
      detail.appendChild(text);
    }

    body.appendChild(detail);
  }

  // Author + time
  const meta = document.createElement('div');
  meta.className = 'timeline-event-meta';

  if (event.authorName) {
    const dot = document.createElement('span');
    dot.className = 'author-dot';
    dot.style.backgroundColor = event.authorColor ?? 'var(--ink-muted)';
    meta.appendChild(dot);

    const name = document.createElement('span');
    name.className = 'timeline-event-author';
    name.textContent = event.authorName;
    meta.appendChild(name);
  }

  const time = document.createElement('span');
  time.className = 'timeline-event-time';
  time.textContent = formatTime(event.timestamp);
  meta.appendChild(time);

  // Restore button for events with snapshots
  if (event.snapshot && editor) {
    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'timeline-restore-btn';
    restoreBtn.title = 'Restore document to this point';
    restoreBtn.setAttribute('aria-label', 'Restore document to this point');
    restoreBtn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>';
    restoreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Confirm before restoring
      const ok = window.confirm(
        'Restore the document to this point?\n\nThis will replace the current content with the state before this action was taken.',
      );
      if (ok) {
        clearTimelineSelection();
        editor.commands.setContent(event.snapshot as Record<string, unknown>);
        announce('Document restored');
      }
    });
    meta.appendChild(restoreBtn);
  }

  body.appendChild(meta);
  item.append(iconWrap, body);

  // --- Interaction behavior (varies by event type) ---
  if (editor) {
    const isActive = event.type === 'created';
    const changeId = event.changeId;

    if (changeId) {
      item.classList.add('timeline-interactive');

      // Hover: highlight change in editor (for active changes only — they have marks)
      if (isActive) {
        item.addEventListener('mouseenter', () => highlightChange(changeId));
        item.addEventListener('mouseleave', () => {
          if (selectedTimelineChangeId) {
            clearAllHighlights();
            highlightChange(selectedTimelineChangeId);
          } else {
            clearAllHighlights();
          }
        });
      }

      // Click behavior depends on event type
      const handleClick = () => {
        const wasSelected = selectedTimelineChangeId === changeId
          && item.classList.contains('timeline-selected');

        // Deselect if clicking the same event again
        if (wasSelected) {
          clearTimelineSelection();
          return;
        }

        // Select this event
        clearTimelineSelection();
        selectedTimelineChangeId = changeId;
        item.classList.add('timeline-selected');

        if (isActive) {
          // Active change: just navigate to it (marks are already visible)
          navigateToChangeById(editor, changeId);
          highlightChange(changeId);
        } else if (isResolved) {
          // Resolved change: show inline diff in the editor
          triggerInlineDiff(event);
        }
      };

      item.addEventListener('click', handleClick);
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      });
    }
  }

  return item;
}

export function updateTimelinePanel(editor?: Editor): void {
  const panel = document.getElementById('panel-timeline');
  if (!panel) return;

  const timelineList = document.getElementById('timeline-list');
  const noHistory = document.getElementById('no-history');
  if (!timelineList || !noHistory) return;

  if (timelineEvents.length === 0) {
    timelineList.style.display = 'none';
    noHistory.style.display = 'block';
    return;
  }

  timelineList.style.display = 'block';
  noHistory.style.display = 'none';
  timelineList.innerHTML = '';

  // Group events by day
  let currentDay = '';
  for (const event of timelineEvents) {
    const day = getDayLabel(event.timestamp);
    if (day !== currentDay) {
      currentDay = day;
      const dayHeader = document.createElement('div');
      dayHeader.className = 'timeline-day-header';
      dayHeader.textContent = day;
      timelineList.appendChild(dayHeader);
    }
    timelineList.appendChild(renderTimelineEvent(event, editor));
  }
}
