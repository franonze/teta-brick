import json
import re
from googletrans import Translator
import time

def main():
    file_path = 'www/config.js'
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Regex to find TRANSLATIONS
    match = re.search(r'const TRANSLATIONS = (\{[\s\S]*?\});\n', content)
    if not match:
        print("TRANSLATIONS not found")
        return

    translations_str = match.group(1)
    
    # We must parse it using a dirty eval or python json if it's well-formed
    # The config.js object has unquoted keys maybe? Actually they are quoted.
    try:
        translations = json.loads(translations_str)
    except:
        print("Not valid JSON. Fixing...")
        import ast
        translations = ast.literal_eval(translations_str)

    translator = Translator()

    en_texts = {
        "error_overlap": "Error: The event overlaps with an existing one.",
        "settings_permissions_title": "Permissions (Android)",
        "settings_perm_alarm": "Alarm Permission"
    }
    
    es_texts = {
        "error_overlap": "Error: El evento se solapa con otro existente.",
        "settings_permissions_title": "Permisos (Android)",
        "settings_perm_alarm": "Permiso de Alarma"
    }

    # Already translated languages from my previous script attempts:
    translations["es"].update(es_texts)
    translations["en"].update(en_texts)

    for lang, lang_dict in translations.items():
        if lang in ["es", "en"]:
            continue
        
        updates = {}
        for key, text in en_texts.items():
            if key not in lang_dict or lang_dict[key] == text or "Error: The event" in lang_dict[key] or "Permissions (" in lang_dict[key]:
                # translate from English to lang
                # googletrans uses standard language codes
                trans_lang = lang
                if '-' in lang:
                    trans_lang = lang.split('-')[0]
                
                try:
                    res = translator.translate(text, dest=trans_lang)
                    updates[key] = res.text
                    time.sleep(0.5)
                except Exception as e:
                    print(f"Error translating {lang}: {e}")
                    updates[key] = text # fallback
        
        if updates:
            print(f"Updated {lang}: {updates}")
            lang_dict.update(updates)

    new_str = json.dumps(translations, indent=4, ensure_ascii=False)
    # The original indentation was 4 spaces, but json.dumps uses double quotes.
    # config.js uses double quotes anyway.
    
    new_content = content[:match.start(1)] + new_str + content[match.end(1):]
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print("Done")

if __name__ == '__main__':
    main()
