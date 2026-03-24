"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import type { ThemeTuning } from "@/lib/theme";
import {
  THEME_PRESETS,
  THEME_EFFECTS,
  getResolvedPreset,
  applyThemeVarsToRoot,
  DEFAULT_THEME,
} from "@/lib/theme";
import { DEFAULT_TUNING } from "@/lib/theme-tuning";
import { saveThemeAction } from "@/app/(app)/_actions/saveTheme";
import { ThemeTuningPanel } from "./ThemeTuningPanel";

function applyThemeToDOM(presetId: string, effect: string, tuning: ThemeTuning) {
  applyThemeVarsToRoot(presetId, effect, tuning);
  window.dispatchEvent(
    new CustomEvent("yuval-theme-change", {
      detail: { effect, preset: presetId, tuning },
    })
  );
}

function tuningJsonEqual(a: ThemeTuning, b: ThemeTuning) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function WandIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="m15 4-1 1" /><path d="m19 8-1 1" /><path d="m10 14 8-8" />
      <path d="m14 10 1.5-1.5" /><path d="M3 21l9-9" />
      <path d="m4 4 1 1" /><path d="m8 4-1 1" /><path d="m4 8 1-1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <polyline points="20 6 9 17 4 12" />
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
  const [selectedPreset, setSelectedPreset] = useState(initialPreset);
  const [selectedEffect, setSelectedEffect] = useState(initialEffect);
  const [selectedTuning, setSelectedTuning] = useState<ThemeTuning>(initialTuning);
  const [savedPreset, setSavedPreset] = useState(initialPreset);
  const [savedEffect, setSavedEffect] = useState(initialEffect);
  const [savedTuning, setSavedTuning] = useState<ThemeTuning>(initialTuning);
  const [isPending, startTransition] = useTransition();
  const [justSaved, setJustSaved] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const hasChanges =
    selectedPreset !== savedPreset ||
    selectedEffect !== savedEffect ||
    !tuningJsonEqual(selectedTuning, savedTuning);
  const currentPreset = getResolvedPreset(selectedPreset);
  const isFactoryDefault =
    savedPreset === DEFAULT_THEME.preset &&
    savedEffect === DEFAULT_THEME.effect &&
    tuningJsonEqual(savedTuning, DEFAULT_TUNING);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function handlePresetSelect(id: string) {
    setSelectedPreset(id);
    applyThemeToDOM(id, selectedEffect, selectedTuning);
  }

  function handleEffectSelect(id: string) {
    setSelectedEffect(id);
    applyThemeToDOM(selectedPreset, id, selectedTuning);
  }

  function persist(
    presetId: string,
    effectId: string,
    tuning: ThemeTuning,
    onOk?: () => void
  ) {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("preset", presetId);
      fd.append("effect", effectId);
      fd.append("tuning", JSON.stringify(tuning));
      const result = await saveThemeAction(fd);
      if (result.success) {
        setSavedPreset(presetId);
        setSavedEffect(effectId);
        setSavedTuning(tuning);
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2200);
        onOk?.();
      }
    });
  }

  function handleSave() {
    persist(selectedPreset, selectedEffect, selectedTuning);
  }

  function handleRevert() {
    setSelectedPreset(savedPreset);
    setSelectedEffect(savedEffect);
    setSelectedTuning(savedTuning);
    applyThemeToDOM(savedPreset, savedEffect, savedTuning);
  }

  function handleFactoryReset() {
    if (
      !confirm(
        "לאפס את המראה למצב המקורי של אשר (רקע כהה, ללא אפקטים, כרטיסים ברירת מחדל) לכל המשתמשים במערכת?"
      )
    ) {
      return;
    }
    const t = { ...DEFAULT_TUNING };
    setSelectedPreset(DEFAULT_THEME.preset);
    setSelectedEffect(DEFAULT_THEME.effect);
    setSelectedTuning(t);
    applyThemeToDOM(DEFAULT_THEME.preset, DEFAULT_THEME.effect, t);
    persist(DEFAULT_THEME.preset, DEFAULT_THEME.effect, t);
  }

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen((o) => !o)}
        title="סטודיו עיצוב יובל"
        className="relative flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-300 hover:scale-105 active:scale-95"
        style={{
          color: currentPreset.accent,
          background: `${currentPreset.accent}15`,
          border: `1px solid ${currentPreset.accent}40`,
          boxShadow: open ? `0 0 18px ${currentPreset.accent}40` : `0 0 8px ${currentPreset.accent}20`,
        }}
      >
        <WandIcon />
        <span className="hidden sm:inline text-xs tracking-wide">עיצוב</span>
        {hasChanges && (
          <span
            className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full animate-pulse"
            style={{ backgroundColor: currentPreset.accent }}
          />
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute left-0 top-full mt-2 z-50 w-[min(100vw-1.5rem,520px)] sm:w-[min(96vw,560px)] rounded-2xl p-5 shadow-2xl max-h-[min(90dvh,780px)] flex flex-col gap-4"
          style={{
            background: `linear-gradient(145deg, ${currentPreset.surface}f2 0%, ${currentPreset.bg}fa 50%, color-mix(in srgb, ${currentPreset.accent} 12%, ${currentPreset.surface}) 100%)`,
            border: `1px solid ${currentPreset.accent}35`,
            boxShadow: `0 28px 80px rgba(0,0,0,0.55), 0 0 0 1px ${currentPreset.accent}18, inset 0 1px 0 ${currentPreset.accent}20`,
            backdropFilter: "blur(28px)",
          }}
          dir="rtl"
        >
          <div className="flex items-center justify-between gap-2 shrink-0">
            <div>
              <h3
                className="text-base font-black tracking-tight"
                style={{ color: currentPreset.accent }}
              >
                ✨ סטודיו עיצוב
              </h3>
              <p className="text-[11px] mt-0.5" style={{ color: currentPreset.fgMuted }}>
                חוויה מלאה — רקע, צבעים ואפקטים לכולם
              </p>
            </div>
            <div
              className="text-xs px-2.5 py-1 rounded-full font-bold shrink-0"
              style={{
                background: `${currentPreset.accent}18`,
                color: currentPreset.accent,
                border: `1px solid ${currentPreset.accent}35`,
              }}
            >
              יובל על חלל
            </div>
          </div>

          {/* Factory reset — always visible */}
          <button
            type="button"
            onClick={handleFactoryReset}
            disabled={isPending}
            className="w-full rounded-xl py-3 px-4 text-sm font-black transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed border-2 border-dashed"
            style={{
              borderColor: isFactoryDefault ? currentPreset.border : "#64748b",
              background: isFactoryDefault
                ? `${currentPreset.surface}60`
                : "linear-gradient(135deg, rgba(15,23,42,0.85) 0%, rgba(30,41,59,0.9) 100%)",
              color: isFactoryDefault ? currentPreset.fgMuted : "#e2e8f0",
            }}
          >
            🔄 איפוס למראה המקורי של אשר
            <span className="block text-[10px] font-semibold opacity-80 mt-1">
              חוזרים לרקע הכהה הקלאסי, בלי אפקטים — לכל המשתמשים
            </span>
          </button>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1 space-y-5 -mr-1">
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-[0.15em] mb-2"
                style={{ color: currentPreset.fgMuted }}
              >
                ערכות צבע ({THEME_PRESETS.length})
              </p>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-[min(38vh,280px)] overflow-y-auto pb-1">
                {THEME_PRESETS.map((p) => {
                  const rp = getResolvedPreset(p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => handlePresetSelect(p.id)}
                      title={p.name}
                      className="relative flex flex-col items-center gap-1 rounded-xl p-1.5 transition-all duration-200 hover:scale-105 active:scale-95"
                      style={{
                        background:
                          selectedPreset === p.id ? `${rp.accent}28` : `${rp.bg}99`,
                        border: `1px solid ${selectedPreset === p.id ? rp.accent : rp.border}`,
                        boxShadow:
                          selectedPreset === p.id ? `0 0 14px ${rp.accent}45` : "none",
                      }}
                    >
                      <div
                        className="w-7 h-7 rounded-full shrink-0"
                        style={{
                          background: `linear-gradient(135deg, ${rp.accent} 0%, ${rp.accent2} 100%)`,
                          boxShadow: `0 0 10px ${rp.glow}`,
                        }}
                      />
                      <span
                        className="text-[8px] font-bold text-center leading-tight line-clamp-2 min-h-[2rem]"
                        style={{
                          color: selectedPreset === p.id ? rp.accent : rp.fg,
                        }}
                      >
                        {p.emoji} {p.name}
                      </span>
                      {selectedPreset === p.id && (
                        <div
                          className="absolute top-0.5 left-0.5 rounded-full p-0.5"
                          style={{ background: rp.accent, color: rp.bg }}
                        >
                          <CheckIcon />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-[0.15em] mb-2"
                style={{ color: currentPreset.fgMuted }}
              >
                אפקטי רקע
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {THEME_EFFECTS.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => handleEffectSelect(e.id)}
                    className="flex flex-col items-center gap-1 rounded-xl px-1.5 py-2 transition-all duration-200 hover:scale-105 active:scale-95"
                    style={{
                      background:
                        selectedEffect === e.id
                          ? `${currentPreset.accent}24`
                          : `${currentPreset.surface}90`,
                      border: `1px solid ${selectedEffect === e.id ? currentPreset.accent : currentPreset.border}`,
                      boxShadow:
                        selectedEffect === e.id
                          ? `0 0 10px ${currentPreset.accent}35`
                          : "none",
                    }}
                  >
                    <span className="text-base leading-none">{e.emoji}</span>
                    <span
                      className="text-[8px] font-bold text-center leading-tight line-clamp-2"
                      style={{
                        color:
                          selectedEffect === e.id
                            ? currentPreset.accent
                            : currentPreset.fgMuted,
                      }}
                    >
                      {e.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-[0.15em] mb-2"
                style={{ color: currentPreset.fgMuted }}
              >
                כרטיסים תלת־ממד + קסם 🎀
              </p>
              <ThemeTuningPanel
                value={selectedTuning}
                onChange={(t) => {
                  setSelectedTuning(t);
                  applyThemeToDOM(selectedPreset, selectedEffect, t);
                }}
                labelColor={currentPreset.accent}
                mutedColor={currentPreset.fgMuted}
              />
            </div>
          </div>

          <div
            className="rounded-xl p-3 flex items-center gap-3 shrink-0"
            style={{
              background: `${currentPreset.bg}90`,
              border: `1px solid ${currentPreset.border}`,
            }}
          >
            <div
              className="w-11 h-11 rounded-xl flex-shrink-0"
              style={{
                background: `linear-gradient(135deg, ${currentPreset.accent}, ${currentPreset.accent2})`,
                boxShadow: `0 0 18px ${currentPreset.glow}`,
              }}
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold truncate" style={{ color: currentPreset.accent }}>
                {THEME_PRESETS.find((p) => p.id === selectedPreset)?.name}
              </div>
              <div className="text-xs truncate" style={{ color: currentPreset.fgMuted }}>
                {THEME_EFFECTS.find((e) => e.id === selectedEffect)?.name}
                {currentPreset.mode === "light" ? " · בהיר ומלא" : " · כהה"}
              </div>
            </div>
            {hasChanges && (
              <div
                className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                style={{
                  background: `${currentPreset.accent}22`,
                  color: currentPreset.accent,
                }}
              >
                תצוגה מקדימה
              </div>
            )}
          </div>

          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleSave}
              disabled={isPending || (!hasChanges && !justSaved)}
              className="flex-1 rounded-xl py-2.5 text-sm font-bold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: justSaved
                  ? "#16a34a"
                  : hasChanges
                    ? `linear-gradient(135deg, ${currentPreset.accent} 0%, ${currentPreset.accent2} 100%)`
                    : `${currentPreset.accent}35`,
                color: justSaved
                  ? "#fff"
                  : hasChanges
                    ? currentPreset.mode === "light"
                      ? "#ffffff"
                      : "#09090b"
                    : currentPreset.fgMuted,
                boxShadow: hasChanges ? `0 4px 24px ${currentPreset.accent}50` : "none",
              }}
            >
              {isPending ? "שומר..." : justSaved ? "✓ נשמר לכולם!" : "שמור ופרסם לכולם"}
            </button>
            {hasChanges && (
              <button
                onClick={handleRevert}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: `${currentPreset.surface}90`,
                  color: currentPreset.fgMuted,
                  border: `1px solid ${currentPreset.border}`,
                }}
              >
                ביטול
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
