#!/usr/bin/env python3
"""
Faro — gerador em lote de etiquetas QR para a tag impressa em 3D.

Cada etiqueta é um disco que encaixa no rebaixo circular da tag e recebe resina por cima.
Contém: QR (ECC H, versão <= 6) com o logo compact (focinho) no centro + código
alfanumérico legível abaixo (fallback de digitação).

Saídas (em --out):
  folha-NN.svg / folha-NN.pdf   folhas A4 prontas para impressão, com guia de corte
  lote.csv                      manifesto: code, display, url, activation_pin
  preview.png                   uma etiqueta ampliada para conferência

Uso:
  python gerar_tags.py --qtd 40 --diametro 26 --dominio TAGFARO.COM.BR --out ./lote-001

ATENÇÃO: o activation_pin NÃO vai na etiqueta. Ele vai no cartão da embalagem e deve
ser importado no banco apenas como hash (ver nota no final do arquivo).
"""
from __future__ import annotations

import argparse
import csv
import math
import re
import secrets
from pathlib import Path

import segno
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

# ------------------------------------------------------------------ marca
NAVY = "#0E1336"   # módulos do QR e texto
LIME = "#84C32E"   # focinho (logo compact)
LOGO_W_MOD = 8.0    # largura do focinho em módulos (testado)
LOGO_GAP_MOD = 0.6  # folga branca entre focinho e pontos, em módulos
BADGE_R_MOD = 1     # 0 desliga o logo
DOT_RATIO = 0.86    # diâmetro do ponto / módulo
STYLE = "dots"
TOP_CUT = None      # distância (mm) do centro até o corte reto do topo; None = disco inteiro
LOGO_PATH = (
    "M81.1092 32.525C57.4453 35.1945 40.5022 49.985 33.948 73.696C32.3751 79.3863 32.0524 83.0616 32.0027 95.8501"
    "C31.9415 111.726 32.8956 118.677 36.9015 131.517C38.509 136.668 38.7741 136.991 41.8996 137.601C46.285 138.456 "
    "59.6628 138.51 62.6428 137.684C63.9462 137.323 66.2409 136.007 67.7411 134.759C71.2851 131.813 71.2975 128.811 "
    "67.8094 118.052C64.6006 108.153 64.5075 104.695 67.2942 98.7824C71.1937 90.5058 81.4186 83.5347 90.0378 83.2736"
    "C97.7127 83.0423 104.934 90.2255 108.974 102.11C111.083 108.316 111.848 123.385 110.382 129.891C106.131 148.773 "
    "89.6477 160.82 68.1445 160.761C60.8447 160.742 57.2679 160.252 50.7413 158.381C43.4547 156.291 63.8549 181.213 "
    "77.8374 191.483C86.2305 197.646 96.5592 203.238 107.29 207.428C115.961 210.813 132.178 214.998 136.632 215"
    "C139.73 215.001 154.449 210.937 161.565 208.115C184.491 199.022 205.869 182.833 217.492 165.759C222.355 158.616 "
    "223.118 156.575 220.536 157.615C219.683 157.959 214.553 158.448 209.139 158.701C193.102 159.453 182.055 156.052 "
    "173.883 147.848C164.94 138.869 161.421 122.649 165.014 106.974C168.996 89.6061 177.23 81.2103 187.952 83.5846"
    "C198.961 86.0228 208.186 95.3954 209.381 105.358C209.769 108.598 209.28 111.177 207.115 117.311C203.587 127.308 "
    "203.495 131.789 206.757 134.777C210.172 137.906 217.215 139.164 226.047 138.224L233.17 137.465L236.397 127.889"
    "C240.799 114.827 242.044 107.122 241.999 93.2218C241.968 83.7248 241.572 80.046 239.992 74.5528C233.704 52.6965 "
    "218.081 38.6595 194.746 33.8996C185.687 32.051 167.772 32.0466 159.372 33.89C155.845 34.6644 149.335 36.7312 "
    "144.905 38.4816L136.851 41.6663L129.135 39.0467C111.497 33.0603 95.5563 30.8945 81.1092 32.525Z"
)
LOGO_BBOX = (32.0, 31.9, 242.1, 215.0)  # x0, y0, x1, y1 no viewBox 274x247

# ------------------------------------------------------------------ código
# Crockford Base32: sem I, L, O, U -> nada de confusão 0/O, 1/I/L na digitação.
ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
CODE_LEN = 8          # 32^8 ≈ 1,1 trilhão de combinações (40 bits)
PIN_LEN = 6


def luhn_mod_n_check(payload: str) -> str:
    """Dígito verificador Luhn mod 32 (pega erro de 1 caractere e a maioria das transposições)."""
    n = len(ALPHABET)
    factor, total = 2, 0
    for ch in reversed(payload):
        addend = factor * ALPHABET.index(ch)
        factor = 1 if factor == 2 else 2
        total += addend // n + addend % n
    return ALPHABET[(n - total % n) % n]


def normalize(raw: str) -> str:
    """O que o backend deve aplicar em qualquer código digitado ou lido da URL."""
    s = raw.upper().replace("-", "").replace(" ", "")
    return s.translate(str.maketrans({"O": "0", "I": "1", "L": "1"}))


def is_valid(code: str) -> bool:
    code = normalize(code)
    return (len(code) == CODE_LEN + 1 and all(c in ALPHABET for c in code)
            and luhn_mod_n_check(code[:-1]) == code[-1])


def new_code() -> str:
    body = "".join(secrets.choice(ALPHABET) for _ in range(CODE_LEN))
    return body + luhn_mod_n_check(body)


def display(code: str) -> str:
    return f"{code[0:4]}-{code[4:8]}-{code[8:]}"   # 7K3M-Q9XA-C


# ------------------------------------------------------------------ texto -> paths
class Glyphs:
    def __init__(self, ttf: Path):
        self.font = TTFont(str(ttf))
        self.gs = self.font.getGlyphSet()
        self.cmap = self.font.getBestCmap()
        self.upm = self.font["head"].unitsPerEm
        self.cap = self.font["OS/2"].sCapHeight or 0.73 * self.upm

    def path(self, text: str, cap_mm: float, cx: float, top: float) -> tuple[str, float]:
        """Texto centralizado em cx, topo das maiúsculas em `top`. Retorna (d, largura)."""
        s = cap_mm / self.cap
        widths = [self.gs[self.cmap[ord(c)]].width for c in text]
        total = sum(widths) * s
        x = cx - total / 2
        baseline = top + cap_mm
        d = []
        for c, w in zip(text, widths):
            pen = SVGPathPen(self.gs)
            tp = TransformPen(pen, (s, 0, 0, -s, x, baseline))
            self.gs[self.cmap[ord(c)]].draw(tp)
            d.append(pen.getCommands())
            x += w * s
        return " ".join(d), total


# ------------------------------------------------------------------ geometria
def layout(diam_print: float, n_mod: int, text_chars: int, adv_ratio: float):
    """Maior módulo possível que cabe no disco: QR + zona de silêncio + linha de texto."""
    r = diam_print / 2 - 0.25            # folga até a borda do disco
    quiet = 2                             # módulos (o disco branco ainda dá mais margem)
    gap = 0.5                             # folga extra entre zona de silêncio e texto (x0,4)
    best = None
    for m10000 in range(2500, 8001, 5):   # módulo de 0,25 a 0,80 mm
        m = m10000 / 10000
        side = (n_mod + 2 * quiet) * m
        cap = max(1.5, 3.2 * m)           # altura das maiúsculas acompanha o QR
        tw = text_chars * adv_ratio * cap
        for dy10 in range(0, 60):
            dy = dy10 / 10
            top = -dy - side / 2
            bottom_q = -dy + side / 2 - quiet * m      # base dos módulos
            t_top = bottom_q + quiet * m + gap * 0.4
            t_bot = t_top + cap
            if TOP_CUT is not None and top < -(TOP_CUT - 0.15):
                continue
            ok = (math.hypot(side / 2, top) <= r
                  and math.hypot(side / 2 - quiet * m, bottom_q) <= r
                  and math.hypot(tw / 2, t_bot) <= r)
            if ok:
                best = (m, dy, cap, t_top)
                break
    if not best:
        raise SystemExit("Diâmetro pequeno demais para QR + texto.")
    return best


def label_path(cx: float, cy: float, r: float) -> str:
    """Disco com o topo cortado reto (encaixe sob o ressalto da argola)."""
    if TOP_CUT is None or TOP_CUT >= r:
        return (f"M{cx-r:.3f} {cy:.3f}a{r:.3f} {r:.3f} 0 1 0 {2*r:.3f} 0a{r:.3f} {r:.3f} 0 1 0 {-2*r:.3f} 0z")
    hx = math.sqrt(r * r - TOP_CUT * TOP_CUT)
    y = cy - TOP_CUT
    return f"M{cx-hx:.3f} {y:.3f}H{cx+hx:.3f}A{r:.3f} {r:.3f} 0 1 1 {cx-hx:.3f} {y:.3f}Z"


def _rounded_rect(x, y, w, h, r):
    return (f"M{x+r:.3f} {y:.3f}h{w-2*r:.3f}a{r:.3f} {r:.3f} 0 0 1 {r:.3f} {r:.3f}v{h-2*r:.3f}"
            f"a{r:.3f} {r:.3f} 0 0 1 {-r:.3f} {r:.3f}h{-(w-2*r):.3f}a{r:.3f} {r:.3f} 0 0 1 {-r:.3f} {-r:.3f}"
            f"v{-(h-2*r):.3f}a{r:.3f} {r:.3f} 0 0 1 {r:.3f} {-r:.3f}z")


def _eye(x, y, m, size):
    """Padrão de posição (7x7) ou de alinhamento (5x5) arredondado: anel + miolo."""
    outer = _rounded_rect(x, y, size * m, size * m, size * m * 0.30)
    hole = _rounded_rect(x + m, y + m, (size - 2) * m, (size - 2) * m, (size - 2) * m * 0.24)
    inner_n = size - 4
    core = _rounded_rect(x + 2 * m, y + 2 * m, inner_n * m, inner_n * m, inner_n * m * 0.30)
    return outer + hole + core


_MASK_CACHE: dict = {}


def _logo_knockout(n: int, logo_w_mod: float, gap_mod: float) -> tuple[set, tuple]:
    """Módulos que encostam no focinho (com folga de gap_mod). Retorna (set, transform em módulos)."""
    key = (n, logo_w_mod, gap_mod)
    if key in _MASK_CACHE:
        return _MASK_CACHE[key]
    import cairosvg, cv2, numpy as np
    ppm = 24                                   # px por módulo na máscara
    lx0, ly0, lx1, ly1 = LOGO_BBOX
    lw, lh = lx1 - lx0, ly1 - ly0
    s = logo_w_mod / lw                        # escala em "módulos por unidade do SVG"
    ox = n / 2 - lw * s / 2 - lx0 * s
    oy = n / 2 - lh * s / 2 - ly0 * s
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{n*ppm}" height="{n*ppm}" viewBox="0 0 {n} {n}">'
           f'<rect width="{n}" height="{n}" fill="black"/><path fill="white" fill-rule="evenodd" '
           f'transform="translate({ox} {oy}) scale({s})" d="{LOGO_PATH}"/></svg>')
    img = cv2.imdecode(np.frombuffer(cairosvg.svg2png(bytestring=svg.encode()), np.uint8), cv2.IMREAD_GRAYSCALE)
    k = int(gap_mod * ppm) * 2 + 1
    img = cv2.dilate((img > 127).astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    hit = {(x, y) for y in range(n) for x in range(n)
           if img[y * ppm:(y + 1) * ppm, x * ppm:(x + 1) * ppm].any()}
    _MASK_CACHE[key] = (hit, (ox, oy, s))
    return _MASK_CACHE[key]


def tag_svg(code: str, url: str, cx: float, cy: float, diam: float, glyphs: Glyphs,
            cut_guide: bool, badge_r_mod: float | None = None, style: str | None = None) -> str:
    from segno import consts as K
    badge_r_mod = BADGE_R_MOD if badge_r_mod is None else badge_r_mod
    style = STYLE if style is None else style
    qr = segno.make(url, error="h", micro=False, boost_error=False)
    if qr.version > 6:
        raise SystemExit(f"QR ficou na versão {qr.version}: encurte o domínio (v7+ tem padrão de alinhamento no centro).")
    types = [list(r) for r in qr.matrix_iter(scale=1, border=0, verbose=True)]
    n = len(types)

    adv = glyphs.gs[glyphs.cmap[ord('0')]].width / glyphs.cap
    m, dy, cap, t_top = layout(diam, n, len(display(code)), adv)
    qx0 = cx - n * m / 2
    qy0 = cy - dy - n * m / 2
    ccx, ccy = qx0 + n * m / 2, qy0 + n * m / 2      # centro do QR

    knock, (lox, loy, lsc) = _logo_knockout(n, LOGO_W_MOD, LOGO_GAP_MOD) if badge_r_mod else (set(), (0, 0, 0))

    def in_badge(x, y):  # módulo (x,y) encosta no focinho?
        return (x, y) in knock

    out = [f'<g id="tag-{code}">',
           f'<path fill="#FFFFFF" d="{label_path(cx, cy, diam / 2)}"/>']
    if cut_guide:
        out.append(f'<path fill="none" stroke="#9AA4A1" stroke-width="0.1" d="{label_path(cx, cy, diam / 2)}"/>')

    special = {K.TYPE_FINDER_PATTERN_DARK, K.TYPE_FINDER_PATTERN_LIGHT, K.TYPE_SEPARATOR,
               K.TYPE_ALIGNMENT_PATTERN_DARK, K.TYPE_ALIGNMENT_PATTERN_LIGHT}
    light = {K.TYPE_DATA_LIGHT, K.TYPE_FORMAT_LIGHT, K.TYPE_TIMING_LIGHT, K.TYPE_VERSION_LIGHT,
             K.TYPE_QUIET_ZONE, K.TYPE_FINDER_PATTERN_LIGHT, K.TYPE_ALIGNMENT_PATTERN_LIGHT, K.TYPE_SEPARATOR}
    d = []
    dot_r = m * DOT_RATIO / 2
    for y in range(n):
        for x in range(n):
            t = types[y][x]
            if t in light or t in special or in_badge(x, y):
                continue
            if style == "dots":
                d.append(f"M{qx0+(x+0.5)*m-dot_r:.3f} {qy0+(y+0.5)*m:.3f}a{dot_r:.3f} {dot_r:.3f} 0 1 0 {2*dot_r:.3f} 0"
                         f"a{dot_r:.3f} {dot_r:.3f} 0 1 0 {-2*dot_r:.3f} 0z")
            else:
                d.append(f"M{qx0+x*m:.3f} {qy0+y*m:.3f}h{m:.3f}v{m:.3f}h{-m:.3f}z")
    # olhos arredondados (3 de posição + alinhamento)
    for ex, ey in ((0, 0), (n - 7, 0), (0, n - 7)):
        d.append(_eye(qx0 + ex * m, qy0 + ey * m, m, 7))
    seen = set()
    for y in range(n):
        for x in range(n):
            if types[y][x] == K.TYPE_ALIGNMENT_PATTERN_DARK and (x, y) not in seen:
                # canto superior-esquerdo de um padrão de alinhamento 5x5
                for yy in range(y, y + 5):
                    for xx in range(x, x + 5):
                        seen.add((xx, yy))
                d.append(_eye(qx0 + x * m, qy0 + y * m, m, 5))
    out.append(f'<path fill="{NAVY}" fill-rule="evenodd" d="{"".join(d)}"/>')

    # focinho lima direto sobre o branco (sem selo)
    if badge_r_mod:
        out.append(f'<path fill="{LIME}" fill-rule="evenodd" transform="translate({qx0+lox*m:.3f} {qy0+loy*m:.3f}) '
                   f'scale({lsc*m:.5f})" d="{LOGO_PATH}"/>')

    tp, _ = glyphs.path(display(code), cap, cx, cy + t_top)
    out.append(f'<path fill="{NAVY}" d="{tp}"/>')
    out.append("</g>")
    removed = sum(1 for y in range(n) for x in range(n) if in_badge(x, y))
    return "\n".join(out), dict(version=qr.version, module_mm=m, qr_mm=n * m, cap_mm=cap,
                                logo_pct=100 * removed / n**2)


SHEET_COLS = 6       # colunas por folha A4
SHEET_GAP = 8.0      # respiro entre etiquetas para o corte (mm)


def _grid(diam: float):
    W, H, M, HEAD, FOOT = 210.0, 297.0, 10.0, 8.0, 10.0
    r = diam / 2
    top = TOP_CUT if TOP_CUT is not None else r
    lab_h = top + r
    cols = SHEET_COLS
    rows = int((H - 2 * M - HEAD - FOOT + SHEET_GAP) // (lab_h + SHEET_GAP))
    block_w = cols * diam + (cols - 1) * SHEET_GAP
    block_h = rows * lab_h + (rows - 1) * SHEET_GAP
    x0 = (W - block_w) / 2 + r
    y0 = M + HEAD + (H - 2 * M - HEAD - FOOT - block_h) / 2 + top
    return [(x0 + c * (diam + SHEET_GAP), y0 + rw * (lab_h + SHEET_GAP))
            for rw in range(rows) for c in range(cols)]


def slots_per_sheet(diam: float) -> int:
    return len(_grid(diam))


def sheet(codes, dominio, diam, glyphs, idx, out: Path):
    W, H, M = 210.0, 297.0, 10.0
    slots = _grid(diam)
    per = len(slots)
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}mm" height="{H}mm" viewBox="0 0 {W} {H}">',
             f'<rect width="{W}" height="{H}" fill="#FFFFFF"/>']
    hd, _ = glyphs.path(f"FARO  FOLHA {idx:02d}  {per} ETIQUETAS  {diam:.1f}MM  IMPRIMIR EM 100% (SEM AJUSTE)", 1.8, W / 2, M)
    parts.append(f'<path fill="#8A9391" d="{hd}"/>')
    parts.append(f'<path d="M{W-M-50} {H-M}h50M{W-M-50} {H-M-1.5}v3M{W-M} {H-M-1.5}v3" stroke="#8A9391" stroke-width="0.2" fill="none"/>')
    rd, _ = glyphs.path("50 MM", 1.5, W - M - 25, H - M - 4)
    parts.append(f'<path fill="#8A9391" d="{rd}"/>')
    meta = None
    for code, (cx, cy) in zip(codes, slots):
        g, meta = tag_svg(code, f"HTTPS://{dominio}/{code}", cx, cy, diam, glyphs, cut_guide=True)
        parts.append(g)
    parts.append("</svg>")
    path = out / f"folha-{idx:02d}.svg"
    path.write_text("\n".join(parts), encoding="utf-8")
    return path, per, meta


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--qtd", type=int, default=0, help="0 = uma folha A4 cheia")
    ap.add_argument("--diametro", type=float, default=26.0, help="diâmetro do rebaixo da tag em mm")
    ap.add_argument("--altura", type=float, default=0, help="altura útil no centro (do ressalto da argola até a base); 0 = disco inteiro")
    ap.add_argument("--folga", type=float, default=0.4, help="mm a menos que o rebaixo, para encaixar")
    ap.add_argument("--dominio", default="TAGFARO.COM.BR", help="domínio curto, SEM https://")
    ap.add_argument("--fonte", default=str(Path(__file__).with_name("JetBrainsMono-Bold.ttf")))
    ap.add_argument("--out", default="./lote")
    ap.add_argument("--estilo", choices=["dots", "quadrado"], default="dots")
    a = ap.parse_args()

    if not re.fullmatch(r"[A-Z0-9.\-]+", a.dominio.upper()):
        raise SystemExit("Domínio deve conter só letras, números, ponto e hífen (modo alfanumérico do QR).")
    global STYLE, TOP_CUT
    STYLE = a.estilo
    if a.altura:
        TOP_CUT = a.altura - a.diametro / 2 - 0.3   # 0,3 mm de folga abaixo do ressalto
    dominio = a.dominio.upper()
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    glyphs = Glyphs(Path(a.fonte))
    diam = a.diametro - a.folga

    if not a.qtd:
        a.qtd = slots_per_sheet(diam)
    codes = set()
    while len(codes) < a.qtd:
        codes.add(new_code())
    codes = sorted(codes)

    with open(out / "lote.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["code", "display", "url", "activation_pin"])
        for c in codes:
            pin = "".join(secrets.choice(ALPHABET) for _ in range(PIN_LEN))
            w.writerow([c, display(c), f"HTTPS://{dominio}/{c}", pin])

    rest, idx, files = codes, 1, []
    while rest:
        p, per, meta = sheet(rest, dominio, diam, glyphs, idx, out)
        files.append(p); rest = rest[per:]; idx += 1

    try:
        import cairosvg
        for p in files:
            cairosvg.svg2pdf(url=str(p), write_to=str(p.with_suffix(".pdf")))
        g, _ = tag_svg(codes[0], f"HTTPS://{dominio}/{codes[0]}", diam / 2 + 1, diam / 2 + 1, diam, glyphs, False)
        sv = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{diam+2}mm" height="{diam+2}mm" '
              f'viewBox="0 0 {diam+2} {diam+2}"><rect width="100%" height="100%" fill="#2D3CAC"/>{g}</svg>')
        cairosvg.svg2png(bytestring=sv.encode(), write_to=str(out / "preview.png"), output_width=900)
    except ImportError:
        pass

    print(f"{len(codes)} códigos · {len(files)} folha(s) · QR v{meta['version']} · "
          f"módulo {meta['module_mm']:.2f} mm · QR {meta['qr_mm']:.1f} mm · texto {meta['cap_mm']:.1f} mm · "
          f"logo cobre {meta['logo_pct']:.1f}% dos módulos")


if __name__ == "__main__":
    main()

# Importação no Supabase (sugestão):
#   tag_codes(code PK, status 'available', batch_id, activation_pin_hash = crypt(pin, gen_salt('bf')))
#   O PIN em texto puro só existe no CSV que vai para a gráfica do cartão; apague-o depois.
