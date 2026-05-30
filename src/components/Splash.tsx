/** Initial loading / splash screen shown while the app bootstraps. */
export function Splash() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 bg-surface">
      <div className="flex h-20 w-20 items-center justify-center rounded-xl2 bg-brand text-4xl">
        🏋️
      </div>
      <h1 className="text-xl font-bold tracking-tight">Gym Tracker</h1>
      <div className="h-1.5 w-32 overflow-hidden rounded-full bg-surface-raised">
        <div className="h-full w-1/2 animate-[loading_1s_ease-in-out_infinite] rounded-full bg-brand" />
      </div>
    </div>
  );
}
