import { useEffect, useRef } from 'react';
import { Compartment, EditorSelection, EditorState, RangeSetBuilder, Transaction } from '@codemirror/state';
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, keymap, lineNumbers, highlightActiveLine, drawSelection } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { autocompletion, CompletionContext } from '@codemirror/autocomplete';
import { useStore, useSettings, saveNow } from '../store';
import { SoundType } from '../types';
import { setEditorFocused } from '../mobile';

// ---------- keymap helpers (unchanged) ----------
const wrap = (m: string) => (v: EditorView) => {
  v.dispatch(v.state.changeByRange((r) => ({
    changes: { from: r.from, to: r.to, insert: m + v.state.sliceDoc(r.from, r.to) + m },
    range: EditorSelection.range(r.from + m.length, r.to + m.length),
  })), { userEvent: 'input' });
  return true;
};
const link = (v: EditorView) => {
  const { from, to } = v.state.selection.main;
  const t = v.state.sliceDoc(from, to) || 'text';
  v.dispatch({ changes: { from, to, insert: `[${t}](url)` }, selection: { anchor: from + t.length + 3, head: from + t.length + 6 } });
  return true;
};
// ---------- actions for the touch FormatBar (same commands as the keymap + a few line helpers) ----------
let current: EditorView | undefined;
const prefixLines = (v: EditorView, p: string) => {
  const { from, to } = v.state.selection.main, doc = v.state.doc;
  const lines = [];
  for (let i = doc.lineAt(from).number; i <= doc.lineAt(to).number; i++) lines.push(doc.line(i));
  const all = lines.every((l) => l.text.startsWith(p)); // toggle: remove when every line already has it
  v.dispatch({ changes: lines.map((l) => (all ? { from: l.from, to: l.from + p.length } : { from: l.from, insert: p })), userEvent: 'input' });
  return true;
};
const heading = (v: EditorView) => { // cycles: none → # → ## → ### → none
  const l = v.state.doc.lineAt(v.state.selection.main.head), m = /^(#{1,6}) /.exec(l.text);
  const lvl = m ? m[1].length : 0, next = lvl >= 3 ? 0 : lvl + 1;
  v.dispatch({ changes: { from: l.from, to: l.from + (m ? m[0].length : 0), insert: next ? '#'.repeat(next) + ' ' : '' }, userEvent: 'input' });
  return true;
};
const run = (fn: (v: EditorView) => boolean) => { if (current) { fn(current); current.focus(); } };
export const editorActions = {
  bold: () => run(wrap('**')), italic: () => run(wrap('*')), link: () => run(link), heading: () => run(heading),
  list: () => run((v) => prefixLines(v, '- ')), task: () => run((v) => prefixLines(v, '- [ ] ')),
};

const SNIPPETS: [string, string][] = [
  ['h1', '# '], ['h2', '## '], ['h3', '### '], ['task', '- [ ] '], ['quote', '> '],
  ['table', '| A | B |\n|---|---|\n| 1 | 2 |\n'], ['code', '```js\n\n```\n'],
  ['image', '![alt](url)'], ['link', '[text](url)'], ['footnote', '[^1]\n\n[^1]: Note'],
];
function slash(c: CompletionContext) {
  const w = c.matchBefore(/^\/\w*$/);
  if (!w) return null;
  return { from: w.from, options: SNIPPETS.map(([l, i]) => ({ label: '/' + l, apply: i, type: 'keyword' })) };
}

// Colors use var(--x, fallback) so unset optional colors follow the (possibly hue-shifted) accent.
const base = EditorView.theme({
  '&': { height: '100%', color: 'var(--text)', backgroundColor: 'var(--bg-editor)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-content': { caretColor: 'var(--cursor-color, var(--accent))', fontFamily: 'var(--font-editor)', fontSize: 'var(--fs)', lineHeight: 'var(--lh)',
    padding: '24px 0', fontVariantLigatures: 'var(--lig)', fontFeatureSettings: 'var(--feat)' },
  '.cm-cursor': { borderLeftColor: 'var(--cursor-color, var(--accent))' },
  '.cm-gutters': { backgroundColor: 'transparent', border: 'none', color: 'var(--line-number-color, var(--muted))' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent' },
  '.cm-tooltip': { backgroundColor: 'var(--bg-preview)', border: '1px solid var(--muted)' },
});

// ---------- line number formatters ----------
const ROMAN: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
const roman = (n: number) => {
  if (n > 3999) return String(n);
  let r = ''; for (const [v, s] of ROMAN) while (n >= v) { r += s; n -= v; }
  return r;
};
const dotted = (n: number) => (n % 5 === 0 ? String(n) : '·'); // dot on every line, number on every 5th

// ---------- focus mode: every line except the caret line(s) gets class "dimmed" ----------
const focusPlugin = ViewPlugin.fromClass(class {
  decorations: DecorationSet;
  constructor(v: EditorView) { this.decorations = this.build(v); }
  update(u: ViewUpdate) { if (u.docChanged || u.selectionSet || u.viewportChanged) this.decorations = this.build(u.view); }
  build(v: EditorView) {
    const b = new RangeSetBuilder<Decoration>();
    const cur = new Set(v.state.selection.ranges.map((r) => v.state.doc.lineAt(r.head).from));
    const dim = Decoration.line({ class: 'dimmed' });
    for (const { from, to } of v.visibleRanges) {
      for (let pos = from; pos <= to;) {
        const l = v.state.doc.lineAt(pos);
        if (!cur.has(l.from)) b.add(l.from, l.from, dim);
        pos = l.to + 1;
      }
    }
    return b.finish();
  }
}, { decorations: (p) => p.decorations });

// ---------- typewriter scroll: keep the caret vertically centered ----------
const typewriter = ViewPlugin.fromClass(class {
  update(u: ViewUpdate) {
    if (!(u.selectionSet || u.docChanged) || !u.view.hasFocus) return;
    // measure/write phases: coords can't be read synchronously inside update()
    u.view.requestMeasure({
      read: (v) => {
        const c = v.coordsAtPos(v.state.selection.main.head), r = v.scrollDOM.getBoundingClientRect();
        return c ? (c.top + c.bottom) / 2 - (r.top + r.height / 2) : 0;
      },
      write: (d, v) => { if (Math.abs(d) > 1) v.scrollDOM.scrollTop += d; },
    });
  }
});
// padding lets the first and last lines reach the center too
const twPad = EditorView.theme({ '.cm-content': { paddingTop: 'calc(var(--vvh, 100vh) * 0.4)', paddingBottom: 'calc(var(--vvh, 100vh) * 0.4)' } });

// ---------- cursor trail: fading DOM ghosts at previous caret positions ----------
const trailPlugin = (len: number) => ViewPlugin.fromClass(class {
  layer: HTMLElement; dots: HTMLElement[] = []; last = '';
  constructor(v: EditorView) { this.layer = document.createElement('div'); this.layer.className = 'cm-trail'; v.dom.appendChild(this.layer); }
  update(u: ViewUpdate) {
    if (!(u.selectionSet || u.docChanged)) return;
    u.view.requestMeasure({
      read: (v) => {
        const c = v.coordsAtPos(v.state.selection.main.head), b = v.dom.getBoundingClientRect();
        return c ? { x: c.left - b.left, y: c.top - b.top, h: c.bottom - c.top } : null;
      },
      write: (m) => {
        if (!m) return;
        const key = `${Math.round(m.x)},${Math.round(m.y)}`;
        if (key === this.last) return; this.last = key;
        const d = document.createElement('i');
        d.className = 'trail-dot'; d.style.cssText = `left:${m.x}px;top:${m.y}px;height:${m.h}px`;
        d.addEventListener('animationend', () => { d.remove(); this.dots = this.dots.filter((x) => x !== d); });
        this.layer.appendChild(d); this.dots.push(d);
        while (this.dots.length > len) this.dots.shift()!.remove();
      },
    });
  }
  destroy() { this.layer.remove(); }
});

// ---------- typing sounds: Web Audio only, no files ----------
let ac: AudioContext | undefined; let nbuf: AudioBuffer | undefined;
const unlock = () => {
  try { ac ??= new (window.AudioContext || (window as any).webkitAudioContext)(); if (ac.state === 'suspended') void ac.resume(); } catch { /* unsupported */ }
};
function noise(t: number, dur: number, gain: number, freq: number, q: number, type: BiquadFilterType = 'bandpass') {
  if (!ac) return;
  if (!nbuf) { nbuf = ac.createBuffer(1, ac.sampleRate * 0.2, ac.sampleRate); const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const src = ac.createBufferSource(); src.buffer = nbuf;
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ac.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(ac.destination); src.start(t); src.stop(t + dur + 0.02);
}
function tone(t: number, freq: number, dur: number, gain: number, type: OscillatorType, to?: number, attack = 0.002) {
  if (!ac) return;
  const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
}
function click(type: SoundType, vol: number) {
  if (!ac || ac.state !== 'running' || type === 'none') return;
  const t = ac.currentTime, v = (vol / 100) * 0.7, r = Math.random();
  if (type === 'mechanical') { noise(t, 0.04, 0.9 * v, 2800, 1.2); tone(t, 160 + r * 30, 0.05, 0.5 * v, 'square', 90); }
  else if (type === 'typewriter') { noise(t, 0.03, 0.8 * v, 1500, 0.8); tone(t, 900, 0.07, 0.35 * v, 'triangle', 260); }
  else if (type === 'rain') { noise(t, 0.05, 0.6 * v, 5500 + r * 3500, 3); tone(t, 1800 + r * 1500, 0.03, 0.12 * v, 'sine'); }
  else tone(t, 220 + r * 60, 0.12, 0.5 * v, 'sine', undefined, 0.01); // soft
}
// real typing/deleting only – not paste, drop, completion, undo
const isTyping = (tr: Transaction) =>
  (tr.isUserEvent('input') || tr.isUserEvent('delete')) && !tr.isUserEvent('input.paste') && !tr.isUserEvent('input.drop') && !tr.isUserEvent('input.complete');

export default function Editor() {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView>();
  const C = useRef({ nums: new Compartment(), theme: new Compartment(), attrs: new Compartment(), focus: new Compartment(), tw: new Compartment(), trail: new Compartment() }).current;
  const { content, setContent } = useStore();
  const s = useSettings();
  const snd = useRef({ on: false, type: 'mechanical' as SoundType, vol: 40 });
  snd.current = { on: s.soundEnabled, type: s.soundType, vol: s.soundVolume };

  useEffect(() => {
    view.current = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: useStore.getState().content,
        extensions: [
          history(), drawSelection(), highlightActiveLine(), EditorView.lineWrapping, markdown(),
          autocompletion({ override: [slash] }),
          keymap.of([
            { key: 'Mod-b', run: wrap('**') }, { key: 'Mod-i', run: wrap('*') }, { key: 'Mod-k', run: link },
            { key: 'Mod-s', preventDefault: true, run: () => { saveNow(true); return true; } },
            ...defaultKeymap, ...historyKeymap,
          ]),
          C.nums.of([]), C.theme.of([]), base, C.attrs.of([]), C.focus.of([]), C.tw.of([]), C.trail.of([]),
          EditorView.updateListener.of((u) => {
            if (u.focusChanged) setEditorFocused(u.view.hasFocus); // drives the touch format bar
            if (!u.docChanged) return;
            setContent(u.state.doc.toString());
            const { on, type, vol } = snd.current;
            if (on && u.transactions.some(isTyping)) click(type, vol);
          }),
          EditorView.domEventHandlers({
            drop(e, v) {
              const files = [...(e.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith('image/'));
              if (!files.length) return false;
              e.preventDefault();
              const pos = v.posAtCoords({ x: e.clientX, y: e.clientY }) ?? v.state.selection.main.head;
              files.forEach((f) => {
                const r = new FileReader();
                r.onload = () => v.dispatch({ changes: { from: Math.min(pos, v.state.doc.length), insert: `![${f.name.replace(/\.[^.]+$/, '')}](${r.result})\n` } });
                r.readAsDataURL(f);
              });
              return true;
            },
          }),
        ],
      }),
    });
    return () => view.current?.destroy();
  }, [setContent, C]);

  // expose the live view to the FormatBar actions
  useEffect(() => {
    current = view.current;
    return () => { current = undefined; setEditorFocused(false); };
  }, [setContent, C]);

  // Keep the caret visible when the soft keyboard opens/closes
  useEffect(() => {
    const vv = window.visualViewport; if (!vv) return;
    let raf = 0;
    const f = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const v = view.current;
        if (v?.hasFocus) v.dispatch({ effects: EditorView.scrollIntoView(v.state.selection.main.head, { y: 'nearest', yMargin: 40 }) });
      });
    };
    vv.addEventListener('resize', f);
    return () => { vv.removeEventListener('resize', f); cancelAnimationFrame(raf); };
  }, []);

  // Sync external changes (initial load, preview checkbox toggles) into the editor
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== content) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: content } });
  }, [content]);

  // Reconfigure every setting-dependent extension through compartments (no editor rebuild → undo history survives)
  useEffect(() => {
    const touch = matchMedia('(hover: none)').matches;
    const fmt = s.lineNumberStyle === 'roman' ? roman : s.lineNumberStyle === 'dotted' ? dotted : (n: number) => String(n);
    view.current?.dispatch({ effects: [
      C.nums.reconfigure(s.lineNumbers && s.lineNumberStyle !== 'hidden' ? lineNumbers({ formatNumber: fmt }) : []),
      C.theme.reconfigure(s.dark ? oneDark : syntaxHighlighting(defaultHighlightStyle)),
      C.attrs.reconfigure(EditorView.editorAttributes.of({
        'data-cursor': s.cursorStyle, 'data-active-line': s.activeLineStyle,
        'data-bg-effect': s.editorBgEffect, 'data-line-nums': s.lineNumberStyle,
      })),
      C.focus.reconfigure(s.focusMode ? focusPlugin : []),
      C.tw.reconfigure(s.typewriterScroll ? [typewriter, twPad] : []),
      C.trail.reconfigure(s.cursorTrailEnabled && !touch ? trailPlugin(s.cursorTrailLength) : []),
    ] });
  }, [C, s.lineNumbers, s.lineNumberStyle, s.dark, s.cursorStyle, s.activeLineStyle, s.editorBgEffect,
      s.focusMode, s.typewriterScroll, s.cursorTrailEnabled, s.cursorTrailLength]);

  // AudioContext may only start after a user gesture
  useEffect(() => {
    if (!s.soundEnabled) return;
    const opt = { capture: true, once: true } as const;
    window.addEventListener('keydown', unlock, opt); window.addEventListener('pointerdown', unlock, opt);
    return () => { window.removeEventListener('keydown', unlock, true); window.removeEventListener('pointerdown', unlock, true); };
  }, [s.soundEnabled]);

  return <div ref={host} className="h-full overflow-hidden" />;
}
