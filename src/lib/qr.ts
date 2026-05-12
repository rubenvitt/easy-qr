import QRCode from 'qrcode';

export const QR_MAX_LENGTH = 1273;

export async function payloadToSvg(text: string): Promise<string> {
  if (!text) throw new Error('QR text must not be empty');
  if (text.length > QR_MAX_LENGTH) throw new Error(`QR text exceeds ${QR_MAX_LENGTH} characters`);
  return QRCode.toString(text, {
    type: 'svg',
    errorCorrectionLevel: 'H',
    margin: 4,
    color: { dark: '#000000', light: '#ffffff' }
  });
}
