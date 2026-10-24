import { GradientSettings, ResolvedSettings, ThemeSettings } from './types';
import { DEFAULTS } from './store';
import { md } from './md';
import previewCss from './preview.css?raw';

export const gradientCss = (g: GradientSettings) =>
  `${g.type}-gradient(${g.type === 'linear' ? `${g.angle}deg` : 'circle'}, ${g.stops.join(', ')})`;

// UTF-8 safe base64 (loop avoids call-stack limits on big documents with images)
export function b64encode(s: string) {
  const bytes = new TextEncoder().encode(s); let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
export const b64decode = (b: string) => new TextDecoder().decode(Uint8Array.from(atob(b), (c) => c.charCodeAt(0)));

export function download(name: string, text: string, type: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- shared by the live preview (Preview.tsx) and the export, so both read the same preview.css rules ----------

/** Background values as CSS variables for .preview-wrap. */
export function bgVars(s: ResolvedSettings, image: string | null): Record<string, string> {
  const tile = s.bgMode === 'tile';
  const v: Record<string, string> = {
    '--bg-size': tile ? 'auto' : s.bgMode, '--bg-repeat': tile ? 'repeat' : 'no-repeat',
    '--bg-blur': `${s.blur}px`, '--bg-saturate': `${s.saturate}%`, '--bg-darken': String(s.darken / 100),
  };
  if (s.gradient.enabled) v['--bg-gradient'] = gradientCss(s.gradient);
  if (image) v['--bg-image'] = `url(${image})`; // blob: or data: URLs never contain spaces, quotes or parentheses
  return v;
}
/** data-* attributes on <article class="preview">. */
export const previewAttrs = (s: ResolvedSettings): Record<string, string | undefined> => ({
  'data-paper': s.paperEnabled ? s.paperType : undefined,
  'data-crt': s.crtEnabled ? 'on' : undefined,
  'data-quote': s.blockquoteStyle, 'data-link': s.linkStyle, 'data-table': s.tableStyle, 'data-code': s.codeTheme,
  'data-img-shadow': s.imageShadow ? 'on' : undefined,
});

// ---------- HTML export ----------

const MAX_DIM = 2560;
const blobToDataUri = (b: Blob) => new Promise<string>((res, rej) => {
  const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = () => rej(r.error); r.readAsDataURL(b);
});

/**
 * Downscale to max 2560px and re-encode as WebP 0.85 (JPEG 0.85 if the browser can't encode WebP).
 * GIFs (to keep animating) and SVGs keep their original bytes; so does anything that would get bigger.
 * Canvas is used only here, at export time.
 */
async function compressBlob(blob: Blob): Promise<Blob> {
  if (!blob.type.startsWith('image/') || blob.type === 'image/gif' || blob.type === 'image/svg+xml') return blob;
  try {
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, MAX_DIM / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(bmp, 0, 0, w, h); bmp.close();
    const toBlob = (type: string) => new Promise<Blob | null>((res) => c.toBlob(res, type, 0.85));
    let out = await toBlob('image/webp');
    if (!out || out.type !== 'image/webp') {
      // JPEG fallback: paint a white backdrop first so transparent areas don't turn black
      ctx.globalCompositeOperation = 'destination-over'; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
      out = await toBlob('image/jpeg');
    }
    return out && (k < 1 || out.size < blob.size) ? out : blob;
  } catch { return blob; }
}

/** Session-only ObjectURL → self-contained data URI. */
async function embedBg(url: string, compress: boolean): Promise<string | null> {
  try {
    let b = await (await fetch(url)).blob();
    if (compress) b = await compressBlob(b);
    return await blobToDataUri(b);
  } catch { return null; } // e.g. the ObjectURL was revoked
}

const IMG_RE = /!\[([^\]]*)\]\((data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+)\)/gi;
/** Re-encode base64 images embedded in the markdown (drag & drop). Export only: the .md download keeps the originals. */
async function compressDocImages(text: string) {
  const found = [...text.matchAll(IMG_RE)];
  if (!found.length) return text;
  const out = await Promise.all(found.map(async (m) => {
    try { return await blobToDataUri(await compressBlob(await (await fetch(m[2])).blob())); } catch { return m[2]; }
  }));
  let i = 0;
  return text.replace(IMG_RE, (_, alt) => `![${alt}](${out[i++]})`);
}

const VARS = ['--bg-editor', '--bg-preview', '--text', '--accent', '--accent-base', '--code-bg', '--font-preview', '--fs-preview', '--lh-preview', '--col',
  '--p-space', '--letter', '--h1-size', '--h2-size', '--h3-size', '--h4-size', '--img-radius',
  '--breathing-speed', '--ambient-intensity', '--hue-shift-speed', '--frosted-edge-size', '--crt-intensity', '--parallax-strength'];

// Small inline scripts so the exported file works from file:// with no server.
const SCRIPTS = `<script>
(function () { // copy buttons (clipboard API where allowed, execCommand fallback for file://)
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.copy-btn'); if (!b) return;
    var t = b.parentElement.querySelector('code').innerText;
    function done() { b.textContent = 'Copied!'; setTimeout(function () { b.textContent = 'Copy'; }, 1200); }
    function fallback() { var a = document.createElement('textarea'); a.value = t; a.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(a); a.select(); try { document.execCommand('copy'); } catch (_) {} a.remove(); done(); }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(done, fallback); else fallback();
  });
})();
(function () { // task-list checkboxes: clickable, never saved
  document.querySelectorAll('input.task-list-item-checkbox').forEach(function (c) { c.disabled = false; });
})();
(function () { // parallax: mouse only, skipped on touch and for reduced motion
  var b = document.body; if (!b.classList.contains('parallax-on')) return;
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  b.classList.add('parallax');
  var r = document.documentElement, raf = 0, x = 0, y = 0;
  addEventListener('mousemove', function (e) {
    x = e.clientX / innerWidth * 2 - 1; y = e.clientY / innerHeight * 2 - 1;
    if (!raf) raf = requestAnimationFrame(function () { raf = 0; r.style.setProperty('--px', x.toFixed(3)); r.style.setProperty('--py', y.toFixed(3)); });
  }, { passive: true });
})();
</script>`;

export interface ExportResult { html: string; bytes: number; bgFailed: boolean }

/**
 * Standalone, self-contained HTML that mirrors the live preview: same structure (.preview-wrap > .bg-stack / .scroll-area),
 * same stylesheet (preview.css inlined in full, including @media print and prefers-reduced-motion), background image
 * embedded as a data URI, and the effect classes / data-* attributes. Opens from file:// with no server.
 *
 * Known limitation: YouTube (or any iframe) embeds are not supported. Raw HTML is disabled in the markdown renderer
 * (html: false), and embeds need a network connection anyway. Editor-only effects (sound, cursor, focus mode,
 * typewriter) are not part of the export.
 */
export async function buildHtml(content: string, settings: ThemeSettings, opts: { compress?: boolean } = {}): Promise<ExportResult> {
  const s: ResolvedSettings = { ...DEFAULTS, ...settings };
  const compress = opts.compress ?? true;
  const cs = getComputedStyle(document.documentElement);
  const vars = VARS.map((v) => `${v}:${cs.getPropertyValue(v)}`).join(';');
  const img = s.bgImage ? await embedBg(s.bgImage, compress) : null;
  const text = compress ? await compressDocImages(content) : content;
  const decorated = s.gradient.enabled || !!img;
  const wrapStyle = Object.entries(bgVars(s, img)).map(([k, v]) => `${k}:${v}`).join(';').replace(/"/g, '&quot;');
  const attrs = Object.entries(previewAttrs(s)).filter(([, v]) => v !== undefined).map(([k, v]) => ` ${k}="${v}"`).join('');
  const bodyClass = ['export', s.breathingEnabled && 'breathing', s.ambientEnabled && 'ambient', s.hueShiftEnabled && 'hue-shift',
    s.frostedEdgeEnabled && 'frosted-edge', s.crtEnabled && 'crt', s.paperEnabled && 'paper', s.parallaxEnabled && 'parallax-on'].filter(Boolean).join(' ');
  const layers = `${s.gradient.enabled ? '<div class="bg-layer bg-gradient"></div>' : ''}${img ? '<div class="bg-layer bg-image"></div>' : ''}${decorated ? '<div class="bg-layer bg-dark"></div>' : ''}`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="${s.dark ? 'dark' : 'light'}"><title>Aether export</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@400;600&family=Lora:wght@400;600;700&family=Merriweather:wght@400;700&display=swap">
<style>:root{${vars}}html,body{margin:0;height:100%}body{background:var(--bg-preview);color:var(--text);overflow:hidden}
@media print{html,body{height:auto;overflow:visible}}
${previewCss}</style></head>
<body class="${bodyClass}"><div class="preview-wrap" style="${wrapStyle}"><div class="bg-stack">${layers}</div>
<div class="scroll-area"><article class="preview print-area${decorated ? ' glass' : ''}"${attrs}>${md.render(text)}</article></div></div>
${SCRIPTS}</body></html>`;
  return { html, bytes: new Blob([html]).size, bgFailed: !!s.bgImage && !img };
}
