import type { HTMLAttributes } from 'react';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}

const roundedMap = {
  sm: 'rounded-sm',
  md: 'rounded-base',
  lg: 'rounded-lg',
  full: 'rounded-full',
} as const;

export function Skeleton({
  width = '100%',
  height = '1rem',
  rounded = 'md',
  className = '',
  style,
  ...rest
}: SkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={`bg-surface shadow-neu-inset ${roundedMap[rounded]} ${className} animate-pulse`}
      style={{ width, height, ...style }}
      {...rest}
    />
  );
}

export function SkeletonCover({ className = '' }: { className?: string }) {
  return <Skeleton width="100%" height="100%" rounded="md" className={className} />;
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-base border-border-default bg-surface shadow-neu-sm border p-5 ${className}`}
    >
      <Skeleton height="100%" className="mb-3 aspect-square" rounded="md" />
      <Skeleton width="80%" className="mb-2" />
      <Skeleton width="50%" />
    </div>
  );
}
