import type { SignalType } from "@prisma/client";

export type SignalTypeValue = SignalType;

export const SIGNAL_TYPES = [
  "HIRING",
  "FUNDING",
  "EXPANSION",
  "PRODUCT_LAUNCH",
  "TECHNOLOGY_CHANGE",
  "PARTNERSHIP",
  "LEADERSHIP",
  "CUSTOMER_GROWTH",
  "CUSTOMER_COMPLAINT",
] as const satisfies readonly SignalType[];

export type SignalMeta = {
  label: string;
  shortLabel: string;
  description: string;
  color: string;
  text: string;
  border: string;
  bg: string;
  hex: string;
  angle: number;
};

export const SIGNAL_META: Record<SignalType, SignalMeta> = {
  HIRING: {
    label: "Hiring",
    shortLabel: "Hiring",
    description: "New roles or headcount changes that suggest budget and mandate.",
    color: "signal-mint",
    text: "text-signal-mint",
    border: "border-signal-mint/25",
    bg: "bg-signal-mint/10",
    hex: "#5eead4",
    angle: 0,
  },
  FUNDING: {
    label: "Funding",
    shortLabel: "Funding",
    description: "A raise, investment or capital event that unlocks new spend.",
    color: "signal-lime",
    text: "text-signal-lime",
    border: "border-signal-lime/25",
    bg: "bg-signal-lime/10",
    hex: "#b8f26a",
    angle: 40,
  },
  EXPANSION: {
    label: "Geographic expansion",
    shortLabel: "Expansion",
    description: "A new market, office or region that creates local requirements.",
    color: "signal-sky",
    text: "text-signal-sky",
    border: "border-signal-sky/25",
    bg: "bg-signal-sky/10",
    hex: "#7dd3fc",
    angle: 80,
  },
  PRODUCT_LAUNCH: {
    label: "Product launch",
    shortLabel: "Launch",
    description: "A new product or release that changes the go-to-market motion.",
    color: "signal-violet",
    text: "text-signal-violet",
    border: "border-signal-violet/25",
    bg: "bg-signal-violet/10",
    hex: "#a78bfa",
    angle: 120,
  },
  TECHNOLOGY_CHANGE: {
    label: "Technology change",
    shortLabel: "Tech change",
    description: "A migration, adoption or stack replacement worth acting on.",
    color: "signal-amber",
    text: "text-signal-amber",
    border: "border-signal-amber/25",
    bg: "bg-signal-amber/10",
    hex: "#fbbf24",
    angle: 160,
  },
  PARTNERSHIP: {
    label: "Strategic partnership",
    shortLabel: "Partnership",
    description: "A partnership or integration that widens distribution.",
    color: "signal-orange",
    text: "text-signal-orange",
    border: "border-signal-orange/25",
    bg: "bg-signal-orange/10",
    hex: "#fdba74",
    angle: 200,
  },
  LEADERSHIP: {
    label: "Leadership change",
    shortLabel: "Leadership",
    description: "A new executive with a mandate to change the status quo.",
    color: "signal-rose",
    text: "text-signal-rose",
    border: "border-signal-rose/25",
    bg: "bg-signal-rose/10",
    hex: "#f9a8d4",
    angle: 240,
  },
  CUSTOMER_GROWTH: {
    label: "Customer growth",
    shortLabel: "Growth",
    description: "Publicly reported customer, revenue or adoption momentum.",
    color: "signal-coral",
    text: "text-signal-coral",
    border: "border-signal-coral/25",
    bg: "bg-signal-coral/10",
    hex: "#fb7185",
    angle: 280,
  },
  CUSTOMER_COMPLAINT: {
    label: "Public customer complaint",
    shortLabel: "Complaint",
    description: "A public pain point that creates an opening for a better solution.",
    color: "signal-slate",
    text: "text-signal-slate",
    border: "border-signal-slate/25",
    bg: "bg-signal-slate/10",
    hex: "#94a3b8",
    angle: 320,
  },
};

export const SIGNAL_ORDER = SIGNAL_TYPES;

export function signalMeta(type: string): SignalMeta {
  return SIGNAL_META[(type as SignalType) ?? "HIRING"] ?? SIGNAL_META.HIRING;
}

export const ICP_SIGNAL_OPTIONS = SIGNAL_TYPES.map((type) => ({
  value: type,
  label: SIGNAL_META[type].label,
  description: SIGNAL_META[type].description,
  hex: SIGNAL_META[type].hex,
}));
