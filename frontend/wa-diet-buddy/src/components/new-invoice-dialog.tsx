import { useMemo, useState } from "react";
import { User, Phone, FileText, CreditCard } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PACKAGES,
  fmtMoney,
  type InvoiceRow,
  type InvoiceStatus,
  type PaymentMethod,
  type PackageTier,
} from "@/lib/billing-mock";

interface NewInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (inv: InvoiceRow) => void;
  nextNumber: number;
}

const STATUS_OPTIONS: { value: InvoiceStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
];

const METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "card", label: "Card" },
  { value: "bank", label: "Bank transfer" },
  { value: "cash", label: "Cash" },
  { value: "wallet", label: "Wallet" },
];

function todayISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function NewInvoiceDialog({
  open,
  onOpenChange,
  onCreate,
  nextNumber,
}: NewInvoiceDialogProps) {
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [pkg, setPkg] = useState<PackageTier>("standard");
  const [amount, setAmount] = useState<string>("89");
  const [issuedAt, setIssuedAt] = useState(todayISO());
  const [dueAt, setDueAt] = useState(todayISO(7));
  const [status, setStatus] = useState<InvoiceStatus>("pending");
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [notes, setNotes] = useState("");

  const reset = () => {
    setClientName("");
    setClientPhone("");
    setPkg("standard");
    setAmount("89");
    setIssuedAt(todayISO());
    setDueAt(todayISO(7));
    setStatus("pending");
    setMethod("card");
    setNotes("");
  };

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const selectedPkg = useMemo(() => PACKAGES.find((p) => p.id === pkg), [pkg]);

  const handlePackageChange = (v: string) => {
    const next = v as PackageTier;
    setPkg(next);
    const p = PACKAGES.find((x) => x.id === next);
    if (p) setAmount(String(p.priceMonthly));
  };

  const canSave = clientName.trim().length > 1 && Number(amount) > 0;
  const invoiceNumber = `INV-${new Date().getFullYear()}-${String(nextNumber).padStart(4, "0")}`;

  const handleSave = () => {
    const inv: InvoiceRow = {
      id: `i-${Date.now()}`,
      number: invoiceNumber,
      clientId: `c-${Date.now().toString(36)}`,
      clientName: clientName.trim(),
      package: pkg,
      amount: Number(amount),
      issuedAt,
      dueAt,
      status,
      method: status === "paid" ? method : undefined,
    };
    onCreate(inv);
    handleClose(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New invoice</DialogTitle>
          <DialogDescription>
            Bill a client for a package. Invoice #{invoiceNumber}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <section className="space-y-3">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <User className="size-4" /> Client
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="clientName">Name *</Label>
                <Input
                  id="clientName"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Sara El Amrani"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="clientPhone">Phone</Label>
                <div className="relative">
                  <Phone className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="clientPhone"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="+961 70 998 221"
                    className="pl-8"
                  />
                </div>
              </div>
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <FileText className="size-4" /> Package & amount
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Package</Label>
                <Select value={pkg} onValueChange={handlePackageChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PACKAGES.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} · {fmtMoney(p.priceMonthly)}/mo
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="amount">Amount (USD)</Label>
                <Input
                  id="amount"
                  type="number"
                  min={0}
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </div>
            {selectedPkg && (
              <p className="text-xs text-muted-foreground">
                Includes: {selectedPkg.includes.join(" · ")}
              </p>
            )}
          </section>

          <Separator />

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Dates & status</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="issued">Issued</Label>
                <Input
                  id="issued"
                  type="date"
                  value={issuedAt}
                  onChange={(e) => setIssuedAt(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="due">Due</Label>
                <Input
                  id="due"
                  type="date"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as InvoiceStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {status === "paid" && (
                <div className="space-y-1.5">
                  <Label>
                    <span className="inline-flex items-center gap-1.5">
                      <CreditCard className="size-4" /> Method
                    </span>
                  </Label>
                  <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {METHOD_OPTIONS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </section>

          <Separator />

          <section className="space-y-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal note about this invoice."
              rows={2}
            />
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancel
          </Button>
          <Button disabled={!canSave} onClick={handleSave}>
            Create invoice · {fmtMoney(Number(amount) || 0)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
