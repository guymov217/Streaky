// The app's chihuahua mascot (fawn and white, big ears with grey tips) as inline SVG.
// Moods: happy, excited, sleepy, angry.

const INK = '#2a1810';
const RIM = '#24160f';
const FUR_LINE = '#c4863f';
const EAR_TILT = { happy: 0, excited: 5, sleepy: -30, angry: -16 };

let uid = 0;

function defs(id) {
  return `<defs>
    <radialGradient id="head-${id}" cx="50%" cy="38%" r="65%">
      <stop offset="0" stop-color="#efbd83"/><stop offset=".7" stop-color="#dfa05c"/><stop offset="1" stop-color="#c98845"/>
    </radialGradient>
    <linearGradient id="body-${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e2a663"/><stop offset="1" stop-color="#c98845"/>
    </linearGradient>
    <linearGradient id="ear-${id}" x1="1" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#dea060"/><stop offset=".62" stop-color="#cf9658"/><stop offset=".85" stop-color="#9d918c"/><stop offset="1" stop-color="#7f7672"/>
    </linearGradient>
    <radialGradient id="inner-${id}" cx="70%" cy="80%" r="90%">
      <stop offset="0" stop-color="#f7cdbf"/><stop offset=".7" stop-color="#e7a998"/><stop offset="1" stop-color="#c98f86"/>
    </radialGradient>
    <radialGradient id="white-${id}" cx="50%" cy="35%" r="70%">
      <stop offset="0" stop-color="#fffdf9"/><stop offset="1" stop-color="#ede3d4"/>
    </radialGradient>
    <radialGradient id="iris-${id}" cx="40%" cy="38%" r="70%">
      <stop offset="0" stop-color="#8a4520"/><stop offset=".55" stop-color="#4a2210"/><stop offset="1" stop-color="#1e0d06"/>
    </radialGradient>
    <radialGradient id="nose-${id}" cx="40%" cy="30%" r="80%">
      <stop offset="0" stop-color="#5a4f4b"/><stop offset="1" stop-color="#1d1816"/>
    </radialGradient>
  </defs>`;
}

// Left ear; the right one is the same group mirrored.
function ear(id) {
  return `
    <path d="M28 55 C22 38 13 19 10 7 C9 2.5 12.5 1 16 3.5 C29 12 46 20 55 31 Z" fill="url(#ear-${id})"/>
    <path d="M30 47 C25 34 20 22 17 12 C26 18 38 24 47 31 C40 34 34 40 30 47 Z" fill="url(#inner-${id})"/>
    <g stroke="#fff4ea" stroke-width=".9" stroke-linecap="round" opacity=".75" fill="none">
      <path d="M31 44 l4 -3"/><path d="M29 39 l4.5 -2"/><path d="M27 34 l4 -1"/><path d="M33 41 l3 -4"/>
    </g>
    <path d="M28 55 C22 38 13 19 10 7" stroke="${FUR_LINE}" stroke-width=".8" fill="none" opacity=".5"/>`;
}

function eyes(mood, id) {
  if (mood === 'excited') {
    return `<g stroke="${RIM}" stroke-width="3.6" fill="none" stroke-linecap="round">
        <path d="M29.5 62 Q37 53 44.5 62"/><path d="M55.5 62 Q63 53 70.5 62"/></g>`;
  }
  if (mood === 'sleepy') {
    return `<g stroke="${RIM}" stroke-width="3" fill="none" stroke-linecap="round">
        <path d="M30 61 Q37 66 44 61"/><path d="M56 61 Q63 66 70 61"/>
        <path d="M31.5 62.5 l-1.5 2"/><path d="M68.5 62.5 l1.5 2"/></g>`;
  }
  const angry = mood === 'angry';
  const ry = angry ? 5.6 : 7.6;
  const cy = angry ? 62.5 : 60.5;
  const eye = (cx) => `<g class="eye">
      <ellipse cx="${cx}" cy="${cy}" rx="8.6" ry="${ry + 1.1}" fill="${RIM}"/>
      <ellipse cx="${cx}" cy="${cy}" rx="7" ry="${ry - 0.2}" fill="url(#iris-${id})"/>
      <ellipse cx="${cx}" cy="${cy + 0.3}" rx="3.2" ry="${Math.max(ry - 3.5, 2)}" fill="#120804"/>
      <ellipse cx="${cx - 2.6}" cy="${cy - 2.8}" rx="2.4" ry="2" fill="#fff"/>
      <circle cx="${cx + 2.6}" cy="${cy + 2.4}" r="1" fill="#fff" opacity=".85"/>
    </g>`;
  const brows = angry
    ? `<g stroke="${RIM}" stroke-width="3.8" stroke-linecap="round">
         <path d="M27 51 L45 57.5"/><path d="M73 51 L55 57.5"/></g>`
    : `<ellipse cx="36" cy="49.5" rx="4.2" ry="2.2" fill="#f6dcb6" opacity=".9"/>
       <ellipse cx="64" cy="49.5" rx="4.2" ry="2.2" fill="#f6dcb6" opacity=".9"/>`;
  return eye(37) + eye(63) + brows;
}

function mouth(mood) {
  switch (mood) {
    case 'excited':
      return `<path d="M41.5 78 Q50 75.5 58.5 78 Q57.5 90.5 50 90.5 Q42.5 90.5 41.5 78 Z" fill="${INK}"/>
              <path d="M45 84 Q50 80.5 55 84 Q55.5 92 50 92 Q44.5 92 45 84 Z" fill="#ff7b8a"/>
              <path d="M50 82.5 V89" stroke="#e45a6b" stroke-width="1" stroke-linecap="round"/>`;
    case 'angry':
      return `<path d="M40.5 81 Q50 74.5 59.5 81 Q57.5 88 50 88 Q42.5 88 40.5 81 Z" fill="${INK}"/>
              <path d="M43.2 80.4 L45 84.6 L46.8 79 Z" fill="#fff"/>
              <path d="M53.2 79 L55 84.6 L56.8 80.4 Z" fill="#fff"/>
              <path d="M47.5 86.6 Q50 84.8 52.5 86.6" stroke="#ff7b8a" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
    case 'sleepy':
      return `<path d="M46 80 Q50 81.5 54 80" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
    default:
      return `<path d="M50 74.8 V78 M43.5 78 Q46.8 82.4 50 78 Q53.2 82.4 56.5 78" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
}

function extras(mood) {
  if (mood === 'angry') {
    return `<g class="anger" transform="translate(5 12)" stroke="#ff4b4b" stroke-width="2.8" fill="none" stroke-linecap="round">
        <path d="M78 14 Q81 17 78 20"/><path d="M87 14 Q84 17 87 20"/>
        <path d="M79 12 Q82.5 15 86 12"/><path d="M79 22 Q82.5 19 86 22"/>
      </g>
      <g class="huff" stroke="#b9c3c9" stroke-width="1.6" fill="none" stroke-linecap="round">
        <path d="M40 73 q-4 -1 -6 1"/><path d="M39 76 q-5 0 -7 2"/>
        <path d="M60 73 q4 -1 6 1"/><path d="M61 76 q5 0 7 2"/>
      </g>`;
  }
  if (mood === 'sleepy') {
    return `<text x="76" y="24" font-family="Rubik, sans-serif" font-weight="800" font-size="12" fill="#9fb0bb">z</text>
            <text x="85" y="14" font-family="Rubik, sans-serif" font-weight="800" font-size="9" fill="#9fb0bb">z</text>`;
  }
  if (mood === 'excited') {
    const star = (x, y, s) => `<path d="M${x} ${y - s} Q${x} ${y} ${x + s} ${y} Q${x} ${y} ${x} ${y + s} Q${x} ${y} ${x - s} ${y} Q${x} ${y} ${x} ${y - s} Z" fill="#ffc800"/>`;
    return `<g class="sparkles">${star(86, 22, 5)}${star(14, 26, 4)}${star(90, 46, 3)}</g>`;
  }
  return '';
}

export function mascotSVG(mood = 'happy') {
  const id = `m${++uid}`;
  const tilt = EAR_TILT[mood] ?? 0;
  const blush = mood === 'angry' ? '#ff4b4b' : '#ff8f84';
  const blushOpacity = mood === 'sleepy' ? 0.15 : mood === 'angry' ? 0.5 : 0.35;
  return `
  <svg viewBox="0 0 100 114" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
    ${defs(id)}
    <ellipse cx="50" cy="111.5" rx="30" ry="2.8" fill="#000" opacity=".08"/>

    <!-- body, chest fluff and front paws -->
    <path d="M23 112 C23 95 33 84 50 84 C67 84 77 95 77 112 Z" fill="url(#body-${id})"/>
    <path d="M37 112 C36 101 40 91 43.5 88 L45.5 91.5 L47.5 87.5 L50 91 L52.5 87.5 L54.5 91.5 L56.5 88 C60 91 64 101 63 112 Z" fill="url(#white-${id})"/>
    <g stroke="#e3d6c4" stroke-width=".8" fill="none" stroke-linecap="round">
      <path d="M45 97 l2 3"/><path d="M55 97 l-2 3"/><path d="M50 99 v3"/>
    </g>
    <ellipse cx="39" cy="108" rx="7.5" ry="4.6" fill="url(#white-${id})"/>
    <ellipse cx="61" cy="108" rx="7.5" ry="4.6" fill="url(#white-${id})"/>
    <g stroke="#d9cbb7" stroke-width=".9" stroke-linecap="round">
      <path d="M36.5 106.5 v3"/><path d="M39.5 106 v3.5"/><path d="M42.5 106.5 v3"/>
      <path d="M57.5 106.5 v3"/><path d="M60.5 106 v3.5"/><path d="M63.5 106.5 v3"/>
    </g>

    <!-- ears -->
    <g transform="rotate(${tilt} 38 42)">${ear(id)}</g>
    <g transform="translate(100 0) scale(-1 1) rotate(${tilt} 38 42)">${ear(id)}</g>

    <!-- head with fluffy cheeks -->
    <path d="M50 25 C69 25 82 38 83 54 C83.6 59 85.5 62 84 65.5 L86.5 67.5 C83.5 69.5 82.5 73.5 79.5 76.5 C73 84 62 88.5 50 88.5 C38 88.5 27 84 20.5 76.5 C17.5 73.5 16.5 69.5 13.5 67.5 L16 65.5 C14.5 62 16.4 59 17 54 C18 38 31 25 50 25 Z" fill="url(#head-${id})"/>
    <g stroke="${FUR_LINE}" stroke-width=".9" fill="none" stroke-linecap="round" opacity=".55">
      <path d="M22 60 q2 3 1 6"/><path d="M78 60 q-2 3 -1 6"/><path d="M38 31 q3 -2 6 -1"/><path d="M62 31 q-3 -2 -6 -1"/>
      <path d="M27 44 q2 -3 5 -4"/><path d="M73 44 q-2 -3 -5 -4"/>
    </g>

    <!-- white blaze and muzzle -->
    <path d="M47.3 25.4 C49 25.1 51 25.1 52.7 25.4 C52.6 36 52.5 44 57.5 52.5 L42.5 52.5 C47.5 44 47.4 36 47.3 25.4 Z" fill="url(#white-${id})"/>
    <path d="M50 50.5 C61.5 50.5 67.5 60.5 67.5 70 C67.5 80.5 59.5 87 50 87 C40.5 87 32.5 80.5 32.5 70 C32.5 60.5 38.5 50.5 50 50.5 Z" fill="url(#white-${id})"/>
    <ellipse cx="28" cy="71" rx="5" ry="3.4" fill="${blush}" opacity="${blushOpacity}"/>
    <ellipse cx="72" cy="71" rx="5" ry="3.4" fill="${blush}" opacity="${blushOpacity}"/>

    ${eyes(mood, id)}

    <!-- nose, whisker dots and whiskers -->
    <path d="M44 68.2 Q50 64.2 56 68.2 Q56.3 73.8 50 75 Q43.7 73.8 44 68.2 Z" fill="url(#nose-${id})"/>
    <ellipse cx="47.6" cy="70.6" rx="1.4" ry="1" fill="#0d0a09"/>
    <ellipse cx="52.4" cy="70.6" rx="1.4" ry="1" fill="#0d0a09"/>
    <ellipse cx="48" cy="67.4" rx="2.4" ry="1" fill="#fff" opacity=".4"/>
    <g fill="#b9a99a">
      <circle cx="41" cy="74" r=".55"/><circle cx="39.4" cy="76" r=".55"/><circle cx="42.2" cy="76.6" r=".55"/>
      <circle cx="59" cy="74" r=".55"/><circle cx="60.6" cy="76" r=".55"/><circle cx="57.8" cy="76.6" r=".55"/>
    </g>
    <g stroke="#6d5d52" stroke-width=".45" fill="none" opacity=".55" stroke-linecap="round">
      <path d="M39 75 Q30 73 21 74.5"/><path d="M39 77 Q30 77.5 22 80"/><path d="M40 78.5 Q33 81 26 85"/>
      <path d="M61 75 Q70 73 79 74.5"/><path d="M61 77 Q70 77.5 78 80"/><path d="M60 78.5 Q67 81 74 85"/>
    </g>

    ${mouth(mood)}
    ${extras(mood)}
  </svg>`;
}
