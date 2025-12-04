$sourceDir = "c:\Extensiones Creadas\Snatch WhatsApp Exporter"
$distDir = "$sourceDir\dist"
$zipFile = "$sourceDir\SnatchWhatsAppExporter_v2.1.zip"

# Clean up previous build
if (Test-Path $distDir) { Remove-Item -Recurse -Force $distDir }
if (Test-Path $zipFile) { Remove-Item -Force $zipFile }

# Create dist directory
New-Item -ItemType Directory -Force -Path $distDir | Out-Null

# Files and folders to copy
$itemsToCopy = @(
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

foreach ($item in $itemsToCopy) {
    $sourcePath = "$sourceDir\$item"
    $destPath = "$distDir\$item"
    
    if (Test-Path $sourcePath) {
        Copy-Item -Recurse -Force $sourcePath $destPath
        Write-Host "Copied: $item"
    } else {
        Write-Warning "File not found: $item"
    }
}

# Create Zip
Compress-Archive -Path "$distDir\*" -DestinationPath $zipFile

# Cleanup dist
Remove-Item -Recurse -Force $distDir

Write-Host "Extension packaged successfully: $zipFile"
