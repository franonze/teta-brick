import re
import urllib.request
import json
import time

# Lee el index.html
with open('www/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Extrae todas las opciones
match = re.search(r'<select id="settings-lang" class="settings-select">(.*?)</select>', html, flags=re.DOTALL)
if not match:
    print("No se encontró el select")
    exit()

options_text = match.group(1)
options = re.findall(r'<option value="([^"]+)">([^<]+)</option>', options_text)

def translate(text, target_lang):
    tl = target_lang
    if tl == 'zh': tl = 'zh-CN'
    if tl == 'he': tl = 'iw'
    url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl=es&tl={tl}&dt=t&q={urllib.parse.quote(text)}"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        response = urllib.request.urlopen(req)
        data = json.loads(response.read().decode('utf-8'))
        return data[0][0][0]
    except Exception as e:
        print("Error al traducir", text, "a", target_lang, e)
        return text

new_options_html = []
for code, name in options:
    if code == 'es':
        native_name = 'Español'
    elif code == 'en':
        native_name = 'English'
    else:
        # Some manual overrides for common ones to be perfect, though translate should work
        # Let's just use Google Translate to translate the name of the language to the language itself.
        native_name = translate(name, code)
        time.sleep(0.1) # rate limit
        # Fallback capitalization
        if len(native_name) > 0:
            native_name = native_name[0].upper() + native_name[1:]
    
    # Print statement removed to avoid unicode encode errors on Windows

    new_options_html.append(f'                        <option value="{code}">{native_name}</option>')

new_select = '<select id="settings-lang" class="settings-select">\n' + '\n'.join(new_options_html) + '\n                    </select>'

html = re.sub(r'<select id="settings-lang" class="settings-select">.*?</select>', new_select, html, flags=re.DOTALL)

with open('www/index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("¡Hecho!")
