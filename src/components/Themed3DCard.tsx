"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

function readCssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function useThemeMotionVars() {
  const [key, setKey] = useState(0);
  const refresh = useCallback(() => setKey((k) => k + 1), []);
  useEffect(() => {
    window.addEventListener("yuval-theme-change", refresh);
    return () => window.removeEventListener("yuval-theme-change", refresh);
  }, [refresh]);
  const divisor = Math.max(
    6,
    parseFloat(readCssVar("--theme-tilt-divisor", "25")) || 25
  );
  const tileZ = readCssVar("--theme-tile-z", "60px");
  const perspective = readCssVar("--theme-perspective", "1000px");
  const glimmer = Math.min(
    0.5,
    Math.max(0, parseFloat(readCssVar("--theme-glimmer", "0.12")) || 0.12)
  );
  const hoverPop = Math.min(
    1.2,
    Math.max(1, parseFloat(readCssVar("--theme-hover-pop", "1.06")) || 1.06)
  );
  const radius = readCssVar("--theme-card-radius", "24px");
  const bows = Math.min(
    3,
    Math.max(0, Math.round(parseFloat(readCssVar("--theme-corner-bows", "0")) || 0))
  );
  void key;
  return { divisor, tileZ, perspective, glimmer, hoverPop, radius, bows };
}

const CORNER_EMOJI = ["🎀", "💕", "✨"];

export function Themed3DCard({
  href,
  title,
  subtitle,
  icon,
  compact,
  className = "",
}: {
  href: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  /** Smaller admin-style tile */
  compact?: boolean;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const [glimmer, setGlimmer] = useState({ x: 0, y: 0, opacity: 0 });
  const [hovered, setHovered] = useState(false);
  const { divisor, tileZ, perspective, glimmer: glimmerMul, hoverPop, radius, bows } =
    useThemeMotionVars();

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    setHovered(true);
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = (centerY - y) / divisor;
    const rotateY = (x - centerX) / divisor;
    setRotate({ x: rotateX, y: rotateY });
    setGlimmer({ x, y, opacity: 1 });
  };

  const handleMouseLeave = () => {
    setHovered(false);
    setRotate({ x: 0, y: 0 });
    setGlimmer((prev) => ({ ...prev, opacity: 0 }));
  };

  const pad = compact ? "p-6" : "p-8";
  const titleCls = compact ? "text-lg font-black" : "text-2xl font-black";

  return (
    <Link
      href={href}
      className={`theme-3d-card-wrap group block h-full w-full ${className}`}
      style={{ perspective }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="theme-3d-card-anim h-full w-full">
        <div
          ref={containerRef}
          className={`theme-3d-card-inner relative h-full w-full ${pad} shadow-2xl transition-all duration-200 ease-out overflow-hidden border`}
          style={{
            transform: `rotateX(${rotate.x}deg) rotateY(${rotate.y}deg)`,
            transformStyle: "preserve-3d",
            borderRadius: radius,
          }}
        >
        <div
          className="theme-3d-card-rainbow pointer-events-none absolute -z-10 rounded-[inherit]"
          style={{ inset: "-4px" }}
          aria-hidden
        />
        {bows > 0 && (
          <span
            className="pointer-events-none absolute top-2 right-2 text-lg sm:text-xl opacity-90 animate-bounce"
            style={{ animationDuration: "2.4s" }}
          >
            {CORNER_EMOJI[0]}
          </span>
        )}
        {bows > 1 && (
          <span
            className="pointer-events-none absolute bottom-2 left-2 text-base sm:text-lg opacity-85"
            style={{ animation: "theme-bow-wiggle 3s ease-in-out infinite" }}
          >
            {CORNER_EMOJI[1]}
          </span>
        )}
        {bows > 2 && (
          <span className="pointer-events-none absolute top-2 left-2 text-sm opacity-80">
            {CORNER_EMOJI[2]}
          </span>
        )}

        <div className="absolute inset-0 rounded-[inherit] opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br from-white/15 to-transparent pointer-events-none" />

        <div
          className="absolute inset-0 rounded-[inherit] pointer-events-none transition-opacity duration-500"
          style={{
            background: `radial-gradient(420px circle at ${glimmer.x}px ${glimmer.y}px, rgba(255,255,255,${glimmerMul}), transparent 42%)`,
            opacity: glimmer.opacity,
          }}
        />

        <div
          className={`flex h-full flex-col ${compact ? "justify-center gap-3" : "items-center justify-center gap-6"}`}
          style={{ transform: `translateZ(${tileZ})` }}
        >
          {icon && (
            <div
              className={`theme-3d-card-icon flex shrink-0 items-center justify-center rounded-2xl shadow-inner transition-all duration-300 ${
                compact ? "h-14 w-14" : "h-20 w-20"
              }`}
              style={{
                transform: hovered ? `scale(${Math.min(hoverPop + 0.04, 1.22)})` : "scale(1)",
              }}
            >
              {icon}
            </div>
          )}
          <div className="min-w-0 text-center">
            <h3
              className={`${titleCls} tracking-tight transition-transform duration-300`}
              style={{
                color: "var(--t-fg, #fafafa)",
                transform: hovered ? `scale(${hoverPop})` : "scale(1)",
              }}
            >
              {title}
            </h3>
            {subtitle && (
              <p
                className="mt-1 text-sm leading-snug"
                style={{ color: "var(--t-fg-muted, #a1a1aa)" }}
              >
                {subtitle}
              </p>
            )}
          </div>
        </div>
        </div>
      </div>
    </Link>
  );
}
