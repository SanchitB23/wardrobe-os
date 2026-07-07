"use client";

import { useState } from "react";
import { SparklesIcon } from "lucide-react";

import type { ProspectiveItem } from "@/features/acquisition/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const FORMALITY_OPTIONS = [
  { value: "casual", label: "Casual" },
  { value: "smart_casual", label: "Smart casual" },
  { value: "business_casual", label: "Business casual" },
  { value: "formal", label: "Formal" },
  { value: "business_formal", label: "Business formal" },
] as const;

interface FormState {
  name: string;
  category: string;
  subcategory: string;
  brand: string;
  color: string;
  estimatedPrice: string;
  material: string;
  styleTags: string;
  formality: string;
  intendedOccasions: string;
  productUrl: string;
  notes: string;
}

const EMPTY: FormState = {
  name: "",
  category: "",
  subcategory: "",
  brand: "",
  color: "",
  estimatedPrice: "",
  material: "",
  styleTags: "",
  formality: "",
  intendedOccasions: "",
  productUrl: "",
  notes: "",
};

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

/** Seed the form state from a (partial) ProspectiveItem, e.g. a vision candidate. */
function formStateFrom(initial?: Partial<ProspectiveItem>): FormState {
  if (!initial) return EMPTY;
  return {
    name: initial.name ?? "",
    category: initial.category ?? "",
    subcategory: initial.subcategory ?? "",
    brand: initial.brand ?? "",
    color: initial.color ?? "",
    estimatedPrice: initial.estimatedPrice != null ? String(initial.estimatedPrice) : "",
    material: initial.material ?? "",
    styleTags: (initial.styleTags ?? []).join(", "),
    formality: initial.formality ?? "",
    intendedOccasions: (initial.intendedOccasions ?? []).join(", "),
    productUrl: initial.productUrl ?? "",
    notes: initial.notes ?? "",
  };
}

function Field({
  label,
  htmlFor,
  required,
  flag,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  /** Highlight as low-confidence (vision extraction) — asks the user to check. */
  flag?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs text-muted-foreground">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
        {flag ? (
          <span className="ml-1 text-amber-600 dark:text-amber-400">· double-check</span>
        ) : null}
      </Label>
      {children}
    </div>
  );
}

export function ProspectiveItemForm({
  onAnalyze,
  isAnalyzing,
  initial,
  lowConfidenceFields,
}: {
  onAnalyze: (item: ProspectiveItem) => void;
  isAnalyzing: boolean;
  /** Seed values, e.g. a vision-extracted candidate. Remount (via key) to reseed. */
  initial?: Partial<ProspectiveItem>;
  /** Fields to visually flag as low-confidence (from vision extraction). */
  lowConfidenceFields?: (keyof ProspectiveItem)[];
}) {
  const [form, setForm] = useState<FormState>(() => formStateFrom(initial));
  const lowConf = new Set(lowConfidenceFields ?? []);
  const set = (key: keyof FormState) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const canSubmit = form.name.trim() !== "" && form.category.trim() !== "" && !isAnalyzing;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    const price = Number.parseFloat(form.estimatedPrice);
    onAnalyze({
      name: form.name.trim(),
      category: form.category.trim(),
      subcategory: form.subcategory.trim() || null,
      brand: form.brand.trim() || null,
      color: form.color.trim() || null,
      estimatedPrice: Number.isFinite(price) && price > 0 ? price : null,
      material: form.material.trim() || null,
      styleTags: splitList(form.styleTags),
      formality: form.formality || null,
      intendedOccasions: splitList(form.intendedOccasions),
      productUrl: form.productUrl.trim() || null,
      notes: form.notes.trim() || null,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name" htmlFor="name" required flag={lowConf.has("name")}>
          <Input id="name" value={form.name} onChange={(e) => set("name")(e.target.value)} placeholder="Charcoal smart trousers" />
        </Field>
        <Field label="Category" htmlFor="category" required flag={lowConf.has("category")}>
          <Input id="category" value={form.category} onChange={(e) => set("category")(e.target.value)} placeholder="Trousers" />
        </Field>
        <Field label="Subcategory" htmlFor="subcategory" flag={lowConf.has("subcategory")}>
          <Input id="subcategory" value={form.subcategory} onChange={(e) => set("subcategory")(e.target.value)} placeholder="Chinos" />
        </Field>
        <Field label="Brand" htmlFor="brand" flag={lowConf.has("brand")}>
          <Input id="brand" value={form.brand} onChange={(e) => set("brand")(e.target.value)} />
        </Field>
        <Field label="Color" htmlFor="color" flag={lowConf.has("color")}>
          <Input id="color" value={form.color} onChange={(e) => set("color")(e.target.value)} placeholder="Charcoal grey" />
        </Field>
        <Field label="Estimated price" htmlFor="price" flag={lowConf.has("estimatedPrice")}>
          <Input id="price" type="number" inputMode="decimal" value={form.estimatedPrice} onChange={(e) => set("estimatedPrice")(e.target.value)} placeholder="3000" />
        </Field>
        <Field label="Material / fabric" htmlFor="material" flag={lowConf.has("material")}>
          <Input id="material" value={form.material} onChange={(e) => set("material")(e.target.value)} placeholder="Wool blend" />
        </Field>
        <Field label="Formality" flag={lowConf.has("formality")}>
          <Select value={form.formality || undefined} onValueChange={(v) => set("formality")(v ?? "")}>
            <SelectTrigger className="w-full">
              <span className={form.formality ? "flex flex-1 text-left" : "flex flex-1 text-left text-muted-foreground"}>
                {FORMALITY_OPTIONS.find((o) => o.value === form.formality)?.label ?? "Select…"}
              </span>
            </SelectTrigger>
            <SelectContent>
              {FORMALITY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="Style tags (comma-separated)" htmlFor="styleTags" flag={lowConf.has("styleTags")}>
        <Input id="styleTags" value={form.styleTags} onChange={(e) => set("styleTags")(e.target.value)} placeholder="Smart casual, Minimal" />
      </Field>
      <Field label="Intended occasions (comma-separated)" htmlFor="occasions" flag={lowConf.has("intendedOccasions")}>
        <Input id="occasions" value={form.intendedOccasions} onChange={(e) => set("intendedOccasions")(e.target.value)} placeholder="Office, Travel" />
      </Field>
      <Field label="Product URL (optional)" htmlFor="url">
        <Input id="url" value={form.productUrl} onChange={(e) => set("productUrl")(e.target.value)} placeholder="https://…" />
      </Field>
      <Field label="Notes (optional)" htmlFor="notes">
        <Textarea id="notes" value={form.notes} onChange={(e) => set("notes")(e.target.value)} className="h-20" />
      </Field>

      <Button type="submit" disabled={!canSubmit} className="w-full">
        <SparklesIcon />
        {isAnalyzing ? "Analyzing…" : "Analyze"}
      </Button>
    </form>
  );
}
