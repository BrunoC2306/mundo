# Formato de ficha (JSON)

Um arquivo `.json` com **um objeto** (uma ficha), **uma lista** de objetos, ou um **backup** exportado pelo site.
Veja `ficha-exemplo.json`.

## Campos reservados (controlam a galeria)

| Campo | Obrigatório | Regra |
|---|---|---|
| `nome` | **sim** | Texto, 1 a 120 caracteres. (`name` também é aceito se `nome` não existir.) |
| `id` | não | Identificador estável, ex.: `homem-aranha`. Normalizado para minúsculas, números e hífens. Se faltar, é gerado a partir do nome. **É por ele que o site reconhece a mesma ficha em novas importações e que a árvore de habilidades se liga ao personagem.** |
| `resumo` | não | Até 600 caracteres. Aparece no card. |
| `categoria` | não | Até 40 caracteres (Vilão, NPC…). |
| `imagem` | não | Link `http(s)` ou imagem embutida `data:image/png;base64,...` (enviada ao armazenamento do site na importação; PNG, JPG, WebP ou GIF). |
| `formato`, `versao` | não | Informativos. `formato` esperado: `mundo-de-batalha/ficha`. |
| `_progresso`, `_visibilidade` | não | Só aparecem em backups. São ignorados na importação (PD é estado da campanha, não faz parte da ficha). |

## Todo o resto é livre

Qualquer outra chave (atributos, poderes, descrições…) é guardada **exatamente como veio** — nada é descartado — e exibida assim:

- texto curto, número, sim/não → bloco "Dados gerais";
- lista de objetos com campos curtos → tabela;
- lista de objetos com textos longos → cards (o campo `nome`, `name`, `titulo` ou `title` vira o título);
- objeto → subseções; lista de textos curtos → etiquetas; texto longo → parágrafo com quebras de linha.

O site **não** interpreta regras nem valida atributos do seu sistema.

## Importar sem estragar nada

- Mesmo `id` de uma ficha existente: o site oferece **Atualizar** ou **Ignorar** (começa em Ignorar).
- Nome parecido com outro `id`: avisa e começa em Ignorar.
- Ao atualizar, `resumo`, `categoria` e `imagem` ausentes no arquivo **mantêm** o valor atual. O conteúdo anterior fica guardado automaticamente (últimas 20 versões por ficha).
- Limites: 2 MB de texto por ficha; até 200 fichas por arquivo.
