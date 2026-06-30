import type { HTMLAttributes, ReactNode } from 'react';

export type CardVariant = 'static' | 'interactive';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  as?: 'div' | 'article' | 'section' | 'button';
  children?: ReactNode;
}

export function Card({
  variant = 'static',
  as = 'div',
  className = '',
  children,
  ...rest
}: CardProps) {
  const base =
    'bg-surface border border-border-default rounded-base transition-all duration-200 ease-in-out';

  // static: shadow-md (raised surface)
  // interactive: shadow-sm → hover shadow-md → active shadow-inset
  const shadow =
    variant === 'interactive'
      ? 'shadow-neu-sm hover:shadow-neu-md active:shadow-neu-inset cursor-pointer'
      : 'shadow-neu-md';

  const Component = as as 'div';
  return (
    <Component className={`${base} ${shadow} ${className}`} {...rest}>
      {children}
    </Component>
  );
}

export function CardBody({ className = '', children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-10 ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ className = '', children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`px-10 pb-8 pt-10 ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({ className = '', children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`px-10 pb-10 pt-6 ${className}`} {...rest}>
      {children}
    </div>
  );
}
