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

/** Characters that may legitimately appear inside a latex snippet. */
const MATH_CHARS = "A-Za-z0-9\\\\^_{}()\\[\\]+\\-*/=<>|!'’.,:;~ \\t";
const MATH_RUN = new RegExp(`[${MATH_CHARS}]*(?:\\\\[a-zA-Z]+|[A-Za-z0-9)\\]}]\\s*(?:\\^|_|=)\\s*[A-Za-z0-9({\\\\+-])[${MATH_CHARS}]*`, "g");
const TRAILING_JUNK = /[\s.,،؛:;!?)]+$/;

/** Trims a candidate from the right until KaTeX accepts it. */
function longestValidMath(candidate: string): { tex: string; rest: string } | null {
  let body = candidate;
  while (body.trim().length > 0) {
    const trimmed = body.replace(TRAILING_JUNK, "");
    if (trimmed.length === 0) return null;
    if (/\\[a-zA-Z]+|[\^_=]/.test(trimmed) && isValidMath(trimmed)) {
      return { tex: trimmed.trim(), rest: candidate.slice(trimmed.length) };
    }
    body = trimmed.slice(0, -1);
  }
  return null;
}

/** Wraps bare latex/math runs inside plain text so they render as math. */
function wrapFragments(text: string): string {
  return text.replace(MATH_RUN, (match) => {
    const leading = match.match(/^\s*/)?.[0] ?? "";
    const candidate = match.slice(leading.length);
    const valid = longestValidMath(candidate);
    if (!valid) return match;
    return `${leading}$${valid.tex}$${valid.rest}`;
  });
}

/**
 * Rebuilds the math delimiters models emit. Explicit math spans that KaTeX can
 * render are preserved; anything else loses its delimiters so raw `$` signs and
 * mangled Arabic never reach the UI. Bare latex is re-wrapped afterwards.
 */
function normalizeMath(input: string): string {
  const stash: { display: boolean; tex: string }[] = [];
  const stashToken = (tex: string, display: boolean) => {
    stash.push({ display, tex });
    return `@@MATH${stash.length - 1}@@`;
  };

  let out = input.replace(/\\\$/g, "$");

  const takeExplicit = (body: string, display: boolean, original: string) => {
    const tex = body.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
    return isValidMath(tex) ? stashToken(tex, display) : original.replace(/\$/g, "");
  };

  out = out
    .replace(/\\\[([\s\S]+?)\\\]/g, (m, body) => takeExplicit(body, true, m))
    .replace(/\\\(([\s\S]+?)\\\)/g, (m, body) => takeExplicit(body, false, m))
    // Arabic prose is never math, so a span containing it is a broken delimiter.
    .replace(/\$\$([^$\u0600-\u06FF]+?)\$\$/g, (m, body) => takeExplicit(body, true, m))
    .replace(/\$([^$\n\u0600-\u06FF]+?)\$/g, (m, body) => takeExplicit(body, false, m));

  // Any dollar left over was a broken delimiter (keep real currency like 50$ / $50).
  out = out.replace(/\$/g, (m, offset: number) => {
    const prev = out[offset - 1] ?? "";
    const next = out[offset + 1] ?? "";
    return /\d/.test(prev) || /\d/.test(next) ? m : "";
  });

  out = wrapFragments(out);

  // Restore validated math with the right delimiters.
  out = out.replace(/@@MATH(\d+)@@/g, (_m, idx) => {
    const entry = stash[Number(idx)];
    if (!entry) return "";
    return entry.display ? `\n\n$$${entry.tex}$$\n\n` : `$${entry.tex}$`;
  });

  // Headings that models glue onto the previous line need their own line.
  out = out.replace(/([^\n])(#{2,4}\s)/g, "$1\n\n$2");

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
    // A line that is nothing but inline math should render as display math.
    const only = /^\s*\$([^$]+)\$\s*$/.exec(line);
    if (only) return `\n$$${only[1].trim()}$$\n`;
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


export function prepareMathMarkdown(content: string): string {
  return normalizeStructure(normalizeMath(content));
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
        {prepareMathMarkdown(content)}
      </ReactMarkdown>
    </div>
  );
}

export default MathMarkdown;
