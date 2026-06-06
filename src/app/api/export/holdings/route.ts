import { prisma } from "@/lib/prisma";
import { valueHoldings } from "@/lib/analysis/valuation";
import { toCsvRow } from "@/lib/data/holdings-csv";

export const dynamic = "force-dynamic";

export async function GET() {
  const holdings = await prisma.holding.findMany({
    include: { fund: true },
    orderBy: { investedAmount: "desc" },
  });

  const valued = await valueHoldings(
    holdings.map((h) => ({
      id: h.id,
      units: h.units,
      avgCostNav: h.avgCostNav,
      investedAmount: h.investedAmount,
      amfiCode: h.fund.amfiCode,
    })),
  );

  const header = [
    "amfiCode",
    "name",
    "category",
    "units",
    "avgCostNav",
    "invested",
    "latestNav",
    "navDate",
    "currentValue",
    "gain",
    "gainPct",
  ];

  const rows = holdings.map((h) => {
    const v = valued.get(h.id)!;
    return [
      h.fund.amfiCode,
      h.fund.name,
      h.fund.category,
      h.units,
      h.avgCostNav.toFixed(4),
      v.invested.toFixed(2),
      v.latestNav != null ? v.latestNav.toFixed(4) : "",
      v.navDate ?? "",
      v.currentValue.toFixed(2),
      v.gain.toFixed(2),
      v.gainPct != null ? (v.gainPct * 100).toFixed(2) : "",
    ];
  });

  const csv = [header, ...rows].map(toCsvRow).join("\n");
  const date = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="holdings-${date}.csv"`,
    },
  });
}
