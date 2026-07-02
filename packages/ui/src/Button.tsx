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
  brand: 'text-fg-brand-strong',
  secondary: 'text-fg-secondary',
  neutral: 'text-fg-heading',
  danger: 'text-fg-danger-strong',
  ghost: 'text-fg-body',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3.5 py-1.5 text-sm rounded-base gap-2',
  md: 'px-5 py-2.5 text-sm rounded-base gap-2.5',
  lg: 'px-7 py-3 text-base rounded-base gap-3',
};

const shadowFor = (variant: ButtonVariant): string => {
  if (variant === 'ghost') return 'shadow-none hover:shadow-neu-sm active:shadow-neu-inset';
  return 'shadow-neu-sm hover:shadow-neu-md active:shadow-neu-inset';
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
    'inline-flex items-center justify-center font-medium ' +
    'bg-surface border border-border-default ' +
    `${shadowFor(variant)} ` +
    'transition-all duration-200 ease-in-out ' +
    'disabled:text-fg-disabled disabled:cursor-not-allowed disabled:hover:shadow-neu-sm';

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
