import type { HTMLAttributes } from 'react';

export type BadgeTone = 'neutral' | 'brand' | 'secondary' | 'danger';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const toneText: Record<BadgeTone, string> = {
  neutral: 'text-fg-body',
  brand: 'text-fg-brand',
  secondary: 'text-fg-secondary',
  danger: 'text-[#d04545]',
};

export function Badge({ tone = 'neutral', className = '', children, ...rest }: BadgeProps) {
  return (
    <span
      className={
        'inline-flex items-center gap-1 px-2.5 py-0.5 ' +
        'bg-surface border-border-default border' +
        'shadow-neu-2xs rounded-full' +
        'text-xs font-medium' +
        `${toneText[tone]} ${className}`
      }
      {...rest}
    >
      {children}
    </span>
  );
}
