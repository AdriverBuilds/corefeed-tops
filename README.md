# COREFEED TOPS

Sitio público de rankings / perfiles / huellas. Repo propio para vincular a Vercel.

## Env (Vercel → Project → Settings → Environment Variables)

La anon key de Supabase es **pública** (la misma del juego). Igual las cargamos como env para no depender de un archivo commiteado el día que rote.

| Name | Value |
|------|--------|
| `PUBLIC_SUPABASE_URL` | `https://pkaacfyfkrhrjnplgung.supabase.co` |
| `PUBLIC_SUPABASE_ANON_KEY` | anon / publishable key del proyecto `corefeed` |

Hoy `config.js` las trae hardcodeadas (cliente público). Si rotás la key, actualizá `config.js` y redeploy.

## Local

Abrí `index.html` con un static server, o dejá que Vercel lo sirva.

## itch

El juego (0.1.5.0-demo) apunta acá con `VITE_SITE_URL`.
