# cleanup.ps1
# Run from the project root:  PS C:\Users\Cedric Bides\Documents\Mangaproject> .\cleanup.ps1
# If scripts are blocked:     powershell -ExecutionPolicy Bypass -File .\cleanup.ps1

$ErrorActionPreference = 'Stop'
$root = (Get-Location).Path
$utf8 = New-Object System.Text.UTF8Encoding($false)   # UTF-8 without BOM

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Remove-Safe($path) {
  if (Test-Path $path) { Remove-Item $path -Recurse -Force; Write-Host "  deleted  $path" }
  else { Write-Host "  skipped  $path (not found)" -ForegroundColor DarkGray }
}
function Edit-File($path, [scriptblock]$change) {
  if (-not (Test-Path $path)) { Write-Host "  skipped  $path (not found)" -ForegroundColor DarkGray; return }
  $text = [IO.File]::ReadAllText((Resolve-Path $path).Path)
  $new = & $change $text
  if ($new -ne $text) {
    [IO.File]::WriteAllText((Resolve-Path $path).Path, $new, $utf8)
    Write-Host "  edited   $path"
  } else {
    Write-Host "  no change $path" -ForegroundColor DarkGray
  }
}

# ---------------------------------------------------------------- safety
Step "Creating a git branch so everything can be undone"
if (-not (Test-Path ".git")) { throw "This folder is not a git repo. Run 'git init' and commit first." }
git checkout -b cleanup
if ($LASTEXITCODE -ne 0) { throw "Could not create branch 'cleanup' (does it already exist?)" }

# ---------------------------------------------------------------- 1. dead files
Step "Deleting dead and duplicate files"
Remove-Safe "top"
Remove-Safe "CSRF_FRONTEND_INTEGRATION.md"
Remove-Safe "security-tests.http"
Remove-Safe "frontend\src\components\admin\MangaManagement.jsx"
Remove-Safe "frontend\src\pages\SearchModal.tsx"
Remove-Safe "frontend\src\pages\MyDownloads.tsx"
Remove-Safe "backend\src\models\Rating.ts"
Remove-Safe "backend\src\routes\admin.ts"

# ---------------------------------------------------------------- 2. references to deleted files
Step "Removing references to deleted files"
Edit-File "backend\src\server.ts" {
  param($t)
  $t = $t -replace "(?m)^import adminRoutes from '\./routes/admin'\r?\n", ""
  $t = $t -replace "(?m)^app\.use\('/api/admin', adminRoutes\)\r?\n", ""
  $t
}
Edit-File "frontend\src\App.tsx" {
  param($t)
  $t = $t -replace "(?m)^const MyDownloads\s+= lazy\(.*\)\r?\n", ""
  $t = $t -replace "(?m)^\s*<Route path=""/my-downloads"".*\r?\n", ""
  $t
}

# ---------------------------------------------------------------- 3. moves / renames
Step "Moving sw.js to frontend\public so Vite serves it at /sw.js"
if (Test-Path "frontend\src\public\sw.js") {
  New-Item -ItemType Directory -Force "frontend\public" | Out-Null
  git mv "frontend\src\public\sw.js" "frontend\public\sw.js"
  Edit-File "frontend\public\sw.js" {
    param($t)
    $t = $t -replace "(?m)^// frontend/public/sw\.js\r?\n// Place this file.*\r?\n\r?\n?", ""
    $t
  }
}

Step "Renaming Docker ignore files so Docker actually reads them"
if (Test-Path "backend\backend.dockerignore")   { git mv "backend\backend.dockerignore"   "backend\backend.Dockerfile.dockerignore" }
if (Test-Path "frontend\frontend.dockerignore") { git mv "frontend\frontend.dockerignore" "frontend\frontend.Dockerfile.dockerignore" }

Step "Renaming Mangalist.ts -> MangaList.ts"
if (Test-Path "backend\src\models\Mangalist.ts") {
  git mv "backend\src\models\Mangalist.ts" "backend\src\models\Mangalist_tmp.ts"
  git mv "backend\src\models\Mangalist_tmp.ts" "backend\src\models\MangaList.ts"
  Edit-File "backend\src\routes\lists.ts" { param($t) $t.Replace("'../models/Mangalist'", "'../models/MangaList'") }
}

# ---------------------------------------------------------------- 4. pushSubscription export
Step "Making pushSubscription a normal default export"
Edit-File "backend\src\routes\pushSubscription.ts" { param($t) $t.Replace("export = router", "export default router") }
Edit-File "backend\src\server.ts" {
  param($t)
  $t.Replace("import pushRoutes = require('./routes/pushSubscription')", "import pushRoutes from './routes/pushSubscription'")
}

# ---------------------------------------------------------------- 5. README fixes
Step "Fixing README claims that don't match the code"
Edit-File "README.md" {
  param($t)
  $t = $t.Replace("Starts MongoDB, backend, and frontend together with persistent storage.", "Starts the backend and frontend. MongoDB is not in the compose file, so set MONGODB_URI to Atlas or your own instance.")
  $t = $t.Replace("docker-compose.yml      Full stack: MongoDB + backend + frontend", "docker-compose.yml      Backend + frontend (bring your own MongoDB)")
  $t = $t.Replace("The first registered account becomes ``superadmin`` automatically.", "Accounts registered by email are always ``user``. The first account created through Google sign-in becomes ``admin``.")
  $t
}

# ---------------------------------------------------------------- 6. strip BOM
Step "Stripping invisible BOM characters from source files"
$bomFiles = Get-ChildItem -Recurse -File -Include *.ts,*.tsx,*.js,*.jsx,*.json,*.Dockerfile,*.md,*.conf `
  -Path "backend\src","frontend\src","frontend","backend","." -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch "node_modules|\\dist\\|package-lock" } |
  Sort-Object FullName -Unique
foreach ($f in $bomFiles) {
  $bytes = [IO.File]::ReadAllBytes($f.FullName)
  if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    [IO.File]::WriteAllBytes($f.FullName, $bytes[3..($bytes.Length - 1)])
    Write-Host "  BOM removed  $($f.FullName.Replace($root + '\', ''))"
  }
}

# ---------------------------------------------------------------- 7. dependencies
Step "Root package.json: keep only concurrently"
$rootPkg = @'
{
  "name": "mangasite",
  "version": "1.0.0",
  "scripts": {
    "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\"",
    "dev:frontend": "npm run dev --prefix frontend",
    "dev:backend": "npm run dev --prefix backend"
  },
  "devDependencies": {
    "concurrently": "^9.0.1"
  }
}
'@
[IO.File]::WriteAllText("$root\package.json", $rootPkg, $utf8)
Remove-Safe "package-lock.json"
npm install --package-lock-only

Step "Backend: removing unused packages (pino, pino-http, pino-pretty, slugify)"
Push-Location backend
npm uninstall pino pino-http pino-pretty slugify
Pop-Location

Step "Frontend: removing unused package (react-intersection-observer)"
Push-Location frontend
npm uninstall react-intersection-observer
Pop-Location

# ---------------------------------------------------------------- 8. type check
Step "Type-checking backend"
Push-Location backend
npx tsc --noEmit
$backendOk = ($LASTEXITCODE -eq 0)
Pop-Location

Step "Type-checking frontend"
Push-Location frontend
npx tsc --noEmit
$frontendOk = ($LASTEXITCODE -eq 0)
Pop-Location

# ---------------------------------------------------------------- 9. commit
Step "Committing"
git add -A
git commit -m "Clean up: remove dead files, unused deps, fix misplaced sw.js and docker ignores"

Write-Host ""
if ($backendOk -and $frontendOk) {
  Write-Host "Done. Both type-checks passed. Review with:  git show --stat" -ForegroundColor Green
} else {
  Write-Host "Done, but a type-check failed (backend ok: $backendOk, frontend ok: $frontendOk)." -ForegroundColor Yellow
  Write-Host "Some errors may already have existed before cleanup. Compare with:  git stash; git checkout main; npx tsc --noEmit" -ForegroundColor Yellow
}
Write-Host "To undo everything:  git checkout main; git branch -D cleanup"
