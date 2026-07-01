export interface ConditionOption {
  value: string;
  label: string;
}

export interface ConditionPickerProps {
  value: string;
  onChange(value: string): void;
  label?: string;
  options?: ConditionOption[];
}

const DEFAULT_OPTIONS: ConditionOption[] = [
  { value: 'M', label: 'Mint' },
  { value: 'NM', label: 'NM' },
  { value: 'VG+', label: 'VG+' },
  { value: 'VG', label: 'VG' },
  { value: 'G+', label: 'G+' },
  { value: 'G', label: 'G' },
  { value: 'F', label: 'Fair' },
  { value: 'P', label: 'Poor' },
];

export function ConditionPicker({
  value,
  onChange,
  label,
  options = DEFAULT_OPTIONS,
}: ConditionPickerProps) {
  return (
    <div>
      {label ? (
        <label className="text-fg-heading mb-2 block text-sm font-medium">{label}</label>
      ) : null}
      <div className="rounded-base border-border-default bg-surface shadow-neu-inset inline-grid grid-cols-4 gap-1 border p-1.5">
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(active ? '' : opt.value)}
              aria-pressed={active}
              title={active ? undefined : opt.label}
              className={`rounded-DEFAULT inline-flex items-center justify-center px-2 py-1.5 text-xs font-medium transition-all duration-200 ${
                active
                  ? 'border-border-default bg-surface text-fg-brand-strong shadow-neu-sm'
                  : 'border-transparent bg-transparent text-fg-body-subtle hover:text-fg-body hover:shadow-neu-2xs'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
