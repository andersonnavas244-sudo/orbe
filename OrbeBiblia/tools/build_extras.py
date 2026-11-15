"""Contenido extra de Orbe Biblia (todo verificado contra el texto de la RV1909 ya generado).

    python OrbeBiblia/tools/build_extras.py [ruta/a/eng-kjv_vpl.txt]

Genera en app/src/main/assets/www/data/:
  sentimientos.json   ¿Cómo te sientes hoy? → versículos para cada momento
  oraciones-dia.json  oraciones de la mañana y de la noche (también las usa la notificación)
  saludos.json        «Buenos días / Buenas noches con Dios»: saludos y versículos
  tarjetas.json       tarjetas para fechas (cumpleaños, condolencias, Navidad…)
  trivia.json         preguntas de trivia bíblica (5 por día)
  lugares.json        lugares de la Biblia en el globo 3D y rutas (Abraham, Éxodo, viajes de Pablo)
  kjv/*.json          King James Version (inglés, dominio público) si se pasa el archivo de eBible.org
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'app', 'src', 'main', 'assets', 'www', 'data')
sys.path.insert(0, HERE)
from build_biblia import LIBROS, POR_NOMBRE  # noqa: E402

BOOKS = {}


def book(code):
    if code not in BOOKS:
        BOOKS[code] = json.load(open(os.path.join(DATA, 'biblia', code + '.json'), encoding='utf-8'))
    return BOOKS[code]


def verse(ref):
    """'Salmos 23:1' o 'Números 6:24-26' → (referencia, texto). Falla si no existe."""
    m = re.match(r'^(.+?) (\d+):(\d+)(?:-(\d+))?$', ref)
    assert m, ref
    code = POR_NOMBRE[m.group(1).lower()]
    c, v0 = int(m.group(2)), int(m.group(3))
    v1 = int(m.group(4) or v0)
    chs = book(code)
    assert c <= len(chs) and v1 <= len(chs[c - 1]), 'no existe: ' + ref
    return [ref, ' '.join(chs[c - 1][v - 1] for v in range(v0, v1 + 1))]


SENTIMIENTOS = [
    ('triste', 'Triste', '😢', ['Salmos 34:18', 'Mateo 5:4', 'Salmos 30:5', 'Salmos 147:3', 'Apocalipsis 21:4', 'Juan 16:22', 'Salmos 42:11', '2 Corintios 1:3-4', 'Isaías 41:10']),
    ('ansioso', 'Ansioso', '😟', ['Filipenses 4:6-7', '1 Pedro 5:7', 'Mateo 6:34', 'Mateo 11:28', 'Juan 14:27', 'Salmos 94:19', 'Isaías 26:3', 'Salmos 55:22', 'Mateo 6:25-26']),
    ('solo', 'Solo', '🫂', ['Deuteronomio 31:8', 'Hebreos 13:5', 'Salmos 27:10', 'Mateo 28:20', 'Juan 14:18', 'Isaías 43:2', 'Salmos 68:6', 'Romanos 8:38-39', 'Isaías 41:10']),
    ('agradecido', 'Agradecido', '🙌', ['Salmos 107:1', '1 Tesalonicenses 5:18', 'Salmos 100:4', 'Salmos 9:1', 'Santiago 1:17', 'Salmos 103:2', 'Colosenses 3:17', 'Salmos 118:24']),
    ('miedo', 'Con miedo', '😨', ['Isaías 41:10', 'Salmos 56:3', '2 Timoteo 1:7', 'Josué 1:9', 'Salmos 23:4', 'Salmos 27:1', 'Salmos 91:4-5', 'Isaías 43:1', 'Deuteronomio 31:6']),
    ('enfermo', 'Enfermo', '🤒', ['Jeremías 30:17', 'Santiago 5:15', 'Éxodo 15:26', 'Salmos 41:3', 'Isaías 53:5', 'Salmos 103:2-3', 'Salmos 147:3', '3 Juan 1:2', 'Proverbios 17:22']),
    ('cansado', 'Cansado', '😮‍💨', ['Mateo 11:28-29', 'Isaías 40:29', 'Isaías 40:31', 'Gálatas 6:9', 'Salmos 23:2-3', '2 Corintios 12:9', 'Salmos 73:26', 'Éxodo 33:14']),
    ('enojado', 'Enojado', '😠', ['Efesios 4:26', 'Santiago 1:19-20', 'Proverbios 15:1', 'Proverbios 29:11', 'Colosenses 3:13', 'Efesios 4:31-32', 'Proverbios 16:32', 'Romanos 12:21']),
    ('confundido', 'Confundido', '🤔', ['Proverbios 3:5-6', 'Santiago 1:5', 'Salmos 32:8', 'Isaías 30:21', 'Salmos 119:105', 'Jeremías 33:3', 'Proverbios 16:9', '1 Corintios 14:33']),
    ('feliz', 'Feliz', '😊', ['Salmos 118:24', 'Filipenses 4:4', 'Salmos 16:11', 'Nehemías 8:10', 'Salmos 126:3', 'Romanos 15:13', 'Salmos 37:4', 'Proverbios 17:22']),
]

ORACIONES_DIA = {
    'manana': [
        ('Oración de la mañana', 'Señor, gracias por este nuevo día y por el aire que respiro. Guía mis pasos, mis palabras y mis decisiones. Que todo lo que haga hoy te honre. Amén.'),
        ('Te entrego mi día', 'Padre, pongo en tus manos este día: mi trabajo, mi familia y mis preocupaciones. Dame paz en medio del afán y sabiduría para cada momento. Amén.'),
        ('Gracias por tu misericordia', 'Dios bueno, tus misericordias son nuevas cada mañana. Gracias por cuidarme mientras dormía. Lléname de tu alegría para servir a los demás. Amén.'),
        ('Fuerza para hoy', 'Señor, cuando me falten las fuerzas, sé tú mi fortaleza. Ayúdame a no rendirme y a confiar en que vas delante de mí. Amén.'),
        ('Por mi familia', 'Padre celestial, cubre a mi familia con tu protección. Guárdalos en el camino, en el trabajo y en el estudio. Que el amor reine en nuestro hogar. Amén.'),
        ('Un corazón agradecido', 'Señor, antes de pedirte nada quiero darte gracias: por la vida, por el pan de cada día y por tu amor. Enséñame a ver tus bendiciones hoy. Amén.'),
        ('Guía mis palabras', 'Dios mío, que mis palabras hoy sean amables y edifiquen. Pon un guarda a mi boca y llena mi corazón de paciencia con quienes me rodean. Amén.'),
        ('Sabiduría', 'Señor, necesito tu sabiduría para las decisiones de hoy. Muéstrame el camino correcto y dame valor para seguirlo. Amén.'),
        ('Paz en el corazón', 'Jesús, dame tu paz que sobrepasa todo entendimiento. Que nada de lo que pase hoy me aparte de ti. Amén.'),
        ('Ser luz', 'Padre, úsame hoy para ser luz en la vida de alguien. Que mi forma de tratar a los demás muestre tu amor. Amén.'),
    ],
    'noche': [
        ('Oración de la noche', 'Señor, gracias por acompañarme hoy. Perdona mis errores y ayúdame a descansar en tu paz. En tus manos encomiendo mi espíritu. Amén.'),
        ('Descanso en ti', 'Padre, dejo en tus manos las cargas de este día. Calma mi mente y mi corazón, y dame un sueño tranquilo. Amén.'),
        ('Gracias por hoy', 'Dios bueno, gracias por lo bueno de este día y también por lo difícil, porque en todo estuviste conmigo. Bendice mi descanso. Amén.'),
        ('Protección esta noche', 'Señor, guarda mi casa y a mi familia esta noche. Que tus ángeles acampen alrededor de nosotros. Amén.'),
        ('Perdón', 'Padre, si hoy herí a alguien con mis palabras o mis actos, perdóname. Ayúdame a perdonar también a quienes me ofendieron. Amén.'),
        ('Por los que sufren', 'Señor, esta noche te pido por los enfermos, los que están solos y los que no tienen hogar. Consuélalos y dales tu paz. Amén.'),
        ('Confianza', 'Jesús, aunque no tenga todas las respuestas, confío en ti. Mañana será otro día de tu misericordia. Amén.'),
        ('Un sueño en paz', 'Padre, aleja de mí la ansiedad y los malos pensamientos. Que mi último pensamiento del día sea para ti. Amén.'),
    ],
}

SALUDOS = {
    'manana': ['¡Buenos días!', '¡Buenos días! Dios está contigo', 'Feliz día, que Dios te bendiga', '¡Buenos días! Hoy es un regalo de Dios',
               'Un nuevo día lleno de bendiciones', '¡Buenos días! Camina de la mano de Dios', 'Que la paz de Dios llene tu día',
               '¡Buenos días! Eres amado por Dios', 'Dios bendiga tu mañana', '¡Arriba ese ánimo! Dios va contigo'],
    'noche': ['¡Buenas noches!', 'Buenas noches, descansa en Dios', 'Dulces sueños bajo el cuidado de Dios', 'Que Dios guarde tu descanso',
              'Buenas noches, Dios vela por ti', 'Descansa, mañana Dios te espera con nuevas bendiciones', 'Que la paz de Dios acompañe tu noche',
              'Buenas noches y bendiciones'],
    'versos_manana': ['Lamentaciones 3:22-23', 'Salmos 5:3', 'Salmos 118:24', 'Salmos 143:8', 'Isaías 40:31', 'Salmos 90:14', 'Proverbios 16:3',
                      'Salmos 37:5', 'Filipenses 4:13', 'Josué 1:9', 'Salmos 59:16', 'Isaías 41:10', 'Salmos 46:1', 'Jeremías 29:11'],
    'versos_noche': ['Salmos 4:8', 'Proverbios 3:24', 'Salmos 121:3-4', 'Salmos 91:1', 'Mateo 11:28', 'Salmos 127:2', 'Salmos 63:6',
                     'Isaías 26:3', 'Juan 14:27', 'Salmos 3:5', 'Salmos 16:7-8'],
}

TARJETAS = [
    ('cumple', '🎂', 'Cumpleaños', '¡Feliz cumpleaños!', 'cumple', ['Números 6:24-26', 'Salmos 20:4', 'Jeremías 29:11', 'Proverbios 9:11', 'Salmos 90:12', 'Salmos 118:24']),
    ('animo', '💪', 'Ánimo', '¡Ánimo! Dios está contigo', 'amanecer', ['Josué 1:9', 'Isaías 41:10', 'Filipenses 4:13', 'Isaías 40:31', 'Deuteronomio 31:6', 'Salmos 31:24']),
    ('noches', '🌙', 'Buenas noches', '¡Buenas noches!', 'noche', ['Salmos 4:8', 'Proverbios 3:24', 'Salmos 121:3-4', 'Salmos 91:1', 'Mateo 11:28']),
    ('condolencias', '🕊️', 'Condolencias', 'Mis condolencias', 'paz', ['Mateo 5:4', 'Juan 11:25', 'Apocalipsis 21:4', 'Salmos 34:18', '2 Corintios 1:3-4', 'Juan 14:1-2', '1 Tesalonicenses 4:14']),
    ('gracias', '🙏', 'Gracias', '¡Gracias!', 'amanecer', ['Filipenses 1:3', 'Efesios 1:16', '1 Tesalonicenses 1:2', 'Rut 2:12', 'Números 6:24']),
    ('bendiciones', '✨', 'Bendiciones', 'Dios te bendiga', 'tierra', ['Números 6:24-26', 'Salmos 20:4', 'Romanos 15:13', '3 Juan 1:2', 'Efesios 3:20']),
    ('navidad', '🎄', 'Navidad', '¡Feliz Navidad!', 'navidad', ['Lucas 2:10-11', 'Lucas 2:14', 'Isaías 9:6', 'Mateo 1:23', 'Juan 3:16']),
    ('anonuevo', '🎆', 'Año Nuevo', '¡Feliz Año Nuevo!', 'noche', ['Isaías 43:19', 'Lamentaciones 3:22-23', 'Jeremías 29:11', '2 Corintios 5:17', 'Filipenses 3:13-14']),
    ('boda', '💍', 'Boda', '¡Felicidades a los novios!', 'cumple', ['Eclesiastés 4:12', 'Génesis 2:24', '1 Corintios 13:4-5', 'Marcos 10:9', 'Colosenses 3:14']),
    ('madre', '🌷', 'Día de la Madre', '¡Feliz día, mamá!', 'cumple', ['Proverbios 31:28', 'Proverbios 31:25-26', 'Éxodo 20:12', 'Proverbios 31:30']),
    ('padre', '👔', 'Día del Padre', '¡Feliz día, papá!', 'amanecer', ['Proverbios 20:7', 'Salmos 103:13', 'Proverbios 23:24', 'Efesios 6:4']),
    ('sanidad', '💚', 'Recupérate', 'Que Dios te sane pronto', 'paz', ['Jeremías 30:17', 'Santiago 5:15', 'Salmos 41:3', '3 Juan 1:2', 'Éxodo 15:26']),
]

TRIVIA = [
    ('¿Quién construyó el arca?', ['Noé', 'Moisés', 'Abraham', 'David'], 0, 'Génesis 6:14'),
    ('¿Cuántos días y noches llovió en el diluvio?', ['40', '7', '12', '100'], 0, 'Génesis 7:12'),
    ('¿Quién fue tragado por un gran pez?', ['Jonás', 'Pedro', 'Elías', 'Daniel'], 0, 'Jonás 1:17'),
    ('¿En qué ciudad nació Jesús?', ['Belén', 'Nazaret', 'Jerusalén', 'Capernaum'], 0, 'Mateo 2:1'),
    ('¿Quién derrotó al gigante Goliat?', ['David', 'Saúl', 'Sansón', 'Josué'], 0, '1 Samuel 17:50'),
    ('¿Cuántos apóstoles escogió Jesús?', ['12', '10', '7', '70'], 0, 'Lucas 6:13'),
    ('¿Quién negó a Jesús tres veces?', ['Pedro', 'Judas', 'Juan', 'Tomás'], 0, 'Mateo 26:75'),
    ('¿Cuál es el primer libro de la Biblia?', ['Génesis', 'Éxodo', 'Mateo', 'Salmos'], 0, 'Génesis 1:1'),
    ('¿Cuál es el último libro de la Biblia?', ['Apocalipsis', 'Judas', 'Malaquías', 'Hechos'], 0, 'Apocalipsis 22:21'),
    ('¿Quién recibió las tablas de la ley en el monte Sinaí?', ['Moisés', 'Aarón', 'Josué', 'Abraham'], 0, 'Éxodo 31:18'),
    ('¿Cómo se llamaba la esposa de Abraham?', ['Sara', 'Rebeca', 'Raquel', 'Lea'], 0, 'Génesis 17:15'),
    ('¿Quién fue vendido por sus hermanos?', ['José', 'Benjamín', 'Isaac', 'Esaú'], 0, 'Génesis 37:28'),
    ('¿Cuál fue el primer milagro de Jesús?', ['Convertir el agua en vino', 'Sanar a un ciego', 'Multiplicar los panes', 'Caminar sobre el agua'], 0, 'Juan 2:11'),
    ('¿En qué río fue bautizado Jesús?', ['Jordán', 'Nilo', 'Éufrates', 'Tigris'], 0, 'Mateo 3:13'),
    ('¿Quién bautizó a Jesús?', ['Juan el Bautista', 'Pedro', 'Pablo', 'Santiago'], 0, 'Mateo 3:13'),
    ('¿Quién fue echado en el foso de los leones?', ['Daniel', 'David', 'Jeremías', 'Elías'], 0, 'Daniel 6:16'),
    ('¿Cuántos libros tiene la Biblia (Reina-Valera)?', ['66', '72', '39', '27'], 0, None),
    ('¿Cuántos libros tiene el Nuevo Testamento?', ['27', '39', '12', '66'], 0, None),
    ('¿Quién traicionó a Jesús?', ['Judas Iscariote', 'Pedro', 'Tomás', 'Pilato'], 0, 'Mateo 26:14'),
    ('¿Por cuántas piezas de plata fue entregado Jesús?', ['30', '40', '10', '100'], 0, 'Mateo 26:15'),
    ('¿Qué mar se abrió para que pasara el pueblo de Israel?', ['El mar Rojo', 'El mar Muerto', 'El mar de Galilea', 'El Mediterráneo'], 0, 'Éxodo 14:21'),
    ('¿Quién fue la madre de Jesús?', ['María', 'Marta', 'Elisabet', 'Ana'], 0, 'Mateo 1:16'),
    ('¿Quién perdió su fuerza cuando le cortaron el cabello?', ['Sansón', 'Goliat', 'Gedeón', 'Saúl'], 0, 'Jueces 16:19'),
    ('¿En cuántos días hizo Dios los cielos y la tierra antes de reposar?', ['6', '7', '3', '40'], 0, 'Éxodo 20:11'),
    ('¿De qué árbol prohibió Dios comer a Adán?', ['Del árbol de la ciencia del bien y del mal', 'Del árbol de la vida', 'De la vid', 'Del olivo'], 0, 'Génesis 2:17'),
    ('¿Quién mató a su hermano Abel?', ['Caín', 'Set', 'Esaú', 'Lamec'], 0, 'Génesis 4:8'),
    ('¿Quién era el hermano gemelo de Jacob?', ['Esaú', 'José', 'Isaac', 'Labán'], 0, 'Génesis 25:25-26'),
    ('¿Qué rey pidió a Dios sabiduría para gobernar?', ['Salomón', 'David', 'Saúl', 'Josías'], 0, '1 Reyes 3:9'),
    ('¿Quién escribió la mayoría de los Salmos?', ['David', 'Salomón', 'Moisés', 'Asaf'], 0, None),
    ('¿Con cuántos panes y peces alimentó Jesús a cinco mil?', ['5 panes y 2 peces', '7 panes y 3 peces', '2 panes y 5 peces', '12 panes y 1 pez'], 0, 'Mateo 14:17'),
    ('¿Qué discípulo caminó sobre el agua hacia Jesús?', ['Pedro', 'Juan', 'Andrés', 'Felipe'], 0, 'Mateo 14:29'),
    ('¿A qué amigo resucitó Jesús en Betania?', ['Lázaro', 'Nicodemo', 'Zaqueo', 'Bartimeo'], 0, 'Juan 11:43-44'),
    ('¿Quién subió a un árbol para ver pasar a Jesús?', ['Zaqueo', 'Nicodemo', 'Mateo', 'Lázaro'], 0, 'Lucas 19:4'),
    ('¿Camino a qué ciudad se convirtió Saulo (Pablo)?', ['Damasco', 'Jericó', 'Emaús', 'Roma'], 0, 'Hechos 9:3'),
    ('¿Qué discípulo no creyó hasta ver las heridas de Jesús?', ['Tomás', 'Pedro', 'Felipe', 'Juan'], 0, 'Juan 20:27'),
    ('¿Qué ave volvió al arca con una hoja de olivo?', ['Una paloma', 'Un cuervo', 'Un águila', 'Un gorrión'], 0, 'Génesis 8:11'),
    ('¿Qué libro de la Biblia tiene más capítulos?', ['Salmos', 'Génesis', 'Isaías', 'Jeremías'], 0, None),
    ('¿Cuántos Salmos hay en la Biblia?', ['150', '100', '120', '176'], 0, None),
    ('¿Quién fue el primer rey de Israel?', ['Saúl', 'David', 'Salomón', 'Samuel'], 0, '1 Samuel 10:1'),
    ('¿Qué profeta subió al cielo en un torbellino, con un carro de fuego?', ['Elías', 'Eliseo', 'Enoc', 'Isaías'], 0, '2 Reyes 2:11'),
    ('¿Quién dijo: «tu pueblo será mi pueblo, y tu Dios mi Dios»?', ['Rut', 'Noemí', 'Ester', 'Débora'], 0, 'Rut 1:16'),
    ('¿Qué reina arriesgó su vida para salvar a su pueblo ante el rey Asuero?', ['Ester', 'Vasti', 'Jezabel', 'La reina de Sabá'], 0, 'Ester 4:16'),
    ('¿Cómo se llamaba el padre de Juan el Bautista?', ['Zacarías', 'José', 'Simeón', 'Elí'], 0, 'Lucas 1:13'),
    ('¿Qué oración enseñó Jesús a sus discípulos?', ['El Padre Nuestro', 'El Salmo 23', 'El Magníficat', 'La bendición de Aarón'], 0, 'Mateo 6:9'),
    ('Según Jesús, ¿cuál es el primero y grande mandamiento?', ['Amar a Dios con todo tu corazón', 'No matarás', 'Guardar el sábado', 'Honrar a padre y madre'], 0, 'Mateo 22:37-38'),
    ('En la parábola, ¿quién ayudó al hombre herido en el camino?', ['Un samaritano', 'Un sacerdote', 'Un levita', 'Un soldado'], 0, 'Lucas 10:33'),
    ('¿Qué le pidió el hijo pródigo a su padre?', ['Su parte de la herencia', 'Un trabajo', 'Una casa', 'Un camello'], 0, 'Lucas 15:12'),
    ('¿En qué lugar oró Jesús antes de ser arrestado?', ['Getsemaní', 'El Edén', 'Betania', 'El Gólgota'], 0, 'Mateo 26:36'),
    ('¿Quién llevó la cruz detrás de Jesús?', ['Simón de Cirene', 'José de Arimatea', 'Pedro', 'Juan'], 0, 'Lucas 23:26'),
    ('¿Al cuántos días resucitó Jesús?', ['Al tercer día', 'Al séptimo día', 'Al segundo día', 'A los cuarenta días'], 0, 'Lucas 24:7'),
    ('¿Durante cuántos días se apareció Jesús resucitado antes de subir al cielo?', ['40', '3', '7', '50'], 0, 'Hechos 1:3'),
    ('¿En qué fiesta vino el Espíritu Santo sobre los discípulos?', ['Pentecostés', 'La Pascua', 'Los tabernáculos', 'La dedicación'], 0, 'Hechos 2:1'),
    ('¿Quién fue apedreado mientras veía los cielos abiertos?', ['Esteban', 'Santiago', 'Pedro', 'Pablo'], 0, 'Hechos 7:59'),
    ('¿Qué apóstol escribió más cartas del Nuevo Testamento?', ['Pablo', 'Pedro', 'Juan', 'Santiago'], 0, None),
    ('¿Qué profesión tenía Lucas, el compañero de Pablo?', ['Médico', 'Pescador', 'Publicano', 'Carpintero'], 0, 'Colosenses 4:14'),
    ('¿Qué hacía Mateo cuando Jesús lo llamó?', ['Estaba sentado al banco de los públicos tributos', 'Pescaba', 'Construía una casa', 'Cuidaba ovejas'], 0, 'Mateo 9:9'),
    ('¿A qué se dedicaban Pedro y Andrés?', ['Eran pescadores', 'Eran carpinteros', 'Eran pastores', 'Eran soldados'], 0, 'Mateo 4:18'),
    ('¿Qué hizo Jesús con los que vendían y compraban en el templo?', ['Los echó fuera', 'Les compró palomas', 'Les dio monedas', 'Les pidió perdón'], 0, 'Mateo 21:12'),
    ('¿En qué isla estaba Juan cuando recibió el Apocalipsis?', ['Patmos', 'Malta', 'Chipre', 'Creta'], 0, 'Apocalipsis 1:9'),
    ('¿Quién guio a Israel después de la muerte de Moisés?', ['Josué', 'Aarón', 'Caleb', 'Gedeón'], 0, 'Josué 1:2'),
    ('¿Qué ciudad cayó cuando el pueblo gritó y tocó las bocinas?', ['Jericó', 'Hai', 'Jerusalén', 'Nínive'], 0, 'Josué 6:20'),
    ('¿A qué ciudad envió Dios a Jonás a predicar?', ['Nínive', 'Babilonia', 'Tiro', 'Damasco'], 0, 'Jonás 3:3'),
    ('¿Cómo se llamaba el hijo que Dios prometió a Abraham y Sara?', ['Isaac', 'Ismael', 'Jacob', 'José'], 0, 'Génesis 21:3'),
    ('¿Qué le regaló Jacob a su hijo José?', ['Una ropa de diversos colores', 'Un anillo', 'Un camello', 'Una espada'], 0, 'Génesis 37:3'),
    ('¿Cuál fue la última plaga de Egipto?', ['La muerte de los primogénitos', 'Las ranas', 'Las langostas', 'Las tinieblas'], 0, 'Éxodo 12:29'),
    ('¿Qué alimento caía del cielo para Israel en el desierto?', ['El maná', 'Pan de cebada', 'Higos', 'Miel'], 0, 'Éxodo 16:15'),
    ('¿Quién era el hermano de Moisés que habló por él ante Faraón?', ['Aarón', 'Josué', 'Caleb', 'Leví'], 0, 'Éxodo 4:14'),
    ('¿Cuántos años anduvo Israel en el desierto?', ['40', '7', '70', '12'], 0, 'Números 14:33'),
    ('¿Qué dice Juan 11:35, uno de los versículos más cortos?', ['Jesús lloró', 'Dios es amor', 'Orad sin cesar', 'Estad siempre gozosos'], 0, 'Juan 11:35'),
    ('Según Juan 3:16, ¿a quién amó Dios de tal manera?', ['Al mundo', 'A Israel', 'A los ángeles', 'A los sabios'], 0, 'Juan 3:16'),
    ('Completa: «Jehová es mi pastor; …»', ['nada me faltará', 'no temeré', 'en él confío', 'él me guía'], 0, 'Salmos 23:1'),
    ('Completa: «Todo lo puedo en Cristo que me …»', ['fortalece', 'ama', 'guía', 'salva'], 0, 'Filipenses 4:13'),
    ('¿Qué fruto del Espíritu se menciona primero en Gálatas 5:22?', ['Amor', 'Gozo', 'Paz', 'Fe'], 0, 'Gálatas 5:22'),
    ('¿Qué tres cosas permanecen según 1 Corintios 13:13?', ['La fe, la esperanza y la caridad', 'La paz, el gozo y el amor', 'La fe, la paz y la verdad', 'El camino, la verdad y la vida'], 0, '1 Corintios 13:13'),
    ('Completa: «Yo soy el camino, y la verdad, y …»', ['la vida', 'la luz', 'la puerta', 'el pan'], 0, 'Juan 14:6'),
    ('¿Quiénes trajeron oro, incienso y mirra al niño Jesús?', ['Los magos', 'Los pastores', 'Los ángeles', 'Los profetas'], 0, 'Mateo 2:11'),
    ('¿A quiénes anunciaron los ángeles el nacimiento de Jesús?', ['A los pastores', 'A los magos', 'A los sacerdotes', 'A los soldados'], 0, 'Lucas 2:8-11'),
    ('¿Dónde fue acostado Jesús al nacer?', ['En un pesebre', 'En una cuna', 'En el templo', 'En una barca'], 0, 'Lucas 2:7'),
    ('¿Qué rey mandó matar a los niños de Belén?', ['Herodes', 'Pilato', 'Faraón', 'Nabucodonosor'], 0, 'Mateo 2:16'),
    ('¿Qué gobernador romano entregó a Jesús para ser crucificado?', ['Pilato', 'Herodes', 'Félix', 'Festo'], 0, 'Mateo 27:26'),
    ('¿Qué tres jóvenes fueron echados en el horno de fuego?', ['Sadrach, Mesach y Abed-nego', 'Pedro, Santiago y Juan', 'Daniel, Ezequiel y Jeremías', 'Sem, Cam y Japhet'], 0, 'Daniel 3:20'),
    ('¿Cuál fue el primer hombre creado por Dios?', ['Adán', 'Noé', 'Abel', 'Set'], 0, 'Génesis 2:7'),
    ('¿Qué apóstol fue sacado de la cárcel por un ángel?', ['Pedro', 'Pablo', 'Silas', 'Juan'], 0, 'Hechos 12:7'),
    ('¿Quiénes cantaban himnos en la cárcel cuando hubo un gran terremoto?', ['Pablo y Silas', 'Pedro y Juan', 'Bernabé y Marcos', 'Lucas y Timoteo'], 0, 'Hechos 16:25-26'),
    ('¿A qué discípulo encargó Jesús, desde la cruz, el cuidado de su madre?', ['Al discípulo que él amaba (Juan)', 'A Pedro', 'A Santiago', 'A Andrés'], 0, 'Juan 19:26-27'),
    ('¿Qué gigante filisteo medía seis codos y un palmo?', ['Goliat', 'Og', 'Anac', 'Sansón'], 0, '1 Samuel 17:4'),
    ('¿Cómo se llamaba la madre de Samuel, que oró por un hijo?', ['Ana', 'Elisabet', 'Rebeca', 'Raquel'], 0, '1 Samuel 1:20'),
    ('¿Qué hermanas de Betania eran amigas de Jesús?', ['Marta y María', 'Ana y Elisabet', 'Rut y Noemí', 'Lea y Raquel'], 0, 'Juan 11:1'),
    ('¿Qué le pasó a la mujer de Lot cuando miró atrás?', ['Se volvió estatua de sal', 'Quedó ciega', 'Se durmió', 'Se perdió'], 0, 'Génesis 19:26'),
    ('¿Qué señal puso Dios en las nubes después del diluvio?', ['El arco iris', 'Una estrella', 'Un relámpago', 'Una paloma'], 0, 'Génesis 9:13'),
]

LUGARES = [
    ('jerusalen', 'Jerusalén', 31.778, 35.235, 'La ciudad de David y del templo. Allí Jesús fue crucificado, sepultado y resucitó.', ['2 Samuel 5:7', 'Lucas 24:47']),
    ('belen', 'Belén', 31.705, 35.200, 'El pueblo de David, donde nació Jesús, como lo anunció el profeta Miqueas.', ['Miqueas 5:2', 'Lucas 2:4']),
    ('nazaret', 'Nazaret', 32.699, 35.304, 'Donde el ángel visitó a María y donde Jesús creció.', ['Lucas 1:26-27', 'Lucas 4:16']),
    ('galilea', 'Mar de Galilea', 32.82, 35.59, 'Junto a sus orillas Jesús llamó a pescadores y caminó sobre las aguas.', ['Mateo 4:18-19', 'Mateo 14:25']),
    ('capernaum', 'Capernaum', 32.881, 35.575, 'La ciudad donde vivió Jesús durante su ministerio en Galilea.', ['Mateo 4:13', 'Marcos 2:1']),
    ('cana', 'Caná de Galilea', 32.746, 35.339, 'En una boda, Jesús convirtió el agua en vino: su primera señal.', ['Juan 2:11']),
    ('jordan', 'Río Jordán', 31.837, 35.551, 'Juan bautizó allí a Jesús y el Espíritu descendió como paloma.', ['Mateo 3:13', 'Mateo 3:16-17']),
    ('jerico', 'Jericó', 31.871, 35.444, 'Sus muros cayeron cuando Israel gritó; siglos después, Zaqueo conoció a Jesús allí.', ['Josué 6:20', 'Lucas 19:1-5']),
    ('olivos', 'Monte de los Olivos', 31.779, 35.244, 'Jesús oró en Getsemaní, al pie de este monte, antes de ser arrestado.', ['Lucas 22:39', 'Mateo 26:36']),
    ('samaria', 'Pozo de Jacob (Sicar)', 32.21, 35.285, 'Jesús habló con la mujer samaritana sobre el agua viva.', ['Juan 4:6', 'Juan 4:14']),
    ('carmelo', 'Monte Carmelo', 32.73, 35.05, 'Elías desafió a los profetas de Baal y cayó fuego del cielo.', ['1 Reyes 18:38-39']),
    ('hebron', 'Hebrón', 31.53, 35.10, 'Abraham vivió allí y compró la cueva de Macpela para sepultar a Sara.', ['Génesis 13:18', 'Génesis 23:19']),
    ('sinai', 'Monte Sinaí', 28.539, 33.975, 'Dios dio a Moisés los Diez Mandamientos.', ['Éxodo 19:20', 'Éxodo 31:18']),
    ('marrojo', 'Mar Rojo', 29.7, 32.75, 'Dios abrió el mar y su pueblo pasó en seco.', ['Éxodo 14:21-22']),
    ('egipto', 'Egipto', 30.6, 31.5, 'José llegó a gobernar Egipto; después Dios sacó a su pueblo de la esclavitud.', ['Génesis 41:41', 'Éxodo 3:10']),
    ('nebo', 'Monte Nebo', 31.768, 35.725, 'Desde aquí Moisés vio la tierra prometida antes de morir.', ['Deuteronomio 34:1']),
    ('ur', 'Ur de los Caldeos', 30.963, 46.103, 'De aquí salió Abraham con su familia, llamado por Dios.', ['Génesis 11:31', 'Génesis 12:1']),
    ('haran', 'Harán', 36.865, 39.031, 'Abraham tenía 75 años cuando salió de Harán hacia Canaán.', ['Génesis 12:4']),
    ('ararat', 'Montes de Ararat', 39.70, 44.30, 'Allí reposó el arca de Noé después del diluvio.', ['Génesis 8:4']),
    ('babilonia', 'Babilonia', 32.536, 44.420, 'Daniel y sus amigos fueron llevados cautivos aquí.', ['Daniel 1:1', 'Salmos 137:1']),
    ('ninive', 'Nínive', 36.359, 43.153, 'Jonás predicó y la gran ciudad se arrepintió.', ['Jonás 3:3', 'Jonás 3:10']),
    ('damasco', 'Damasco', 33.513, 36.292, 'En el camino, una luz del cielo rodeó a Saulo y se convirtió.', ['Hechos 9:3-4']),
    ('antioquia', 'Antioquía', 36.20, 36.16, 'A los discípulos se les llamó cristianos por primera vez aquí.', ['Hechos 11:26']),
    ('efeso', 'Éfeso', 37.94, 27.34, 'Pablo enseñó allí dos años; luego les escribió la carta a los Efesios.', ['Hechos 19:10', 'Efesios 1:1']),
    ('corinto', 'Corinto', 37.906, 22.878, 'Pablo vivió allí con Aquila y Priscila, fabricando tiendas.', ['Hechos 18:1-3']),
    ('atenas', 'Atenas', 37.97, 23.72, 'En el Areópago, Pablo habló del Dios no conocido.', ['Hechos 17:22-23']),
    ('malta', 'Malta', 35.9, 14.4, 'Pablo naufragó en esta isla camino a Roma.', ['Hechos 28:1']),
    ('roma', 'Roma', 41.89, 12.49, 'Pablo llegó preso y escribió cartas; antes había escrito a los Romanos.', ['Hechos 28:16', 'Romanos 1:7']),
    ('patmos', 'Isla de Patmos', 37.31, 26.55, 'Juan recibió aquí la revelación del Apocalipsis.', ['Apocalipsis 1:9']),
]
RUTAS = [
    ('abraham', 'El viaje de Abraham', '#f5c26b', [(30.963, 46.103), (36.865, 39.031), (32.21, 35.285), (31.53, 35.10), (30.6, 31.5)]),
    ('exodo', 'El Éxodo', '#ff9f43', [(30.6, 31.5), (29.7, 32.75), (28.539, 33.975), (31.768, 35.725), (31.871, 35.444)]),
    ('pablo1', 'Primer viaje de Pablo', '#6fb8ff', [(36.20, 36.16), (35.18, 33.90), (36.95, 30.85), (38.30, 31.19), (37.87, 32.48), (37.58, 32.45), (37.35, 33.25), (36.20, 36.16)]),
    ('pablo2', 'Segundo viaje de Pablo', '#2fd27a', [(36.20, 36.16), (37.87, 32.48), (39.96, 26.24), (41.01, 24.29), (40.64, 22.94), (37.97, 23.72), (37.906, 22.878), (37.94, 27.34), (31.778, 35.235)]),
    ('pablo3', 'Viaje de Pablo a Roma', '#ff6b8a', [(32.50, 34.89), (36.61, 29.10), (35.9, 14.4), (37.07, 15.29), (40.85, 14.27), (41.89, 12.49)]),
]


def kjv(src):
    names_en = ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings',
                '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Isaiah',
                'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah',
                'Haggai', 'Zechariah', 'Malachi', 'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians', 'Galatians',
                'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews',
                'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation']
    codes = [c for c, _, _ in LIBROS]
    books = {c: [] for c in codes}
    pat = re.compile(r'^(\w{3}) (\d+):(\d+) (.*)$')
    for line in open(src, encoding='utf-8-sig'):
        m = pat.match(line.rstrip('\n'))
        if not m or m.group(1) not in books:
            continue
        code, c, v, t = m.group(1), int(m.group(2)), int(m.group(3)), m.group(4)
        t = re.sub(r'\[([^\]]*)\]', lambda x: x.group(1), t.replace('¶', '')).strip()
        t = re.sub(r'\s+', ' ', t)
        chs = books[code]
        while len(chs) < c:
            chs.append([])
        while len(chs[c - 1]) < v - 1:
            chs[c - 1].append('')
        chs[c - 1].append(t)
    os.makedirs(os.path.join(DATA, 'kjv'), exist_ok=True)
    meta = []
    for i, code in enumerate(codes):
        chs = books[code]
        assert chs, 'falta ' + code
        meta.append({'c': code, 'n': names_en[i], 'caps': len(chs), 'vs': [len(x) for x in chs]})
        json.dump(chs, open(os.path.join(DATA, 'kjv', code + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    json.dump(meta, open(os.path.join(DATA, 'kjv', 'libros.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    total = sum(sum(len(c) for c in b) for b in books.values())
    print(f'KJV: {len(codes)} libros, {total} versículos')


def main():
    out = lambda name, obj: json.dump(obj, open(os.path.join(DATA, name), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    out('sentimientos.json', [{'k': k, 'n': n, 'e': e, 'v': [verse(r) for r in refs]} for k, n, e, refs in SENTIMIENTOS])
    out('oraciones-dia.json', ORACIONES_DIA)
    out('saludos.json', {'manana': SALUDOS['manana'], 'noche': SALUDOS['noche'],
                         'versos_manana': [verse(r) for r in SALUDOS['versos_manana']], 'versos_noche': [verse(r) for r in SALUDOS['versos_noche']]})
    out('tarjetas.json', [{'k': k, 'e': e, 'n': n, 't': t, 'bg': bg, 'v': [verse(r) for r in refs]} for k, e, n, t, bg, refs in TARJETAS])
    for q, opts, a, ref in TRIVIA:
        assert len(opts) == 4 and a == 0
        if ref:
            verse(ref)
    out('trivia.json', [{'q': q, 'o': o, 'r': ref} for q, o, _, ref in TRIVIA])   # la respuesta correcta es siempre la primera (se barajan en la app)
    out('lugares.json', {'lugares': [{'k': k, 'n': n, 'lat': la, 'lng': lo, 'd': d, 'v': [verse(r) for r in refs]} for k, n, la, lo, d, refs in LUGARES],
                         'rutas': [{'k': k, 'n': n, 'c': c, 'p': p} for k, n, c, p in RUTAS]})
    print(f'{len(SENTIMIENTOS)} sentimientos, {len(TARJETAS)} tarjetas, {len(TRIVIA)} preguntas, {len(LUGARES)} lugares, {len(RUTAS)} rutas')
    if len(sys.argv) > 1:
        kjv(sys.argv[1])


if __name__ == '__main__':
    main()
