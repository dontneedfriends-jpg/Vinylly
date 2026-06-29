import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../src/Button';

describe('Button', () => {
  it('renders text', () => {
    render(<Button>Найти</Button>);
    expect(screen.getByRole('button', { name: 'Найти' })).toBeInTheDocument();
  });

  it('respects disabled prop', () => {
    render(<Button disabled>Найти</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('applies variant text color', () => {
    const { container } = render(<Button variant="brand">X</Button>);
    const btn = container.querySelector('button');
    expect(btn?.className).toMatch(/text-fg-brand/);
  });
});
