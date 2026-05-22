export interface OcrResult {
  text: string;
  lines: string[];
}

export interface OcrProvider {
  extractFromImage(imagePath: string): Promise<OcrResult>;
}
