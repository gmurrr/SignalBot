import Link from "next/link";

import { Button } from "@/components/ui/button";

export type LegalDocumentLink = {
  href: string;
  label: string;
};

export function LegalDocumentLinks({ ariaLabel = "Legal document links", links }: { ariaLabel?: string; links: LegalDocumentLink[] }) {
  return (
    <nav aria-label={ariaLabel} className="flex flex-wrap gap-3 text-sm">
      {links.map((link) => (
        <Button asChild key={`${link.href}-${link.label}`} size="sm" variant="outline">
          <Link href={link.href}>{link.label}</Link>
        </Button>
      ))}
    </nav>
  );
}
