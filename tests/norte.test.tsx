import { expect, test } from 'claude-code/testing'

const COMPOSER = { kind: 'composer' } as const
const TELA = { isFullscreen: false, columns: 120 }

const progresso = (etapas: { texto: string; feita: boolean }[]) =>
  ({ tool: 'mcp__norte__progresso', etapas }) as const

test('objetivo, plano, progresso e lembrete no prompt', async ($, on) => {
  const contextos: (readonly string[] | undefined)[] = []
  on('prompt.submit', async (_$, e) => {
    contextos.push(e.context)
    return { text: e.text, context: e.context }
  })

  const sem = await $.prompt.submit({ text: 'oi', wait: false, origin: COMPOSER })
  expect(sem.drop).toBe(undefined)
  expect(contextos[0]).toBe(undefined)

  const def = await $.command.run({ command: 'norte', args: 'migrar o login', origin: COMPOSER, presentation: TELA })
  expect(def.text).toBe('Norte definido: migrar o login')

  await $.prompt.submit({ text: 'começa', wait: false, origin: COMPOSER })
  expect(contextos[1]?.[0]).toContain('Ainda não há plano')

  const r = await $.tool.call(
    progresso([
      { texto: 'ler rota', feita: true },
      { texto: 'trocar sessão', feita: false },
      { texto: 'testar', feita: false },
      { texto: 'deploy', feita: false },
    ]),
  )
  expect(String(r.result)).toContain('1/4 etapas (25%)')

  await $.prompt.submit({ text: 'segue', wait: false, origin: COMPOSER })
  expect(contextos[2]?.[0]).toContain('Próxima etapa: «trocar sessão»')

  const ruim = await $.tool.call({ tool: 'mcp__norte__progresso', etapas: [] } as never)
  expect(String(ruim.result)).toContain('Erro')

  const status = await $.command.run({ command: 'norte', args: '', origin: COMPOSER, presentation: TELA })
  expect(status.text).toContain('[x] ler rota')

  await $.command.run({ command: 'norte', args: 'limpar', origin: COMPOSER, presentation: TELA })
  await $.prompt.submit({ text: 'depois', wait: false, origin: COMPOSER })
  expect(contextos[3]).toBe(undefined)
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`barra acima do prompt (${surface})`, async ($) => {
    await $.command.run({ command: 'norte', args: 'publicar o post', origin: COMPOSER, presentation: TELA })
    await $.tool.call(
      progresso([
        { texto: 'rascunho', feita: true },
        { texto: 'revisão', feita: false },
      ]),
    )
    const band = await $.ui.mount({
      plugin: 'norte',
      surface,
      component: 'AbovePrompt',
      props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 90 } as never,
    })
    const tree = JSON.stringify(await band.drawn())
    expect(tree).toContain('norte: publicar o post')
    expect(tree).toContain('50%')
    expect(tree).toContain('próxima: revisão')
  })
}

test('deriva: 3 turnos sem concluir etapa vira aviso; subagente não conta', async ($, on) => {
  on('turn.complete', () => ({ text: '' }))
  await $.command.run({ command: 'norte', args: 'x', origin: COMPOSER, presentation: TELA })
  await $.tool.call(progresso([{ texto: 'a', feita: false }, { texto: 'b', feita: false }]))
  const fim = { reason: 'answer', text: '' } as never
  await $.turn.complete({ reason: 'answer', text: '', agentId: 'sub' } as never)
  await $.turn.complete(fim)
  await $.turn.complete(fim)
  const desenhar = async () =>
    JSON.stringify(
      await (
        await $.ui.mount({
          plugin: 'norte',
          surface: 'terminal',
          component: 'AbovePrompt',
          props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 90 } as never,
        })
      ).drawn(),
    )
  expect(await desenhar()).not.toContain('turnos sem concluir')
  await $.turn.complete(fim)
  expect(await desenhar()).toContain('3 turnos sem concluir etapa')

  await $.tool.call(progresso([{ texto: 'a', feita: true }, { texto: 'b', feita: false }, { texto: 'c', feita: false }]))
  await $.turn.complete(fim)
  const depois = await desenhar()
  expect(depois).not.toContain('turnos sem concluir')
  expect(depois).toContain('+1 etapa desde o plano')
})

test('sem /norte, o agente define o objetivo pela ferramenta; trocar de tarefa zera', async ($) => {
  const sem = await $.tool.call(progresso([{ texto: 'a', feita: false }]))
  expect(String(sem.result)).toContain('Erro')

  const r = await $.tool.call({
    ...progresso([{ texto: 'ler', feita: true }, { texto: 'mudar', feita: false }]),
    objetivo: 'corrigir o login',
  } as never)
  expect(String(r.result)).toContain('Objetivo: corrigir o login')
  expect(String(r.result)).toContain('1/2 etapas (50%)')

  const mesmo = await $.tool.call({
    ...progresso([{ texto: 'ler', feita: true }, { texto: 'mudar', feita: true }, { texto: 'testar', feita: false }]),
    objetivo: 'corrigir o login',
  } as never)
  expect(String(mesmo.result)).toContain('2/3 etapas')

  const outro = await $.tool.call({
    ...progresso([{ texto: 'x', feita: false }]),
    objetivo: 'publicar o post',
  } as never)
  expect(String(outro.result)).toContain('Objetivo: publicar o post')
  const status = await $.command.run({ command: 'norte', args: '', origin: COMPOSER, presentation: TELA })
  expect(status.text).toContain('0/1 etapas')
})
