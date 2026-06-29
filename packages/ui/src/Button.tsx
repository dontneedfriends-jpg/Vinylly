import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'brand' | 'secondary' | 'neutral' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

const variantText: Record<ButtonVariant, string> = {
  brand: 'text-fg-brand',
  secondary: 'text-fg-secondary',
  neutral: 'text-fg-heading',
  danger: 'text-[#d04545]',
  ghost: 'text-fg-body',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm rounded',
  md: 'px-4 py-2 text-base rounded-base',
  lg: 'px-6 py-3 text-base rounded-base',
};

export function Button({
  variant = 'brand',
  size = 'md',
  leftIcon,
  rightIcon,
  fullWidth,
  className = '',
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 font-medium ' +
    'bg-surface border border-border-default ' +
    'shadow-neu-sm hover:shadow-neu-md active:shadow-neu-inset ' +
    'transition-all duration-200 ease-in-out ' +
    'disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-neu-sm ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-fg-brand/60';

  return (
    <button
      className={`${base} ${variantText[variant]} ${sizeClasses[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={disabled}
      {...rest}
    >
      {leftIcon ? <span className="inline-flex shrink-0">{leftIcon}</span> : null}
      <span>{children}</span>
      {rightIcon ? <span className="inline-flex shrink-0">{rightIcon}</span> : null}
    </button>
  );
}
