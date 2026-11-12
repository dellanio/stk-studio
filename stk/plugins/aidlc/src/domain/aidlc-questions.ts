// AidlcQuestionsParser / AidlcQuestionsWriter: one tolerant block parser, and per-version formats
// that decide how an answer is written back (see stk/docs/aidlc-formatos.md for the assumptions).
import { dominantEol, joinLines, plainText, splitLines, type SourceLine } from './markdown-lines'

export type AidlcOption = { letter: string; text: string; isOther: boolean }

export type AidlcAnswer = { letters: string[]; otherText?: string }

export type AidlcQuestion = {
  /** Stable within a file: `Q<n>` for numbered questions, else a slug of the heading. */
  id: string
  number: number | null
  title: string
  /** v2.11+ names whose decision it is: `## Q1. [Product owner] ...`. */
  trade: string | null
  prompt: string
  options: AidlcOption[]
  multiSelect: boolean
  /** What follows `[Answer]:`, trimmed; null while blank or only underscores. */
  rawAnswer: string | null
  answer: AidlcAnswer | null
}

export type AidlcQuestionsFormatId = 'aidlc-v1' | 'aidlc-v2'

export type AidlcQuestionsDocument = {
  format: AidlcQuestionsFormatId
  title: string | null
  questions: AidlcQuestion[]
}

/** How one aidlc-workflows generation writes questions files. */
export type AidlcQuestionsFormat = {
  id: AidlcQuestionsFormatId
  /** Higher wins; 0 means "no sign of this format". */
  detect(lines: readonly string[]): number
  /** The text written after `[Answer]: `. */
  formatAnswer(question: AidlcQuestion, answer: AidlcAnswer): string
}

const HEADING = /^(#{2,4})\s+(.*?)\s*$/
const NUMBERED = /^(?:Q(?:uestion)?\s*)(\d+)\b\s*[.:)\-—–]?\s*(.*)$/i
const TRADE = /^\[([^\]]{1,60})\]\s*(.*)$/
const OPTION = /^\s*(?:[-*]\s+)?\*{0,2}([A-Z])\*{0,2}\s*[.)]\s+(.+?)\s*$/
const ANSWER = /^(\s*\**\[Answer\]:\**)(.*)$/i
const OTHER = /^\s*(?:other|outro|outra)\b/i
const MULTI = /select all that apply|selecione todas|marque todas/i
const LETTER_LIST = /^[A-Z](?:\s*,\s*[A-Z])*$/

function otherLetter(question: AidlcQuestion): string {
  return question.options.find((option) => option.isOther)?.letter ?? 'X'
}

function lettersAndOther(question: AidlcQuestion, answer: AidlcAnswer, otherSep: string): string {
  const other = answer.otherText?.trim()
  const parts = answer.letters.filter((letter) => letter !== otherLetter(question))
  if (other) {
    parts.push(`${otherLetter(question)}${otherSep}${other}`)
  }
  return parts.join(', ')
}

/** v0.x–1.x rules: `## Question N`, options `A) ...`, answered with the letter alone. */
export const aidlcV1Format: AidlcQuestionsFormat = {
  id: 'aidlc-v1',
  detect: (lines) =>
    lines.filter((line) => /^#{2,4}\s+Question\s+\d+/i.test(line) || /^[A-Z]\)\s+\S/.test(line))
      .length,
  formatAnswer: (question, answer) => lettersAndOther(question, answer, ') ')
}

/** 2.x engine: `## Q<n>. [trade] title`, options `A. ...`, `X. Other (please specify)`. */
export const aidlcV2Format: AidlcQuestionsFormat = {
  id: 'aidlc-v2',
  detect: (lines) =>
    lines.filter((line) => /^#{2,4}\s+Q\d+[.:]/.test(line) || /^[A-Z]\.\s+\S/.test(line)).length,
  formatAnswer: (question, answer) => {
    const other = answer.otherText?.trim()
    if (answer.letters.length === 1 && !other) {
      const option = question.options.find((candidate) => candidate.letter === answer.letters[0])
      return option ? `${option.letter}. ${option.text}` : answer.letters[0]
    }
    return lettersAndOther(question, answer, '. ')
  }
}

export const AIDLC_QUESTIONS_FORMATS: readonly AidlcQuestionsFormat[] = [
  aidlcV2Format,
  aidlcV1Format
]

export function detectQuestionsFormat(
  source: string,
  preferred?: AidlcQuestionsFormatId
): AidlcQuestionsFormat {
  const forced = AIDLC_QUESTIONS_FORMATS.find((format) => format.id === preferred)
  if (forced) {
    return forced
  }
  const lines = splitLines(source).map((line) => line.text)
  let best = aidlcV2Format
  let bestScore = 0
  for (const format of AIDLC_QUESTIONS_FORMATS) {
    const score = format.detect(lines)
    if (score > bestScore) {
      best = format
      bestScore = score
    }
  }
  return best
}

function slug(text: string): string {
  return (
    plainText(text)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'question'
  )
}

export function interpretAnswer(
  raw: string | null,
  options: readonly AidlcOption[]
): AidlcAnswer | null {
  if (raw === null) {
    return null
  }
  const known = new Set(options.map((option) => option.letter))
  const other = options.find((option) => option.isOther)?.letter
  if (LETTER_LIST.test(raw)) {
    return { letters: raw.split(',').map((letter) => letter.trim()) }
  }
  const parts = raw.split(/\s*,\s*(?=[A-Z](?:[.)\-:]|\s*$))/)
  const letters: string[] = []
  let otherText: string | undefined
  for (const part of parts) {
    const match = /^([A-Z])\s*(?:[.)\-:]\s*(.*))?$/s.exec(part)
    if (!match || !known.has(match[1])) {
      otherText = raw
      return { letters: [], otherText }
    }
    letters.push(match[1])
    if (match[1] === other && match[2]?.trim()) {
      otherText = match[2].trim()
    }
  }
  return otherText ? { letters, otherText } : { letters }
}

type Block = { question: AidlcQuestion; answerLine: number | null; lastContentLine: number }

function parseBlocks(lines: readonly SourceLine[]): { title: string | null; blocks: Block[] } {
  let title: string | null = null
  const blocks: Block[] = []
  let current: { heading: string; start: number } | null = null

  const close = (end: number): void => {
    if (!current) {
      return
    }
    const { heading, start } = current
    current = null
    const numbered = NUMBERED.exec(heading)
    let rest = numbered ? numbered[2] : heading
    const trade = TRADE.exec(rest)
    if (trade) {
      rest = trade[2]
    }
    const promptLines: string[] = []
    const options: AidlcOption[] = []
    let answerLine: number | null = null
    let rawAnswer: string | null = null
    let lastContentLine = start
    for (let index = start + 1; index < end; index++) {
      const text = lines[index].text
      if (text.trim() !== '') {
        lastContentLine = index
      }
      const answer = ANSWER.exec(text)
      if (answer && answerLine === null) {
        answerLine = index
        const value = answer[2].trim()
        rawAnswer = value === '' || /^_+$/.test(value) ? null : value
        continue
      }
      if (answerLine !== null) {
        continue
      }
      const option = OPTION.exec(text)
      if (option) {
        options.push({
          letter: option[1],
          text: plainText(option[2]),
          isOther: OTHER.test(plainText(option[2]))
        })
      } else if (options.length === 0 && text.trim() !== '') {
        promptLines.push(plainText(text))
      }
    }
    if (answerLine === null && options.length === 0) {
      return
    }
    const prompt = promptLines.join(' ').trim()
    const number = numbered ? Number(numbered[1]) : null
    const question: AidlcQuestion = {
      id: number !== null ? `Q${number}` : slug(heading),
      number,
      title: plainText(rest) || prompt,
      trade: trade ? trade[1].trim() : null,
      prompt,
      options,
      multiSelect: MULTI.test(`${heading} ${prompt}`),
      rawAnswer,
      answer: interpretAnswer(rawAnswer, options)
    }
    blocks.push({ question, answerLine, lastContentLine })
  }

  lines.forEach((line, index) => {
    if (title === null && /^#\s+/.test(line.text)) {
      title = plainText(line.text.replace(/^#\s+/, ''))
    }
    const heading = HEADING.exec(line.text)
    if (heading) {
      close(index)
      current = { heading: heading[2], start: index }
    }
  })
  close(lines.length)
  return { title, blocks }
}

export function parseQuestions(
  source: string,
  preferred?: AidlcQuestionsFormatId
): AidlcQuestionsDocument {
  const format = detectQuestionsFormat(source, preferred)
  const { title, blocks } = parseBlocks(splitLines(source))
  return { format: format.id, title, questions: blocks.map((block) => block.question) }
}

export function pendingQuestions(document: AidlcQuestionsDocument): AidlcQuestion[] {
  return document.questions.filter((question) => question.rawAnswer === null)
}

export class AidlcAnswerError extends Error {
  readonly code = 'invalid_answer'
}

function validate(question: AidlcQuestion, answer: AidlcAnswer): void {
  const known = new Set(question.options.map((option) => option.letter))
  const unknown = answer.letters.filter((letter) => !known.has(letter))
  if (unknown.length > 0) {
    throw new AidlcAnswerError(`Opção inexistente em ${question.id}: ${unknown.join(', ')}`)
  }
  if (answer.letters.length > 1 && !question.multiSelect) {
    throw new AidlcAnswerError(`${question.id} aceita uma única opção.`)
  }
  const other = question.options.find((option) => option.isOther)?.letter
  const needsText =
    question.options.length === 0 || (other !== undefined && answer.letters.includes(other))
  if (needsText && !answer.otherText?.trim()) {
    throw new AidlcAnswerError(`${question.id}: descreva a resposta em texto livre.`)
  }
  if (answer.letters.length === 0 && !answer.otherText?.trim()) {
    throw new AidlcAnswerError(`${question.id}: escolha uma opção.`)
  }
}

/**
 * Writes one answer and returns the new file text. Only the `[Answer]:` line changes (or one is
 * added after the question when missing); every other byte, line endings included, is kept.
 */
export function writeAnswer(
  source: string,
  questionId: string,
  answer: AidlcAnswer,
  preferred?: AidlcQuestionsFormatId
): string {
  const lines = splitLines(source)
  const format = detectQuestionsFormat(source, preferred)
  const block = parseBlocks(lines).blocks.find((candidate) => candidate.question.id === questionId)
  if (!block) {
    throw new AidlcAnswerError(`Pergunta ${questionId} não encontrada no arquivo.`)
  }
  validate(block.question, answer)
  const value =
    block.question.options.length === 0
      ? (answer.otherText ?? '').trim()
      : format.formatAnswer(block.question, answer)
  if (block.answerLine !== null) {
    const line = lines[block.answerLine]
    const prefix = ANSWER.exec(line.text)?.[1] ?? '[Answer]:'
    lines[block.answerLine] = { text: `${prefix} ${value}`, eol: line.eol }
    return joinLines(lines)
  }
  const eol = dominantEol(lines)
  const at = block.lastContentLine
  const after = lines[at]
  const inserted: SourceLine[] = [
    { text: after.text, eol: after.eol || eol },
    { text: '', eol },
    { text: `[Answer]: ${value}`, eol: after.eol === '' ? '' : eol }
  ]
  lines.splice(at, 1, ...inserted)
  return joinLines(lines)
}
