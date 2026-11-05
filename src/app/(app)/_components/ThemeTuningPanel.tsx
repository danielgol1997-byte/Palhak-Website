"use client";

import { useState } from "react";
import type { ThemeTuning } from "@/lib/theme";
import { DEFAULT_TUNING, GIRLY_MAX_TUNING } from "@/lib/theme-tuning";

type SliderDef = { key: keyof ThemeTuning; label: string; min: number; max: number; step: number; hint?: string };

const GROUPS: { id: string; title: string; emoji: string; sliders: SliderDef[]; toggles?: { key: keyof ThemeTuning; label: string }[] }[] = [
  {
    id: "3d",
    title: "תלת־ממד ותנועה",
    emoji: "🧊",
    sliders: [
      { key: "tiltDivisor", label: "הטיה בעכבר", min: 8, max: 44, step: 1, hint: "נמוך = דרמטי יותר" },
      { key: "tileDepthZ", label: "עומק (Z)", min: 28, max: 110, step: 2 },
      { key: "perspectivePx", label: "פרספקטיבה", min: 560, max: 1500, step: 20 },
      { key: "hoverPop", label: "קפיצה במעבר עכבר", min: 1.02, max: 1.18, step: 0.01 },
    ],
    toggles: [
      { key: "cardFloat", label: "כרטיסים מרחפים" },
      { key: "cardWiggle", label: "רעדון חמוד" },
    ],
  },
  {
    id: "surface",
    title: "צבע, מסגרת וזכוכית",
    emoji: "🎨",
    sliders: [
      { key: "borderAccentMix", label: "מסגרת צבעונית", min: 0, max: 100, step: 2 },
      { key: "rainbowBorder", label: "מסגרת קשת", min: 0, max: 1, step: 0.05 },
      { key: "rainbowSpeedSec", label: "מהירות קשת (שנ׳)", min: 2, max: 10, step: 0.5 },
      { key: "cardSaturate", label: "נגיעת אקסנט בכרטיס", min: 88, max: 160, step: 2 },
      { key: "cardGlassBlur", label: "זכוכית מטושטשת", min: 0, max: 22, step: 1 },
      { key: "cardRadiusPx", label: "עיגול פינות", min: 14, max: 40, step: 1 },
    ],
  },
  {
    id: "light",
    title: "אור וצל",
    emoji: "💡",
    sliders: [
      { key: "glimmerStrength", label: "זוהר עכבר", min: 0, max: 0.42, step: 0.02 },
      { key: "iconGlowBlur", label: "הילה סביב אייקון", min: 0, max: 36, step: 2 },
      { key: "shadowBoost", label: "צל דרמטי", min: 0, max: 1, step: 0.05 },
    ],
  },
  {
    id: "atmo",
    title: "אווירה כללית",
    emoji: "🌫️",
    sliders: [
      { key: "globalSaturate", label: "רוויה כללית", min: 82, max: 128, step: 2 },
      { key: "grainOpacity", label: "גרעיניות פילם", min: 0, max: 0.12, step: 0.005 },
      { key: "cornerBows", label: "קישוטי פינות", min: 0, max: 3, step: 1 },
    ],
  },
];

const PRESET_BUTTONS: { label: string; patch: Partial<ThemeTuning>; emphasis?: boolean }[] = [
  { label: "עדין", patch: {} },
  { label: "נקי", patch: { tiltDivisor: 36, glimmerStrength: 0.04, borderAccentMix: 6, shadowBoost: 0.2, hoverPop: 1.03, cardRadiusPx: 18, iconGlowBlur: 6 } },
  { label: "מודרני", patch: { tiltDivisor: 22, glimmerStrength: 0.14, borderAccentMix: 28, shadowBoost: 0.5, cardGlassBlur: 6, cardRadiusPx: 22, iconGlowBlur: 16 } },
  { label: "מסיבה 💃", patch: { tiltDivisor: 16, glimmerStrength: 0.22, borderAccentMix: 40, rainbowBorder: 0.35, cardFloat: true, hoverPop: 1.1, shadowBoost: 0.55, cardSaturate: 120, cornerBows: 1 } },
  { label: "👑 מקסימום נסיכות", patch: GIRLY_MAX_TUNING, emphasis: true },
];

export function ThemeTuningPanel({
  value,
  onChange,
  labelColor,
  mutedColor,
}: {
  value: ThemeTuning;
  onChange: (t: ThemeTuning) => void;
  labelColor: string;
  mutedColor: string;
}) {
  const [openGroup, setOpenGroup] = useState<string | null>("3d");
  const set = (patch: Partial<ThemeTuning>) => onChange({ ...value, ...patch });
  const groupIsDefault = (g: (typeof GROUPS)[number]) =>
    g.sliders.every((s) => value[s.key] === DEFAULT_TUNING[s.key]) &&
    (g.toggles ?? []).every((t) => value[t.key] === DEFAULT_TUNING[t.key]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {PRESET_BUTTONS.map((b) => (
          <button
            key={b.label}
            type="button"
            onClick={() => onChange({ ...DEFAULT_TUNING, ...b.patch, customColors: value.customColors, fontScale: value.fontScale, reduceMotion: value.reduceMotion })}
            className={`min-h-9 rounded-lg border px-3 py-1.5 text-xs font-bold transition hover:scale-105 active:scale-95 ${b.emphasis ? "border-2" : ""}`}
            style={{
              borderColor: b.emphasis ? labelColor : `${labelColor}55`,
              color: labelColor,
              background: b.emphasis ? `linear-gradient(135deg, ${labelColor}22, transparent)` : "transparent",
            }}
          >
            {b.label}
          </button>
        ))}
      </div>

      {GROUPS.map((g) => {
        const open = openGroup === g.id;
        return (
          <div key={g.id} className="rounded-xl border" style={{ borderColor: `${labelColor}30` }}>
            <button
              type="button"
              onClick={() => setOpenGroup(open ? null : g.id)}
              className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-start"
              aria-expanded={open}
            >
              <span className="text-base leading-none">{g.emoji}</span>
              <span className="flex-1 text-sm font-bold" style={{ color: labelColor }}>
                {g.title}
              </span>
              {!groupIsDefault(g) && (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `${labelColor}22`, color: labelColor }}>
                  שונה
                </span>
              )}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: mutedColor, transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}>
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {open && (
              <div className="space-y-3 border-t px-3 pb-3 pt-3" style={{ borderColor: `${labelColor}22` }}>
                {g.toggles && (
                  <div className="flex flex-wrap gap-4">
                    {g.toggles.map((t) => (
                      <label key={t.key} className="flex min-h-9 cursor-pointer items-center gap-2 text-xs font-bold">
                        <input
                          type="checkbox"
                          checked={Boolean(value[t.key])}
                          onChange={(e) => set({ [t.key]: e.target.checked } as Partial<ThemeTuning>)}
                          className="h-5 w-5 rounded"
                          style={{ accentColor: labelColor }}
                        />
                        <span style={{ color: labelColor }}>{t.label}</span>
                      </label>
                    ))}
                  </div>
                )}
                {g.sliders.map((s) => (
                  <div key={s.key}>
                    <div className="mb-1 flex items-baseline justify-between text-[11px] font-bold">
                      <span style={{ color: labelColor }}>
                        {s.label}
                        {s.hint && <span className="ms-1 font-normal" style={{ color: mutedColor }}>· {s.hint}</span>}
                      </span>
                      <span style={{ color: mutedColor }}>{Number(value[s.key]).toFixed(s.step < 1 ? 2 : 0)}</span>
                    </div>
                    <input
                      type="range"
                      min={s.min}
                      max={s.max}
                      step={s.step}
                      value={Number(value[s.key])}
                      onChange={(e) => set({ [s.key]: parseFloat(e.target.value) } as Partial<ThemeTuning>)}
                      className="h-6 w-full cursor-pointer appearance-none bg-transparent"
                      style={{ accentColor: labelColor }}
                      aria-label={s.label}
                    />
                  </div>
                ))}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      const patch: Partial<ThemeTuning> = {};
                      for (const s of g.sliders) (patch as Record<string, unknown>)[s.key] = DEFAULT_TUNING[s.key];
                      for (const t of g.toggles ?? []) (patch as Record<string, unknown>)[t.key] = DEFAULT_TUNING[t.key];
                      set(patch);
                    }}
                    className="text-[11px] font-bold underline-offset-2 hover:underline"
                    style={{ color: mutedColor }}
                  >
                    אפס קבוצה
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
