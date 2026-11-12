// One AI-DLC question as a form: a single choice (A–E), several (select all that apply), or
// "Other" with free text. Stateless: the panel owns the draft atom.
import { Badge, Button, Checkbox, Field, RadioGroup, Row, Stack, Text, Textarea } from 'orca'
import type { AidlcAnswer, AidlcQuestion } from '../domain/aidlc-questions'

export type AnswerDraft = { letters: string[]; other: string }

export const EMPTY_DRAFT: AnswerDraft = { letters: [], other: '' }

export function draftFromQuestion(question: AidlcQuestion): AnswerDraft {
  return question.answer
    ? { letters: question.answer.letters, other: question.answer.otherText ?? '' }
    : EMPTY_DRAFT
}

export function answerFromDraft(question: AidlcQuestion, draft: AnswerDraft): AidlcAnswer {
  const other = question.options.find((option) => option.isOther)?.letter
  const needsText = question.options.length === 0 || (other !== undefined && draft.letters.includes(other))
  return needsText && draft.other.trim() ? { letters: draft.letters, otherText: draft.other.trim() } : { letters: draft.letters }
}

export function canSave(question: AidlcQuestion, draft: AnswerDraft): boolean {
  const other = question.options.find((option) => option.isOther)?.letter
  if (question.options.length === 0) {
    return draft.other.trim() !== ''
  }
  if (draft.letters.length === 0) {
    return false
  }
  return other === undefined || !draft.letters.includes(other) || draft.other.trim() !== ''
}

export function QuestionForm(props: {
  question: AidlcQuestion
  draft: AnswerDraft
  busy: boolean
  saveLabel: string
  onDraft: (draft: AnswerDraft) => void
  onSave: () => void
}) {
  const { question, draft, busy } = props
  const other = question.options.find((option) => option.isOther)?.letter
  const showText = question.options.length === 0 || (other !== undefined && draft.letters.includes(other))
  const optionLabel = (letter: string, text: string): string =>
    letter === other ? `${letter}. Outra resposta (especifique)` : `${letter}. ${text}`
  return (
    <Stack gap="sm">
      {question.prompt && question.prompt !== question.title ? <Text muted>{question.prompt}</Text> : null}
      {question.trade ? (
        <Row gap="xs">
          <Badge tone="neutral">{`Para: ${question.trade}`}</Badge>
        </Row>
      ) : null}
      {question.options.length > 0 && question.multiSelect ? (
        <Field label="Escolha todas as que se aplicam">
          <Stack gap="xs">
            {question.options.map((option) => (
              <Checkbox
                key={option.letter}
                label={optionLabel(option.letter, option.text)}
                checked={draft.letters.includes(option.letter)}
                disabled={busy}
                onChange={(checked) =>
                  props.onDraft({
                    ...draft,
                    letters: checked
                      ? [...draft.letters, option.letter].sort()
                      : draft.letters.filter((letter) => letter !== option.letter)
                  })
                }
              />
            ))}
          </Stack>
        </Field>
      ) : null}
      {question.options.length > 0 && !question.multiSelect ? (
        <RadioGroup
          label="Resposta"
          labelHidden
          value={draft.letters[0] ?? ''}
          disabled={busy}
          options={question.options.map((option) => ({ value: option.letter, label: optionLabel(option.letter, option.text) }))}
          onChange={(value) => props.onDraft({ ...draft, letters: [value] })}
        />
      ) : null}
      {showText ? (
        <Textarea
          label="Sua resposta"
          placeholder="Escreva a resposta com suas palavras"
          rows={3}
          value={draft.other}
          disabled={busy}
          onChange={(value) => props.onDraft({ ...draft, other: value })}
        />
      ) : null}
      <Row justify="end">
        <Button icon="check" disabled={busy || !canSave(question, draft)} onPress={props.onSave}>
          {props.saveLabel}
        </Button>
      </Row>
    </Stack>
  )
}
