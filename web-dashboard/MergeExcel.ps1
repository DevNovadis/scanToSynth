param(
    [string]$InventairePath,
    [string]$ModelPath,
    [string]$DataJsonPath,
    [switch]$IsImport
)

$ErrorActionPreference = "Stop"
$excel = $null
$workbook = $null

try {
    $data = Get-Content -Raw -Path $DataJsonPath -Encoding UTF8 | ConvertFrom-Json
}
catch {
    Write-Error "JSON Error: $_"
    exit 1
}

try {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false

    if (-not (Test-Path $InventairePath)) {
        if (-not (Test-Path $ModelPath)) {
            Write-Error "Model not found."
            exit 1
        }
        Copy-Item $ModelPath $InventairePath
        $workbook = $excel.Workbooks.Open($InventairePath)
        
        # Trouver la bonne feuille
        $sheet = $null
        foreach ($sh in $workbook.Sheets) {
            if ($sh.Name -like "*Serveurs*") { $sheet = $sh; break }
        }
        
        if ($sheet) {
            # WIPE 20 columns of model data en un seul bloc
            $wipeRange = $sheet.Range($sheet.Cells.Item(1, 2), $sheet.Cells.Item(150, 21))
            $wipeRange.Value2 = $null
        }
        $workbook.Save()
    }
    else {
        $workbook = $excel.Workbooks.Open($InventairePath)
    }

    $sheet = $null
    foreach ($sh in $workbook.Sheets) {
        if ($sh.Name -like "*Serveurs*") { $sheet = $sh; break }
    }
    
    if (-not $sheet) { Write-Error "Sheet not found."; exit 1 }

    # OPTIMISATION : Lire la première ligne (noms des machines) d'un coup pour éviter les appels répétés
    # On lit de la colonne 2 à 250
    $headerRange = $sheet.Range($sheet.Cells.Item(1, 2), $sheet.Cells.Item(1, 250))
    $headers = $headerRange.Value2 # Retourne un tableau 2D [1, 249] ou $null si vide

    foreach ($machine in @($data)) {
        $name = $machine.NOM
        # Force le nom en string pour la comparaison
        $nameStr = if ($null -ne $name) { $name.ToString().Trim() } else { "" }
        if ($nameStr -eq "") { continue }
        
        # Find column dans le tableau $headers (en mémoire, ultra rapide)
        $targetCol = 0
        if ($null -ne $headers) {
            for ($i = 1; $i -le 249; $i++) {
                $v = $headers[1, $i]
                if ($null -ne $v -and $v.ToString().Trim() -eq $nameStr) { 
                    $targetCol = $i + 1 # +1 car on a commencé à la colonne 2
                    break 
                }
            }
        }
        
        # Si pas trouvé, chercher la première colonne vide
        if ($targetCol -eq 0) {
            if ($null -eq $headers) {
                $targetCol = 2 # Première colonne disponible
            }
            else {
                for ($i = 1; $i -le 249; $i++) {
                    $v = $headers[1, $i]
                    if ($null -eq $v -or $v.ToString().Trim() -eq "") {
                        $targetCol = $i + 1
                        # Mettre à jour l'en-tête en mémoire pour les suivantes
                        $headers[1, $i] = $nameStr
                        break
                    }
                }
            }
        }
        
        if ($targetCol -eq 0) { $targetCol = 2 }

        # Copy Format si nécessaire
        if ($targetCol -gt 2) {
            $sheet.Columns.Item(2).Copy() | Out-Null
            $sheet.Columns.Item($targetCol).PasteSpecial(-4122) | Out-Null
        }

        # OPTIMISATION : Préparer un tableau 2D pour l'écriture en bloc (150 lignes, 1 colonne)
        $valArray = New-Object "object[,]" 150, 1
        $r_idx = 0
        foreach ($val in @($machine.VALEURS)) {
            if ($r_idx -ge 150) { break }
            if ($null -ne $val -and $val.ToString().Trim() -ne "") {
                $valArray[$r_idx, 0] = $val
            }
            else {
                $valArray[$r_idx, 0] = $null
            }
            $r_idx++
        }

        # Écriture en une seule opération COM
        $targetRange = $sheet.Range($sheet.Cells.Item(1, $targetCol), $sheet.Cells.Item(150, $targetCol))
        $targetRange.Value2 = $valArray
        
        Write-Host "Wrote machine $nameStr to column $targetCol (Optimized)"
    }

    $workbook.Save()
    Write-Host "SUCCESS"
}
catch {
    Write-Error "Excel Error: $_"
    exit 1 # CRITIQUE : Retourner un code d'erreur pour que l'API sache que ça a échoué
}
finally {
    if ($null -ne $workbook) { $workbook.Close($false) }
    if ($null -ne $excel) { 
        $excel.Quit() 
        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
    }
}
