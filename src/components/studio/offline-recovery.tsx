"use client";

import { useEffect, useState } from "react";
import { Download, HardDrive, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import StudioApp from "./studio-app";
import { storageKeyPrefix } from "./routing";
import type { StoredStudioState } from "./types";

type CacheEntry = {
  id: string;
  state: StoredStudioState;
};

function readLocalCopies(): CacheEntry[] {
  const entries: CacheEntry[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key?.startsWith(`${storageKeyPrefix}:`)) continue;
    try {
      const value = JSON.parse(window.localStorage.getItem(key) ?? "null") as StoredStudioState | null;
      if (!value || typeof value !== "object") continue;
      entries.push({ id: key.slice(`${storageKeyPrefix}:`.length), state: value });
    } catch {
      // Ignore a damaged cache entry and keep checking the other accounts.
    }
  }
  return entries;
}

function downloadCopy(entry: CacheEntry) {
  const blob = new Blob(
    [JSON.stringify({ exportedAt: new Date().toISOString(), ...entry.state }, null, 2)],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `studio-local-backup-${entry.state.businessProfile?.businessName || entry.state.businessProfile?.ownerName || "account"}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function accountLabel(entry: CacheEntry) {
  return (
    entry.state.businessProfile?.businessName ||
    entry.state.businessProfile?.ownerName ||
    "Studio account"
  );
}

export default function OfflineRecovery() {
  const [entries, setEntries] = useState<CacheEntry[]>([]);
  const [selected, setSelected] = useState<CacheEntry | null>(null);

  useEffect(() => {
    const copies = readLocalCopies();
    setEntries(copies);
    if (copies.length === 1) setSelected(copies[0]);
  }, []);

  if (selected) {
    return (
      <>
        <div className="fixed left-1/2 top-3 z-[120] flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-lg">
          <p>
            You are viewing the copy saved on this device. Cloud sync is paused
            while the database is unavailable.
          </p>
          <Button
            type="button"
            variant="ghost"
            className="shrink-0 text-amber-950 hover:bg-amber-100"
            onClick={() => setSelected(null)}
          >
            Back
          </Button>
        </div>
        <StudioApp
          userId={selected.id}
          initialUserName={selected.state.businessProfile?.ownerName}
        />
      </>
    );
  }

  return (
    <main className="min-h-screen bg-mist px-5 py-10 text-stone-900 sm:px-8">
      <section className="mx-auto max-w-xl rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-brand">
          <HardDrive className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-stone-500">
          Studio recovery
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Your database is temporarily unavailable
        </h1>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          Studio may still have a local copy of your orders and products on
          this device. Open it to keep working offline, or download the copy so
          it can be moved to a new database later.
        </p>

        {entries.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-600">
            No local Studio copy was found on this device. Your Neon snapshot is
            still preserved, but Neon is currently preventing access because
            the project quota has been reached.
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col gap-3 rounded-2xl border border-stone-200 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold">{accountLabel(entry)}</p>
                  <p className="mt-1 text-sm text-stone-500">
                    {entry.state.orders?.length ?? 0} orders · {entry.state.products?.length ?? 0} products
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" onClick={() => setSelected(entry)}>
                    Open copy
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    aria-label={`Download backup for ${accountLabel(entry)}`}
                    onClick={() => downloadCopy(entry)}
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Button
          type="button"
          variant="ghost"
          className="mt-6 w-full"
          onClick={() => {
            setSelected(null);
            setEntries(readLocalCopies());
          }}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Check this device again
        </Button>
      </section>
    </main>
  );
}
