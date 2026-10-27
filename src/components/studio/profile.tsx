"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, Image as ImageIcon, Pencil, Plus, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { uploadImage } from "@/lib/image-upload";
import { parseMoneyInput } from "@/lib/money";
import { dayLabel, fmt, initials } from "./format";
import { studioNavigate } from "./routing";
import type { BusinessProfile, Expense } from "./types";
import { PageHeader } from "./ui";

export type ProfileProps = {
  today: string;
  businessLogo?: string;
  ownerName?: string;
  businessName?: string;
  onOwnerNameChange: (name: string) => void;
  onBusinessNameChange: (name: string) => void;
  onLogoChange: (logo?: string) => void;
  onSaveProfile: (profile: BusinessProfile) => Promise<void>;
  onSettings: () => void;
  onSummary: () => void;
  revenue: number;
  delivered: number;
  expenses: Expense[];
  onAddExpense: (expense: Expense) => Promise<void>;
};

export function Profile({
  today,
  businessLogo,
  ownerName,
  businessName,
  onSettings,
  onSummary,
  revenue,
  delivered,
  expenses,
  onAddExpense,
  onSaveProfile,
}: ProfileProps) {
  const [isEditingRoute, setIsEditingRoute] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [expenseError, setExpenseError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const totalExpenses = expenses.reduce(
    (sum, expense) => sum + expense.amount,
    0,
  );
  const displayBusinessName = businessName?.trim() || "Your business";
  const displayOwnerName = ownerName?.trim() || "Add your name";
  const logoStyle = businessLogo
    ? {
        backgroundImage: `url(${businessLogo})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : undefined;
  useEffect(() => {
    const syncRoute = () =>
      setIsEditingRoute(window.location.pathname === "/profile/edit");
    const frame = window.requestAnimationFrame(syncRoute);
    window.addEventListener("popstate", syncRoute);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("popstate", syncRoute);
    };
  }, []);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;
    const cleanLabel = label.trim();
    const numericAmount = parseMoneyInput(amount);
    if (!cleanLabel || numericAmount === null || numericAmount <= 0 || !date) {
      setExpenseError("Enter a valid amount, such as 5,000.");
      return;
    }
    setExpenseError("");
    setIsSaving(true);
    await onAddExpense({
      id: `e${Date.now()}`,
      label: cleanLabel,
      amount: numericAmount,
      date,
    });
    setLabel("");
    setAmount("");
    setDate(today);
    setShowForm(false);
    setIsSaving(false);
  };
  if (isEditingRoute)
    return (
      <ProfileEditor
        businessLogo={businessLogo}
        ownerName={ownerName}
        businessName={businessName}
        onSaveProfile={onSaveProfile}
        onCancel={() => studioNavigate("/profile")}
      />
    );
  return (
    <>
      <PageHeader
        title="Profile"
        action={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onSettings}
            aria-label="Open settings"
            title="Settings"
          >
            <Settings2 className="h-5 w-5" aria-hidden="true" />
          </Button>
        }
      />
      <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.95fr)]">
        <Card className="lg:col-start-1 lg:row-start-1 ring-0">
          <CardContent className="p-0">
            <button
              type="button"
              onClick={() => studioNavigate("/profile/edit")}
              aria-label="Edit business profile"
              className="block w-full rounded-xl p-5 text-left transition-colors hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-4">
                  <div
                    role="img"
                    aria-label={
                      businessLogo
                        ? "Business image"
                        : "Business image not added"
                    }
                    className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-soft text-brand"
                    style={logoStyle}
                  >
                    {!businessLogo &&
                      (businessName || ownerName ? (
                        <span className="text-xl font-bold">
                          {initials(businessName || ownerName)}
                        </span>
                      ) : (
                        <ImageIcon className="h-7 w-7" aria-hidden="true" />
                      ))}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-500">
                      Business profile
                    </p>
                    <h2 className="mt-1 truncate text-xl font-bold tracking-tight text-stone-950">
                      {displayBusinessName}
                    </h2>
                    <p className="mt-1 truncate text-sm text-stone-600">
                      {displayOwnerName}
                    </p>
                  </div>
                </div>
                <Pencil
                  className="h-4 w-4 shrink-0 text-stone-400"
                  aria-hidden="true"
                />
              </div>
            </button>
          </CardContent>
        </Card>
        <Button
          type="button"
          variant="outline"
          onClick={onSummary}
          aria-label="Open business summary"
          className="order-2 h-full min-h-44 w-full items-start justify-between rounded-xl border-stone-200 bg-white p-5 text-left whitespace-normal hover:bg-mist lg:col-start-2 lg:row-span-2 lg:row-start-1"
        >
          <span className="block min-w-0 flex-1">
            <span className="block text-base font-semibold text-stone-950">
              Business summary
            </span>
            <span className="mt-1 block text-sm leading-5 text-stone-500">
              Review monthly profit, expenses, and the orders that made them.
            </span>
            <span className="mt-4 grid grid-cols-3 gap-2 border-t border-stone-200 pt-3">
              <span>
                <span className="block text-[11px] font-semibold text-stone-500">
                  Revenue
                </span>
                <span className="mt-1 block truncate text-sm font-bold text-stone-950">
                  {fmt(revenue)}
                </span>
              </span>
              <span>
                <span className="block text-[11px] font-semibold text-stone-500">
                  Expenses
                </span>
                <span className="mt-1 block truncate text-sm font-bold text-stone-950">
                  {fmt(totalExpenses)}
                </span>
              </span>
              <span>
                <span className="block text-[11px] font-semibold text-stone-500">
                  Delivered
                </span>
                <span className="mt-1 block text-sm font-bold text-stone-950">
                  {delivered}
                </span>
              </span>
            </span>
          </span>
          <ChevronRight
            className="mt-1 h-5 w-5 shrink-0 text-stone-400"
            aria-hidden="true"
          />
        </Button>
        <Card className="order-3 lg:col-start-1 lg:row-start-2 ring-0">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold">Record an expense</h2>
                <p className="mt-1 text-sm text-stone-500">
                  Materials, transport, packaging, market runs, or labour.
                </p>
              </div>
              <Button
                variant="outline"
                className="shrink-0"
                onClick={() => setShowForm((value) => !value)}
              >
                {showForm ? "Cancel" : "+ Add expense"}
              </Button>
            </div>
            {showForm && (
              <form
                onSubmit={submit}
                className="mt-5 grid gap-3 sm:grid-cols-[1fr_160px_160px_auto] sm:items-end"
              >
                <div>
                  <Label htmlFor="expense-label">What was it for?</Label>
                  <Input
                    id="expense-label"
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                    placeholder="e.g. Market run"
                    className="mt-2"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="expense-amount">Amount</Label>
                  <Input
                    id="expense-amount"
                    value={amount}
                    onChange={(event) => {
                      setAmount(event.target.value);
                      setExpenseError("");
                    }}
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 5,000"
                    className="mt-2"
                    required
                  />
                  {expenseError && (
                    <p role="alert" className="mt-1 text-sm text-rose-800">
                      {expenseError}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="expense-date">Date</Label>
                  <Input
                    id="expense-date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    type="date"
                    className="mt-2"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="bg-stone-950 text-white hover:bg-stone-700"
                >
                  {isSaving ? "Saving…" : "Save expense"}
                </Button>
              </form>
            )}
            {expenses.length > 0 && (
              <div className="mt-5 space-y-2 border-t border-stone-100 pt-4">
                {expenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="flex items-center justify-between gap-4 text-sm"
                  >
                    <span>
                      <span className="block text-stone-600">
                        {expense.label}
                      </span>
                      <span className="block text-xs text-stone-400">
                        {dayLabel(expense.date)}
                      </span>
                    </span>
                    <span className="font-bold text-stone-950">
                      {fmt(expense.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <section
        aria-labelledby="account-actions-heading"
        className="mt-8 border-t border-stone-200 pt-6"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2
              id="account-actions-heading"
              className="text-sm font-semibold text-stone-950"
            >
              Account
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Sign out of this Studio workspace on this device.
            </p>
          </div>
          <SignOutButton />
        </div>
      </section>
    </>
  );
}

export function ProfileEditor({
  businessLogo,
  ownerName,
  businessName,
  onSaveProfile,
  onCancel,
}: {
  businessLogo?: string;
  ownerName?: string;
  businessName?: string;
  onSaveProfile: (profile: BusinessProfile) => Promise<void>;
  onCancel: () => void;
}) {
  const [draftOwnerName, setDraftOwnerName] = useState(ownerName ?? "");
  const [draftBusinessName, setDraftBusinessName] = useState(
    businessName ?? "",
  );
  const [draftLogo, setDraftLogo] = useState(businessLogo);
  const [logoError, setLogoError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const logoStyle = draftLogo
    ? {
        backgroundImage: `url(${draftLogo})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : undefined;
  const handleLogo = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLogoError("Choose an image file for your business logo.");
      input.value = "";
      return;
    }
    if (isUploadingLogo) return;
    setIsUploadingLogo(true);
    setLogoError("");
    try {
      setDraftLogo(await uploadImage(file, "logos"));
    } catch (uploadError) {
      setLogoError(
        uploadError instanceof Error
          ? uploadError.message
          : "The image upload failed. Try again.",
      );
    } finally {
      setIsUploadingLogo(false);
      input.value = "";
    }
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving || isUploadingLogo) return;
    setIsSaving(true);
    setLogoError("");
    try {
      await onSaveProfile({
        logo: draftLogo,
        ownerName: draftOwnerName,
        businessName: draftBusinessName,
      });
      onCancel();
    } catch (saveError) {
      setLogoError(
        saveError instanceof Error
          ? saveError.message
          : "Your profile could not be saved.",
      );
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="Profile"
        title="Edit profile"
        action={
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            className="gap-2 text-stone-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Profile
          </Button>
        }
      />
      <form onSubmit={submit} className="max-w-2xl space-y-6">
        <Card className="ring-0">
          <CardContent className="space-y-5 p-5">
            <div>
              <h2 className="text-lg font-semibold text-stone-950">
                Business identity
              </h2>
              <p className="mt-1 text-sm leading-5 text-stone-500">
                Update the name and image people will see for this workspace.
              </p>
            </div>
            <div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                aria-hidden="true"
                tabIndex={-1}
                className="sr-only"
                onChange={handleLogo}
                disabled={isUploadingLogo}
              />
              <Button
                type="button"
                variant="outline"
                aria-label={draftLogo ? "Change business image" : "Add business image"}
                onClick={() => logoInputRef.current?.click()}
                disabled={isUploadingLogo}
                className="h-auto min-h-24 w-full justify-start gap-4 whitespace-normal rounded-xl border-dashed border-stone-200 bg-stone-50 p-4 text-left hover:border-teal-300 hover:bg-brand-soft"
              >
                <div
                  role="img"
                  aria-label={
                    draftLogo
                      ? "Business logo preview"
                      : "No business logo selected"
                  }
                  className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-brand-soft text-brand"
                  style={logoStyle}
                >
                  {!draftLogo && (
                    <ImageIcon className="h-7 w-7" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-stone-950">
                    Business image
                  </p>
                  <p className="mt-1 text-sm leading-5 text-stone-500">
                    Optional. Studio compresses the image before uploading it.
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-brand">
                    {isUploadingLogo
                      ? "Uploading…"
                      : draftLogo
                        ? "Change image"
                        : "Add image"}
                    <Plus className="h-4 w-4" aria-hidden="true" />
                  </span>
                </div>
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="business-name">Business name</Label>
                <Input
                  id="business-name"
                  value={draftBusinessName}
                  onChange={(event) => setDraftBusinessName(event.target.value)}
                  placeholder="e.g. Studio by Jutin"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="owner-name">Your name</Label>
                <Input
                  id="owner-name"
                  value={draftOwnerName}
                  onChange={(event) => setDraftOwnerName(event.target.value)}
                  placeholder="Your name"
                  className="mt-2"
                />
              </div>
            </div>
            {logoError && (
              <p
                role="alert"
                className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800"
              >
                {logoError}
              </p>
            )}
          </CardContent>
        </Card>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSaving || isUploadingLogo}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSaving || isUploadingLogo}
            className="bg-stone-950 text-white hover:bg-stone-700"
          >
            {isSaving ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </form>
    </>
  );
}
