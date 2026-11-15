// "Install me" screen: platform-specific guidance for adding Dr Bellini to the home screen.
import { isIOS, isStandalone } from './notifications.js';
import { isNative } from './native.js';

const DISMISS_KEY = 'streaky-install-dismissed';
const DISMISS_DAYS = 3;
const $ = (id) => document.getElementById(id);

const REPO = 'guymov217/Streaky';
const APK_URL = `https://github.com/${REPO}/releases/latest/download/dr-bellini.apk`;

let deferredPrompt = null;
let installed = false;
let apkReady = false; // a signed APK has been published

const isAndroid = () => /android/i.test(navigator.userAgent);

// Built-in browsers of social/chat apps, where "Add to Home Screen" / install is unavailable.
const IN_APP_RE = /FBAN|FBAV|FB_IAB|FBIOS|Instagram|WhatsApp|Line\/|Twitter|TikTok|musical_ly|BytedanceWebview|Snapchat|LinkedInApp|Pinterest|Telegram|; wv\)/i;
const isInAppBrowser = () => IN_APP_RE.test(navigator.userAgent);

// One-tap links that leave the in-app browser for Safari (iOS 17+) or Chrome (Android).
const safariLink = () => `x-safari-${appUrl()}`;
function chromeLink() {
  const url = new URL(appUrl());
  return `intent://${url.host}${url.pathname}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url.href)};end`;
}
const appUrl = () => new URL('./', location.href).href;

function platform() {
  if (isIOS()) return 'ios';
  if (isAndroid()) return 'android';
  return 'desktop';
}

const shareIcon = `<svg class="ios-share" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 10H6.5A1.5 1.5 0 0 0 5 11.5v8A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 17.5 10H16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
const addIcon = `<svg class="ios-add" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

function step(n, html) {
  return `<li class="step"><span class="step-num">${n}</span><div class="step-body">${html}</div></li>`;
}

function copyBlock(browser) {
  return `<div class="install-tip">
    <b>לא רואה את האפשרות?</b> כנראה הקישור נפתח בתוך וואטסאפ, אינסטגרם או פייסבוק.
    העתק את הקישור והדבק אותו ב‑${browser}.
    <button type="button" class="btn btn-white btn-small copy-link">📋 העתק קישור</button>
  </div>`;
}

// Shown inside WhatsApp/Instagram/Facebook etc.: one button to jump to the real browser.
function escapeBlock(browser, href) {
  return `<div class="escape">
    <p class="install-note">כדי להתקין, צריך לפתוח את הקישור ב‑<b>${browser}</b>:</p>
    <a class="btn btn-green btn-big" href="${href}">🧭 פתח ב‑${browser}</a>
    <p class="install-note small">לא נפתח? לחץ על <b>⋯</b> או <b>⋮</b> בפינה ובחר <b>"פתח ב‑${browser}"</b> / <b>"פתח בדפדפן"</b>.</p>
    <button type="button" class="btn btn-white btn-small copy-link">📋 או העתק את הקישור</button>
  </div>`;
}

function renderBody() {
  const body = $('installBody');
  const p = platform();
  $('installArrow').hidden = true;

  if (installed) {
    body.innerHTML = `<div class="install-done">🎉 <b>Dr Bellini הותקן!</b><br>פתח אותו מהאייקון במסך הבית.</div>`;
    return;
  }

  if (p === 'ios' && isInAppBrowser()) {
    body.innerHTML = escapeBlock('Safari', safariLink());
    return;
  }
  if (p === 'android' && isInAppBrowser()) {
    body.innerHTML = escapeBlock('Chrome', chromeLink());
    return;
  }

  if (p === 'ios') {
    body.innerHTML = `<ol class="steps">
      ${step(1, `לחץ על כפתור <b>השיתוף</b> <span class="chip">${shareIcon}</span><small>בתחתית המסך. בגרסאות חדשות של iOS: קודם על <b>⋯</b> ואז על "שיתוף"</small>`)}
      ${step(2, `בחר <span class="chip chip-row">${addIcon} הוסף למסך הבית</span> ואז <b>"הוסף"</b> 🎉<small>אם לא רואים, גלול קצת למטה ברשימה</small>`)}
    </ol>${copyBlock('Safari')}`;
    $('installArrow').hidden = /ipad/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1 && !/iphone/i.test(navigator.userAgent);
    return;
  }

  if (p === 'android' && apkReady) {
    body.innerHTML = `
      <a class="btn btn-green btn-big" href="${APK_URL}" download>📥 הורד את האפליקציה</a>
      <ol class="steps">
        ${step(1, `פתח את הקובץ <b>dr-bellini.apk</b> שירד<small>מההתראה בראש המסך או מתיקיית "הורדות"</small>`)}
        ${step(2, `אם מופיעה הודעה על התקנה ממקור לא ידוע, לחץ <b>"הגדרות"</b>, אפשר, וחזור<small>זה חד-פעמי. אם Play Protect מזהיר, לחץ "פרטים נוספים" ← "התקן בכל זאת"</small>`)}
        ${step(3, `לחץ <b>"התקן"</b> ופתח את Dr Bellini 🎉<small>עובדת בלי אינטרנט, והתזכורות מגיעות מהטלפון עצמו</small>`)}
      </ol>
      ${deferredPrompt ? '<button type="button" class="text-btn install-now">או התקנה מהירה דרך הדפדפן</button>' : ''}`;
    return;
  }

  if (p === 'android') {
    body.innerHTML = deferredPrompt
      ? `<button type="button" class="btn btn-green btn-big install-now">📲 התקן עכשיו</button>
         <p class="install-note">ההתקנה לוקחת שנייה, והאייקון יופיע במסך הבית שלך</p>`
      : `<ol class="steps">
          ${step(1, `לחץ על <span class="chip chip-dots">⋮</span> בפינה העליונה של Chrome`)}
          ${step(2, `בחר <b>"התקן אפליקציה"</b> או <b>"הוסף למסך הבית"</b>, ואז <b>"התקן"</b> 🎉`)}
        </ol>${copyBlock('Chrome')}`;
    return;
  }

  body.innerHTML = `
    <p class="install-note">Dr Bellini נועד לטלפון. סרוק את הקוד עם מצלמת הטלפון כדי לפתוח ולהתקין:</p>
    <div class="qr" id="qr"></div>
    <button type="button" class="btn btn-white btn-small copy-link">📋 העתק קישור</button>
    ${deferredPrompt ? '<button type="button" class="btn btn-green install-now">💻 התקן במחשב</button>' : ''}`;
  renderQR();
}

function renderQR() {
  const draw = () => {
    const el = $('qr');
    if (!el || !window.qrcode) return;
    const qr = window.qrcode(0, 'M');
    qr.addData(appUrl());
    qr.make();
    el.innerHTML = qr.createSvgTag(5, 0);
  };
  if (window.qrcode) return draw();
  const s = document.createElement('script');
  s.src = 'vendor/qrcode.js';
  s.onload = draw;
  document.head.appendChild(s);
}

export function openInstall() {
  renderBody();
  $('install').hidden = false;
}

function closeInstall() {
  $('install').hidden = true;
  try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* storage unavailable */ }
}

function recentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return at && Date.now() - at < DISMISS_DAYS * 864e5;
  } catch { return false; }
}

export function initInstall() {
  if (isStandalone() || isNative()) return; // already running as an installed app

  $('installBtn').hidden = false;
  $('installBtn').addEventListener('click', openInstall);
  $('installLater').addEventListener('click', closeInstall);

  $('install').addEventListener('click', async (e) => {
    if (e.target.closest('.install-now') && deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      deferredPrompt = null;
      if (outcome !== 'accepted') renderBody();
    } else if (e.target.closest('.copy-link')) {
      const btn = e.target.closest('.copy-link');
      try {
        await navigator.clipboard.writeText(appUrl());
        btn.textContent = '✔ הקישור הועתק';
      } catch {
        btn.textContent = appUrl();
      }
    }
  });

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (!$('install').hidden) renderBody();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferredPrompt = null;
    $('installBtn').hidden = true;
    if (!$('install').hidden) renderBody();
  });

  if (isAndroid()) checkApk();
  if (!recentlyDismissed()) openInstall();
}

// Offer the Android app download only once a release with the APK exists.
async function checkApk() {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return;
    const release = await res.json();
    apkReady = Array.isArray(release.assets) && release.assets.some((a) => a.name === 'dr-bellini.apk');
    if (apkReady && !$('install').hidden) renderBody();
  } catch { /* offline or rate-limited: keep the browser install */ }
}
