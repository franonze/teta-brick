# Establecer JAVA_HOME localmente por seguridad
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"

# Ejecutar script de traducción automática
Write-Host "Comprobando traducciones faltantes..." -ForegroundColor Cyan
node update_translations.js

# Cerrar procesos de Java previos para evitar bloqueos
Write-Host "Cerrando procesos de Java..." -ForegroundColor Cyan
Stop-Process -Name "java", "javaw" -Force -ErrorAction SilentlyContinue

# Sincronizar Capacitor
Write-Host "`nSincronizando Capacitor (npx cap sync)..." -ForegroundColor Cyan
npx cap sync

if ($LASTEXITCODE -ne 0) {
    Write-Host "`nError al sincronizar Capacitor. Abortando compilación." -ForegroundColor Red
    exit $LASTEXITCODE
}

# Compilar APK y AAB de Release
Write-Host "`nCompilando APK en modo Release..." -ForegroundColor Cyan
Push-Location android
.\gradlew assembleRelease
$BuildApkSuccess = $?

Write-Host "`nCompilando App Bundle (AAB) en modo Release para Google Play..." -ForegroundColor Cyan
.\gradlew bundleRelease
$BuildBundleSuccess = $?
Pop-Location

if ($BuildApkSuccess -and $BuildBundleSuccess) {
    $ApkPath = Join-Path (Get-Location) "android\app\build\outputs\apk\release"
    $AabPath = Join-Path (Get-Location) "android\app\build\outputs\bundle\release"
    
    Write-Host "`n========================================================" -ForegroundColor Green
    Write-Host " Compilación de Release completada con éxito." -ForegroundColor Green
    Write-Host " Los archivos generados se encuentran en las siguientes rutas:" -ForegroundColor Green
    Write-Host "`n [APK]: $ApkPath" -ForegroundColor Black -BackgroundColor Cyan
    Write-Host " [AAB]: $AabPath" -ForegroundColor Black -BackgroundColor Cyan
    Write-Host "========================================================`n" -ForegroundColor Green

    $ReleaseApkFile = Join-Path $ApkPath "app-release.apk"
    Write-Host "Instalando APK de Release en el dispositivo conectado..." -ForegroundColor Cyan
    $AdbCmd = "adb"
    if (-not (Get-Command adb -ErrorAction SilentlyContinue)) {
        $AdbCmd = if ($env:ANDROID_HOME) { Join-Path $env:ANDROID_HOME "platform-tools\adb.exe" } else { Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe" }
    }
    & $AdbCmd install -r $ReleaseApkFile
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Aplicación instalada correctamente en el dispositivo." -ForegroundColor Green
    } else {
        Write-Host "Atención: No se pudo instalar la aplicación. Asegúrate de tener un dispositivo conectado por USB o un emulador abierto." -ForegroundColor Yellow
    }
} else {
    Write-Host "`nHubo un error durante la compilación de Release con Gradle." -ForegroundColor Red
}
