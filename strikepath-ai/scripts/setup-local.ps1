$ErrorActionPreference = "Stop"
Write-Host "Starting StrikePath AI with Docker..." -ForegroundColor Cyan

docker version | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Docker Desktop is not running or Docker is not installed."
}

docker compose up --build
