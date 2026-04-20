"use client";

import Link from "next/link";

import { Reveal } from "@/components/reveal";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/lib/i18n/provider";

export default function TermsPage() {
  const { dict } = useI18n();

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-14 lg:px-10">
        <Reveal>
          <section className="border-b border-[#1A1A1A] pb-10">
            <p className="text-xs uppercase tracking-[0.32em] text-brass">{dict.terms.eyebrow}</p>
            <h1 className="mt-5 font-[family-name:var(--font-cormorant)] text-6xl leading-none text-foreground md:text-7xl">{dict.terms.title}</h1>
            <p className="mt-6 max-w-3xl text-base leading-8 text-muted">{dict.terms.intro}</p>
          </section>
        </Reveal>

        <div className="grid gap-8 lg:grid-cols-[260px_1fr] lg:items-start">
          <Reveal delay={0.05}>
            <Card className="sticky top-28 border-[#1A1A1A] p-5">
              <p className="text-xs uppercase tracking-[0.28em] text-muted">{dict.terms.toc}</p>
              <nav className="mt-5 flex flex-col gap-3 text-sm text-muted">
                {dict.terms.sections.map((section) => (
                  <Link key={section.id} href={`#${section.id}`} className="transition-colors hover:text-brass">
                    {section.title}
                  </Link>
                ))}
              </nav>
            </Card>
          </Reveal>

          <div className="space-y-6">
            {dict.terms.sections.map((section, index) => (
              <Reveal key={section.id} delay={index * 0.06}>
                <section id={section.id} className="scroll-mt-28 rounded-[32px] border border-[#1A1A1A] bg-[rgba(9,9,9,0.72)] p-7 md:p-9">
                  <p className="text-xs uppercase tracking-[0.28em] text-brass">0{index + 1}</p>
                  <h2 className="mt-3 font-[family-name:var(--font-cormorant)] text-4xl text-foreground">{section.title}</h2>
                  <Separator className="my-6" />
                  <div className="space-y-5 text-sm leading-8 text-muted">
                    {section.body.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                </section>
              </Reveal>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
