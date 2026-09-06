const fs = require('fs');
const translate = require('google-translate-api-x');

async function main() {
    const jsPath = 'www/config.js';
    let js = fs.readFileSync(jsPath, 'utf8');
    
    const match = js.match(/const TRANSLATIONS = (\{[\s\S]*?\});/);
    if (!match) {
        console.error('Could not find TRANSLATIONS in config.js');
        process.exit(1);
    }
    
    let translations;
    try {
        translations = eval('(' + match[1] + ')');
    } catch(e) {
        console.error('Error evaluating translations', e);
        process.exit(1);
    }
    
    const esKeys = Object.keys(translations['es']);
    const enFallback = translations['en'];
    let totalTranslated = 0;
    
    const delay = ms => new Promise(res => setTimeout(res, ms));

    for (const lang of Object.keys(translations)) {
        if (lang === 'es' || lang === 'en') continue;
        
        // Map some language codes if necessary
        let googleLang = lang;
        if (lang === 'jv') googleLang = 'jw';
        if (lang === 'bho') googleLang = 'bho';
        if (lang === 'mn') googleLang = 'mn';
        
        let missingKeys = [];
        let textsToTranslate = [];
        
        for (const key of esKeys) {
            const val = translations[lang][key];
            const esVal = translations['es'][key];
            const enVal = enFallback[key];
            
            let isUntranslated = false;
            if (!val) isUntranslated = true;
            else if (val === enVal && esVal !== enVal) isUntranslated = true;
            else if (val === esVal) isUntranslated = true;
            
            if (isUntranslated) {
                missingKeys.push(key);
                textsToTranslate.push(esVal);
            }
        }
        
        if (missingKeys.length === 0) continue;
        
        console.log(`Translating ${missingKeys.length} keys for ${lang}...`);
        
        const batchStr = textsToTranslate.join('\n');
        
        try {
            const res = await translate(batchStr, {from: 'es', to: googleLang});
            const translatedLines = res.text.split('\n');
            
            if (translatedLines.length === missingKeys.length) {
                for (let i = 0; i < missingKeys.length; i++) {
                    translations[lang][missingKeys[i]] = translatedLines[i].trim();
                    totalTranslated++;
                }
                console.log(`Successfully translated batch for ${lang}`);
            } else {
                console.log(`Line mismatch for ${lang}, skipping batch.`);
                // Could implement individual fallback here if needed
            }
        } catch (e) {
            console.error(`Failed to translate for ${lang}:`, e.message);
        }
        
        // Wait 2 seconds between requests to avoid rate limits
        await delay(2000);
    }
    
    if (totalTranslated > 0) {
        const newStr = JSON.stringify(translations, null, 4);
        const newConfigJs = js.replace(match[1], newStr);
        fs.writeFileSync(jsPath, newConfigJs);
        console.log(`Done! Translated and saved ${totalTranslated} items.`);
    } else {
        console.log('No missing translations found.');
    }
}

main();
