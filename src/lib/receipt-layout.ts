import { createElement as h, type CSSProperties, type ReactNode } from "react";
import { formatReceiptNumber, logoForRender, paymentMethodLabel, type ReceiptData } from "./receipts";

export const RECEIPT_WIDTH = 1200;
export const RECEIPT_HEIGHT = 840;
const INK = "#1d1d1b";
const MUTED = "#5f5e5a";

const iconPaths: Record<string, string[]> = {
  pin: ["M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0", "M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z"],
  phone: ["M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2"],
  instagram: ["M4 8a4 4 0 0 1 4 -4h8a4 4 0 0 1 4 4v8a4 4 0 0 1 -4 4h-8a4 4 0 0 1 -4 -4z", "M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0", "M16.5 7.5v.01"],
  tiktok: ["M21 7.917v4.034a9.948 9.948 0 0 1 -5 -1.951v4.5a6.5 6.5 0 1 1 -8 -6.32v4.12a2.5 2.5 0 1 0 4 2v-11.28h3a6.5 6.5 0 0 0 6 5.917"],
  facebook: ["M7 10v4h3v7h4v-7h3l1 -4h-4v-2a1 1 0 0 1 1 -1h3v-4h-3a5 5 0 0 0 -5 5v2h-3"],
  x: ["M4 4l11.733 16h4.267l-11.733 -16z", "M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772"],
  whatsapp: ["M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9", "M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1"],
};

function icon(name: string, color: string) {
  return h(
    "svg",
    { width: 26, height: 26, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", style: { marginRight: 10 } },
    ...iconPaths[name].map((d, index) => h("path", { key: index, d })),
  );
}

// The default renderer font has no naira glyph (U+20A6) and would try to download
// one at request time, so draw the sign instead.
function nairaSign(size: number, color: string) {
  return h(
    "svg",
    { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 2.6, strokeLinecap: "round", strokeLinejoin: "round", style: { marginRight: 6 } },
    h("path", { d: "M6 20V4l12 16V4" }),
    h("path", { d: "M3.5 9.5h17" }),
    h("path", { d: "M3.5 14.5h17" }),
  );
}

const row = (style: CSSProperties, ...children: ReactNode[]) => h("div", { style: { display: "flex", ...style } }, ...children);

function contactLines(data: ReceiptData) {
  const { branding } = data;
  const lines: Array<[string, string]> = [];
  if (branding.address) lines.push(["pin", branding.address]);
  if (branding.phone) lines.push(["phone", branding.phone]);
  if (branding.whatsapp) lines.push(["whatsapp", branding.whatsapp]);
  if (branding.instagram) lines.push(["instagram", `@${branding.instagram}`]);
  if (branding.tiktok) lines.push(["tiktok", `@${branding.tiktok}`]);
  if (branding.facebook) lines.push(["facebook", branding.facebook]);
  if (branding.x) lines.push(["x", `@${branding.x}`]);
  return lines;
}

function field(label: string, value: string) {
  return row(
    { alignItems: "flex-end", marginTop: 22 },
    row({ width: 270, fontSize: 28, fontWeight: 700, color: INK }, label),
    row({ flex: 1, minHeight: 40, borderBottom: `2px solid ${INK}`, fontSize: 30, color: INK, paddingBottom: 4 }, value),
  );
}

export function receiptElement(data: ReceiptData) {
  const { branding } = data;
  const accent = branding.color;
  const logo = logoForRender(branding.logo);
  const contacts = contactLines(data);
  const date = new Date(`${data.date}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  const logoNode = logo
    ? h("img", { src: logo, width: 96, height: 96, style: { objectFit: "contain", marginRight: 20 } })
    : row({ width: 96, height: 96, borderRadius: 48, backgroundColor: accent, color: "#ffffff", fontSize: 44, fontWeight: 700, alignItems: "center", justifyContent: "center", marginRight: 20 }, branding.name.trim().charAt(0).toUpperCase() || "S");

  return h(
    "div",
    { style: { display: "flex", flexDirection: "column", width: RECEIPT_WIDTH, height: RECEIPT_HEIGHT, backgroundColor: "#ffffff", color: INK, fontFamily: "sans-serif", borderTop: `16px solid ${accent}`, padding: "36px 56px 40px", position: "relative" } },
    row(
      { justifyContent: "space-between", alignItems: "flex-start" },
      row({ alignItems: "center", maxWidth: 560 }, logoNode, row({ fontSize: 40, fontWeight: 700, lineHeight: 1.15 }, branding.name)),
      h("div", { style: { display: "flex", flexDirection: "column", alignItems: "flex-end", maxWidth: 520 } }, ...contacts.map(([name, text]) =>
        row({ alignItems: "center", fontSize: 24, color: MUTED, marginBottom: 6, textAlign: "right" }, icon(name, accent), text))),
    ),
    row(
      { alignItems: "baseline", justifyContent: "space-between", marginTop: 26 },
      row({ fontSize: 56, fontWeight: 700 }, "Receipt"),
      row({ fontSize: 30, color: MUTED }, `No. ${formatReceiptNumber(data.number)}`),
      row({ fontSize: 28, fontWeight: 700 }, "Date", row({ marginLeft: 14, fontWeight: 400, borderBottom: `2px solid ${INK}`, padding: "0 18px 2px" }, date)),
    ),
    field("Received from", data.receivedFrom),
    field("The sum of", data.amountWords),
    field("Being payment for", data.paymentFor),
    field("Payment method", paymentMethodLabel(data.paymentMethod)),
    row(
      { justifyContent: "space-between", alignItems: "flex-end", marginTop: "auto" },
      h("div", { style: { display: "flex", flexDirection: "column", width: 340 } }, row({ height: 44, borderBottom: `2px solid ${INK}` }), row({ fontSize: 22, color: MUTED, marginTop: 6 }, "Client signature")),
      h("div", { style: { display: "flex", flexDirection: "column", alignItems: "flex-end" } },
        row({ backgroundColor: `${accent}24`, padding: "14px 34px", borderRadius: 6, fontSize: 40, fontWeight: 700, minWidth: 300, justifyContent: "center", alignItems: "center" },
          nairaSign(40, INK), data.amount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })),
        row({ fontSize: 24, color: MUTED, marginTop: 16 }, "For: ", row({ fontWeight: 700, color: INK, marginLeft: 6 }, branding.name))),
    ),
    data.voided
      ? row({ position: "absolute", top: 330, left: 280, fontSize: 200, fontWeight: 700, color: "#b3273a55", border: "10px solid #b3273a55", padding: "0 40px", transform: "rotate(-14deg)" }, "VOID")
      : null,
  );
}
