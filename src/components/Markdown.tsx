"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { useState, type ComponentPropsWithoutRef, type ReactElement } from "react";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <button
      onClick={copy}
      className="absolute top-2 right-2 text-xs px-2 py-1 rounded bg-[#21262d] text-[#8b949e] hover:text-white border border-[#30363d]"
      aria-label="Copy code"
    >
      {copied ? "copied" : "copy"}
    </button>
  );
}

export default function Markdown({ content }: { content: string }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          pre: ({ children, ...rest }: ComponentPropsWithoutRef<"pre">) => {
            const asElement = children as ReactElement | undefined;
            const code = (asElement?.props as
              | { children?: unknown }
              | undefined)?.children as string | undefined;
            return (
              <div className="relative">
                <pre {...rest}>{children}</pre>
                {typeof code === "string" && code.length > 0 && (
                  <CopyButton text={code} />
                )}
              </div>
            );
          },
          a: ({ href, children }: ComponentPropsWithoutRef<"a">) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}