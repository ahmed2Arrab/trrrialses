import type { Client } from "../types";

export function normalizeClient(raw: Partial<Client> & Record<string, unknown>): Client {
  const paid = Number(raw.paid ?? 0);
  const totalContract = Number(
    raw.totalContract != null ? raw.totalContract : paid,
  );
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    plot: String(raw.plot ?? ""),
    totalContract,
    paid,
    phone: raw.phone != null ? String(raw.phone) : "",
    expenses: Array.isArray(raw.expenses) ? raw.expenses : [],
    tips: Array.isArray(raw.tips) ? raw.tips : [],
    payments: Array.isArray(raw.payments) ? raw.payments : [],
    docs: Array.isArray(raw.docs) ? raw.docs : [],
    pdfs: Array.isArray(raw.pdfs) ? raw.pdfs : [],
    receipts: Array.isArray(raw.receipts) ? raw.receipts : [],
  };
}

/** نفس منطق العرض في النسخة السابقة (script.js) */
export function getClientPaidDisplay(client: Client): number {
  const payments = client.payments || [];
  const totalPaidFromHistory = payments.reduce(
    (acc, p) => acc + Number(p.amount ?? 0),
    0,
  );
  const base =
    payments.length > 0
      ? totalPaidFromHistory + (client.paid || 0)
      : client.paid || 0;
  const expenses = (client.expenses || []).reduce(
    (acc, e) => acc + Number(e.amount ?? 0),
    0,
  );
  return base - expenses;
}

export function getTipsTotal(client: Client): number {
  return (client.tips || []).reduce(
    (acc, t) => acc + Number(t.amount ?? 0),
    0,
  );
}

export function getExpensesTotal(client: Client): number {
  return (client.expenses || []).reduce(
    (acc, e) => acc + Number(e.amount ?? 0),
    0,
  );
}

/** عمود «المتبقي» في الجدول الرئيسي (أصل بعد المصروفات) */
export function getDashboardOwedPrincipal(client: Client): number {
  return (client.paid || 0) - getExpensesTotal(client);
}
