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

export function MathMarkdown({ content, className }: MathMarkdownProps) {
  return (
    <div
      className={cn(
        "text-sm leading-relaxed break-words [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pr-5 [&_ol]:list-decimal [&_ol]:pr-5 [&_.katex-display]:my-3 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_code]:text-xs",
        className
      )}
      dir="auto"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false, output: "html" }]]}
      >
        {normalizeMath(content)}
      </ReactMarkdown>
    </div>
  );
}

export default MathMarkdown;
