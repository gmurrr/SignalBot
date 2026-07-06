import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { Download } from "lucide-react";

import { LegalDocumentLinks, type LegalDocumentLink } from "@/components/legal/legal-document-links";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TermsDocumentPageProps = {
  boxText: string;
  downloadLabel: string;
  effectiveDateLabel: string;
  fileName: string;
  languageLabel: string;
  note?: string;
  pdfHref: string;
  relatedLinks: LegalDocumentLink[];
  title: string;
  versionLabel: string;
};

type LegalBlock =
  | {
      id: string;
      level: 2 | 3;
      text: string;
      type: "heading";
    }
  | {
      text: string;
      type: "paragraph";
    }
  | {
      items: string[];
      start: number;
      type: "list";
    };

export function TermsDocumentPage({
  boxText,
  downloadLabel,
  effectiveDateLabel,
  fileName,
  languageLabel,
  note,
  pdfHref,
  relatedLinks,
  title,
  versionLabel
}: TermsDocumentPageProps) {
  const markdown = readTermsMarkdown(fileName);
  const blocks = parseLegalMarkdown(markdown);
  const toc = blocks.filter((block): block is Extract<LegalBlock, { type: "heading" }> => {
    return block.type === "heading" && (block.text.startsWith("§") || block.text.startsWith("Załącznik") || block.text.startsWith("Appendix"));
  });

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-[940px] px-6 py-12 lg:px-10">
        <article className="space-y-10">
          <header className="border-b border-[#1A1A1A] pb-8">
            <p className="text-xs uppercase tracking-[0.32em] text-brass">Legal</p>
            <h1 className="mt-5 break-words font-[family-name:var(--font-cormorant)] text-5xl leading-none text-foreground md:text-7xl">{title}</h1>
            <div className="mt-6 flex flex-wrap gap-3 text-sm text-muted">
              <span>{effectiveDateLabel}</span>
              <span aria-hidden="true">/</span>
              <span>{versionLabel}</span>
              <span aria-hidden="true">/</span>
              <span>{languageLabel}</span>
            </div>
            <div className="mt-8">
              <Button asChild>
                <Link href={pdfHref}>
                  <Download className="h-4 w-4" />
                  {downloadLabel}
                </Link>
              </Button>
            </div>
          </header>

          <aside className="rounded-2xl border border-[rgba(212,175,55,0.2)] bg-[rgba(212,175,55,0.08)] p-5 text-sm leading-7 text-[#f4deb0]">
            {boxText}
          </aside>

          {note ? <aside className="rounded-2xl border border-[#1A1A1A] bg-[rgba(255,255,255,0.03)] p-5 text-sm leading-7 text-muted">{note}</aside> : null}

          <LegalDocumentLinks links={relatedLinks} />

          <nav aria-label="Terms table of contents" className="grid gap-3 rounded-2xl border border-[#1A1A1A] bg-[rgba(9,9,9,0.72)] p-5 text-sm text-muted sm:grid-cols-2">
            {toc.map((section) => (
              <Link key={section.id} href={`#${section.id}`} className="break-words transition-colors hover:text-brass">
                {section.text}
              </Link>
            ))}
          </nav>

          <div className="space-y-8">
            {blocks.map((block, index) => (
              <LegalBlockView block={block} key={`${block.type}-${index}`} />
            ))}
          </div>
        </article>
      </main>
    </>
  );
}

function LegalBlockView({ block }: { block: LegalBlock }) {
  if (block.type === "heading") {
    const Heading = block.level === 2 ? "h2" : "h3";

    return (
      <Heading
        id={block.id}
        className={cn(
          "scroll-mt-28 break-words pt-2 font-[family-name:var(--font-cormorant)] leading-tight text-foreground",
          block.level === 2 ? "text-4xl md:text-5xl" : "text-3xl"
        )}
      >
        {block.text}
      </Heading>
    );
  }

  if (block.type === "list") {
    return (
      <ol className="list-decimal space-y-4 pl-6 text-sm leading-8 text-muted marker:text-brass" start={block.start}>
        {block.items.map((item) => (
          <li className="break-words" key={item}>
            {item}
          </li>
        ))}
      </ol>
    );
  }

  return <p className="break-words text-sm leading-8 text-muted">{block.text}</p>;
}

function readTermsMarkdown(fileName: string) {
  const termsPath = path.join(process.cwd(), "content", fileName);
  return fs.readFileSync(termsPath, "utf8");
}

function parseLegalMarkdown(markdown: string): LegalBlock[] {
  const blocks: LegalBlock[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let listStart: number | null = null;

  function flushParagraph() {
    if (!paragraph.length) {
      return;
    }

    const text = paragraph.join(" ").trim();
    paragraph = [];

    if (shouldSkipLeadLine(text)) {
      return;
    }

    blocks.push({
      text,
      type: "paragraph"
    });
  }

  function flushList() {
    if (!listItems.length) {
      return;
    }

    blocks.push({
      items: listItems,
      start: listStart ?? 1,
      type: "list"
    });
    listItems = [];
    listStart = null;
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      flushParagraph();
      flushList();

      const text = headingMatch[2].trim();
      if (shouldSkipLeadLine(text)) {
        continue;
      }

      blocks.push({
        id: buildHeadingId(text),
        level: headingMatch[1].length === 3 ? 3 : 2,
        text,
        type: "heading"
      });
      continue;
    }

    const listMatch = /^(\d+)\.\s+(.+)$/.exec(trimmed);
    if (listMatch) {
      flushParagraph();
      if (!listItems.length) {
        listStart = Number(listMatch[1]);
      }
      listItems.push(listMatch[2].trim());
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();

  return blocks;
}

function shouldSkipLeadLine(text: string) {
  return (
    text === "REGULAMIN ŚWIADCZENIA USŁUG DROGĄ ELEKTRONICZNĄ" ||
    text === "SERWISU ZETA SIGNALS" ||
    text === "TERMS OF SERVICE FOR THE PROVISION OF ELECTRONIC SERVICES" ||
    text === "ZETA SIGNALS SERVICE" ||
    text.startsWith("Data wejścia w życie:") ||
    text.startsWith("Effective date:")
  );
}

function buildHeadingId(text: string) {
  const paragraphMatch = /^§\s*(\d+)/.exec(text);
  if (paragraphMatch) {
    return `section-${paragraphMatch[1]}`;
  }

  if (text.startsWith("Załącznik")) {
    return "appendix-1";
  }

  if (text.startsWith("Appendix")) {
    return "appendix-1";
  }

  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
