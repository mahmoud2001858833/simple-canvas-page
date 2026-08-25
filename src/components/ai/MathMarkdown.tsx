import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import katex from "katex";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/utils";

interface MathMarkdownProps {
  content: string;
  className?: string;
}

const ARABIC = /[\u0600-\u06FF]/;

/** True when KaTeX can actually render the snippet. */
function isValidMath(tex: string): boolean {
  const body = tex.trim();
  if (!body || ARABIC.test(body)) return false;
  try {
    katex.renderToString(body, { throwOnError: true, strict: false });
    return true;
  } catch {
    return false;
  }
}

/** Latex-looking fragments that models emit without any delimiters. */
const FRAGMENT_PATTERN =
  /\\(?:frac|dfrac|tfrac|sqrt|sum|int|lim|vec|cdot|times|pm|infty|approx|neq|leq|geq|alpha|beta|theta|pi|Delta|sin|cos|tan|ln|log|left|right|text|mathrm)\b[^\s\u0600-\u06FF]*(?:\{[^{}]*\}[^\s\u0600-\u06FF]*)*/g;

/** Wraps bare latex fragments inside plain text so they render as math. */
function wrapFragments(text: string): string {
  return text.replace(FRAGMENT_PATTERN, (match) => {
    const cleaned = match.replace(/[.,،؛:]+$/, "");
    const suffix = match.slice(cleaned.length);
    return isValidMath(cleaned) ? `$${cleaned}$${suffix}` : match;
  });
}

/**
 * Rebuilds the math delimiters models emit. Any `$`/`$$` span that KaTeX
 * cannot render (or that contains Arabic prose or markdown bold) is treated
 * as plain text, so raw dollar signs and mangled Arabic never reach the UI.
 */
function normalizeMath(input: string): string {
  const pre = input
    .replace(/\\\$/g, "$")
    .replace(/\\\[([\s\S]+?)\\\]/g, (_m, body) => `\n\n$$${body}$$\n\n`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_m, body) => `$${body}$`);

  let out = "";
  let text = "";
  let i = 0;

  const flushText = () => {
    out += wrapFragments(text);
    text = "";
  };

  while (i < pre.length) {
    const ch = pre[i];
    if (ch !== "$") {
      text += ch;
      i += 1;
      continue;
    }

    const isDisplay = pre[i + 1] === "$";
    const openLen = isDisplay ? 2 : 1;
    const closer = isDisplay ? "$$" : "$";
    let searchFrom = i + openLen;
    let close = -1;

    // find the next closing delimiter of the same kind
    while (searchFrom < pre.length) {
      const idx = pre.indexOf(closer, searchFrom);
      if (idx === -1) break;
      if (!isDisplay && pre[idx + 1] === "$") {
        searchFrom = idx + 2;
        continue;
      }
      close = idx;
      break;
    }

    if (close === -1) {
      // unmatched delimiter: drop it and keep the rest as text
      i += openLen;
      continue;
    }

    const rawBody = pre.slice(i + openLen, close);
    const body = rawBody.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();

    if (isValidMath(body) && (isDisplay || !rawBody.includes("\n"))) {
      flushText();
      out += isDisplay ? `\n\n$$${body}$$\n\n` : `$${body}$`;
    } else {
      // not real math: keep the inner content as text, delimiters removed
      text += rawBody;
    }
    i = close + closer.length;
  }

  flushText();
  return out;
}

/**
 * Turns "1. عنوان" / "2) عنوان" section lines that models emit as plain
 * paragraphs into real markdown headings, and guarantees blank lines
 * around block math so it renders as display math.
 */
function normalizeStructure(input: string): string {
  const lines = input.split("\n");
  const out = lines.map((line) => {
    const m = /^\s*(\d{1,2})[.)]\s+(\S[^$\n]{0,80})$/.exec(line);
    if (m && !/[.،:!?]$/.test(m[2].trim()) && m[2].trim().split(/\s+/).length <= 8) {
      return `\n### ${m[1]}. ${m[2].trim()}\n`;
    }
    return line;
  });
  return out
    .join("\n")
    .replace(/([^\n])\n\$\$/g, "$1\n\n$$")
    .replace(/\$\$\n([^\n$])/g, "$$\n\n$1")
    .replace(/\n{3,}/g, "\n\n");
}


export function MathMarkdown({ content, className }: MathMarkdownProps) {
  return (
    <div
      className={cn(
        "text-sm leading-7 break-words",
        // paragraphs & separators
        "[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_hr]:my-4 [&_hr]:border-border",
        // headings
        "[&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2",
        "[&_h2]:text-[15px] [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2",
        "[&_h3]:text-sm [&_h3]:font-bold [&_h3]:mt-4 [&_h3]:mb-1.5 [&_h3]:text-primary",
        "[&_h4]:text-sm [&_h4]:font-semibold [&_h4]:mt-3 [&_h4]:mb-1",
        // emphasis
        "[&_strong]:font-bold [&_strong]:text-foreground [&_em]:italic",
        // lists (logical padding so RTL/LTR both work)
        "[&_ul]:list-disc [&_ol]:list-decimal [&_ul]:ps-5 [&_ol]:ps-5 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-1 [&_li]:leading-7",
        "[&_li>ul]:my-1 [&_li>ol]:my-1 [&_li::marker]:text-primary/70",
        // quotes, code, tables
        "[&_blockquote]:border-s-2 [&_blockquote]:border-primary/40 [&_blockquote]:ps-3 [&_blockquote]:my-2 [&_blockquote]:text-muted-foreground",
        "[&_code]:text-xs [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded",
        "[&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre_code]:bg-transparent [&_pre_code]:p-0",
        "[&_table]:w-full [&_table]:my-3 [&_table]:text-xs [&_th]:border [&_th]:border-border [&_th]:p-1.5 [&_th]:bg-muted [&_td]:border [&_td]:border-border [&_td]:p-1.5",
        // math
        "[&_.katex]:text-[1.05em] [&_.katex-display]:my-4 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display]:py-1",
        "[&_.katex-display]:text-center",
        className
      )}
      dir="auto"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false, output: "html" }]]}
      >
        {normalizeStructure(normalizeMath(content))}
      </ReactMarkdown>
    </div>
  );
}

export default MathMarkdown;
