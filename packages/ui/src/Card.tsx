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
    'bg-surface border border-border-default rounded-base ' +
    'shadow-neu-md transition-all duration-200 ease-in-out';

  const interactive =
    variant === 'interactive' ? 'cursor-pointer hover:shadow-neu-lg active:shadow-neu-inset' : '';

  const Component = as as 'div';
  return (
    <Component className={`${base} ${interactive} ${className}`} {...rest}>
      {children}
    </Component>
  );
}

export function CardBody({ className = '', children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`p-6 ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ className = '', children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`px-6 pb-3 pt-6 ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardFooter({ className = '', children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`px-6 pb-6 pt-3 ${className}`} {...rest}>
      {children}
    </div>
  );
}
