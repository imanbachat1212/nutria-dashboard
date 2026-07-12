import { useState } from "react";
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  FileText,
  Type,
  AlignLeft,
  Hash,
  CircleDot,
  ListChecks,
  Calendar,
  Upload,
  SlidersHorizontal,
  PenLine,
  Send,
  Copy,
  Eye,
  Languages,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";
import { FIELD_TYPE_LABEL, type FieldType } from "@/lib/intake-forms-mock";

interface NewFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Category = "onboarding" | "medical" | "lifestyle" | "follow-up" | "consent";
type Language = "EN" | "AR" | "FR" | "EN/AR";

interface FieldDraft {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
}
interface SectionDraft {
  id: string;
  title: string;
  fields: FieldDraft[];
}

const CATEGORIES: { value: Category; label: string; hint: string }[] = [
  { value: "onboarding", label: "Onboarding", hint: "First-touch intake" },
  { value: "medical", label: "Medical", hint: "Conditions & meds" },
  { value: "lifestyle", label: "Lifestyle", hint: "Habits & food diary" },
  { value: "follow-up", label: "Follow-up", hint: "Weekly check-ins" },
  { value: "consent", label: "Consent", hint: "Legal & signatures" },
];

const FIELD_TYPES: { type: FieldType; icon: React.ComponentType<{ className?: string }> }[] = [
  { type: "short-text", icon: Type },
  { type: "long-text", icon: AlignLeft },
  { type: "number", icon: Hash },
  { type: "single-choice", icon: CircleDot },
  { type: "multi-choice", icon: ListChecks },
  { type: "date", icon: Calendar },
  { type: "file", icon: Upload },
  { type: "scale", icon: SlidersHorizontal },
  { type: "signature", icon: PenLine },
];

const TEMPLATES: { id: string; title: string; description: string; sections: SectionDraft[] }[] = [
  {
    id: "blank",
    title: "Blank form",
    description: "Start from scratch.",
    sections: [{ id: "s1", title: "Section 1", fields: [] }],
  },
  {
    id: "intake",
    title: "New client intake",
    description: "Personal info, goals, and lifestyle.",
    sections: [
      {
        id: "s1",
        title: "Personal info",
        fields: [
          { id: uid(), label: "Full name", type: "short-text", required: true },
          { id: uid(), label: "Date of birth", type: "date", required: true },
          { id: uid(), label: "Phone (WhatsApp)", type: "short-text", required: true },
        ],
      },
      {
        id: "s2",
        title: "Goals",
        fields: [
          { id: uid(), label: "Primary goal", type: "single-choice", required: true, options: ["Lose weight", "Gain muscle", "Improve health"] },
          { id: uid(), label: "Why now?", type: "long-text", required: false },
        ],
      },
    ],
  },
  {
    id: "checkin",
    title: "Weekly check-in",
    description: "Quick adherence pulse.",
    sections: [
      {
        id: "s1",
        title: "Pulse",
        fields: [
          { id: uid(), label: "Current weight (kg)", type: "number", required: true },
          { id: uid(), label: "Adherence", type: "scale", required: true },
          { id: uid(), label: "Anything to flag?", type: "long-text", required: false },
        ],
      },
    ],
  },
];

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

const STEPS = ["Template", "Details", "Build", "Review"] as const;
type Step = (typeof STEPS)[number];

export function NewFormDialog({ open, onOpenChange }: NewFormDialogProps) {
  const [step, setStep] = useState<Step>("Template");

  // Step 1
  const [templateId, setTemplateId] = useState<string>("blank");

  // Step 2
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("onboarding");
  const [language, setLanguage] = useState<Language>("EN");

  // Step 3
  const [sections, setSections] = useState<SectionDraft[]>([
    { id: "s1", title: "Section 1", fields: [] },
  ]);

  const stepIndex = STEPS.indexOf(step);
  const canNext =
    (step === "Template" && !!templateId) ||
    (step === "Details" && title.trim().length > 1) ||
    (step === "Build" && sections.some((s) => s.fields.length > 0)) ||
    step === "Review";

  function reset() {
    setStep("Template");
    setTemplateId("blank");
    setTitle("");
    setDescription("");
    setCategory("onboarding");
    setLanguage("EN");
    setSections([{ id: "s1", title: "Section 1", fields: [] }]);
  }

  function applyTemplate(id: string) {
    setTemplateId(id);
    const tpl = TEMPLATES.find((t) => t.id === id);
    if (tpl) {
      // clone with fresh ids
      setSections(
        tpl.sections.map((s) => ({
          ...s,
          id: uid(),
          fields: s.fields.map((f) => ({ ...f, id: uid() })),
        })),
      );
      if (id === "intake") {
        setTitle((prev) => prev || "New client intake");
        setCategory("onboarding");
      } else if (id === "checkin") {
        setTitle((prev) => prev || "Weekly check-in");
        setCategory("follow-up");
      }
    }
  }

  function addSection() {
    setSections((prev) => [
      ...prev,
      { id: uid(), title: `Section ${prev.length + 1}`, fields: [] },
    ]);
  }
  function removeSection(id: string) {
    setSections((prev) => (prev.length === 1 ? prev : prev.filter((s) => s.id !== id)));
  }
  function renameSection(id: string, title: string) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, title } : s)));
  }
  function addField(sectionId: string, type: FieldType) {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              fields: [
                ...s.fields,
                {
                  id: uid(),
                  label: defaultLabel(type),
                  type,
                  required: false,
                  options:
                    type === "single-choice" || type === "multi-choice"
                      ? ["Option 1", "Option 2"]
                      : undefined,
                },
              ],
            }
          : s,
      ),
    );
  }
  function updateField(sectionId: string, fieldId: string, patch: Partial<FieldDraft>) {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? { ...s, fields: s.fields.map((f) => (f.id === fieldId ? { ...f, ...patch } : f)) }
          : s,
      ),
    );
  }
  function removeField(sectionId: string, fieldId: string) {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId ? { ...s, fields: s.fields.filter((f) => f.id !== fieldId) } : s,
      ),
    );
  }

  const totalFields = sections.reduce((a, s) => a + s.fields.length, 0);
  const estMinutes = Math.max(1, Math.round(totalFields * 0.5));

  function handleNext() {
    if (step === "Review") {
      reset();
      onOpenChange(false);
      return;
    }
    setStep(STEPS[stepIndex + 1]);
  }
  function handleBack() {
    if (stepIndex === 0) return;
    setStep(STEPS[stepIndex - 1]);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="border-b px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <DialogTitle className="font-display text-xl">New intake form</DialogTitle>
              <DialogDescription className="mt-0.5 text-xs">
                Build a form clients fill out from WhatsApp in minutes.
              </DialogDescription>
            </div>
            <Stepper step={step} />
          </div>
        </DialogHeader>

        <div className="max-h-[65vh] overflow-y-auto px-6 py-5">
          {step === "Template" && (
            <TemplateStep value={templateId} onChange={applyTemplate} />
          )}
          {step === "Details" && (
            <DetailsStep
              title={title}
              setTitle={setTitle}
              description={description}
              setDescription={setDescription}
              category={category}
              setCategory={setCategory}
              language={language}
              setLanguage={setLanguage}
            />
          )}
          {step === "Build" && (
            <BuildStep
              sections={sections}
              addSection={addSection}
              removeSection={removeSection}
              renameSection={renameSection}
              addField={addField}
              updateField={updateField}
              removeField={removeField}
            />
          )}
          {step === "Review" && (
            <ReviewStep
              title={title}
              description={description}
              category={category}
              language={language}
              sections={sections}
              estMinutes={estMinutes}
            />
          )}
        </div>

        <DialogFooter className="border-t bg-muted/30 px-6 py-3 sm:justify-between">
          <div className="text-xs text-muted-foreground">
            {totalFields} field{totalFields === 1 ? "" : "s"} · ~{estMinutes} min to complete
          </div>
          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <Button variant="outline" size="sm" onClick={handleBack} className="gap-1">
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
            )}
            <Button size="sm" onClick={handleNext} disabled={!canNext} className="gap-1">
              {step === "Review" ? (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Publish form
                </>
              ) : (
                <>
                  Next <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stepper({ step }: { step: Step }) {
  return (
    <div className="hidden items-center gap-1.5 sm:flex">
      {STEPS.map((s, i) => {
        const active = s === step;
        const done = STEPS.indexOf(step) > i;
        return (
          <div key={s} className="flex items-center gap-1.5">
            <div
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold",
                active && "bg-primary text-primary-foreground",
                done && "bg-primary/20 text-primary",
                !active && !done && "bg-muted text-muted-foreground",
              )}
            >
              {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span
              className={cn(
                "text-xs",
                active ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {s}
            </span>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-4 bg-border" />}
          </div>
        );
      })}
    </div>
  );
}

function TemplateStep({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <h3 className="font-display text-base font-semibold">Start with a template</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Pick a starting point — you can change anything in the next steps.
      </p>
      <div className="mt-4 grid gap-2 md:grid-cols-3">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={cn(
              "rounded-lg border bg-card p-4 text-left transition hover:border-primary hover:shadow-sm",
              value === t.id && "border-primary ring-2 ring-primary/20",
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-soft text-primary">
                <FileText className="h-4 w-4" />
              </div>
              {value === t.id && <CheckCircle2 className="h-4 w-4 text-primary" />}
            </div>
            <div className="mt-3 text-sm font-semibold">{t.title}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{t.description}</div>
            <div className="mt-3 text-[11px] text-muted-foreground">
              {t.sections.reduce((a, s) => a + s.fields.length, 0)} fields ·{" "}
              {t.sections.length} section{t.sections.length === 1 ? "" : "s"}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function DetailsStep({
  title,
  setTitle,
  description,
  setDescription,
  category,
  setCategory,
  language,
  setLanguage,
}: {
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  category: Category;
  setCategory: (v: Category) => void;
  language: Language;
  setLanguage: (v: Language) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="form-title">Form title</Label>
        <Input
          id="form-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. New client intake"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="form-desc">
          Description <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="form-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Shown to the client above the form."
          rows={3}
        />
      </div>
      <div>
        <Label className="mb-2 block">Category</Label>
        <div className="grid gap-2 sm:grid-cols-3">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={cn(
                "rounded-md border bg-card px-3 py-2.5 text-left transition hover:border-primary",
                category === c.value && "border-primary ring-2 ring-primary/20",
              )}
            >
              <div className="text-sm font-medium">{c.label}</div>
              <div className="text-[11px] text-muted-foreground">{c.hint}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5">
          <Languages className="h-3.5 w-3.5" /> Language
        </Label>
        <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="EN">English</SelectItem>
            <SelectItem value="AR">العربية</SelectItem>
            <SelectItem value="FR">Français</SelectItem>
            <SelectItem value="EN/AR">Bilingual EN/AR</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function BuildStep({
  sections,
  addSection,
  removeSection,
  renameSection,
  addField,
  updateField,
  removeField,
}: {
  sections: SectionDraft[];
  addSection: () => void;
  removeSection: (id: string) => void;
  renameSection: (id: string, title: string) => void;
  addField: (sectionId: string, type: FieldType) => void;
  updateField: (sectionId: string, fieldId: string, patch: Partial<FieldDraft>) => void;
  removeField: (sectionId: string, fieldId: string) => void;
}) {
  const [activeSection, setActiveSection] = useState<string>(sections[0]?.id ?? "");
  const current = sections.find((s) => s.id === activeSection) ?? sections[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs transition",
              current?.id === s.id
                ? "border-primary bg-primary-soft text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {s.title}{" "}
            <span className="ml-1 text-[10px] opacity-70">({s.fields.length})</span>
          </button>
        ))}
        <Button variant="outline" size="sm" onClick={addSection} className="h-7 gap-1">
          <Plus className="h-3.5 w-3.5" /> Section
        </Button>
      </div>

      {current && (
        <Card className="p-4">
          <div className="flex items-center justify-between gap-3">
            <Input
              value={current.title}
              onChange={(e) => renameSection(current.id, e.target.value)}
              className="h-8 max-w-xs border-0 bg-transparent px-0 font-semibold focus-visible:ring-0"
            />
            {sections.length > 1 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  removeSection(current.id);
                  setActiveSection(sections[0].id);
                }}
                className="h-7 gap-1 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove section
              </Button>
            )}
          </div>
          <Separator className="my-3" />

          <div className="space-y-2">
            {current.fields.length === 0 && (
              <div className="rounded-md border border-dashed bg-muted/30 py-8 text-center text-sm text-muted-foreground">
                No fields yet. Add one below.
              </div>
            )}
            {current.fields.map((f) => (
              <FieldRow
                key={f.id}
                field={f}
                onChange={(p) => updateField(current.id, f.id, p)}
                onRemove={() => removeField(current.id, f.id)}
              />
            ))}
          </div>

          <div className="mt-4">
            <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Add field
            </div>
            <div className="flex flex-wrap gap-1.5">
              {FIELD_TYPES.map(({ type, icon: Icon }) => (
                <Button
                  key={type}
                  size="sm"
                  variant="outline"
                  onClick={() => addField(current.id, type)}
                  className="h-8 gap-1.5"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {FIELD_TYPE_LABEL[type]}
                </Button>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function FieldRow({
  field,
  onChange,
  onRemove,
}: {
  field: FieldDraft;
  onChange: (patch: Partial<FieldDraft>) => void;
  onRemove: () => void;
}) {
  const hasOptions = field.type === "single-choice" || field.type === "multi-choice";
  return (
    <div className="rounded-md border bg-card p-3">
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground/60" />
        <Input
          value={field.label}
          onChange={(e) => onChange({ label: e.target.value })}
          className="h-8 flex-1"
        />
        <Badge variant="outline" className="rounded text-[10px]">
          {FIELD_TYPE_LABEL[field.type]}
        </Badge>
        <button
          onClick={() => onChange({ required: !field.required })}
          className={cn(
            "rounded border px-2 py-1 text-[10px] font-medium uppercase tracking-wider transition",
            field.required
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-border bg-muted/40 text-muted-foreground hover:text-foreground",
          )}
        >
          {field.required ? "Required" : "Optional"}
        </button>
        <Button
          size="icon"
          variant="ghost"
          onClick={onRemove}
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {hasOptions && (
        <div className="mt-2 space-y-1.5 pl-6">
          {(field.options ?? []).map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <CircleDot className="h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={opt}
                onChange={(e) => {
                  const next = [...(field.options ?? [])];
                  next[i] = e.target.value;
                  onChange({ options: next });
                }}
                className="h-7 text-sm"
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={() =>
                  onChange({
                    options: (field.options ?? []).filter((_, idx) => idx !== i),
                  })
                }
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onChange({ options: [...(field.options ?? []), `Option ${(field.options?.length ?? 0) + 1}`] })}
            className="h-7 gap-1 px-2 text-xs text-muted-foreground"
          >
            <Plus className="h-3 w-3" /> Add option
          </Button>
        </div>
      )}
    </div>
  );
}

function ReviewStep({
  title,
  description,
  category,
  language,
  sections,
  estMinutes,
}: {
  title: string;
  description: string;
  category: Category;
  language: Language;
  sections: SectionDraft[];
  estMinutes: number;
}) {
  const totalFields = sections.reduce((a, s) => a + s.fields.length, 0);
  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">
            {CATEGORIES.find((c) => c.value === category)?.label}
          </Badge>
          <Badge variant="outline" className="text-[10px]">{language}</Badge>
        </div>
        <h3 className="mt-2 font-display text-xl font-semibold">{title || "Untitled form"}</h3>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
        <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground">
          <span>{sections.length} sections</span>
          <span>{totalFields} fields</span>
          <span>~{estMinutes} min</span>
        </div>
      </Card>

      <div>
        <h4 className="mb-2 text-sm font-semibold">Preview</h4>
        <div className="space-y-4">
          {sections.map((sec, i) => (
            <div key={sec.id}>
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-soft text-[10px] font-semibold text-primary">
                  {i + 1}
                </span>
                <span className="text-sm font-medium">{sec.title}</span>
              </div>
              <div className="space-y-1.5 pl-7">
                {sec.fields.length === 0 && (
                  <div className="text-xs italic text-muted-foreground">No fields.</div>
                )}
                {sec.fields.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate text-sm">{f.label}</span>
                      {f.required && <span className="text-xs text-rose-500">*</span>}
                    </div>
                    <Badge variant="outline" className="rounded text-[10px] text-muted-foreground">
                      {FIELD_TYPE_LABEL[f.type]}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Card className="border-dashed bg-primary-soft/40 p-4">
        <div className="text-sm font-semibold">Ready to share</div>
        <p className="mt-1 text-xs text-muted-foreground">
          After publishing you can send this form via WhatsApp, email, or a public link.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" disabled>
            <Send className="h-3.5 w-3.5" /> Send via WhatsApp
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" disabled>
            <Copy className="h-3.5 w-3.5" /> Copy link
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" disabled>
            <Eye className="h-3.5 w-3.5" /> Preview as client
          </Button>
        </div>
      </Card>
    </div>
  );
}

function defaultLabel(type: FieldType): string {
  switch (type) {
    case "short-text": return "Untitled question";
    case "long-text": return "Tell us more…";
    case "number": return "Enter a number";
    case "single-choice": return "Pick one";
    case "multi-choice": return "Select all that apply";
    case "date": return "Pick a date";
    case "file": return "Upload a file";
    case "scale": return "Rate from 1 to 10";
    case "signature": return "Signature";
  }
}
