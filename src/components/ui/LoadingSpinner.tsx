"use client";

import { ModalPortal } from "@/components/ui/ModalPortal";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  text?: string;
  fullScreen?: boolean;
}

export function LoadingSpinner({ size = "md", text, fullScreen = false }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-10 h-10",
    lg: "w-16 h-16",
    xl: "w-24 h-24",
  };

  const spinner = (
    <div className="flex flex-col items-center justify-center gap-4">
      {/* Spinner */}
      <div className="relative">
        {/* Outer ring */}
        <div
          className={`${sizeClasses[size]} rounded-full border-4 border-zinc-800 animate-pulse`}
        />
        {/* Spinning gradient ring */}
        <div
          className={`${sizeClasses[size]} rounded-full border-4 border-transparent border-t-blue-500 border-r-purple-500 animate-spin absolute inset-0`}
          style={{ animationDuration: "1s" }}
        />
        {/* Inner glow */}
        <div
          className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 blur-md absolute inset-0 animate-pulse`}
          style={{ animationDuration: "2s" }}
        />
      </div>

      {/* Loading text */}
      {text && (
        <div className="text-sm font-bold text-zinc-400 animate-pulse">
          {text}
        </div>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <ModalPortal>
        <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto overscroll-contain bg-zinc-950/80 backdrop-blur-sm p-4">
          {spinner}
        </div>
      </ModalPortal>
    );
  }

  return spinner;
}

export function LoadingOverlay({ text }: { text?: string }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-900/90 backdrop-blur-sm rounded-2xl">
      <LoadingSpinner size="lg" text={text} />
    </div>
  );
}

export function LoadingDots({ text }: { text?: string }) {
  return (
    <div className="flex items-center gap-3">
      {text && <span className="text-sm text-zinc-400">{text}</span>}
      <div className="flex gap-1">
        <div
          className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"
          style={{ animationDelay: "0ms", animationDuration: "1s" }}
        />
        <div
          className="w-2 h-2 rounded-full bg-purple-500 animate-bounce"
          style={{ animationDelay: "150ms", animationDuration: "1s" }}
        />
        <div
          className="w-2 h-2 rounded-full bg-pink-500 animate-bounce"
          style={{ animationDelay: "300ms", animationDuration: "1s" }}
        />
      </div>
    </div>
  );
}

export function LoadingButton({ children, isLoading, ...props }: any) {
  return (
    <button {...props} disabled={isLoading || props.disabled}>
      {isLoading ? (
        <div className="flex items-center justify-center gap-2">
          <LoadingDots />
          <span className="opacity-70">{children}</span>
        </div>
      ) : (
        children
      )}
    </button>
  );
}

