import { describe, it, expect } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import QrDisplay from '../../../src/lib/components/QrDisplay.svelte';

describe('QrDisplay', () => {
  it('renders an SVG QR for given text', async () => {
    const { container } = render(QrDisplay, { props: { text: 'https://example.org' } });
    await waitFor(() => {
      expect(container.querySelector('svg')).toBeTruthy();
    });
  });

  it('shows error placeholder when text is empty', async () => {
    const { getByText } = render(QrDisplay, { props: { text: '' } });
    expect(getByText(/eingabe leer/i)).toBeTruthy();
  });
});
