import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { useId } from 'react';

type FieldState = 'default' | 'success' | 'error';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  state?: FieldState;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const stateBorder: Record<FieldState, string> = {
  default:
    'border-border-default-medium hover:border-border-default-strong focus-within:border-border-brand',
  success: 'border-border-brand',
  error: 'border-border-danger-subtle',
};

export function Input({
  label,
  helperText,
  state = 'default',
  leftIcon,
  rightIcon,
  className = '',
  id,
  disabled,
  ...rest
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const helperId = helperText ? `${inputId}-helper` : undefined;

  const wrapper =
    'flex items-center gap-2 bg-surface border rounded-base shadow-neu-inset ' +
    'transition-all duration-200 ease-in-out ' +
    `${stateBorder[state]} ` +
    'focus-within:ring-1 focus-within:ring-fg-brand/30 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed';

  const inputBase =
    'w-full bg-transparent border-0 outline-none text-sm text-fg-heading placeholder:text-fg-body-subtle px-3 py-2.5';

  return (
    <div className="w-full">
      {label ? (
        <label htmlFor={inputId} className="text-fg-heading mb-2 block text-sm font-medium">
          {label}
        </label>
      ) : null}
      <div className={`${wrapper} ${leftIcon ? 'pl-3' : ''} ${rightIcon ? 'pr-3' : ''}`}>
        {leftIcon ? (
          <span className="text-fg-body inline-flex shrink-0" aria-hidden>
            {leftIcon}
          </span>
        ) : null}
        <input
          id={inputId}
          className={`${inputBase} ${className}`}
          disabled={disabled}
          aria-describedby={helperId}
          {...rest}
        />
        {rightIcon ? (
          <span className="text-fg-body inline-flex shrink-0" aria-hidden>
            {rightIcon}
          </span>
        ) : null}
      </div>
      {helperText ? (
        <p
          id={helperId}
          className={`mt-2 text-xs ${state === 'error' ? 'text-fg-danger' : 'text-fg-body-subtle'}`}
        >
          {helperText}
        </p>
      ) : null}
    </div>
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  state?: FieldState;
}

export function Textarea({
  label,
  helperText,
  state = 'default',
  className = '',
  id,
  disabled,
  ...rest
}: TextareaProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const helperId = helperText ? `${inputId}-helper` : undefined;

  const wrapper =
    'bg-surface border rounded-base shadow-neu-inset ' +
    'transition-all duration-200 ease-in-out ' +
    `${stateBorder[state]} ` +
    'focus-within:ring-1 focus-within:ring-fg-brand/30 ' +
    'disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="w-full">
      {label ? (
        <label htmlFor={inputId} className="text-fg-heading mb-2 block text-sm font-medium">
          {label}
        </label>
      ) : null}
      <div className={wrapper}>
        <textarea
          id={inputId}
          className={`rounded-base text-fg-heading placeholder:text-fg-body-subtle min-h-[88px] w-full resize-y bg-transparent px-3 py-2.5 text-sm outline-none ${className}`}
          disabled={disabled}
          aria-describedby={helperId}
          {...rest}
        />
      </div>
      {helperText ? (
        <p
          id={helperId}
          className={`mt-2 text-xs ${state === 'error' ? 'text-fg-danger' : 'text-fg-body-subtle'}`}
        >
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
