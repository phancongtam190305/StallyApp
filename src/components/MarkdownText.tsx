import React from "react";

export function parseInline(text: string): React.ReactNode[] {
  // Handle bold with **
  const boldRegex = /\*\*([\s\S]*?)\*\*/;
  const matchBold = text.match(boldRegex);
  if (matchBold && matchBold.index !== undefined) {
    const before = text.substring(0, matchBold.index);
    const inner = matchBold[1];
    const after = text.substring(matchBold.index + matchBold[0].length);
    
    return [
      ...parseInline(before),
      <strong key={`b-${matchBold.index}`} className="font-extrabold text-inherit">{parseInline(inner)}</strong>,
      ...parseInline(after)
    ];
  }
  
  // Handle italic with *
  const italicStarRegex = /\*([\s\S]*?)\*/;
  const matchItalicStar = text.match(italicStarRegex);
  if (matchItalicStar && matchItalicStar.index !== undefined) {
    const before = text.substring(0, matchItalicStar.index);
    const inner = matchItalicStar[1];
    const after = text.substring(matchItalicStar.index + matchItalicStar[0].length);
    
    return [
      ...parseInline(before),
      <em key={`i-star-${matchItalicStar.index}`} className="italic">{parseInline(inner)}</em>,
      ...parseInline(after)
    ];
  }
  
  // Handle italic with _
  const italicUnderscoreRegex = /_([\s\S]*?)_/;
  const matchItalicUnderscore = text.match(italicUnderscoreRegex);
  if (matchItalicUnderscore && matchItalicUnderscore.index !== undefined) {
    const before = text.substring(0, matchItalicUnderscore.index);
    const inner = matchItalicUnderscore[1];
    const after = text.substring(matchItalicUnderscore.index + matchItalicUnderscore[0].length);
    
    return [
      ...parseInline(before),
      <em key={`i-under-${matchItalicUnderscore.index}`} className="italic">{parseInline(inner)}</em>,
      ...parseInline(after)
    ];
  }

  // Handle inline code `
  const codeRegex = /`([\s\S]*?)`/;
  const matchCode = text.match(codeRegex);
  if (matchCode && matchCode.index !== undefined) {
    const before = text.substring(0, matchCode.index);
    const inner = matchCode[1];
    const after = text.substring(matchCode.index + matchCode[0].length);
    
    return [
      ...parseInline(before),
      <code key={`code-${matchCode.index}`} className="bg-black/5 dark:bg-white/10 px-1 py-0.5 rounded font-mono text-[90%]">{inner}</code>,
      ...parseInline(after)
    ];
  }

  return [text];
}

interface MarkdownTextProps {
  text: string;
}

export default function MarkdownText({ text }: MarkdownTextProps) {
  if (!text) return null;

  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  
  let currentList: { type: "ul" | "ol"; items: string[] } | null = null;

  const flushList = (key: string | number) => {
    if (!currentList) return;
    if (currentList.type === "ul") {
      blocks.push(
        <ul key={`ul-${key}`} className="list-disc pl-5 space-y-1 my-1.5">
          {currentList.items.map((item, i) => (
            <li key={i}>{parseInline(item)}</li>
          ))}
        </ul>
      );
    } else {
      blocks.push(
        <ol key={`ol-${key}`} className="list-decimal pl-5 space-y-1 my-1.5">
          {currentList.items.map((item, i) => (
            <li key={i}>{parseInline(item)}</li>
          ))}
        </ol>
      );
    }
    currentList = null;
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    
    // Check for headings
    if (trimmed.startsWith("### ")) {
      flushList(index);
      const content = trimmed.substring(4);
      blocks.push(
        <h3 key={`h3-${index}`} className="text-sm font-extrabold my-2 text-inherit">
          {parseInline(content)}
        </h3>
      );
      return;
    }
    
    if (trimmed.startsWith("#### ")) {
      flushList(index);
      const content = trimmed.substring(5);
      blocks.push(
        <h4 key={`h4-${index}`} className="text-xs font-bold my-1.5 text-inherit">
          {parseInline(content)}
        </h4>
      );
      return;
    }
    
    // Check for bullet lists
    const bulletMatch = line.match(/^(\s*)[-*]\s+(.*)$/);
    if (bulletMatch) {
      const content = bulletMatch[2];
      if (currentList && currentList.type === "ul") {
        currentList.items.push(content);
      } else {
        flushList(index);
        currentList = { type: "ul", items: [content] };
      }
      return;
    }
    
    // Check for numbered lists
    const numberMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
    if (numberMatch) {
      const content = numberMatch[2];
      if (currentList && currentList.type === "ol") {
        currentList.items.push(content);
      } else {
        flushList(index);
        currentList = { type: "ol", items: [content] };
      }
      return;
    }
    
    // If empty line, flush list and output spacing
    if (trimmed === "") {
      flushList(index);
      blocks.push(<div key={`space-${index}`} className="h-2" />);
      return;
    }
    
    // Regular paragraph
    flushList(index);
    blocks.push(
      <p key={`p-${index}`} className="my-1 leading-relaxed">
        {parseInline(line)}
      </p>
    );
  });

  // Flush any remaining list at the end
  flushList("end");

  return <div className="space-y-0.5">{blocks}</div>;
}
