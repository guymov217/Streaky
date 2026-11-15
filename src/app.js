import { dateKey, activeStreak, completeDay, weekDays } from './streak.js';
import { pushAvailability, enablePush, disablePush, scheduleSync } from './notifications.js';
import { initInstall } from './install.js';

const STORAGE_KEY = 'streaky-v1';
const XP_PER_TASK = 10;
const PERFECT_DAY_BONUS = 20;
const EMOJIS = ['✅', '💧', '🏃', '📚', '🧘', '🍎', '💪', '🛏️', '🧹', '💊', '✍️', '🎸', '🐶', '🌱', '💻', '📞', '🦷', '☀️'];
const DAY_NAMES = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const MAX_TIMES = 4;
const DEFAULT_NOTIFY = { enabled: false, times: ['09:00', '20:00'], nudgeDismissed: false };

const $ = (id) => document.getElementById(id);

// ---------- State ----------
function loadState() {
  const fallback = { tasks: [], done: { date: dateKey(), ids: [] }, streak: 0, best: 0, lastDone: null, history: [], xp: 0, sound: true };
  let loaded = fallback;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) loaded = { ...fallback, ...saved };
  } catch { /* corrupt or unavailable storage */ }
  loaded.notify = { ...DEFAULT_NOTIFY, ...loaded.notify };
  loaded.deviceId ??= Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
  return loaded;
}

let state = loadState();
let editing = false;
let selectedEmoji = EMOJIS[0];

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
  scheduleSync(state, progressStatus());
}

// Today's progress as reported to the reminder server.
function progressStatus() {
  const ids = state.done.date === dateKey() ? state.done.ids : [];
  return {
    date: dateKey(),
    done: state.tasks.filter((t) => ids.includes(t.id)).length,
    total: state.tasks.length,
    streak: state.streak,
    lastDone: state.lastDone,
  };
}

// Start each new day with every task unchecked.
function rollDay() {
  const today = dateKey();
  if (state.done.date !== today) {
    state.done = { date: today, ids: [] };
    save();
  }
  return today;
}

// ---------- Sound & haptics ----------
let audioCtx;
function tone(freq, start, dur, type = 'sine', vol = 0.18) {
  audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
  const t = audioCtx.currentTime + start;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}
const sounds = {
  check: () => { tone(880, 0, 0.12, 'triangle'); tone(1320, 0.08, 0.2, 'triangle'); },
  uncheck: () => tone(330, 0, 0.12, 'sine', 0.1),
  add: () => { tone(523, 0, 0.1); tone(784, 0.07, 0.15); },
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.11, 0.35, 'triangle', 0.2)),
};
function play(name) {
  if (!state.sound) return;
  try { sounds[name](); } catch { /* audio unsupported */ }
}
function buzz(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

// ---------- Mascot ----------
function mascotSVG(mood) {
  const mouths = {
    happy: '<path d="M40 70 Q50 80 60 70" stroke="#4b1d00" stroke-width="4" fill="none" stroke-linecap="round"/>',
    excited: '<path d="M38 67 Q50 86 62 67 Z" fill="#4b1d00"/><path d="M44 74 Q50 80 56 74 Z" fill="#ff6b6b"/>',
    sleepy: '<path d="M43 73 H57" stroke="#4b1d00" stroke-width="4" stroke-linecap="round"/>',
  };
  const eyes = mood === 'sleepy'
    ? '<path d="M32 56 Q38 61 44 56" stroke="#4b1d00" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M56 56 Q62 61 68 56" stroke="#4b1d00" stroke-width="4" fill="none" stroke-linecap="round"/>'
    : `<g class="eye"><ellipse cx="38" cy="55" rx="7" ry="9" fill="#fff"/><circle cx="37" cy="56" r="4.5" fill="#4b1d00"/><circle cx="35.5" cy="54" r="1.6" fill="#fff"/></g>
       <g class="eye"><ellipse cx="62" cy="55" rx="7" ry="9" fill="#fff"/><circle cx="61" cy="56" r="4.5" fill="#4b1d00"/><circle cx="59.5" cy="54" r="1.6" fill="#fff"/></g>`;
  const grey = mood === 'sleepy';
  return `
  <svg viewBox="0 0 100 110" aria-hidden="true">
    <defs>
      <linearGradient id="fl-${mood}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${grey ? '#c9c9c9' : '#ffc800'}"/>
        <stop offset="1" stop-color="${grey ? '#9a9a9a' : '#ff7a00'}"/>
      </linearGradient>
    </defs>
    <ellipse cx="50" cy="104" rx="26" ry="5" fill="#000" opacity=".08"/>
    <path d="M50 4 C58 22 82 30 84 62 C86 86 70 100 50 100 C30 100 14 86 16 62 C17 46 26 40 30 28 C36 38 40 40 42 40 C42 26 44 14 50 4 Z" fill="url(#fl-${mood})"/>
    <path d="M50 46 C56 56 68 62 68 76 C68 88 60 94 50 94 C40 94 32 88 32 76 C32 66 40 62 44 54 C46 58 48 58 50 46 Z" fill="${grey ? '#e0e0e0' : '#ffe27a'}" opacity=".85"/>
    ${eyes}
    <circle cx="28" cy="68" r="5" fill="#ff5e5e" opacity="${grey ? 0 : 0.35}"/>
    <circle cx="72" cy="68" r="5" fill="#ff5e5e" opacity="${grey ? 0 : 0.35}"/>
    ${mouths[mood]}
  </svg>`;
}

// ---------- Messages ----------
function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

function messageFor(doneCount, total, streak, perfectToday) {
  if (total === 0) return 'היי! אני להבי 👋 הוסף מטלות ונתחיל לבנות רצף!';
  if (perfectToday) return pick(['יום מושלם! אתה אלוף 🏆', 'כל המטלות הושלמו! נתראה מחר 😎', `רצף של ${streak}! אל תעצור עכשיו 🔥`]);
  if (doneCount === 0) {
    return streak > 0 ? `יש לך רצף של ${streak} ימים 🔥 בוא נשמור עליו!` : 'יום חדש, התחלה חדשה! בוא נתחיל 💪';
  }
  const left = total - doneCount;
  if (left === 1) return 'עוד מטלה אחת בלבד! אתה כמעט שם 🤩';
  if (doneCount / total >= 0.5) return pick([`יותר מחצי! עוד ${left} ✨`, `איזה קצב! נשארו ${left} מטלות 🚀`]);
  return pick(['התחלה מעולה! ממשיכים 👏', `יפה מאוד! עוד ${left} לסיום 💪`]);
}

// ---------- Rendering ----------
function render({ popBubble = false } = {}) {
  const today = rollDay();
  const total = state.tasks.length;
  const doneIds = state.done.ids;
  const doneCount = state.tasks.filter((t) => doneIds.includes(t.id)).length;
  const streak = activeStreak(state, today);
  const perfectToday = state.lastDone === today;

  // Top bar
  $('streakCount').textContent = streak;
  $('streakStat').classList.toggle('cold', !perfectToday);
  $('xpCount').textContent = state.xp;
  $('bestCount').textContent = state.best;
  $('soundBtn').textContent = state.sound ? '🔊' : '🔇';
  $('bellBtn').classList.toggle('off', !state.notify.enabled);
  $('nudge').hidden = total === 0 || state.notify.enabled || state.notify.nudgeDismissed
    || ['unsupported', 'denied'].includes(pushAvailability());

  // Mascot + bubble
  const mood = perfectToday ? 'excited' : (total > 0 && doneCount === 0 && streak === 0 && state.best > 0 ? 'sleepy' : 'happy');
  const mascot = $('mascot');
  if (mascot.dataset.mood !== mood) {
    mascot.innerHTML = mascotSVG(mood);
    mascot.dataset.mood = mood;
  }
  const bubble = $('bubble');
  const key = `${doneCount}/${total}/${perfectToday}`;
  if (bubble.dataset.key !== key) {
    bubble.textContent = messageFor(doneCount, total, streak, perfectToday);
    bubble.dataset.key = key;
    if (popBubble) { bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop'); }
  }

  // Progress
  const pct = total ? (doneCount / total) * 100 : 0;
  $('progressCount').textContent = `${doneCount}/${total}`;
  $('progressFill').style.width = `${Math.max(pct, total && doneCount ? 6 : 0)}%`;
  $('progressFill').classList.toggle('full', total > 0 && doneCount === total);

  // Week strip
  $('week').innerHTML = weekDays(state.history, today).map((d, i) => `
    <div class="day ${d.done ? 'done' : ''} ${d.isToday ? 'today' : ''} ${d.future ? 'future' : ''}">
      <span class="day-name">${DAY_NAMES[i]}</span>
      <span class="day-dot">${d.done ? '🔥' : ''}</span>
    </div>`).join('');

  // Tasks
  $('empty').hidden = total > 0;
  $('editBtn').hidden = total === 0;
  $('editBtn').textContent = editing ? 'סיום' : 'עריכה';
  $('tasks').classList.toggle('editing', editing);
  const list = $('tasks');
  list.innerHTML = '';
  for (const task of state.tasks) {
    const li = document.createElement('li');
    li.className = `task ${doneIds.includes(task.id) ? 'done' : ''}`;
    li.dataset.id = task.id;
    li.innerHTML = `
      <span class="task-emoji"></span>
      <span class="task-title"></span>
      <span class="check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      <button class="delete-btn" aria-label="מחק מטלה">✕</button>`;
    li.querySelector('.task-emoji').textContent = task.emoji;
    li.querySelector('.task-title').textContent = task.title;
    li.setAttribute('role', 'checkbox');
    li.setAttribute('aria-checked', doneIds.includes(task.id));
    list.appendChild(li);
  }
  if (total === 0 && editing) editing = false;
}

function bump(el) {
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

function floatXP(x, y, text) {
  const el = document.createElement('div');
  el.className = 'xp-float';
  el.textContent = text;
  el.style.left = `${x - 30}px`;
  el.style.top = `${y - 20}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 950);
}

let toastTimer;
function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// ---------- Actions ----------
function toggleTask(id, li) {
  const today = rollDay();
  const ids = state.done.ids;
  const wasDone = ids.includes(id);

  if (wasDone) {
    state.done.ids = ids.filter((x) => x !== id);
    state.xp = Math.max(0, state.xp - XP_PER_TASK);
    play('uncheck');
    save();
    render({ popBubble: true });
    return;
  }

  state.done.ids = [...ids, id];
  state.xp += XP_PER_TASK;
  play('check');
  buzz(25);
  const rect = li.querySelector('.check').getBoundingClientRect();
  floatXP(rect.left + rect.width / 2, rect.top, `+${XP_PER_TASK} XP`);

  const allDone = state.tasks.every((t) => state.done.ids.includes(t.id));
  const firstPerfect = allDone && state.lastDone !== today;
  if (firstPerfect) {
    state = completeDay(state, today);
    state.xp += PERFECT_DAY_BONUS;
  }
  save();
  render({ popBubble: true });

  const newLi = $('tasks').querySelector(`[data-id="${id}"]`);
  newLi?.classList.add('just-done');
  bump($('xpCount').parentElement);
  const mascot = $('mascot');
  mascot.classList.remove('jump'); void mascot.offsetWidth; mascot.classList.add('jump');

  if (firstPerfect) setTimeout(showCelebration, 550);
}

function addTask(title, emoji) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  state.tasks.push({ id, title, emoji });
  save();
  play('add');
  buzz(15);
  render({ popBubble: true });
  if (state.lastDone === dateKey()) toast('הרצף של היום כבר נשמר ✔️ המטלה החדשה תיספר מחר');
}

function deleteTask(id, li) {
  li.classList.add('removing');
  setTimeout(() => {
    state.tasks = state.tasks.filter((t) => t.id !== id);
    state.done.ids = state.done.ids.filter((x) => x !== id);
    save();
    render();
  }, 280);
}

// ---------- Celebration ----------
function showCelebration() {
  const today = dateKey();
  const streak = activeStreak(state, today);
  const dayXp = state.tasks.length * XP_PER_TASK + PERFECT_DAY_BONUS;

  $('bigFlame').innerHTML = mascotSVG('excited');
  $('celebrateTitle').textContent = streak === state.best && streak > 1 ? 'שיא חדש! 🏆' : 'יום מושלם! 🎉';
  $('celebrateSub').textContent = streak === 1
    ? 'השלמת את כל המטלות של היום. זו תחילתו של רצף!'
    : pick(['השלמת את כל המטלות של היום. מטורף!', 'עקביות זה הסוד – ואתה מוכיח את זה!', 'עוד יום מושלם נכנס לספר!']);
  $('rewardXp').textContent = `+${dayXp}`;
  $('rewardStreak').textContent = `🔥 ${streak}`;
  $('rewardBest').textContent = `🏆 ${state.best}`;
  $('celebrate').hidden = false;

  // Count up the streak number from the previous value.
  const num = $('celebrateStreak');
  let n = Math.max(0, streak - 1);
  num.textContent = n;
  setTimeout(() => {
    const step = () => {
      if (n < streak) { n += 1; num.textContent = n; setTimeout(step, 120); }
    };
    step();
  }, 650);

  play('win');
  buzz([40, 60, 40, 60, 120]);
  startConfetti();
}

function hideCelebration() {
  $('celebrate').hidden = true;
  stopConfetti();
  bump($('streakStat'));
}

let confettiRaf;
function startConfetti() {
  const canvas = $('confetti');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  ctx.scale(dpr, dpr);
  const colors = ['#58cc02', '#ffc800', '#ff9600', '#1cb0f6', '#ff4b4b', '#ce82ff'];
  const pieces = Array.from({ length: 160 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 80,
    y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 14,
    vy: -Math.random() * 14 - 4,
    w: 6 + Math.random() * 6,
    h: 8 + Math.random() * 8,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    c: colors[Math.floor(Math.random() * colors.length)],
  }));
  const frame = () => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    let alive = 0;
    for (const p of pieces) {
      p.vy += 0.35;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      if (p.y < innerHeight + 20) alive++;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)));
      ctx.restore();
    }
    if (alive) confettiRaf = requestAnimationFrame(frame);
  };
  cancelAnimationFrame(confettiRaf);
  frame();
}
function stopConfetti() {
  cancelAnimationFrame(confettiRaf);
  const canvas = $('confetti');
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

// ---------- Add sheet ----------
function openSheet() {
  $('sheetBackdrop').hidden = false;
  $('taskInput').value = '';
  selectedEmoji = EMOJIS[0];
  renderEmojiGrid();
  setTimeout(() => $('taskInput').focus(), 250);
}
function closeSheet() { $('sheetBackdrop').hidden = true; }

function renderEmojiGrid() {
  $('emojiGrid').innerHTML = EMOJIS.map((e) =>
    `<button type="button" class="emoji-opt ${e === selectedEmoji ? 'selected' : ''}" data-emoji="${e}">${e}</button>`).join('');
}

// ---------- Reminders sheet ----------
function openRemind() {
  renderRemind();
  $('remindBackdrop').hidden = false;
}
function closeRemind() { $('remindBackdrop').hidden = true; }

function renderRemind() {
  const status = $('remindStatus');
  const toggle = $('pushToggle');
  const availability = pushAvailability();
  status.className = 'remind-status';
  toggle.hidden = false;

  if (state.notify.enabled) {
    status.classList.add('on');
    status.textContent = '✅ התזכורות פעילות';
    toggle.textContent = 'כבה התראות';
    toggle.className = 'btn btn-red btn-big';
  } else if (availability === 'needs-install') {
    status.classList.add('warn');
    status.innerHTML = `כדי לקבל התראות באייפון, קודם צריך להוסיף את האפליקציה למסך הבית:
      <ol><li>לחץ על כפתור השיתוף <b>⬆️</b> בתחתית Safari</li><li>בחר <b>"הוסף למסך הבית"</b></li><li>פתח את Streaky מהאייקון והפעל כאן את ההתראות</li></ol>`;
    toggle.hidden = true;
  } else if (availability === 'unsupported') {
    status.classList.add('warn');
    status.textContent = 'הדפדפן הזה לא תומך בהתראות. באייפון נדרשת גרסת iOS 16.4 ומעלה.';
    toggle.hidden = true;
  } else if (availability === 'denied') {
    status.classList.add('warn');
    status.textContent = 'ההתראות חסומות. אפשר להפעיל אותן בהגדרות הטלפון ← התראות ← Streaky.';
    toggle.hidden = true;
  } else {
    status.textContent = 'התזכורות כבויות';
    toggle.textContent = 'הפעל התראות';
    toggle.className = 'btn btn-green btn-big';
  }

  $('times').innerHTML = state.notify.times.map((t, i) => `
    <div class="time-row">
      <input type="time" class="input" value="${t}" data-i="${i}" aria-label="שעת תזכורת">
      <button type="button" class="time-del" data-i="${i}" aria-label="הסר שעה" ${state.notify.times.length === 1 ? 'disabled' : ''}>✕</button>
    </div>`).join('');
  $('addTime').hidden = state.notify.times.length >= MAX_TIMES;
}

async function togglePush() {
  const btn = $('pushToggle');
  btn.disabled = true;
  try {
    if (state.notify.enabled) {
      state.notify.enabled = false;
      await disablePush(state);
      toast('התזכורות כובו');
    } else {
      await enablePush(state, progressStatus());
      state.notify.enabled = true;
      play('add');
      toast(`🔔 מעולה! אזכיר לך ב-${state.notify.times.join(' וב-')}`);
    }
    save();
  } catch (err) {
    toast(err.message || 'משהו השתבש, נסה שוב');
  } finally {
    btn.disabled = false;
    renderRemind();
    render();
  }
}

// ---------- Events ----------
$('tasks').addEventListener('click', (e) => {
  const li = e.target.closest('.task');
  if (!li) return;
  if (editing) {
    if (e.target.closest('.delete-btn')) deleteTask(li.dataset.id, li);
    return;
  }
  toggleTask(li.dataset.id, li);
});

$('editBtn').addEventListener('click', () => { editing = !editing; render(); });
$('addBtn').addEventListener('click', openSheet);
$('cancelAdd').addEventListener('click', closeSheet);
$('sheetBackdrop').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeSheet(); });
$('emojiGrid').addEventListener('click', (e) => {
  const btn = e.target.closest('.emoji-opt');
  if (!btn) return;
  selectedEmoji = btn.dataset.emoji;
  renderEmojiGrid();
});
$('addForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const title = $('taskInput').value.trim();
  if (!title) return;
  closeSheet();
  addTask(title, selectedEmoji);
});
$('continueBtn').addEventListener('click', hideCelebration);
$('bellBtn').addEventListener('click', openRemind);
$('nudgeYes').addEventListener('click', openRemind);
$('nudgeClose').addEventListener('click', () => { state.notify.nudgeDismissed = true; save(); render(); });
$('closeRemind').addEventListener('click', closeRemind);
$('remindBackdrop').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeRemind(); });
$('pushToggle').addEventListener('click', togglePush);
$('addTime').addEventListener('click', () => {
  state.notify.times = [...state.notify.times, '13:00'];
  save();
  renderRemind();
});
$('times').addEventListener('change', (e) => {
  if (!e.target.matches('input[type=time]') || !e.target.value) return;
  state.notify.times[Number(e.target.dataset.i)] = e.target.value;
  state.notify.times = [...new Set(state.notify.times)].sort();
  save();
  renderRemind();
});
$('times').addEventListener('click', (e) => {
  const del = e.target.closest('.time-del');
  if (!del || state.notify.times.length === 1) return;
  state.notify.times = state.notify.times.filter((_, i) => i !== Number(del.dataset.i));
  save();
  renderRemind();
});
$('soundBtn').addEventListener('click', () => { state.sound = !state.sound; save(); render(); });
$('streakStat').addEventListener('click', () => {
  const streak = activeStreak(state, dateKey());
  toast(streak ? `🔥 רצף של ${streak} ימים · השיא שלך: ${state.best}` : 'השלם את כל המטלות היום כדי להדליק רצף 🔥');
});

// Re-check the date when the app comes back to the foreground (e.g. the next morning).
document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

// Permission revoked in the phone settings: reflect it in the app.
if (state.notify.enabled && 'Notification' in window && Notification.permission !== 'granted') {
  state.notify.enabled = false;
}
save();
render();
$('installMascot').innerHTML = mascotSVG('happy');
initInstall();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
