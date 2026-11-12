// Line access that keeps each line's own ending, so a rewrite touches only the lines it changes.

export type SourceLine = { text: string; eol: string }

export function splitLines(source: string): SourceLine[] {
  const lines: SourceLine[] = []
  const pattern = /([^\r\n]*)(\r\n|\n|\r|$)/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(source)) !== null) {
    if (match[0] === '') {
      break
    }
    lines.push({ text: match[1], eol: match[2] })
  }
  return lines
}

export function joinLines(lines: readonly SourceLine[]): string {
  return lines.map((line) => line.text + line.eol).join('')
}

/** The ending new lines should use: the file's first one, else `\n`. */
export function dominantEol(lines: readonly SourceLine[]): string {
  return lines.find((line) => line.eol !== '')?.eol ?? '\n'
}

/** Markdown emphasis and code markers removed, for comparing labels. */
export function plainText(text: string): string {
  return text
    .replace(/\*\*|__|`/g, '')
    .replace(/^\s*[-*]\s+/, '')
    .trim()
}
