import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.2';
import { signalTag } from './avatar.js';

const KEY_STORE = 'corefeed_ops_key';
const cfg = window.CF;
const sb = createClient(cfg.supabaseUrl, cfg.supabaseAnon);
const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

let days = 0;
let season = 'current';
let version = '0.1.7';
let timer = null;
let lastKey = '';

function seasonInfo(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const date = d.getUTCDate();
  const firstHalf = date <= 15;
  const number = Math.max(1, ((y - 2026) * 12 + (m - 7)) * 2 + (firstHalf ? 1 : 2));
  return { name: number <= 8 ? `TEMPORADA BETA ${number}` : `TEMPORADA ${number - 8}` };
}

function n(v, f = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : f;
}

function pct(v) {
  if (v == null || v === '') return '—';
  return `${n(v).toFixed(1)}%`;
}

function fmtDur(s) {
  const x = Math.round(n(s));
  if (x < 60) return `${x}s`;
  return `${Math.floor(x / 60)}m ${x % 60}s`;
}

function fmtDay(iso) {
  if (!iso) return '';
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  return d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short' });
}

function nowLabel() {
  return new Date().toLocaleString('es-VE', {
    timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function delta(now, prev) {
  if (prev == null || !Number.isFinite(Number(prev)) || Number(prev) === 0) return '';
  const d = ((n(now) - n(prev)) / n(prev)) * 100;
  const cls = d > 2 ? 'up' : d < -2 ? 'down' : '';
  const sign = d > 0 ? '+' : '';
  return `<span class="delta ${cls}">${sign}${d.toFixed(0)}% vs periodo anterior</span>`;
}

function kpi(label, value, sub, tone) {
  const el = document.createElement('div');
  el.className = `kpi${tone ? ` ${tone}` : ''}`;
  el.innerHTML = `<div class="kicker">${label}</div><div class="n">${value}</div>${sub ? `<p class="hint">${sub}</p>` : ''}`;
  return el;
}

function bars(host, rows, labelFn, valueFn, maxFn) {
  host.innerHTML = '';
  if (!rows?.length) {
    host.innerHTML = '<p class="empty">Sin datos en esta ventana. Las vistas semanal/mensual/anual se llenan solas cuando haya más días.</p>';
    return;
  }
  const max = Math.max(1, ...rows.map(maxFn));
  rows.forEach((row) => {
    const el = document.createElement('div');
    el.className = 'bar-row';
    const val = valueFn(row);
    const w = Math.min(100, Math.round((n(val) / max) * 100));
    el.innerHTML = `<div>${labelFn(row)}</div><div class="bar"><span style="width:${w}%"></span></div><div>${val}</div>`;
    host.append(el);
  });
}

function fillRounds(rows) {
  const max = Math.min(40, Math.max(0, ...rows.map((r) => n(r.round))));
  const by = Object.fromEntries(rows.map((r) => [n(r.round), n(r.n)]));
  return Array.from({ length: max }, (_, i) => ({ round: i + 1, n: by[i + 1] || 0 }));
}

function paintHours(rows) {
  const canvas = document.getElementById('hours');
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = '#07141c';
  ctx.fillRect(0, 0, w, h);
  const byHour = Array.from({ length: 24 }, (_, hour) => {
    const hit = (rows || []).find((r) => n(r.hour) === hour || n(r.hour_utc) === hour);
    return n(hit?.n);
  });
  const max = Math.max(1, ...byHour);
  const barW = w / 24;
  let peak = 0;
  byHour.forEach((v, i) => { if (v > byHour[peak]) peak = i; });
  byHour.forEach((v, hour) => {
    const bh = Math.round((v / max) * (h - 28));
    ctx.fillStyle = hour === peak && v > 0 ? '#ffd166' : (v > 0 ? '#3de7ff' : '#102a3c');
    ctx.fillRect(hour * barW + 3, h - 22 - bh, barW - 6, bh);
    if (hour % 3 === 0) {
      ctx.fillStyle = '#7a96a8';
      ctx.font = '12px "IBM Plex Mono", monospace';
      ctx.fillText(String(hour).padStart(2, '0'), hour * barW + 4, h - 6);
    }
  });
  const hint = document.getElementById('hoursHint');
  const peakN = byHour[peak];
  hint.textContent = peakN
    ? `Pico a las ${String(peak).padStart(2, '0')}:00 Venezuela. ${peakN} eventos.`
    : 'Sin actividad horaria.';
}

function paintDays(rows) {
  const canvas = document.getElementById('days');
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = '#07141c';
  ctx.fillRect(0, 0, w, h);
  const list = rows || [];
  if (!list.length) return;
  const max = Math.max(1, ...list.map((r) => n(r.players)));
  const barW = w / list.length;
  list.forEach((row, i) => {
    const v = n(row.players);
    const bh = Math.round((v / max) * (h - 28));
    ctx.fillStyle = '#3de7ff';
    ctx.fillRect(i * barW + 4, h - 22 - bh, Math.max(6, barW - 8), bh);
    ctx.fillStyle = '#7a96a8';
    ctx.font = '11px "IBM Plex Mono", monospace';
    ctx.fillText(fmtDay(row.day), i * barW + 2, h - 6);
  });
}

function paintHeat(cells) {
  const canvas = document.getElementById('heat');
  const ctx = canvas.getContext('2d');
  const size = 16;
  const cell = canvas.width / size;
  ctx.fillStyle = '#07141c';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const list = cells || [];
  const max = Math.max(1, ...list.map((c) => n(c.n)));
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      ctx.strokeStyle = '#102a3c';
      ctx.strokeRect(x * cell, y * cell, cell, cell);
    }
  }
  list.forEach((c) => {
    const t = n(c.n) / max;
    ctx.fillStyle = `rgba(61, 231, 255, ${0.12 + t * 0.85})`;
    ctx.fillRect(n(c.gx) * cell + 1, n(c.gy) * cell + 1, cell - 2, cell - 2);
  });
}

function paintCal(rows) {
  const host = document.getElementById('cal');
  host.innerHTML = '';
  const max = Math.max(1, ...(rows || []).map((r) => n(r.n)));
  const by = {};
  (rows || []).forEach((r) => { by[`${n(r.dow)}-${n(r.hour)}`] = n(r.n); });
  const head = document.createElement('b');
  head.textContent = '';
  host.append(head);
  for (let h = 0; h < 24; h += 1) {
    const b = document.createElement('b');
    b.textContent = h % 3 === 0 ? String(h) : '';
    host.append(b);
  }
  for (let d = 0; d < 7; d += 1) {
    const lab = document.createElement('b');
    lab.textContent = DOW[d];
    host.append(lab);
    for (let h = 0; h < 24; h += 1) {
      const v = by[`${d}-${h}`] || 0;
      const i = document.createElement('i');
      const t = v / max;
      i.style.background = v ? `rgba(61,231,255,${0.12 + t * 0.85})` : '#07141c';
      i.title = `${DOW[d]} ${String(h).padStart(2, '0')}:00 · ${v}`;
      host.append(i);
    }
  }
}

function playbook(data) {
  const r1 = data.r1 || {};
  const segs = data.segments || [];
  const whales = segs.filter((s) => s.id === 'adicto' || s.id === 'ballena');
  const whaleRounds = whales.reduce((a, s) => a + n(s.rounds), 0);
  const allRounds = segs.reduce((a, s) => a + n(s.rounds), 0);
  const whaleShare = allRounds ? Math.round((whaleRounds / allRounds) * 100) : 0;
  const items = [
    {
      cls: 'p1',
      pri: '01 · HACER YA',
      title: 'No bloquees la ronda 2',
      ev: `El ${pct(data.churn_r1_pct)} se queda en R1. Quienes siguen lo hacen en ${n(r1.med_gap_min)} min (mediana). ${n(r1.under_2min)} de ${n(r1.continued)} en menos de 2 min. Combo R1 de los que se van: ×${n(r1.churn_combo)} · de los que siguen: ×${n(r1.stay_combo)}. Misma ronda. El combate no los echa: el HUB sí.`,
      do: 'Hacer: primer HUB = solo “el Núcleo pide más” + SIGUIENTE RONDA enorme. Compra de Densidad como carta única opcional, nunca un árbol. Nunca bloquear Next. Auto-start R2 a los 8s.',
      dont: 'No hacer: 6 botones, spotlight de Circuito, “invertí créditos”, Protocolos, Rankings ni Códex en la primera parada.',
    },
    {
      cls: 'p2',
      pri: '02 · DESPUÉS DE R2',
      title: 'El loop sí engancha — no lo toques todavía',
      ev: `${whaleShare}% de las rondas las juega el ${Math.round(whales.reduce((a, s) => a + n(s.players), 0) / Math.max(1, segs.reduce((a, s) => a + n(s.players), 0)) * 100)}% más adicto (R10+). Medianas: ${n(data.med_rounds)} ronda. Si pasan R2, muchos llegan a R5–R10.`,
      do: 'Hacer: R2 tiene que sentirse más fuerte que R1 (el un upgrade de Densidad se nota al instante). Juice de combo, no más menús.',
      dont: 'No hacer: rediseñar mundos 4–6 ni economía late. Las ballenas ya están dopadas. El agujero es el primer HUB.',
    },
    {
      cls: 'p3',
      pri: '03 · NO AHORA',
      title: 'No parches el late, el social ni el zip viejo como si fueran el churn',
      ev: `D1 ${pct(data.d1_retention_pct)} · D3 ${pct(data.d3_retention_pct)}. Rankings: ${n(data.lb_players)} ops. Abandono in-round = ${n(data.abandons_n)}.`,
      do: 'Hacer: medir 0.1.7.0 solo, temporada actual. BETA 1 está archivada. No mezclar versiones en la vista semanal.',
      dont: 'No hacer: fase 2, Mesh, PvP, más mundos. Eso no recupera a quien se fue en R1.',
    },
  ];
  if (n(r1.continue_pct) >= 55) {
    items[0].cls = 'p3';
    items[0].pri = '01 · REVISAR';
    items[0].title = 'R1→R2 ya no es el cuello';
  }
  return items;
}

function paintPlaybook(data) {
  const host = document.getElementById('playbook');
  host.innerHTML = '';
  playbook(data).forEach((item) => {
    const el = document.createElement('article');
    el.className = `pb ${item.cls}`;
    el.innerHTML = `<p class="pri">${item.pri}</p><h3>${item.title}</h3><p class="ev">${item.ev}</p><p class="do">${item.do}</p><p class="dont">${item.dont}</p>`;
    host.append(el);
  });
}

function paintR1(r1) {
  const host = document.getElementById('r1lab');
  const rows = [
    ['Siguen a R2', pct(r1.continue_pct), `${n(r1.continued)} / ${n(r1.n)}`],
    ['Mediana hasta R2', `${n(r1.med_gap_min)} min`, `${n(r1.under_2min)} en <2 min`],
    ['Combo · se van / siguen', `×${n(r1.churn_combo)} / ×${n(r1.stay_combo)}`, 'casi igual = no es el combate'],
    ['Duración R1', `${n(r1.churn_dur)}s / ${n(r1.stay_dur)}s`, 'CR igual de irrelevante'],
  ];
  host.innerHTML = '';
  rows.forEach(([k, v, s]) => {
    const el = document.createElement('div');
    el.className = 'stat';
    el.innerHTML = `<div class="kicker">${k}</div><div class="n">${v}</div><p class="hint">${s}</p>`;
    host.append(el);
  });
}

function paintSegs(rows) {
  const host = document.getElementById('segments');
  host.innerHTML = '';
  const list = rows || [];
  const pMax = Math.max(1, ...list.map((r) => n(r.players)));
  const rMax = Math.max(1, ...list.map((r) => n(r.rounds)));
  const pTot = list.reduce((a, r) => a + n(r.players), 0) || 1;
  const rTot = list.reduce((a, r) => a + n(r.rounds), 0) || 1;
  list.forEach((row) => {
    const el = document.createElement('div');
    el.className = 'seg';
    const pp = Math.round((n(row.players) / pTot) * 100);
    const rp = Math.round((n(row.rounds) / rTot) * 100);
    el.innerHTML = `<div class="lab"><span>${row.label}</span><span>${row.players} ops · ${row.rounds} rondas · ${pp}% / ${rp}%</span></div>
      <div class="dual">
        <div class="bar"><span style="width:${Math.round((n(row.players) / pMax) * 100)}%"></span></div>
        <div class="bar rounds"><span style="width:${Math.round((n(row.rounds) / rMax) * 100)}%"></span></div>
      </div>`;
    host.append(el);
  });
}

function insights(data) {
  const out = [];
  const r1 = data.r1 || {};
  out.push({
    tone: n(data.churn_r1_pct) >= 45 ? 'alert' : '',
    title: `${pct(data.churn_r1_pct)} se va en R1`,
    body: `${n(data.churn_r1_n)} de ${n(data.players_cleared)}. Mediana de rondas: ${n(data.med_rounds)}.`,
  });
  out.push({
    tone: n(r1.continue_pct) < 50 ? 'alert' : 'ok',
    title: `R2 en ${n(r1.med_gap_min)} min o nunca`,
    body: `${n(r1.under_2min)} siguieron en <2 min. Si salen del HUB, no vuelven.`,
  });
  if (data.d1_retention_pct != null) {
    out.push({
      tone: n(data.d1_retention_pct) < 15 ? 'alert' : '',
      title: `D1 ${pct(data.d1_retention_pct)} · D3 ${pct(data.d3_retention_pct)}`,
      body: `Cohorte D1 ayer: ${n(data.d1_cohort)}. D3 mira a los que ya tuvieron 3 días para volver.`,
    });
  }
  return out.slice(0, 3);
}

function paintFunnel(steps) {
  const host = document.getElementById('funnel');
  host.innerHTML = '';
  const list = steps || [];
  const top = Math.max(1, ...list.map((s) => n(s.n)));
  list.forEach((step, i) => {
    const prev = i === 0 ? n(step.n) : n(list[i - 1].n);
    const conv = prev > 0 ? Math.round((n(step.n) / prev) * 100) : 0;
    const w = Math.min(100, Math.round((n(step.n) / top) * 100));
    const el = document.createElement('div');
    el.className = 'funnel-row';
    const note = n(step.n) === 0 && (step.id === 'hub' || step.id === 'hub_next') ? ' · 0.1.7+' : '';
    el.innerHTML = `<div>${step.label}</div><div class="bar"><span style="width:${w}%"></span></div><div>${step.n} · ${conv}%${note}</div>`;
    host.append(el);
  });
}

function render(data) {
  const s = seasonInfo();
  const span = n(data.span_days);
  document.getElementById('sName').textContent = data.season === 's2026-08a'
    ? 'TEMPORADA BETA 1'
    : data.season === 's2026-08b'
      ? 'TEMPORADA BETA 2'
      : data.season === 'all'
        ? 'TODAS LAS TEMPORADAS'
        : s.name;
  const verLabel = data.version_filter ? data.version_filter : 'todas las versiones';
  document.getElementById('sMeta').textContent =
    `${n(data.players_n)} jugadores · ${n(data.rounds_n)} rondas · ${n(data.events_n)} eventos · ${data.range || 'all'} · ${verLabel} · ${data.tz}`;
  document.getElementById('updated').textContent = `actualizado ${nowLabel()} · auto 60s`;
  document.getElementById('clock').textContent = nowLabel();
  const note = document.getElementById('histNote');
  note.textContent = span < 14
    ? `Histórico real: ${fmtDay(data.first_at)} → ${fmtDay(data.last_at)} (${span} días). Semana / mes / año ya están; se van a llenar solos.`
    : `Histórico: ${fmtDay(data.first_at)} → ${fmtDay(data.last_at)} (${span} días).`;
  const mix = document.getElementById('mixNote');
  if (mix) {
    mix.textContent = data.mix_warning
      ? 'Estás mezclando temporadas o versiones. Para medir un parche, elegí UNA temporada + UNA versión.'
      : `Filtro limpio: ${data.season || 'actual'} · ${verLabel}. BETA 1 quedó archivada (no se borra).`;
  }

  paintPlaybook(data);
  const ins = document.getElementById('insights');
  ins.innerHTML = '';
  insights(data).forEach((item) => {
    const el = document.createElement('article');
    el.className = `insight ${item.tone}`.trim();
    el.innerHTML = `<h3>${item.title}</h3><p class="hint">${item.body}</p>`;
    ins.append(el);
  });

  const prev = data.prev || {};
  const kpis = document.getElementById('kpis');
  kpis.innerHTML = '';
  [
    ['Jugadores', n(data.players_n), `${delta(data.players_n, prev.players_n)} ids únicos`, ''],
    ['Rondas', n(data.rounds_n), delta(data.rounds_n, prev.rounds_n), ''],
    ['Churn R1', pct(data.churn_r1_pct), `${n(data.churn_r1_n)} se quedan en 1`, 'hot'],
    ['Mediana rondas', n(data.med_rounds), `media ${n(data.avg_rounds)}`, 'gold'],
    ['R2 en <2 min', n((data.r1 || {}).under_2min), `de ${n((data.r1 || {}).continued)} que siguieron`, ''],
    ['D1 / D3', `${pct(data.d1_retention_pct)} · ${pct(data.d3_retention_pct)}`, `stickiness ${pct(data.stickiness)}`, ''],
  ].forEach(([label, value, sub, tone]) => kpis.append(kpi(label, value, sub, tone)));

  paintFunnel(data.funnel);
  paintR1(data.r1 || {});
  paintSegs(data.segments || []);
  paintHours(data.hours || []);
  paintDays(data.days || []);
  paintCal(data.hour_dow || []);

  bars(document.getElementById('weeks'), data.weeks || [], (r) => fmtDay(r.week), (r) => `${r.players} ops · ${r.rounds} r`, (r) => n(r.rounds));
  bars(document.getElementById('months'), data.months || [], (r) => fmtDay(r.month), (r) => `${r.players} ops · ${r.rounds} r`, (r) => n(r.rounds));
  bars(document.getElementById('maxRounds'), fillRounds(data.max_rounds || []), (r) => `Ronda ${r.round}`, (r) => r.n, (r) => n(r.n));
  bars(document.getElementById('levels'), (data.levels || []).slice(0, 16), (r) => `NV ${r.level} · ×${r.avg_combo || 0}`, (r) => r.n, (r) => n(r.n));
  bars(document.getElementById('worlds'), data.worlds || [], (r) => `${r.name} · ${r.players || 0} ops`, (r) => r.n, (r) => n(r.n));
  bars(document.getElementById('combos'), data.combo_buckets || [], (r) => r.bucket, (r) => r.n, (r) => n(r.n));
  bars(document.getElementById('durs'), data.duration_buckets || [], (r) => r.bucket, (r) => r.n, (r) => n(r.n));
  bars(document.getElementById('events'), data.events_by_type || [], (r) => r.event, (r) => r.n, (r) => n(r.n));
  bars(document.getElementById('versions'), data.versions || [], (r) => `${r.version}`, (r) => r.n, (r) => n(r.n));
  bars(document.getElementById('circuit'), data.circuit || [], (r) => `${r.skill}`, (r) => r.n, (r) => n(r.n));

  const heat = data.heatmap || [];
  document.getElementById('heatHint').textContent = heat.length ? `${heat.length} celdas activas` : 'Sin celdas.';
  paintHeat(heat);

  const clears = document.getElementById('clears');
  clears.innerHTML = '';
  const first = data.first_clears || [];
  if (!first.length) clears.innerHTML = '<p class="empty">Nadie subió speedrun todavía.</p>';
  first.forEach((c, i) => {
    const el = document.createElement('div');
    el.className = 'mark-card';
    const sec = Math.floor(n(c.score) / 1000);
    el.innerHTML = `<div class="who">#${i + 1} ${c.display_name} · ${signalTag(c.player_id)}</div><div class="msg">${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}</div>`;
    clears.append(el);
  });
}

async function load(key) {
  const { data, error } = await sb.rpc('ops_overview', {
    p_key: key,
    p_days: days,
    p_season: season,
    p_version: version,
  });
  if (error || !data?.ok) {
    document.getElementById('err').textContent = error?.message || 'Key inválida o RPC caído.';
    return false;
  }
  lastKey = key;
  try { sessionStorage.setItem(KEY_STORE, key); } catch { /* ignore */ }
  document.getElementById('gate').hidden = true;
  document.getElementById('dash').hidden = false;
  render(data);
  return true;
}

function armRefresh() {
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    if (document.visibilityState === 'hidden' || !lastKey) return;
    void load(lastKey);
  }, 60000);
}

document.getElementById('go').onclick = () => {
  const key = document.getElementById('key').value.trim();
  void load(key).then((ok) => { if (ok) armRefresh(); });
};
document.getElementById('key').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('go').click();
});
document.getElementById('range').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-days]');
  if (!btn || !lastKey) return;
  days = n(btn.dataset.days, 0);
  document.querySelectorAll('#range button').forEach((b) => b.classList.toggle('on', b === btn));
  void load(lastKey);
});
document.getElementById('season').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-season]');
  if (!btn || !lastKey) return;
  season = btn.dataset.season || 'current';
  document.querySelectorAll('#season button').forEach((b) => b.classList.toggle('on', b === btn));
  void load(lastKey);
});
document.getElementById('ver').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-version]');
  if (!btn || !lastKey) return;
  version = btn.dataset.version ?? '';
  document.querySelectorAll('#ver button').forEach((b) => b.classList.toggle('on', b === btn));
  void load(lastKey);
});

try {
  const saved = sessionStorage.getItem(KEY_STORE);
  if (saved) {
    document.getElementById('key').value = saved;
    void load(saved).then((ok) => { if (ok) armRefresh(); });
  }
} catch { /* ignore */ }
