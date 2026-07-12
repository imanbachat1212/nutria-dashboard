import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { PACKAGES, fmtMoney, type InvoiceRow } from "./billing-mock";

const BRAND = "Nutria";
const BRAND_TAGLINE = "Dietitian practice · billing@nutria.app";

export function generateInvoicePdf(inv: InvoiceRow) {
  const pkg = PACKAGES.find((p) => p.id === inv.package);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 48;
  let y = margin;

  // Brand header
  doc.setFillColor(20, 20, 22);
  doc.rect(0, 0, pageW, 70, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(BRAND, margin, 38);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(200);
  doc.text(BRAND_TAGLINE, margin, 54);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(255);
  doc.text("INVOICE", pageW - margin, 38, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(inv.number, pageW - margin, 54, { align: "right" });

  y = 110;

  // Meta block (bill to / dates)
  doc.setTextColor(110);
  doc.setFontSize(9);
  doc.text("BILL TO", margin, y);
  doc.text("ISSUED", pageW / 2, y);
  doc.text("DUE", pageW / 2 + 110, y);

  y += 14;
  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(inv.clientName, margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(fmtDateLong(inv.issuedAt), pageW / 2, y);
  doc.text(fmtDateLong(inv.dueAt), pageW / 2 + 110, y);

  y += 14;
  doc.setTextColor(120);
  doc.setFontSize(9);
  doc.text(`Client ID: ${inv.clientId}`, margin, y);

  y += 28;

  // Status pill
  const statusColors: Record<string, [number, number, number]> = {
    paid: [16, 185, 129],
    pending: [245, 158, 11],
    overdue: [244, 63, 94],
    refunded: [100, 116, 139],
  };
  const [r, g, b] = statusColors[inv.status] ?? [100, 116, 139];
  doc.setFillColor(r, g, b);
  doc.roundedRect(margin, y - 12, 64, 18, 9, 9, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(inv.status.toUpperCase(), margin + 32, y, { align: "center" });

  y += 24;

  // Line items
  autoTable(doc, {
    startY: y,
    head: [["Description", "Qty", "Unit price", "Total"]],
    body: [
      [
        `${pkg?.name ?? inv.package} package — monthly subscription`,
        "1",
        fmtMoney(inv.amount),
        fmtMoney(inv.amount),
      ],
    ],
    styles: { fontSize: 10, cellPadding: 8 },
    headStyles: { fillColor: [30, 30, 32], textColor: 255 },
    columnStyles: {
      1: { halign: "center", cellWidth: 50 },
      2: { halign: "right", cellWidth: 90 },
      3: { halign: "right", cellWidth: 90 },
    },
    margin: { left: margin, right: margin },
  });
  // @ts-expect-error injected by plugin
  y = doc.lastAutoTable.finalY + 6;

  // Includes
  if (pkg) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(`Includes: ${pkg.includes.join(" · ")}`, margin, y + 12);
    y += 24;
  }

  // Totals
  const totalsX = pageW - margin - 200;
  const totalsW = 200;
  const subtotal = inv.amount;
  const tax = 0;
  const total = subtotal + tax;

  const row = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 12 : 10);
    doc.setTextColor(bold ? 20 : 90);
    doc.text(label, totalsX, y);
    doc.text(value, totalsX + totalsW, y, { align: "right" });
    y += bold ? 18 : 14;
  };

  y += 6;
  row("Subtotal", fmtMoney(subtotal));
  row("Tax (0%)", fmtMoney(tax));
  doc.setDrawColor(220);
  doc.line(totalsX, y - 4, totalsX + totalsW, y - 4);
  y += 6;
  row("Total due", fmtMoney(total), true);

  // Payment method
  if (inv.method) {
    y += 10;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(
      `Payment method: ${inv.method.charAt(0).toUpperCase() + inv.method.slice(1)}`,
      margin,
      y,
    );
  }

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 48;
  doc.setDrawColor(230);
  doc.line(margin, footerY, pageW - margin, footerY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(140);
  doc.text(
    "Thank you for your business. Questions? Reply to billing@nutria.app.",
    margin,
    footerY + 14,
  );
  doc.text(
    `Generated ${new Date().toLocaleDateString()}`,
    pageW - margin,
    footerY + 14,
    { align: "right" },
  );

  doc.save(`${inv.number}-${inv.clientName.replace(/\s+/g, "-")}.pdf`);
}

function fmtDateLong(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
