"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ReceiptDialog } from "@/components/studio/receipt-dialog";
import { parseMoneyInput } from "@/lib/money";
import { dateKey, dueLabelForDate, fmt, isUuid } from "./format";
import type { Order, Status } from "./types";
import { StatusBadge } from "./ui";

export function OrderDetail({
  order,
  advance,
  onSave,
  onDelete,
  close,
}: {
  order: Order;
  advance: (id: string) => void;
  onSave: (order: Order) => Promise<boolean>;
  onDelete: (order: Order) => Promise<boolean>;
  close: () => void;
}) {
  const nextAction: Partial<Record<Status, string>> = {
    not_started: "Start order",
    in_progress: "Mark ready",
    ready: "Mark delivered",
  };
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [customer, setCustomer] = useState(order.customer);
  const [product, setProduct] = useState(order.product);
  const [amount, setAmount] = useState(String(order.total));
  const [dueDate, setDueDate] = useState(order.dueDate ?? "");
  const [notes, setNotes] = useState(order.notes ?? "");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const syncLabel =
    order.synced === false
      ? "Saved on this device · Sync pending"
      : "Saved to your account";
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextAmount = parseMoneyInput(amount);
    if (
      !customer.trim() ||
      !product.trim() ||
      nextAmount === null ||
      nextAmount <= 0 ||
      !dueDate
    ) {
      setError("Add a customer, product, paid amount, and due date.");
      return;
    }
    setIsSaving(true);
    setError("");
    const saved = await onSave({
      ...order,
      customer: customer.trim(),
      product: product.trim(),
      total: nextAmount,
      dueDate,
      due: dueLabelForDate(dueDate, dateKey(new Date())),
      notes: notes.trim(),
    });
    setIsSaving(false);
    if (saved) setEditing(false);
    else
      setError(
        "The order could not be saved. Check your connection and try again.",
      );
  };
  const remove = async () => {
    setIsDeleting(true);
    setError("");
    try {
      const deleted = await onDelete(order);
      if (!deleted) {
        setError(
          "We couldn't confirm the deletion. Refresh Orders to check its status before trying again.",
        );
      }
    } catch {
      setError(
        "We couldn't confirm the deletion. Refresh Orders to check its status before trying again.",
      );
    } finally {
      setIsDeleting(false);
    }
  };
  return (
    <>
    {showReceipt && (
      <ReceiptDialog
        order={{ id: order.id, customer: order.customer, product: order.product, total: order.total }}
        close={() => setShowReceipt(false)}
      />
    )}
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent>
        <div className="flex items-start justify-between gap-4">
          <div>
            <DialogTitle className="text-xl font-bold text-stone-950">
              {editing ? "Edit order" : order.customer}
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-stone-500">
              {editing
                ? "Correct the details for this paid order."
                : "Paid order details and progress."}
            </DialogDescription>
          </div>
          <DialogClose
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close order details"
              />
            }
          >
            <X />
          </DialogClose>
        </div>
        {editing ? (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <div>
              <Label htmlFor="edit-customer">Customer name</Label>
              <Input
                id="edit-customer"
                maxLength={160}
                value={customer}
                onChange={(event) => setCustomer(event.target.value)}
                className="mt-2 h-11"
              />
            </div>
            <div>
              <Label htmlFor="edit-product">Product</Label>
              <Input
                id="edit-product"
                maxLength={160}
                value={product}
                onChange={(event) => setProduct(event.target.value)}
                className="mt-2 h-11"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="edit-amount">Amount paid</Label>
                <Input
                  id="edit-amount"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  type="text"
                  inputMode="decimal"
                  className="mt-2 h-11"
                />
              </div>
              <div>
                <Label htmlFor="edit-due-date">Due date</Label>
                <Input
                  id="edit-due-date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  type="date"
                  className="mt-2 h-11"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                maxLength={2000}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={3}
                className="mt-2"
              />
            </div>
            {error && (
              <p
                role="alert"
                className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800"
              >
                {error}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-brand text-white hover:bg-teal-800"
              >
                {isSaving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        ) : confirmDelete ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl bg-rose-50 p-4 text-sm leading-6 text-rose-800">
              <p className="font-semibold">Delete this order?</p>
              <p className="mt-1">
                This removes the paid order and its reminders from your account.
                This cannot be undone.
              </p>
            </div>
            {error && (
              <p
                role="alert"
                className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900"
              >
                {error}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setError("");
                  setConfirmDelete(false);
                }}
                disabled={isDeleting}
              >
                Keep order
              </Button>
              <Button
                type="button"
                onClick={() => void remove()}
                disabled={isDeleting}
                className="bg-rose-700 text-white hover:bg-rose-800"
              >
                {isDeleting ? "Deleting…" : "Delete order"}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-5 grid gap-3 rounded-xl bg-stone-50 p-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <span className="text-stone-500">Customer</span>
                <span className="font-semibold text-stone-950">
                  {order.customer}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-stone-500">Product</span>
                <span className="font-semibold text-stone-950">
                  {order.product}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-stone-500">Due</span>
                <span className="font-semibold text-stone-950">
                  {order.due}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-stone-500">Paid</span>
                <span className="font-semibold text-stone-950">
                  {fmt(order.total)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-stone-500">Status</span>
                <StatusBadge status={order.status} />
              </div>
            </div>
            {order.notes && (
              <p className="mt-4 text-sm text-stone-600">{order.notes}</p>
            )}
            <p
              role="status"
              className={`mt-4 rounded-lg px-3 py-2 text-xs font-medium ${order.synced === false ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}
            >
              {syncLabel}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={close}>
                Close
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
              {isUuid(order.id) && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowReceipt(true)}
                >
                  Receipt
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setError("");
                  setConfirmDelete(true);
                }}
                className="text-rose-700 hover:bg-rose-50"
              >
                Delete
              </Button>
              {order.synced === false && (
                <Button
                  type="button"
                  onClick={() => void onSave(order)}
                  className="bg-brand text-white hover:bg-teal-800"
                >
                  Retry sync
                </Button>
              )}
              {order.status !== "delivered" && (
                <Button
                  type="button"
                  onClick={() => {
                    advance(order.id);
                    close();
                  }}
                  className="bg-stone-950 text-white hover:bg-stone-700"
                >
                  {nextAction[order.status]}
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
