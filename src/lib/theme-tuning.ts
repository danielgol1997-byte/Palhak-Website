import { z } from "zod";

/** Fine-grained controls — stored in SiteTheme.tuning (JSON). Super girly + 3D. */
export type ThemeTuning = {
  tiltDivisor: number;
  tileDepthZ: number;
  perspectivePx: number;
  glimmerStrength: number;
  borderAccentMix: number;
  rainbowBorder: number;
  cardFloat: boolean;
  cardWiggle: boolean;
  hoverPop: number;
  cardRadiusPx: number;
  iconGlowBlur: number;
  shadowBoost: number;
  cardSaturate: number;
  cardGlassBlur: number;
  globalSaturate: number;
  grainOpacity: number;
  cornerBows: number;
  rainbowSpeedSec: number;
};

export const ThemeTuningSchema = z.object({
  tiltDivisor: z.number().min(6).max(48),
  tileDepthZ: z.number().min(24).max(120),
  perspectivePx: z.number().min(520).max(1600),
  glimmerStrength: z.number().min(0).max(0.45),
  borderAccentMix: z.number().min(0).max(100),
  rainbowBorder: z.number().min(0).max(1),
  cardFloat: z.boolean(),
  cardWiggle: z.boolean(),
  hoverPop: z.number().min(1.02).max(1.18),
  cardRadiusPx: z.number().min(14).max(40),
  iconGlowBlur: z.number().min(0).max(36),
  shadowBoost: z.number().min(0).max(1),
  cardSaturate: z.number().min(85).max(165),
  cardGlassBlur: z.number().min(0).max(24),
  globalSaturate: z.number().min(80).max(130),
  grainOpacity: z.number().min(0).max(0.14),
  cornerBows: z.number().min(0).max(3),
  rainbowSpeedSec: z.number().min(2).max(10),
});

const PartialTuningSchema = ThemeTuningSchema.partial();

export const DEFAULT_TUNING: ThemeTuning = {
  tiltDivisor: 25,
  tileDepthZ: 60,
  perspectivePx: 1000,
  glimmerStrength: 0.12,
  borderAccentMix: 12,
  rainbowBorder: 0,
  cardFloat: false,
  cardWiggle: false,
  hoverPop: 1.06,
  cardRadiusPx: 24,
  iconGlowBlur: 14,
  shadowBoost: 0.35,
  cardSaturate: 108,
  cardGlassBlur: 0,
  globalSaturate: 100,
  grainOpacity: 0,
  cornerBows: 0,
  rainbowSpeedSec: 4,
};

export const GIRLY_MAX_TUNING: Partial<ThemeTuning> = {
  tiltDivisor: 12,
  tileDepthZ: 88,
  perspectivePx: 1180,
  glimmerStrength: 0.32,
  borderAccentMix: 72,
  rainbowBorder: 0.85,
  cardFloat: true,
  cardWiggle: true,
  hoverPop: 1.14,
  cardRadiusPx: 32,
  iconGlowBlur: 28,
  shadowBoost: 0.85,
  cardSaturate: 142,
  cardGlassBlur: 8,
  globalSaturate: 112,
  grainOpacity: 0.045,
  cornerBows: 3,
  rainbowSpeedSec: 3,
};

export function mergeTuning(stored: unknown): ThemeTuning {
  if (!stored || typeof stored !== "object") return { ...DEFAULT_TUNING };
  const parsed = PartialTuningSchema.safeParse(stored);
  if (!parsed.success) return { ...DEFAULT_TUNING };
  return { ...DEFAULT_TUNING, ...parsed.data };
}

function clampTuning(t: ThemeTuning): ThemeTuning {
  const r = ThemeTuningSchema.safeParse(t);
  return r.success ? r.data : { ...DEFAULT_TUNING };
}

export function tuningToCssVars(t: ThemeTuning): [string, string][] {
  const x = clampTuning(t);
  const cardSatMix = `${Math.min(20, Math.max(0, (x.cardSaturate - 100) * 0.28))}%`;
  return [
    ["--theme-tilt-divisor", String(x.tiltDivisor)],
    ["--theme-tile-z", `${x.tileDepthZ}px`],
    ["--theme-perspective", `${x.perspectivePx}px`],
    ["--theme-glimmer", String(x.glimmerStrength)],
    ["--theme-border-accent-mix", `${x.borderAccentMix}%`],
    ["--theme-rainbow-border", String(x.rainbowBorder)],
    ["--theme-hover-pop", String(x.hoverPop)],
    ["--theme-card-radius", `${x.cardRadiusPx}px`],
    ["--theme-icon-glow", `${x.iconGlowBlur}px`],
    ["--theme-shadow-boost", String(x.shadowBoost)],
    ["--theme-card-sat-mix", cardSatMix],
    ["--theme-card-glass", `${x.cardGlassBlur}px`],
    ["--theme-global-saturate", `${x.globalSaturate}%`],
    ["--theme-grain", String(x.grainOpacity)],
    ["--theme-corner-bows", String(x.cornerBows)],
    ["--theme-rainbow-speed", `${x.rainbowSpeedSec}s`],
  ];
}

export function applyTuningToDocumentElement(el: HTMLElement, tuning: ThemeTuning): void {
  const x = clampTuning(tuning);
  for (const [prop, val] of tuningToCssVars(x)) {
    el.style.setProperty(prop, val);
  }
  if (x.cardFloat) el.setAttribute("data-theme-card-float", "1");
  else el.removeAttribute("data-theme-card-float");
  if (x.cardWiggle) el.setAttribute("data-theme-card-wiggle", "1");
  else el.removeAttribute("data-theme-card-wiggle");
}

/** Assumes `d=document.documentElement` and `s=d.style` already exist. */
export function tuningScriptBody(tuning: ThemeTuning): string {
  const x = clampTuning(tuning);
  const parts: string[] = [];
  for (const [prop, val] of tuningToCssVars(x)) {
    parts.push(`s.setProperty(${JSON.stringify(prop)},${JSON.stringify(val)});`);
  }
  if (x.cardFloat) parts.push("d.setAttribute('data-theme-card-float','1');");
  else parts.push("d.removeAttribute('data-theme-card-float');");
  if (x.cardWiggle) parts.push("d.setAttribute('data-theme-card-wiggle','1');");
  else parts.push("d.removeAttribute('data-theme-card-wiggle');");
  return parts.join("");
}
