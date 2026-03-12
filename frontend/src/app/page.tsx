'use client';

import { useEffect, useState } from "react";

type Signal = {
  type: string;
  title: string;
  url?: string;
  source?: string;
  published_at?: string;
};

type AgentResponse = {
  signals: Signal[];
  brief: string;
  email: string;
  email_delivery_status: string;
  email_id?: string | null;
};

const STEPS = [
  {
    id: 1,
    title: "Signals Detected",
    description: "Funding, hiring, launches, tech shifts and more.",
    key: "signals",
  },
  {
    id: 2,
    title: "Account Research Summary",
    description: "Two-paragraph brief aligned to your ICP.",
    key: "brief",
  },
  {
    id: 3,
    title: "Generated Outreach Email",
    description: "LLM-crafted email referencing live signals.",
    key: "email",
  },
  {
    id: 4,
    title: "Email Delivery Status",
    description: "Sent automatically via Resend.",
    key: "email_delivery_status",
  },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

export default function Home() {
  const [icp, setIcp] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resp, setResp] = useState<AgentResponse | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  const hasResponse = Boolean(resp);

  function stepStatus(key: StepKey): "pending" | "active" | "done" {
    if (!loading && !hasResponse) return "pending";
    if (loading && !hasResponse) {
      // Entire chain is running on backend; visualize as "active"
      return "active";
    }
    // Once we have a response, treat completed fields as done
    if (!resp) return "pending";

    if (key === "signals" && resp.signals?.length > 0) return "done";
    if (key === "brief" && resp.brief) return "done";
    if (key === "email" && resp.email) return "done";
    if (key === "email_delivery_status" && resp.email_delivery_status) return "done";
    return "pending";
  }

  async function runAgent() {
    setError(null);
    setLoading(true);
    setResp(null);
    try {
      const res = await fetch("https://fire-reach.onrender.com/run-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icp, company, email }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Request failed");
      }
      const data: AgentResponse = await res.json();
      setResp(data);
    } catch (e: any) {
      setError(e?.message || "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-zinc-50 via-white to-zinc-100 font-sans text-zinc-900 transition-colors dark:from-zinc-950 dark:via-black dark:to-zinc-900 dark:text-zinc-100">
      <div className="pointer-events-none absolute inset-0 opacity-40 mix-blend-soft-light dark:opacity-60">
        <div className="absolute -left-32 top-[-10rem] h-72 w-72 rounded-full bg-orange-500/30 blur-3xl" />
        <div className="absolute bottom-[-8rem] right-[-8rem] h-80 w-80 rounded-full bg-amber-400/20 blur-3xl" />
      </div>

      <main className="relative mx-auto flex max-w-6xl flex-col gap-8 px-6 py-10 lg:py-12">
        <header className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 via-amber-400 to-red-500 shadow-lg shadow-orange-500/40">
              <span className="text-lg font-semibold text-white">F</span>
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                FireReach – Autonomous Outreach Engine
              </h1>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Agentic pipeline: User Input → Signal Harvesting → AI Research → Email Generation → Automated Delivery
              </p>
            </div>
          </div>
          <button
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white/70 px-4 py-2 text-xs font-medium text-zinc-800 shadow-sm backdrop-blur transition hover:border-orange-400 hover:text-orange-600 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-100 dark:hover:border-orange-500"
          >
            <span
              className={`h-5 w-5 rounded-full border border-zinc-300 bg-gradient-to-br from-zinc-50 to-zinc-200 shadow-sm dark:border-zinc-600 dark:from-zinc-800 dark:to-zinc-900 ${
                theme === "dark" ? "translate-x-4" : "translate-x-0"
              } flex items-center justify-center transition-transform`}
            >
              <span className="text-[10px]">{theme === "dark" ? "☾" : "☼"}</span>
            </span>
            <span>{theme === "dark" ? "Dark" : "Light"} mode</span>
          </button>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.9fr)]">
          <div className="relative overflow-hidden rounded-3xl border border-zinc-200/70 bg-white/80 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.12)] backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/70">
            <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-orange-400/70 to-transparent" />
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.15em] text-zinc-500">
              Input
            </h2>
            <p className="mb-5 text-sm text-zinc-600 dark:text-zinc-400">
              Describe your ICP and target to let the FireReach agent autonomously research, draft, and send a
              personalized outreach email.
            </p>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
                  Ideal Customer Profile (ICP)
                </label>
                <textarea
                  value={icp}
                  onChange={(e) => setIcp(e.target.value)}
                  placeholder="e.g. Series A–C B2B SaaS, 50–500 employees, expanding sales org, struggling to personalize outbound at scale..."
                  className="w-full rounded-2xl border border-zinc-200 bg-white/70 p-3 text-sm outline-none ring-orange-500/0 transition focus:border-orange-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950/70"
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
                    Target Company Name
                  </label>
                  <input
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="e.g. Acme Corp"
                    className="w-full rounded-2xl border border-zinc-200 bg-white/70 p-3 text-sm outline-none ring-orange-500/0 transition focus:border-orange-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950/70"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
                    Target Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="founder@acme.com"
                    className="w-full rounded-2xl border border-zinc-200 bg-white/70 p-3 text-sm outline-none ring-orange-500/0 transition focus:border-orange-500 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950/70"
                  />
                </div>
              </div>

              <button
                disabled={loading || !icp || !company || !email}
                onClick={runAgent}
                className="group relative mt-3 inline-flex w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500 via-red-500 to-amber-400 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-orange-500/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="absolute inset-0 opacity-0 transition group-hover:opacity-30">
                  <span className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
                </span>
                {loading ? (
                  <span className="relative flex items-center gap-2">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
                    Running Agent
                  </span>
                ) : (
                  <span className="relative flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[11px]">
                      →
                    </span>
                    Run Agent
                  </span>
                )}
              </button>

              {error && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              )}

              <p className="mt-2 text-[11px] text-zinc-500">
                FireReach reads deterministic web signals (News API, Serper/SerpAPI) and uses Groq-powered LLM reasoning
                to craft outreach before sending via Resend.
              </p>
            </div>
          </div>

          <aside className="relative h-full rounded-3xl border border-zinc-200/70 bg-white/80 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.12)] backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/70">
            <h2 className="mb-5 text-sm font-semibold uppercase tracking-[0.15em] text-zinc-500">
              Agent Pipeline
            </h2>
            <ol className="relative space-y-4 before:absolute before:left-[10px] before:top-3 before:h-[calc(100%-1.5rem)] before:w-px before:bg-gradient-to-b before:from-orange-500/60 before:via-zinc-500/30 before:to-amber-400/60">
              {STEPS.map((step) => {
                const status = stepStatus(step.key);
                const isDone = status === "done";
                const isActive = status === "active";

                return (
                  <li key={step.id} className="relative flex gap-4 pl-6">
                    <div
                      className={`absolute left-0 top-1 flex h-5 w-5 items-center justify-center rounded-full border text-[11px] font-medium transition ${
                        isDone
                          ? "border-orange-500 bg-gradient-to-br from-orange-500 to-amber-400 text-white shadow-sm shadow-orange-500/50"
                          : isActive
                          ? "border-orange-400 bg-zinc-900/90 text-orange-300 shadow-sm shadow-orange-500/40 dark:bg-zinc-900"
                          : "border-zinc-300 bg-white text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
                      } ${isActive ? "animate-pulse" : ""}`}
                    >
                      {step.id}
                    </div>
                    <div className="flex-1 rounded-2xl border border-zinc-200/70 bg-white/80 p-3 text-xs shadow-sm backdrop-blur-sm transition hover:border-orange-400/70 dark:border-zinc-800 dark:bg-zinc-950/60">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                          {step.title}
                        </p>
                        {isDone && (
                          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-500">
                            Complete
                          </span>
                        )}
                        {isActive && !isDone && (
                          <span className="inline-flex items-center rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-medium text-orange-500">
                            In progress
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400">
                        {step.description}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </aside>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="space-y-4">
            <div className="rounded-2xl border border-zinc-200/80 bg-white/90 p-4 text-sm shadow-sm backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/80">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  Signals Detected
                </h3>
                {loading && !resp && (
                  <span className="text-[10px] text-zinc-500">Harvesting live signals…</span>
                )}
              </div>
              <div className="space-y-2">
                {resp?.signals?.length ? (
                  resp.signals.map((s: Signal, i) => (
                    <div
                      key={`${s.title}-${i}`}
                      className="group flex items-start gap-2 rounded-xl border border-transparent px-2 py-1.5 hover:border-orange-500/50 hover:bg-orange-500/3"
                    >
                      <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-orange-500" />
                      <div>
                        <p className="text-xs">
                          <span className="font-medium text-zinc-800 dark:text-zinc-100">
                            {s.type}
                          </span>
                          {": "}
                          <span className="text-zinc-700 dark:text-zinc-300">{s.title}</span>
                        </p>
                        {s.url && (
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-orange-600 underline underline-offset-2 dark:text-orange-400"
                          >
                            Open source
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    Run the agent to see deterministic signals from News API and search.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200/80 bg-white/90 p-4 text-sm shadow-sm backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/80">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  Account Research Summary
                </h3>
                {loading && !resp && (
                  <span className="text-[10px] text-zinc-500">LLM reasoning via Groq…</span>
                )}
              </div>
              {resp?.brief ? (
                <p className="whitespace-pre-line text-xs leading-6 text-zinc-800 dark:text-zinc-200">
                  {resp.brief}
                </p>
              ) : (
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  FireReach will summarize the company&apos;s growth stage, strategy, and ICP-aligned pains here.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-zinc-200/80 bg-white/90 p-4 text-sm shadow-sm backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/80">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  Generated Outreach Email
                </h3>
                {loading && !resp && (
                  <span className="text-[10px] text-zinc-500">Drafting personalized copy…</span>
                )}
              </div>
              {resp?.email ? (
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-zinc-50/90 p-3 text-xs leading-6 text-zinc-800 shadow-inner dark:bg-zinc-900/90 dark:text-zinc-100">
                  {resp.email}
                </pre>
              ) : (
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  Once the brief is ready, FireReach will generate a tailored email that explicitly references detected
                  signals.
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-zinc-200/80 bg-white/90 p-4 text-sm shadow-sm backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/80">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  Email Delivery Status
                </h3>
                {loading && !resp && (
                  <span className="text-[10px] text-zinc-500">Sending via Resend…</span>
                )}
              </div>
              {resp?.email_delivery_status ? (
                <p className="text-xs text-zinc-800 dark:text-zinc-200">
                  <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-500">
                    {resp.email_delivery_status}
                  </span>
                  {resp.email_id && (
                    <span className="ml-2 text-[11px] text-zinc-500">
                      ID: <span className="font-mono text-zinc-700 dark:text-zinc-300">{resp.email_id}</span>
                    </span>
                  )}
                </p>
              ) : (
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  When the pipeline completes, FireReach will confirm delivery from the Outreach Sender module.
                </p>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
