"""Lista de ciudades del mundo para las apps Orbe (buscador sin internet y nombres sobre el globo).

    python tools-diseno/ciudades/construir.py

Fuente: GeoNames cities15000 (CC BY 4.0, https://www.geonames.org/), ciudades de más de 15.000 habitantes.
Se eligen ~1.800: la capital y las 3 más grandes de cada país, y el resto por población.
Nombres en español para las ciudades conocidas por otro nombre (Nueva York, Londres, Pekín…).
Salida: data/ciudades-mundo.json en Orbe Clima, Orbe Espacio y Orbe Sismos:
    [nombre, país (ISO2), lat, lng, población]
"""
import csv
import json
import os
import sys
import urllib.request
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
SRC = os.path.join(HERE, 'cities15000.txt')
TOTAL = 1800

ES = {
    'New York City': 'Nueva York', 'London': 'Londres', 'Beijing': 'Pekín', 'Moscow': 'Moscú', 'Tokyo': 'Tokio',
    'Cairo': 'El Cairo', 'Mexico City': 'Ciudad de México', 'São Paulo': 'São Paulo', 'Rome': 'Roma', 'Paris': 'París',
    'Berlin': 'Berlín', 'Munich': 'Múnich', 'Cologne': 'Colonia', 'Vienna': 'Viena', 'Prague': 'Praga', 'Warsaw': 'Varsovia',
    'Lisbon': 'Lisboa', 'Athens': 'Atenas', 'Brussels': 'Bruselas', 'Copenhagen': 'Copenhague', 'Stockholm': 'Estocolmo',
    'Geneva': 'Ginebra', 'Zurich': 'Zúrich', 'Milan': 'Milán', 'Naples': 'Nápoles', 'Turin': 'Turín', 'Florence': 'Florencia',
    'Venice': 'Venecia', 'Saint Petersburg': 'San Petersburgo', 'Kyiv': 'Kiev', 'Bucharest': 'Bucarest', 'Istanbul': 'Estambul',
    'Tehran': 'Teherán', 'Baghdad': 'Bagdad', 'Riyadh': 'Riad', 'Jerusalem': 'Jerusalén', 'Beirut': 'Beirut', 'Damascus': 'Damasco',
    'New Delhi': 'Nueva Delhi', 'Mumbai': 'Bombay', 'Kolkata': 'Calcuta', 'Shanghai': 'Shanghái', 'Hong Kong': 'Hong Kong',
    'Seoul': 'Seúl', 'Singapore': 'Singapur', 'Bangkok': 'Bangkok', 'Manila': 'Manila', 'Jakarta': 'Yakarta', 'Sydney': 'Sídney',
    'Philadelphia': 'Filadelfia', 'New Orleans': 'Nueva Orleans', 'Washington, D.C.': 'Washington D. C.', 'Montreal': 'Montreal',
    'Cape Town': 'Ciudad del Cabo', 'Johannesburg': 'Johannesburgo', 'Algiers': 'Argel', 'Tunis': 'Túnez', 'Rabat': 'Rabat',
    'Casablanca': 'Casablanca', 'Addis Ababa': 'Adís Abeba', 'Kinshasa': 'Kinsasa', 'Moscow Oblast': 'Moscú', 'Havana': 'La Habana',
    'Panamá': 'Ciudad de Panamá', 'Panama City': 'Ciudad de Panamá', 'Guatemala City': 'Ciudad de Guatemala', 'Belize City': 'Ciudad de Belice',
    'Port-au-Prince': 'Puerto Príncipe', 'Kingston': 'Kingston', 'Edinburgh': 'Edimburgo', 'Dublin': 'Dublín', 'The Hague': 'La Haya',
    'Antwerp': 'Amberes', 'Hamburg': 'Hamburgo', 'Frankfurt am Main': 'Fráncfort', 'Strasbourg': 'Estrasburgo', 'Marseille': 'Marsella',
    'Bordeaux': 'Burdeos', 'Toulouse': 'Toulouse', 'Lyon': 'Lyon', 'Nice': 'Niza', 'Belgrade': 'Belgrado', 'Budapest': 'Budapest',
    'Minsk': 'Minsk', 'Krakow': 'Cracovia', 'Kraków': 'Cracovia', 'Saint-Petersburg': 'San Petersburgo', 'Nur-Sultan': 'Astaná',
    'Astana': 'Astaná', 'Kabul': 'Kabul', 'Karachi': 'Karachi', 'Lahore': 'Lahore', 'Dhaka': 'Daca', 'Kathmandu': 'Katmandú',
    'Taipei': 'Taipéi', 'Osaka': 'Osaka', 'Kyoto': 'Kioto', 'Pyongyang': 'Pionyang', 'Ulaanbaatar': 'Ulán Bator', 'Hanoi': 'Hanói',
    'Ho Chi Minh City': 'Ciudad Ho Chi Minh', 'Kuala Lumpur': 'Kuala Lumpur', 'Wellington': 'Wellington', 'Auckland': 'Auckland',
    'Mecca': 'La Meca', 'Medina': 'Medina', 'Dubai': 'Dubái', 'Abu Dhabi': 'Abu Dabi', 'Doha': 'Doha', 'Kuwait City': 'Kuwait',
    'Nairobi': 'Nairobi', 'Lagos': 'Lagos', 'Accra': 'Acra', 'Dakar': 'Dakar', 'Khartoum': 'Jartum', 'Tripoli': 'Trípoli',
    'Alexandria': 'Alejandría', 'Luanda': 'Luanda', 'Maputo': 'Maputo', 'Antananarivo': 'Antananarivo', 'Brasília': 'Brasilia',
    'Rio de Janeiro': 'Río de Janeiro', 'Saint Louis': 'San Luis', 'San Francisco': 'San Francisco', 'Los Angeles': 'Los Ángeles',
    'Quebec': 'Quebec', 'Québec': 'Quebec', 'Asunción': 'Asunción', 'Bogota': 'Bogotá', 'Bogotá': 'Bogotá', 'Medellin': 'Medellín',
    'Reykjavik': 'Reikiavik', 'Helsinki': 'Helsinki', 'Oslo': 'Oslo', 'Tbilisi': 'Tiflis', 'Yerevan': 'Ereván', 'Baku': 'Bakú',
    'Tashkent': 'Taskent', 'Bishkek': 'Biskek', 'Dushanbe': 'Dusambé', 'Ashgabat': 'Asjabad', 'Mogadishu': 'Mogadiscio',
    'Bern': 'Berna', 'Luxembourg': 'Luxemburgo', 'Valletta': 'La Valeta', 'Nicosia': 'Nicosia', 'Vilnius': 'Vilna', 'Riga': 'Riga',
    'Tallinn': 'Tallin', 'Chisinau': 'Chisináu', 'Sofia': 'Sofía', 'Zagreb': 'Zagreb', 'Ljubljana': 'Liubliana', 'Sarajevo': 'Sarajevo',
    'Skopje': 'Skopie', 'Tirana': 'Tirana', 'Podgorica': 'Podgorica', 'Seville': 'Sevilla', 'Saragossa': 'Zaragoza', 'Zaragoza': 'Zaragoza',
}


def load():
    if not os.path.exists(SRC):
        z = os.path.join(HERE, 'cities15000.zip')
        urllib.request.urlretrieve('https://download.geonames.org/export/dump/cities15000.zip', z)
        zipfile.ZipFile(z).extractall(HERE)
    rows = []
    csv.field_size_limit(sys.maxsize if sys.maxsize < 2**31 else 2**31 - 1)
    with open(SRC, encoding='utf-8') as f:
        for r in csv.reader(f, delimiter='\t', quoting=csv.QUOTE_NONE):
            if len(r) < 15:
                continue
            name, cc, fcode, pop = r[1], r[8], r[7], int(r[14] or 0)
            rows.append({'name': ES.get(name, name), 'cc': cc, 'lat': round(float(r[4]), 3), 'lng': round(float(r[5]), 3),
                         'pop': pop, 'cap': fcode == 'PPLC'})
    return rows


def main():
    rows = load()
    by_cc = {}
    for c in rows:
        by_cc.setdefault(c['cc'], []).append(c)
    pick, seen = [], set()

    import math

    def near_bigger(c):
        # barrios o municipios pegados a una ciudad más grande (p. ej. Kennedy en Bogotá) no se repiten
        for o in pick:
            if o['cc'] == c['cc'] and o['pop'] >= c['pop'] and abs(o['lat'] - c['lat']) < 0.2:
                d = math.hypot(o['lat'] - c['lat'], (o['lng'] - c['lng']) * math.cos(math.radians(c['lat'])))
                if d < 0.13:
                    return True
        return False

    def add(c, force=False):
        key = (c['name'], c['cc'])
        if key not in seen and (force or not near_bigger(c)):
            seen.add(key)
            pick.append(c)
    for cc, lst in sorted(by_cc.items(), key=lambda kv: -max(c['pop'] for c in kv[1])):
        lst.sort(key=lambda c: -c['pop'])
        for c in lst:
            if c['cap']:
                add(c, True)
        for c in lst[:3]:
            add(c)
    for c in sorted(rows, key=lambda c: -c['pop']):
        if len(pick) >= TOTAL:
            break
        add(c)
    # Las ciudades de Latinoamérica que ya usaba la app (nombres revisados) van primero
    lat_old = json.load(open(os.path.join(ROOT, 'OrbeClima', 'app', 'src', 'main', 'assets', 'www', 'data', 'ciudades.json'), encoding='utf-8'))
    for c in lat_old:
        add({'name': c[0], 'cc': c[1], 'lat': c[2], 'lng': c[3], 'pop': 0, 'cap': False}, True)
    pick.sort(key=lambda c: -c['pop'])
    out = [[c['name'], c['cc'], c['lat'], c['lng'], c['pop']] for c in pick]
    data = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
    for app in ('OrbeClima', 'OrbeEspacio', 'OrbeSismos'):
        p = os.path.join(ROOT, app, 'app', 'src', 'main', 'assets', 'www', 'data', 'ciudades-mundo.json')
        open(p, 'w', encoding='utf-8').write(data)
    print(len(out), 'ciudades de', len({c[1] for c in out}), 'países ·', len(data) // 1024, 'KB')


if __name__ == '__main__':
    main()
