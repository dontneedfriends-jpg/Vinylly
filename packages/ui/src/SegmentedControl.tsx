import type { ReactNode } from 'react';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange(value: T): void;
  ariaLabel?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = '',
  size = 'md',
}: SegmentedControlProps<T>) {
  const padding = size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm';
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`rounded-base border-border-default bg-surface shadow-neu-inset inline-flex gap-1 border p-1.5 ${className}`}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={`rounded-base inline-flex items-center justify-center gap-1.5 border ${padding} font-medium transition-all duration-200 ease-in-out focus-visible:shadow-neu-xs focus-visible:border-border-default-strong ${
              active
                ? 'border-border-default bg-surface text-fg-brand-strong shadow-neu-sm'
                : 'text-fg-body-subtle hover:text-fg-body border-transparent bg-transparent'
            }`}
          >
            {opt.icon ? (
              <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
                {opt.icon}
              </span>
            ) : null}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
