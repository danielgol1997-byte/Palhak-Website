import {
  type ThemeTuning,
  mergeTuning,
  tuningScriptBody,
  applyTuningToDocumentElement,
  DEFAULT_TUNING,
} from "@/lib/theme-tuning";

export type { ThemeTuning };
export { mergeTuning, DEFAULT_TUNING } from "@/lib/theme-tuning";

export type ThemeMode = "dark" | "light";

export type ThemePreset = {
  id: string;
  name: string;
  emoji: string;
  bg: string;
  surface: string;
  border: string;
  accent: string;
  accent2?: string;
  glow: string;
  overlayColor: string;
  /** Primary UI text */
  fg?: string;
  /** Muted / secondary text */
  fgMuted?: string;
  mode?: ThemeMode;
  /** Full-screen CSS background (gradient); animated when non-transparent */
  immersiveGradient?: string;
  /** Opacity of /bg.jpg (0–1) */
  photoOpacity?: number;
  /** Full CSS background for vignette / atmosphere layer */
  vignette?: string;
};

export type ThemeEffect = {
  id: string;
  name: string;
  emoji: string;
};

const DEFAULT_VIGNETTE_DARK =
  "linear-gradient(to bottom, rgba(0,0,0,0.58) 0%, rgba(0,0,0,0.12) 42%, rgba(0,0,0,0.62) 100%)";

const DEFAULT_VIGNETTE_LIGHT =
  "linear-gradient(to bottom, rgba(255,182,213,0.45) 0%, rgba(255,255,255,0.08) 45%, rgba(233,213,255,0.5) 100%)";

export type ResolvedThemePreset = ThemePreset & {
  accent2: string;
  fg: string;
  fgMuted: string;
  mode: ThemeMode;
  immersiveGradient: string;
  photoOpacity: number;
  vignette: string;
};

export function resolvePreset(p: ThemePreset): ResolvedThemePreset {
  const mode = p.mode ?? "dark";
  return {
    ...p,
    accent2: p.accent2 ?? p.accent,
    fg: p.fg ?? "#fafafa",
    fgMuted: p.fgMuted ?? "#a1a1aa",
    mode,
    immersiveGradient: p.immersiveGradient ?? "transparent",
    photoOpacity: p.photoOpacity ?? 0.25,
    vignette:
      p.vignette ??
      (mode === "light" ? DEFAULT_VIGNETTE_LIGHT : DEFAULT_VIGNETTE_DARK),
  };
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "default",
    name: "מקורי אשר",
    emoji: "🛡️",
    bg: "#09090b",
    surface: "#18181b",
    border: "#27272a",
    accent: "#e4e4e7",
    glow: "rgba(255,255,255,0.08)",
    overlayColor: "transparent",
    fg: "#fafafa",
    fgMuted: "#a1a1aa",
    mode: "dark",
    immersiveGradient: "transparent",
    photoOpacity: 0.25,
    vignette: DEFAULT_VIGNETTE_DARK,
  },
  /* ─── Girly & light — immersive ─── */
  {
    id: "princess_cloud",
    name: "עננת נסיכות",
    emoji: "👑",
    bg: "#fff5fb",
    surface: "#ffe8f4",
    border: "#f9b4d9",
    accent: "#ec4899",
    accent2: "#a855f7",
    glow: "rgba(236,72,153,0.45)",
    overlayColor: "rgba(244,114,182,0.12)",
    fg: "#4a1942",
    fgMuted: "#9d5a8a",
    mode: "light",
    immersiveGradient:
      "linear-gradient(125deg, #fce7f3 0%, #fae8ff 25%, #e0e7ff 50%, #fce7f3 75%, #fbcfe8 100%)",
    photoOpacity: 0.06,
    vignette: DEFAULT_VIGNETTE_LIGHT,
  },
  {
    id: "strawberry_milk",
    name: "חלב תות",
    emoji: "🍓",
    bg: "#fff0f3",
    surface: "#ffe4ec",
    border: "#fda4af",
    accent: "#f43f5e",
    accent2: "#fb7185",
    glow: "rgba(244,63,94,0.4)",
    overlayColor: "rgba(251,113,133,0.14)",
    fg: "#5c1f2e",
    fgMuted: "#a85563",
    mode: "light",
    immersiveGradient:
      "linear-gradient(160deg, #fff1f2 0%, #ffe4e6 30%, #fce7f3 60%, #fdf2f8 100%)",
    photoOpacity: 0.05,
    vignette:
      "linear-gradient(to bottom, rgba(251,113,133,0.35) 0%, rgba(255,255,255,0.05) 50%, rgba(244,114,182,0.35) 100%)",
  },
  {
    id: "lavender_latte",
    name: "לאטה לילך",
    emoji: "💜",
    bg: "#f5f3ff",
    surface: "#ede9fe",
    border: "#c4b5fd",
    accent: "#7c3aed",
    accent2: "#a78bfa",
    glow: "rgba(124,58,237,0.35)",
    overlayColor: "rgba(167,139,250,0.15)",
    fg: "#31254a",
    fgMuted: "#6b5a8c",
    mode: "light",
    immersiveGradient:
      "linear-gradient(135deg, #f3e8ff 0%, #ede9fe 35%, #e0e7ff 70%, #faf5ff 100%)",
    photoOpacity: 0.06,
    vignette: DEFAULT_VIGNETTE_LIGHT,
  },
  {
    id: "rose_champagne",
    name: "שמפניה ורדים",
    emoji: "🥂",
    bg: "#fff7ed",
    surface: "#ffedd5",
    border: "#fdba74",
    accent: "#ea580c",
    accent2: "#f472b6",
    glow: "rgba(244,114,182,0.4)",
    overlayColor: "rgba(251,146,60,0.1)",
    fg: "#5c2d2d",
    fgMuted: "#9a6b6b",
    mode: "light",
    immersiveGradient:
      "linear-gradient(145deg, #fff7ed 0%, #ffedd5 25%, #fce7f3 55%, #ffe4e6 100%)",
    photoOpacity: 0.07,
    vignette:
      "linear-gradient(to bottom, rgba(251,191,36,0.2) 0%, transparent 48%, rgba(244,114,182,0.25) 100%)",
  },
  {
    id: "cotton_candy",
    name: "צמר גפן מתוק",
    emoji: "🍬",
    bg: "#f0f9ff",
    surface: "#e0f2fe",
    border: "#7dd3fc",
    accent: "#0ea5e9",
    accent2: "#f472b6",
    glow: "rgba(14,165,233,0.35)",
    overlayColor: "rgba(244,114,182,0.1)",
    fg: "#164e63",
    fgMuted: "#5a7a8a",
    mode: "light",
    immersiveGradient:
      "linear-gradient(120deg, #e0f2fe 0%, #fce7f3 40%, #ddd6fe 75%, #cffafe 100%)",
    photoOpacity: 0.05,
    vignette: DEFAULT_VIGNETTE_LIGHT,
  },
  {
    id: "sakura_dream",
    name: "חלום סאקורה",
    emoji: "🌸",
    bg: "#fdf2f8",
    surface: "#fce7f3",
    border: "#f9a8d4",
    accent: "#db2777",
    accent2: "#f472b6",
    glow: "rgba(219,39,119,0.4)",
    overlayColor: "rgba(249,168,212,0.18)",
    fg: "#5b2147",
    fgMuted: "#9d5a82",
    mode: "light",
    immersiveGradient:
      "radial-gradient(ellipse 120% 80% at 50% -20%, #fbcfe8 0%, transparent 55%), linear-gradient(180deg, #fdf2f8 0%, #fce7f3 50%, #fae8ff 100%)",
    photoOpacity: 0.05,
    vignette:
      "linear-gradient(to bottom, rgba(251,113,182,0.4) 0%, rgba(255,255,255,0.02) 50%, rgba(244,114,182,0.35) 100%)",
  },
  {
    id: "unicorn_glow",
    name: "זוהר חד-קרן",
    emoji: "🦄",
    bg: "#1a0a1f",
    surface: "#2d1240",
    border: "#7c3aed",
    accent: "#e879f9",
    accent2: "#22d3ee",
    glow: "rgba(232,121,249,0.5)",
    overlayColor: "rgba(34,211,238,0.08)",
    fg: "#fdf4ff",
    fgMuted: "#d8b4fe",
    mode: "dark",
    immersiveGradient:
      "linear-gradient(135deg, rgba(88,28,135,0.9) 0%, rgba(157,23,77,0.5) 35%, rgba(59,130,246,0.35) 70%, rgba(126,34,206,0.85) 100%)",
    photoOpacity: 0.08,
    vignette:
      "linear-gradient(to bottom, rgba(126,34,206,0.55) 0%, transparent 40%, rgba(30,27,75,0.75) 100%)",
  },
  {
    id: "bubblegum_night",
    name: "ליל בומבוניירה",
    emoji: "💗",
    bg: "#2a0a18",
    surface: "#3d0f24",
    border: "#be185d",
    accent: "#fb7185",
    accent2: "#f472b6",
    glow: "rgba(251,113,133,0.55)",
    overlayColor: "rgba(236,72,153,0.15)",
    fg: "#ffe4e6",
    fgMuted: "#fda4af",
    mode: "dark",
    immersiveGradient:
      "radial-gradient(ellipse 100% 70% at 80% 10%, rgba(190,24,93,0.55) 0%, transparent 50%), radial-gradient(ellipse 80% 60% at 10% 90%, rgba(131,24,67,0.6) 0%, transparent 45%), linear-gradient(180deg, #2a0a18 0%, #1f0a14 100%)",
    photoOpacity: 0.1,
    vignette:
      "linear-gradient(to bottom, rgba(157,23,77,0.5) 0%, transparent 45%, rgba(88,28,135,0.45) 100%)",
  },
  /* ─── Original catalogue (tweaked for resolve) ─── */
  {
    id: "galaxy",
    name: "גלקסיה",
    emoji: "🌌",
    bg: "#08001a",
    surface: "#110a2a",
    border: "#2d1a4a",
    accent: "#c084fc",
    glow: "rgba(192,132,252,0.3)",
    overlayColor: "rgba(88,28,135,0.12)",
    immersiveGradient:
      "radial-gradient(ellipse 100% 60% at 50% -10%, rgba(88,28,135,0.5) 0%, transparent 55%)",
    photoOpacity: 0.12,
  },
  {
    id: "dawn",
    name: "שחר",
    emoji: "🌅",
    bg: "#120800",
    surface: "#1a0e00",
    border: "#3d1f00",
    accent: "#fb923c",
    glow: "rgba(251,146,60,0.25)",
    overlayColor: "rgba(251,146,60,0.08)",
    immersiveGradient:
      "linear-gradient(180deg, rgba(124,45,18,0.5) 0%, transparent 55%)",
    photoOpacity: 0.18,
  },
  {
    id: "ocean",
    name: "ים עמוק",
    emoji: "🌊",
    bg: "#001218",
    surface: "#001e26",
    border: "#00364a",
    accent: "#22d3ee",
    glow: "rgba(34,211,238,0.25)",
    overlayColor: "rgba(6,182,212,0.08)",
    immersiveGradient:
      "radial-gradient(ellipse 90% 50% at 50% 100%, rgba(8,145,178,0.35) 0%, transparent 50%)",
    photoOpacity: 0.15,
  },
  {
    id: "forest",
    name: "יער קסום",
    emoji: "🌲",
    bg: "#001205",
    surface: "#001a08",
    border: "#003014",
    accent: "#4ade80",
    glow: "rgba(74,222,128,0.25)",
    overlayColor: "rgba(34,197,94,0.08)",
    immersiveGradient:
      "linear-gradient(160deg, rgba(20,83,45,0.4) 0%, transparent 50%)",
    photoOpacity: 0.15,
  },
  {
    id: "sunset",
    name: "שקיעה",
    emoji: "🌇",
    bg: "#180008",
    surface: "#1a000a",
    border: "#3d001a",
    accent: "#fb7185",
    glow: "rgba(251,113,133,0.25)",
    overlayColor: "rgba(239,68,68,0.08)",
    immersiveGradient:
      "linear-gradient(200deg, rgba(190,24,93,0.45) 0%, rgba(67,20,7,0.3) 100%)",
    photoOpacity: 0.14,
  },
  {
    id: "cosmic_rose",
    name: "ורד קוסמי",
    emoji: "🌺",
    bg: "#180010",
    surface: "#1a0014",
    border: "#3d0030",
    accent: "#f472b6",
    glow: "rgba(244,114,182,0.3)",
    overlayColor: "rgba(244,114,182,0.10)",
    immersiveGradient:
      "radial-gradient(circle at 70% 20%, rgba(157,23,77,0.45) 0%, transparent 45%), radial-gradient(circle at 20% 80%, rgba(88,28,135,0.35) 0%, transparent 40%)",
    photoOpacity: 0.12,
  },
  {
    id: "sapphire",
    name: "ספיר",
    emoji: "💎",
    bg: "#000a1a",
    surface: "#000e26",
    border: "#001a4a",
    accent: "#60a5fa",
    glow: "rgba(96,165,250,0.25)",
    overlayColor: "rgba(59,130,246,0.08)",
    immersiveGradient:
      "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(37,99,235,0.35) 0%, transparent 55%)",
    photoOpacity: 0.14,
  },
  {
    id: "arctic",
    name: "ארקטי",
    emoji: "❄️",
    bg: "#00080f",
    surface: "#000f1a",
    border: "#001a2e",
    accent: "#bae6fd",
    glow: "rgba(186,230,253,0.2)",
    overlayColor: "rgba(186,230,253,0.05)",
    immersiveGradient:
      "linear-gradient(180deg, rgba(14,116,144,0.25) 0%, transparent 60%)",
    photoOpacity: 0.16,
  },
  {
    id: "neon",
    name: "ניאון",
    emoji: "⚡",
    bg: "#020d00",
    surface: "#051200",
    border: "#0a2200",
    accent: "#a3e635",
    glow: "rgba(163,230,53,0.3)",
    overlayColor: "rgba(163,230,53,0.06)",
    immersiveGradient:
      "radial-gradient(circle at 50% 100%, rgba(63,98,18,0.45) 0%, transparent 50%)",
    photoOpacity: 0.12,
  },
];

export const THEME_EFFECTS: ThemeEffect[] = [
  { id: "none", name: "ללא אפקטים", emoji: "✕" },
  { id: "stars", name: "כוכבים", emoji: "⭐" },
  { id: "sparkles", name: "ניצוצות", emoji: "✨" },
  { id: "hearts", name: "לבבות", emoji: "💕" },
  { id: "petals", name: "עלי כותרת", emoji: "🌷" },
  { id: "aurora", name: "נורה צפונית", emoji: "🌌" },
  { id: "bubbles", name: "בועות", emoji: "🫧" },
  { id: "fireflies", name: "גחליליות", emoji: "🪲" },
  { id: "matrix", name: "מטריקס", emoji: "💚" },
];

export function getPreset(id: string): ThemePreset {
  return THEME_PRESETS.find((p) => p.id === id) ?? THEME_PRESETS[0];
}

export function getResolvedPreset(id: string): ResolvedThemePreset {
  return resolvePreset(getPreset(id));
}

export function getEffect(id: string): ThemeEffect {
  return THEME_EFFECTS.find((e) => e.id === id) ?? THEME_EFFECTS[0];
}

export type SiteThemeData = {
  preset: string;
  effect: string;
  tuning: ThemeTuning;
};

export const DEFAULT_THEME: SiteThemeData = {
  preset: "default",
  effect: "none",
  tuning: DEFAULT_TUNING,
};

function esc(s: string): string {
  return JSON.stringify(s);
}

/** Inline script: apply theme before paint. Always include preset + effect + tuning from DB. */
export function buildThemeVarScript(
  presetId: string,
  effect: string,
  tuningStored?: unknown
): string {
  const p = getResolvedPreset(presetId);
  const tun = mergeTuning(tuningStored);
  const immersive = p.immersiveGradient;
  const hasImmersive = immersive !== "transparent" && immersive.length > 2;
  const lines: string[] = [
    "(function(){",
    "var d=document.documentElement,s=d.style;",
    `s.setProperty('--t-bg',${esc(p.bg)});`,
    `s.setProperty('--t-surface',${esc(p.surface)});`,
    `s.setProperty('--t-border',${esc(p.border)});`,
    `s.setProperty('--t-accent',${esc(p.accent)});`,
    `s.setProperty('--t-accent2',${esc(p.accent2)});`,
    `s.setProperty('--t-glow',${esc(p.glow)});`,
    `s.setProperty('--t-overlay',${esc(p.overlayColor)});`,
    `s.setProperty('--t-fg',${esc(p.fg)});`,
    `s.setProperty('--t-fg-muted',${esc(p.fgMuted)});`,
    `s.setProperty('--t-photo-opacity',${esc(String(p.photoOpacity))});`,
    `s.setProperty('--t-vignette',${esc(p.vignette)});`,
    `s.setProperty('--t-immersive',${esc(immersive)});`,
    `d.setAttribute('data-theme-mode',${esc(p.mode)});`,
    `d.setAttribute('data-effect',${esc(effect)});`,
    hasImmersive
      ? `d.setAttribute('data-immersive','1');`
      : `d.removeAttribute('data-immersive');`,
    tuningScriptBody(tun),
    `document.body.style.backgroundColor=${esc(p.bg)};`,
    "})();",
  ];
  return lines.join("");
}

/** Client-side: apply all CSS vars + html data attributes */
export function applyThemeVarsToRoot(
  presetId: string,
  effect: string,
  tuningStored?: unknown
): void {
  const p = getResolvedPreset(presetId);
  const tun = mergeTuning(tuningStored);
  const root = document.documentElement;
  const s = root.style;
  s.setProperty("--t-bg", p.bg);
  s.setProperty("--t-surface", p.surface);
  s.setProperty("--t-border", p.border);
  s.setProperty("--t-accent", p.accent);
  s.setProperty("--t-accent2", p.accent2);
  s.setProperty("--t-glow", p.glow);
  s.setProperty("--t-overlay", p.overlayColor);
  s.setProperty("--t-fg", p.fg);
  s.setProperty("--t-fg-muted", p.fgMuted);
  s.setProperty("--t-photo-opacity", String(p.photoOpacity));
  s.setProperty("--t-vignette", p.vignette);
  s.setProperty("--t-immersive", p.immersiveGradient);
  root.setAttribute("data-theme-mode", p.mode);
  root.setAttribute("data-effect", effect);
  if (p.immersiveGradient !== "transparent" && p.immersiveGradient.length > 2) {
    root.setAttribute("data-immersive", "1");
  } else {
    root.removeAttribute("data-immersive");
  }
  applyTuningToDocumentElement(root, tun);
  document.body.style.backgroundColor = p.bg;
}
