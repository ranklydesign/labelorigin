<#
  Keeps this folder and GitHub (ranklydesign/labelorigin, branch main) identical.
  Run it before you start working and again when you finish:

      .\sync.ps1 "what you changed"

  It pulls the latest from GitHub first, then commits and pushes anything you changed.
  Run it from this folder (the one that contains index.html). Do not run it from a parent folder.
#>
param([string]$Message = "Update site")

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$top = (git rev-parse --show-toplevel) -replace '/', '\'
if ($top -ne $PSScriptRoot) { throw "This folder is not its own git repo (git root is $top). Stop and check the setup." }

# Push as the ranklydesign account, not RhinoRobert
$active = gh auth status --active 2>&1 | Out-String
if ($active -notmatch 'ranklydesign') { gh auth switch --user ranklydesign | Out-Null }

git fetch origin
git pull --rebase --autostash origin main

if (git status --porcelain) {
    git add -A
    git commit -m $Message
} else {
    Write-Host "No local changes to commit."
}

git push origin main
Write-Host "`nIn sync with GitHub:" (git rev-parse --short HEAD)
