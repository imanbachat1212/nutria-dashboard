// Converts a fully-populated MealPlan document into a print-ready HTML string.
// Used by the PDF export endpoint and reusable by automation / outbox jobs.

const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const SLOT_META = {
  breakfast:  { label: "Breakfast",  emoji: "🌅", order: 0 },
  "snack-am": { label: "AM Snack",   emoji: "🥜", order: 1 },
  lunch:      { label: "Lunch",      emoji: "🥗", order: 2 },
  "snack-pm": { label: "PM Snack",   emoji: "🍎", order: 3 },
  dinner:     { label: "Dinner",     emoji: "🍽️", order: 4 },
};

function slotOrder(slot) {
  return SLOT_META[slot]?.order ?? 99;
}

function fmt(n) {
  return n != null ? Math.round(n) : 0;
}

function goalLabel(g) {
  return g ? g.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "";
}

function statusClass(s) {
  if (s === "active") return "badge-active";
  if (s === "ended")  return "badge-ended";
  return "badge-draft";
}

// ── group flat items into { dayIndex → { slot → [ item ] } }
function groupItems(items) {
  const days = {};
  for (const item of items) {
    if (!days[item.day]) days[item.day] = {};
    if (!days[item.day][item.slot]) days[item.day][item.slot] = [];
    days[item.day][item.slot].push(item);
  }
  return days;
}

function arabicSpan(text) {
  if (!text) return "";
  return `<span class="ar">${escHtml(text)}</span>`;
}

function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function macroRow(calories, protein, carbs, fat) {
  return `${fmt(calories)} kcal &nbsp;·&nbsp; P ${fmt(protein)}g &nbsp;·&nbsp; C ${fmt(carbs)}g &nbsp;·&nbsp; F ${fmt(fat)}g`;
}

function itemAmount(item) {
  if (item.type === "food") return `${item.quantity ?? 0} ${item.unit || "g"}`;
  const s = item.servings ?? 1;
  return `${s} serving${s !== 1 ? "s" : ""}`;
}

function arabicName(item) {
  const ar = item.food?.nameAr || item.meal?.nameAr || null;
  return ar ? arabicSpan(ar) : "";
}

function buildSlotHtml(slot, items) {
  const meta = SLOT_META[slot] ?? { label: slot, emoji: "🍽️" };
  const totCal = items.reduce((a, i) => a + (i.calories || 0), 0);
  const totP   = items.reduce((a, i) => a + (i.protein || 0), 0);
  const totC   = items.reduce((a, i) => a + (i.carbs || 0), 0);
  const totF   = items.reduce((a, i) => a + (i.fat || 0), 0);

  const rows = items.map((item) => `
    <tr>
      <td>
        <div class="item-name">${escHtml(item.name)}</div>
        ${arabicName(item) ? `<div class="item-ar">${arabicName(item)}</div>` : ""}
      </td>
      <td class="num">${escHtml(itemAmount(item))}</td>
      <td class="num">${fmt(item.calories)}</td>
      <td class="num">${fmt(item.protein)}</td>
      <td class="num">${fmt(item.carbs)}</td>
      <td class="num">${fmt(item.fat)}</td>
    </tr>`).join("");

  const subtotalRow = items.length > 1 ? `
    <tr class="subtotal-row">
      <td colspan="2"><strong>Slot total</strong></td>
      <td class="num"><strong>${fmt(totCal)}</strong></td>
      <td class="num"><strong>${fmt(totP)}</strong></td>
      <td class="num"><strong>${fmt(totC)}</strong></td>
      <td class="num"><strong>${fmt(totF)}</strong></td>
    </tr>` : "";

  return `
    <div class="slot">
      <div class="slot-header">
        <span class="slot-title">${meta.emoji} ${escHtml(meta.label)}</span>
        <span class="slot-sub">${macroRow(totCal, totP, totC, totF)}</span>
      </div>
      ${items.length === 0 ? '<div class="empty-slot">No items</div>' : `
      <table class="items-table">
        <thead>
          <tr>
            <th>Item</th>
            <th class="num">Amount</th>
            <th class="num">kcal</th>
            <th class="num">P (g)</th>
            <th class="num">C (g)</th>
            <th class="num">F (g)</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          ${subtotalRow}
        </tbody>
      </table>`}
    </div>`;
}

function buildDayHtml(dayIndex, slotMap, targets) {
  const label = DAY_LABELS[dayIndex] ?? `Day ${dayIndex}`;
  const slots = Object.keys(slotMap).sort((a, b) => slotOrder(a) - slotOrder(b));

  let dayCal = 0, dayP = 0, dayC = 0, dayF = 0;
  for (const items of Object.values(slotMap)) {
    dayCal += items.reduce((a, i) => a + (i.calories || 0), 0);
    dayP   += items.reduce((a, i) => a + (i.protein  || 0), 0);
    dayC   += items.reduce((a, i) => a + (i.carbs    || 0), 0);
    dayF   += items.reduce((a, i) => a + (i.fat      || 0), 0);
  }

  const pct = targets.calories ? Math.round((dayCal / targets.calories) * 100) : 0;
  const overClass = pct > 110 ? "total-over" : pct >= 90 ? "total-on" : "total-under";

  const slotsHtml = slots.length > 0
    ? slots.map((s) => buildSlotHtml(s, slotMap[s])).join("")
    : '<div class="empty-slot" style="padding:10px 14px">No meals planned for this day.</div>';

  return `
    <div class="day-section">
      <div class="day-header">${escHtml(label)}</div>
      ${slotsHtml}
      <div class="day-total ${overClass}">
        <span class="total-label">Day total</span>
        <span>${macroRow(dayCal, dayP, dayC, dayF)}
          ${targets.calories ? `&nbsp;·&nbsp; <strong>${pct}%</strong> of target` : ""}
        </span>
      </div>
    </div>`;
}

export function buildPlanHtml(plan) {
  const clientProfile = plan.client?.profile ?? {};
  const clientName = [clientProfile.firstName, clientProfile.lastName].filter(Boolean).join(" ") || "Unknown";
  const targets = {
    calories: plan.targetCalories || plan.client?.targets?.calories || 0,
    protein:  plan.targetProtein  || plan.client?.targets?.protein  || 0,
    carbs:    plan.targetCarbs    || plan.client?.targets?.carbs    || 0,
    fat:      plan.targetFat      || plan.client?.targets?.fat      || 0,
  };

  const grouped = groupItems(plan.items ?? []);
  // Render all 7 days in order, even if some have no items
  const daysHtml = Array.from({ length: 7 }, (_, i) => {
    return buildDayHtml(i, grouped[i] ?? {}, targets);
  }).join("");

  const generatedDate = new Date().toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });

  return `<!DOCTYPE html>
<html lang="ar" dir="ltr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&family=Noto+Naskh+Arabic:wght@400;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Noto Sans',Arial,sans-serif;font-size:11px;color:#111827;background:#fff;line-height:1.5}
.ar{font-family:'Noto Naskh Arabic','Arabic Typesetting',serif;direction:rtl;unicode-bidi:embed;font-size:10px;color:#6b7280}

/* ── Header ── */
.header{background:#111827;color:#fff;padding:18px 24px 16px;margin-bottom:0}
.header h1{font-size:18px;font-weight:700;margin-bottom:4px;letter-spacing:-0.3px}
.header .meta{color:#9ca3af;font-size:10px}
.badge{display:inline-block;padding:2px 9px;border-radius:3px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;vertical-align:middle}
.badge-draft{background:#fef3c7;color:#92400e}
.badge-active{background:#d1fae5;color:#065f46}
.badge-ended{background:#f3f4f6;color:#374151}

/* ── Target macros strip ── */
.targets-strip{display:flex;gap:10px;padding:12px 24px;background:#f3f4f6;border-bottom:1px solid #e5e7eb;margin-bottom:16px}
.target-box{flex:1;text-align:center;background:#fff;border:1px solid #e5e7eb;border-radius:6px;padding:8px 4px}
.target-box .t-label{font-size:8px;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;margin-bottom:2px}
.target-box .t-val{font-size:15px;font-weight:700;color:#111827}
.target-box .t-unit{font-size:8px;color:#9ca3af}

/* ── Day sections ── */
.day-section{margin:0 16px 14px;border:1px solid #e5e7eb;border-radius:7px;overflow:hidden;page-break-inside:avoid}
.day-header{background:#1f2937;color:#fff;padding:7px 14px;font-weight:700;font-size:11px;letter-spacing:.2px}

/* ── Slots ── */
.slot{border-bottom:1px solid #f3f4f6}
.slot:last-of-type{border-bottom:none}
.slot-header{background:#f9fafb;padding:5px 14px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #f3f4f6}
.slot-title{font-weight:600;font-size:10.5px}
.slot-sub{font-size:9.5px;color:#6b7280}
.empty-slot{padding:6px 14px;font-size:10px;color:#9ca3af;font-style:italic}

/* ── Items table ── */
.items-table{width:100%;border-collapse:collapse}
.items-table thead tr{background:#fafafa;border-bottom:1px solid #f0f0f0}
.items-table th{padding:3px 10px;font-size:8.5px;text-transform:uppercase;letter-spacing:.3px;color:#9ca3af;font-weight:600}
.items-table th.num{text-align:right}
.items-table td{padding:5px 10px;border-bottom:1px solid #f9fafb;vertical-align:top}
.items-table td.num{text-align:right;font-size:10px;color:#374151}
.items-table tbody tr:last-child td{border-bottom:none}
.item-name{font-size:10.5px;font-weight:500;color:#111827}
.item-ar{margin-top:1px}
.subtotal-row td{background:#f9fafb;border-top:1px solid #e5e7eb!important;border-bottom:none!important;font-size:10px;color:#374151}

/* ── Day total ── */
.day-total{padding:7px 14px;display:flex;justify-content:space-between;align-items:center;font-size:10px;border-top:1px solid #e5e7eb}
.total-label{font-weight:700;font-size:10px}
.total-on {background:#f0fdf4;color:#166534}
.total-under{background:#fffbeb;color:#78350f}
.total-over{background:#fff1f2;color:#9f1239}

/* ── Footer ── */
.footer{margin:12px 16px 8px;text-align:center;font-size:8.5px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:8px}

@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style>
</head>
<body>

<div class="header">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
    <div>
      <h1>${escHtml(plan.name)}&nbsp; <span class="badge ${statusClass(plan.status)}">${escHtml(plan.status)}</span></h1>
      <div class="meta">
        ${escHtml(clientName)} &nbsp;·&nbsp;
        ${escHtml(plan.startDate ? new Date(plan.startDate).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}) : "")}
        &nbsp;→&nbsp;
        ${escHtml(plan.endDate   ? new Date(plan.endDate  ).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}) : "")}
        &nbsp;·&nbsp; ${escHtml(goalLabel(plan.goal))}
      </div>
    </div>
    <div style="text-align:right;color:#9ca3af;font-size:9px;white-space:nowrap">
      Generated ${escHtml(generatedDate)}
    </div>
  </div>
</div>

<div class="targets-strip">
  <div class="target-box">
    <div class="t-label">Daily Target</div>
    <div class="t-val">${fmt(targets.calories)}</div>
    <div class="t-unit">kcal</div>
  </div>
  <div class="target-box">
    <div class="t-label">Protein</div>
    <div class="t-val">${fmt(targets.protein)}</div>
    <div class="t-unit">g</div>
  </div>
  <div class="target-box">
    <div class="t-label">Carbs</div>
    <div class="t-val">${fmt(targets.carbs)}</div>
    <div class="t-unit">g</div>
  </div>
  <div class="target-box">
    <div class="t-label">Fat</div>
    <div class="t-val">${fmt(targets.fat)}</div>
    <div class="t-unit">g</div>
  </div>
</div>

${daysHtml}

<div class="footer">Nutria Nutrition Platform &nbsp;·&nbsp; ${escHtml(clientName)} &nbsp;·&nbsp; ${escHtml(generatedDate)}</div>
</body>
</html>`;
}
