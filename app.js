import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.2';
import { PIN_LORE, pinsFromBoards } from './pins.js';
import { coreAvatarSvg, signalTag } from './avatar.js';

const PAGE = 12;
const LB_FAMILY = '0.1.7';
const cfg = window.CF;
const sb = createClient(cfg.supabaseUrl, cfg.supabaseAnon);

function hiddenRow(row) {
  const name = String(row.display_name || '').trim();
  const pid = String(row.player_id || '');
  if (/^OP-[A-Z0-9]{3,8}$/i.test(name)) return true;
  if (/^op_[a-z0-9-]{6,}$/i.test(name)) return true;
  if (/^(qa[-_]|test[-_]|qabot)/i.test(name)) return true;
  if (/adriverbuilds/i.test(name)) return true;
  if (/(js-client|test-op|diego-qa|qabot|_test_|_qa|__cfbot|playbot)/i.test(pid)) return true;
  return false;
}

function visible(row) {
  return !hiddenRow(row);
}

function mergeBest(rows, boardId) {
  const map = new Map();
  for (const row of rows || []) {
    const prev = map.get(row.player_id);
    if (!prev) {
      map.set(row.player_id, row);
      continue;
    }
    const better = boardId === 'speedrun_ms' ? row.score < prev.score : row.score > prev.score;
    if (better) map.set(row.player_id, row);
  }
  const out = [...map.values()];
  out.sort((a, b) => boardId === 'speedrun_ms' ? a.score - b.score : b.score - a.score);
  return out;
}

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
  const baseId = `S${y}-${String(m + 1).padStart(2, '0')}${firstHalf ? 'A' : 'B'}`;
  const id = `${baseId}@${LB_FAMILY}`;
  const start = Date.UTC(y, m, firstHalf ? 1 : 16);
  const end = firstHalf ? Date.UTC(y, m, 16) : Date.UTC(y, m + 1, 1);
  const months = (y - 2026) * 12 + (m - 7);
  const number = Math.max(1, months * 2 + (firstHalf ? 1 : 2));
  const name = number <= 8 ? `SEASON BETA ${number}` : `SEASON ${number - 8}`;
  return { id, baseId, ids: [id, baseId], number, name, start, end };
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

const legend = document.getElementById('pinLegend');
Object.keys(PIN_LORE).forEach((id) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'pin';
  b.textContent = id;
  b.onclick = () => showPin(id);
  legend.append(b);
});

function showPin(id, host = null) {
  const lore = PIN_LORE[id];
  if (!lore) return;
  const box = host || document.getElementById('pinExplain');
  if (!box) return;
  box.hidden = false;
  box.innerHTML = `<p class="how">${id} · CÓMO · ${lore.how}</p><p class="txt">${lore.lore}</p>`;
}

async function loadBoard() {
  const meta = BOARDS[board];
  document.getElementById('boardTitle').textContent = meta.title;
  const from = page * PAGE;
  const ascending = board === 'speedrun_ms';
  const { data, error } = await sb
    .from('leaderboard_scores')
    .select('player_id, display_name, score, board, season_id, updated_at')
    .eq('board', board)
    .in('season_id', season.ids)
    .order('score', { ascending })
    .limit(200);
  if (error) {
    document.getElementById('rows').innerHTML = `<p class="hint">No se pudo leer el tablero.</p>`;
    return;
  }
  const rowsDataAll = mergeBest(data ?? [], board).filter(visible);
  const total = rowsDataAll.length;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  if (page >= pages) { page = pages - 1; return loadBoard(); }
  const rowsData = rowsDataAll.slice(from, from + PAGE);
  document.getElementById('boardMeta').textContent = `${total} operadores · página ${page + 1}/${pages}`;
  document.getElementById('pageInfo').textContent = `${page + 1} / ${pages}`;
  document.getElementById('prev').disabled = page <= 0;
  document.getElementById('next').disabled = page + 1 >= pages;
  const rows = document.getElementById('rows');
  rows.innerHTML = '';
  rowsData.forEach((row, i) => {
    const rank = from + i + 1;
    const el = document.createElement('div');
    el.className = `row${rank === 1 ? ' gold' : rank === 2 ? ' silver' : rank === 3 ? ' bronze' : ''}`;
    el.style.animationDelay = `${i * 40}ms`;
    el.innerHTML = `<div class="rk">${medal(rank)}#${rank}</div><div class="av"></div><div class="nm"></div><div class="sc"></div>`;
    el.querySelector('.av').innerHTML = coreAvatarSvg(row.player_id, 36);
    el.querySelector('.nm').textContent = row.display_name;
    el.querySelector('.sc').textContent = meta.fmt(row.score);
    el.onclick = () => void openProfile(row.player_id);
    rows.append(el);
  });
  if (!rowsData.length) {
    rows.innerHTML = `<p class="hint">Nadie en este tablero todavía. Sé el primero.</p>`;
  }
}

async function loadMarks() {
  const host = document.getElementById('marks');
  const { data } = await sb
    .from('operator_marks')
    .select('player_id, display_name, message, media_url, created_at')
    .in('season_id', season.ids)
    .order('created_at', { ascending: false })
    .limit(20);
  host.innerHTML = '';
  const list = (data ?? []).filter((m) => visible({ display_name: m.display_name }));
  if (!list.length) {
    host.innerHTML = `<p class="hint">Todavía no hay huellas esta temporada.</p>`;
    return;
  }
  list.forEach((m) => {
    const el = document.createElement('div');
    el.className = 'mark-card';
    el.innerHTML = `<div class="who"></div><div class="msg"></div>`;
    el.querySelector('.who').textContent = `${m.display_name} · ${signalTag(m.player_id)}`;
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
  document.getElementById('pSig').textContent = signalTag(playerId);
  document.getElementById('pAv').innerHTML = coreAvatarSvg(playerId, 72);
  document.getElementById('pBoards').innerHTML = '';
  document.getElementById('pPins').innerHTML = '';
  const lore = document.getElementById('pLore');
  lore.hidden = true;
  lore.innerHTML = '';
  const mark = document.getElementById('pMark');
  const media = document.getElementById('pMedia');
  mark.hidden = true;
  media.hidden = true;

  const { data: scoreRows } = await sb
    .from('leaderboard_scores')
    .select('board, score, display_name')
    .eq('player_id', playerId)
    .in('season_id', season.ids);
  const scores = [];
  const seenBoard = new Map();
  for (const row of scoreRows ?? []) {
    const prev = seenBoard.get(row.board);
    if (!prev) { seenBoard.set(row.board, row); continue; }
    const better = row.board === 'speedrun_ms' ? row.score < prev.score : row.score > prev.score;
    if (better) seenBoard.set(row.board, row);
  }
  scores.push(...seenBoard.values());
  const { data: prof } = await sb
    .from('operator_profiles')
    .select('display_name, bio, title, mark_url')
    .eq('player_id', playerId)
    .maybeSingle();
  const { data: mk } = await sb
    .from('operator_marks')
    .select('message, media_url, display_name')
    .eq('player_id', playerId)
    .in('season_id', season.ids)
    .maybeSingle();

  const name = prof?.display_name || scores?.[0]?.display_name || mk?.display_name || 'OPERADOR';
  document.getElementById('pName').textContent = name;
  document.getElementById('pTitle').textContent = prof?.title || season.name;
  const tag = signalTag(playerId);
  document.getElementById('pSig').textContent = name.toUpperCase() === tag
    ? `${tag} · callsign no reclamado (nombres reservados como NaN están bloqueados)`
    : `${tag} · ID de señal permanente`;

  const ranked = [];
  const host = document.getElementById('pBoards');
  for (const row of scores ?? []) {
    const { count } = await sb
      .from('leaderboard_scores')
      .select('*', { count: 'exact', head: true })
      .eq('board', row.board)
      .in('season_id', season.ids)
      [row.board === 'speedrun_ms' ? 'lt' : 'gt']('score', row.score);
    const rank = (count ?? 0) + 1;
    ranked.push({ board: row.board, score: row.score, rank });
    const line = document.createElement('div');
    line.className = 'row';
    line.style.cursor = 'default';
    line.style.gridTemplateColumns = '72px 1fr auto';
    const spec = BOARDS[row.board];
    line.innerHTML = `<div class="rk">#${rank}</div><div class="nm">${spec.title}</div><div class="sc">${spec.fmt(row.score)}</div>`;
    host.append(line);
  }

  const pinHost = document.getElementById('pPins');
  pinsFromBoards(ranked).forEach((p) => {
    const s = document.createElement('button');
    s.type = 'button';
    s.className = 'pin';
    s.textContent = p;
    s.onclick = () => showPin(p, lore);
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
