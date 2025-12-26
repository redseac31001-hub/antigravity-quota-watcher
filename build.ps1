# Antigravity Quota Watcher - Build Script
# Build and package VSCode extension

$ErrorActionPreference = "Stop"

Write-Host "======================================"
Write-Host "Antigravity Quota Watcher Build"
Write-Host "======================================"
Write-Host ""

# Check Node.js
Write-Host "[1/6] Checking Node.js..."
try {
    $nodeVersion = node --version
    Write-Host "OK Node.js version: $nodeVersion"
} catch {
    Write-Host "ERROR: Node.js not found"
    exit 1
}

# Check npm
Write-Host "[2/6] Checking npm..."
try {
    $npmVersion = npm --version
    Write-Host "OK npm version: $npmVersion"
} catch {
    Write-Host "ERROR: npm not found"
    exit 1
}

# Check dependencies
Write-Host "[3/6] Checking dependencies..."
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..."
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to install dependencies"
        exit 1
    }
}
Write-Host "OK Dependencies ready"

# Check vsce
Write-Host "[4/6] Checking vsce..."
try {
    $vsceVersion = vsce --version
    Write-Host "OK vsce version: $vsceVersion"
} catch {
    Write-Host "Installing vsce..."
    npm install -g @vscode/vsce
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to install vsce"
        exit 1
    }
    Write-Host "OK vsce installed"
}

# Compile TypeScript
Write-Host "[5/6] Compiling TypeScript..."
npm run compile
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Compilation failed"
    exit 1
}
Write-Host "OK Compilation successful"

# Package extension
Write-Host "[6/6] Packaging extension..."
vsce package
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Packaging failed"
    exit 1
}

Write-Host ""
Write-Host "======================================"
Write-Host "BUILD SUCCESS!"
Write-Host "======================================"

# Find generated .vsix file
$vsixFiles = Get-ChildItem -Path . -Filter "*.vsix" | Sort-Object LastWriteTime -Descending
if ($vsixFiles.Count -gt 0) {
    $latestVsix = $vsixFiles[0]
    Write-Host ""
    Write-Host "Package: $($latestVsix.Name)"
    Write-Host "Size: $([math]::Round($latestVsix.Length / 1KB, 2)) KB"
    Write-Host "Path: $($latestVsix.FullName)"
}
