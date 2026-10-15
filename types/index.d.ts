export type Etapa = { texto: string; feita: boolean }

export type Norte = {
  objetivo: string
  etapas: Etapa[]
  /** Quantas etapas o primeiro plano tinha: o quanto o escopo cresceu desde então. */
  etapasNoPlano: number
  /** Turnos do loop principal desde que o objetivo foi definido. */
  turnos: number
  /** Turnos seguidos que terminaram sem nenhuma etapa concluída. */
  turnosSemAvanco: number
  /** Etapas feitas quando o turno atual começou. */
  feitasNoInicioDoTurno: number
}

declare module 'claude-code' {
  interface PluginState {
    norte: { atual: Norte | null }
  }
}
