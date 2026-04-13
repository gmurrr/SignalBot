import Link from "next/link";
import { ArrowRight, Compass, Scan, Zap } from "lucide-react";

import { MarketStatusBadge } from "@/components/market-status-badge";
import { Reveal } from "@/components/reveal";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const story = [
  "Zeta Signals powstało z potrzeby uporządkowania decyzji na rynku złota. Zamiast reagować na każdy ruch świecy, system buduje kontekst z wyższych interwałów, filtruje szum i dopuszcza tylko te setupy, które mają sens w strukturze rynku oraz w oknach wysokiej płynności."
];

const steps = [
  {
    title: "Warstwa 1: H1 Bias",
    body: "Fundamentem każdego sygnału jest analiza trendu na interwale H1. Silnik sprawdza położenie ceny względem EMA 200 oraz Chmury Ichimoku. Dodatkowym filtrem bezpieczeństwa jest analiza indeksu DXY, która blokuje ryzykowne setupy. Całość działa wyłącznie w oknach płynności: Londyn (09:00-12:00) oraz Nowy Jork (14:30-18:30).",
    icon: Compass
  },
  {
    title: "Warstwa 2: Liquidity Sweep",
    body: "Algorytm skanuje ostatnie 24 godziny H1 w poszukiwaniu kluczowych szczytów i dołków. Setup powstaje dopiero po agresywnym wyczyszczeniu płynności i szybkim powrocie ceny ponad poziom w ciągu maksymalnie 3 świec M5.",
    icon: Scan
  },
  {
    title: "Warstwa 3: M5 Trigger",
    body: "Finalny sygnał pojawia się po potwierdzeniu impetu przez Fair Value Gap albo formację Engulfing, wspartą odwróceniem RSI. Stop Loss jest kotwiczony za świecą czyszczącą płynność, a cele bazują na RR oraz kolejnych poziomach H1.",
    icon: Zap
  }
];

const faq = [
  {
    q: "Dlaczego nie ma sygnałów co kilka minut?",
    a: "Stawiamy na jakość, nie ilość. System generuje sygnał tylko wtedy, gdy zgadzają się warunki H1, korelacja DXY, okno płynności i trigger M5."
  },
  {
    q: "Czy muszę mieć konto u konkretnego brokera?",
    a: "Nie. Sygnały bazują na XAU/USD i mogą być używane u dowolnego brokera oferującego złoto, choć najlepsze efekty daje niskie opóźnienie oraz stabilny spread."
  },
  {
    q: "W jakich godzinach system jest aktywny?",
    a: "Egzekucja sygnałów działa głównie podczas sesji londyńskiej i nowojorskiej. Poza tymi blokami system przechodzi w tryb monitoringu."
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
              <div className="flex flex-wrap items-center gap-3">
                <MarketStatusBadge />
              </div>
              <h1 className="mt-6 font-[family-name:var(--font-cormorant)] text-6xl leading-[0.95] text-foreground md:text-8xl">
                Zeta Signals dla XAU/USD z algorytmiczną precyzją.
              </h1>
              <p className="mt-8 max-w-2xl text-base leading-8 text-muted md:text-lg">
                Platforma sygnałowa dla rynku złota, oparta na H1 Bias, DXY, liquidity sweep i egzekucji M5. Wszystko zaprojektowane tak, aby aktywny sygnał nigdy nie był mylony z pozycją historyczną.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <Button asChild size="lg">
                  <Link href="/dashboard">
                    Rozpocznij
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/auth/sign-in">Logowanie / Rejestracja</Link>
                </Button>
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <Card className="gold-glow relative overflow-hidden border-[#1A1A1A] p-8 md:p-10">
              <p className="text-xs uppercase tracking-[0.32em] text-brass">Opis algorytmu</p>
              <div className="mt-8 grid gap-6 md:grid-cols-2">
                <PanelStat label="Trend i Bias" value="EMA 200 + Ichimoku + DXY" />
                <PanelStat label="Timing" value="Londyn + Nowy Jork" />
                <PanelStat label="Płynność" value="Sweep poziomów H1" />
                <PanelStat label="Egzekucja" value="FVG / Engulfing + RSI" />
              </div>
              <Separator className="my-8" />
              <p className="text-sm leading-7 text-muted">
                Wielowarstwowa konfluencja danych ogranicza szum rynkowy i błędy decyzyjne. System dopuszcza wyłącznie setupy, które przechodzą przez filtry środowiska, płynności i potwierdzenia na M5.
              </p>
            </Card>
          </Reveal>
        </section>

        <section id="story" className="grid gap-8 lg:grid-cols-2">
          <Reveal>
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-brass">Historia</p>
              <h2 className="mt-4 font-[family-name:var(--font-cormorant)] text-5xl text-foreground">Od skryptu do platformy Zeta Signals</h2>
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
              <p className="text-xs uppercase tracking-[0.32em] text-brass">Jak to działa?</p>
              <h2 className="mt-4 font-[family-name:var(--font-cormorant)] text-5xl text-foreground">Trzy warstwy, jedna decyzja</h2>
            </div>
          </Reveal>
          <div className="grid gap-6 lg:grid-cols-3">
            {steps.map((step, index) => {
              const Icon = step.icon;
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
              <p className="text-xs uppercase tracking-[0.32em] text-brass">FAQ</p>
              <h2 className="mt-4 font-[family-name:var(--font-cormorant)] text-5xl text-foreground">Praktyczne odpowiedzi</h2>
            </div>
          </Reveal>
          <div className="space-y-4 lg:col-span-2">
            {faq.map((item, index) => (
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
