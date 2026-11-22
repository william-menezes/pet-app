# Contrato: etiqueta e folha de impressão

**Imutável para lotes já impressos (Princípio VIII).** A referência é o resultado de
`python gerar_tags.py --diametro 22 --altura 20` em `tools/tag-generator/`. A implementação no
backend tem de produzir o mesmo desenho. Mudar qualquer número daqui exige novo teste de leitura
física e aprovação do William.

> **Bloqueio**: o script está em `tools/tag-generator/gerar_tags.py` desde 2026-11-21. Ainda
> faltam a fonte `JetBrainsMono-Bold.ttf` (o arquivo exato usado na impressão) e as máscaras do
> lote-001. Sem eles não há como comprovar "idêntico". As tarefas desta parte (T084, T085) só
> começam depois dessa entrega.

## Tag física e etiqueta

- Rebaixo da tag: 22 mm de largura por 20 mm de altura no centro; o ressalto da argola invade o topo.
- Etiqueta: disco de **21,6 mm** de diâmetro com o **topo cortado reto a 8,7 mm do centro**.
- Fundo branco. Contém o QR e, abaixo dele, o código legível.

## QR

| Parâmetro | Valor |
|---|---|
| Conteúdo | `HTTPS://TAGFARO.COM.BR/<CODIGO>` em maiúsculas (modo alfanumérico) |
| Correção de erro | **H** |
| Versão | **3** (29 × 29 módulos), fixa |
| Máscara | a gravada em `tag_codes.qr_mask`. Lote novo: calculada na criação pela regra de penalidade do padrão. **Lote-001: lida das etiquetas impressas**, nunca escolhida pelo porte |
| Módulo | ~0,43 mm; QR com ~12,4 mm |
| Zona de silêncio | 2 módulos |
| Módulos de dados | **pontos** com diâmetro de 0,86 do módulo |
| Padrões de posição e de alinhamento | **arredondados** |
| Cor | `#0E1336` sobre branco. **Nunca invertido.** |

## Logo no centro do QR

- Focinho em lima `#84C32E`, direto sobre o branco, sem selo nem círculo.
- Largura de **8 módulos**. Removem-se só os módulos que encostam no contorno do focinho, com folga
  de 0,6 módulo (cerca de 9,5% do código).
- **Não aumentar.** Com 9 módulos a leitura degradada já cai; com 10 despenca.

## Código legível

- Texto `XXXX-XXXX-X`, JetBrains Mono Bold **convertida em curvas** (sem depender de fonte instalada).
- Altura de maiúscula de 1,5 mm, centralizado abaixo do QR.

## Folha de impressão

- A4, **6 colunas, 54 etiquetas por folha**, 8 mm de respiro para corte.
- Linha de corte cinza em cada etiqueta.
- Cabeçalho com o id do lote e a página; **régua de 50 mm** para conferir a escala.
- Impressão em 100%, sem "ajustar à página".

## Saídas

- `admin-labels`: PDF vetorial. Cada etiqueta também pode ser obtida como SVG (para conferência).
- Reimpressão usa `qr_version` e `qr_mask` gravados: o resultado é visualmente idêntico ao original.

## Critérios de aceite

1. Para cada código do lote-001: matriz de módulos e máscara iguais às do script.
2. Geometria do SVG igual à do script com tolerância de 0,01 mm (posição e raio de cada ponto,
   contorno dos padrões, posição do logo, contornos do texto).
3. PDF com 54 etiquetas por página, régua medindo 50 mm impressa em 100%.
4. Leitura do PDF impresso em pelo menos um iPhone e um Android (teste manual, registrado em
   `quickstart.md`).
5. O PDF não contém PINs.

## Notas de produção (vão para `docs/producao-tags.md`)

- Adesivo de vinil ou PET branco **opaco**. Papel comum absorve a resina e mata o contraste.
- Laser ou tinta pigmentada.
- Resina resistente a UV, rente à borda, sem cúpula. Evitar bolhas sobre os padrões de posição.
- Escanear antes e depois da resina com um iPhone e um Android. O maior risco é o reflexo da resina.
