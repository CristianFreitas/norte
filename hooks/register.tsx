import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Etapa, Norte } from '../types'

const atual = atom({ plugin: 'norte', key: 'atual' } as const, null)

const TOOL = 'mcp__norte__progresso'
const DERIVA = 3

const feitas = (n: Norte) => n.etapas.filter(e => e.feita).length
const pct = (n: Norte) =>
  n.etapas.length === 0 ? 0 : Math.round((feitas(n) / n.etapas.length) * 100)
const proxima = (n: Norte) => n.etapas.find(e => !e.feita)?.texto
const concluido = (n: Norte) => n.etapas.length > 0 && feitas(n) === n.etapas.length

const detalhe = (n: Norte) =>
  n.etapas.length === 0
    ? 'sem plano ainda'
    : concluido(n)
      ? `${n.etapas.length}/${n.etapas.length} ✓ concluído`
      : `${feitas(n)}/${n.etapas.length} · próxima: ${proxima(n)}`

export const barra = (p: number, largura: number) => {
  const cheio = Math.round((p / 100) * largura)
  return '█'.repeat(cheio) + '░'.repeat(largura - cheio)
}

export const resumo = (n: Norte) =>
  n.etapas.length === 0
    ? `Objetivo: ${n.objetivo}\nSem plano ainda.`
    : `Objetivo: ${n.objetivo}\n${feitas(n)}/${n.etapas.length} etapas (${pct(n)}%)\n` +
      n.etapas.map(e => `${e.feita ? '[x]' : '[ ]'} ${e.texto}`).join('\n')

export const lembrete = (n: Norte) => {
  if (n.etapas.length === 0) {
    return (
      `[norte] Objetivo da sessão: «${n.objetivo}». ` +
      `Ainda não há plano: antes de executar, chame ${TOOL} com 3 a 8 etapas ` +
      `verificáveis que, juntas, entregam o objetivo (todas feita=false).`
    )
  }
  const linhas = [
    `[norte] Objetivo da sessão: «${n.objetivo}». Progresso: ${feitas(n)}/${n.etapas.length} (${pct(n)}%).`,
    concluido(n)
      ? 'Todas as etapas estão feitas. Se o pedido abaixo abre trabalho novo, acrescente etapas.'
      : `Próxima etapa: «${proxima(n)}».`,
    'Se o pedido abaixo não serve ao objetivo, diga isso numa linha antes de seguir.',
    `Ao concluir uma etapa, chame ${TOOL} com a lista completa atualizada; trabalho novo necessário vira etapa nova, sem esconder escopo.`,
  ]
  if (n.turnosSemAvanco >= DERIVA) {
    linhas.push(
      `Atenção: ${n.turnosSemAvanco} turnos sem concluir etapa. Reavalie se o trabalho atual leva ao objetivo.`,
    )
  }
  return linhas.join(' ')
}

const lerEtapas = (input: unknown): Etapa[] | string => {
  const lista = (input as { etapas?: unknown })?.etapas
  if (!Array.isArray(lista) || lista.length === 0) return 'etapas deve ser uma lista não vazia.'
  const etapas: Etapa[] = []
  for (const item of lista) {
    const { texto, feita } = (item ?? {}) as { texto?: unknown; feita?: unknown }
    if (typeof texto !== 'string' || texto.trim() === '' || typeof feita !== 'boolean') {
      return 'cada etapa precisa de texto (string) e feita (boolean).'
    }
    etapas.push({ texto: texto.trim(), feita })
  }
  return etapas
}

const inicial = (objetivo: string): Norte => ({
  objetivo,
  etapas: [],
  etapasNoPlano: 0,
  turnos: 0,
  turnosSemAvanco: 0,
  feitasNoInicioDoTurno: 0,
})

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'norte',
      description: 'Define o objetivo da sessão e mostra a barra de progresso',
      argumentHint: '<objetivo> | limpar',
    })
    await $.tool.register({
      name: 'progresso',
      description:
        'Registra o objetivo, o plano e o progresso da sessão. ' +
        'Envie sempre a lista completa de etapas, na ordem, cada uma com feita=true/false. ' +
        'Chame ao montar o plano, ao concluir cada etapa e ao descobrir trabalho novo necessário. ' +
        'Sem objetivo definido (o usuário não rodou /norte), passe objetivo: uma linha com o resultado que o pedido do usuário quer. ' +
        'Só passe objetivo de novo quando o usuário trocar de tarefa: isso zera a barra.',
      inputSchema: {
        type: 'object',
        properties: {
          objetivo: { type: 'string' },
          etapas: {
            type: 'array',
            items: {
              type: 'object',
              properties: { texto: { type: 'string' }, feita: { type: 'boolean' } },
              required: ['texto', 'feita'],
            },
          },
        },
        required: ['etapas'],
      },
      isDeferred: false,
    })
    const n = await read($, atual)
    $.ui.status(n ? `norte ${pct(n)}%` : undefined)

    return next(e)
  })

  on('command.run', { command: 'norte' }, async ($, e) => {
    const args = e.args.trim()
    const n = await read($, atual)

    if (args === '') {
      return { text: n ? resumo(n) : 'Sem objetivo. Use /norte <objetivo>.' }
    }
    if (args === 'limpar') {
      await update($, atual, () => null)
      $.ui.status(undefined)
      return { text: 'Objetivo removido.' }
    }

    const novo = inicial(args)
    await update($, atual, () => novo)
    $.ui.status('norte 0%')

    return { text: `Norte definido: ${args}`, context: [lembrete(novo)] }
  })

  on('tool.call', { tool: TOOL }, async ($, e) => {
    const salvo = await read($, atual)
    const pedido = (e as { objetivo?: unknown }).objetivo
    const objetivo = typeof pedido === 'string' ? pedido.trim() : ''
    const n = objetivo && objetivo !== salvo?.objetivo ? inicial(objetivo) : salvo
    if (!n) {
      return { result: 'Erro: nenhum objetivo definido. Passe objetivo com o resultado que o usuário pediu.' }
    }
    const etapas = lerEtapas(e)
    if (typeof etapas === 'string') return { result: `Erro: ${etapas}` }

    const novo: Norte = {
      ...n,
      etapas,
      etapasNoPlano: n.etapasNoPlano || etapas.length,
    }
    await update($, atual, () => novo)
    $.ui.status(`norte ${pct(novo)}%`)
    if (concluido(novo) && !concluido(n)) $.ui.toast(`Objetivo concluído: ${n.objetivo}`)

    return { result: resumo(novo) }
  })

  on('prompt.submit', async ($, e, next) => {
    const n = await read($, atual)
    if (!n || e.command || e.isMeta) return next(e)

    return next({ ...e, context: [...(e.context ?? []), lembrete(n)] })
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      await update($, atual, n => {
        if (!n) return n
        const agora = feitas(n)
        return {
          ...n,
          turnos: n.turnos + 1,
          turnosSemAvanco: agora > n.feitasNoInicioDoTurno ? 0 : n.turnosSemAvanco + 1,
          feitasNoInicioDoTurno: agora,
        }
      })
    }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const n = await read($, atual)
    if (!n || e.props.hasSurvey) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    const largura = Math.max(10, Math.min(30, Math.floor(e.props.bodyColumns / 3)))
    const p = pct(n)
    const cresceu = n.etapas.length - n.etapasNoPlano
    const avisos = [
      n.turnosSemAvanco >= DERIVA ? `⚠ ${n.turnosSemAvanco} turnos sem concluir etapa` : '',
      cresceu > 0 ? `+${cresceu} etapa${cresceu > 1 ? 's' : ''} desde o plano` : '',
    ].filter(Boolean)

    return (
      <Box flexDirection="column">
        <Text bold wrap="truncate-end">{`◎ norte: ${n.objetivo}`}</Text>
        <Text wrap="truncate-end" color={concluido(n) ? 'success' : 'claude'}>
          {`${barra(p, largura)} ${p}% · ${detalhe(n)}`}
        </Text>
        {avisos.length > 0 && (
          <Text color="warning" wrap="truncate-end">{avisos.join(' · ')}</Text>
        )}
      </Box>
    )
  })
}
