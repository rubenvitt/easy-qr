import { describe, it, expect } from 'vitest';
import { payloadToSvg } from '../../src/lib/qr';

describe('payloadToSvg', () => {
  it('returns an SVG string', async () => {
    const svg = await payloadToSvg('hello');
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('</svg>');
  });

  it('renders pure black on white', async () => {
    const svg = await payloadToSvg('hello');
    expect(svg).toContain('#000000');
    expect(svg).toContain('#ffffff');
  });

  it('rejects empty input', async () => {
    await expect(payloadToSvg('')).rejects.toThrow();
  });

  it('rejects input longer than 2953 characters', async () => {
    await expect(payloadToSvg('a'.repeat(2954))).rejects.toThrow();
  });
});
