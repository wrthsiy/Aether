import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { get, set } from 'idb-keyval';
import { EffectSettings, Mode, ResolvedSettings, ThemeSettings } from './types';

export const PALETTES = {
  dark: { bgEditor: '#14161f', bgPreview: '#1b1e2b', text: '#e6e8f0', accent: '#8b7cff', codeBg: '#0e1018' },
  light: { bgEditor: '#fbfbfd', bgPreview: '#ffffff', text: '#1f2330', accent: '#5b4bff', codeBg: '#eef0f6' },
};
/** Everything off, except activeLineStyle. */
export const EFFECT_DEFAULTS: Required<EffectSettings> = {
  cursorStyle: 'line', cursorColor: '', cursorBlinkSpeed: 1.1,
  cursorTrailEnabled: false, cursorTrailLength: 10, cursorTrailColor: '',
  activeLineStyle: 'tint', activeLineColor: '',
  focusMode: false, focusIntensity: 65, typewriterScroll: false,
  lineNumberStyle: 'plain', lineNumberColor: '',
  editorBgEffect: 'none', editorBgIntensity: 40,
  soundEnabled: false, soundType: 'mechanical', soundVolume: 40,
  breathingEnabled: false, breathingSpeed: 5,
  parallaxEnabled: false, parallaxStrength: 12,
  ambientEnabled: false, ambientIntensity: 50,
  hueShiftEnabled: false, hueShiftSpeed: 60,
  frostedEdgeEnabled: false, frostedEdgeSize: 16,
  paperEnabled: false, paperType: 'aged',
  crtEnabled: false, crtIntensity: 40,
};
export const DEFAULTS: ResolvedSettings = {
  dark: true, ...PALETTES.dark,
  gradient: { enabled: false, type: 'linear', angle: 135, stops: ['#ff7e5f', '#feb47b'] },
  bgImage: null, blur: 0, darken: 30, saturate: 100, bgMode: 'cover',
  editorFont: 'JetBrains Mono', previewFont: 'Inter', fontSize: 16, lineHeight: 1.6, colWidth: 760,
  ligatures: true, lineNumbers: true,
  ...EFFECT_DEFAULTS,
};
export const PRESETS: Record<string, string[]> = {
  Sunset: ['#ff5f6d', '#ffc371'], Ocean: ['#2193b0', '#6dd5ed', '#1c3b70'],
  Aurora: ['#00c9a7', '#845ec2', '#ff6f91'], Midnight: ['#0f2027', '#203a43', '#2c5364'],
};
export const EFFECT_PRESETS: Record<string, Partial<EffectSettings>> = {
  Writer: { focusMode: true, typewriterScroll: true, cursorStyle: 'glow', paperEnabled: true, paperType: 'aged' },
  Retro: { crtEnabled: true, crtIntensity: 55, paperEnabled: true, paperType: 'aged', hueShiftEnabled: true },
  Ambient: { ambientEnabled: true, breathingEnabled: true, parallaxEnabled: true },
  Focus: { frostedEdgeEnabled: true, focusMode: true, typewriterScroll: true },
};

/** Phone detection shared by CSS (same query) and JS. */
export const PHONE_Q = '(max-width: 768px), (pointer: coarse) and (max-height: 500px)';
export const isPhone = () => typeof matchMedia !== 'undefined' && matchMedia(PHONE_Q).matches;
/** First-launch values on phones (and "Reset to defaults" there). Saved settings are never overridden. */
export const startDefaults = (): ResolvedSettings =>
  isPhone() ? { ...DEFAULTS, fontSize: 17, lineNumbers: false, typewriterScroll: true } : DEFAULTS;

interface State {
  settings: ThemeSettings; mode: Mode; studioOpen: boolean; tocOpen: boolean; content: string; savedAt: number;
  patch: (p: Partial<ThemeSettings>) => void; applyPreset: (name: string) => void;
  reset: () => void; toggleDark: () => void;
  setMode: (m: Mode) => void; toggle: (k: 'studioOpen' | 'tocOpen') => void; setContent: (c: string) => void;
}
export const useStore = create<State>()(
  persist(
    (setS) => ({
      settings: startDefaults(), mode: 'split', studioOpen: false, tocOpen: false, content: '', savedAt: Date.now(),
      patch: (p) => setS((s) => ({ settings: { ...s.settings, ...p } })),
      // presets replace each other: reset all effects first, then apply
      applyPreset: (n) => setS((s) => ({ settings: { ...s.settings, ...EFFECT_DEFAULTS, ...EFFECT_PRESETS[n] } })),
      reset: () => setS((s) => { if (s.settings.bgImage) URL.revokeObjectURL(s.settings.bgImage); return { settings: startDefaults() }; }),
      toggleDark: () => setS((s) => ({ settings: { ...s.settings, dark: !s.settings.dark, ...(s.settings.dark ? PALETTES.light : PALETTES.dark) } })),
      setMode: (mode) => setS({ mode }),
      toggle: (k) => setS((s) => ({ [k]: !s[k] }) as Partial<State>),
      setContent: (content) => setS({ content }),
    }),
    {
      name: 'aether-settings',
      partialize: (s) => ({ settings: { ...s.settings, bgImage: null }, mode: s.mode === 'zen' ? 'split' : s.mode }),
      // nothing saved yet (first launch) → keep the initial, possibly phone-tuned, settings
      merge: (p, c) => ({ ...c, ...(p as object), settings: (p as any)?.settings ? { ...DEFAULTS, ...(p as any).settings } : c.settings }),
    }
  )
);
/** Settings with every optional field resolved – components read this. */
export function useSettings(): ResolvedSettings {
  const s = useStore((st) => st.settings);
  return useMemo(() => ({ ...DEFAULTS, ...s }), [s]);
}

let last = '';
export const markLoaded = (c: string) => { last = c; };
export async function saveNow(force = false) {
  const c = useStore.getState().content;
  if (!force && c === last) return;
  await set('aether:doc', c); last = c; useStore.setState({ savedAt: Date.now() });
}
export const loadDoc = () => get<string>('aether:doc');
