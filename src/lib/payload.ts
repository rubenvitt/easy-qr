import type { QrPayload } from './types';

function escapeWifi(s: string): string {
  return s.replace(/([\\;,:"])/g, '\\$1');
}

function encodeWifi(v: Extract<QrPayload, { kind: 'wifi' }>['value']): string {
  const s = escapeWifi(v.ssid);
  const p = escapeWifi(v.password);
  const h = v.hidden ? 'true' : 'false';
  return `WIFI:T:${v.encryption};S:${s};P:${p};H:${h};;`;
}

export function payloadToQrString(p: QrPayload): string {
  if (p.kind === 'url') return p.value;
  if (p.kind === 'tel') return `tel:${p.value}`;
  if (p.kind === 'text') return p.value;
  if (p.kind === 'wifi') return encodeWifi(p.value);
  throw new Error(`Unsupported kind: ${(p as { kind: string }).kind}`);
}
