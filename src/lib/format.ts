export const fmtMoney = (n: number | string | null | undefined, currency = "USD") => {
  const v = typeof n === "string" ? parseFloat(n) : n ?? 0;
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(v);
};

export const fmtDate = (d: string | Date) => {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
};

export const fmtAccount = (n: string) => `••••${n.slice(-4)}`;
