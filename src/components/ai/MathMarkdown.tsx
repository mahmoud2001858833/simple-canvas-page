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

/**
 * Normalizes the various LaTeX delimiters models emit (\( \), \[ \])
 * into the $ / $$ syntax that remark-math understands.
 */
function normalizeMath(input: string): string {
  return input
    .replace(/\\\[([\s\S]+?)\\\]/g, (_m, body) => `\n\n$$${body}$$\n\n`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_m, body) => `$${body}$`)
    .replace(/\\begin\{(equation|align|aligned|cases|matrix|pmatrix|bmatrix)\*?\}([\s\S]+?)\\end\{\1\*?\}/g,
      (m) => `\n\n$$${m}$$\n\n`);
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
