export type QrPayload =
  | { kind: 'url'; value: string }
  | {
      kind: 'wifi';
      value: {
        ssid: string;
        password: string;
        encryption: 'WPA' | 'WEP' | 'nopass';
        hidden?: boolean;
      };
    }
  | { kind: 'tel'; value: string }
  | {
      kind: 'vcard';
      value: { name: string; tel?: string; email?: string; org?: string };
    }
  | { kind: 'text'; value: string };

export type QrKind = QrPayload['kind'];

export interface Preset {
  id: string;
  label: string;
  icon?: string;
  kind: QrKind;
  value: Extract<QrPayload, { kind: QrKind }>['value'];
}

export interface HistoryEntry {
  id: string;
  label: string;
  payload: QrPayload;
  createdAt: number;
}
