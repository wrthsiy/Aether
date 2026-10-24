export type Mode = 'focus' | 'split' | 'preview' | 'zen';
export interface GradientSettings { enabled: boolean; type: 'linear' | 'radial'; angle: number; stops: string[]; }
export type CursorStyle = 'line' | 'block' | 'underline' | 'glow' | 'pulse';
export type ActiveLineStyle = 'none' | 'tint' | 'border-left' | 'glow';
export type LineNumberStyle = 'plain' | 'dotted' | 'roman' | 'hidden';
export type EditorBgEffect = 'none' | 'glass' | 'gradient' | 'noise' | 'grid' | 'dots';
export type SoundType = 'mechanical' | 'typewriter' | 'rain' | 'soft' | 'none';
export type PaperType = 'aged' | 'linen' | 'grid' | 'dotted';
export type BlockquoteStyle = 'bar' | 'card' | 'quote' | 'minimal';
export type LinkStyle = 'underline' | 'animated' | 'highlight' | 'none';
export type TableStyle = 'plain' | 'striped' | 'bordered' | 'minimal';
export type CodeTheme = 'auto' | 'one-dark' | 'github-light' | 'dracula' | 'solarized' | 'nord';

/** All optional → settings saved by older versions still load. Empty-string colors = follow accent. */
export interface EffectSettings {
  cursorStyle?: CursorStyle; cursorColor?: string; cursorBlinkSpeed?: number;
  cursorTrailEnabled?: boolean; cursorTrailLength?: number; cursorTrailColor?: string;
  activeLineStyle?: ActiveLineStyle; activeLineColor?: string;
  focusMode?: boolean; focusIntensity?: number; typewriterScroll?: boolean;
  lineNumberStyle?: LineNumberStyle; lineNumberColor?: string;
  editorBgEffect?: EditorBgEffect; editorBgIntensity?: number;
  soundEnabled?: boolean; soundType?: SoundType; soundVolume?: number;
  breathingEnabled?: boolean; breathingSpeed?: number;
  parallaxEnabled?: boolean; parallaxStrength?: number;
  ambientEnabled?: boolean; ambientIntensity?: number;
  hueShiftEnabled?: boolean; hueShiftSpeed?: number;
  frostedEdgeEnabled?: boolean; frostedEdgeSize?: number;
  paperEnabled?: boolean; paperType?: PaperType;
  crtEnabled?: boolean; crtIntensity?: number;
}
/** Preview look. Optional → older saved settings still load; defaults in PREVIEW_DEFAULTS. */
export interface PreviewSettings {
  paragraphSpacing?: number;  // em, gap between blocks
  letterSpacing?: number;     // em
  headingScale?: number;      // ratio 1.1–1.5; h1–h4 sizes are derived from it
  blockquoteStyle?: BlockquoteStyle;
  linkStyle?: LinkStyle;
  tableStyle?: TableStyle;
  imageRadius?: number;       // px
  imageShadow?: boolean;
  codeTheme?: CodeTheme;      // 'auto' = original colors + the code background picker
}
/** Editor behaviour options (optional → older saved settings still load; defaults in EDITOR_DEFAULTS). */
export interface EditorSettings {
  wordWrap?: boolean;
  bracketMatching?: boolean;
  closeBrackets?: boolean;
  selectionColor?: string;   // '' = theme default
  tabSize?: number;          // 2–8
  tabIndent?: boolean;       // Tab key indents (Esc, then Tab, leaves the editor)
}
export interface ThemeSettings extends EffectSettings, EditorSettings, PreviewSettings {
  dark: boolean;
  bgEditor: string; bgPreview: string; text: string; accent: string; codeBg: string;
  gradient: GradientSettings;
  bgImage: string | null; // ObjectURL – session only, never persisted
  blur: number; darken: number; saturate: number; bgMode: 'cover' | 'contain' | 'tile';
  editorFont: string; previewFont: string;
  editorFontSize: number; editorLineHeight: number; previewFontSize: number; previewLineHeight: number; colWidth: number;
  ligatures: boolean; lineNumbers: boolean;
  exportCompress?: boolean; // HTML export: downscale + re-encode embedded images
}
export type ResolvedSettings = Required<ThemeSettings>;
export type NumKey = { [K in keyof ResolvedSettings]: ResolvedSettings[K] extends number ? K : never }[keyof ResolvedSettings];
export type BoolKey = { [K in keyof ResolvedSettings]: ResolvedSettings[K] extends boolean ? K : never }[keyof ResolvedSettings];
