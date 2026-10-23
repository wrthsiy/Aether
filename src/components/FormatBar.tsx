import { editorActions } from './Editor';
import { isTouch, useEditorFocused } from '../mobile';

const BTNS: [keyof typeof editorActions, string, JSX.Element | string][] = [
  ['bold', 'Bold', <b>B</b>], ['italic', 'Italic', <i>I</i>], ['link', 'Link', 'Link'],
  ['heading', 'Heading', 'H'], ['list', 'Bulleted list', 'List'], ['task', 'Checklist', 'Task'],
];

/** Shown only on touch devices while the editor has focus (i.e. the soft keyboard is up). */
export default function FormatBar() {
  const focused = useEditorFocused();
  if (!focused || !isTouch()) return null;
  return (
    <div className="format-bar glass no-print" role="toolbar" aria-label="Formatting">
      {BTNS.map(([k, label, content]) => (
        // preventDefault on pointerdown keeps focus in the editor so the keyboard stays open
        <button key={k} className="btn" aria-label={label} title={label}
          onMouseDown={(e) => e.preventDefault()} onPointerDown={(e) => { e.preventDefault(); editorActions[k](); }}>
          {content}
        </button>
      ))}
    </div>
  );
}
