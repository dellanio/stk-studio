// Local git for "Enviar ao PO" and "Buscar respostas": commit only the given files, then push the
// current branch so the PO (reading through the GitHub API) sees them. Never rewrites history.
import { execFile } from 'node:child_process'
import type { GitSyncResult } from '../protocol'

type GitRun = { ok: boolean; stdout: string; stderr: string }

function git(cwd: string, args: readonly string[], timeout = 60_000): Promise<GitRun> {
  return new Promise((resolve) => {
    execFile('git', args, { cwd, timeout, windowsHide: true }, (error, stdout, stderr) => {
      resolve({ ok: error === null, stdout: String(stdout).trim(), stderr: String(stderr).trim() })
    })
  })
}

export async function isGitCheckout(cwd: string): Promise<boolean> {
  const result = await git(cwd, ['rev-parse', '--is-inside-work-tree'], 10_000)
  return result.ok && result.stdout === 'true'
}

export async function gitUserName(cwd: string): Promise<string | null> {
  const result = await git(cwd, ['config', 'user.name'], 10_000)
  return result.ok && result.stdout ? result.stdout : null
}

export async function commitAndPush(
  cwd: string,
  paths: readonly string[],
  message: string,
  push: boolean
): Promise<GitSyncResult> {
  if (!(await isGitCheckout(cwd))) {
    return { committed: false, pushed: false, message: 'A pasta não é um repositório git: o arquivo foi gravado só localmente.' }
  }
  const add = await git(cwd, ['add', '--', ...paths])
  if (!add.ok) {
    return { committed: false, pushed: false, message: `git add falhou: ${add.stderr}` }
  }
  const commit = await git(cwd, ['commit', '--only', '-m', message, '--', ...paths])
  const nothing = /nothing to commit|nada a submeter|no changes added/i.test(`${commit.stdout} ${commit.stderr}`)
  if (!commit.ok && !nothing) {
    return { committed: false, pushed: false, message: `git commit falhou: ${commit.stderr || commit.stdout}` }
  }
  if (!push) {
    return { committed: !nothing, pushed: false, message: 'Commit local feito. Faça push para o PO ver.' }
  }
  const upstream = await git(cwd, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], 10_000)
  const pushed = upstream.ok ? await git(cwd, ['push']) : await git(cwd, ['push', '-u', 'origin', 'HEAD'])
  if (!pushed.ok) {
    return { committed: !nothing, pushed: false, message: `Commit feito, mas o push falhou: ${pushed.stderr}` }
  }
  return { committed: !nothing, pushed: true, message: 'Enviado: commit e push feitos.' }
}

export async function pullFastForward(cwd: string): Promise<string> {
  if (!(await isGitCheckout(cwd))) {
    return 'A pasta não é um repositório git.'
  }
  const result = await git(cwd, ['pull', '--ff-only'])
  return result.ok ? 'Atualizado com o repositório remoto.' : `Não foi possível atualizar (git pull --ff-only): ${result.stderr}`
}
