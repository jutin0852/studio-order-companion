import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, ensureUserWorkspace } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { RATE_POLICIES } from "@/lib/rate-limit-policy";

type ExpenseRow = { id: string; label: string; amount: string | number; occurred_on: string; notes: string | null };

function serializeExpense(row: ExpenseRow) {
  return { id: row.id, label: row.label, amount: Number(row.amount), date: row.occurred_on, ...(row.notes ? { notes: row.notes } : {}) };
}

async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "You must be signed in to view expenses." }, { status: 401 });
  const limited = await rateLimit(session.user.id, RATE_POLICIES.read);
  if (limited) return limited;
  if (!db) return NextResponse.json({ error: "Expense storage is not configured yet." }, { status: 503 });

  try {
    const businessId = await ensureUserWorkspace(session.user.id, session.user.name);
    const result = await db.query<ExpenseRow>(
      `SELECT id, label, amount, to_char(occurred_on, 'YYYY-MM-DD') AS occurred_on, notes
       FROM expenses
       WHERE business_id = $1
       ORDER BY occurred_on DESC, created_at DESC`,
      [businessId],
    );
    return NextResponse.json({ expenses: result.rows.map(serializeExpense) });
  } catch {
    return NextResponse.json({ error: "Expenses could not be loaded right now." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "You must be signed in to add an expense." }, { status: 401 });
  const limited = await rateLimit(session.user.id, RATE_POLICIES.write);
  if (limited) return limited;
  if (!db) return NextResponse.json({ error: "Expense storage is not configured yet." }, { status: 503 });

  const body = await request.json().catch(() => null) as { label?: string; amount?: number; date?: string; notes?: string } | null;
  const label = body?.label?.trim();
  const amount = body?.amount;
  const date = body?.date;
  if (!label || label.length > 160 || typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || (body?.notes !== undefined && body.notes.length > 2_000)) {
    return NextResponse.json({ error: "Add a valid expense, amount, and date." }, { status: 400 });
  }

  try {
    const businessId = await ensureUserWorkspace(session.user.id, session.user.name);
    const result = await db.query<ExpenseRow>(
      `INSERT INTO expenses (business_id, label, amount, occurred_on, notes)
       VALUES ($1, $2, $3, $4, NULLIF($5, ''))
       RETURNING id, label, amount, to_char(occurred_on, 'YYYY-MM-DD') AS occurred_on, notes`,
      [businessId, label, amount, date, body.notes?.trim() ?? ""],
    );
    return NextResponse.json({ expense: serializeExpense(result.rows[0]) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "The expense could not be saved right now." }, { status: 503 });
  }
}
