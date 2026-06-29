import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, CardBody, CardHeader, CardFooter } from '../src/Card';

describe('Card', () => {
  it('renders with neumorphic surface', () => {
    const { container } = render(
      <Card>
        <CardBody>X</CardBody>
      </Card>,
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).toMatch(/bg-surface/);
    expect(card.className).toMatch(/shadow-neu-md/);
  });

  it('renders header/footer/body slots', () => {
    render(
      <Card>
        <CardHeader>H</CardHeader>
        <CardBody>B</CardBody>
        <CardFooter>F</CardFooter>
      </Card>,
    );
    expect(screen.getByText('H')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('F')).toBeInTheDocument();
  });
});
