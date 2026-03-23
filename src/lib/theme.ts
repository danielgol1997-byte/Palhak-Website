export type ThemePreset = {
  id: string;
  name: string;
  emoji: string;
  bg: string;
  surface: string;
  border: string;
  accent: string;
  glow: string;
  overlayColor: string;
};

export type ThemeEffect = {
  id: string;
  name: string;
  emoji: string;
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "default",
    name: "ברירת מחדל",
    emoji: "⬛",
    bg: "#09090b",
    surface: "#18181b",
    border: "#27272a",
    accent: "#e4e4e7",
    glow: "rgba(255,255,255,0.08)",
    overlayColor: "transparent",
  },
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
  },
  {
    id: "cosmic_rose",
    name: "ורד קוסמי",
    emoji: "🌸",
    bg: "#180010",
    surface: "#1a0014",
    border: "#3d0030",
    accent: "#f472b6",
    glow: "rgba(244,114,182,0.3)",
    overlayColor: "rgba(244,114,182,0.10)",
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
  },
];

export const THEME_EFFECTS: ThemeEffect[] = [
  { id: "none", name: "ללא אפקטים", emoji: "✕" },
  { id: "stars", name: "כוכבים", emoji: "⭐" },
  { id: "sparkles", name: "ניצוצות", emoji: "✨" },
  { id: "aurora", name: "נורה צפונית", emoji: "🌌" },
  { id: "bubbles", name: "בועות", emoji: "🫧" },
  { id: "fireflies", name: "גחליליות", emoji: "🪲" },
  { id: "matrix", name: "מטריקס", emoji: "💚" },
];

export function getPreset(id: string): ThemePreset {
  return THEME_PRESETS.find((p) => p.id === id) ?? THEME_PRESETS[0];
}

export function getEffect(id: string): ThemeEffect {
  return THEME_EFFECTS.find((e) => e.id === id) ?? THEME_EFFECTS[0];
}

export type SiteThemeData = {
  preset: string;
  effect: string;
};

export const DEFAULT_THEME: SiteThemeData = {
  preset: "default",
  effect: "none",
};

export function buildThemeVarScript(preset: ThemePreset, effect: string): string {
  return `(function(){var s=document.documentElement.style;s.setProperty('--t-bg','${preset.bg}');s.setProperty('--t-surface','${preset.surface}');s.setProperty('--t-border','${preset.border}');s.setProperty('--t-accent','${preset.accent}');s.setProperty('--t-glow','${preset.glow}');s.setProperty('--t-overlay','${preset.overlayColor}');document.documentElement.setAttribute('data-effect','${effect}');})();`;
}
