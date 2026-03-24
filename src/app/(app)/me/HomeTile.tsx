"use client";

import { Themed3DCard } from "@/components/Themed3DCard";

interface HomeTileProps {
  href: string;
  title: string;
  icon: React.ReactNode;
}

export function HomeTile({ href, title, icon }: HomeTileProps) {
  return <Themed3DCard href={href} title={title} icon={icon} />;
}
