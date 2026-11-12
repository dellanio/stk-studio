// StoriesAdapter: user stories from the inception `stories.md`, and the Jira keys written back.
// v2 documents `US{group}.{seq}` ids and `AC{g}.{s}.{n}` criteria; v1 leaves the layout free, so
// the reader accepts the common shapes (see stk/docs/aidlc-formatos.md).
import { dominantEol, joinLines, plainText, splitLines, type SourceLine } from './markdown-lines'

export type AidlcStory = {
  /** As written: `US1.1`, `US-001`, `Story 3`. */
  id: string
  title: string
  /** The "As a ..., I want ..., so that ..." statement and any other prose. */
  description: string
  acceptanceCriteria: string[]
  priority: string | null
  epic: string | null
  jiraKey: string | null
}

export type AidlcStoriesDocument = {
  title: string | null
  epicJiraKey: string | null
  stories: AidlcStory[]
}

const HEADING = /^(#{1,5})\s+(.*?)\s*$/
const STORY_ID =
  /\b(US[-\s]?\d+(?:\.\d+)*|STORY[-\s]\d+(?:\.\d+)*|Story\s+\d+(?:\.\d+)*|História\s+\d+(?:\.\d+)*)\b/i
const EPIC = /^(?:Epic|Épico)\b[\s\d.:\-—–]*(.*)$/i
const JIRA_LINE = /^\s*(?:[-*]\s+)?\**Jira\**\s*:\**\s*([A-Z][A-Z0-9_]+-\d+)\b/
const EPIC_JIRA_LINE =
  /^\s*(?:[-*]\s+)?\**Jira[- ](?:Epic|épico)\**\s*:\**\s*([A-Z][A-Z0-9_]+-\d+)\b/i
const CRITERIA_HEADING = /acceptance criteria|crit[ée]rios de aceit/i
const PRIORITY = /^\s*(?:[-*]\s+)?\**(?:Priority|Prioridade)\**\s*:\**\s*(.+)$/i
const LIST_ITEM = /^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?(.+)$/
const FIELD_LINE = /^\s*(?:[-*]\s+)?\*\*[^*]+\*\*\s*:/

type StoryBlock = { story: AidlcStory; headingLine: number; jiraLine: number | null }

function storyTitle(heading: string, id: string): string {
  const rest = heading
    .replace(id, '')
    .replace(/^[\s:.\-—–]+/, '')
    .trim()
  return plainText(rest) || id
}

function parseBlocks(lines: readonly SourceLine[]): {
  document: AidlcStoriesDocument
  blocks: StoryBlock[]
  titleLine: number | null
  epicJiraLine: number | null
} {
  let title: string | null = null
  let titleLine: number | null = null
  let epicJiraKey: string | null = null
  let epicJiraLine: number | null = null
  let epic: { name: string; level: number } | null = null
  const blocks: StoryBlock[] = []
  let current: (StoryBlock & { level: number; inCriteria: boolean; prose: string[] }) | null = null

  const finish = (): void => {
    if (current) {
      current.story.description = current.prose.join('\n').trim()
      blocks.push({
        story: current.story,
        headingLine: current.headingLine,
        jiraLine: current.jiraLine
      })
      current = null
    }
  }

  lines.forEach(({ text }, index) => {
    const heading = HEADING.exec(text)
    if (heading) {
      const level = heading[1].length
      const headingText = heading[2]
      if (level === 1 && title === null) {
        title = plainText(headingText)
        titleLine = index
      }
      const id = STORY_ID.exec(headingText)
      if (current && level <= current.level) {
        finish()
      }
      if (id && level >= 2) {
        finish()
        current = {
          story: {
            id: id[1],
            title: storyTitle(headingText, id[1]),
            description: '',
            acceptanceCriteria: [],
            priority: null,
            epic: epic?.name ?? null,
            jiraKey: null
          },
          headingLine: index,
          jiraLine: null,
          level,
          inCriteria: false,
          prose: []
        }
        return
      }
      if (current) {
        current.inCriteria = CRITERIA_HEADING.test(headingText)
        return
      }
      const epicMatch = EPIC.exec(plainText(headingText))
      if (epicMatch) {
        epic = { name: plainText(epicMatch[1]) || plainText(headingText), level }
      } else if (epic && level <= epic.level) {
        epic = null
      }
      return
    }
    if (!current) {
      const epicKey = EPIC_JIRA_LINE.exec(text)
      if (epicKey && epicJiraKey === null) {
        epicJiraKey = epicKey[1]
        epicJiraLine = index
      }
      return
    }
    const jira = JIRA_LINE.exec(text)
    if (jira) {
      current.story.jiraKey = jira[1]
      current.jiraLine = index
      return
    }
    const priority = PRIORITY.exec(text)
    if (priority) {
      current.story.priority = plainText(priority[1])
      return
    }
    if (CRITERIA_HEADING.test(text) && (FIELD_LINE.test(text) || /:\s*\**\s*$/.test(text))) {
      current.inCriteria = true
      return
    }
    if (current.inCriteria) {
      const item = LIST_ITEM.exec(text)
      if (item) {
        current.story.acceptanceCriteria.push(plainText(item[1]))
        return
      }
      if (
        /^\s*(Given|When|Then|And|Dado|Quando|Então|E)\b/i.test(text) &&
        current.story.acceptanceCriteria.length > 0
      ) {
        const last = current.story.acceptanceCriteria.length - 1
        current.story.acceptanceCriteria[last] += ` ${plainText(text)}`
        return
      }
      if (text.trim() === '') {
        return
      }
      if (FIELD_LINE.test(text)) {
        current.inCriteria = false
      } else {
        current.story.acceptanceCriteria.push(plainText(text))
        return
      }
    }
    if (text.trim() !== '' && !FIELD_LINE.test(text)) {
      current.prose.push(plainText(text))
    } else if (FIELD_LINE.test(text) && /as an?\b|como\b|i want|eu quero/i.test(text)) {
      current.prose.push(plainText(text))
    }
  })
  finish()
  return {
    document: { title, epicJiraKey, stories: blocks.map((block) => block.story) },
    blocks,
    titleLine,
    epicJiraLine
  }
}

export function parseStories(source: string): AidlcStoriesDocument {
  return parseBlocks(splitLines(source)).document
}

/**
 * Records Jira keys in the artifact: `Jira: KEY` under each story heading (replacing an older
 * one) and `Jira-Epic: KEY` under the document title. Nothing else changes.
 */
export function writeJiraKeys(
  source: string,
  keys: { stories: Record<string, string>; epic?: string | null }
): string {
  const lines = splitLines(source)
  const eol = dominantEol(lines)
  const { blocks, titleLine, epicJiraLine } = parseBlocks(lines)
  type Edit = { at: number; replace: boolean; text: string }
  const edits: Edit[] = []
  for (const block of blocks) {
    const key = keys.stories[block.story.id]
    if (!key) {
      continue
    }
    edits.push(
      block.jiraLine !== null
        ? { at: block.jiraLine, replace: true, text: `Jira: ${key}` }
        : { at: block.headingLine, replace: false, text: `Jira: ${key}` }
    )
  }
  if (keys.epic) {
    if (epicJiraLine !== null) {
      edits.push({ at: epicJiraLine, replace: true, text: `Jira-Epic: ${keys.epic}` })
    } else if (titleLine !== null) {
      edits.push({ at: titleLine, replace: false, text: `Jira-Epic: ${keys.epic}` })
    } else {
      edits.push({ at: -1, replace: false, text: `Jira-Epic: ${keys.epic}` })
    }
  }
  for (const edit of edits.sort((a, b) => b.at - a.at)) {
    if (edit.replace) {
      lines[edit.at] = { text: edit.text, eol: lines[edit.at].eol }
      continue
    }
    if (edit.at === -1) {
      lines.unshift({ text: edit.text, eol }, { text: '', eol })
      continue
    }
    const anchor = lines[edit.at]
    if (anchor.eol === '') {
      anchor.eol = eol
    }
    lines.splice(edit.at + 1, 0, { text: '', eol }, { text: edit.text, eol })
  }
  return joinLines(lines)
}
