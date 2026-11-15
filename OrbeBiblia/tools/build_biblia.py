"""Convierte la Reina-Valera 1909 (dominio público, eBible.org) a los datos de Orbe Biblia,
con las tildes actualizadas (fué → fue, á → a…); el texto es el mismo.

    python OrbeBiblia/tools/build_biblia.py ruta/a/spaRV1909_vpl.txt

Descarga: https://eBible.org/Scriptures/spaRV1909_vpl.zip (formato «LIBRO C:V texto», un versículo por línea).
Genera en app/src/main/assets/www/data/:
  biblia/libros.json       los 66 libros: código, nombre, abreviatura, testamento, capítulos y versículos
  biblia/<CODIGO>.json     cada libro: lista de capítulos, cada uno lista de versículos
  diario.json              366 versículos del día [referencia, texto, tema] (los usa también la notificación)
  temas.json               versículos por tema (ánimo, fe, paz…)
"""
import json
import os
import re
import sys
from collections import OrderedDict

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'app', 'src', 'main', 'assets', 'www', 'data')

LIBROS = [
    ('GEN', 'Génesis', 'Gn'), ('EXO', 'Éxodo', 'Éx'), ('LEV', 'Levítico', 'Lv'), ('NUM', 'Números', 'Nm'), ('DEU', 'Deuteronomio', 'Dt'),
    ('JOS', 'Josué', 'Jos'), ('JDG', 'Jueces', 'Jue'), ('RUT', 'Rut', 'Rt'), ('1SA', '1 Samuel', '1 S'), ('2SA', '2 Samuel', '2 S'),
    ('1KI', '1 Reyes', '1 R'), ('2KI', '2 Reyes', '2 R'), ('1CH', '1 Crónicas', '1 Cr'), ('2CH', '2 Crónicas', '2 Cr'), ('EZR', 'Esdras', 'Esd'),
    ('NEH', 'Nehemías', 'Neh'), ('EST', 'Ester', 'Est'), ('JOB', 'Job', 'Job'), ('PSA', 'Salmos', 'Sal'), ('PRO', 'Proverbios', 'Pr'),
    ('ECC', 'Eclesiastés', 'Ec'), ('SOL', 'Cantares', 'Cnt'), ('ISA', 'Isaías', 'Is'), ('JER', 'Jeremías', 'Jer'), ('LAM', 'Lamentaciones', 'Lm'),
    ('EZE', 'Ezequiel', 'Ez'), ('DAN', 'Daniel', 'Dn'), ('HOS', 'Oseas', 'Os'), ('JOE', 'Joel', 'Jl'), ('AMO', 'Amós', 'Am'),
    ('OBA', 'Abdías', 'Abd'), ('JON', 'Jonás', 'Jon'), ('MIC', 'Miqueas', 'Mi'), ('NAH', 'Nahúm', 'Nah'), ('HAB', 'Habacuc', 'Hab'),
    ('ZEP', 'Sofonías', 'Sof'), ('HAG', 'Hageo', 'Hag'), ('ZEC', 'Zacarías', 'Zac'), ('MAL', 'Malaquías', 'Mal'),
    ('MAT', 'Mateo', 'Mt'), ('MAR', 'Marcos', 'Mr'), ('LUK', 'Lucas', 'Lc'), ('JOH', 'Juan', 'Jn'), ('ACT', 'Hechos', 'Hch'),
    ('ROM', 'Romanos', 'Ro'), ('1CO', '1 Corintios', '1 Co'), ('2CO', '2 Corintios', '2 Co'), ('GAL', 'Gálatas', 'Gá'), ('EPH', 'Efesios', 'Ef'),
    ('PHI', 'Filipenses', 'Fil'), ('COL', 'Colosenses', 'Col'), ('1TH', '1 Tesalonicenses', '1 Ts'), ('2TH', '2 Tesalonicenses', '2 Ts'),
    ('1TI', '1 Timoteo', '1 Ti'), ('2TI', '2 Timoteo', '2 Ti'), ('TIT', 'Tito', 'Tit'), ('PHM', 'Filemón', 'Flm'), ('HEB', 'Hebreos', 'He'),
    ('JAM', 'Santiago', 'Stg'), ('1PE', '1 Pedro', '1 P'), ('2PE', '2 Pedro', '2 P'), ('1JO', '1 Juan', '1 Jn'), ('2JO', '2 Juan', '2 Jn'),
    ('3JO', '3 Juan', '3 Jn'), ('JUD', 'Judas', 'Jud'), ('REV', 'Apocalipsis', 'Ap'),
]
NOMBRE = {c: n for c, n, _ in LIBROS}
POR_NOMBRE = {n.lower(): c for c, n, _ in LIBROS}

# Versículos por tema (referencias; el texto sale de la RV1909). Se usan para el versículo del día y la sección Temas.
TEMAS = OrderedDict([
    ('animo', ('Ánimo', ['Josué 1:9', 'Isaías 41:10', 'Filipenses 4:13', 'Deuteronomio 31:6', 'Isaías 40:31', 'Salmos 27:1', 'Salmos 31:24',
                         '2 Corintios 4:16', 'Gálatas 6:9', 'Salmos 55:22', 'Isaías 43:2', 'Juan 16:33', 'Romanos 8:31', 'Salmos 46:1',
                         'Nahúm 1:7', 'Salmos 121:1', 'Salmos 121:2', 'Hebreos 13:6', '1 Pedro 5:7', 'Salmos 34:18', 'Salmos 73:26',
                         '2 Timoteo 1:7', 'Isaías 40:29', 'Salmos 138:3', 'Habacuc 3:19', 'Sofonías 3:17', 'Salmos 28:7', 'Mateo 11:28',
                         'Mateo 11:29', '2 Corintios 12:9', 'Salmos 30:5', 'Lamentaciones 3:22', 'Lamentaciones 3:23', 'Salmos 42:11'])),
    ('fe', ('Fe', ['Hebreos 11:1', 'Hebreos 11:6', 'Marcos 9:23', 'Mateo 17:20', 'Romanos 10:17', 'Proverbios 3:5', 'Proverbios 3:6',
                   'Marcos 11:24', 'Santiago 1:6', '2 Corintios 5:7', 'Romanos 5:1', 'Efesios 2:8', 'Gálatas 2:20', 'Juan 11:25',
                   'Juan 20:29', 'Mateo 21:22', 'Salmos 37:5', 'Isaías 26:3', 'Jeremías 17:7', 'Salmos 56:3', 'Hebreos 12:2',
                   'Romanos 15:13', '1 Juan 5:4', 'Salmos 62:8', 'Salmos 9:10', 'Lucas 1:37', 'Jeremías 32:27', 'Mateo 19:26'])),
    ('amor', ('Amor', ['Juan 3:16', '1 Corintios 13:4', '1 Corintios 13:7', '1 Corintios 13:13', '1 Juan 4:8', '1 Juan 4:19', 'Romanos 8:38',
                       'Romanos 8:39', 'Romanos 5:8', 'Juan 15:12', 'Juan 15:13', '1 Juan 4:18', 'Jeremías 31:3', 'Sofonías 3:17',
                       'Efesios 3:17', 'Efesios 3:18', '1 Pedro 4:8', 'Colosenses 3:14', 'Romanos 13:10', 'Juan 13:34', 'Juan 13:35',
                       'Proverbios 10:12', 'Salmos 136:1', '1 Juan 3:18', 'Cantares 8:7', 'Rut 1:16'])),
    ('paz', ('Paz', ['Juan 14:27', 'Filipenses 4:6', 'Filipenses 4:7', 'Isaías 26:3', 'Salmos 4:8', 'Salmos 29:11', 'Mateo 5:9',
                     'Romanos 12:18', 'Colosenses 3:15', '2 Tesalonicenses 3:16', 'Salmos 23:1', 'Salmos 23:2', 'Salmos 23:3', 'Salmos 23:4',
                     'Salmos 46:10', 'Isaías 32:17', 'Números 6:24', 'Números 6:25', 'Números 6:26', 'Salmos 119:165', 'Proverbios 16:7',
                     'Romanos 8:6', 'Mateo 6:34', 'Salmos 91:1', 'Salmos 91:2', 'Éxodo 14:14'])),
    ('familia', ('Familia', ['Josué 24:15', 'Proverbios 22:6', 'Efesios 6:1', 'Efesios 6:2', 'Éxodo 20:12', 'Salmos 127:1', 'Salmos 127:3',
                             'Colosenses 3:13', 'Colosenses 3:20', 'Efesios 4:32', 'Proverbios 17:6', 'Salmos 133:1', 'Hechos 16:31',
                             'Eclesiastés 4:9', 'Eclesiastés 4:12', 'Proverbios 31:10', 'Proverbios 31:28', 'Génesis 2:24', 'Malaquías 4:6',
                             'Deuteronomio 6:6', 'Deuteronomio 6:7', 'Salmos 103:17'])),
    ('gratitud', ('Gratitud', ['1 Tesalonicenses 5:18', 'Salmos 118:24', 'Salmos 100:4', 'Salmos 107:1', 'Colosenses 3:17', 'Salmos 9:1',
                               'Salmos 103:2', 'Santiago 1:17', 'Salmos 136:1', 'Filipenses 4:4', 'Salmos 95:2', 'Salmos 34:1',
                               'Efesios 5:20', 'Salmos 150:6', 'Salmos 16:11', 'Salmos 126:3', 'Hebreos 12:28', '2 Corintios 9:15',
                               'Salmos 92:1', 'Lamentaciones 3:22'])),
    ('sabiduria', ('Sabiduría', ['Proverbios 3:5', 'Santiago 1:5', 'Proverbios 1:7', 'Proverbios 4:23', 'Proverbios 16:3', 'Proverbios 16:9',
                                 'Salmos 119:105', 'Proverbios 2:6', 'Proverbios 15:1', 'Proverbios 18:21', 'Mateo 7:12', 'Mateo 6:33',
                                 'Romanos 12:2', 'Salmos 32:8', 'Proverbios 27:17', 'Eclesiastés 3:1', 'Proverbios 19:21', 'Isaías 55:8',
                                 'Isaías 55:9', 'Colosenses 3:23', 'Miqueas 6:8', 'Proverbios 11:25', 'Mateo 5:16', 'Gálatas 5:22',
                                 'Gálatas 5:23', 'Filipenses 4:8'])),
    ('esperanza', ('Esperanza', ['Jeremías 29:11', 'Romanos 8:28', 'Romanos 15:13', 'Isaías 40:31', 'Apocalipsis 21:4', 'Salmos 39:7',
                                 'Lamentaciones 3:24', 'Lamentaciones 3:25', 'Romanos 5:5', 'Hebreos 6:19', '1 Pedro 1:3', 'Salmos 71:14',
                                 'Proverbios 23:18', 'Isaías 43:18', 'Isaías 43:19', '2 Corintios 5:17', 'Juan 14:1', 'Juan 14:2',
                                 'Juan 14:3', 'Salmos 37:4', 'Filipenses 1:6', 'Romanos 8:18', 'Salmos 40:1', 'Salmos 30:11'])),
])


# Tildes de la ortografía de 1909 que hoy ya no se usan (el texto y las palabras no cambian)
MODERNO = {'fué': 'fue', 'fuí': 'fui', 'dió': 'dio', 'vió': 'vio', 'fé': 'fe', 'tí': 'ti', 'piés': 'pies', 'pié': 'pie',
           'huír': 'huir', 'á': 'a', 'ó': 'o', 'é': 'e', 'ú': 'u', 'víó': 'vio', 'sóis': 'sois', 'dí': 'di', 'ví': 'vi'}
_MOD_RE = re.compile(r'(?<!\w)(' + '|'.join(sorted(MODERNO, key=len, reverse=True)) + r')(?!\w)', re.IGNORECASE)


def modernize(text):
    def rep(m):
        w = m.group(0)
        new = MODERNO[w.lower()]
        if w.isupper() and len(w) > 1:
            return new.upper()
        return new[0].upper() + new[1:] if w[0].isupper() else new
    return _MOD_RE.sub(rep, text)


def clean(text, verse):
    text = re.sub(r'\s+', ' ', text).strip()
    # [palabras añadidas por los traductores]: en la RV1909 impresa van en cursiva; aquí se muestran como texto normal
    text = re.sub(r'\[([^\]]*)\]', lambda m: m.group(1), text)
    text = modernize(text)
    # la primera palabra de cada capítulo viene en MAYÚSCULAS ("EN el principio"): se deja como en un libro normal
    if verse == 1:
        m = re.match(r'^([A-ZÁÉÍÓÚÑÜ]{2,})(\b.*)$', text)
        if m and m.group(1) not in ('JEHOVÁ', 'DIOS', 'SEÑOR'):
            text = m.group(1)[0] + m.group(1)[1:].lower() + m.group(2)
    return text


def parse(path):
    books = OrderedDict()
    pat = re.compile(r'^(\w{3}) (\d+):(\d+) (.*)$')
    for line in open(path, encoding='utf-8-sig'):
        m = pat.match(line.rstrip('\n'))
        if not m:
            continue
        code, c, v, t = m.group(1), int(m.group(2)), int(m.group(3)), m.group(4)
        chs = books.setdefault(code, [])
        while len(chs) < c:
            chs.append([])
        vs = chs[c - 1]
        while len(vs) < v - 1:      # versículo que falta en el original: se deja vacío para no correr la numeración
            vs.append('')
        vs.append(clean(t, v))
    return books


def ref_text(books, ref):
    m = re.match(r'^(.+?) (\d+):(\d+)$', ref)
    name, c, v = m.group(1), int(m.group(2)), int(m.group(3))
    code = POR_NOMBRE[name.lower()]
    return books[code][c - 1][v - 1]


def main(src):
    books = parse(src)
    assert list(books) == [c for c, _, _ in LIBROS], 'los libros no coinciden'
    os.makedirs(os.path.join(OUT, 'biblia'), exist_ok=True)
    meta = []
    for i, (code, name, abbr) in enumerate(LIBROS):
        chs = books[code]
        meta.append({'c': code, 'n': name, 'a': abbr, 't': 'AT' if i < 39 else 'NT', 'caps': len(chs), 'vs': [len(x) for x in chs]})
        with open(os.path.join(OUT, 'biblia', code + '.json'), 'w', encoding='utf-8') as f:
            json.dump(chs, f, ensure_ascii=False, separators=(',', ':'))
    with open(os.path.join(OUT, 'biblia', 'libros.json'), 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, separators=(',', ':'))
    # temas y versículo del día (366 días: se recorren los temas alternando, sin repetir hasta agotarlos)
    temas, pool = {}, []
    for key, (label, refs) in TEMAS.items():
        items = [[r, ref_text(books, r)] for r in refs]
        temas[key] = {'n': label, 'v': items}
    seen = set()
    queues = {k: list(v['v']) for k, v in temas.items()}
    while len(pool) < 366:
        added = False
        for k in temas:
            while queues[k]:
                r, t = queues[k].pop(0)
                if r not in seen or len(seen) >= sum(len(v['v']) for v in temas.values()):
                    seen.add(r)
                    pool.append([r, t, temas[k]['n']])
                    added = True
                    break
            if len(pool) >= 366:
                break
        if not added:
            seen.clear()
            queues = {k: list(v['v']) for k, v in temas.items()}
    with open(os.path.join(OUT, 'temas.json'), 'w', encoding='utf-8') as f:
        json.dump(temas, f, ensure_ascii=False, separators=(',', ':'))
    with open(os.path.join(OUT, 'diario.json'), 'w', encoding='utf-8') as f:
        json.dump(pool, f, ensure_ascii=False, separators=(',', ':'))
    total = sum(sum(len(c) for c in b) for b in books.values())
    print(f'{len(books)} libros, {sum(len(b) for b in books.values())} capítulos, {total} versículos; {len(pool)} versículos del día; {sum(len(v["v"]) for v in temas.values())} por tema')


if __name__ == '__main__':
    main(sys.argv[1])
