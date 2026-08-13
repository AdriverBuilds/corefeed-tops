/** Pin lore — keep in sync with src/systems/PinLore.ts */
export const PIN_LORE = {
  RITMO: {
    how: 'Combo máximo ×20 o más en una ronda de esta season.',
    lore: 'El Probe dejó de golpear y empezó a conducir. El Núcleo marca el tempo.',
  },
  CASCADA: {
    how: 'Combo máximo ×50 o más.',
    lore: 'Una cadena que no se corta. Los nodos caen como una sola señal.',
  },
  SINGULARIDAD: {
    how: 'Combo máximo ×100 o más.',
    lore: 'Pasaste el umbral donde el combo deja de ser skill y se vuelve clima.',
  },
  EXTRACTOR: {
    how: '5.000 créditos o más en una sola ronda.',
    lore: 'El Núcleo no pide. Vos extraés. La red lo nota.',
  },
  'NÚCLEO DORADO': {
    how: '20.000 créditos o más en una ronda.',
    lore: 'Demasiada señal en un ciclo. El Núcleo se tiñe de oro sucio.',
  },
  'DEMO COMPLETA': {
    how: 'Cerrar la transmisión demo (speedrun válido, mínimo 90s).',
    lore: 'Llegaste al corte. El capítulo de apertura tiene tu huella.',
  },
  CORONA: {
    how: 'Quedar #1 en cualquier tablero de la season (combo, créditos o speedrun).',
    lore: 'Nadie más ocupa esa frecuencia. Por ahora.',
  },
  ÉLITE: {
    how: 'Quedar top 3 en cualquier tablero de la season.',
    lore: 'Tres señales. El resto es ruido.',
  },
  'SEÑAL VISIBLE': {
    how: 'Entrar al TOP 10 de cualquier tablero de la season.',
    lore: 'Tu operador ya no es anónimo para la red. El ranking te mira.',
  },
};

export function pinsFromBoards(boards) {
  const pins = [];
  const combo = boards.find((b) => b.board === 'max_combo');
  const cred = boards.find((b) => b.board === 'round_credits');
  const spd = boards.find((b) => b.board === 'speedrun_ms');
  if (combo && combo.score >= 20) pins.push('RITMO');
  if (combo && combo.score >= 50) pins.push('CASCADA');
  if (combo && combo.score >= 100) pins.push('SINGULARIDAD');
  if (cred && cred.score >= 5000) pins.push('EXTRACTOR');
  if (cred && cred.score >= 20000) pins.push('NÚCLEO DORADO');
  if (spd) pins.push('DEMO COMPLETA');
  if (boards.some((b) => b.rank === 1)) pins.push('CORONA');
  if (boards.some((b) => b.rank <= 3)) pins.push('ÉLITE');
  if (boards.some((b) => b.rank <= 10)) pins.push('SEÑAL VISIBLE');
  return [...new Set(pins)];
}
