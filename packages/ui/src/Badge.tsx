import type { HTMLAttributes } from 'react';

export type BadgeTone = 'neutral' | 'brand' | 'secondary' | 'danger' | 'success' | 'warning' | 'neu';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  pill?: boolean;
}

const toneStyles: Record<BadgeTone, string> = {
  neutral: 'bg-surface text-fg-heading border-border-default',
  brand: 'bg-brand-softer text-fg-brand-strong border-border-brand-subtle',
  secondary: 'bg-secondary-soft text-fg-secondary border-border-default',
  danger: 'bg-danger-soft text-fg-danger-strong border-border-danger-subtle',
  success: 'bg-success-soft text-fg-success-strong border-border-success-subtle',
  warning: 'bg-warning-soft text-fg-warning border-border-default',
  neu: 'bg-surface text-fg-body border-border-default shadow-neu-inset',
};

export function Badge({
  tone = 'neutral',
  pill = false,
  className = '',
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={`inline-flex select-none items-center gap-1 border px-2 py-0.5 text-xs font-medium ${
        pill ? 'rounded-full' : 'rounded-DEFAULT'
      } ${toneStyles[tone]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}
