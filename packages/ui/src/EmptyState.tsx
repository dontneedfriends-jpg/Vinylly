import type { ReactNode } from 'react';
import { Card } from './Card';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <Card className="px-12 py-16">
      <div className="flex flex-col items-center gap-5 text-center">
        {icon ? (
          <div
            aria-hidden
            className="bg-surface border-border-default text-fg-body-subtle shadow-neu-inset flex h-16 w-16 items-center justify-center rounded-full border"
          >
            {icon}
          </div>
        ) : (
          <div
            aria-hidden
            className="bg-surface border-border-default text-fg-body-subtle shadow-neu-inset flex h-16 w-16 items-center justify-center rounded-full border"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              className="h-7 w-7"
            >
              <path d="M6 4h12v16H6z" strokeLinejoin="round" />
              <path d="M6 8h12M6 12h12M6 16h12" strokeLinecap="round" />
            </svg>
          </div>
        )}
        <div>
          <h3 className="mb-1.5">{title}</h3>
          {description ? (
            <p className="text-fg-body-subtle mx-auto max-w-md text-sm leading-relaxed">
              {description}
            </p>
          ) : null}
        </div>
        {action}
      </div>
    </Card>
  );
}
