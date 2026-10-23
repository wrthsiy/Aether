import { ReactNode, useEffect, useState } from 'react';
import { useIsPhone, useVvHeight } from '../mobile';
import { EFFECT_DEFAULTS, EFFECT_PRESETS, PRESETS, useSettings, useStore } from '../store';
import { BoolKey, EffectSettings, NumKey, ResolvedSettings, ThemeSettings } from '../types';

type P = Partial<ThemeSettings>;
type Snap = 'peek' | 'half' | 'full';
type ColorKey = 'bgEditor' | 'bgPreview' | 'text' | 'accent' | 'codeBg';
type OptColorKey = 'cursorColor' | 'activeLineColor' | 'lineNumberColor' | 'cursorTrailColor';
type SelKey = 'editorFont' | 'previewFont' | 'bgMode' | 'cursorStyle' | 'activeLineStyle' | 'lineNumberStyle' | 'editorBgEffect' | 'soundType' | 'paperType';
const usePatch = () => useStore((s) => s.patch);

const Row = ({ l, children }: { l: string; children: ReactNode }) => (
  <label className="flex items-center justify-between gap-3 py-1 text-sm"><span>{l}</span>{children}</label>
);
const Color = ({ l, k }: { l: string; k: ColorKey }) => {
  const v = useSettings()[k], patch = usePatch();
  return <Row l={l}><input type="color" value={v} onChange={(e) => patch({ [k]: e.target.value } as P)} /></Row>;
};
/** Optional effect color: empty string = "auto" (follows accent). */
const ColorOpt = ({ l, k }: { l: string; k: OptColorKey }) => {
  const s = useSettings(), patch = usePatch();
  return (
    <Row l={l}>
      <span className="flex items-center gap-1">
        <input type="color" value={s[k] || s.accent} onChange={(e) => patch({ [k]: e.target.value } as P)} />
        <button className="btn" disabled={!s[k]} onClick={() => patch({ [k]: '' } as P)}>auto</button>
      </span>
    </Row>
  );
};
const Range = ({ l, k, min, max, step = 1, unit = '' }: { l: string; k: NumKey; min: number; max: number; step?: number; unit?: string }) => {
  const v = useSettings()[k] ?? min, patch = usePatch();
  return (
    <Row l={`${l}: ${v}${unit}`}>
      <input type="range" min={min} max={max} step={step} value={v} className="w-40" style={{ accentColor: 'var(--accent)' }}
        onChange={(e) => patch({ [k]: +e.target.value } as P)} />
    </Row>
  );
};
const Select = ({ l, k, opts }: { l: string; k: SelKey; opts: string[] }) => {
  const v = useSettings()[k] as string, patch = usePatch();
  return (
    <Row l={l}>
      <select value={v} onChange={(e) => patch({ [k]: e.target.value } as P)}
        className="rounded-md border px-2 py-1" style={{ background: 'var(--bg-editor)', color: 'var(--text)' }}>
        {opts.map((o) => <option key={o}>{o}</option>)}
      </select>
    </Row>
  );
};
const Check = ({ l, k }: { l: string; k: BoolKey }) => {
  const v = useSettings()[k], patch = usePatch();
  return <Row l={l}><input type="checkbox" checked={v} style={{ accentColor: 'var(--accent)' }} onChange={(e) => patch({ [k]: e.target.checked } as P)} /></Row>;
};
/** A toggle whose controls look disabled (dimmed, inert) while it is off. */
const Group = ({ l, k, children }: { l: string; k: BoolKey; children?: ReactNode }) => {
  const on = useSettings()[k];
  return (
    <div className="py-1">
      <Check l={l} k={k} />
      {children && <div className={`pl-3 ${on ? '' : 'fx-off'}`}>{children}</div>}
    </div>
  );
};
/** Collapsible section with a "Reset section" button that restores only its own keys. */
const Section = ({ title, keys, children }: { title: string; keys: (keyof EffectSettings)[]; children: ReactNode }) => {
  const patch = usePatch();
  return (
    <details className="sec">
      <summary>{title}</summary>
      {children}
      <button className="btn mt-2" onClick={() => patch(Object.fromEntries(keys.map((k) => [k, EFFECT_DEFAULTS[k]])) as P)}>Reset section</button>
    </details>
  );
};

export default function ThemeStudio() {
  const { studioOpen, toggle, reset, patch, applyPreset } = useStore();
  const s: ResolvedSettings = useSettings(), g = s.gradient;

  // ----- phone bottom sheet: drag the handle; snap points peek / half / full; drag below peek to close -----
  const phone = useIsPhone(), vvh = useVvHeight();
  const [snap, setSnap] = useState<Snap>('half');
  const [dragY, setDragY] = useState<number | null>(null);
  useEffect(() => { if (studioOpen) setSnap('half'); }, [studioOpen]);
  const H = Math.round(vvh * 0.92);
  const vis: Record<Snap, number> = { peek: 130, half: Math.round(vvh * 0.5), full: H }; // px of the sheet that stay on screen
  const y = dragY ?? (studioOpen ? H - vis[snap] : H + 24); // translateY of the sheet
  const startDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget; el.setPointerCapture(e.pointerId);
    const y0 = e.clientY, base = H - vis[snap]; let cur = base; setDragY(base);
    const mv = (ev: PointerEvent) => { cur = Math.min(H + 24, Math.max(0, base + ev.clientY - y0)); setDragY(cur); };
    const up = () => {
      el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
      setDragY(null);
      if (Math.abs(cur - base) < 4) { setSnap(snap === 'peek' ? 'half' : snap === 'half' ? 'full' : 'peek'); return; } // plain tap cycles
      const shown = H - cur;
      if (shown < vis.peek - 50) { useStore.setState({ studioOpen: false }); return; }
      setSnap((Object.keys(vis) as Snap[]).reduce((a, k) => (Math.abs(vis[k] - shown) < Math.abs(vis[a] - shown) ? k : a), 'half' as Snap));
    };
    el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  };
  const setG = (p: Partial<typeof g>) => patch({ gradient: { ...g, enabled: true, ...p } });
  const setStop = (i: number, c: string) => setG({ stops: g.stops.map((x, j) => (j === i ? c : x)) });
  const upload = (f?: File) => {
    if (!f) return;
    if (s.bgImage) URL.revokeObjectURL(s.bgImage);
    patch({ bgImage: URL.createObjectURL(f) }); // GIFs animate natively as CSS backgrounds
  };

  return (
  <aside className={`studio glass no-print ${studioOpen ? 'open' : ''}`} aria-hidden={!studioOpen} aria-label="Theme Studio"
  style={phone ? { height: H, transform: `translateY(${y}px)`, transition: dragY !== null ? 'none' : undefined,
    paddingTop: 28, paddingBottom: H - vis[snap] + 16 /* lets the hidden part of the content scroll into view */ } : undefined}>
  <div className="sheet-handle" onPointerDown={startDrag} role="separator" aria-label="Drag to resize Theme Studio"><span /></div>
  <div className="flex items-center justify-between">
    <h2 className="text-lg font-bold">Theme Studio</h2>
    <button className="btn" onClick={() => toggle('studioOpen')} aria-label="Close">✕</button>
  </div>

      <h3>Effect presets</h3>
      <div className="flex flex-wrap gap-1">
        {Object.keys(EFFECT_PRESETS).map((n) => <button key={n} className="btn" onClick={() => applyPreset(n)}>{n}</button>)}
      </div>

      <h3>Colors</h3>
      <Color l="Editor background" k="bgEditor" /><Color l="Preview background" k="bgPreview" />
      <Color l="Text" k="text" /><Color l="Accent" k="accent" /><Color l="Code block background" k="codeBg" />

      <h3>Gradient (preview background)</h3>
      <div className="flex flex-wrap gap-1">
        {Object.entries(PRESETS).map(([n, stops]) => (
          <button key={n} className="btn" style={{ background: `linear-gradient(90deg, ${stops.join(',')})`, color: '#fff', textShadow: '0 1px 2px #0008' }}
            onClick={() => patch({ gradient: { ...g, enabled: true, stops } })}>{n}</button>
        ))}
        <button className="btn" onClick={() => patch({ gradient: { ...g, enabled: false } })}>None</button>
      </div>
      <Row l="Type">
        <span className="flex gap-1">{(['linear', 'radial'] as const).map((t) => (
          <button key={t} className={`btn ${g.type === t ? 'on' : ''}`} onClick={() => setG({ type: t })}>{t}</button>))}</span>
      </Row>
      <Row l={`Angle: ${g.angle}°`}>
        <input type="range" min={0} max={360} value={g.angle} className="w-40" style={{ accentColor: 'var(--accent)' }}
          disabled={g.type === 'radial'} onChange={(e) => setG({ angle: +e.target.value })} />
      </Row>
      <div className="flex flex-wrap items-center gap-2">
        {g.stops.map((c, i) => (
          <span key={i} className="flex items-center gap-1">
            <input type="color" value={c} onChange={(e) => setStop(i, e.target.value)} />
            {g.stops.length > 2 && <button className="btn" aria-label="Remove stop" onClick={() => setG({ stops: g.stops.filter((_, j) => j !== i) })}>−</button>}
          </span>
        ))}
        {g.stops.length < 5 && <button className="btn" onClick={() => setG({ stops: [...g.stops, '#ffffff'] })}>+ stop</button>}
      </div>

      <h3>Background image</h3>
      <input type="file" accept="image/*,image/gif" onChange={(e) => upload(e.target.files?.[0])} className="w-full text-sm" />
      <Range l="Blur" k="blur" min={0} max={40} unit="px" />
      <Range l="Darkening" k="darken" min={0} max={80} unit="%" />
      <Range l="Saturation" k="saturate" min={0} max={200} unit="%" />
      <Select l="Position" k="bgMode" opts={['cover', 'contain', 'tile']} />
      <button className="btn mt-1" disabled={!s.bgImage} onClick={() => { if (s.bgImage) URL.revokeObjectURL(s.bgImage); patch({ bgImage: null }); }}>Remove background</button>
      <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>Images last for this session only; re-add after reloading.</p>

      <h3>Typography</h3>
      <Select l="Editor font" k="editorFont" opts={['JetBrains Mono', 'Fira Code', 'IBM Plex Mono']} />
      <Select l="Preview font" k="previewFont" opts={['Inter', 'Lora', 'Merriweather']} />
      <Range l="Font size" k="fontSize" min={14} max={20} unit="px" />
      <Range l="Line height" k="lineHeight" min={1.2} max={2} step={0.05} />
      <Range l="Preview width" k="colWidth" min={600} max={1000} step={10} unit="px" />
      <Check l="Ligatures" k="ligatures" />

      <h3>Effects</h3>
      <Section title="✍️ Editor" keys={['activeLineStyle', 'activeLineColor', 'focusMode', 'focusIntensity', 'typewriterScroll', 'lineNumberStyle', 'lineNumberColor']}>
        <Select l="Active line" k="activeLineStyle" opts={['none', 'tint', 'border-left', 'glow']} />
        <ColorOpt l="Active line color" k="activeLineColor" />
        <Group l="Focus mode (dim other lines)" k="focusMode"><Range l="Intensity" k="focusIntensity" min={0} max={100} /></Group>
        <Check l="Typewriter scroll" k="typewriterScroll" />
        <Check l="Line numbers" k="lineNumbers" />
        <Select l="Number style" k="lineNumberStyle" opts={['plain', 'dotted', 'roman', 'hidden']} />
        <ColorOpt l="Number color" k="lineNumberColor" />
      </Section>

      <Section title="🎨 Editor Background" keys={['editorBgEffect', 'editorBgIntensity']}>
        <Select l="Effect" k="editorBgEffect" opts={['none', 'glass', 'gradient', 'noise', 'grid', 'dots']} />
        <Range l="Intensity" k="editorBgIntensity" min={0} max={100} />
      </Section>

      <Section title="🔊 Sound" keys={['soundEnabled', 'soundType', 'soundVolume']}>
        <Group l="Typing sounds" k="soundEnabled">
          <Select l="Type" k="soundType" opts={['mechanical', 'typewriter', 'rain', 'soft', 'none']} />
          <Range l="Volume" k="soundVolume" min={0} max={100} />
        </Group>
      </Section>

      <Section title="🌬 Motion" keys={['breathingEnabled', 'breathingSpeed', 'parallaxEnabled', 'parallaxStrength', 'ambientEnabled', 'ambientIntensity', 'hueShiftEnabled', 'hueShiftSpeed', 'frostedEdgeEnabled', 'frostedEdgeSize']}>
        <Group l="Breathing" k="breathingEnabled"><Range l="Speed" k="breathingSpeed" min={3} max={8} unit="s" /></Group>
        <Group l="Parallax (mouse only)" k="parallaxEnabled"><Range l="Strength" k="parallaxStrength" min={0} max={30} unit="px" /></Group>
        <Group l="Ambient light" k="ambientEnabled"><Range l="Intensity" k="ambientIntensity" min={0} max={100} /></Group>
        <Group l="Hue shift (accent only)" k="hueShiftEnabled"><Range l="Cycle" k="hueShiftSpeed" min={10} max={120} unit="s" /></Group>
        <Group l="Frosted edges" k="frostedEdgeEnabled"><Range l="Size" k="frostedEdgeSize" min={0} max={40} unit="px" /></Group>
      </Section>

      <Section title="📜 Texture" keys={['paperEnabled', 'paperType', 'crtEnabled', 'crtIntensity']}>
        <Group l="Paper" k="paperEnabled"><Select l="Type" k="paperType" opts={['aged', 'linen', 'grid', 'dotted']} /></Group>
        <Group l="CRT scanlines" k="crtEnabled"><Range l="Intensity" k="crtIntensity" min={0} max={100} /></Group>
      </Section>

      <Section title="✨ Cursor" keys={['cursorStyle', 'cursorColor', 'cursorBlinkSpeed', 'cursorTrailEnabled', 'cursorTrailLength', 'cursorTrailColor']}>
        <Select l="Style" k="cursorStyle" opts={['line', 'block', 'underline', 'glow', 'pulse']} />
        <ColorOpt l="Color" k="cursorColor" />
        <Range l="Blink cycle" k="cursorBlinkSpeed" min={0.5} max={2} step={0.1} unit="s" />
        <Group l="Trail" k="cursorTrailEnabled">
          <Range l="Length" k="cursorTrailLength" min={3} max={20} />
          <ColorOpt l="Trail color" k="cursorTrailColor" />
        </Group>
      </Section>

      <button className="btn mt-4 w-full" onClick={reset}>Reset to defaults</button>
    </aside>
  );
}
