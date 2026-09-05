import { Fragment, type ReactNode } from "react";

const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
const BULLET = /^\s*[-*•]\s+/;
const NUMBERED = /^\s*\d+[.)]\s+/;
const HEADING = /^\s*#{1,6}\s+/;

function inline(text: string, prefix: string): ReactNode[] {
  return text
    .split(INLINE)
    .filter(Boolean)
    .map((part, index) => {
      const key = `${prefix}-${index}`;
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={key}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("*") && part.endsWith("*")) {
        return <em key={key}>{part.slice(1, -1)}</em>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code key={key} className="rounded bg-current/10 px-1 py-0.5">
            {part.slice(1, -1)}
          </code>
        );
      }
      return <Fragment key={key}>{part}</Fragment>;
    });
}

type Block =
  | { kind: "text"; lines: string[] }
  | { kind: "bullets" | "numbers"; items: string[] };

function toBlocks(content: string): Block[] {
  const blocks: Block[] = [];

  for (const raw of content.split("\n")) {
    const line = raw.trimEnd();
    const last = blocks[blocks.length - 1];

    if (!line.trim()) {
      if (last?.kind === "text") blocks.push({ kind: "text", lines: [] });
      continue;
    }

    if (BULLET.test(line)) {
      const item = line.replace(BULLET, "");
      if (last?.kind === "bullets") last.items.push(item);
      else blocks.push({ kind: "bullets", items: [item] });
      continue;
    }

    if (NUMBERED.test(line)) {
      const item = line.replace(NUMBERED, "");
      if (last?.kind === "numbers") last.items.push(item);
      else blocks.push({ kind: "numbers", items: [item] });
      continue;
    }

    const text = line.replace(HEADING, "");
    if (last?.kind === "text") last.lines.push(text);
    else blocks.push({ kind: "text", lines: [text] });
  }

  return blocks.filter(
    (block) => block.kind !== "text" || block.lines.length > 0,
  );
}

export function RichText({
  content,
  className = "",
}: {
  content: string;
  className?: string;
}) {
  const blocks = toBlocks(content);

  return (
    <div className={`space-y-2 ${className}`}>
      {blocks.map((block, index) => {
        if (block.kind === "text") {
          return (
            <p key={index}>
              {block.lines.map((line, lineIndex) => (
                <Fragment key={lineIndex}>
                  {lineIndex > 0 && <br />}
                  {inline(line, `${index}-${lineIndex}`)}
                </Fragment>
              ))}
            </p>
          );
        }

        const List = block.kind === "bullets" ? "ul" : "ol";
        return (
          <List
            key={index}
            className={`ml-4 space-y-1 ${
              block.kind === "bullets" ? "list-disc" : "list-decimal"
            }`}
          >
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>{inline(item, `${index}-${itemIndex}`)}</li>
            ))}
          </List>
        );
      })}
    </div>
  );
}
