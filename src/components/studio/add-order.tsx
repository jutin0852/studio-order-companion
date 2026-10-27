"use client";

import type { FormEvent } from "react";
import { useRef, useState } from "react";
import { ArrowLeft, CalendarDays, Check, Image as ImageIcon, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { fmt } from "./format";
import type { Message, Product } from "./types";
import { PageHeader } from "./ui";

export function Add({
  dueOptions,
  products,
  selected,
  productId,
  setProductId,
  custom,
  setCustom,
  saveProduct,
  setSaveProduct,
  addOrder,
  message,
  workingDays,
  today,
}: {
  dueOptions: { value: string; label: string }[];
  products: Product[];
  selected?: Product;
  productId: string;
  setProductId: (id: string) => void;
  custom: boolean;
  setCustom: (value: boolean) => void;
  saveProduct: boolean;
  setSaveProduct: (value: boolean) => void;
  addOrder: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  message: Message | null;
  workingDays: number;
  today: string;
}) {
  const [dueOpen, setDueOpen] = useState(false);
  const [useCustomDueDate, setUseCustomDueDate] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const selectedPrice = selected?.price ?? 0;
  const productOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    if (isSaving) {
      event.preventDefault();
      return;
    }
    setIsSaving(true);
    try {
      await addOrder(event);
    } finally {
      setIsSaving(false);
    }
  };
  const focusProduct = (index: number) => {
    const product = products[index];
    if (!product) return;
    setProductId(product.id);
    productOptionRefs.current[index]?.focus();
  };
  const moveProduct = (index: number, direction: number) => {
    const nextIndex = (index + direction + products.length) % products.length;
    focusProduct(nextIndex);
  };
  return (
    <>
      <PageHeader eyebrow="Confirmed orders only" title="Add a paid order" />
      <form onSubmit={submit} className="max-w-2xl space-y-5">
        <section>
          <Label htmlFor="customer">Customer name</Label>
          <Input
            required
            id="customer"
            name="customer"
            maxLength={160}
            placeholder="e.g. Customer name"
            className="mt-2 h-11"
          />
        </section>
        <section>
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label>What did they order?</Label>
              <p className="mt-1 text-xs text-stone-500">
                Pick a product or tap + to add one.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => setCustom(!custom)}
              aria-label={custom ? "Choose from catalog" : "Add product"}
              title={custom ? "Choose from catalog" : "Add product"}
              className="rounded-full border-brand bg-brand text-white hover:border-teal-800 hover:bg-teal-800"
            >
              <span
                className={`transition-transform duration-200 ${custom ? "rotate-0" : ""}`}
              >
                {custom ? <ArrowLeft /> : <Plus />}
              </span>
            </Button>
          </div>
          {custom ? (
            <Card className="mt-3 border-dashed border-teal-300 bg-brand-soft ring-0">
              <CardContent className="p-4">
                <Label htmlFor="customProduct" className="text-xs text-brand">
                  New product name
                </Label>
                <Input
                  required
                  id="customProduct"
                  name="customProduct"
                  placeholder="e.g. Linen co-ord set"
                  className="mt-2 bg-white"
                />
                <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm font-medium text-stone-700">
                  <Checkbox
                    checked={saveProduct}
                    onCheckedChange={(value) => setSaveProduct(value === true)}
                  />
                  Save to my product catalog for next time
                </label>
                <p className="mt-1 ml-6 text-xs text-stone-500">
                  You can add an image later. It is always optional.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div
              role="radiogroup"
              aria-label="Choose a product"
              className="mt-3 grid gap-2 sm:grid-cols-2"
            >
              {products.map((product, index) => (
                <Button
                  type="button"
                  key={product.id}
                  ref={(element) => { productOptionRefs.current[index] = element; }}
                  variant="outline"
                  role="radio"
                  aria-checked={productId === product.id}
                  tabIndex={productId === product.id ? 0 : -1}
                  onClick={() => setProductId(product.id)}
                  onKeyDown={(event) => {
                    if (
                      event.key === "ArrowRight" ||
                      event.key === "ArrowDown"
                    ) {
                      event.preventDefault();
                      moveProduct(index, 1);
                    }
                    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                      event.preventDefault();
                      moveProduct(index, -1);
                    }
                    if (event.key === "Home") {
                      event.preventDefault();
                      focusProduct(0);
                    }
                    if (event.key === "End") {
                      event.preventDefault();
                      focusProduct(products.length - 1);
                    }
                  }}
                  className={`h-auto min-h-16 justify-start gap-3 rounded-xl p-3 text-left ${productId === product.id ? "border-brand bg-brand-soft" : ""}`}
                >
                  <span
                    aria-hidden="true"
                    className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${product.color}`}
                    style={
                      product.image
                        ? {
                            backgroundImage: `url(${product.image})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }
                        : undefined
                    }
                  >
                    {!product.image && (
                      <ImageIcon
                        className="h-4 w-4 text-stone-500/70"
                        aria-hidden="true"
                      />
                    )}
                    {productId === product.id && (
                      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand text-white">
                        <Check className="h-3 w-3" aria-hidden="true" />
                      </span>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">
                      {product.name}
                    </span>
                    <span className="block text-xs text-stone-500">
                      {fmt(product.price)}
                    </span>
                  </span>
                </Button>
              ))}
            </div>
          )}
        </section>
        <section className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="price">Amount paid</Label>
            <Input
              required
              key={custom ? "custom" : (selected?.id ?? "no-product")}
              id="price"
              name="price"
              type="text"
              inputMode="decimal"
              defaultValue={custom ? "" : selectedPrice || ""}
              placeholder={
                selectedPrice ? String(selectedPrice) : "Enter amount paid"
              }
              className="mt-2 h-11"
            />
            <p className="mt-1 text-xs text-stone-500">
              Payment confirmed before recording.
            </p>
          </div>
          <div className={dueOpen ? "pb-24 sm:pb-0" : ""}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <Label htmlFor={useCustomDueDate ? "custom-due-date" : "due"}>
                Due date
              </Label>
              <span className="text-xs text-stone-500">
                Default: {workingDays} working days
              </span>
            </div>
            {useCustomDueDate ? (
              <div>
                <Input
                  required
                  id="custom-due-date"
                  name="customDueDate"
                  type="date"
                  min={today}
                  className="h-11"
                />
                <p className="mt-1 text-xs text-stone-500">
                  Set an earlier date for an express or specially scheduled order.
                </p>
                <Button
                  type="button"
                  variant="link"
                  onClick={() => setUseCustomDueDate(false)}
                  className="mt-1 h-11 justify-start px-0 text-brand"
                >
                  <CalendarDays aria-hidden="true" />
                  Use suggested dates
                </Button>
              </div>
            ) : (
              <>
                <Select
                  name="due"
                  items={dueOptions}
                  defaultValue={dueOptions[0]?.value}
                  open={dueOpen}
                  onOpenChange={setDueOpen}
                >
                  <SelectTrigger id="due" className="h-11 w-full">
                    <SelectValue placeholder="Choose a due date" />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {dueOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="link"
                  onClick={() => setUseCustomDueDate(true)}
                  className="mt-1 h-11 justify-start px-0 text-brand"
                >
                  <CalendarDays aria-hidden="true" />
                  Choose a specific date
                </Button>
              </>
            )}
          </div>
        </section>
        <section>
          <Label htmlFor="notes">
            Notes <span className="font-normal text-stone-400">(optional)</span>
          </Label>
          <Textarea
            id="notes"
            name="notes"
            maxLength={2000}
            rows={3}
            placeholder="Colour, size, delivery details, or anything useful."
            className="mt-2"
          />
        </section>
        {message && (
          <p
            role={message.type === "error" ? "alert" : "status"}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${message.type === "error" ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800"}`}
          >
            {message.text}
          </p>
        )}
        <div className="order-save">
          <Button
            type="submit"
            disabled={isSaving}
            className="h-11 w-full bg-brand text-white hover:bg-teal-800"
          >
            {isSaving ? "Saving…" : "Save Order"}
          </Button>
        </div>
      </form>
    </>
  );
}
