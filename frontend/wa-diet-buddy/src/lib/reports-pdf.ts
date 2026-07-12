import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  REPORT_SUMMARY,
  ADHERENCE_TREND,
  MACRO_BREAKDOWN,
  TOP_PROGRESS,
  SERVICE_MIX,
  FLAG_BUCKETS,
  fmtPct,
  fmtMoney,
  type RangeKey,
} from "./reports-mock";

const RANGE_LABEL: Record<RangeKey, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
};

export function generateReportPdf(range: RangeKey) {
  const summary = REPORT_SUMMARY[range];
  const trend = ADHERENCE_TREND[range];

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = margin;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(20);
  doc.text("Nutria — Performance Report", margin, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110);
  y += 16;
  doc.text(
    `${RANGE_LABEL[range]}  ·  Generated ${new Date().toLocaleString()}`,
    margin,
    y,
  );

  y += 18;
  doc.setDrawColor(220);
  doc.line(margin, y, pageW - margin, y);
  y += 18;

  // KPIs
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(20);
  doc.text("Key metrics", margin, y);
  y += 10;

  const kpis: [string, string, number][] = [
    ["Active clients", String(summary.activeClients), summary.activeClientsDelta],
    ["Avg adherence", `${summary.adherence}%`, summary.adherenceDelta],
    ["Avg calories / day", summary.avgCalories.toLocaleString(), summary.avgCaloriesDelta],
    ["Avg weight change", `${summary.weightChange > 0 ? "+" : ""}${summary.weightChange} kg`, summary.weightChangeDelta],
    ["Sessions completed", String(summary.sessionsCompleted), summary.sessionsDelta],
    ["Revenue", fmtMoney(summary.revenue), summary.revenueDelta],
  ];

  autoTable(doc, {
    startY: y + 4,
    head: [["Metric", "Value", "vs prev"]],
    body: kpis.map(([k, v, d]) => [k, v, fmtPct(d)]),
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: [30, 30, 32], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 248, 250] },
    margin: { left: margin, right: margin },
  });
  // @ts-expect-error lastAutoTable injected by plugin
  y = doc.lastAutoTable.finalY + 24;

  // Adherence trend chart (drawn as a simple SVG-ish line chart with vectors)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Adherence trend (diet vs gym)", margin, y);
  y += 8;

  const chartX = margin;
  const chartY = y + 6;
  const chartW = pageW - margin * 2;
  const chartH = 140;

  // Chart frame
  doc.setDrawColor(230);
  doc.setFillColor(252, 252, 253);
  doc.rect(chartX, chartY, chartW, chartH, "FD");

  // Grid lines (0/25/50/75/100)
  doc.setDrawColor(238);
  for (let i = 0; i <= 4; i++) {
    const gy = chartY + (chartH / 4) * i;
    doc.line(chartX, gy, chartX + chartW, gy);
  }
  doc.setFontSize(8);
  doc.setTextColor(150);
  for (let i = 0; i <= 4; i++) {
    const val = 100 - i * 25;
    doc.text(String(val), chartX - 16, chartY + (chartH / 4) * i + 3);
  }

  const xStep = chartW / Math.max(trend.length - 1, 1);
  const toXY = (i: number, v: number) => ({
    x: chartX + i * xStep,
    y: chartY + chartH - (v / 100) * chartH,
  });

  // Diet line (primary blue)
  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(1.4);
  trend.forEach((p, i) => {
    if (i === 0) return;
    const a = toXY(i - 1, trend[i - 1].diet);
    const b = toXY(i, p.diet);
    doc.line(a.x, a.y, b.x, b.y);
  });

  // Gym line (teal)
  doc.setDrawColor(20, 184, 166);
  trend.forEach((p, i) => {
    if (i === 0) return;
    const a = toXY(i - 1, trend[i - 1].gym);
    const b = toXY(i, p.gym);
    doc.line(a.x, a.y, b.x, b.y);
  });

  // X labels (sparse if many)
  doc.setFontSize(8);
  doc.setTextColor(140);
  const labelEvery = Math.ceil(trend.length / 8);
  trend.forEach((p, i) => {
    if (i % labelEvery !== 0 && i !== trend.length - 1) return;
    const { x } = toXY(i, 0);
    doc.text(p.date, x - 6, chartY + chartH + 12);
  });

  // Legend
  const legendY = chartY + chartH + 26;
  doc.setFillColor(59, 130, 246);
  doc.rect(chartX, legendY - 6, 8, 8, "F");
  doc.setTextColor(60);
  doc.setFontSize(9);
  doc.text("Diet adherence", chartX + 12, legendY);
  doc.setFillColor(20, 184, 166);
  doc.rect(chartX + 110, legendY - 6, 8, 8, "F");
  doc.text("Gym adherence", chartX + 122, legendY);

  y = legendY + 24;

  // Macros
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(20);
  doc.text("Avg macros / day", margin, y);

  autoTable(doc, {
    startY: y + 6,
    head: [["Macro", "Grams", "% of intake"]],
    body: MACRO_BREAKDOWN.map((m) => [m.name, `${m.grams} g`, `${m.pct}%`]),
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: [30, 30, 32], textColor: 255 },
    margin: { left: margin, right: margin },
    tableWidth: (pageW - margin * 2) / 2 - 8,
  });

  // Service mix beside macros
  autoTable(doc, {
    // @ts-expect-error injected
    startY: doc.lastAutoTable.startY,
    head: [["Service", "Active clients"]],
    body: SERVICE_MIX.map((s) => [s.label, String(s.value)]),
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: [30, 30, 32], textColor: 255 },
    margin: { left: margin + (pageW - margin * 2) / 2 + 8, right: margin },
    tableWidth: (pageW - margin * 2) / 2 - 8,
  });
  // @ts-expect-error injected
  y = doc.lastAutoTable.finalY + 20;

  // Flagged events
  if (y > 700) {
    doc.addPage();
    y = margin;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Flagged events", margin, y);
  autoTable(doc, {
    startY: y + 6,
    head: [["Flag", "Count"]],
    body: FLAG_BUCKETS.map((f) => [f.label, String(f.count)]),
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: [30, 30, 32], textColor: 255 },
    margin: { left: margin, right: margin },
  });
  // @ts-expect-error injected
  y = doc.lastAutoTable.finalY + 20;

  // Client progress (new page if tight)
  if (y > 600) {
    doc.addPage();
    y = margin;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Client progress", margin, y);
  autoTable(doc, {
    startY: y + 6,
    head: [["Client", "Service", "Adherence", "Weight Δ", "Streak", "Status"]],
    body: TOP_PROGRESS.map((c) => [
      c.name,
      c.service,
      `${c.adherence}%`,
      `${c.weightDelta > 0 ? "+" : ""}${c.weightDelta} kg`,
      `${c.streak}d`,
      c.status === "on-track" ? "On track" : c.status === "at-risk" ? "At risk" : "Off track",
    ]),
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [30, 30, 32], textColor: 255 },
    alternateRowStyles: { fillColor: [248, 248, 250] },
    margin: { left: margin, right: margin },
  });

  // Footer page numbers
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Nutria · ${RANGE_LABEL[range]}`,
      margin,
      doc.internal.pageSize.getHeight() - 16,
    );
    doc.text(
      `Page ${p} / ${pageCount}`,
      pageW - margin,
      doc.internal.pageSize.getHeight() - 16,
      { align: "right" },
    );
  }

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`nutria-report-${range}-${stamp}.pdf`);
}
