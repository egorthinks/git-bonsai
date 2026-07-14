// git-bonsai playground: type a login, watch the tree grow — no install, no token.
// Data comes from public, CORS-enabled endpoints only:
//   api.github.com/users/:login            account age, type
//   api.github.com/users/:login/repos      languages (primary lang + repo size)
//   github-contributions-api.jogruber.de   the public contribution calendar
// The engine (docs/engine.js) is the exact code the Action runs, so the same
// data grows the same tree. Public preview differs from the Action only in
// inputs: no private counts, and languages are approximated by each repo's
// primary language instead of per-language byte sizes.
/* global Bonsai */
'use strict';

const $ = (id) => document.getElementById(id);
const canvas = $('tree');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const STYLE_JP = {
  formal: 'chokkan · formal upright', slanted: 'shakan · slanting',
  'han-kengai': 'han-kengai · semi-cascade', cascade: 'kengai · cascade',
  bunjin: 'bunjingi · literati', windswept: 'fukinagashi · windswept',
  broom: 'hokidachi · broom', sokan: 'sokan · twin trunk',
  kabudachi: 'kabudachi · clump', 'yose-ue': 'yose-ue · forest',
  sekijoju: 'sekijoju · root over rock',
};
const SPECIES_NAME = {
  pine: 'pine · matsu', maple: 'maple · momiji', cherry: 'cherry · sakura',
  juniper: 'juniper · shimpaku', elm: 'elm · zelkova',
};

// ------------------------------------------------------------- data assembly

async function getJson(url, what) {
  let res;
  try {
    res = await fetch(url);
  } catch {
    throw new Error(`could not reach ${what} — network hiccup? Try again, or use demo mode.`);
  }
  if (res.status === 404) throw new Error('NOT_FOUND');
  if (res.status === 403 || res.status === 429) {
    throw new Error('GitHub anonymous rate limit reached (60 requests/hour per IP). ' +
      'Wait a bit and retry — or install the Action, which has no such limit.');
  }
  if (!res.ok) throw new Error(`${what} answered HTTP ${res.status}`);
  return res.json();
}

// The public contribution calendar has no official CORS endpoint, so we walk
// a chain of independent sources until one works. The last one parses
// GitHub's own calendar HTML through a CORS passthrough — slowest, but it
// only dies if GitHub does.
const CALENDAR_SOURCES = [
  {
    label: 'jogruber.de',
    async fetch(login) {
      const data = await getJson(
        'https://github-contributions-api.jogruber.de/v4/' + encodeURIComponent(login) + '?y=all',
        'jogruber.de');
      return data.contributions.map((d) => ({ date: d.date, count: d.count }));
    },
  },
  {
    label: 'github-contributions.vercel.app',
    async fetch(login) {
      const data = await getJson(
        'https://github-contributions.vercel.app/api/v1/' + encodeURIComponent(login),
        'github-contributions.vercel.app');
      return data.contributions.map((d) => ({ date: d.date, count: Number(d.count) || 0 }));
    },
  },
  {
    label: "GitHub's own calendar",
    async fetch(login, sinceYear) {
      const perDay = new Map();
      const thisYear = new Date().getUTCFullYear();
      for (let y = sinceYear; y <= thisYear; y++) {
        setStatus(`reading GitHub's calendar year by year ... ${y}`, false);
        const target = `https://github.com/users/${encodeURIComponent(login)}/contributions?from=${y}-01-01&to=${y}-12-31`;
        const res = await fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(target));
        if (!res.ok) throw new Error(`year ${y} answered HTTP ${res.status}`);
        for (const [date, count] of parseCalendarHtml(await res.text())) perDay.set(date, count);
      }
      return [...perDay.entries()].map(([date, count]) => ({ date, count }));
    },
  },
];

/** GitHub renders the calendar as <td data-date> cells + <tool-tip> texts
 *  ("3 contributions on ..."); data-level (0..4) is the fallback if the
 *  tooltip markup ever changes. */
function parseCalendarHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const tips = new Map();
  doc.querySelectorAll('tool-tip[for]').forEach((t) => tips.set(t.getAttribute('for'), t.textContent.trim()));
  const out = [];
  doc.querySelectorAll('td[data-date]').forEach((td) => {
    const tip = tips.get(td.id) ?? '';
    const m = tip.match(/^([\d,]+)\s+contribution/);
    const count = m ? parseInt(m[1].replace(/,/g, ''), 10)
      : /^no\s/i.test(tip) ? 0
      : parseInt(td.getAttribute('data-level') ?? '0', 10);
    out.push([td.getAttribute('data-date'), count]);
  });
  if (out.length === 0) throw new Error('calendar markup not recognized');
  return out;
}

async function fetchCalendar(login, sinceYear) {
  const failures = [];
  for (const src of CALENDAR_SOURCES) {
    try {
      setStatus(`reading the contribution calendar (${src.label}) ...`, false);
      return await src.fetch(login, sinceYear);
    } catch (err) {
      console.warn(`calendar source failed: ${src.label}`, err);
      failures.push(`${src.label}: ${err.message}`);
    }
  }
  throw new Error('every contribution-calendar source failed — ' + failures.join(' · ') +
    '. Try again later, use demo mode, or install the Action (it talks to the API directly).');
}

async function fetchPublicMetrics(login) {
  const user = await getJson('https://api.github.com/users/' + encodeURIComponent(login), 'GitHub')
    .catch((e) => {
      if (e.message === 'NOT_FOUND') throw new Error(`no GitHub account named "${login}"`);
      throw e;
    });
  if (user.type === 'Organization') {
    throw new Error('organizations have no public contribution calendar — ' +
      'run the GitHub Action for orgs (it grows a yose-ue forest from repo history)');
  }
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const createdDay = user.created_at.slice(0, 10);
  const [calendar, repos] = await Promise.all([
    fetchCalendar(login, new Date(user.created_at).getUTCFullYear()),
    getJson('https://api.github.com/users/' + encodeURIComponent(login) + '/repos?per_page=100&sort=pushed',
      'GitHub'),
  ]);
  const days = calendar
    .filter((d) => d.date >= createdDay && d.date <= todayIso)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  if (days.length === 0) throw new Error('the contribution calendar came back empty');

  // REST gives one primary language + repo size (KB); close enough to the
  // GraphQL per-language byte sizes once log-damped by normalize()
  const repoNodes = repos
    .filter((r) => !r.fork)
    .map((r) => ({
      createdAt: r.created_at,
      languages: {
        edges: r.language ? [{ size: r.size * 1024, node: { name: r.language } }] : [],
      },
    }));

  return Bonsai.normalize(login, user.created_at, today, days, repoNodes, false);
}

// ------------------------------------------------------------------- render

const state = {
  dna: null, skel: null, metrics: null,
  season: 'auto',
  windFrames: null, windDelays: null,
  windTimer: null, generation: 0,
};

function currentSeason() {
  return state.season === 'auto'
    ? Bonsai.seasonFromDate(new Date().toISOString().slice(0, 10))
    : state.season;
}

function palette() {
  return Bonsai.buildPalette(state.dna.palettes, state.dna.species, currentSeason());
}

function frameToImageData(frame, pal) {
  const img = new ImageData(frame.w, frame.h);
  for (let i = 0; i < frame.color.length; i++) {
    const c = frame.color[i];
    if (c === Bonsai.TRANSPARENT) continue;
    img.data[i * 4] = pal[c * 3];
    img.data[i * 4 + 1] = pal[c * 3 + 1];
    img.data[i * 4 + 2] = pal[c * 3 + 2];
    img.data[i * 4 + 3] = 255;
  }
  return img;
}

const off = document.createElement('canvas');
function draw(frame) {
  off.width = frame.w;
  off.height = frame.h;
  off.getContext('2d').putImageData(frameToImageData(frame, palette()), 0, 0);
  canvas.width = frame.w;
  canvas.height = frame.h;
  const c2 = canvas.getContext('2d');
  c2.imageSmoothingEnabled = false;
  c2.clearRect(0, 0, frame.w, frame.h);
  c2.drawImage(off, 0, 0);
}

const yield0 = () => new Promise((r) => setTimeout(r, 0));

/** Growth intro, then a wind loop — frames computed one by one so the page
 *  stays responsive and the compute itself plays as the timelapse. */
async function grow(metrics) {
  const gen = ++state.generation;
  if (state.windTimer) { clearInterval(state.windTimer); state.windTimer = null; }

  const seedKey = metrics.username.toLowerCase();
  const rng = Bonsai.makeRng(seedKey);
  const dna = Bonsai.deriveDna(metrics, rng);
  const skel = Bonsai.buildSkeleton(dna, rng);
  Bonsai.applyThickness(skel, dna);
  state.dna = dna;
  state.skel = skel;
  state.metrics = metrics;
  state.windFrames = null;
  showStats(dna, metrics);

  const GROWTH = 40;
  for (let f = 0; f < GROWTH; f++) {
    if (state.generation !== gen) return;
    const lin = f / (GROWTH - 1);
    const t = 1 - Math.pow(1 - lin, 2.2);
    draw(Bonsai.renderFrame(dna, skel, { growthT: t, windPhase: null }));
    await yield0();
  }

  const WIND = 24;
  const frames = [];
  for (let f = 0; f < WIND; f++) {
    if (state.generation !== gen) return;
    frames.push(Bonsai.renderFrame(dna, skel, { windPhase: (f / WIND) * Math.PI * 2 }));
    await yield0();
  }
  if (state.generation !== gen) return;
  state.windFrames = frames;
  state.windDelays = frames.map(() => 8);
  let i = 0;
  state.windTimer = setInterval(() => { draw(frames[i]); i = (i + 1) % frames.length; }, 80);
  $('downloads').classList.remove('hidden');
}

function showStats(dna, metrics) {
  const bits = [
    `<b>${STYLE_JP[dna.style] ?? dna.style}</b>`,
    SPECIES_NAME[dna.species] ?? dna.species,
    `${dna.ageYears.toFixed(1)} years`,
    `${metrics.totalContributions.toLocaleString('en-US')} contributions`,
    `${dna.sizeClass} pot`,
  ];
  if (dna.sumo) bits.push('<b>sumo trunk</b>');
  if (dna.shari) bits.push('<i>shari</i>');
  if (dna.uro) bits.push('<i>uro</i>');
  if (dna.flowers > 0) bits.push(`${dna.flowers} 🌸`);
  $('stats').innerHTML = bits.join(' · ');
  $('stats').classList.remove('hidden');
}

// ------------------------------------------------------------ page plumbing

function setStatus(text, isError) {
  const el = $('status');
  el.textContent = text;
  el.className = isError ? 'status error' : 'status';
}

async function run(login, demo) {
  if (!login) return;
  $('downloads').classList.add('hidden');
  $('stats').classList.add('hidden');
  setStatus(demo ? `dreaming up a demo ${login} ...` : `reading @${login}'s history ...`, false);
  try {
    const metrics = demo ? Bonsai.synthMetrics(login) : await fetchPublicMetrics(login);
    const url = new URL(location.href);
    url.searchParams.set('u', login);
    if (demo) url.searchParams.set('demo', '1'); else url.searchParams.delete('demo');
    history.replaceState(null, '', url);
    setStatus(demo
      ? 'demo mode: fabricated history, deterministic for this name'
      : 'public data only — private contributions and language bytes need the Action', false);
    await grow(metrics);
  } catch (err) {
    setStatus(String(err.message ?? err), true);
  }
}

function cropped() {
  // one box across still + wind so the export never clips a swaying branch
  const still = Bonsai.renderFrame(state.dna, state.skel, { growthT: 1, windPhase: null });
  const frames = [still, ...(state.windFrames ?? [])];
  const box = Bonsai.fitBox(frames);
  return { still: Bonsai.cropFrame(still, box), wind: (state.windFrames ?? []).map((f) => Bonsai.cropFrame(f, box)) };
}

function download(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

$('dl-png').addEventListener('click', () => {
  const { still } = cropped();
  const scale = 3;
  const out = document.createElement('canvas');
  out.width = still.w * scale;
  out.height = still.h * scale;
  const c = out.getContext('2d');
  c.imageSmoothingEnabled = false;
  off.width = still.w;
  off.height = still.h;
  off.getContext('2d').putImageData(frameToImageData(still, palette()), 0, 0);
  c.drawImage(off, 0, 0, out.width, out.height);
  out.toBlob((b) => download(`bonsai-${state.metrics.username}.png`, b), 'image/png');
});

$('dl-gif').addEventListener('click', () => {
  const { wind } = cropped();
  if (wind.length === 0) return;
  const bytes = Bonsai.encodeGif(
    wind.map((f) => f.color), wind[0].w, wind[0].h, palette(),
    { delays: state.windDelays, transparentIndex: Bonsai.TRANSPARENT, loops: 0 },
  );
  download(`bonsai-${state.metrics.username}.gif`, new Blob([bytes], { type: 'image/gif' }));
});

$('share-x').addEventListener('click', () => {
  const text = encodeURIComponent(
    `My GitHub history grew a ${state.dna.style} ${state.dna.species} bonsai 🌳 #gitbonsai\n${location.href}`);
  window.open('https://twitter.com/intent/tweet?text=' + text, '_blank');
});

document.querySelectorAll('#seasons button').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#seasons button').forEach((b) => b.classList.remove('on'));
    btn.classList.add('on');
    state.season = btn.dataset.season;
    // palette-only change: redraw the current frames, no regeneration needed
    if (state.dna && !state.windTimer && state.skel) {
      draw(Bonsai.renderFrame(state.dna, state.skel, { growthT: 1, windPhase: null }));
    }
  });
});

$('form').addEventListener('submit', (e) => {
  e.preventDefault();
  run($('login').value.trim().replace(/^@/, ''), $('demo').checked);
});

const params = new URLSearchParams(location.search);
const initial = (params.get('u') ?? '').trim();
if (initial) {
  $('login').value = initial;
  $('demo').checked = params.get('demo') === '1';
  run(initial, $('demo').checked);
}
