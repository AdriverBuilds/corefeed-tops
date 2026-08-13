export function signalTag(playerId) {
  const raw = String(playerId || '').replace(/^op[_-]?/i, '');
  return `OP-${raw.slice(0, 4).toUpperCase()}`;
}

function hash32(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function coreAvatarSvg(playerId, size = 72) {
  const h = hash32(playerId || 'core');
  const hue = h % 360;
  const hue2 = (hue + 40 + (h % 30)) % 360;
  const rings = 3 + (h % 3);
  const spin = (h % 24) - 12;
  const id = `cf${h.toString(16)}`;
  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72" width="${size}" height="${size}" aria-hidden="true">`);
  parts.push(`<defs><radialGradient id="${id}g" cx="35%" cy="30%"><stop offset="0%" stop-color="hsl(${hue2},90%,70%)"/><stop offset="100%" stop-color="hsl(${hue},90%,28%)"/></radialGradient></defs>`);
  parts.push(`<rect width="72" height="72" rx="14" fill="#050810"/>`);
  parts.push(`<circle cx="36" cy="36" r="30" fill="#071018" stroke="hsl(${hue},80%,45%)" stroke-width="2"/>`);
  for (let i = 0; i < rings; i += 1) {
    const r = 24 - i * 6;
    parts.push(`<circle cx="36" cy="36" r="${r}" fill="none" stroke="hsl(${(hue + i * 18) % 360},85%,62%)" stroke-width="${i === 0 ? 2.4 : 1.2}" opacity="${0.9 - i * 0.18}" transform="rotate(${spin + i * 12} 36 36)" stroke-dasharray="${8 + (h % 7)} ${4 + (h % 5)}"/>`);
  }
  parts.push(`<circle cx="36" cy="36" r="8" fill="url(#${id}g)" stroke="#ffd166" stroke-width="1.5"/>`);
  parts.push(`<circle cx="33" cy="33" r="2.2" fill="#e8f7ff" opacity="0.85"/>`);
  parts.push(`</svg>`);
  return parts.join('');
}
