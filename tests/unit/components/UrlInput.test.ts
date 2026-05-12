import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import UrlInput from '../../../src/lib/components/UrlInput.svelte';

describe('UrlInput', () => {
  it('emits input changes via onChange', async () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(UrlInput, { props: { value: '', onChange } });
    await fireEvent.input(getByLabelText(/url/i), { target: { value: 'https://x' } });
    expect(onChange).toHaveBeenCalledWith('https://x');
  });

  it('warns when over max length', async () => {
    const { getByText } = render(UrlInput, {
      props: { value: 'a'.repeat(2954), onChange: () => {} }
    });
    expect(getByText(/zu lang/i)).toBeTruthy();
  });
});
