import AppHeader from "@/components/AppHeader";

interface LoadingScreenProps {
  message?: string;
  detail?: string;
  showHeader?: boolean;
}

export default function LoadingScreen({
  message = "Loading CourtShare",
  detail = "Getting everything ready.",
  showHeader = true,
}: LoadingScreenProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      {showHeader && <AppHeader />}
      <main className="flex min-h-[calc(100vh-4.5rem)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-[32px] border border-slate-200 bg-white p-8 text-center shadow-[0_24px_70px_rgba(15,23,42,0.12)]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[24px] bg-emerald-50 text-[var(--site-accent)]">
            <div className="relative h-9 w-9 rounded-lg border-2 border-current">
              <span className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-current" />
              <span className="absolute left-0 top-1/2 h-0.5 w-full -translate-y-1/2 bg-current" />
              <span className="absolute inset-0 animate-ping rounded-lg border border-current opacity-30" />
            </div>
          </div>
          <h1 className="mt-6 text-2xl font-black tracking-tight text-slate-950">
            {message}
          </h1>
          <p className="mt-2 text-sm font-medium leading-6 text-slate-500">
            {detail}
          </p>
          <div className="mt-7 flex justify-center gap-2">
            {[0, 1, 2].map((index) => (
              <span
                key={index}
                className="h-2.5 w-2.5 animate-bounce rounded-full bg-[var(--site-accent)]"
                style={{ animationDelay: `${index * 140}ms` }}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
