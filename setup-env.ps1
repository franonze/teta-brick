$JavaHomePath = "C:\Program Files\Android\Android Studio\jbr"
$JavaBinPath = "$JavaHomePath\bin"

# Configurar JAVA_HOME de forma permanente para el usuario
[Environment]::SetEnvironmentVariable("JAVA_HOME", $JavaHomePath, "User")
Write-Host "Configurada la variable de entorno JAVA_HOME a: $JavaHomePath" -ForegroundColor Green

# Configurar PATH de forma permanente para el usuario si no existe
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($UserPath -notlike "*$JavaBinPath*") {
    $NewPath = "$UserPath;$JavaBinPath"
    [Environment]::SetEnvironmentVariable("Path", $NewPath, "User")
    Write-Host "Directorio bin de Java añadido al PATH del usuario." -ForegroundColor Green
} else {
    Write-Host "El directorio bin de Java ya estaba en el PATH del usuario." -ForegroundColor Yellow
}

# Configurar Git
git config --global core.autocrlf true
Write-Host "Configurado Git (core.autocrlf = true)." -ForegroundColor Green

Write-Host "`nEl entorno está listo. Por favor, reinicia tu terminal para que los cambios en el PATH surtan efecto." -ForegroundColor Cyan
