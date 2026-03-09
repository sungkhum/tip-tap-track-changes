import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Bold from '@tiptap/extension-bold';
import Italic from '@tiptap/extension-italic';
import Strike from '@tiptap/extension-strike';
import History from '@tiptap/extension-history';
import {
  TrackChangesExtension,
  getGroupedChanges,
  type ChangeAuthor,
  type TrackedChangeInfo,
} from 'tiptap-track-changes';
import { scenarios } from './scenarios';
import {
  updateChangesPanel,
  navigateToChange,
  classifyGroup,
  initSidebarTabs,
  resetTimeline,
  logBulkAction,
} from './sidebar';
import './styles.css';

// --- Authors with matching CSS custom property colors ---
const AUTHORS: Record<string, ChangeAuthor> = {
  user: { id: 'user-1', name: 'You', color: '#2d5fce' },
  reviewer: { id: 'user-2', name: 'Reviewer', color: '#c4362c' },
};

// --- Create editor ---
const editor = new Editor({
  element: document.querySelector('#editor')!,
  extensions: [
    Document,
    Paragraph,
    Text,
    Bold,
    Italic,
    Strike,
    History,
    TrackChangesExtension.configure({
      author: AUTHORS.user,
      mode: 'suggest',
    }),
  ],
  content: scenarios[0].content,
  autofocus: true,
});

// --- Scenario dropdown ---
const scenarioSelect = document.getElementById('scenario-selector') as HTMLSelectElement;
const scenarioBanner = document.getElementById('scenario-banner')!;
const scenarioDesc = document.getElementById('scenario-desc')!;

for (const scenario of scenarios) {
  const opt = document.createElement('option');
  opt.value = scenario.id;
  opt.textContent = scenario.name;
  scenarioSelect.appendChild(opt);
}

function loadScenario(id: string) {
  const scenario = scenarios.find((s) => s.id === id);
  if (!scenario) return;

  resetTimeline();
  editor.commands.setContent(scenario.content);

  // Set dir for RTL content
  const editorEl = document.querySelector('#editor .tiptap') as HTMLElement;
  if (editorEl) {
    editorEl.dir = scenario.dir ?? 'auto';
  }

  // Show description banner
  scenarioDesc.textContent = scenario.description;
  scenarioBanner.style.display = 'flex';

  updateAll();
}

scenarioSelect.addEventListener('change', () => loadScenario(scenarioSelect.value));

// Close banner
document.getElementById('scenario-banner-close')!.addEventListener('click', () => {
  scenarioBanner.style.display = 'none';
});

// --- Mode selector ---
const modeButtons = document.querySelectorAll<HTMLButtonElement>('#mode-selector .mode-btn');
const editorPane = document.getElementById('editor-pane')!;

modeButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode as 'edit' | 'suggest' | 'view';
    editor.commands.setTrackChangesMode(mode);
    modeButtons.forEach((b) => {
      b.classList.remove('active');
      b.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');
    updateViewMode(mode);
    updateStatus();
  });
});

// B6: View mode visual indicator
function updateViewMode(mode: string) {
  if (mode === 'view') {
    editorPane.classList.add('view-mode');
    const editorEl = document.querySelector('#editor .tiptap') as HTMLElement;
    if (editorEl) editorEl.setAttribute('aria-readonly', 'true');
  } else {
    editorPane.classList.remove('view-mode');
    const editorEl = document.querySelector('#editor .tiptap') as HTMLElement;
    if (editorEl) editorEl.removeAttribute('aria-readonly');
  }
}

// --- Author selector ---
const authorSelect = document.getElementById('author-selector') as HTMLSelectElement;
const authorDot = document.getElementById('author-dot') as HTMLElement;

authorSelect.addEventListener('change', () => {
  const author = AUTHORS[authorSelect.value];
  if (author) {
    editor.commands.setTrackChangesAuthor(author);
    authorDot.style.backgroundColor = author.color;
    updateStatus();
  }
});

// --- Accept/Reject all ---
document.getElementById('accept-all-btn')!.addEventListener('click', () => {
  const count = getGroupedChanges(editor).size;
  if (count > 0) logBulkAction('batch_accepted', count);
  editor.commands.acceptAll();
  editor.commands.focus();
});

document.getElementById('reject-all-btn')!.addEventListener('click', () => {
  const count = getGroupedChanges(editor).size;
  if (count > 0) logBulkAction('batch_rejected', count);
  editor.commands.rejectAll();
  editor.commands.focus();
});

// --- B2: Prev/Next change navigation ---
document.getElementById('prev-change-btn')?.addEventListener('click', () => {
  navigateToChange(editor, 'prev');
});
document.getElementById('next-change-btn')?.addEventListener('click', () => {
  navigateToChange(editor, 'next');
});

// B2: Alt+Up/Down keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.altKey && e.key === 'ArrowUp') {
    e.preventDefault();
    navigateToChange(editor, 'prev');
  } else if (e.altKey && e.key === 'ArrowDown') {
    e.preventDefault();
    navigateToChange(editor, 'next');
  }
});

// --- B5: Status bar with change breakdown ---
function updateStatus() {
  const mode = editor.storage.trackChanges.mode;
  const author = editor.storage.trackChanges.author;

  const modeEl = document.getElementById('status-mode')!;
  modeEl.textContent = mode;

  // Pulse dot color based on mode
  const dot = document.querySelector('.status-dot') as HTMLElement;
  if (dot) {
    if (mode === 'suggest') {
      dot.style.background = '#2a7d4f';
    } else if (mode === 'edit') {
      dot.style.background = '#2d5fce';
    } else {
      dot.style.background = '#8c8ca1';
      dot.style.animation = 'none';
    }
  }

  document.getElementById('status-author')!.textContent = author.name;

  // B5: Show change breakdown instead of text previews
  const groups = getGroupedChanges(editor);
  let insertions = 0;
  let deletions = 0;
  let replacements = 0;
  let formats = 0;

  for (const [, changes] of groups) {
    const type = classifyGroup(changes);
    if (type === 'replacement') replacements++;
    else if (type === 'insertion') insertions++;
    else if (type === 'formatChange') formats++;
    else deletions++;
  }

  const parts: string[] = [];
  if (insertions > 0) parts.push(`${insertions} insertion${insertions !== 1 ? 's' : ''}`);
  if (deletions > 0) parts.push(`${deletions} deletion${deletions !== 1 ? 's' : ''}`);
  if (replacements > 0) parts.push(`${replacements} replacement${replacements !== 1 ? 's' : ''}`);
  if (formats > 0) parts.push(`${formats} format${formats !== 1 ? 's' : ''}`);

  const statusChanges = document.getElementById('status-changes')!;
  statusChanges.textContent = parts.length > 0 ? parts.join(', ') : 'No changes';
}

// --- Full update ---
function updateAll() {
  updateChangesPanel(editor);
  updateStatus();
}

// --- Debounced editor listener ---
let raf = 0;
function scheduleUpdate() {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(updateAll);
}

editor.on('update', scheduleUpdate);
editor.on('selectionUpdate', scheduleUpdate);

// --- B4: Set initial aria-pressed on mode buttons ---
modeButtons.forEach((btn) => {
  btn.setAttribute('aria-pressed', btn.classList.contains('active') ? 'true' : 'false');
});

// --- Initialize sidebar tabs ---
initSidebarTabs();

// --- Initial render ---
updateAll();

// Load the second scenario by default (Translation Review has pre-baked changes — more interesting)
scenarioSelect.value = 'translation-review';
loadScenario('translation-review');
