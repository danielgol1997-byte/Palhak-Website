"use client";

import { useRouter } from "next/navigation";
import { ModalPortal } from "@/components/ui/ModalPortal";

interface SuccessModalProps {
  message: string;
  onClose: () => void;
}

export function SuccessModal({ message, onClose }: SuccessModalProps) {
  const router = useRouter();

  const handleClose = () => {
    onClose();
    router.push("/"); // Redirect to home
  };

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto overscroll-contain p-4">
      <div
        className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative w-full max-w-md rounded-3xl bg-gradient-to-br from-green-900/20 to-emerald-900/10 p-8 shadow-2xl border-2 border-green-600/40 animate-in fade-in zoom-in duration-200">
        <div className="flex flex-col items-center gap-6">
          {/* Success Icon */}
          <div className="w-20 h-20 rounded-full bg-green-600 flex items-center justify-center animate-in zoom-in duration-300 delay-100">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>

          {/* Success Message */}
          <div className="text-center">
            <h3 className="text-2xl font-bold text-green-400 mb-2">הצלחה!</h3>
            <p className="text-lg text-zinc-300">{message}</p>
          </div>

          {/* Close Button */}
          <button
            onClick={handleClose}
            className="w-full h-12 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold transition-all cursor-pointer shadow-lg"
          >
            חזור לדף הבית
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}

