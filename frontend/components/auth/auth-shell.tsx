"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/lib/i18n/provider";

export function AuthShell({ mode }: { mode: "signIn" | "signUp" }) {
  const { dict } = useI18n();
  const content = dict.auth[mode];
  const isSignup = mode === "signUp";
  const footerHref = isSignup ? "/auth/sign-in" : "/auth/sign-up";

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="grid w-full max-w-6xl gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="flex flex-col justify-between border-[#1A1A1A] bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.16),transparent_50%),rgba(8,8,8,0.95)] p-8 md:p-10">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-brass">{dict.auth.clientAccess}</p>
            <h1 className="mt-4 font-[family-name:var(--font-cormorant)] text-5xl text-foreground">{content.title}</h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-muted">{content.subtitle}</p>
          </div>
          <div className="mt-12 rounded-[28px] border border-[rgba(212,175,55,0.14)] bg-[rgba(255,255,255,0.02)] p-6">
            <p className="text-xs uppercase tracking-[0.28em] text-muted">{dict.auth.easyCartLabel}</p>
            <p className="mt-3 text-lg text-foreground">{dict.auth.easyCartBody}</p>
          </div>
        </Card>

        <Card className="border-[#1A1A1A] p-8 md:p-10">
          <div className="space-y-4">
            <Input placeholder={dict.auth.email} type="email" />
            <Input placeholder={dict.auth.password} type="password" />
            {isSignup ? <Input placeholder={dict.auth.accessCode} /> : null}
            <Button className="w-full">{content.cta}</Button>
          </div>
          <Separator className="my-8" />
          <div className="space-y-3 text-sm text-muted">
            <p>{dict.auth.helper}</p>
            <p>
              {content.footerLabel}{" "}
              <Link href={footerHref} className="text-brass">
                {content.footerText}
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </main>
  );
}
