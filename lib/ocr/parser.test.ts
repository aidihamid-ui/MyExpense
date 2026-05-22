import { describe, expect, it } from 'vitest';
import { parseReceiptText } from './parser';

describe('parseReceiptText', () => {
  it('1. standard TOTAL', () => {
    expect(parseReceiptText('TOTAL RM 12.50').total).toBe(12.5);
  });

  it('2. Malay JUMLAH', () => {
    expect(parseReceiptText('JUMLAH RM 8.00').total).toBe(8.0);
  });

  it('3. no total → null', () => {
    expect(parseReceiptText('Some receipt text without amount').total).toBeNull();
  });

  it('4. multiple amounts → returns largest', () => {
    const text = 'Item A RM 3.00\nItem B RM 4.00\nTOTAL RM 7.00';
    expect(parseReceiptText(text).total).toBe(7.0);
  });

  it('5. date DD/MM/YYYY → YYYY-MM-DD', () => {
    expect(parseReceiptText('Date: 15/06/2024').date).toBe('2024-06-15');
  });

  it('6. date YYYY-MM-DD passthrough', () => {
    expect(parseReceiptText('Date: 2024-06-15').date).toBe('2024-06-15');
  });

  it('7. no date → null', () => {
    expect(parseReceiptText('No date here').date).toBeNull();
  });

  it('8. merchant: clean first line', () => {
    expect(parseReceiptText('MY STORE\nTOTAL RM 5.00').merchant).toBe('MY STORE');
  });

  it('9. merchant: first line is digits, second line is name', () => {
    expect(parseReceiptText('12345\nMY STORE\nTOTAL RM 5.00').merchant).toBe('MY STORE');
  });

  it('10. amount with comma: RM 1,234.56 → 1234.56', () => {
    expect(parseReceiptText('TOTAL RM 1,234.56').total).toBe(1234.56);
  });
});
