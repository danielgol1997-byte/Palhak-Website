"use client";

import { useRef, useState } from "react";
import Link from "next/link";

interface HomeTileProps {
  href: string;
  title: string;
  icon: React.ReactNode;
}

export function HomeTile({ href, title, icon }: HomeTileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const [glimmer, setGlimmer] = useState({ x: 0, y: 0, opacity: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Increased divisor from 10 to 25 for much subtler tilt effect
    const rotateX = (centerY - y) / 25;
    const rotateY = (x - centerX) / 25;

    setRotate({ x: rotateX, y: rotateY });
    setGlimmer({ x, y, opacity: 1 });
  };

  const handleMouseLeave = () => {
    setRotate({ x: 0, y: 0 });
    setGlimmer((prev) => ({ ...prev, opacity: 0 }));
  };

  return (
    <Link
      href={href}
      className="group perspective-1000 block h-full w-full"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div
        ref={containerRef}
        className="relative h-full w-full rounded-3xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl transition-all duration-200 ease-out overflow-hidden"
        style={{
          transform: `rotateX(${rotate.x}deg) rotateY(${rotate.y}deg)`,
          transformStyle: "preserve-3d",
        }}
      >
        {/* Highlight effect */}
        <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
        
        {/* Glimmer effect */}
        <div
          className="absolute inset-0 rounded-3xl pointer-events-none transition-opacity duration-500"
          style={{
            background: `radial-gradient(400px circle at ${glimmer.x}px ${glimmer.y}px, rgba(255,255,255,0.12), transparent 40%)`,
            opacity: glimmer.opacity,
          }}
        />

        <div className="flex h-full flex-col items-center justify-center gap-6" style={{ transform: "translateZ(60px)" }}>
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-zinc-800 text-zinc-50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] group-hover:scale-110 group-hover:bg-zinc-700 group-hover:text-white transition-all duration-300">
            {icon}
          </div>
          <h3 className="text-2xl font-black text-zinc-50 text-center tracking-tight group-hover:scale-105 transition-transform group-hover:text-white">
            {title}
          </h3>
        </div>
      </div>
    </Link>
  );
}

