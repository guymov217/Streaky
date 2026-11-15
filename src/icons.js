// Task icons: the study resources' own icons (rendered as small tiles in src/icons/) plus a general one.
// The logos belong to their respective owners and are used here only to identify each resource.

export const TASK_ICONS = [
  { id: 'uworld', label: 'UWorld', img: 'icons/uworld.png' },
  { id: 'sketchy', label: 'Sketchy', img: 'icons/sketchy.png' },
  { id: 'anki', label: 'Anki', img: 'icons/anki.png' },
  { id: 'firstaid', label: 'First Aid', img: 'icons/firstaid.png' },
  { id: 'nbme', label: 'NBME', img: 'icons/nbme.png' },
  {
    id: 'other',
    label: 'כללי',
    svg: `<svg viewBox="0 0 48 48" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <rect x=".5" y=".5" width="47" height="47" rx="11.3" fill="#fff" stroke="#e5e5e5"/>
      <circle cx="24" cy="24" r="12" fill="#58cc02"/>
      <path d="M18.6 24.4 L22.4 28.2 L29.6 20.6" stroke="#fff" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  },
];

export const DEFAULT_ICON = 'other';
const BY_ID = new Map(TASK_ICONS.map((i) => [i.id, i]));

// Markup for an icon id, or null for unknown ids (e.g. tasks saved with an emoji).
export function iconHTML(id) {
  const icon = BY_ID.get(id);
  if (!icon) return null;
  return icon.img ? `<img src="${icon.img}" alt="" draggable="false">` : icon.svg;
}

// Pick an icon from the task title (Hebrew or English), e.g. "40 שאלות UWorld" → uworld.
const HINTS = [
  ['nbme', /nbme|self[- ]?assess|cbse|free ?120|מבחן|בחינה|סימולציה/i],
  ['uworld', /u ?world|יו ?וורלד|q ?bank|שאלות/i],
  ['sketchy', /sketchy|סקצ['׳]?י/i],
  ['anki', /anki|אנקי|כרטיסי|flash ?cards?/i],
  ['firstaid', /first ?aid|פרסט ?אייד|\bfa\b/i],
];

export function suggestIcon(title) {
  return HINTS.find(([, re]) => re.test(title))?.[0] ?? DEFAULT_ICON;
}
