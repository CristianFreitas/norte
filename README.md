# norte

Uma barra de progresso para o objetivo da sua sessão no Claude Code. Feita para não perder o norte
em sessões longas: o objetivo fica fixo acima do prompt e a barra só enche quando etapas de verdade fecham.

```
◎ norte: migrar o login para o novo provedor de sessão
██████████░░░░░░░░░░░░░░░░░░░░ 33% · 3/9 · próxima: trocar o middleware de sessão
⚠ 4 turnos sem concluir etapa · +2 etapas desde o plano
```

Post com a história e as decisões: https://cristianfreitas.dev/blog/perdi-o-norte/

## Instalar

No prompt do Claude Code:

```
/plugin install norte --marketplace CristianFreitas/norte
```

Responda `y` para adicionar o marketplace e escolha o escopo (usuário é o padrão).

Pelo shell:

```bash
claude plugin install norte --marketplace CristianFreitas/norte
```

No app desktop: clique em + ao lado do prompt, Plugins, Add marketplace com `CristianFreitas/norte`, depois Add plugin.

## Usar

| Comando | O que faz |
| --- | --- |
| `/norte <objetivo>` | define o objetivo da sessão e zera a barra |
| `/norte` | mostra o objetivo e as etapas |
| `/norte limpar` | remove o objetivo |

Depois de definir o objetivo, o Claude quebra em 3 a 8 etapas pela ferramenta `progresso` e marca cada uma ao concluir.

Sem `/norte`, o próprio Claude pode definir o objetivo: a ferramenta `progresso` aceita `objetivo` (uma linha com o resultado que o pedido quer). Passar um objetivo diferente troca de tarefa e zera a barra.

- A porcentagem é `etapas feitas / total`, não um chute do modelo.
- Cada mensagem sua leva um lembrete curto do objetivo e da próxima etapa, como contexto da mensagem (não no system prompt, para não invalidar o cache da conversa).
- 3 turnos seguidos sem fechar etapa: aviso amarelo de deriva. Turnos de subagentes não contam.
- Etapas acrescentadas depois do plano aparecem como `+N etapas desde o plano`.

## Limites

- Depende do Claude chamar a ferramenta; se ele não chamar, o aviso de deriva acende.
- Etapa não é esforço: a barra mede avanço no plano, não tempo restante.
- Usa a API de mods do Claude Code, ainda em *early access*: pode mudar entre versões.

## Desenvolver

```bash
claude plugin validate .
claude plugin test .
claude --plugin-dir .
```

---

**English:** a Claude Code mod that pins your session goal above the prompt and fills a progress bar as
checkable steps get done, warning when the work drifts. Install with
`/plugin install norte --marketplace CristianFreitas/norte`, then `/norte <goal>`.
Write-up: https://cristianfreitas.dev/en/blog/lost-my-bearings/

## Licença

MIT
