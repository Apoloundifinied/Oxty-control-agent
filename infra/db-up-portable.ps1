# Sobe o PostgreSQL portátil (sem admin). Uso: bun run db:up:portable  (ADR 009)
$ErrorActionPreference = "Stop"
$root   = Split-Path $PSScriptRoot -Parent
$pgBase = Join-Path $root "infra\postgres"
$pgDir  = Join-Path $pgBase "pgsql"
$data   = Join-Path $pgBase "data"
$zip    = Join-Path $root "infra\pgsql.zip"

if (-not (Test-Path $pgDir)) {
  Write-Host "Extraindo PostgreSQL portátil..."
  Expand-Archive $zip $pgBase
}
$bin = Join-Path $pgDir "bin"

if (-not (Test-Path $data)) {
  Write-Host "Inicializando cluster..."
  $pwFile = [System.IO.Path]::GetTempFileName()
  Set-Content -Path $pwFile -Value "iacontrol" -NoNewline -Encoding ascii
  & "$bin\initdb.exe" -D $data -U iacontrol --pwfile=$pwFile -E UTF8 --auth=scram-sha-256 | Out-Null
  Remove-Item $pwFile -Force
  "listen_addresses = 'localhost'" | Add-Content (Join-Path $data "postgresql.conf")
}

$running = & "$bin\pg_ctl.exe" status -D $data 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "Iniciando PostgreSQL na porta 5432..."
  & "$bin\pg_ctl.exe" start -D $data -l (Join-Path $pgBase "postgres.log") -w | Out-Null
}

# cria o banco da aplicação se não existir
$env:PGPASSWORD = "iacontrol"
$dbExists = & "$bin\psql.exe" -U iacontrol -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='iacontrol'" 2>$null
if ($dbExists -ne "1") {
  & "$bin\psql.exe" -U iacontrol -d postgres -c "CREATE DATABASE iacontrol" | Out-Null
}

$env:PGPASSWORD = "iacontrol"
& "$bin\psql.exe" -U iacontrol -d iacontrol -c "SELECT version();" | Select-Object -First 1
Write-Host "✅ Postgres portátil no ar (localhost:5432, db iacontrol)"
