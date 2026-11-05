"use client";

import { useMemo, useState, useTransition } from "react";
import type { ThemeTuning } from "@/lib/theme";
import {
  THEME_PRESETS,
  THEME_EFFECTS,
  THEME_CATEGORIES,
  CUSTOM_PRESET_ID,
  getResolvedPreset,
  customColorsFromPreset,
  applyThemeVarsToRoot,
  DEFAULT_THEME,
  type ThemeCategory,
} from "@/lib/theme";
import { DEFAULT_TUNING, type CustomColors } from "@/lib/theme-tuning";
import { saveThemeAction } from "@/app/(app)/_actions/saveTheme";
import { ThemeTuningPanel } from "./ThemeTuningPanel";
import { Sheet } from "@/components/ui/Sheet";

function applyThemeToDOM(presetId: string, effect: string, tuning: ThemeTuning) {
  applyThemeVarsToRoot(presetId, effect, tuning);
  window.dispatchEvent(new CustomEvent("yuval-theme-change", { detail: { effect, preset: presetId, tuning } }));
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

type Tab = "presets" | "effects" | "cards" | "colors" | "general";
const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: "presets", label: "ערכות", emoji: "🎨" },
  { id: "effects", label: "אפקטים", emoji: "✨" },
  { id: "cards", label: "כרטיסים", emoji: "🧊" },
  { id: "colors", label: "צבעים", emoji: "🖌️" },
  { id: "general", label: "כללי", emoji: "⚙️" },
];

const COLOR_FIELDS: { key: keyof Omit<CustomColors, "mode">; label: string }[] = [
  { key: "bg", label: "רקע" },
  { key: "surface", label: "משטח (כרטיסים)" },
  { key: "border", label: "מסגרות" },
  { key: "accent", label: "צבע ראשי" },
  { key: "accent2", label: "צבע משני" },
  { key: "fg", label: "טקסט" },
  { key: "fgMuted", label: "טקסט משני" },
];

function WandIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
      <path d="m15 4-1 1" /><path d="m19 8-1 1" /><path d="m10 14 8-8" />
      <path d="m14 10 1.5-1.5" /><path d="M3 21l9-9" />
      <path d="m4 4 1 1" /><path d="m8 4-1 1" /><path d="m4 8 1-1" />
    </svg>
  );
}

export function ThemeDesigner({
  initialPreset,
  initialEffect,
  initialTuning,
}: {
  initialPreset: string;
  initialEffect: string;
  initialTuning: ThemeTuning;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("presets");
  const [category, setCategory] = useState<ThemeCategory | "all">("all");
  const [query, setQuery] = useState("");

  const [preset, setPreset] = useState(initialPreset);
  const [effect, setEffect] = useState(initialEffect);
  const [tuning, setTuning] = useState<ThemeTuning>(initialTuning);
  const [saved, setSaved] = useState({ preset: initialPreset, effect: initialEffect, tuning: initialTuning });
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const hasChanges = preset !== saved.preset || effect !== saved.effect || !same(tuning, saved.tuning);
  const current = getResolvedPreset(preset, tuning);
  const isFactory = saved.preset === DEFAULT_THEME.preset && saved.effect === DEFAULT_THEME.effect && same(saved.tuning, DEFAULT_TUNING);

  const apply = (p = preset, e = effect, t = tuning) => applyThemeToDOM(p, e, t);

  const choosePreset = (id: string) => {
    setPreset(id);
    apply(id, effect, tuning);
  };
  const chooseEffect = (id: string) => {
    setEffect(id);
    apply(preset, id, tuning);
  };
  const changeTuning = (t: ThemeTuning) => {
    setTuning(t);
    apply(preset, effect, t);
  };

  const persist = (p: string, e: string, t: ThemeTuning) => {
    setStatus(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("preset", p);
      fd.append("effect", e);
      fd.append("tuning", JSON.stringify(t));
      const result = await saveThemeAction(fd);
      if (result.success) {
        setSaved({ preset: p, effect: e, tuning: t });
        setStatus({ kind: "ok", text: "נשמר ופורסם לכל המשתמשים ✓" });
        setTimeout(() => setStatus(null), 2500);
      } else {
        setStatus({ kind: "err", text: result.error ?? "השמירה נכשלה" });
      }
    });
  };

  const revert = () => {
    setPreset(saved.preset);
    setEffect(saved.effect);
    setTuning(saved.tuning);
    apply(saved.preset, saved.effect, saved.tuning);
  };

  const factoryReset = () => {
    if (!confirm("לאפס את המראה למצב המקורי של אשר (רקע כהה, ללא אפקטים) לכל המשתמשים?")) return;
    const t = { ...DEFAULT_TUNING };
    setPreset(DEFAULT_THEME.preset);
    setEffect(DEFAULT_THEME.effect);
    setTuning(t);
    apply(DEFAULT_THEME.preset, DEFAULT_THEME.effect, t);
    persist(DEFAULT_THEME.preset, DEFAULT_THEME.effect, t);
  };

  const shuffle = () => {
    const pool = THEME_PRESETS.filter((p) => p.id !== preset);
    const p = pool[Math.floor(Math.random() * pool.length)]!.id;
    const e = THEME_EFFECTS[Math.floor(Math.random() * THEME_EFFECTS.length)]!.id;
    const t: ThemeTuning = {
      ...tuning,
      tiltDivisor: 12 + Math.round(Math.random() * 24),
      glimmerStrength: Math.round(Math.random() * 30) / 100,
      borderAccentMix: Math.round(Math.random() * 60),
      rainbowBorder: Math.random() < 0.3 ? Math.round(Math.random() * 60) / 100 : 0,
      cardFloat: Math.random() < 0.4,
      cardWiggle: Math.random() < 0.2,
      shadowBoost: Math.round(Math.random() * 80) / 100,
      cardGlassBlur: Math.random() < 0.5 ? Math.round(Math.random() * 10) : 0,
    };
    setPreset(p);
    setEffect(e);
    setTuning(t);
    apply(p, e, t);
    setTab("presets");
  };

  const customColors: CustomColors = tuning.customColors ?? customColorsFromPreset(preset, tuning);
  const setCustom = (patch: Partial<CustomColors>) => {
    const next = { ...customColors, ...patch };
    const t = { ...tuning, customColors: next };
    setTuning(t);
    setPreset(CUSTOM_PRESET_ID);
    apply(CUSTOM_PRESET_ID, effect, t);
  };

  const exportJson = async () => {
    const payload = JSON.stringify({ preset, effect, tuning }, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      setStatus({ kind: "ok", text: "ההגדרות הועתקו ללוח" });
    } catch {
      prompt("העתק את ההגדרות:", payload);
    }
  };
  const importJson = () => {
    const raw = prompt("הדבק הגדרות עיצוב (JSON):");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { preset?: string; effect?: string; tuning?: Partial<ThemeTuning> };
      const p = typeof parsed.preset === "string" ? parsed.preset : preset;
      const e = typeof parsed.effect === "string" ? parsed.effect : effect;
      const t = { ...DEFAULT_TUNING, ...(parsed.tuning ?? {}) } as ThemeTuning;
      setPreset(p);
      setEffect(e);
      setTuning(t);
      apply(p, e, t);
      setStatus({ kind: "ok", text: "ההגדרות יובאו (לא נשמרו עדיין)" });
    } catch {
      setStatus({ kind: "err", text: "JSON לא תקין" });
    }
  };

  const visiblePresets = useMemo(() => {
    const q = query.trim();
    return THEME_PRESETS.filter((p) => (category === "all" || (p.category ?? "classic") === category) && (!q || p.name.includes(q)));
  }, [category, query]);

  const accent = current.accent;
  const muted = current.fgMuted;

  return (
    <>
      <button
        type="button"
        data-view-ok="true"
        onClick={() => setOpen(true)}
        aria-label="סטודיו עיצוב"
        title="סטודיו עיצוב"
        className="relative flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-sm font-semibold transition-all duration-300 hover:scale-105 active:scale-95 sm:px-3"
        style={{
          color: accent,
          background: `${accent}15`,
          border: `1px solid ${accent}40`,
          boxShadow: open ? `0 0 18px ${accent}40` : `0 0 8px ${accent}20`,
        }}
      >
        <WandIcon />
        <span className="hidden text-xs tracking-wide lg:inline">עיצוב</span>
        {hasChanges && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 animate-pulse rounded-full" style={{ backgroundColor: accent }} />}
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="✨ סטודיו עיצוב"
        subtitle="רקע, צבעים, כרטיסים ואפקטים — לכל המשתמשים"
        size="lg"
        bodyClassName="!p-0"
        headerExtra={
          <div className="ui-hscroll mt-3 -mx-1 px-1" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className="min-h-9 rounded-full border px-3 text-xs font-bold transition"
                style={{
                  borderColor: tab === t.id ? accent : `${accent}35`,
                  background: tab === t.id ? `${accent}22` : "transparent",
                  color: tab === t.id ? accent : muted,
                }}
              >
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
        }
        footer={
          <div className="flex flex-col gap-2">
            {status && (
              <div className={`rounded-lg px-3 py-2 text-xs font-bold ${status.kind === "ok" ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>{status.text}</div>
            )}
            <div className="flex items-center gap-2">
              <div className="hidden min-w-0 flex-1 items-center gap-2 sm:flex">
                <div className="h-8 w-8 shrink-0 rounded-lg" style={{ background: `linear-gradient(135deg, ${current.accent}, ${current.accent2})`, boxShadow: `0 0 12px ${current.glow}` }} />
                <div className="min-w-0">
                  <div className="truncate text-xs font-bold" style={{ color: accent }}>{current.name}</div>
                  <div className="truncate text-[10px]" style={{ color: muted }}>
                    {THEME_EFFECTS.find((e) => e.id === effect)?.name} · {current.mode === "light" ? "בהיר" : "כהה"}
                    {hasChanges ? " · תצוגה מקדימה" : ""}
                  </div>
                </div>
              </div>
              {hasChanges && (
                <button type="button" onClick={revert} className="h-11 rounded-xl border px-4 text-sm font-semibold" style={{ borderColor: current.border, color: muted }}>
                  ביטול
                </button>
              )}
              <button
                type="button"
                data-write="true"
                onClick={() => persist(preset, effect, tuning)}
                disabled={isPending || !hasChanges}
                className="h-11 flex-1 rounded-xl text-sm font-bold transition hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none sm:px-6"
                style={{
                  background: hasChanges ? `linear-gradient(135deg, ${current.accent}, ${current.accent2})` : `${accent}35`,
                  color: hasChanges ? (current.mode === "light" ? "#fff" : "#09090b") : muted,
                  boxShadow: hasChanges ? `0 4px 24px ${accent}50` : "none",
                }}
              >
                {isPending ? "שומר…" : "שמור ופרסם לכולם"}
              </button>
            </div>
          </div>
        }
      >
        <div className="px-4 py-4 sm:px-6" style={{ color: current.fg }}>
          {/* Live preview strip */}
          <div
            className="mb-4 flex items-center gap-3 rounded-2xl border p-3"
            style={{ background: current.surface, borderColor: current.border, boxShadow: `0 10px 30px ${current.glow}` }}
          >
            <div className="theme-3d-card-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
              <WandIcon />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-black" style={{ color: current.fg }}>תצוגה מקדימה</div>
              <div className="text-xs" style={{ color: current.fgMuted }}>כך ייראו כרטיסים, טקסט ומסגרות</div>
            </div>
            <div className="flex gap-1">
              {[current.bg, current.surface, current.accent, current.accent2].map((c, i) => (
                <span key={i} className="h-6 w-6 rounded-md border" style={{ background: c, borderColor: current.border }} />
              ))}
            </div>
          </div>

          {tab === "presets" && (
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="ui-hscroll flex-1">
                  {[{ id: "all" as const, name: "הכל" }, ...THEME_CATEGORIES].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategory(c.id)}
                      className="min-h-9 rounded-full border px-3 text-xs font-bold"
                      style={{ borderColor: category === c.id ? accent : `${accent}30`, background: category === c.id ? `${accent}20` : "transparent", color: category === c.id ? accent : muted }}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="חיפוש ערכה…"
                  className="h-10 rounded-xl border bg-transparent px-3 text-sm outline-none sm:w-40"
                  style={{ borderColor: current.border, color: current.fg }}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {visiblePresets.map((p) => {
                  const rp = getResolvedPreset(p.id);
                  const active = preset === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => choosePreset(p.id)}
                      aria-pressed={active}
                      className="group relative overflow-hidden rounded-2xl border p-2.5 text-start transition hover:scale-[1.02] active:scale-[0.98]"
                      style={{ background: rp.bg, borderColor: active ? rp.accent : rp.border, boxShadow: active ? `0 0 0 2px ${rp.accent}66, 0 8px 24px ${rp.glow}` : "none" }}
                    >
                      <div className="mb-2 h-12 rounded-xl border" style={{ background: rp.surface, borderColor: rp.border }}>
                        <div className="flex h-full items-center gap-2 px-2">
                          <span className="h-6 w-6 rounded-lg" style={{ background: `linear-gradient(135deg, ${rp.accent}, ${rp.accent2})`, boxShadow: `0 0 10px ${rp.glow}` }} />
                          <span className="h-2 w-12 rounded-full" style={{ background: rp.fg, opacity: 0.85 }} />
                          <span className="h-2 w-6 rounded-full" style={{ background: rp.fgMuted, opacity: 0.7 }} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-xs font-bold" style={{ color: rp.fg }}>
                          {p.emoji} {p.name}
                        </span>
                        <span className="shrink-0 text-[10px]" style={{ color: rp.fgMuted }}>{rp.mode === "light" ? "☀️" : "🌙"}</span>
                      </div>
                      {active && (
                        <span className="absolute left-2 top-2 rounded-full px-1.5 py-0.5 text-[10px] font-black" style={{ background: rp.accent, color: rp.bg }}>✓</span>
                      )}
                    </button>
                  );
                })}
                {tuning.customColors && (
                  <button
                    type="button"
                    onClick={() => choosePreset(CUSTOM_PRESET_ID)}
                    className="rounded-2xl border-2 border-dashed p-2.5 text-start text-xs font-bold"
                    style={{ borderColor: preset === CUSTOM_PRESET_ID ? accent : `${accent}50`, color: accent, background: tuning.customColors.bg }}
                  >
                    🎨 מותאם אישית
                    <span className="mt-1 block text-[10px] font-normal" style={{ color: muted }}>הצבעים מהלשונית «צבעים»</span>
                  </button>
                )}
              </div>
              <button type="button" onClick={shuffle} className="min-h-10 w-full rounded-xl border text-sm font-bold" style={{ borderColor: `${accent}50`, color: accent }}>
                🎲 הפתע אותי
              </button>
            </div>
          )}

          {tab === "effects" && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {THEME_EFFECTS.map((e) => {
                const active = effect === e.id;
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => chooseEffect(e.id)}
                    aria-pressed={active}
                    className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-3 transition hover:scale-[1.03] active:scale-95"
                    style={{ background: active ? `${accent}22` : `${current.surface}`, borderColor: active ? accent : current.border, boxShadow: active ? `0 0 12px ${accent}35` : "none" }}
                  >
                    <span className="text-2xl leading-none">{e.emoji}</span>
                    <span className="text-center text-[11px] font-bold leading-tight" style={{ color: active ? accent : muted }}>{e.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          {tab === "cards" && <ThemeTuningPanel value={tuning} onChange={changeTuning} labelColor={accent} mutedColor={muted} />}

          {tab === "colors" && (
            <div className="space-y-4">
              <p className="text-xs" style={{ color: muted }}>
                בחר צבעים משלך. שינוי כאן עובר אוטומטית לערכה «מותאם אישית».
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setCustom(customColorsFromPreset(preset, tuning))} className="min-h-9 rounded-lg border px-3 text-xs font-bold" style={{ borderColor: `${accent}50`, color: accent }}>
                  התחל מהערכה הנוכחית
                </button>
                <button type="button" onClick={() => setCustom({ mode: customColors.mode === "light" ? "dark" : "light" })} className="min-h-9 rounded-lg border px-3 text-xs font-bold" style={{ borderColor: `${accent}50`, color: accent }}>
                  מצב: {customColors.mode === "light" ? "☀️ בהיר" : "🌙 כהה"}
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {COLOR_FIELDS.map((f) => (
                  <label key={f.key} className="flex items-center gap-3 rounded-xl border p-2" style={{ borderColor: current.border, background: current.surface }}>
                    <input
                      type="color"
                      value={customColors[f.key]}
                      onChange={(e) => setCustom({ [f.key]: e.target.value } as Partial<CustomColors>)}
                      className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0"
                      aria-label={f.label}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold" style={{ color: current.fg }}>{f.label}</div>
                      <input
                        value={customColors[f.key]}
                        onChange={(e) => /^#[0-9a-fA-F]{6}$/.test(e.target.value) && setCustom({ [f.key]: e.target.value } as Partial<CustomColors>)}
                        className="w-full bg-transparent font-mono text-[11px] outline-none"
                        style={{ color: muted }}
                        aria-label={`${f.label} (hex)`}
                      />
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {tab === "general" && (
            <div className="space-y-4">
              <div className="rounded-xl border p-3" style={{ borderColor: current.border, background: current.surface }}>
                <div className="mb-1 flex items-baseline justify-between text-xs font-bold">
                  <span style={{ color: accent }}>גודל טקסט כללי</span>
                  <span style={{ color: muted }}>{Math.round(tuning.fontScale * 100)}%</span>
                </div>
                <input type="range" min={0.9} max={1.15} step={0.025} value={tuning.fontScale} onChange={(e) => changeTuning({ ...tuning, fontScale: parseFloat(e.target.value) })} className="h-6 w-full" style={{ accentColor: accent }} aria-label="גודל טקסט" />
              </div>
              <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-3" style={{ borderColor: current.border, background: current.surface }}>
                <input type="checkbox" checked={tuning.reduceMotion} onChange={(e) => changeTuning({ ...tuning, reduceMotion: e.target.checked })} className="h-5 w-5" style={{ accentColor: accent }} />
                <span className="text-sm font-bold" style={{ color: current.fg }}>הפחתת תנועה</span>
                <span className="text-xs" style={{ color: muted }}>מכבה אפקטים ואנימציות לכולם</span>
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={exportJson} className="min-h-10 rounded-xl border px-4 text-xs font-bold" style={{ borderColor: `${accent}50`, color: accent }}>📋 העתק הגדרות</button>
                <button type="button" onClick={importJson} className="min-h-10 rounded-xl border px-4 text-xs font-bold" style={{ borderColor: `${accent}50`, color: accent }}>📥 הדבק הגדרות</button>
              </div>
              <button
                type="button"
                data-write="true"
                onClick={factoryReset}
                disabled={isPending}
                className="w-full rounded-xl border-2 border-dashed px-4 py-3 text-sm font-black transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40"
                style={{ borderColor: isFactory ? current.border : "#64748b", color: isFactory ? muted : current.fg, background: isFactory ? `${current.surface}60` : "linear-gradient(135deg, rgba(15,23,42,0.85), rgba(30,41,59,0.9))" }}
              >
                🔄 איפוס למראה המקורי של אשר
                <span className="mt-1 block text-[10px] font-semibold opacity-80">רקע כהה קלאסי, בלי אפקטים — לכל המשתמשים</span>
              </button>
            </div>
          )}
        </div>
      </Sheet>
    </>
  );
}
