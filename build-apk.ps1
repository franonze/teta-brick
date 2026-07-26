# Establecer JAVA_HOME localmente por seguridad
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"

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

# Compilar APK
Write-Host "`nCompilando APK de Android..." -ForegroundColor Cyan
Push-Location android
.\gradlew assembleDebug
$BuildSuccess = $?
Pop-Location

if ($BuildSuccess) {
    $ApkPath = Join-Path (Get-Location) "android\app\build\outputs\apk\debug\app-debug.apk"
    Write-Host "`n========================================================" -ForegroundColor Green
    Write-Host " Compilación completada con éxito." -ForegroundColor Green
    Write-Host " El APK de debug se generó correctamente en la ruta:" -ForegroundColor Green
    Write-Host " $ApkPath " -ForegroundColor Black -BackgroundColor Cyan
    Write-Host "========================================================`n" -ForegroundColor Green

    Write-Host "Instalando APK en el dispositivo conectado..." -ForegroundColor Cyan
    $AdbCmd = "adb"
    if (-not (Get-Command adb -ErrorAction SilentlyContinue)) {
        $AdbCmd = if ($env:ANDROID_HOME) { Join-Path $env:ANDROID_HOME "platform-tools\adb.exe" } else { Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe" }
    }
    & $AdbCmd install -r $ApkPath
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Aplicación instalada correctamente en el dispositivo." -ForegroundColor Green
    } else {
        Write-Host "Atención: No se pudo instalar la aplicación. Asegúrate de tener un dispositivo conectado por USB o un emulador abierto." -ForegroundColor Yellow
    }
} else {
    Write-Host "`nHubo un error durante la compilación con Gradle." -ForegroundColor Red
}
