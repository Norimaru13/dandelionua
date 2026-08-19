@echo off
cd /d "%~dp0"
"C:\Program Files\Git\cmd\git.exe" add -A
"C:\Program Files\Git\cmd\git.exe" commit -m "Add textures and Supabase client"
"C:\Program Files\Git\cmd\git.exe" push -u origin main
pause
