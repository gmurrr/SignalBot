"use client";

import Link from "next/link";
import { ArrowRight, Compass, Scan, Zap } from "lucide-react";

import { RiskDisclaimer } from "@/components/legal/risk-disclaimer";
import { MarketStatusBadge } from "@/components/market-status-badge";
import { Reveal } from "@/components/reveal";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/lib/i18n/provider";

const stepIcons = [Compass, Scan, Zap];

export default function HomePage() {
  const { dict } = useI18n();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-24 px-6 pb-24 pt-12 lg:px-10">
        <section className="grid gap-10 lg:grid-cols-[1.12fr_0.88fr] lg:items-center">
          <Reveal>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <MarketStatusBadge />
              </div>
              <h1 className="mt-6 font-[family-name:var(--font-cormorant)] text-6xl leading-[0.95] text-foreground md:text-8xl">
                {dict.home.heroTitle}
              </h1>
              <p className="mt-8 max-w-2xl text-base leading-8 text-muted md:text-lg">{dict.home.heroBody}</p>
              <div className="mt-10 flex flex-wrap gap-4">
                <Button asChild size="lg">
                  <Link href="/auth/sign-up">
                    {dict.common.start}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/auth/sign-in">{dict.common.auth}</Link>
                </Button>
              </div>
              <RiskDisclaimer className="mt-8 max-w-2xl" />
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <Card className="gold-glow relative overflow-hidden border-[#1A1A1A] p-8 md:p-10">
              <p className="text-xs uppercase tracking-[0.32em] text-brass">{dict.home.algoLabel}</p>
              <div className="mt-8 grid gap-6 md:grid-cols-2">
                {dict.home.stats.map((stat) => (
                  <PanelStat key={stat.label} label={stat.label} value={stat.value} />
                ))}
              </div>
              <Separator className="my-8" />
              <p className="text-sm leading-7 text-muted">{dict.home.algoBody}</p>
              <RiskDisclaimer className="mt-6" />
            </Card>
          </Reveal>
        </section>

        <section id="story" className="grid gap-8 lg:grid-cols-2">
          <Reveal>
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-brass">{dict.home.storyLabel}</p>
              <h2 className="mt-4 font-[family-name:var(--font-cormorant)] text-5xl text-foreground">{dict.home.storyTitle}</h2>
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="space-y-6 text-base leading-8 text-muted">
              {dict.home.story.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </Reveal>
        </section>

        <section id="process">
          <Reveal>
            <div className="mb-10">
              <p className="text-xs uppercase tracking-[0.32em] text-brass">{dict.home.processLabel}</p>
              <h2 className="mt-4 font-[family-name:var(--font-cormorant)] text-5xl text-foreground">{dict.home.processTitle}</h2>
            </div>
          </Reveal>
          <div className="grid gap-6 lg:grid-cols-3">
            {dict.home.steps.map((step, index) => {
              const Icon = stepIcons[index] ?? Compass;
              return (
                <Reveal key={step.title} delay={index * 0.08}>
                  <Card className="h-full border-[#1A1A1A]">
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
              <p className="text-xs uppercase tracking-[0.32em] text-brass">{dict.common.faq}</p>
              <h2 className="mt-4 font-[family-name:var(--font-cormorant)] text-5xl text-foreground">{dict.home.faqTitle}</h2>
            </div>
          </Reveal>
          <div className="space-y-4 lg:col-span-2">
            {dict.home.faq.map((item, index) => (
              <Reveal key={item.q} delay={index * 0.06}>
                <Card className="border-[#1A1A1A]">
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
