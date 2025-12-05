# Script para empaquetar la extension para Chrome Web Store
# Excluye archivos innecesarios y crea un ZIP limpio

$ErrorActionPreference = "Stop"

# Nombre del archivo ZIP de salida
$zipFileName = "snatch-whatsapp-exporter-v2.1.zip"
$sourceDir = Get-Location
$tempDir = Join-Path $env:TEMP "snatch_extension_$(Get-Date -Format 'yyyyMMddHHmmss')"

Write-Host "Empaquetando extension para Chrome Web Store..." -ForegroundColor Cyan

# Crear directorio temporal
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
Write-Host "[OK] Directorio temporal creado" -ForegroundColor Green

# Archivos y carpetas a incluir
$includeItems = @(
    "manifest.json",
    "background.js",
    "content.js",
    "content.css",
    "sidepanel.html",
    "sidepanel.js",
    "sidepanel.css",
    "i18n.js",
    "_locales",
    "favicon"
)

# Copiar archivos necesarios
Write-Host "Copiando archivos necesarios..." -ForegroundColor Yellow

foreach ($item in $includeItems) {
    $sourcePath = Join-Path $sourceDir $item
    $destPath = Join-Path $tempDir $item
    
    if (Test-Path $sourcePath) {
        if (Test-Path $sourcePath -PathType Container) {
            Copy-Item -Path $sourcePath -Destination $destPath -Recurse -Force
            Write-Host "  [OK] Carpeta: $item" -ForegroundColor Gray
        } else {
            Copy-Item -Path $sourcePath -Destination $destPath -Force
            Write-Host "  [OK] Archivo: $item" -ForegroundColor Gray
        }
    } else {
        Write-Host "  [WARN] No encontrado: $item" -ForegroundColor Yellow
    }
}

# Verificar archivos criticos
Write-Host "`nVerificando archivos criticos..." -ForegroundColor Yellow

$criticalFiles = @(
    "manifest.json",
    "background.js",
    "content.js",
    "sidepanel.html",
    "sidepanel.js",
    "i18n.js"
)

$allCriticalPresent = $true
foreach ($file in $criticalFiles) {
    $filePath = Join-Path $tempDir $file
    if (Test-Path $filePath) {
        Write-Host "  [OK] $file" -ForegroundColor Green
    } else {
        Write-Host "  [ERROR] FALTA: $file" -ForegroundColor Red
        $allCriticalPresent = $false
    }
}

if (-not $allCriticalPresent) {
    Write-Host "`n[ERROR] Faltan archivos criticos. No se puede crear el paquete." -ForegroundColor Red
    Remove-Item -Path $tempDir -Recurse -Force
    exit 1
}

# Verificar iconos
Write-Host "`nVerificando iconos..." -ForegroundColor Yellow
$iconFiles = @(
    "favicon/favicon-16x16.png",
    "favicon/favicon-32x32.png",
    "favicon/android-chrome-192x192.png",
    "favicon/android-chrome-512x512.png"
)

foreach ($icon in $iconFiles) {
    $iconPath = Join-Path $tempDir $icon
    if (Test-Path $iconPath) {
        Write-Host "  [OK] $icon" -ForegroundColor Green
    } else {
        Write-Host "  [WARN] FALTA: $icon" -ForegroundColor Yellow
    }
}

# Verificar traducciones
Write-Host "`nVerificando traducciones..." -ForegroundColor Yellow
$localesPath = Join-Path $tempDir "_locales"
if (Test-Path $localesPath) {
    $locales = Get-ChildItem -Path $localesPath -Directory
    Write-Host "  [OK] $($locales.Count) idiomas encontrados" -ForegroundColor Green
    foreach ($locale in $locales) {
        $messagesFile = Join-Path $locale.FullName "messages.json"
        if (Test-Path $messagesFile) {
            Write-Host "    [OK] $($locale.Name)" -ForegroundColor Gray
        } else {
            Write-Host "    [WARN] $($locale.Name) - falta messages.json" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "  [WARN] Carpeta _locales no encontrada" -ForegroundColor Yellow
}

# Crear ZIP
Write-Host "`nCreando archivo ZIP..." -ForegroundColor Yellow

# Eliminar ZIP anterior si existe
if (Test-Path $zipFileName) {
    Remove-Item $zipFileName -Force
    Write-Host "  [OK] ZIP anterior eliminado" -ForegroundColor Gray
}

# Crear ZIP usando .NET
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($tempDir, (Join-Path $sourceDir $zipFileName), [System.IO.Compression.CompressionLevel]::Optimal, $false)

$zipSize = (Get-Item $zipFileName).Length / 1MB
$zipSizeRounded = [math]::Round($zipSize, 2)
Write-Host "  [OK] ZIP creado: $zipFileName ($zipSizeRounded MB)" -ForegroundColor Green

# Limpiar directorio temporal
Remove-Item -Path $tempDir -Recurse -Force
Write-Host "  [OK] Directorio temporal eliminado" -ForegroundColor Gray

Write-Host "`n[SUCCESS] Paquete creado exitosamente!" -ForegroundColor Green
Write-Host "Listo para subir a Chrome Web Store: $zipFileName" -ForegroundColor Cyan
Write-Host "`nChecklist antes de subir:" -ForegroundColor Yellow
Write-Host "  [ ] Verificar que el manifest.json este correcto" -ForegroundColor White
Write-Host "  [ ] Probar la extension localmente" -ForegroundColor White
Write-Host "  [ ] Verificar que todas las traducciones funcionen" -ForegroundColor White
Write-Host "  [ ] Revisar la politica de privacidad" -ForegroundColor White
Write-Host "  [ ] Preparar capturas de pantalla" -ForegroundColor White
