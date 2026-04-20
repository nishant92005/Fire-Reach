'use client';

import { useEffect, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

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
  recipient: string;
  company_email?: string | null;
};

type Contact = {
  email?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  title?: string;
  department?: string;
  seniority?: string;
  linkedin_url?: string;
  twitter_url?: string;
  phone_number?: string;
  score?: number;
};

type ExtractContactsResponse = {
  domain: string;
  contacts: Contact[];
  total_count: number;
  company: string;
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
    description: "Send the email when ready.",
    key: "email_delivery_status",
  },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default function Home() {
  const [icp, setIcp] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [useCompanyEmail, setUseCompanyEmail] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resp, setResp] = useState<AgentResponse | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [companyEmailConfirmed, setCompanyEmailConfirmed] = useState(false);
  const [extractingContacts, setExtractingContacts] = useState(false);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [contactsResp, setContactsResp] = useState<ExtractContactsResponse | null>(null);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [editedEmailContent, setEditedEmailContent] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  const guessedCompanyEmail = (() => {
    const normalized = company.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    return normalized ? `contact@${normalized}.com` : "";
  })();

  useEffect(() => {
    setCompanyEmailConfirmed(false);
  }, [company, useCompanyEmail]);

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
    if (key === "email_delivery_status" && resp.email_delivery_status === "sent") return "done";
    return "pending";
  }

  async function runAgent(forceConfirm = false) {
    if (useCompanyEmail && !companyEmailConfirmed && !forceConfirm) {
      setError("Please confirm sending to the guessed company email before running the agent.");
      return;
    }

    setError(null);
    setLoading(true);
    setResp(null);
    try {
      const res = await fetch(`${API_BASE_URL}/run-agent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icp, company, email: useCompanyEmail ? null : email, use_company_email: useCompanyEmail }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Request failed");
      }
      const data: AgentResponse = await res.json();
      setResp(data);
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Unexpected error"));
    } finally {
      setLoading(false);
    }
  }

  async function confirmCompanySend() {
    setCompanyEmailConfirmed(true);
    await runAgent(true);
  }

  async function extractContacts() {
    if (!company) {
      setContactsError("Please enter a company name");
      return;
    }

    setContactsError(null);
    setExtractingContacts(true);
    setContactsResp(null);
    try {
      const res = await fetch(`${API_BASE_URL}/extract-contacts?` + new URLSearchParams({ company }), {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to extract contacts");
      }
      const data: ExtractContactsResponse = await res.json();
      setContactsResp(data);
    } catch (error: unknown) {
      setContactsError(getErrorMessage(error, "Failed to extract contacts"));
    } finally {
      setExtractingContacts(false);
    }
  }

  async function sendEmail() {
    if (!resp || !resp.recipient) {
      setError("Error: Missing recipient email");
      return;
    }

    setSendingEmail(true);
    setError(null);
    try {
      const emailContent = isEditingEmail ? editedEmailContent : resp.email;
      const res = await fetch(`${API_BASE_URL}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: resp.recipient,
          subject: `${company} <> FireReach`,
          email_content: emailContent,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to send email");
      }
      const data = await res.json();
      // Update response with delivery status
      setResp({
        ...resp,
        email_delivery_status: data.status,
        email_id: data.email_id,
      });
      setIsEditingEmail(false);
      setEditedEmailContent("");
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Failed to send email"));
    } finally {
      setSendingEmail(false);
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
                    disabled={useCompanyEmail}
                    className="w-full rounded-2xl border border-zinc-200 bg-white/70 p-3 text-sm outline-none ring-orange-500/0 transition focus:border-orange-500 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950/70"
                  />
                  <div className="mt-3 flex flex-col gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        checked={!useCompanyEmail}
                        onChange={() => {
                          setUseCompanyEmail(false);
                          setCompanyEmailConfirmed(false);
                        }}
                      />
                      Send to my email
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        checked={useCompanyEmail}
                        onChange={() => {
                          setUseCompanyEmail(true);
                          setCompanyEmailConfirmed(false);
                        }}
                      />
                      Use company email
                    </label>
                    {useCompanyEmail ? (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        FireReach will guess a company contact address using the company domain and detected signals.
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              {useCompanyEmail && company ? (
                <div className="mt-4 rounded-2xl border border-orange-200/80 bg-orange-50/80 p-4 text-sm text-orange-900 shadow-sm dark:border-orange-500/30 dark:bg-orange-950/10 dark:text-orange-200">
                  <p className="mb-3 font-medium">Guessed company email:</p>
                  <p className="break-all text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {guessedCompanyEmail}
                  </p>
                  {!companyEmailConfirmed ? (
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={confirmCompanySend}
                        className="inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-600"
                      >
                        Yes, send to this address
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUseCompanyEmail(false);
                          setCompanyEmailConfirmed(false);
                        }}
                        className="inline-flex items-center justify-center rounded-2xl border border-orange-300 bg-white px-4 py-2 text-sm font-medium text-orange-600 shadow-sm transition hover:bg-orange-100 dark:bg-zinc-900 dark:text-orange-300"
                      >
                        No, use my own email
                      </button>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">
                      Confirmed. Click Run Agent to send to the guessed company email.
                    </p>
                  )}
                </div>
              ) : null}

              <button
                disabled={
                  loading ||
                  !icp ||
                  !company ||
                  (!useCompanyEmail && !email) ||
                  (useCompanyEmail && !companyEmailConfirmed)
                }
                onClick={() => runAgent()}
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

              <button
                disabled={!company || extractingContacts}
                onClick={() => extractContacts()}
                className="group relative mt-3 inline-flex w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-400 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-blue-500/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="absolute inset-0 opacity-0 transition group-hover:opacity-30">
                  <span className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent" />
                </span>
                {extractingContacts ? (
                  <span className="relative flex items-center gap-2">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
                    Extracting Contacts
                  </span>
                ) : (
                  <span className="relative flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[11px]">
                      👥
                    </span>
                    Extract Company Contacts
                  </span>
                )}
              </button>

              {error && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              )}

              {contactsError && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                  {contactsError}
                </p>
              )}

              <p className="mt-2 text-[11px] text-zinc-500">
                FireReach reads deterministic web signals (News API, Serper/SerpAPI) and uses Groq-powered LLM reasoning
                to craft outreach before sending via SMTP.
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
            {contactsResp && (
              <div className="rounded-2xl border border-blue-200/80 bg-white/90 p-4 text-sm shadow-sm backdrop-blur dark:border-blue-800/80 dark:bg-zinc-950/80">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-400">
                      Company Contacts Extracted
                    </h3>
                    <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                      Found {contactsResp.total_count} contacts from {contactsResp.company}
                    </p>
                  </div>
                </div>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {contactsResp.contacts && contactsResp.contacts.length > 0 ? (
                    contactsResp.contacts.map((contact, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-blue-200/50 bg-blue-50/50 p-3 dark:border-blue-800/50 dark:bg-blue-950/20"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                              {contact.full_name || contact.first_name || "Unknown"}
                            </p>
                            {contact.title && (
                              <p className="text-xs text-zinc-700 dark:text-zinc-300">
                                {contact.title}
                              </p>
                            )}
                            {contact.department && (
                              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                                {contact.department}
                              </p>
                            )}
                            {contact.email && (
                              <p className="mt-2 text-xs break-all">
                                <span className="text-zinc-600 dark:text-zinc-400">Email: </span>
                                <a
                                  href={`mailto:${contact.email}`}
                                  className="font-mono text-blue-600 underline dark:text-blue-400"
                                >
                                  {contact.email}
                                </a>
                              </p>
                            )}
                            {contact.phone_number && (
                              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                                Phone: {contact.phone_number}
                              </p>
                            )}
                            {contact.seniority && (
                              <p className="mt-1 inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                                {contact.seniority}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      No contacts found for this company.
                    </p>
                  )}
                </div>
              </div>
            )}
            
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
                <div className="space-y-3">
                  {isEditingEmail ? (
                    <textarea
                      value={editedEmailContent}
                      onChange={(e) => setEditedEmailContent(e.target.value)}
                      className="w-full max-h-80 rounded-xl border border-orange-300 bg-orange-50 p-3 text-xs leading-6 font-mono text-zinc-800 dark:border-orange-600 dark:bg-orange-950/30 dark:text-zinc-100"
                      rows={12}
                    />
                  ) : (
                    <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-zinc-50/90 p-3 text-xs leading-6 text-zinc-800 shadow-inner dark:bg-zinc-900/90 dark:text-zinc-100">
                      {resp.email}
                    </pre>
                  )}
                  
                  <div className="flex gap-2 flex-wrap">
                    {!isEditingEmail ? (
                      <>
                        <button
                          onClick={() => {
                            setIsEditingEmail(true);
                            setEditedEmailContent(resp.email);
                          }}
                          className="inline-flex items-center gap-1 rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-600 shadow-sm transition hover:bg-blue-100 dark:border-blue-600 dark:bg-blue-950/30 dark:text-blue-400"
                        >
                          ✏️ Edit Email
                        </button>
                        <button
                          disabled={sendingEmail || resp.email_delivery_status === "sent"}
                          onClick={sendEmail}
                          className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {sendingEmail ? (
                            <>
                              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
                              Sending...
                            </>
                          ) : resp.email_delivery_status === "sent" ? (
                            <>
                              ✅ Sent
                            </>
                          ) : (
                            <>
                              📨 Send Email
                            </>
                          )}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          disabled={!editedEmailContent.trim() || sendingEmail}
                          onClick={sendEmail}
                          className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {sendingEmail ? (
                            <>
                              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
                              Sending...
                            </>
                          ) : (
                            <>
                              ✅ Send Edited Email
                            </>
                          )}
                        </button>
                        <button
                          disabled={sendingEmail}
                          onClick={() => {
                            setIsEditingEmail(false);
                            setEditedEmailContent("");
                          }}
                          className="inline-flex items-center gap-1 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-600 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-400"
                        >
                          ✕ Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
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
                  <span className="text-[10px] text-zinc-500">Sending via SMTP…</span>
                )}
              </div>
              {resp?.email_delivery_status ? (
                <>
                  <p className="text-xs text-zinc-800 dark:text-zinc-200">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      resp.email_delivery_status === "sent"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                    }`}>
                      {resp.email_delivery_status === "sent" ? "✅ Sent" : "⏳ Ready to Send"}
                    </span>
                    {resp.email_id && (
                      <span className="ml-2 text-[11px] text-zinc-500">
                        ID: <span className="font-mono text-zinc-700 dark:text-zinc-300">{resp.email_id}</span>
                      </span>
                    )}
                  </p>
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    To: <span className="font-medium text-zinc-700 dark:text-zinc-100">{resp.recipient}</span>
                    {resp.company_email ? " (guessed company address)" : ""}
                  </p>
                </>
              ) : (
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  Once the brief is ready, you can review and send the email using the Edit & Send buttons above.
                </p>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
