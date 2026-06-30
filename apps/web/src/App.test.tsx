import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from '../src/App';

function renderApp() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <App />
    </QueryClientProvider>,
  );
}

describe('App', () => {
  it('renders collection page after init', async () => {
    renderApp();
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: /Коллекция/i })).toBeInTheDocument();
    });
  });

  it('renders sidebar with all nav items', async () => {
    renderApp();
    const nav = screen.getByRole('navigation', { name: /Главная навигация/i });
    expect(nav).toBeInTheDocument();
    expect(
      nav.querySelectorAll('button[aria-label], button:not([aria-label])').length,
    ).toBeGreaterThanOrEqual(3);
  });

  it('marks the current page in the sidebar', async () => {
    renderApp();
    await waitFor(() => {
      const active = screen.getByRole('button', { current: 'page' });
      expect(active).toBeInTheDocument();
    });
  });
});
