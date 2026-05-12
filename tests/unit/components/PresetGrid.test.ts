import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PresetGrid from '../../../src/lib/components/PresetGrid.svelte';
import type { Preset } from '../../../src/lib/types';

const presets: Preset[] = [
  { id: 'a', label: 'Aktuelle Lage', icon: '📍', kind: 'url', value: 'https://x' },
  { id: 'b', label: 'Helfer', icon: '🙋', kind: 'url', value: 'https://y' }
];

describe('PresetGrid', () => {
  it('renders one button per preset', () => {
    const { getByText } = render(PresetGrid, { props: { presets, onSelect: () => {} } });
    expect(getByText('Aktuelle Lage')).toBeTruthy();
    expect(getByText('Helfer')).toBeTruthy();
  });

  it('invokes onSelect with preset on tap', async () => {
    const onSelect = vi.fn();
    const { getByText } = render(PresetGrid, { props: { presets, onSelect } });
    await fireEvent.click(getByText('Helfer'));
    expect(onSelect).toHaveBeenCalledWith(presets[1]);
  });
});
