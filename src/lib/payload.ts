import type { QrPayload } from './types';

export function payloadToQrString(p: QrPayload): string {
  if (p.kind === 'url') return p.value;
  if (p.kind === 'tel') return `tel:${p.value}`;
  throw new Error(`Unsupported kind: ${(p as { kind: string }).kind}`);
}
