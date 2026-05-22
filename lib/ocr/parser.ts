export type ParsedReceipt = {
  total: number | null;
  date: string | null;
  merchant: string | null;
};

export function parseReceiptText(rawText: string): ParsedReceipt {
  return {
    total: parseTotal(rawText),
    date: parseDate(rawText),
    merchant: parseMerchant(rawText),
  };
}

function parseTotal(text: string): number | null {
  const amounts: number[] = [];

  // Primary: keyword-triggered amount (GRAND TOTAL before TOTAL to avoid partial match)
  const keywordRe =
    /(?:GRAND\s+TOTAL|TOTAL|JUMLAH|AMAUN|AMOUNT)[^0-9]*(?:RM\s*)?([\d,]+\.\d{2})/gi;
  let m: RegExpExecArray | null;
  while ((m = keywordRe.exec(text)) !== null) {
    const v = parseFloat(m[1].replace(/,/g, ''));
    if (!isNaN(v)) amounts.push(v);
  }

  // Fallback: any RM-prefixed amount
  const rmRe = /RM\s*([\d,]+\.\d{2})/gi;
  while ((m = rmRe.exec(text)) !== null) {
    const v = parseFloat(m[1].replace(/,/g, ''));
    if (!isNaN(v)) amounts.push(v);
  }

  return amounts.length > 0 ? Math.max(...amounts) : null;
}

function parseDate(text: string): string | null {
  const pad = (n: number) => String(n).padStart(2, '0');

  // DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
  const dmyRe = /(\d{2})[/\-.](\d{2})[/\-.](\d{4})/g;
  let m: RegExpExecArray | null;
  while ((m = dmyRe.exec(text)) !== null) {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    const year = parseInt(m[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${pad(month)}-${pad(day)}`;
    }
  }

  // YYYY-MM-DD
  const isoRe = /(\d{4})-(\d{2})-(\d{2})/g;
  while ((m = isoRe.exec(text)) !== null) {
    const year = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    const day = parseInt(m[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${pad(month)}-${pad(day)}`;
    }
  }

  return null;
}

const MERCHANT_SKIP_PREFIXES = ['TEL', 'NO ', 'REG', 'GST', 'SST'];

function parseMerchant(text: string): string | null {
  const lines = text.split('\n');
  let tried = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    tried++;
    if (tried > 3) break;

    if (/^\d+$/.test(trimmed)) continue;

    const upper = trimmed.toUpperCase();
    if (MERCHANT_SKIP_PREFIXES.some((p) => upper.startsWith(p))) continue;

    return trimmed.slice(0, 80);
  }

  return null;
}
