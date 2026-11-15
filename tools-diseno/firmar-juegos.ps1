# Abre el script de firma de Juegos de Colombia con Git Bash (desde PowerShell).
# La contraseña la escribe la persona en la terminal; no se guarda en el repositorio.
Set-Location (Split-Path -Parent $PSScriptRoot)
& "C:\Program Files\Git\bin\bash.exe" "tools-diseno/firmar-juegos.sh"
