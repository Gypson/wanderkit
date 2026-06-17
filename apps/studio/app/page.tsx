import { StudioEditor } from "./StudioEditor";

export default function StudioHome() {
  return (
    <main className="min-h-screen bg-paper">
      <header className="border-b border-ink/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-moss">
              WanderKit
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-ink">
              Creator Studio
            </h1>
          </div>
          <div className="rounded-full border border-moss/25 bg-skywash px-4 py-2 text-sm font-medium text-moss">
            Draft to manifest
          </div>
        </div>
      </header>

      <StudioEditor />
    </main>
  );
}

