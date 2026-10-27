import { beforeEach, describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/products/route";
import { DELETE, PATCH } from "@/app/api/products/[id]/route";
import { alice, bob, jsonRequest, readJson, routeParams, signInAs } from "./helpers/session";

type ProductJson = { id: string; name: string; price: number; image?: string; archived?: boolean };

const cloudinary = "https://res.cloudinary.com/demo/image/upload/v1/studio/users/u1/products/a.webp";

async function createProduct(body: Record<string, unknown>) {
  const response = await POST(jsonRequest("/api/products", "POST", body));
  return { response, product: (await readJson<{ product: ProductJson }>(response)).product };
}

describe("products API", () => {
  beforeEach(() => signInAs(alice));

  it("requires sign-in", async () => {
    await signInAs(null);
    expect((await GET()).status).toBe(401);
    expect((await POST(jsonRequest("/api/products", "POST", { name: "x", price: 1 }))).status).toBe(401);
  });

  it("creates, lists and updates a product", async () => {
    const { response, product } = await createProduct({ name: "Linen set", price: 30_000, image: cloudinary });
    expect(response.status).toBe(201);
    expect(product).toMatchObject({ name: "Linen set", price: 30_000, image: cloudinary });

    const list = await readJson<{ products: ProductJson[] }>(await GET());
    expect(list.products.map((item) => item.id)).toContain(product.id);

    const updated = await PATCH(jsonRequest(`/api/products/${product.id}`, "PATCH", { name: "Linen co-ord", price: 32_000, archived: true }), routeParams(product.id));
    expect(await readJson<{ product: ProductJson }>(updated)).toMatchObject({ product: { name: "Linen co-ord", price: 32_000, archived: true } });
  });

  it("only accepts images from this app's Cloudinary account", async () => {
    for (const image of ["https://example.com/a.png", "http://res.cloudinary.com/demo/image/upload/a.png", "https://res.cloudinary.com/other/image/upload/a.png", "javascript:alert(1)"]) {
      const response = await POST(jsonRequest("/api/products", "POST", { name: "Bad image", price: 1, image }));
      expect(response.status, image).toBe(400);
    }
  });

  it("rejects bad names and prices", async () => {
    for (const bad of [{ name: "", price: 10 }, { name: "x".repeat(161), price: 10 }, { name: "Ok", price: 0 }, { name: "Ok", price: "free" }]) {
      expect((await POST(jsonRequest("/api/products", "POST", bad))).status, JSON.stringify(bad)).toBe(400);
    }
    const { product } = await createProduct({ name: "Valid", price: 5 });
    expect((await PATCH(jsonRequest(`/api/products/${product.id}`, "PATCH", { price: -1 }), routeParams(product.id))).status).toBe(400);
    expect((await PATCH(jsonRequest(`/api/products/${product.id}`, "PATCH", { image: "https://example.com/x.png" }), routeParams(product.id))).status).toBe(400);
  });

  it("keeps each business's catalog private", async () => {
    const { product } = await createProduct({ name: "Alice only", price: 100 });

    await signInAs(bob);
    const bobsList = await readJson<{ products: ProductJson[] }>(await GET());
    expect(bobsList.products.map((item) => item.id)).not.toContain(product.id);
    expect((await PATCH(jsonRequest(`/api/products/${product.id}`, "PATCH", { name: "Hijacked" }), routeParams(product.id))).status).toBe(404);
    expect((await DELETE(jsonRequest(`/api/products/${product.id}`, "DELETE"), routeParams(product.id))).status).toBe(404);
  });
});
