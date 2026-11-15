/**
 * Shown next to an operator's name wherever history says who did something,
 * when that action was carried out through the AI agent on their behalf.
 */
export function ViaAgentBadge({ className = "" }: { className?: string }) {
  return (
    <span
      data-testid="via-agent-badge"
      title="הפעולה בוצעה על ידי המנהל באמצעות סוכן ה-AI"
      className={`ms-1.5 inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-emerald-700 bg-emerald-950 px-1.5 py-0.5 align-middle text-[10px] font-bold leading-none text-emerald-200 ${className}`}
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3l1.8 4.9a2 2 0 0 0 1.2 1.2L20 11l-5 1.9a2 2 0 0 0-1.2 1.2L12 19l-1.8-4.9a2 2 0 0 0-1.2-1.2L4 11l5-1.9a2 2 0 0 0 1.2-1.2L12 3z" />
      </svg>
      באמצעות סוכן AI
    </span>
  );
}
