const fs = require('fs');
const https = require('https');

const CONFIG_PATH = 'www/config.js';

async function translateText(text, targetLang) {
    // some mapping for google translate
    let tl = targetLang;
    if (tl === 'zh') tl = 'zh-CN';
    if (tl === 'he') tl = 'iw';

    return new Promise((resolve, reject) => {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=es&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
        
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    // Google translate returns an array of sentences
                    let translated = '';
                    if (parsed && parsed[0]) {
                        parsed[0].forEach(part => {
                            if (part[0]) translated += part[0];
                        });
                    }
                    resolve(translated || text);
                } catch (e) {
                    resolve(text); // fallback to original on error
                }
            });
        }).on('error', () => {
            resolve(text);
        });
    });
}

// Custom parser to safely modify the file without losing structure
async function updateTranslations() {
    let content = fs.readFileSync(CONFIG_PATH, 'utf-8');
    
    // Quick and dirty extraction of TRANSLATIONS using eval
    // We only want to evaluate it to read keys, not to stringify back (which would lose formatting).
    const translationsMatch = content.match(/const\s+TRANSLATIONS\s*=\s*({[\s\S]*?});/);
    if (!translationsMatch) {
        console.error("Could not find TRANSLATIONS object in config.js");
        return;
    }

    let translations;
    try {
        translations = eval('(' + translationsMatch[1] + ')');
    } catch (e) {
        console.error("Failed to parse TRANSLATIONS block.");
        return;
    }

    const esKeys = Object.keys(translations['es'] || {});
    if (esKeys.length === 0) return;

    let madeChanges = false;
    let newContent = content;

    for (const lang of Object.keys(translations)) {
        if (lang === 'es') continue;
        
        const langObj = translations[lang];
        let missingKeys = [];
        
        for (const key of esKeys) {
            if (!(key in langObj)) {
                missingKeys.push(key);
            }
        }

        if (missingKeys.length > 0) {
            console.log(`[${lang}] Translating ${missingKeys.length} missing keys...`);
            madeChanges = true;
            
            let additions = '';
            for (const key of missingKeys) {
                const esText = translations['es'][key];
                const translated = await translateText(esText, lang);
                // Add sleep to avoid rate limits
                await new Promise(r => setTimeout(r, 100));
                
                additions += `, ${key}: ${JSON.stringify(translated)}`;
                console.log(`  -> ${key}: ${translated}`);
            }

            // Inject the new keys into the string specifically for this language
            // Find `lang: { ... }` block and insert right before the closing brace
            const langRegex = new RegExp(`(^\\s*${lang}\\s*:\\s*\\{[^}]+)(\\})`, 'm');
            newContent = newContent.replace(langRegex, `$1${additions} $2`);
        }
    }

    if (madeChanges) {
        fs.writeFileSync(CONFIG_PATH, newContent, 'utf-8');
        console.log("Translations updated successfully in config.js");
    } else {
        console.log("All languages are up to date. No translations needed.");
    }
}

updateTranslations();
