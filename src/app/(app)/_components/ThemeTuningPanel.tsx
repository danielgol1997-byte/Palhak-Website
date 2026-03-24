"use client";

import type { ThemeTuning } from "@/lib/theme";
import { DEFAULT_TUNING, GIRLY_MAX_TUNING } from "@/lib/theme-tuning";

const SLIDERS: {
  key: keyof ThemeTuning;
  label: string;
  min: number;
  max: number;
  step: number;
}[] = [
  { key: "tiltDivisor", label: "טיה 3D (נמוך = דרמטי יותר)", min: 8, max: 44, step: 1 },
  { key: "tileDepthZ", label: "עומק תלת־ממד (Z)", min: 28, max: 110, step: 2 },
  { key: "perspectivePx", label: "פרספקטיבה", min: 560, max: 1500, step: 20 },
  { key: "glimmerStrength", label: "זוהר עכבר על הכרטיס", min: 0, max: 0.42, step: 0.02 },
  { key: "borderAccentMix", label: "מסגרת צבעונית (אקסנט)", min: 0, max: 100, step: 2 },
  { key: "rainbowBorder", label: "מסגרת קשת בענן", min: 0, max: 1, step: 0.05 },
  { key: "hoverPop", label: "קפיצה במעבר עכבר", min: 1.02, max: 1.18, step: 0.01 },
  { key: "cardRadiusPx", label: "עיגול פינות כרטיס", min: 14, max: 40, step: 1 },
  { key: "iconGlowBlur", label: "הילה סביב האייקון", min: 0, max: 36, step: 2 },
  { key: "shadowBoost", label: "צל עמוק ודרמטי", min: 0, max: 1, step: 0.05 },
  { key: "cardSaturate", label: "נגיעת אקסנט בכרטיסים", min: 88, max: 160, step: 2 },
  { key: "cardGlassBlur", label: "זכוכית מטושטשת על כרטיס", min: 0, max: 22, step: 1 },
  { key: "globalSaturate", label: "רוויה כללית באפליקציה", min: 82, max: 128, step: 2 },
  { key: "grainOpacity", label: "גרעיניות קולנוע (פילם)", min: 0, max: 0.12, step: 0.005 },
  { key: "cornerBows", label: "פפיונים וקישוטים בפינות", min: 0, max: 3, step: 1 },
  { key: "rainbowSpeedSec", label: "מהירות מסגרת קשת (שניות)", min: 2, max: 10, step: 0.5 },
];

function mergePartial(base: ThemeTuning, patch: Partial<ThemeTuning>): ThemeTuning {
  return { ...base, ...patch };
}

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
  const set = (patch: Partial<ThemeTuning>) => onChange(mergePartial(value, patch));

  return (
    <div className="space-y-4 rounded-xl border border-dashed p-3" style={{ borderColor: `${labelColor}40` }}>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange({ ...DEFAULT_TUNING })}
          className="rounded-lg px-2.5 py-1.5 text-[10px] font-bold border transition-transform hover:scale-105 active:scale-95"
          style={{ borderColor: mutedColor, color: mutedColor }}
        >
          עדין
        </button>
        <button
          type="button"
          onClick={() =>
            onChange(
              mergePartial(DEFAULT_TUNING, {
                tiltDivisor: 16,
                glimmerStrength: 0.22,
                borderAccentMix: 40,
                rainbowBorder: 0.35,
                cardFloat: true,
                hoverPop: 1.1,
                shadowBoost: 0.55,
                cardSaturate: 120,
                cornerBows: 1,
              })
            )
          }
          className="rounded-lg px-2.5 py-1.5 text-[10px] font-bold border transition-transform hover:scale-105 active:scale-95"
          style={{ borderColor: labelColor, color: labelColor }}
        >
          מסיבה 💃
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...DEFAULT_TUNING, ...GIRLY_MAX_TUNING })}
          className="rounded-lg px-2.5 py-1.5 text-[10px] font-black border-2 transition-transform hover:scale-105 active:scale-95"
          style={{
            borderColor: labelColor,
            background: `linear-gradient(135deg, ${labelColor}22, transparent)`,
            color: labelColor,
          }}
        >
          👑 מקסימום נסיכות
        </button>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-[11px] font-bold cursor-pointer">
          <input
            type="checkbox"
            checked={value.cardFloat}
            onChange={(e) => set({ cardFloat: e.target.checked })}
            className="rounded border-zinc-600"
          />
          <span style={{ color: labelColor }}>כרטיסים מרחפים</span>
        </label>
        <label className="flex items-center gap-2 text-[11px] font-bold cursor-pointer">
          <input
            type="checkbox"
            checked={value.cardWiggle}
            onChange={(e) => set({ cardWiggle: e.target.checked })}
            className="rounded border-zinc-600"
          />
          <span style={{ color: labelColor }}>רעדון חמוד</span>
        </label>
      </div>

      <div className="grid max-h-[min(42vh,320px)] gap-3 overflow-y-auto pr-1">
        {SLIDERS.map((s) => (
          <div key={s.key}>
            <div className="flex justify-between text-[10px] font-bold mb-1" style={{ color: mutedColor }}>
              <span style={{ color: labelColor }}>{s.label}</span>
              <span>{Number(value[s.key]).toFixed(s.step < 1 ? 2 : 0)}</span>
            </div>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={Number(value[s.key])}
              onChange={(e) => set({ [s.key]: parseFloat(e.target.value) } as Partial<ThemeTuning>)}
              className="w-full h-2 rounded-full appearance-none cursor-pointer accent-pink-500"
              style={{ accentColor: labelColor }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
