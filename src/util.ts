import { GradientSettings, ThemeSettings } from './types';
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

const VARS = ['--bg-editor', '--bg-preview', '--text', '--accent', '--accent-base', '--code-bg', '--font-preview', '--fs', '--lh', '--col',
  '--breathing-speed', '--ambient-intensity', '--hue-shift-speed', '--frosted-edge-size', '--crt-intensity'];
/**
 * Standalone HTML: theme variables + the shared preview/effect stylesheet inlined.
 * Includes paper, CRT, ambient, breathing, hue-shift and frosted edge (all CSS-only; the
 * reduced-motion and print rules travel with preview.css). Editor-only effects (sound, cursor,
 * focus mode, typewriter) and mouse parallax are intentionally left out.
 */
export function buildHtml(content: string, settings: ThemeSettings) {
  const s = { ...DEFAULTS, ...settings };
  const cs = getComputedStyle(document.documentElement);
  const vars = VARS.map((v) => `${v}:${cs.getPropertyValue(v)}`).join(';');
  const bg = s.gradient.enabled ? gradientCss(s.gradient) : 'var(--bg-preview)';
  const cls = ['export', s.breathingEnabled && 'breathing', s.ambientEnabled && 'ambient', s.hueShiftEnabled && 'hue-shift',
    s.frostedEdgeEnabled && 'frosted-edge', s.crtEnabled && 'crt'].filter(Boolean).join(' ');
  const attrs = `${s.paperEnabled ? ` data-paper="${s.paperType}"` : ''}${s.crtEnabled ? ' data-crt="on"' : ''}`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Aether export</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Lora:wght@400;600;700&family=Merriweather:wght@400;700&display=swap">
<style>:root{${vars}}body{margin:0;background:${bg};background-attachment:fixed}${previewCss}.copy-btn{display:none}</style></head>
<body class="${cls}"><article class="preview"${attrs}>${md.render(content)}</article></body></html>`;
}
