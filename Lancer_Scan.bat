@echo off
chcp 65001 >nul
color 0B
echo Lancement de l'outil d'inventaire...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0script_fiche_synthèse_poste_serveur.ps1"
echo.
pause
