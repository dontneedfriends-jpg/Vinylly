import type { ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  level?: 'h1' | 'h2';
}

export function PageHeader({ title, subtitle, actions, level = 'h2' }: PageHeaderProps) {
  const Tag = level;

  return (
    <header className="mb-12 flex items-start justify-between gap-4">
      <div>
        <Tag className="mb-1">{title}</Tag>
        {subtitle ? (
          <p className="text-fg-body max-w-prose text-base leading-relaxed">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
