import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/utils";

interface MathMarkdownProps {
  content: string;
  className?: string;
}

const MATH_HINT_PATTERN = /(?:\\(?:frac|sqrt|sum|int|lim|vec|Delta|theta|alpha|beta|pi|approx|neq|leq|geq|times|cdot|pm|infty|text|begin|end)|[a-zA-Z]\s*(?:[_^]|=)|\d+\s*[+\-*/=]\s*\d+)/;

function looksLikeMath(value: string): boolean {
  return MATH_HINT_PATTERN.test(value.trim());
}

function countSingleDollarDelimiters(value: string): number {
  let count = 0;
  for (let i = 0; i < value.length; i += 1) {
    if (value[i] === "$" && value[i - 1] !== "$" && value[i + 1] !== "$") {
      count += 1;
    }
  }
  return count;
}

/**
 * Normalizes the various LaTeX delimiters models emit into the syntax
 * remark-math understands, and hides broken/escaped dollar delimiters.
 */
function normalizeMath(input: string): string {
  let out = input
    // Models sometimes escape delimiters as \$...\$, which renders as visible dollar signs.
    .replace(/\\\$\\\$/g, "$$")
    .replace(/\\\$/g, "$")
    .replace(/\\\[([\s\S]+?)\\\]/g, (_m, body) => `\n\n$$${body}$$\n\n`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_m, body) => `$${body}$`)
    .replace(/\\begin\{(equation|align|aligned|cases|matrix|pmatrix|bmatrix)\*?\}([\s\S]+?)\\end\{\1\*?\}/g,
      (m) => `\n\n$$${m}$$\n\n`);

  // Normalize delimiter spacing so "$ x $" and "$$ x $$" are parsed.
  out = out
    .replace(/\$\$\s+([\s\S]*?)\s+\$\$/g, (_m, body) => `$$${body}$$`)
    .replace(/\$(?!\$)\s+([^$\n]+?)\s+\$(?!\$)/g, (_m, body) => `$${body}$`);

  // Repair mismatched delimiters models emit: "$x$$" or "$$x$" -> "$$x$$"
  out = out
    .replace(/(^|[^$])\$(?!\$)([^$\n]+?)\$\$(?!\$)/g, (_m, pre, body) => `${pre}\n\n$$${body}$$\n\n`)
    .replace(/\$\$(?!\$)([^$\n]+?)\$(?!\$)/g, (_m, body) => `\n\n$$${body}$$\n\n`);

  // Wrap bare LaTeX-only lines that the model forgot to delimit.
  out = out
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("$") || trimmed.startsWith("#") || trimmed.startsWith("- ")) return line;
      if (looksLikeMath(trimmed) && !/[\u0600-\u06FF]/.test(trimmed) && trimmed.length <= 220) {
        return `$$${trimmed}$$`;
      }
      return line;
    })
    .join("\n");

  // A line that is nothing but inline math becomes display math on its own
  out = out.replace(/(^|\n)[ \t]*\$(?!\$)([^$\n]+?)\$[ \t]*(?=\n|$)/g,
    (_m, pre, body) => `${pre}\n$$${body}$$\n`);

  // During streaming the model can send an opening delimiter before the close.
  // Add a temporary close delimiter so the UI never shows raw dollar signs.
  const displayMatches = out.match(/\$\$/g) || [];
  if (displayMatches.length % 2 === 1) {
    out += "$$";
  }

  const inlineDelimiterCount = countSingleDollarDelimiters(out);
  if (inlineDelimiterCount % 2 === 1) {
    const lastDollar = out.lastIndexOf("$");
    const tail = out.slice(lastDollar + 1);
    if (looksLikeMath(tail)) out += "$";
    else out = `${out.slice(0, lastDollar)}${tail}`;
  }

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
