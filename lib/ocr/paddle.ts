import { env } from '@/lib/env';
import type { OcrProvider, OcrResult } from './provider';

export class PaddleOcrProvider implements OcrProvider {
  async extractFromImage(imagePath: string): Promise<OcrResult> {
    if (!env.OCR_SERVICE_URL) {
      throw new Error('OCR_SERVICE_URL is not set');
    }

    let response: Response;
    try {
      response = await fetch(`${env.OCR_SERVICE_URL}/ocr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-OCR-Secret': env.OCR_SECRET ?? '',
        },
        body: JSON.stringify({ path: imagePath }),
      });
    } catch (err) {
      throw new Error(
        `OCR service unreachable: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    if (!response.ok) {
      throw new Error(`OCR service returned ${response.status}`);
    }

    return response.json() as Promise<OcrResult>;
  }
}
