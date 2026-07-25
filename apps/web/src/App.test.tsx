import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from '../src/App';

beforeEach(() => {
  localStorage.setItem('vinylly:discogs-token', 'test-token');
  localStorage.setItem('vinylly:onboarding-done', 'true');
});

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
    await waitFor(
      () => {
        expect(screen.getByRole('heading', { level: 1, name: /Коллекция/i })).toBeInTheDocument();
      },
      { timeout: 4000 },
    );
  });

  it('renders sidebar with all nav items', async () => {
    renderApp();
    const nav = await waitFor(
      () => screen.getByRole('navigation', { name: /Навигация/i }),
      { timeout: 4000 },
    );
    expect(nav).toBeInTheDocument();
    expect(nav.querySelectorAll('button').length).toBeGreaterThanOrEqual(3);
  });

  it('marks the current page in the sidebar', async () => {
    renderApp();
    const active = await waitFor(
      () => screen.getByRole('button', { current: 'page' }),
      { timeout: 4000 },
    );
    expect(active).toBeInTheDocument();
  });
});
