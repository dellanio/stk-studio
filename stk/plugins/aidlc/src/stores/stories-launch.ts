// "Lançar no Jira": create the (optional) epic and the selected stories, then write the keys back
// into the stories artifact so the repository keeps the trail story → Jira.
import type { AidlcRecordRef } from '../domain/aidlc-record'
import { parseStories, writeJiraKeys, type AidlcStoriesDocument } from '../domain/aidlc-stories'
import type { CreatedIssue, JiraClient } from '../jira/jira-client'
import type { RecordFileSource } from '../sources/record-file-source'

export type StoryForLaunch = {
  id: string
  summary: string
  description: string
  acceptanceCriteria: string[]
}

export type LaunchRequest = {
  storiesFile: string
  stories: StoryForLaunch[]
  /** Create a new epic with this title; null links to the artifact's existing epic, if any. */
  newEpic: { summary: string; description: string } | null
  author: string
}

export type LaunchResult = {
  epic: CreatedIssue | null
  created: ({ storyId: string } & CreatedIssue)[]
  failed: { storyId: string; message: string }[]
  skipped: string[]
  /** False when nothing was created, so the artifact was left alone. */
  written: boolean
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function readStories(
  source: RecordFileSource,
  record: AidlcRecordRef,
  storiesFile: string
): Promise<AidlcStoriesDocument> {
  const file = await source.readFile(`${record.root}/${storiesFile}`)
  if (!file) {
    throw new Error(`Arquivo de histórias não encontrado: ${storiesFile}`)
  }
  return parseStories(file.content)
}

export async function launchStories(
  source: RecordFileSource,
  record: AidlcRecordRef,
  jira: JiraClient,
  request: LaunchRequest
): Promise<LaunchResult> {
  const path = `${record.root}/${request.storiesFile}`
  const file = await source.readFile(path)
  if (!file) {
    throw new Error(`Arquivo de histórias não encontrado: ${request.storiesFile}`)
  }
  const document = parseStories(file.content)
  const launched = new Map(document.stories.map((story) => [story.id, story.jiraKey]))
  const result: LaunchResult = { epic: null, created: [], failed: [], skipped: [], written: false }

  let epicKey = document.epicJiraKey
  if (request.newEpic) {
    result.epic = await jira.createEpic(request.newEpic)
    epicKey = result.epic.key
  }
  for (const story of request.stories) {
    if (!launched.has(story.id) || launched.get(story.id)) {
      result.skipped.push(story.id)
      continue
    }
    try {
      const issue = await jira.createStory({
        summary: story.summary,
        description: story.description,
        acceptanceCriteria: story.acceptanceCriteria,
        epicKey
      })
      result.created.push({ storyId: story.id, ...issue })
    } catch (error) {
      result.failed.push({ storyId: story.id, message: message(error) })
    }
  }
  if (result.created.length === 0 && !result.epic) {
    return result
  }
  const keys = Object.fromEntries(result.created.map((item) => [item.storyId, item.key]))
  const updated = writeJiraKeys(file.content, { stories: keys, epic: result.epic?.key ?? null })
  const summary = [result.epic?.key, ...result.created.map((item) => item.key)]
    .filter(Boolean)
    .join(', ')
  await source.writeFile(path, updated, {
    message: `aidlc: histórias lançadas no Jira (${summary}) por ${request.author}`,
    expectedVersion: file.version
  })
  result.written = true
  return result
}
