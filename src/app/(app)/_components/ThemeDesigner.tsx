"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { THEME_PRESETS, THEME_EFFECTS, getPreset } from "@/lib/theme";
import { saveThemeAction } from "@/app/(app)/_actions/saveTheme";

function applyThemeToDOM(presetId: string, effect: string) {
  const p = getPreset(presetId);
  const s = document.documentElement.style;
  s.setProperty("--t-bg", p.bg);
  s.setProperty("--t-surface", p.surface);
  s.setProperty("--t-border", p.border);
  s.setProperty("--t-accent", p.accent);
  s.setProperty("--t-glow", p.glow);
  s.setProperty("--t-overlay", p.overlayColor);
  document.documentElement.setAttribute("data-effect", effect);
  window.dispatchEvent(
    new CustomEvent("yuval-theme-change", { detail: { effect, preset: presetId } })
  );
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
}: {
  initialPreset: string;
  initialEffect: string;
}) {
  const [open, setOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState(initialPreset);
  const [selectedEffect, setSelectedEffect] = useState(initialEffect);
  const [savedPreset, setSavedPreset] = useState(initialPreset);
  const [savedEffect, setSavedEffect] = useState(initialEffect);
  const [isPending, startTransition] = useTransition();
  const [justSaved, setJustSaved] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const hasChanges = selectedPreset !== savedPreset || selectedEffect !== savedEffect;
  const currentPreset = getPreset(selectedPreset);

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
    applyThemeToDOM(id, selectedEffect);
  }

  function handleEffectSelect(id: string) {
    setSelectedEffect(id);
    applyThemeToDOM(selectedPreset, id);
  }

  function handleSave() {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("preset", selectedPreset);
      fd.append("effect", selectedEffect);
      const result = await saveThemeAction(fd);
      if (result.success) {
        setSavedPreset(selectedPreset);
        setSavedEffect(selectedEffect);
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2200);
      }
    });
  }

  function handleRevert() {
    setSelectedPreset(savedPreset);
    setSelectedEffect(savedEffect);
    applyThemeToDOM(savedPreset, savedEffect);
  }

  return (
    <div className="relative">
      {/* Header button */}
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

      {/* Designer panel */}
      {open && (
        <div
          ref={panelRef}
          className="absolute left-0 top-full mt-2 z-50 w-[340px] sm:w-[400px] rounded-2xl p-5 shadow-2xl"
          style={{
            background: `linear-gradient(135deg, ${currentPreset.surface}f0 0%, ${currentPreset.bg}f8 100%)`,
            border: `1px solid ${currentPreset.accent}30`,
            boxShadow: `0 24px 64px rgba(0,0,0,0.8), 0 0 0 1px ${currentPreset.accent}20, inset 0 1px 0 ${currentPreset.accent}15`,
            backdropFilter: "blur(24px)",
          }}
          dir="rtl"
        >
          {/* Panel header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3
                className="text-base font-black tracking-tight"
                style={{ color: currentPreset.accent }}
              >
                ✨ סטודיו עיצוב
              </h3>
              <p className="text-[11px] mt-0.5" style={{ color: `${currentPreset.accent}80` }}>
                שינויים מיידיים לכולם
              </p>
            </div>
            <div
              className="text-xs px-2.5 py-1 rounded-full font-bold"
              style={{
                background: `${currentPreset.accent}18`,
                color: currentPreset.accent,
                border: `1px solid ${currentPreset.accent}35`,
              }}
            >
              יובל על חלל
            </div>
          </div>

          {/* Color Presets */}
          <div className="mb-5">
            <p
              className="text-[10px] font-bold uppercase tracking-[0.15em] mb-3"
              style={{ color: `${currentPreset.accent}70` }}
            >
              ערכות צבע
            </p>
            <div className="grid grid-cols-5 gap-2">
              {THEME_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handlePresetSelect(p.id)}
                  title={p.name}
                  className="relative flex flex-col items-center gap-1.5 rounded-xl p-2 transition-all duration-200 hover:scale-105 active:scale-95"
                  style={{
                    background:
                      selectedPreset === p.id
                        ? `${p.accent}25`
                        : `${p.bg}90`,
                    border: `1px solid ${selectedPreset === p.id ? p.accent : p.border}`,
                    boxShadow: selectedPreset === p.id ? `0 0 12px ${p.accent}40` : "none",
                  }}
                >
                  <div
                    className="w-7 h-7 rounded-full"
                    style={{
                      background: `radial-gradient(circle at 35% 35%, ${p.accent} 0%, ${p.bg} 100%)`,
                      boxShadow: `0 0 8px ${p.accent}60`,
                    }}
                  />
                  <span
                    className="text-[9px] font-semibold text-center leading-tight truncate w-full"
                    style={{ color: selectedPreset === p.id ? p.accent : `${p.accent}90` }}
                  >
                    {p.name}
                  </span>
                  {selectedPreset === p.id && (
                    <div
                      className="absolute top-1 left-1 rounded-full p-0.5"
                      style={{ background: p.accent, color: p.bg }}
                    >
                      <CheckIcon />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Effects */}
          <div className="mb-5">
            <p
              className="text-[10px] font-bold uppercase tracking-[0.15em] mb-3"
              style={{ color: `${currentPreset.accent}70` }}
            >
              אפקטי רקע
            </p>
            <div className="grid grid-cols-4 gap-2">
              {THEME_EFFECTS.map((e) => (
                <button
                  key={e.id}
                  onClick={() => handleEffectSelect(e.id)}
                  className="flex flex-col items-center gap-1.5 rounded-xl px-2 py-2.5 transition-all duration-200 hover:scale-105 active:scale-95"
                  style={{
                    background:
                      selectedEffect === e.id
                        ? `${currentPreset.accent}22`
                        : `${currentPreset.surface}80`,
                    border: `1px solid ${selectedEffect === e.id ? currentPreset.accent : currentPreset.border}`,
                    boxShadow:
                      selectedEffect === e.id
                        ? `0 0 10px ${currentPreset.accent}35`
                        : "none",
                  }}
                >
                  <span className="text-lg leading-none">{e.emoji}</span>
                  <span
                    className="text-[9px] font-semibold text-center leading-tight"
                    style={{
                      color:
                        selectedEffect === e.id
                          ? currentPreset.accent
                          : `${currentPreset.accent}80`,
                    }}
                  >
                    {e.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Preview strip */}
          <div
            className="rounded-xl p-3 mb-4 flex items-center gap-3"
            style={{
              background: `${currentPreset.bg}80`,
              border: `1px solid ${currentPreset.border}`,
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex-shrink-0"
              style={{
                background: `radial-gradient(circle at 35% 35%, ${currentPreset.accent} 0%, ${currentPreset.bg} 100%)`,
                boxShadow: `0 0 16px ${currentPreset.glow}`,
              }}
            />
            <div className="min-w-0">
              <div
                className="text-sm font-bold truncate"
                style={{ color: currentPreset.accent }}
              >
                {THEME_PRESETS.find((p) => p.id === selectedPreset)?.name}
              </div>
              <div
                className="text-xs truncate"
                style={{ color: `${currentPreset.accent}70` }}
              >
                {THEME_EFFECTS.find((e) => e.id === selectedEffect)?.name}
              </div>
            </div>
            {hasChanges && (
              <div
                className="mr-auto text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                style={{
                  background: `${currentPreset.accent}20`,
                  color: currentPreset.accent,
                }}
              >
                תצוגה מקדימה
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isPending || (!hasChanges && !justSaved)}
              className="flex-1 rounded-xl py-2.5 text-sm font-bold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: justSaved
                  ? "#16a34a"
                  : hasChanges
                  ? `linear-gradient(135deg, ${currentPreset.accent} 0%, ${currentPreset.glow} 100%)`
                  : `${currentPreset.accent}30`,
                color: justSaved ? "#fff" : currentPreset.bg,
                boxShadow: hasChanges ? `0 4px 20px ${currentPreset.accent}40` : "none",
              }}
            >
              {isPending ? "שומר..." : justSaved ? "✓ נשמר לכולם!" : "שמור ופרסם לכולם"}
            </button>
            {hasChanges && (
              <button
                onClick={handleRevert}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: `${currentPreset.surface}80`,
                  color: `${currentPreset.accent}90`,
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
