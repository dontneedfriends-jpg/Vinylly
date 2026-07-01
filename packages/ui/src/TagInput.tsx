import { useState, type KeyboardEvent } from 'react';
import { useId } from 'react';

export interface TagInputProps {
  label?: string;
  tags: string[];
  onChange(tags: string[]): void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}

export function TagInput({ label, tags, onChange, placeholder, disabled, id }: TagInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [draft, setDraft] = useState('');

  const addTag = (raw: string) => {
    const tag = raw.trim().toLowerCase();
    if (!tag || tags.includes(tag)) return;
    onChange([...tags, tag]);
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(draft);
      setDraft('');
      return;
    }
    if (e.key === 'Backspace' && !draft && tags.length > 0) {
      removeTag(tags[tags.length - 1]!);
    }
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text');
    if (text.includes(',') || text.includes('\n')) {
      e.preventDefault();
      const parts = text.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
      const next = [...tags];
      for (const p of parts) {
        const t = p.toLowerCase();
        if (t && !next.includes(t)) next.push(t);
      }
      onChange(next);
    }
  };

  return (
    <div className="w-full">
      {label ? (
        <label htmlFor={inputId} className="text-fg-heading mb-2 block text-sm font-medium">
          {label}
        </label>
      ) : null}
      <div className="bg-surface border-border-default-medium focus-within:border-border-brand rounded-base shadow-neu-inset flex min-h-[42px] flex-wrap items-center gap-1.5 border px-2.5 py-1.5 transition-all duration-200 focus-within:ring-1 focus-within:ring-fg-brand/30">
        {tags.map((tag) => (
          <span
            key={tag}
            className="bg-surface border-border-default shadow-neu-2xs inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium leading-relaxed"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              disabled={disabled}
              className="text-fg-body-subtle hover:text-fg-heading inline-flex h-3.5 w-3.5 items-center justify-center rounded-full transition-colors"
              aria-label={`Remove tag ${tag}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-2.5 w-2.5" aria-hidden>
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </span>
        ))}
        <input
          id={inputId}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onBlur={() => {
            if (draft.trim()) {
              addTag(draft);
              setDraft('');
            }
          }}
          placeholder={tags.length === 0 ? (placeholder ?? '') : ''}
          disabled={disabled}
          className="min-w-[80px] flex-1 border-0 bg-transparent py-1 text-sm text-fg-heading outline-none placeholder:text-fg-body-subtle"
        />
      </div>
    </div>
  );
}
