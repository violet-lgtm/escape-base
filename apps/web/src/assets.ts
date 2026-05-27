/**
 * Resolve a game asset reference to a loadable URL.
 *
 * Game data stores assets as relative paths (e.g. `assets/lobby.svg`) so the
 * content stays portable. At runtime we resolve them against the deploy base —
 * `/` in dev, `/escape-base/` on GitHub Pages — while leaving already-absolute
 * URLs (http(s):// or data:) untouched for games that host assets elsewhere.
 */
export function assetUrl(ref: string): string {
  if (/^(https?:)?\/\//.test(ref) || ref.startsWith('data:')) return ref;
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/${ref.replace(/^\//, '')}`;
}

/** A background is real art if it isn't a `#rrggbb` solid-fill placeholder. */
export function isImageBackground(background: string): boolean {
  return !background.startsWith('#');
}
