import { dateKey, activeStreak, completeDay, weekDays, weekday, scheduledOn, activeWeekdays, updateScheduleLog, restCheckerFromLog } from './streak.js';
import { loadFrom, saveTo, storageWorks, STORAGE_KEY } from './storage.js';
import { pushAvailability, enablePush, disablePush, scheduleSync } from './notifications.js';
import { initInstall } from './install.js';
import { mascotSVG } from './mascot.js';
import { TASK_ICONS, DEFAULT_ICON, iconHTML, suggestIcon } from './icons.js';
import { isNative, nativeHaptic, nativeNotificationsAllowed, enableNativeNotifications, cancelNativeReminders, scheduleNativeReminders, onNativeBack } from './native.js';
import { planLocalReminders } from './local-reminders.js';

const XP_PER_TASK = 10;
const PERFECT_DAY_BONUS = 20;
const DAY_NAMES = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const MAX_TIMES = 4;
const ANGRY_HOUR = 20; // from this hour the dog gets angry if today's tasks are not done
const DEFAULT_NOTIFY = { enabled: false, times: ['09:00', '20:00'], nudgeDismissed: false, style: 'dark' };
const STYLE_SAMPLES = {
  dark: '🩺 לא תלמד/י, מטופלים ימותו – נשארו עוד 2 מטלות. אין לחץ, זה רק חיי אדם.',
  normal: '💪 כמעט שם! השלמת 1 מתוך 3. נשארו 2 מטלות ליום מושלם',
};

const $ = (id) => document.getElementById(id);

// ---------- State ----------
// Accessing localStorage itself can throw (e.g. storage blocked), so it is looked up defensively.
const storage = (() => { try { return window.localStorage; } catch { return null; } })();
let storageOk = storageWorks(storage);

function loadState() {
  const fallback = { tasks: [], done: { date: dateKey(), ids: [] }, streak: 0, best: 0, lastDone: null, history: [], xp: 0, sound: true, schedule: [] };
  const { state: loaded, restored } = loadFrom(storage, fallback);
  loaded.notify = { ...DEFAULT_NOTIFY, ...loaded.notify };
  loaded.deviceId ??= Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
  // First run with schedule history: the current schedule applies to all past days.
  if (!loaded.schedule.length) loaded.schedule = [{ from: '0000-00-00', active: activeWeekdays(loaded.tasks) }];
  if (restored) setTimeout(() => toast('♻️ הנתונים שלך שוחזרו מהגיבוי האחרון'), 600);
  return loaded;
}

let state = loadState();
let editing = false;
let selectedIcon = DEFAULT_ICON;
let selectedDays = null; // null = every day, otherwise weekdays 0–6 (Sunday first)
let editingId = null; // task being edited in the sheet, null when adding
let laterOpen = false; // "other days" section expanded
let iconPicked = false; // once the user taps an icon, stop auto-suggesting from the title

function save() {
  if (!saveTo(storage, state) && storageOk) {
    storageOk = false;
    $('storageWarn').hidden = false;
  }
  syncReminders();
}

// After adding, editing or deleting a task: remember the schedule from today on, save, redraw.
function tasksChanged() {
  state.schedule = updateScheduleLog(state.schedule, state.tasks, dateKey());
  save();
  render({ popBubble: true });
}

// Installed Android app: schedule reminders on the phone. Browser/iPhone: report progress to the push server.
function syncReminders() {
  if (!isNative()) {
    scheduleSync(state, progressStatus());
    return;
  }
  if (state.notify.enabled) {
    scheduleNativeReminders(() => planLocalReminders(progressStatus(), { times: state.notify.times, style: state.notify.style }));
  }
}

const reminderAvailability = () => (isNative() ? 'available' : pushAvailability());

// Today's progress as reported to the reminder server.
function progressStatus() {
  const today = dateKey();
  const ids = state.done.date === today ? state.done.ids : [];
  const todays = tasksOn(today);
  return {
    date: today,
    done: todays.filter((t) => ids.includes(t.id)).length,
    total: todays.length,
    streak: state.streak,
    lastDone: state.lastDone,
    tasks: state.tasks.map((t) => ({ title: t.title, done: ids.includes(t.id), days: t.days ?? null })),
  };
}

// ---------- Schedule ----------
const tasksOn = (key) => state.tasks.filter((t) => scheduledOn(t.days, key));
const isRestDay = (key) => restCheckerFromLog(state.schedule)(key);
const repeatsDaily = (task) => !Array.isArray(task.days) || task.days.length === 0;

function daysLabel(days) {
  const sorted = [...days].sort();
  if (sorted.join() === '0,1,2,3,4') return 'א׳–ה׳';
  return sorted.map((d) => DAY_NAMES[d]).join(' ');
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
// Phones keep web audio suspended until a touch, and suspend it again whenever the app goes to the
// background (iOS reports "interrupted"), so the audio context is resumed on every touch.
let audioCtx;
function audio() {
  audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state !== 'running') audioCtx.resume().catch(() => {});
  return audioCtx;
}
function unlockAudio() {
  if (!state.sound || audioCtx?.state === 'running') return;
  try {
    const ctx = audio();
    // Playing one silent sample inside the touch fully unlocks output on iOS.
    const src = ctx.createBufferSource();
    src.buffer = ctx.createBuffer(1, 1, 22050);
    src.connect(ctx.destination);
    src.start(0);
  } catch { /* audio unsupported */ }
}
document.addEventListener('pointerdown', unlockAudio, { passive: true });
document.addEventListener('touchend', unlockAudio, { passive: true });

function tone(freq, start, dur, type = 'sine', vol = 0.18) {
  const ctx = audio();
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(ctx.destination);
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
  if (isNative()) {
    nativeHaptic(Array.isArray(pattern) ? 'success' : 'tap');
    return;
  }
  if (navigator.vibrate) navigator.vibrate(pattern);
}

// ---------- Messages ----------
function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

function messageFor(doneCount, total, streak, perfectToday, angry, rest) {
  if (rest) return pick(['היום אין מטלות 🌴 יום מנוחה, והרצף שלך בטוח!', 'יום חופש! 😎 נטען כוחות למחר']);
  if (total === 0) return 'הב הב! אני ד״ר בליני 🩺 הוסף מטלות ונתחיל לבנות רצף!';
  if (perfectToday) return pick(['יום מושלם! אתה אלוף 🏆', 'כל המטלות הושלמו! נתראה מחר 😎', `רצף של ${streak}! אל תעצור עכשיו 🔥`]);
  const left = total - doneCount;
  if (angry) {
    const leftText = left === 1 ? 'מטלה אחת' : `${left} מטלות`;
    return pick([
      `רררר... 😤 היום כמעט נגמר ועוד ${leftText} ${left === 1 ? 'לא בוצעה' : 'לא בוצעו'}!`,
      streak > 0 ? `הב! 💢 הרצף של ${streak} ימים בסכנה! קדימה!` : `נו?! 😠 ${left === 1 ? 'נשארה' : 'נשארו'} ${leftText}, אני מחכה!`,
      `אני לא הולך לישון עד שתסיים! 😤 עוד ${leftText}`,
    ]);
  }
  if (doneCount === 0) {
    return streak > 0 ? `יש לך רצף של ${streak} ימים 🔥 בוא נשמור עליו!` : 'יום חדש, התחלה חדשה! בוא נתחיל 💪';
  }
  if (left === 1) return 'עוד מטלה אחת בלבד! אתה כמעט שם 🤩';
  if (doneCount / total >= 0.5) return pick([`יותר מחצי! עוד ${left} ✨`, `איזה קצב! נשארו ${left} מטלות 🚀`]);
  return pick(['התחלה מעולה! ממשיכים 👏', `יפה מאוד! עוד ${left} לסיום 💪`]);
}

// ---------- Rendering ----------
function render({ popBubble = false } = {}) {
  const today = rollDay();
  const todays = tasksOn(today);
  const later = state.tasks.filter((t) => !scheduledOn(t.days, today));
  const total = todays.length;
  const hasTasks = state.tasks.length > 0;
  const rest = hasTasks && total === 0;
  const doneIds = state.done.ids;
  const doneCount = todays.filter((t) => doneIds.includes(t.id)).length;
  const streak = activeStreak(state, today, isRestDay);
  const perfectToday = state.lastDone === today;

  // Top bar
  $('streakCount').textContent = streak;
  $('streakStat').classList.toggle('cold', !perfectToday);
  $('xpCount').textContent = state.xp;
  $('bestCount').textContent = state.best;
  $('soundBtn').textContent = state.sound ? '🔊' : '🔇';
  $('bellBtn').classList.toggle('off', !state.notify.enabled);
  $('nudge').hidden = !hasTasks || state.notify.enabled || state.notify.nudgeDismissed
    || ['unsupported', 'denied'].includes(reminderAvailability());

  // Mascot + bubble
  const angry = total > 0 && !perfectToday && doneCount < total && new Date().getHours() >= ANGRY_HOUR;
  const mood = perfectToday ? 'excited'
    : angry ? 'angry'
    : (total > 0 && doneCount === 0 && streak === 0 && state.best > 0 ? 'sleepy' : 'happy');
  const mascot = $('mascot');
  if (mascot.dataset.mood !== mood) {
    mascot.innerHTML = mascotSVG(mood);
    mascot.dataset.mood = mood;
  }
  mascot.classList.toggle('angry', angry);
  const bubble = $('bubble');
  bubble.classList.toggle('angry', angry);
  const key = `${doneCount}/${total}/${perfectToday}/${angry}/${rest}`;
  if (bubble.dataset.key !== key) {
    bubble.textContent = messageFor(doneCount, total, streak, perfectToday, angry, rest);
    bubble.dataset.key = key;
    if (popBubble) { bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop'); }
  }

  // Progress
  const pct = total ? (doneCount / total) * 100 : 0;
  $('progressCount').textContent = rest ? 'יום מנוחה 🌴' : `${doneCount}/${total}`;
  $('progressFill').style.width = `${Math.max(pct, total && doneCount ? 6 : 0)}%`;
  $('progressFill').classList.toggle('full', total > 0 && doneCount === total);

  // Week strip
  $('week').innerHTML = weekDays(state.history, today, isRestDay).map((d, i) => `
    <div class="day ${d.done ? 'done' : ''} ${d.isToday ? 'today' : ''} ${d.future ? 'future' : ''} ${d.rest && !d.done ? 'rest' : ''}">
      <span class="day-name">${DAY_NAMES[i]}</span>
      <span class="day-dot">${d.done ? '🔥' : d.rest ? '💤' : ''}</span>
    </div>`).join('');

  // Tasks
  $('empty').hidden = hasTasks;
  $('restDay').hidden = !rest;
  $('editBtn').hidden = !hasTasks;
  $('editBtn').textContent = editing ? 'סיום' : 'עריכה';
  $('editHint').hidden = !editing;
  $('tasks').classList.toggle('editing', editing);
  $('laterTasks').classList.toggle('editing', editing);
  const list = $('tasks');
  list.innerHTML = '';
  for (const task of todays) {
    const done = doneIds.includes(task.id);
    const li = taskRow(task);
    li.classList.toggle('done', done);
    li.setAttribute('role', 'checkbox');
    li.setAttribute('aria-checked', done);
    list.appendChild(li);
  }

  // Tasks for other days: shown collapsed, tap to edit
  $('later').hidden = later.length === 0;
  $('laterToggle').textContent = `${laterOpen ? '▾' : '◂'} מטלות לימים אחרים (${later.length})`;
  $('laterTasks').hidden = !laterOpen;
  $('laterTasks').innerHTML = '';
  for (const task of later) {
    const li = taskRow(task);
    li.classList.add('later');
    $('laterTasks').appendChild(li);
  }
  if (!hasTasks && editing) editing = false;
}

function taskRow(task) {
  const li = document.createElement('li');
  li.className = 'task';
  li.dataset.id = task.id;
  li.innerHTML = `
    <span class="task-emoji"></span>
    <span class="task-text"><span class="task-title"></span><span class="task-days"></span></span>
    <span class="check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
    <button class="delete-btn" aria-label="מחק מטלה">✕</button>`;
  const iconEl = li.querySelector('.task-emoji');
  const icon = iconHTML(task.icon);
  if (icon) {
    iconEl.innerHTML = icon;
    iconEl.classList.add('has-icon');
  } else {
    iconEl.textContent = task.emoji ?? '✅'; // tasks saved before the icon set existed
  }
  li.querySelector('.task-title').textContent = task.title;
  const daysEl = li.querySelector('.task-days');
  if (repeatsDaily(task)) daysEl.remove();
  else daysEl.textContent = `🔁 ${daysLabel(task.days)}`;
  return li;
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
// action: optional { label, run } shown as a button (e.g. undo).
function toast(text, action) {
  const el = $('toast');
  el.textContent = text;
  if (action) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'toast-action';
    btn.textContent = action.label;
    btn.addEventListener('click', () => { el.classList.remove('show'); action.run(); }, { once: true });
    el.append(btn);
  }
  el.classList.toggle('has-action', Boolean(action));
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), action ? 6000 : 2200);
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

  const todays = tasksOn(today);
  const allDone = todays.length > 0 && todays.every((t) => state.done.ids.includes(t.id));
  const firstPerfect = allDone && (!state.lastDone || state.lastDone < today);
  if (firstPerfect) {
    state = completeDay(state, today, isRestDay);
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

function addTask(title, icon, days) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const task = { id, title, icon, days };
  state.tasks.push(task);
  tasksChanged();
  play('add');
  buzz(15);
  const today = dateKey();
  if (!scheduledOn(days, today)) toast(`🔁 המטלה נוספה לימים ${daysLabel(days)}`);
  else if (state.lastDone === today) toast('הרצף של היום כבר נשמר ✔️ המטלה החדשה תיספר מחר');
}

function updateTask(id, changes) {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return;
  Object.assign(task, changes);
  tasksChanged();
  toast(repeatsDaily(task) ? '✔️ נשמר · חוזרת כל יום' : `✔️ נשמר · חוזרת בימים ${daysLabel(task.days)}`);
}

function deleteTask(id, li) {
  li.classList.add('removing');
  setTimeout(() => {
    const index = state.tasks.findIndex((t) => t.id === id);
    if (index < 0) return;
    const [task] = state.tasks.splice(index, 1);
    const wasDone = state.done.ids.includes(id);
    state.done.ids = state.done.ids.filter((x) => x !== id);
    tasksChanged();
    toast(`🗑️ "${task.title}" נמחקה`, {
      label: 'ביטול',
      run: () => {
        if (state.tasks.some((t) => t.id === id)) return;
        state.tasks.splice(Math.min(index, state.tasks.length), 0, task);
        if (wasDone && state.done.date === dateKey()) state.done.ids.push(id);
        tasksChanged();
      },
    });
  }, 280);
}

// ---------- Celebration ----------
function showCelebration() {
  const today = dateKey();
  const streak = activeStreak(state, today, isRestDay);
  const dayXp = tasksOn(today).length * XP_PER_TASK + PERFECT_DAY_BONUS;

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
// Add a task, or edit `task` when given.
function openSheet(task = null) {
  editingId = task?.id ?? null;
  $('sheetTitle').textContent = task ? 'עריכת מטלה' : 'מטלה חדשה';
  $('sheetSubmit').textContent = task ? 'שמור' : 'הוסף';
  $('taskInput').value = task?.title ?? '';
  selectedIcon = task && iconHTML(task.icon) ? task.icon : DEFAULT_ICON;
  iconPicked = Boolean(task);
  selectedDays = task && !repeatsDaily(task) ? [...task.days] : null;
  renderIconGrid();
  renderRepeat();
  $('sheetBackdrop').hidden = false;
  if (!task) setTimeout(() => $('taskInput').focus(), 250);
}

function renderRepeat() {
  const daily = selectedDays === null;
  for (const btn of document.querySelectorAll('.repeat-opt')) {
    const on = (btn.dataset.repeat === 'daily') === daily;
    btn.classList.toggle('selected', on);
    btn.setAttribute('aria-pressed', on);
  }
  $('dayPicker').hidden = daily;
  $('dayPicker').innerHTML = DAY_NAMES.map((name, i) => {
    const on = Boolean(selectedDays?.includes(i));
    return `<button type="button" class="day-chip ${on ? 'selected' : ''}" data-day="${i}" aria-pressed="${on}">${name}</button>`;
  }).join('');
}
function closeSheet() { $('sheetBackdrop').hidden = true; }

function renderIconGrid() {
  $('iconGrid').innerHTML = TASK_ICONS.map((i) => `
    <button type="button" class="icon-opt ${i.id === selectedIcon ? 'selected' : ''}" data-icon="${i.id}" aria-pressed="${i.id === selectedIcon}">
      ${iconHTML(i.id)}<span>${i.label}</span>
    </button>`).join('');
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
  const availability = reminderAvailability();
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
      <ol><li>לחץ על כפתור השיתוף <b>⬆️</b> בתחתית Safari</li><li>בחר <b>"הוסף למסך הבית"</b></li><li>פתח את Dr Bellini מהאייקון והפעל כאן את ההתראות</li></ol>`;
    toggle.hidden = true;
  } else if (availability === 'unsupported') {
    status.classList.add('warn');
    status.textContent = 'הדפדפן הזה לא תומך בהתראות. באייפון נדרשת גרסת iOS 16.4 ומעלה.';
    toggle.hidden = true;
  } else if (availability === 'denied') {
    status.classList.add('warn');
    status.textContent = 'ההתראות חסומות. אפשר להפעיל אותן בהגדרות הטלפון ← התראות ← Dr Bellini.';
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

  for (const btn of document.querySelectorAll('.style-opt')) {
    btn.classList.toggle('selected', btn.dataset.style === state.notify.style);
  }
  $('styleSample').textContent = STYLE_SAMPLES[state.notify.style];
}

async function togglePush() {
  const btn = $('pushToggle');
  btn.disabled = true;
  try {
    if (state.notify.enabled) {
      state.notify.enabled = false;
      if (isNative()) await cancelNativeReminders();
      else await disablePush(state);
      toast('התזכורות כובו');
    } else {
      if (isNative()) await enableNativeNotifications();
      else await enablePush(state, progressStatus());
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

// Android back button: close whatever is on top. Returns false when nothing was open.
function closeTopOverlay() {
  if (!$('celebrate').hidden) { hideCelebration(); return true; }
  if (!$('remindBackdrop').hidden) { closeRemind(); return true; }
  if (!$('sheetBackdrop').hidden) { closeSheet(); return true; }
  if (editing) { editing = false; render(); return true; }
  return false;
}

// ---------- Events ----------
$('tasks').addEventListener('click', (e) => {
  const li = e.target.closest('.task');
  if (!li) return;
  if (editing) {
    if (e.target.closest('.delete-btn')) deleteTask(li.dataset.id, li);
    else openSheet(state.tasks.find((t) => t.id === li.dataset.id));
    return;
  }
  toggleTask(li.dataset.id, li);
});
$('laterTasks').addEventListener('click', (e) => {
  const li = e.target.closest('.task');
  if (!li) return;
  if (editing && e.target.closest('.delete-btn')) deleteTask(li.dataset.id, li);
  else openSheet(state.tasks.find((t) => t.id === li.dataset.id));
});
$('laterToggle').addEventListener('click', () => { laterOpen = !laterOpen; render(); });
$('repeatOpts').addEventListener('click', (e) => {
  const btn = e.target.closest('.repeat-opt');
  if (!btn) return;
  selectedDays = btn.dataset.repeat === 'daily' ? null : (selectedDays ?? [weekday(dateKey())]);
  renderRepeat();
});
$('dayPicker').addEventListener('click', (e) => {
  const btn = e.target.closest('.day-chip');
  if (!btn) return;
  const day = Number(btn.dataset.day);
  const next = selectedDays.includes(day) ? selectedDays.filter((d) => d !== day) : [...selectedDays, day].sort();
  if (next.length === 0) { toast('צריך לבחור לפחות יום אחד'); return; }
  selectedDays = next.length === 7 ? null : next; // all seven days = every day
  renderRepeat();
});

$('editBtn').addEventListener('click', () => { editing = !editing; render(); });
$('addBtn').addEventListener('click', () => openSheet());
$('cancelAdd').addEventListener('click', closeSheet);
$('sheetBackdrop').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeSheet(); });
$('iconGrid').addEventListener('click', (e) => {
  const btn = e.target.closest('.icon-opt');
  if (!btn) return;
  selectedIcon = btn.dataset.icon;
  iconPicked = true;
  renderIconGrid();
});
$('taskInput').addEventListener('input', () => {
  if (iconPicked) return;
  const suggested = suggestIcon($('taskInput').value);
  if (suggested !== selectedIcon) {
    selectedIcon = suggested;
    renderIconGrid();
  }
});
$('addForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const title = $('taskInput').value.trim();
  if (!title) return;
  closeSheet();
  if (editingId) updateTask(editingId, { title, icon: selectedIcon, days: selectedDays });
  else addTask(title, selectedIcon, selectedDays);
});
$('continueBtn').addEventListener('click', hideCelebration);
$('bellBtn').addEventListener('click', openRemind);
$('nudgeYes').addEventListener('click', openRemind);
$('nudgeClose').addEventListener('click', () => { state.notify.nudgeDismissed = true; save(); render(); });
$('closeRemind').addEventListener('click', closeRemind);
$('remindBackdrop').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeRemind(); });
$('pushToggle').addEventListener('click', togglePush);
$('styleOpts').addEventListener('click', (e) => {
  const btn = e.target.closest('.style-opt');
  if (!btn) return;
  state.notify.style = btn.dataset.style;
  save();
  renderRemind();
});
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
$('soundBtn').addEventListener('click', () => {
  state.sound = !state.sound;
  save();
  render();
  play('add'); // audible confirmation that sound is on
});
$('streakStat').addEventListener('click', () => {
  const streak = activeStreak(state, dateKey(), isRestDay);
  toast(streak ? `🔥 רצף של ${streak} ימים · השיא שלך: ${state.best}` : 'השלם את כל המטלות היום כדי להדליק רצף 🔥');
});

// Another tab or window of the app changed the data: take it instead of overwriting it later.
window.addEventListener('storage', (e) => {
  if (e.key !== STORAGE_KEY || !e.newValue) return;
  state = loadState();
  render();
});

// Ask the browser to keep the data even under storage pressure or after a while without visits.
navigator.storage?.persist?.().catch(() => {});

// Re-check the date when the app comes back to the foreground (e.g. the next morning).
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  render();
  if (isNative()) syncReminders(); // extend the scheduled days each time the app is opened
});
// Keep mood and date current while the app stays open (e.g. it turns 20:00).
setInterval(() => { if (!document.hidden) render(); }, 60_000);

// Permission revoked in the phone settings: reflect it in the app.
if (isNative()) {
  if (state.notify.enabled) {
    nativeNotificationsAllowed().then((ok) => {
      if (!ok) { state.notify.enabled = false; save(); render(); }
    });
  }
  onNativeBack(closeTopOverlay);
} else if (state.notify.enabled && 'Notification' in window && Notification.permission !== 'granted') {
  state.notify.enabled = false;
}
$('storageWarn').hidden = storageOk;
save();
render();
$('installMascot').innerHTML = mascotSVG('happy');
initInstall();

if (!isNative() && 'serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
