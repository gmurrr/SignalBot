import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { Download } from "lucide-react";

import { LegalDocumentLinks } from "@/components/legal/legal-document-links";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PrivacyDocumentPageProps = {
  downloadLabel: string;
  effectiveDateLabel: string;
  fileName: string;
  languageLabel: string;
  links: {
    contact: string;
    cookie: string;
    privacyPdf: string;
    refund: string;
    riskWarning: string;
    terms: string;
  };
  navigationLabels: {
    contact: string;
    cookie: string;
    refund: string;
    riskWarning: string;
    terms: string;
  };
  summary: string;
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
      lines: string[];
      type: "paragraph";
    }
  | {
      items: Array<{ marker: string; text: string }>;
      type: "list";
    };

export function PrivacyDocumentPage({
  downloadLabel,
  effectiveDateLabel,
  fileName,
  languageLabel,
  links,
  navigationLabels,
  summary,
  title,
  versionLabel
}: PrivacyDocumentPageProps) {
  const markdown = readPrivacyMarkdown(fileName);
  const blocks = parsePrivacyMarkdown(markdown);
  const toc = blocks.filter((block): block is Extract<LegalBlock, { type: "heading" }> => block.type === "heading" && block.text.startsWith("§"));

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
                <Link href={links.privacyPdf}>
                  <Download className="h-4 w-4" />
                  {downloadLabel}
                </Link>
              </Button>
            </div>
          </header>

          <aside className="rounded-2xl border border-[rgba(212,175,55,0.2)] bg-[rgba(212,175,55,0.08)] p-5 text-sm leading-7 text-[#f4deb0]">
            {summary}
          </aside>

          <LegalDocumentLinks
            links={[
              { href: links.terms, label: navigationLabels.terms },
              { href: links.cookie, label: navigationLabels.cookie },
              { href: links.refund, label: navigationLabels.refund },
              { href: links.riskWarning, label: navigationLabels.riskWarning },
              { href: links.contact, label: navigationLabels.contact }
            ]}
          />

          <nav aria-label="Privacy Policy table of contents" className="grid gap-3 rounded-2xl border border-[#1A1A1A] bg-[rgba(9,9,9,0.72)] p-5 text-sm text-muted sm:grid-cols-2">
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
          block.level === 2 ? "text-4xl md:text-5xl" : "text-2xl md:text-3xl"
        )}
      >
        {renderInlineMarkdown(block.text)}
      </Heading>
    );
  }

  if (block.type === "list") {
    return (
      <ol className="space-y-4 text-sm leading-8 text-muted">
        {block.items.map((item, index) => (
          <li className="grid grid-cols-[auto_1fr] gap-3 break-words" key={`${item.marker}-${index}`}>
            <span className="text-brass">{item.marker}</span>
            <span>{renderInlineMarkdown(item.text)}</span>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <p className="break-words text-sm leading-8 text-muted">
      {block.lines.map((line, index) => (
        <span key={`${line}-${index}`}>
          {index > 0 ? <br /> : null}
          {renderInlineMarkdown(line)}
        </span>
      ))}
    </p>
  );
}

function readPrivacyMarkdown(fileName: string) {
  const documentPath = path.join(process.cwd(), "content", fileName);
  return fs.readFileSync(documentPath, "utf8");
}

function parsePrivacyMarkdown(markdown: string): LegalBlock[] {
  const blocks: LegalBlock[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let paragraph: string[] = [];
  let listItems: Array<{ marker: string; text: string }> = [];

  function flushParagraph() {
    if (!paragraph.length) {
      return;
    }

    const linesToAdd = paragraph.map((line) => line.trim()).filter(Boolean);
    paragraph = [];

    if (!linesToAdd.length || linesToAdd.every(shouldSkipLeadLine)) {
      return;
    }

    blocks.push({
      lines: linesToAdd,
      type: "paragraph"
    });
  }

  function flushList() {
    if (!listItems.length) {
      return;
    }

    blocks.push({
      items: listItems,
      type: "list"
    });
    listItems = [];
  }

  for (const line of lines) {
    const trimmed = line.trim().replace(/\s{2}$/, "");

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

    if (shouldSkipLeadLine(trimmed)) {
      continue;
    }

    const listMatch = /^(\d+\.|[a-z]\))\s+(.+)$/.exec(trimmed);
    if (listMatch) {
      flushParagraph();
      listItems.push({
        marker: listMatch[1],
        text: listMatch[2].trim()
      });
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
  const plainText = stripInlineMarkdown(text);

  return (
    plainText === "POLITYKA PRYWATNOŚCI" ||
    plainText === "POLITYKA PRYWATNOŚCI SERWISU ZETA SIGNALS" ||
    plainText === "PRIVACY POLICY" ||
    plainText === "PRIVACY POLICY OF THE ZETA SIGNALS SERVICE" ||
    plainText === "SERWISU ZETA SIGNALS" ||
    plainText === "ZETA SIGNALS SERVICE" ||
    plainText.startsWith("Data wejścia w życie:") ||
    plainText.startsWith("Wersja dokumentu:") ||
    plainText.startsWith("Adres serwisu:") ||
    plainText.startsWith("Effective date:") ||
    plainText.startsWith("Document version:") ||
    plainText.startsWith("Service address:")
  );
}

function stripInlineMarkdown(text: string) {
  return text.replace(/\*\*(.*?)\*\*/g, "$1").replace(/\s{2}$/g, "").trim();
}

function buildHeadingId(text: string) {
  const paragraphMatch = /^§\s*(\d+)/.exec(text);
  if (paragraphMatch) {
    return `section-${paragraphMatch[1]}`;
  }

  return stripInlineMarkdown(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function renderInlineMarkdown(text: string) {
  const segments = text.split(/(\*\*[^*]+\*\*)/g);

  return segments.map((segment, index) => {
    const strongMatch = /^\*\*([^*]+)\*\*$/.exec(segment);
    if (strongMatch) {
      return <strong key={`${segment}-${index}`} className="font-semibold text-foreground">{strongMatch[1]}</strong>;
    }

    return segment;
  });
}
