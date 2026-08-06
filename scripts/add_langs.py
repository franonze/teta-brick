import re

langs = [
    ('af', 'Afrikáans'),
    ('sq', 'Albanés'),
    ('de', 'Alemán'),
    ('am', 'Amárico'),
    ('ar', 'Árabe'),
    ('hy', 'Armenio'),
    ('az', 'Azerbaiyano'),
    ('bn', 'Bengalí'),
    ('bho', 'Bhojpuri'),
    ('be', 'Bielorruso'),
    ('my', 'Birmano'),
    ('bg', 'Búlgaro'),
    ('kn', 'Canarés'),
    ('ca', 'Catalán'),
    ('ceb', 'Cebuano'),
    ('cs', 'Checo'),
    ('zh', 'Chino'),
    ('si', 'Cingalés'),
    ('ko', 'Coreano'),
    ('hr', 'Croata'),
    ('da', 'Danés'),
    ('sk', 'Eslovaco'),
    ('sl', 'Esloveno'),
    ('es', 'Español'),
    ('et', 'Estonio'),
    ('eu', 'Euskera'),
    ('tl', 'Filipino'),
    ('fi', 'Finés'),
    ('fr', 'Francés'),
    ('gl', 'Gallego'),
    ('ka', 'Georgiano'),
    ('el', 'Griego'),
    ('gu', 'Guyaratí'),
    ('ha', 'Hausa'),
    ('he', 'Hebreo'),
    ('hi', 'Hindi'),
    ('nl', 'Holandés'),
    ('hu', 'Húngaro'),
    ('ig', 'Igbo'),
    ('id', 'Indonesio'),
    ('en', 'Inglés'),
    ('is', 'Islandés'),
    ('it', 'Italiano'),
    ('ja', 'Japonés'),
    ('jv', 'Javanés'),
    ('km', 'Jemer'),
    ('kk', 'Kazajo'),
    ('ky', 'Kirguís'),
    ('ku', 'Kurdo'),
    ('lo', 'Lao'),
    ('lv', 'Letón'),
    ('lt', 'Lituano'),
    ('mk', 'Macedonio'),
    ('ms', 'Malayo'),
    ('ml', 'Malayálam'),
    ('mr', 'Maratí'),
    ('mn', 'Mongol'),
    ('ne', 'Nepalí'),
    ('no', 'Noruego'),
    ('or', 'Odia'),
    ('fa', 'Persa'),
    ('pl', 'Polaco'),
    ('pt', 'Portugués'),
    ('pa', 'Punyabí'),
    ('rm', 'Romanche'),
    ('ro', 'Rumano'),
    ('ru', 'Ruso'),
    ('sr', 'Serbio'),
    ('sd', 'Sindhi'),
    ('sw', 'Suajili'),
    ('su', 'Sundanés'),
    ('sv', 'Sueco'),
    ('th', 'Tailandés'),
    ('ta', 'Tamil'),
    ('te', 'Telugu'),
    ('tr', 'Turco'),
    ('uk', 'Ucraniano'),
    ('ur', 'Urdu'),
    ('uz', 'Uzbeko'),
    ('vi', 'Vietnamita'),
    ('yo', 'Yoruba'),
    ('zu', 'Zulú')
]

# Sort alphabetically by name
langs.sort(key=lambda x: x[1])

# 1. Update index.html
with open('www/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

options = '\n'.join([f'                        <option value="{code}">{name}</option>' for code, name in langs])
new_select = f'<select id="settings-lang" class="settings-select">\n{options}\n                    </select>'

html = re.sub(r'<select id="settings-lang" class="settings-select">.*?</select>', new_select, html, flags=re.DOTALL)

with open('www/index.html', 'w', encoding='utf-8') as f:
    f.write(html)

# 2. Update config.js
with open('www/config.js', 'r', encoding='utf-8') as f:
    config = f.read()

new_langs = [
    'af', 'sq', 'hy', 'az', 'be', 'bg', 'ca', 'cs', 'si', 'hr', 'da', 
    'sk', 'sl', 'et', 'eu', 'gl', 'ka', 'el', 'he', 'hu', 'is', 'kk', 
    'ky', 'lo', 'lv', 'lt', 'mk', 'mn', 'no', 'rm', 'sr', 'zu'
]

match = re.search(r'const TRANSLATIONS = \{([\s\S]*?)\n\};', config)
if match:
    existing_content = match.group(1)
    append_str = ""
    for lang in new_langs:
        append_str += f",\n    {lang}: {{ }}"
    
    new_translations = existing_content + append_str
    config = config[:match.start(1)] + new_translations + config[match.end(1):]

with open('www/config.js', 'w', encoding='utf-8') as f:
    f.write(config)

print("HTML and JS updated with new languages.")
