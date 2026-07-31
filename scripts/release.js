const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Parse args
const args = process.argv.slice(2);
if (args.length < 1) {
    console.error('Usage: npm run release <new_version> (e.g. npm run release 1.1)');
    process.exit(1);
}

const newVersion = args[0];
console.log(`🚀 Starting release process for version: ${newVersion}`);

try {
    // 1. Update package.json
    const packageJsonPath = path.resolve(__dirname, '../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    packageJson.version = newVersion;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    console.log('✅ Updated package.json');

    // 2. Update android/app/build.gradle
    const buildGradlePath = path.resolve(__dirname, '../android/app/build.gradle');
    let buildGradle = fs.readFileSync(buildGradlePath, 'utf8');
    
    // Increment versionCode by 1
    const versionCodeMatch = buildGradle.match(/versionCode\s+(\d+)/);
    if (!versionCodeMatch) throw new Error("Could not find versionCode in build.gradle");
    const newVersionCode = parseInt(versionCodeMatch[1], 10) + 1;
    
    buildGradle = buildGradle.replace(/versionCode\s+\d+/, `versionCode ${newVersionCode}`);
    buildGradle = buildGradle.replace(/versionName\s+"[^"]+"/, `versionName "${newVersion}"`);
    
    fs.writeFileSync(buildGradlePath, buildGradle);
    console.log(`✅ Updated build.gradle (versionName: ${newVersion}, versionCode: ${newVersionCode})`);

    // 3. Sync capacitor
    console.log('🔄 Syncing Android project...');
    execSync('npx cap sync android', { stdio: 'inherit' });

    // 4. Set JAVA_HOME if not set (fallback for this specific Windows environment)
    const env = Object.assign({}, process.env);
    if (!env.JAVA_HOME) {
        const fallbackJavaHome = "C:\\Program Files\\Android\\Android Studio\\jbr";
        if (fs.existsSync(fallbackJavaHome)) {
            env.JAVA_HOME = fallbackJavaHome;
            console.log(`⚙️  JAVA_HOME not set. Using fallback: ${fallbackJavaHome}`);
        }
    }

    // 5. Build Release Bundle
    console.log('🔨 Building Android App Bundle (Release)... This will take a moment.');
    const androidDir = path.resolve(__dirname, '../android');
    const gradlewCmd = process.platform === 'win32' ? '.\\gradlew.bat' : './gradlew';
    
    execSync(`${gradlewCmd} clean bundleRelease`, { cwd: androidDir, env, stdio: 'inherit' });

    // 6. Copy AAB to releases folder
    const aabSource = path.resolve(__dirname, '../android/app/build/outputs/bundle/release/app-release.aab');
    const releasesDir = path.resolve(__dirname, '../releases');
    
    if (!fs.existsSync(releasesDir)) {
        fs.mkdirSync(releasesDir);
    }

    const aabDest = path.join(releasesDir, `teta-brick-release-${newVersion}.aab`);
    fs.copyFileSync(aabSource, aabDest);
    console.log(`🎉 Success! Release created at: releases/teta-brick-release-${newVersion}.aab`);

} catch (error) {
    console.error('❌ Error during release process:', error.message);
    process.exit(1);
}
