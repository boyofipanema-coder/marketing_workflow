const CELLS = Array.from({ length: 42 });

export default function CalendarLoading() {
  return (
    <div className="mx-auto max-w-[1440px] animate-pulse px-3 py-5 sm:px-6 sm:py-7" aria-label="캘린더 불러오는 중">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <div className="h-7 w-24 rounded-lg bg-surface-3" />
          <div className="mt-2 h-3 w-52 rounded bg-surface-2" />
        </div>
        <div className="h-10 w-36 rounded-xl bg-surface-2" />
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="overflow-hidden rounded-[20px] border border-border bg-surface">
          <div className="flex h-16 items-center justify-between border-b border-separator px-4">
            <div className="h-6 w-36 rounded-md bg-surface-3" />
            <div className="h-8 w-44 rounded-lg bg-surface-2" />
          </div>
          <div className="grid grid-cols-7 border-b border-separator bg-surface-2/50">
            {Array.from({ length: 7 }).map((_, index) => <div key={index} className="h-8" />)}
          </div>
          <div className="grid grid-cols-7">
            {CELLS.map((_, index) => (
              <div key={index} className="min-h-[4.5rem] border-b border-r border-separator p-2 sm:min-h-28 lg:min-h-32">
                <div className="size-5 rounded-full bg-surface-2" />
                {index % 4 === 0 && <div className="mt-3 hidden h-5 w-4/5 rounded bg-surface-2 sm:block" />}
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[20px] border border-border bg-surface p-5">
          <div className="h-3 w-16 rounded bg-surface-3" />
          <div className="mt-2 h-6 w-40 rounded bg-surface-2" />
          <div className="mt-6 space-y-3">
            <div className="h-16 rounded-xl bg-surface-2" />
            <div className="h-16 rounded-xl bg-surface-2" />
          </div>
        </div>
      </div>
    </div>
  );
}
