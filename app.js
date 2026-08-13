import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.2';

const PAGE = 12;
const cfg = window.CF;
const sb = createClient(cfg.supabaseUrl, cfg.supabaseAnon);

const BOARDS = {
  max_combo: { title: 'COMBO MÁX', fmt: (n) => `×${n}` },
  round_credits: { title: 'CRÉDITOS / RONDA', fmt: (n) => `${n} CR` },
  speedrun_ms: { title: 'SPEEDRUN DEMO', fmt: (n) => {
    const s = Math.floor(n / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  } },
};

function seasonInfo(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const date = d.getUTCDate();
  const firstHalf = date <= 15;
  const id = `S${y}-${String(m + 1).padStart(2, '0')}${firstHalf ? 'A' : 'B'}`;
  const start = Date.UTC(y, m, firstHalf ? 1 : 16);
  const end = firstHalf ? Date.UTC(y, m, 16) : Date.UTC(y, m + 1, 1);
  const months = (y - 2026) * 12 + (m - 7);
  const number = Math.max(1, months * 2 + (firstHalf ? 1 : 2));
  const name = number <= 8 ? `SEASON BETA ${number}` : `SEASON ${number - 8}`;
  return { id, number, name, start, end };
}

function clock(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(t / 86400);
  const h = String(Math.floor((t % 86400) / 3600)).padStart(2, '0');
  const m = String(Math.floor((t % 3600) / 60)).padStart(2, '0');
  const s = String(t % 60).padStart(2, '0');
  return d > 0 ? `${String(d).padStart(2, '0')}:${h}:${m}:${s}` : `${h}:${m}:${s}`;
}

function medal(rank) {
  return rank === 1 ? '🥇 ' : rank === 2 ? '🥈 ' : rank === 3 ? '🥉 ' : '';
}

let board = 'max_combo';
let page = 0;
const season = seasonInfo();

document.getElementById('seasonName').textContent = season.name;
document.getElementById('seasonBlurb').textContent = 'Temporada quincenal · el tablero se reinicia · dejá tu huella';

function tick() {
  document.getElementById('clock').textContent = clock(season.end - Date.now());
}
tick();
setInterval(tick, 1000);

document.getElementById('tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-board]');
  if (!btn) return;
  board = btn.dataset.board;
  page = 0;
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b === btn));
  void loadBoard();
});

document.getElementById('prev').onclick = () => { if (page > 0) { page -= 1; void loadBoard(); } };
document.getElementById('next').onclick = () => { page += 1; void loadBoard(); };

async function loadBoard() {
  const meta = BOARDS[board];
  document.getElementById('boardTitle').textContent = meta.title;
  const from = page * PAGE;
  const to = from + PAGE - 1;
  const ascending = board === 'speedrun_ms';
  const { data, count, error } = await sb
    .from('leaderboard_scores')
    .select('player_id, display_name, score, board, season_id, updated_at', { count: 'exact' })
    .eq('board', board)
    .eq('season_id', season.id)
    .order('score', { ascending })
    .range(from, to);
  if (error) {
    document.getElementById('rows').innerHTML = `<p class="hint">No se pudo leer el tablero. ¿Está pegado el SQL en Supabase?</p>`;
    return;
  }
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  if (page >= pages) { page = pages - 1; return loadBoard(); }
  document.getElementById('boardMeta').textContent = `${total} operadores · página ${page + 1}/${pages}`;
  document.getElementById('pageInfo').textContent = `${page + 1} / ${pages}`;
  document.getElementById('prev').disabled = page <= 0;
  document.getElementById('next').disabled = page + 1 >= pages;
  const rows = document.getElementById('rows');
  rows.innerHTML = '';
  (data ?? []).forEach((row, i) => {
    const rank = from + i + 1;
    const el = document.createElement('div');
    el.className = `row${rank === 1 ? ' gold' : rank === 2 ? ' silver' : rank === 3 ? ' bronze' : ''}`;
    el.innerHTML = `<div class="rk">${medal(rank)}#${rank}</div><div class="nm"></div><div class="sc"></div>`;
    el.querySelector('.nm').textContent = row.display_name;
    el.querySelector('.sc').textContent = meta.fmt(row.score);
    el.onclick = () => void openProfile(row.player_id);
    rows.append(el);
  });
  if (!data?.length) {
    rows.innerHTML = `<p class="hint">Nadie en este tablero todavía. Sé el primero.</p>`;
  }
}

async function loadMarks() {
  const host = document.getElementById('marks');
  const { data } = await sb
    .from('operator_marks')
    .select('player_id, display_name, message, media_url, created_at')
    .eq('season_id', season.id)
    .order('created_at', { ascending: false })
    .limit(20);
  host.innerHTML = '';
  if (!data?.length) {
    host.innerHTML = `<p class="hint">Todavía no hay huellas esta temporada.</p>`;
    return;
  }
  data.forEach((m) => {
    const el = document.createElement('div');
    el.className = 'mark-card';
    el.innerHTML = `<div class="who"></div><div class="msg"></div>`;
    el.querySelector('.who').textContent = m.display_name;
    el.querySelector('.msg').textContent = m.message;
    el.onclick = () => void openProfile(m.player_id);
    host.append(el);
  });
}

async function openProfile(playerId) {
  const modal = document.getElementById('modal');
  modal.hidden = false;
  document.getElementById('pName').textContent = '…';
  document.getElementById('pTitle').textContent = 'cargando perfil';
  document.getElementById('pBoards').innerHTML = '';
  document.getElementById('pPins').innerHTML = '';
  const mark = document.getElementById('pMark');
  const media = document.getElementById('pMedia');
  mark.hidden = true;
  media.hidden = true;

  const { data: scores } = await sb
    .from('leaderboard_scores')
    .select('board, score, display_name')
    .eq('player_id', playerId)
    .eq('season_id', season.id);
  const { data: prof } = await sb
    .from('operator_profiles')
    .select('display_name, bio, title, mark_url')
    .eq('player_id', playerId)
    .maybeSingle();
  const { data: mk } = await sb
    .from('operator_marks')
    .select('message, media_url, display_name')
    .eq('player_id', playerId)
    .eq('season_id', season.id)
    .maybeSingle();

  const name = prof?.display_name || scores?.[0]?.display_name || mk?.display_name || 'OPERADOR';
  document.getElementById('pName').textContent = name;
  document.getElementById('pTitle').textContent = prof?.title || season.name;

  const host = document.getElementById('pBoards');
  for (const row of scores ?? []) {
    const { count } = await sb
      .from('leaderboard_scores')
      .select('*', { count: 'exact', head: true })
      .eq('board', row.board)
      .eq('season_id', season.id)
      [row.board === 'speedrun_ms' ? 'lt' : 'gt']('score', row.score);
    const rank = (count ?? 0) + 1;
    const line = document.createElement('div');
    line.className = 'row';
    line.style.cursor = 'default';
    const spec = BOARDS[row.board];
    line.innerHTML = `<div class="rk">#${rank}</div><div class="nm">${spec.title}</div><div class="sc">${spec.fmt(row.score)}</div>`;
    host.append(line);
  }

  const pins = [];
  const combo = scores?.find((s) => s.board === 'max_combo');
  const cred = scores?.find((s) => s.board === 'round_credits');
  if (combo && combo.score >= 20) pins.push('RITMO');
  if (combo && combo.score >= 50) pins.push('CASCADA');
  if (cred && cred.score >= 5000) pins.push('EXTRACTOR');
  if (scores?.some((s) => s.board === 'speedrun_ms')) pins.push('DEMO COMPLETA');
  const pinHost = document.getElementById('pPins');
  pins.forEach((p) => {
    const s = document.createElement('span');
    s.className = 'pin';
    s.textContent = p;
    pinHost.append(s);
  });

  const msg = mk?.message || prof?.bio;
  if (msg) {
    mark.hidden = false;
    mark.textContent = `“${msg}”`;
  }
  const url = mk?.media_url || prof?.mark_url;
  if (url) {
    media.hidden = false;
    media.href = url;
    media.textContent = 'abrir media';
  }
}

document.getElementById('closeModal').onclick = () => {
  document.getElementById('modal').hidden = true;
};
document.getElementById('modal').addEventListener('click', (e) => {
  if (e.target.id === 'modal') e.currentTarget.hidden = true;
});

const params = new URLSearchParams(location.search);
if (params.get('op')) void openProfile(params.get('op'));

void loadBoard();
void loadMarks();
