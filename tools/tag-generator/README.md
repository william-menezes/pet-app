# Gerador de tags (implementação de referência)

`gerar_tags.py` é o script que gerou o **lote-001**. Ele é a referência do contrato físico
(Princípio VIII): código, dígito verificador, URL do QR e desenho da etiqueta. **Não altere este
arquivo.** Se o sistema divergir dele, o erro está no sistema.

## O que fica fora do git

O repositório é público. Nada disto é versionado (ver `.gitignore`):

| Arquivo | Por quê |
|---|---|
| `lote*/lote.csv` | tem os PINs em texto puro |
| `lote*/codes.txt` | lista de códigos reais: com ela, qualquer pessoa gasta o limite de erros de PIN de cada tag |
| `lote*/folha-*.pdf`, `folha-*.svg` | as etiquetas trazem os mesmos códigos |
| `JetBrainsMono-Bold.ttf` | fonte do texto da etiqueta; coloque ao lado do script |

A pasta `lote-001/` existe só na máquina de quem tem o lote. O teste cruzado com os 54 códigos
reais roda quando `lote-001/codes.txt` existe e é pulado quando não existe. O teste versionado usa
os vetores sintéticos de `specs/003-tag-qr/contracts/tag-code.vectors.json`.

## Como rodar

```bash
pip install segno fonttools cairosvg opencv-python numpy
python gerar_tags.py --diametro 22 --altura 20 --out ./lote-002
```

O lote-001 foi gerado com `--diametro 22 --altura 20`: etiqueta de 21,6 mm, topo reto, 54 por folha.
Um lote novo só vale depois de importado no banco (PINs viram hash; o CSV é apagado).

## Regra do código

- Corpo: 8 caracteres de `0123456789ABCDEFGHJKMNPQRSTVWXYZ`, de fonte criptográfica.
- Dígito: `luhn_mod_n_check` (Luhn mod 32, da direita para a esquerda, fator 2 no último caractere).
- Exibição `XXXX-XXXX-X`; URL `HTTPS://TAGFARO.COM.BR/<CODIGO>`; QR versão 3, correção H.
- A máscara do QR é escolhida pelo `segno` e **não** vai para o CSV. Para reimprimir igual, ela
  precisa ser lida da etiqueta impressa (ou de `qr.mask`) e gravada no banco.

Conferência feita em 2026-11-21: os 54 códigos do lote-001 passam na regra acima.
