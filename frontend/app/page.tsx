import Link from "next/link";
import { ArrowRight, ShieldCheck, Sparkles, Waves } from "lucide-react";

import { Reveal } from "@/components/reveal";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const story = [
  "SignalBot started as a lean MT5 runner built for one job: track gold with enough discipline that the interface never encourages a late entry.",
  "The new platform turns that engine into a professional signal desk. Python evaluates the market in RAM, Supabase distributes state instantly, and the frontend keeps the operator view elegant and unmistakable."
];

const steps = [
  {
    title: "Market stream",
    body: "MetaTrader5 feeds live XAU/USD ticks. The backend compresses them into S10, M1 and M5 rolling windows and updates the shared market snapshot every second.",
    icon: Waves
  },
  {
    title: "Signal state",
    body: "A new setup lands in Supabase as ACTIVE only when the desk is clear. TP, SL and a strict expiry window keep stale entries out of sight.",
    icon: ShieldCheck
  },
  {
    title: "Realtime desk",
    body: "The dashboard listens with Supabase Realtime. New signals glide in, older trades settle into history, and status changes appear without reloads.",
    icon: Sparkles
  }
];

const faq = [
  {
    q: "How does the platform prevent outdated trades?",
    a: "Only live ACTIVE records are highlighted. Once TP, SL or the time limit resolves the trade, the same record flips to CLOSED or EXPIRED and the card styling changes immediately."
  },
  {
    q: "Why use Supabase between backend and frontend?",
    a: "It gives the project a single source of truth for ticks, signals and realtime subscriptions, while also separating secure backend writes from public frontend reads."
  },
  {
    q: "Can billing be added later?",
    a: "Yes. The auth flow already reserves space for EasyCart, so subscription checks can be layered onto the current UI without redesigning the product."
  }
];

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-24 px-6 pb-24 pt-12 lg:px-10">
        <section className="grid gap-10 lg:grid-cols-[1.12fr_0.88fr] lg:items-center">
          <Reveal>
            <div>
              <Badge>Dark Premium Classic</Badge>
              <h1 className="mt-6 font-[family-name:var(--font-cormorant)] text-6xl leading-[0.95] text-foreground md:text-8xl">
                XAU/USD signals with a real desk mentality.
              </h1>
              <p className="mt-8 max-w-2xl text-base leading-8 text-muted md:text-lg">
                A luxury-grade signal platform for gold traders, built around live MT5 execution intelligence, Supabase Realtime and a dashboard that never leaves stale setups on screen.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <Button asChild size="lg">
                  <Link href="/dashboard">
                    Open dashboard
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/auth/sign-in">Client login</Link>
                </Button>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <Card className="gold-glow relative overflow-hidden p-8 md:p-10">
              <p className="text-xs uppercase tracking-[0.32em] text-brass">Project brief</p>
              <div className="mt-8 grid gap-6 md:grid-cols-2">
                <PanelStat label="Backend" value="Python + MT5" />
                <PanelStat label="Realtime core" value="Supabase" />
                <PanelStat label="Frontend" value="Next.js 15" />
                <PanelStat label="Visual system" value="Tailwind + Motion" />
              </div>
              <Separator className="my-8" />
              <p className="text-sm leading-7 text-muted">
                Built to look premium, operate clearly under pressure and scale from a private trading desk into a full subscription product.
              </p>
            </Card>
          </Reveal>
        </section>

        <section id="story" className="grid gap-8 lg:grid-cols-2">
          <Reveal>
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-brass">Story</p>
              <h2 className="mt-4 font-[family-name:var(--font-cormorant)] text-5xl text-foreground">From script to signal platform</h2>
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="space-y-6 text-base leading-8 text-muted">
              {story.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </Reveal>
        </section>

        <section id="process">
          <Reveal>
            <div className="mb-10">
              <p className="text-xs uppercase tracking-[0.32em] text-brass">How It Works</p>
              <h2 className="mt-4 font-[family-name:var(--font-cormorant)] text-5xl text-foreground">Three layers, one live state</h2>
            </div>
          </Reveal>
          <div className="grid gap-6 lg:grid-cols-3">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <Reveal key={step.title} delay={index * 0.08}>
                  <Card className="h-full">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(212,175,55,0.18)] bg-[rgba(212,175,55,0.06)] text-brass">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-6 font-[family-name:var(--font-cormorant)] text-3xl text-foreground">{step.title}</h3>
                    <p className="mt-4 text-sm leading-7 text-muted">{step.body}</p>
                  </Card>
                </Reveal>
              );
            })}
          </div>
        </section>

        <section id="faq" className="grid gap-6 lg:grid-cols-3">
          <Reveal>
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-brass">FAQ</p>
              <h2 className="mt-4 font-[family-name:var(--font-cormorant)] text-5xl text-foreground">Elegant answers for practical questions</h2>
            </div>
          </Reveal>
          <div className="space-y-4 lg:col-span-2">
            {faq.map((item, index) => (
              <Reveal key={item.q} delay={index * 0.06}>
                <Card>
                  <h3 className="font-[family-name:var(--font-cormorant)] text-3xl text-foreground">{item.q}</h3>
                  <p className="mt-4 text-sm leading-7 text-muted">{item.a}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}

function PanelStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-[rgba(212,175,55,0.1)] bg-[rgba(255,255,255,0.02)] p-5">
      <p className="text-xs uppercase tracking-[0.28em] text-muted">{label}</p>
      <p className="mt-3 font-[family-name:var(--font-cormorant)] text-3xl text-foreground">{value}</p>
    </div>
  );
}
