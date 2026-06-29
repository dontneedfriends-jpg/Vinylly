import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';

export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

export function Container({ className = '', children, ...rest }: ContainerProps) {
  return (
    <div className={`mx-auto w-full max-w-[1140px] px-6 ${className}`} {...rest}>
      {children}
    </div>
  );
}

export interface StackProps extends HTMLAttributes<HTMLDivElement> {
  gap?: 2 | 3 | 4 | 6 | 8 | 12;
  direction?: 'row' | 'column';
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between';
  wrap?: boolean;
}

const alignMap = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
} as const;
const justifyMap = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
} as const;

export function Stack({
  gap = 4,
  direction = 'column',
  align,
  justify,
  wrap,
  className = '',
  children,
  ...rest
}: StackProps) {
  const flexStyle: CSSProperties = { gap: `${gap * 4}px` };
  return (
    <div
      className={`flex ${direction === 'row' ? 'flex-row' : 'flex-col'} ${align ? alignMap[align] : ''} ${justify ? justifyMap[justify] : ''} ${wrap ? 'flex-wrap' : ''} ${className}`}
      style={flexStyle}
      {...rest}
    >
      {children}
    </div>
  );
}
