"use client";

import { useEffect, useState, useRef } from "react";
import { getResolvedPreset } from "@/lib/theme";

type Particle = {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  drift: number;
  opacity: number;
};

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2.5 + 0.8,
    delay: Math.random() * 8,
    duration: Math.random() * 4 + 2,
    drift: (Math.random() - 0.5) * 120,
    opacity: Math.random() * 0.6 + 0.3,
  }));
}

function StarsEffect({ accent }: { accent: string }) {
  const [stars, setStars] = useState<Particle[]>([]);
  useEffect(() => {
    setStars(generateParticles(160));
  }, []);
  if (!stars.length) return null;
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {stars.map((s) => (
        <div
          key={s.id}
          className="absolute rounded-full"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            backgroundColor: accent,
            boxShadow: `0 0 ${s.size * 2}px ${accent}`,
            animation: `yuval-twinkle ${s.duration}s ${s.delay}s ease-in-out infinite`,
          }}
        />
      ))}
    </div>
  );
}

function SparklesEffect({ accent }: { accent: string }) {
  const [particles, setParticles] = useState<Particle[]>([]);
  useEffect(() => {
    setParticles(generateParticles(80));
  }, []);
  if (!particles.length) return null;
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute"
          style={{
            left: `${p.x}%`,
            bottom: `${(p.y % 30)}%`,
            width: `${p.size + 1}px`,
            height: `${p.size + 1}px`,
            backgroundColor: accent,
            borderRadius: "50%",
            boxShadow: `0 0 ${p.size * 3}px ${p.size}px ${accent}`,
            animation: `yuval-sparkle-rise ${p.duration + 4}s ${p.delay}s ease-in infinite`,
            "--drift": `${p.drift}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

function AuroraEffect({ accent }: { accent: string }) {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      <div
        className="absolute top-0 left-0 right-0 h-[45vh]"
        style={{
          background: `linear-gradient(180deg, ${accent}18 0%, ${accent}08 50%, transparent 100%)`,
          animation: "yuval-aurora 12s ease-in-out infinite",
          filter: "blur(40px)",
        }}
      />
      <div
        className="absolute top-0 left-[-20%] right-[-20%] h-[30vh]"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 50% -10%, ${accent}20 0%, transparent 70%)`,
          animation: "yuval-aurora 18s ease-in-out infinite reverse",
          filter: "blur(30px)",
        }}
      />
      <div
        className="absolute top-[5%] left-[-30%] w-[60%] h-[20vh]"
        style={{
          background: `radial-gradient(ellipse 100% 80% at 50% 50%, ${accent}14 0%, transparent 70%)`,
          animation: "yuval-aurora-drift 22s ease-in-out infinite",
          filter: "blur(50px)",
        }}
      />
    </div>
  );
}

function BubblesEffect({ accent }: { accent: string }) {
  const [bubbles, setBubbles] = useState<Particle[]>([]);
  useEffect(() => {
    setBubbles(generateParticles(50));
  }, []);
  if (!bubbles.length) return null;
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {bubbles.map((b) => (
        <div
          key={b.id}
          className="absolute rounded-full border"
          style={{
            left: `${b.x}%`,
            bottom: `-${b.size * 10}px`,
            width: `${b.size * 6 + 4}px`,
            height: `${b.size * 6 + 4}px`,
            borderColor: accent,
            opacity: b.opacity * 0.6,
            animation: `yuval-bubble-rise ${b.duration + 6}s ${b.delay}s ease-in infinite`,
          }}
        />
      ))}
    </div>
  );
}

function FirefliesEffect({ accent }: { accent: string }) {
  const [flies, setFlies] = useState<
    (Particle & { dx1: number; dy1: number; dx2: number; dy2: number; dx3: number; dy3: number })[]
  >([]);
  useEffect(() => {
    setFlies(
      Array.from({ length: 45 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 3 + 2,
        delay: Math.random() * 10,
        duration: Math.random() * 6 + 6,
        drift: 0,
        opacity: Math.random() * 0.7 + 0.3,
        dx1: (Math.random() - 0.5) * 80,
        dy1: (Math.random() - 0.5) * 80,
        dx2: (Math.random() - 0.5) * 60,
        dy2: (Math.random() - 0.5) * 60,
        dx3: (Math.random() - 0.5) * 70,
        dy3: (Math.random() - 0.5) * 70,
      }))
    );
  }, []);
  if (!flies.length) return null;
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {flies.map((f) => (
        <div
          key={f.id}
          className="absolute rounded-full"
          style={{
            left: `${f.x}%`,
            top: `${f.y}%`,
            width: `${f.size}px`,
            height: `${f.size}px`,
            backgroundColor: accent,
            boxShadow: `0 0 ${f.size * 4}px ${f.size * 2}px ${accent}`,
            animation: `yuval-firefly ${f.duration}s ${f.delay}s ease-in-out infinite`,
            "--dx1": `${f.dx1}px`,
            "--dy1": `${f.dy1}px`,
            "--dx2": `${f.dx2}px`,
            "--dy2": `${f.dy2}px`,
            "--dx3": `${f.dx3}px`,
            "--dy3": `${f.dy3}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

function HeartsEffect({ accent }: { accent: string }) {
  const [items, setItems] = useState<
    { id: number; x: number; delay: number; dur: number; emoji: string; drift: number }[]
  >([]);
  useEffect(() => {
    const em = ["💕", "💖", "💗", "💝", "🩷", "💓", "✨", "🌸"];
    setItems(
      Array.from({ length: 42 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 12,
        dur: 7 + Math.random() * 9,
        emoji: em[Math.floor(Math.random() * em.length)]!,
        drift: (Math.random() - 0.5) * 100,
      }))
    );
  }, []);
  if (!items.length) return null;
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {items.map((h) => (
        <div
          key={h.id}
          className="absolute text-lg sm:text-xl select-none"
          style={{
            left: `${h.x}%`,
            bottom: "-5%",
            animation: `yuval-heart-float ${h.dur}s ${h.delay}s ease-in-out infinite`,
            filter: `drop-shadow(0 0 6px ${accent})`,
            "--heart-drift": `${h.drift}px`,
          } as React.CSSProperties}
        >
          {h.emoji}
        </div>
      ))}
    </div>
  );
}

function PetalsEffect({ accent }: { accent: string }) {
  const [petals, setPetals] = useState<
    { id: number; x: number; delay: number; dur: number; rot: number; w: number }[]
  >([]);
  useEffect(() => {
    setPetals(
      Array.from({ length: 55 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 15,
        dur: 12 + Math.random() * 14,
        rot: Math.random() * 360,
        w: 8 + Math.random() * 14,
      }))
    );
  }, []);
  if (!petals.length) return null;
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {petals.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full opacity-70"
          style={{
            left: `${p.x}%`,
            top: "-8%",
            width: `${p.w}px`,
            height: `${p.w * 1.4}px`,
            background: `linear-gradient(135deg, ${accent}, #ffffffaa)`,
            ["--petal-rot" as string]: `${p.rot}deg`,
            animation: `yuval-petal-fall ${p.dur}s ${p.delay}s linear infinite`,
            boxShadow: `0 0 14px ${accent}66`,
          }}
        />
      ))}
    </div>
  );
}

function MatrixEffect() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const cols = Math.floor(canvas.width / 18);
    const drops = Array.from({ length: cols }, () => Math.random() * -canvas.height);
    const chars = "アイウエオカキクケコサシスセソタチツテトナニヌネノ01アシEル";

    let raf: number;
    function draw() {
      ctx!.fillStyle = "rgba(2,13,0,0.05)";
      ctx!.fillRect(0, 0, canvas!.width, canvas!.height);
      ctx!.fillStyle = "#a3e635";
      ctx!.font = "14px monospace";
      for (let i = 0; i < drops.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        ctx!.fillText(char, i * 18, drops[i]);
        if (drops[i] > canvas!.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i] += 18;
      }
      raf = requestAnimationFrame(draw);
    }
    draw();

    const onResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ opacity: 0.18 }}
    />
  );
}

export function ThemeEffects({
  initialEffect,
  initialPreset,
}: {
  initialEffect: string;
  initialPreset: string;
}) {
  const [effect, setEffect] = useState(initialEffect);
  const [accentColor, setAccentColor] = useState(getResolvedPreset(initialPreset).accent);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ effect: string; preset: string }>;
      setEffect(ce.detail.effect);
      setAccentColor(getResolvedPreset(ce.detail.preset).accent);
    };
    window.addEventListener("yuval-theme-change", handler);
    return () => window.removeEventListener("yuval-theme-change", handler);
  }, []);

  if (effect === "none") return null;

  return (
    <>
      {effect === "stars" && <StarsEffect accent={accentColor} />}
      {effect === "sparkles" && <SparklesEffect accent={accentColor} />}
      {effect === "hearts" && <HeartsEffect accent={accentColor} />}
      {effect === "petals" && <PetalsEffect accent={accentColor} />}
      {effect === "aurora" && <AuroraEffect accent={accentColor} />}
      {effect === "bubbles" && <BubblesEffect accent={accentColor} />}
      {effect === "fireflies" && <FirefliesEffect accent={accentColor} />}
      {effect === "matrix" && <MatrixEffect />}
    </>
  );
}
