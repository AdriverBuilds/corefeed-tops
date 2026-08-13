# COREFEED TOPS

Sitio público de rankings / perfiles / huellas.

- **Live:** https://corefeed-tops.vercel.app
- **Repo:** https://github.com/adrianoliver-dev/corefeed-tops
- **Vercel project:** `corefeed-tops` (team `adriverbuilds`)

## Git → Vercel (deploys automáticos)

El primer deploy se hizo por MCP. Para que cada `git push` a `main` publique solo:

1. Abrí https://vercel.com/adriverbuilds/corefeed-tops/settings/git
2. Connect Git Repository → `adrianoliver-dev/corefeed-tops`
3. Production branch: `main`

## Env (Vercel → Settings → Environment Variables)

La anon key de Supabase es **pública** (la misma del juego). `config.js` las trae hardcodeadas para el static site. Si rotás la key, actualizá `config.js` y pusheá.

| Name | Value |
|------|--------|
| `PUBLIC_SUPABASE_URL` | `https://pkaacfyfkrhrjnplgung.supabase.co` |
| `PUBLIC_SUPABASE_ANON_KEY` | anon / publishable key del proyecto `corefeed` |

## Local

Abrí `index.html` con un static server, o dejá que Vercel lo sirva.

## itch

El juego (0.1.5.0-demo) apunta acá con `VITE_SITE_URL=https://corefeed-tops.vercel.app`.
