"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadImage } from "@/lib/image-upload";
import { DEFAULT_BRAND_COLOR, RECEIPT_LIMITS } from "@/lib/receipts";

type ReceiptSettings = {
  businessName: string;
  profileLogo: string | null;
  logo: string | null;
  brandColor: string;
  address: string;
  phone: string;
  whatsapp: string;
  instagram: string;
  tiktok: string;
  facebook: string;
  x: string;
};

const colorChoices = ["#B3273A", "#C2761A", "#1F6F5C", "#3B4FB8", "#7A3FA0", "#1D1D1B"];

export function ReceiptSettingsPanel() {
  const [settings, setSettings] = useState<ReceiptSettings | null>(null);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/receipts/settings", { cache: "no-store" })
      .then((response) => response.json().then((payload) => ({ ok: response.ok, payload })))
      .then(({ ok, payload }) => {
        if (!active) return;
        if (ok && payload.settings) setSettings(payload.settings as ReceiptSettings);
        else setLoadError(payload?.error ?? "Receipt settings could not be loaded.");
      })
      .catch(() => active && setLoadError("Receipt settings could not be loaded."));
    return () => {
      active = false;
    };
  }, []);

  const update = (patch: Partial<ReceiptSettings>) => {
    setSettings((current) => (current ? { ...current, ...patch } : current));
    setSaved(false);
  };

  const chooseLogo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setIsUploading(true);
    setError("");
    try {
      update({ logo: await uploadImage(file, "logos") });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "The logo could not be uploaded.");
    } finally {
      setIsUploading(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!settings || isSaving) return;
    setIsSaving(true);
    setError("");
    try {
      const response = await fetch("/api/receipts/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...settings, logo: settings.logo ?? null }),
      });
      const payload = await response.json().catch(() => null) as { settings?: ReceiptSettings; error?: string } | null;
      if (!response.ok || !payload?.settings) throw new Error(payload?.error ?? "Receipt settings could not be saved.");
      setSettings(payload.settings);
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Receipt settings could not be saved.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loadError) return <p role="alert" className="mt-6 max-w-2xl rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">{loadError}</p>;
  if (!settings) return <p className="mt-6 max-w-2xl text-sm text-stone-500">Loading receipt settings…</p>;

  const shownLogo = settings.logo ?? settings.profileLogo;
  const text = (id: string, label: string, key: keyof ReceiptSettings, placeholder: string, maxLength: number) => (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={settings[key] as string} maxLength={maxLength} placeholder={placeholder} onChange={(event) => update({ [key]: event.target.value })} className="mt-2 h-11" />
    </div>
  );

  return (
    <form onSubmit={submit} className="mt-6 max-w-2xl space-y-5">
      <Card className="ring-0">
        <CardContent className="space-y-5 p-5">
          <div>
            <h2 className="text-base font-bold text-stone-950">Receipts</h2>
            <p className="mt-1 text-xs leading-5 text-stone-500">
              How receipts look for {settings.businessName}. Everything below is optional and only shows on the receipt when filled in.
            </p>
          </div>

          <div>
            <Label>Receipt logo</Label>
            <div className="mt-2 flex items-center gap-3">
              {shownLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shownLogo} alt="" className="size-16 rounded-lg border border-stone-200 object-contain" />
              ) : (
                <div className="flex size-16 items-center justify-center rounded-lg border border-dashed border-stone-300 text-xs text-stone-400">No logo</div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor="receipt-logo" className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-stone-200 px-3 text-sm font-medium hover:bg-stone-50">
                  {isUploading ? "Uploading…" : shownLogo ? "Change logo" : "Upload logo"}
                </Label>
                <input id="receipt-logo" type="file" accept="image/*" className="sr-only" onChange={(event) => void chooseLogo(event)} disabled={isUploading} />
                {settings.logo && <Button type="button" variant="ghost" onClick={() => update({ logo: null })}>Use business logo</Button>}
              </div>
            </div>
            <p className="mt-1 text-xs leading-5 text-stone-500">
              {settings.logo ? "This logo is used on receipts only." : settings.profileLogo ? "Using your business logo. Upload a different one for receipts if you like." : "Without a logo, receipts show the first letter of your business name."}
            </p>
          </div>

          <div>
            <Label htmlFor="receipt-color">Brand colour</Label>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {colorChoices.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Use colour ${color}`}
                  aria-pressed={settings.brandColor.toUpperCase() === color}
                  onClick={() => update({ brandColor: color })}
                  className={`size-9 rounded-full border-2 ${settings.brandColor.toUpperCase() === color ? "border-stone-950" : "border-white ring-1 ring-stone-200"}`}
                  style={{ backgroundColor: color }}
                />
              ))}
              <input id="receipt-color" type="color" value={settings.brandColor || DEFAULT_BRAND_COLOR} onChange={(event) => update({ brandColor: event.target.value.toUpperCase() })} className="size-9 cursor-pointer rounded-full border border-stone-200 bg-transparent p-0" aria-label="Pick a custom brand colour" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">{text("receipt-address", "Address", "address", "6A, 5th Avenue, Lekki, Lagos", RECEIPT_LIMITS.address)}</div>
            {text("receipt-phone", "Phone number", "phone", "0802 329 7930", RECEIPT_LIMITS.phone)}
            {text("receipt-whatsapp", "WhatsApp number", "whatsapp", "0802 329 7930", RECEIPT_LIMITS.phone)}
            {text("receipt-instagram", "Instagram", "instagram", "@yourbrand", RECEIPT_LIMITS.handle)}
            {text("receipt-tiktok", "TikTok", "tiktok", "@yourbrand", RECEIPT_LIMITS.handle)}
            {text("receipt-facebook", "Facebook", "facebook", "yourbrand", RECEIPT_LIMITS.handle)}
            {text("receipt-x", "X", "x", "@yourbrand", RECEIPT_LIMITS.handle)}
          </div>
        </CardContent>
      </Card>
      {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">{error}</p>}
      {saved && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">Receipt settings saved.</p>}
      <Button type="submit" disabled={isSaving || isUploading} className="bg-stone-950 text-white hover:bg-stone-700">
        {isSaving ? "Saving…" : "Save receipt settings"}
      </Button>
    </form>
  );
}
