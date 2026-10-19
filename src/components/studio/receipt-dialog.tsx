"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseMoneyInput } from "@/lib/money";
import { formatReceiptNumber, PAYMENT_METHODS, RECEIPT_LIMITS, type PaymentMethod } from "@/lib/receipts";

type ReceiptSummary = {
  id: string;
  number: number;
  date: string;
  amount: number;
  paymentFor: string;
  voided: boolean;
};

type OrderForReceipt = { id: string; customer: string; product: string; total: number };

const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 });
const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

export function ReceiptDialog({ order, close }: { order: OrderForReceipt; close: () => void }) {
  const [receipts, setReceipts] = useState<ReceiptSummary[] | null>(null);
  const [viewing, setViewing] = useState<ReceiptSummary | null>(null);
  const [date, setDate] = useState(today);
  const [receivedFrom, setReceivedFrom] = useState(order.customer);
  const [paymentFor, setPaymentFor] = useState(order.product);
  const [amount, setAmount] = useState(String(order.total));
  const [method, setMethod] = useState<PaymentMethod>("transfer");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/receipts?orderId=${encodeURIComponent(order.id)}`, { cache: "no-store" })
      .then((response) => response.json().catch(() => null).then((payload: { receipts?: ReceiptSummary[]; error?: string } | null) => ({ ok: response.ok, payload })))
      .then(({ ok, payload }) => {
        if (!active) return;
        if (ok && payload?.receipts) {
          setReceipts(payload.receipts);
        } else {
          setReceipts([]);
          setError(payload?.error ?? "Receipts could not be loaded.");
        }
      })
      .catch(() => {
        if (!active) return;
        setReceipts([]);
        setError("Receipts could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, [order.id]);

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isBusy) return;
    const parsedAmount = parseMoneyInput(amount);
    if (!receivedFrom.trim() || !paymentFor.trim() || parsedAmount === null || parsedAmount <= 0) {
      setError("Add who paid, what it's for, and an amount greater than zero.");
      return;
    }
    setIsBusy(true);
    setError("");
    try {
      const response = await fetch("/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, receivedFrom, paymentFor, amount: parsedAmount, paymentMethod: method, date }),
      });
      const payload = await response.json().catch(() => null) as { receipt?: ReceiptSummary; error?: string } | null;
      if (!response.ok || !payload?.receipt) throw new Error(payload?.error ?? "The receipt could not be created.");
      setReceipts((current) => [payload.receipt as ReceiptSummary, ...(current ?? [])]);
      setViewing(payload.receipt);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "The receipt could not be created.");
    } finally {
      setIsBusy(false);
    }
  };

  const voidReceipt = async (receipt: ReceiptSummary) => {
    setIsBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/receipts/${encodeURIComponent(receipt.id)}/void`, { method: "POST" });
      const payload = await response.json().catch(() => null) as { receipt?: ReceiptSummary; error?: string } | null;
      if (!response.ok || !payload?.receipt) throw new Error(payload?.error ?? "The receipt could not be voided.");
      const updated = payload.receipt;
      setReceipts((current) => (current ?? []).map((item) => (item.id === updated.id ? updated : item)));
      setViewing(updated);
      setConfirmVoid(false);
    } catch (voidError) {
      setError(voidError instanceof Error ? voidError.message : "The receipt could not be voided.");
    } finally {
      setIsBusy(false);
    }
  };

  const share = async (receipt: ReceiptSummary) => {
    setNotice("");
    setError("");
    try {
      const response = await fetch(`/api/receipts/${encodeURIComponent(receipt.id)}/image`, { cache: "no-store" });
      if (!response.ok) throw new Error("The receipt image could not be loaded.");
      const file = new File([await response.blob()], `receipt-${formatReceiptNumber(receipt.number)}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Receipt ${formatReceiptNumber(receipt.number)}` });
      } else {
        setNotice("Sharing isn't available in this browser. Use Download instead.");
      }
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") return;
      setError(shareError instanceof Error ? shareError.message : "The receipt could not be shared.");
    }
  };

  const imageUrl = (receipt: ReceiptSummary, download = false) => `/api/receipts/${encodeURIComponent(receipt.id)}/image${download ? "?download=1" : ""}`;

  return (
    <Dialog open onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent className="max-w-2xl">
        <DialogTitle className="text-lg font-bold text-stone-950">{viewing ? `Receipt ${formatReceiptNumber(viewing.number)}` : "Create receipt"}</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-stone-500">
          {viewing ? (viewing.voided ? "This receipt is voided." : "Ready to send. Issued receipts can't be edited.") : `For ${order.customer} · ${order.product}`}
        </DialogDescription>

        {viewing ? (
          <div className="mt-4 space-y-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl(viewing)} alt={`Receipt ${formatReceiptNumber(viewing.number)}`} className="w-full rounded-lg border border-stone-200" />
            {notice && <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">{notice}</p>}
            {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => { setViewing(null); setConfirmVoid(false); setError(""); setNotice(""); }}>Back</Button>
              <a href={imageUrl(viewing, true)} download className="inline-flex h-9 items-center rounded-lg border border-stone-200 px-3 text-sm font-medium hover:bg-stone-50">Download</a>
              <Button type="button" onClick={() => void share(viewing)} className="bg-stone-950 text-white hover:bg-stone-700">Share</Button>
              {!viewing.voided && !confirmVoid && <Button type="button" variant="outline" onClick={() => setConfirmVoid(true)} className="text-rose-700 hover:bg-rose-50">Void</Button>}
            </div>
            {confirmVoid && (
              <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-900">
                <p>Void receipt {formatReceiptNumber(viewing.number)}? Its number stays on record and it will be marked VOID. Create a new receipt if payment details were wrong.</p>
                <div className="mt-3 flex gap-2">
                  <Button type="button" disabled={isBusy} onClick={() => void voidReceipt(viewing)} className="bg-rose-700 text-white hover:bg-rose-800">{isBusy ? "Voiding…" : "Void receipt"}</Button>
                  <Button type="button" variant="outline" onClick={() => setConfirmVoid(false)}>Keep it</Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {receipts && receipts.length > 0 && (
              <div className="mt-4 rounded-lg border border-stone-200">
                <p className="border-b border-stone-200 px-3 py-2 text-xs font-semibold text-stone-500">Receipts for this order</p>
                {receipts.map((receipt) => (
                  <button key={receipt.id} type="button" onClick={() => setViewing(receipt)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-stone-50">
                    <span className="font-medium text-stone-900">{formatReceiptNumber(receipt.number)}{receipt.voided && <span className="ml-2 text-xs font-semibold text-rose-700">VOID</span>}</span>
                    <span className="text-stone-500">{naira.format(receipt.amount)}</span>
                  </button>
                ))}
              </div>
            )}
            <form onSubmit={create} className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="receipt-date">Date</Label>
                  <Input id="receipt-date" type="date" required value={date} onChange={(event) => setDate(event.target.value)} className="mt-2 h-11" />
                </div>
                <div>
                  <Label htmlFor="receipt-amount">Amount received (₦)</Label>
                  <Input id="receipt-amount" inputMode="decimal" required value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-2 h-11" />
                </div>
              </div>
              <div>
                <Label htmlFor="receipt-from">Received from</Label>
                <Input id="receipt-from" required maxLength={RECEIPT_LIMITS.receivedFrom} value={receivedFrom} onChange={(event) => setReceivedFrom(event.target.value)} className="mt-2 h-11" />
              </div>
              <div>
                <Label htmlFor="receipt-for">Being payment for</Label>
                <Input id="receipt-for" required maxLength={RECEIPT_LIMITS.paymentFor} value={paymentFor} onChange={(event) => setPaymentFor(event.target.value)} placeholder="e.g. Ankara gown, head tie" className="mt-2 h-11" />
                <p className="mt-1 text-xs text-stone-500">Paying for more than one thing? List them here, separated by commas.</p>
              </div>
              <div>
                <Label htmlFor="receipt-method">Payment method</Label>
                <select id="receipt-method" value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)} className="mt-2 h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {PAYMENT_METHODS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </div>
              {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">{error}</p>}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={close}>Close</Button>
                <Button type="submit" disabled={isBusy || receipts === null} className="bg-stone-950 text-white hover:bg-stone-700">{isBusy ? "Creating…" : "Generate receipt"}</Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
