$ErrorActionPreference = "Stop"

Write-Host "Testing API..." -ForegroundColor Cyan
Push-Location "$PSScriptRoot\..\apps\api"
python -m pytest
Pop-Location

Write-Host "Type-checking and building web application..." -ForegroundColor Cyan
Push-Location "$PSScriptRoot\..\apps\web"
npm ci
npm run typecheck
npm run build
Pop-Location

Write-Host "All checks passed." -ForegroundColor Green
