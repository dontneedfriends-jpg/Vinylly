import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Skeleton, SkeletonCard, EmptyState } from '../src';

describe('Skeleton', () => {
  it('renders with role=status', () => {
    render(<Skeleton />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
  it('SkeletonCard renders three placeholders', () => {
    const { container } = render(<SkeletonCard />);
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(3);
  });
});

describe('EmptyState', () => {
  it('renders title, description and action', () => {
    render(
      <EmptyState
        title="Пусто"
        description="Добавьте первый релиз"
        action={<button>Добавить</button>}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Пусто' })).toBeInTheDocument();
    expect(screen.getByText('Добавьте первый релиз')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Добавить' })).toBeInTheDocument();
  });
});
