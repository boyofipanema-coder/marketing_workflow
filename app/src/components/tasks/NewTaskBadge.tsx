export default function NewTaskBadge({ className = "" }: { className?: string }) {
  return (
    <span
      aria-label="새로 추가된 업무"
      title="새로 추가된 업무"
      className={`inline-grid size-4 shrink-0 place-items-center rounded-[4px] bg-accent text-[9px] font-bold leading-none text-white ${className}`}
    >
      N
    </span>
  );
}
