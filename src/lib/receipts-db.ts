import { nairaInWords } from "@/lib/naira-words";
import type { PaymentMethod, ReceiptBranding, ReceiptData } from "@/lib/receipts";

export type ReceiptRow = {
  id: string;
  order_id: string | null;
  number: number;
  received_from: string;
  amount: string | number;
  payment_for: string;
  payment_method: PaymentMethod;
  receipt_date: string;
  branding: ReceiptBranding;
  voided_at: string | Date | null;
  created_at: string | Date;
};

// Selected with to_char so dates stay plain YYYY-MM-DD strings.
export const RECEIPT_COLUMNS = `id, order_id, number, received_from, amount, payment_for, payment_method,
  to_char(receipt_date, 'YYYY-MM-DD') AS receipt_date, branding, voided_at, created_at`;

export function receiptData(row: ReceiptRow): ReceiptData {
  const amount = Number(row.amount);
  return {
    number: row.number,
    date: row.receipt_date,
    receivedFrom: row.received_from,
    amount,
    amountWords: nairaInWords(amount),
    paymentFor: row.payment_for,
    paymentMethod: row.payment_method,
    voided: row.voided_at !== null,
    branding: row.branding,
  };
}

export function serializeReceipt(row: ReceiptRow) {
  return {
    id: row.id,
    orderId: row.order_id,
    number: row.number,
    date: row.receipt_date,
    receivedFrom: row.received_from,
    amount: Number(row.amount),
    paymentFor: row.payment_for,
    paymentMethod: row.payment_method,
    voided: row.voided_at !== null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  };
}
