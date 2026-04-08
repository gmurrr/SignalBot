import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export function AuthShell({
  title,
  subtitle,
  cta,
  footerLabel,
  footerHref,
  footerText
}: {
  title: string;
  subtitle: string;
  cta: string;
  footerLabel: string;
  footerHref: string;
  footerText: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="grid w-full max-w-6xl gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="flex flex-col justify-between bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.16),transparent_50%),rgba(8,8,8,0.95)] p-8 md:p-10">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-brass">Client access</p>
            <h1 className="mt-4 font-[family-name:var(--font-cormorant)] text-5xl text-foreground">{title}</h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-muted">{subtitle}</p>
          </div>
          <div className="mt-12 rounded-[28px] border border-[rgba(212,175,55,0.14)] bg-[rgba(255,255,255,0.02)] p-6">
            <p className="text-xs uppercase tracking-[0.28em] text-muted">EasyCart ready zone</p>
            <p className="mt-3 text-lg text-foreground">
              This block is reserved for your payment wall, upsell summary or membership validation once EasyCart is plugged in.
            </p>
          </div>
        </Card>

        <Card className="p-8 md:p-10">
          <div className="space-y-4">
            <Input placeholder="Email address" type="email" />
            <Input placeholder="Password" type="password" />
            {cta.toLowerCase().includes("create") ? <Input placeholder="Access code or invite note" /> : null}
            <Button className="w-full">{cta}</Button>
          </div>
          <Separator className="my-8" />
          <div className="space-y-3 text-sm text-muted">
            <p>Magic link, OAuth providers and EasyCart entitlement checks can be added here without redesigning the page shell.</p>
            <p>
              {footerLabel}{" "}
              <Link href={footerHref} className="text-brass">
                {footerText}
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </main>
  );
}
