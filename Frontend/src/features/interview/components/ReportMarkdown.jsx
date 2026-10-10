import { Fragment } from "react"

const inlinePattern = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\n]+\*|_[^_\n]+_|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g

const renderInline = (text) => text.split(inlinePattern).filter(Boolean).map((part, index) => {
    if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) {
        return <strong key={index}>{part.slice(2, -2)}</strong>
    }
    if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) {
        return <em key={index}>{part.slice(1, -1)}</em>
    }
    if (part.startsWith("`") && part.endsWith("`")) {
        return <code key={index}>{part.slice(1, -1)}</code>
    }
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/)
    if (link) {
        return <a key={index} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>
    }
    return <Fragment key={index}>{part}</Fragment>
})

const isBlockStart = (line) => /^\s{0,3}(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|```|(?:-{3,}|_{3,}|\*{3,})\s*$)/.test(line)

const ReportMarkdown = ({ content, className = "" }) => {
    if (typeof content !== "string" || !content.trim()) return null

    const lines = content.replace(/\r\n?/g, "\n").split("\n")
    const blocks = []
    let index = 0

    while (index < lines.length) {
        const line = lines[index]
        if (!line.trim()) {
            index += 1
            continue
        }

        const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/)
        if (heading) {
            blocks.push({ type: "heading", level: heading[1].length, text: heading[2], key: index })
            index += 1
            continue
        }

        if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
            blocks.push({ type: "rule", key: index })
            index += 1
            continue
        }

        if (/^\s*```/.test(line)) {
            const codeLines = []
            index += 1
            while (index < lines.length && !/^\s*```/.test(lines[index])) {
                codeLines.push(lines[index])
                index += 1
            }
            if (index < lines.length) index += 1
            blocks.push({ type: "code", text: codeLines.join("\n"), key: index })
            continue
        }

        const listItem = line.match(/^\s{0,3}([-*+])\s+(.+)$/) || line.match(/^\s{0,3}(\d+)[.)]\s+(.+)$/)
        if (listItem) {
            const ordered = /^\s{0,3}\d+[.)]\s+/.test(line)
            const items = []
            const start = index
            while (index < lines.length) {
                const match = ordered
                    ? lines[index].match(/^\s{0,3}\d+[.)]\s+(.+)$/)
                    : lines[index].match(/^\s{0,3}[-*+]\s+(.+)$/)
                if (!match) break
                items.push(match[1])
                index += 1
            }
            blocks.push({ type: ordered ? "ordered-list" : "unordered-list", items, key: start })
            continue
        }

        const paragraph = [line.trim()]
        const start = index
        index += 1
        while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index])) {
            paragraph.push(lines[index].trim())
            index += 1
        }
        blocks.push({ type: "paragraph", text: paragraph.join(" "), key: start })
    }

    return (
        <div className={`report-markdown ${className}`.trim()}>
            {blocks.map((block) => {
                if (block.type === "heading") {
                    const Tag = `h${block.level}`
                    return <Tag key={block.key}>{renderInline(block.text)}</Tag>
                }
                if (block.type === "rule") return <hr key={block.key} />
                if (block.type === "code") return <pre key={block.key}><code>{block.text}</code></pre>
                if (block.type === "ordered-list" || block.type === "unordered-list") {
                    const Tag = block.type === "ordered-list" ? "ol" : "ul"
                    return <Tag key={block.key}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInline(item)}</li>)}</Tag>
                }
                return <p key={block.key}>{renderInline(block.text)}</p>
            })}
        </div>
    )
}

export const ReportPreview = ({ report }) => {
    const answer = report?.technicalQuestions?.find((item) => item.answer)?.answer
        || report?.behavioralQuestions?.find((item) => item.answer)?.answer

    if (!answer) return null
    return <ReportMarkdown content={answer} className="report-preview__content" />
}

export default ReportMarkdown
