import { cn } from "@/lib/utils";

/**
 * Single source of truth for color-name → hex fallbacks. Used only when an
 * item has no stored `colors.hex`. Keep new colors here, never inline.
 */
export const COLOR_HEX_FALLBACKS: Record<string, string> = {
  white: "#FFFFFF",
  "off white": "#F8F4EA",
  cream: "#F5EEDC",
  black: "#111111",
  grey: "#808080",
  gray: "#808080",
  charcoal: "#3A3A3A",
  beige: "#D8C3A5",
  taupe: "#B8A99A",
  navy: "#1F2A44",
  blue: "#2563EB",
  "light blue": "#93C5FD",
  "sky blue": "#7DD3FC",
  olive: "#6B7D3A",
  sage: "#9CAF88",
  "forest green": "#228B22",
  teal: "#008080",
  brown: "#7B4F2C",
  camel: "#C19A6B",
  chocolate: "#4E342E",
  red: "#DC2626",
  wine: "#722F37",
  maroon: "#800000",
  pink: "#F9A8D4",
  peach: "#FFDAB9",
  rust: "#B7410E",
  orange: "#F97316",
  purple: "#7E22CE",
  silver: "#C0C0C0",
  gold: "#D4AF37",
  yellow: "#FACC15",
  "not specified": "#CBD5E1",
};

const METALLIC = new Set(["silver", "gold"]);

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/** Resolves a display hex from an explicit value, then the name/family fallback. */
export function resolveColorHex(
  colorName: string,
  hex?: string | null,
  family?: string | null,
): string {
  if (hex && hex.trim()) {
    return hex.trim();
  }
  return (
    COLOR_HEX_FALLBACKS[normalize(colorName)] ??
    COLOR_HEX_FALLBACKS[normalize(family)] ??
    COLOR_HEX_FALLBACKS["not specified"]
  );
}

/** Relative luminance (0–1) of a #RRGGBB hex, for contrast decisions. */
function luminance(hex: string): number {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) {
    return 0.5;
  }
  const int = parseInt(match[1], 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

const SIZE_CLASSES = {
  sm: "size-3",
  md: "size-4",
  lg: "size-6",
} as const;

const LABEL_CLASSES = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-sm",
} as const;

type ColorSwatchProps = {
  colorName: string;
  hex?: string | null;
  family?: string | null;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
};

/**
 * A circular color chip resolved from an explicit hex or a name/family
 * fallback. Light colors get a stronger border for contrast; metallics use a
 * subtle gradient. Accessible: labelled for screen readers.
 */
export function ColorSwatch({
  colorName,
  hex,
  family,
  size = "md",
  showLabel = false,
  className,
}: ColorSwatchProps) {
  const resolved = resolveColorHex(colorName, hex, family);
  const isLight = luminance(resolved) > 0.8;
  const isMetallic = METALLIC.has(normalize(colorName));

  const swatchStyle = isMetallic
    ? {
        backgroundImage: `linear-gradient(135deg, ${resolved} 0%, #ffffff 45%, ${resolved} 100%)`,
      }
    : { backgroundColor: resolved };

  const swatch = (
    <span
      aria-hidden={showLabel}
      aria-label={showLabel ? undefined : `Color: ${colorName}`}
      role={showLabel ? undefined : "img"}
      title={colorName}
      className={cn(
        "inline-block shrink-0 rounded-full ring-1 ring-inset ring-foreground/15",
        isLight && "border border-foreground/25",
        SIZE_CLASSES[size],
        !showLabel && className,
      )}
      style={swatchStyle}
    />
  );

  if (!showLabel) {
    return swatch;
  }

  return (
    <span
      className={cn("inline-flex items-center gap-1.5", className)}
      aria-label={`Color: ${colorName}`}
    >
      {swatch}
      <span className={cn("text-foreground", LABEL_CLASSES[size])}>
        {colorName}
      </span>
    </span>
  );
}
