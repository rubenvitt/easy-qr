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

function encodeVcard(v: Extract<QrPayload, { kind: 'vcard' }>['value']): string {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${v.name}`];
  if (v.tel) lines.push(`TEL:${v.tel}`);
  if (v.email) lines.push(`EMAIL:${v.email}`);
  if (v.org) lines.push(`ORG:${v.org}`);
  lines.push('END:VCARD');
  return lines.join('\n');
}

export function payloadToQrString(p: QrPayload): string {
  if (p.kind === 'url') return p.value;
  if (p.kind === 'tel') return `tel:${p.value}`;
  if (p.kind === 'text') return p.value;
  if (p.kind === 'wifi') return encodeWifi(p.value);
  if (p.kind === 'vcard') return encodeVcard(p.value);
  throw new Error(`Unsupported kind: ${(p as { kind: string }).kind}`);
}
