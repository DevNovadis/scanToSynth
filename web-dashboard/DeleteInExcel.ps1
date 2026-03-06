param(
    [string]$InventairePath,
    [int[]]$Ids
)

$ErrorActionPreference = "Stop"
$excel = $null
$workbook = $null

try {
    if (-not (Test-Path $InventairePath)) {
        Write-Error "Fichier non trouvé : $InventairePath"
        exit 1
    }

    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false

    $workbook = $excel.Workbooks.Open($InventairePath)
    
    $sheet = $null
    foreach ($sh in $workbook.Sheets) {
        if ($sh.Name -like "*Serveurs*") { $sheet = $sh; break }
    }
    
    if (-not $sheet) {
        $sheet = $workbook.Worksheets.Item(1)
    }

    foreach ($id in $Ids) {
        Write-Host "Vuidage de la colonne d'index $id"
        # Vider les 150 premières lignes (suffisant pour le dashboard)
        for ($r = 1; $r -le 150; $r++) {
            try {
                $sheet.Cells.Item($r, $id).Value2 = ""
            }
            catch {}
        }
    }

    $workbook.Save()
    Write-Host "SUCCESS"
}
catch {
    Write-Error "Excel COM Error: $_"
    exit 1
}
finally {
    if ($workbook) { $workbook.Close($true) }
    if ($excel) { $excel.Quit() }
}
