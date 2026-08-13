import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.112.2';
import { signalTag } from './avatar.js';

const cfg = window.CF;
const sb = createClient(cfg.supabaseUrl, cfg.supabaseAnon);

function seasonInfo(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const date = d.getUTCDate();
  const firstHalf = date <= 15;
  const number = Math.max(1, ((y - 2026) * 12 + (m - 7)) * 2 + (firstHalf ? 1 : 2));
  return {
    id: `S${y}-${String(m + 1).padStart(2, '0')}${firstHalf ? 'A' : 'B'}`,
    name: number <= 8 ? `SEASON BETA ${number}` : `SEASON ${number - 8}`,
  };
}

document.getElementById('go').onclick = () => void enter();
document.getElementById('key').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') void enter();
});

async function enter() {
  const key = document.getElementById('key').value.trim();
  const { data, error } = await sb.rpc('ops_overview', { p_key: key });
  if (error || !data?.ok) {
    document.getElementById('err').textContent = 'Clave inválida o RPC caída.';
    return;
  }
  sessionStorage.setItem('cf_ops', '1');
  document.getElementById('gate').hidden = true;
  document.getElementById('dash').hidden = false;
  const s = seasonInfo();
  document.getElementById('sName').textContent = s.name;
  document.getElementById('sMeta').textContent = `${data.operators} operadores · ${data.rows} filas · ${data.speedruns} speedruns · ${data.events_24h} eventos (24h)`;

  const kpis = [
    ['Operadores', data.operators, data.operators],
    ['Filas', data.rows, data.rows],
    ['Speedruns', data.speedruns, Math.max(data.speedruns, 1)],
    ['Huellas', data.marks, Math.max(data.marks, 1)],
    ['Eventos 24h', data.events_24h, Math.max(data.events_24h, 1)],
    ['Combo techo', data.combo_max, Math.max(data.combo_max, 1)],
  ];
  const max = Math.max(...kpis.map((k) => Number(k[1]) || 0), 1);
  const host = document.getElementById('kpis');
  host.innerHTML = '';
  kpis.forEach(([label, n]) => {
    const row = document.createElement('div');
    row.className = 'bar-row';
    const pct = Math.min(100, Math.round((Number(n) / max) * 100));
    row.innerHTML = `<div>${label}</div><div class="bar"><span style="width:${pct}%"></span></div><div>${n}</div>`;
    host.append(row);
  });

  const clears = document.getElementById('clears');
  clears.innerHTML = '';
  (data.first_clears || []).forEach((c, i) => {
    const el = document.createElement('div');
    el.className = 'mark-card';
    const ms = c.score || 0;
    const sec = Math.floor(ms / 1000);
    el.innerHTML = `<div class="who">#${i + 1} ${c.display_name} · ${signalTag(c.player_id)}</div><div class="msg">${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} · ${c.updated_at || ''}</div>`;
    clears.append(el);
  });
}
