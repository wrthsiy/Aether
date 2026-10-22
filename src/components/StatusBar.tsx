import { useEffect, useState } from 'react';
import { useStore } from '../store';

export default function StatusBar() {
  const content = useStore((s) => s.content), savedAt = useStore((s) => s.savedAt);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  // ignore embedded base64 images when counting words
  const words = content.replace(/\(data:[^)]*\)/g, '').trim().split(/\s+/).filter(Boolean).length;
  const secs = Math.max(0, Math.round((now - savedAt) / 1000));
  return (
    <footer className="no-print glass flex h-7 shrink-0 items-center gap-4 px-4 text-xs" style={{ color: 'var(--muted)' }}>
      <span>{words} words</span>
      <span>{Math.max(1, Math.ceil(words / 200))} min read</span>
      <span className="ml-auto">saved {secs} second{secs === 1 ? '' : 's'} ago</span>
    </footer>
  );
}
