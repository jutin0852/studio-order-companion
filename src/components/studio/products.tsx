"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { Archive, ArchiveRestore, ArrowLeft, Image as ImageIcon, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { uploadImage } from "@/lib/image-upload";
import { parseMoneyInput } from "@/lib/money";
import { fmt } from "./format";
import type { Product } from "./types";
import { PageHeader } from "./ui";

export function ProductCatalog({
  products,
  goAdd,
  onEdit,
  onToggleArchive,
  onDelete,
}: {
  products: Product[];
  goAdd: () => void;
  onEdit: (product: Product) => void;
  onToggleArchive: (id: string) => void;
  onDelete: (id: string) => Promise<boolean>;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"active" | "archived">("active");
  const [deleteCandidate, setDeleteCandidate] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const normalizedQuery = query.trim().toLowerCase();
  const activeCount = products.filter((product) => !product.archived).length;
  const archivedCount = products.length - activeCount;
  const visibleProducts = products
    .filter((product) =>
      filter === "archived" ? product.archived : !product.archived,
    )
    .filter(
      (product) =>
        !normalizedQuery ||
        product.name.toLowerCase().includes(normalizedQuery),
    );
  const filterLabel =
    filter === "active" ? "active products" : "archived products";
  return (
    <>
      <PageHeader
        title="Products"
        action={
          <Button
            onClick={goAdd}
            variant="outline"
            size="icon-lg"
            aria-label="Add a new product"
            title="Add a new product"
            className="rounded-full border-brand bg-brand text-white hover:border-teal-800 hover:bg-teal-800"
          >
            <Plus />
          </Button>
        }
      />
      <p className="max-w-xl text-sm text-stone-500">
        Save products you sell regularly so a new paid order takes only a few
        Keep product names and prices ready for faster order entry. Images are
        optional.
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products"
            aria-label="Search products"
            className="h-11 pl-9"
          />
        </div>
        <Tabs
          value={filter}
          onValueChange={(value) => setFilter(value as "active" | "archived")}
        >
          <TabsList className="w-full rounded-lg bg-muted p-1 sm:w-auto">
            <TabsTrigger
              value="active"
              className="flex-1 rounded-md px-3 sm:flex-none"
            >
              Active{" "}
              <span className="ml-1 text-xs text-stone-500">{activeCount}</span>
            </TabsTrigger>
            <TabsTrigger
              value="archived"
              className="flex-1 rounded-md px-3 sm:flex-none"
            >
              Archived{" "}
              <span className="ml-1 text-xs text-stone-500">
                {archivedCount}
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="mt-5 flex items-center justify-between gap-3 text-xs text-stone-500">
        <p>
          {visibleProducts.length} {filterLabel}
          {normalizedQuery ? ` matching “${query.trim()}”` : ""}
        </p>
        {filter === "active" && <p>Shown when recording an order</p>}
      </div>
      {visibleProducts.length ? (
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {visibleProducts.map((product) => (
            <Card key={product.id} className="overflow-hidden ring-0">
              <CardContent className="p-0">
                <div
                  role="img"
                  aria-label={
                    product.image
                      ? `${product.name} product image`
                      : "No product image uploaded"
                  }
                  className={`relative flex aspect-[4/3] items-center justify-center ${product.color}`}
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
                      className="h-8 w-8 text-stone-500/60"
                      aria-hidden="true"
                    />
                  )}
                  {product.archived && (
                    <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-stone-600">
                      Archived
                    </span>
                  )}
                </div>
                <div className="space-y-4 p-4">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-stone-950">
                      {product.name}
                    </h2>
                    <div className="mt-2 text-sm">
                      <p className="text-xs text-stone-500">Price</p>
                      <p className="mt-0.5 font-semibold text-stone-950">
                        {fmt(product.price)}
                      </p>
                    </div>
                    <p className="mt-3 text-xs text-stone-500">
                      {product.image ? "Product image added" : "No image added"}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-stone-100 pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(product)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onToggleArchive(product.id)}
                      aria-label={
                        product.archived
                          ? `Restore ${product.name}`
                          : `Archive ${product.name}`
                      }
                      title={
                        product.archived ? "Restore product" : "Archive product"
                      }
                      className="text-stone-500 hover:bg-brand-soft hover:text-brand"
                    >
                      {product.archived ? <ArchiveRestore /> : <Archive />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDeleteCandidate(product)}
                      aria-label={`Delete ${product.name}`}
                      title="Delete product"
                      className="text-stone-500 hover:bg-rose-50 hover:text-rose-700"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="mt-3 border-dashed ring-0">
          <CardContent className="p-6">
            <p className="font-semibold text-stone-950">
              {normalizedQuery
                ? `No ${filterLabel} match that search.`
                : `No ${filterLabel} yet.`}
            </p>
            <p className="mt-1 max-w-md text-sm leading-5 text-stone-500">
              {normalizedQuery
                ? "Try another product name or clear the search."
                : filter === "active"
                  ? "Add the products you sell regularly so order entry stays quick."
                  : "Archived products stay out of new orders and remain available here for reference."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {normalizedQuery && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setQuery("")}
                >
                  Clear search
                </Button>
              )}
              {filter === "active" && (
                <Button
                  type="button"
                  onClick={goAdd}
                  className="bg-brand text-white hover:bg-teal-800"
                >
                  <Plus className="h-4 w-4" />
                  Add a product
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      <Dialog
        open={Boolean(deleteCandidate)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteCandidate(null);
        }}
      >
        <DialogContent>
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-xl font-bold text-stone-950">
                Delete product?
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm leading-6 text-stone-500">
                {deleteCandidate
                  ? `Remove ${deleteCandidate.name} from your catalog? Existing paid orders will stay in your history.`
                  : ""}
              </DialogDescription>
            </div>
            <DialogClose
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Close delete confirmation"
                  disabled={isDeleting}
                >
                  <X />
                </Button>
              }
            />
          </div>
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteCandidate(null)}
              disabled={isDeleting}
            >
              Keep product
            </Button>
            <Button
              type="button"
              disabled={isDeleting}
              onClick={() => {
                if (!deleteCandidate) return;
                setIsDeleting(true);
                void onDelete(deleteCandidate.id).then((deleted) => {
                  setIsDeleting(false);
                  if (deleted) setDeleteCandidate(null);
                });
              }}
              className="bg-rose-700 text-white hover:bg-rose-800"
            >
              {isDeleting ? "Deleting…" : "Delete product"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ProductEditor({
  initial,
  onCancel,
  onSave,
}: {
  initial?: Product | null;
  onCancel: () => void;
  onSave: (product: Product) => void | Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [price, setPrice] = useState(initial ? String(initial.price) : "");
  const [image, setImage] = useState(initial?.image);
  const [error, setError] = useState("");
  const [imageError, setImageError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const ownedImageRef = useRef<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(
    () => () => {
      if (ownedImageRef.current) URL.revokeObjectURL(ownedImageRef.current);
    },
    [],
  );
  const handleImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setImageError("Choose an image file for this product.");
      input.value = "";
      return;
    }
    if (isUploading) return;
    setIsUploading(true);
    setImageError("");
    try {
      setImage(await uploadImage(file, "products"));
    } catch (uploadError) {
      setImageError(
        uploadError instanceof Error
          ? uploadError.message
          : "The image upload failed. Try again.",
      );
    } finally {
      setIsUploading(false);
      input.value = "";
    }
  };
  const clearImage = () => setImage(undefined);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanName = name.trim();
    const numericPrice = parseMoneyInput(price);
    if (
      !cleanName ||
      numericPrice === null ||
      numericPrice <= 0
    ) {
      setError("Add a product name and a valid price, such as 25,000.");
      return;
    }
    if (isSaving || isUploading) return;
    setIsSaving(true);
    setError("");
    try {
      await onSave({
        id: initial?.id ?? `p${Date.now()}`,
        name: cleanName,
        price: numericPrice,
        color: initial?.color ?? "bg-plaster",
        image,
        archived: initial?.archived,
      });
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "The product could not be saved.",
      );
      setIsSaving(false);
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="Product catalog"
        title={initial ? "Edit product" : "Add a product"}
        action={
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            className="gap-2 text-stone-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to products
          </Button>
        }
      />
      <form onSubmit={submit} className="max-w-2xl space-y-6">
        <Card className="ring-0">
          <CardContent className="space-y-5 p-5">
            <div>
              <Label htmlFor="product-name">Product name</Label>
              <Input
                required
                id="product-name"
                maxLength={160}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setError("");
                }}
                placeholder="e.g. Linen co-ord set"
                className="mt-2 h-11"
              />
            </div>
            <div className="max-w-sm">
              <div>
                <Label htmlFor="product-price">Price</Label>
                <Input
                  required
                  id="product-price"
                  value={price}
                  onChange={(event) => {
                    setPrice(event.target.value);
                    setError("");
                  }}
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 25,000"
                  className="mt-2 h-11"
                />
                <p className="mt-1 text-xs text-stone-500">
                  Used as the default amount when recording an order.
                </p>
              </div>
            </div>
            <div className="relative">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                aria-hidden="true"
                tabIndex={-1}
                className="sr-only"
                onChange={handleImage}
                disabled={isUploading}
              />
              <Button
                type="button"
                variant="outline"
                aria-label={image ? "Change product image" : "Add product image"}
                onClick={() => imageInputRef.current?.click()}
                disabled={isUploading}
                className="h-auto min-h-20 w-full justify-start gap-3 whitespace-normal rounded-xl border-dashed border-stone-200 bg-stone-50 p-4 text-left hover:border-teal-300 hover:bg-brand-soft"
              >
                <div
                  role="img"
                  aria-label={
                    image
                      ? `${name || "Product"} image preview`
                      : "No product image selected"
                  }
                  className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white text-stone-400 ring-1 ring-stone-200"
                  style={
                    image
                      ? {
                          backgroundImage: `url(${image})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }
                      : undefined
                  }
                >
                  {!image && (
                    <ImageIcon className="h-5 w-5" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-stone-800">
                    {isUploading
                      ? "Compressing and uploading…"
                      : image
                        ? "Change product image"
                        : "Add product image"}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-stone-500">
                    Tap to choose a photo. Studio resizes it before sending it
                    to Cloudinary so it loads quickly on phones.
                  </p>
                </div>
              </Button>
              {image && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearImage}
                  disabled={isUploading}
                  className="mt-2 gap-2 px-0 text-stone-500 hover:bg-transparent hover:text-stone-950"
                >
                  <X className="h-4 w-4" />
                  Remove image
                </Button>
              )}
              {imageError && (
                <p
                  role="alert"
                  className="mt-2 text-sm font-medium text-rose-800"
                >
                  {imageError}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800"
          >
            {error}
          </p>
        )}
        <Button
          type="submit"
          disabled={isSaving || isUploading}
          className="w-full bg-brand py-3 text-white hover:bg-teal-800"
        >
          {isSaving
            ? "Saving…"
            : isUploading
              ? "Uploading…"
              : initial
                ? "Save changes"
                : "Save product"}
        </Button>
      </form>
    </>
  );
}
