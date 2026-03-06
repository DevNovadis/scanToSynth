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
            # WIPE 20 columns of model data
            for ($c = 2; $c -le 20; $c++) {
                for ($r = 1; $r -le 150; $r++) {
                    try { $sheet.Cells.Item($r, $c).Value2 = "" } catch {}
                }
            }
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

    foreach ($machine in @($data)) {
        $name = $machine.NOM
        if (-not $name) { continue }
        
        # Find column
        $targetCol = 0
        for ($c = 2; $c -le 250; $c++) {
            $v = $sheet.Cells.Item(1, $c).Text
            if ($v -eq $name) { $targetCol = $c; break }
        }
        
        if ($targetCol -eq 0) {
            for ($c = 2; $c -le 250; $c++) {
                $v = $sheet.Cells.Item(1, $c).Text
                if (-not $v -or $v.Trim() -eq "") { $targetCol = $c; break }
            }
        }
        if ($targetCol -eq 0) { $targetCol = 2 }

        # Copy Format
        if ($targetCol -gt 2) {
            $sheet.Columns.Item(2).Copy() | Out-Null
            $sheet.Columns.Item($targetCol).PasteSpecial(-4122) | Out-Null
            # $excel.CutCopyMode = $false
        }

        # Clear and Write
        for ($r = 1; $r -le 150; $r++) {
            try { $sheet.Cells.Item($r, $targetCol).Value2 = "" } catch {}
        }
        
        $r = 1
        foreach ($val in @($machine.VALEURS)) {
            if ($val -ne $null -and $val -ne "") {
                $sheet.Cells.Item($r, $targetCol).Value2 = $val
            }
            $r++
        }
        Write-Host "Wrote machine $name to column $targetCol"
    }

    $workbook.Save()
    Write-Host "SUCCESS"
}
catch {
    Write-Error "Excel Error: $_"
}
finally {
    if ($workbook) { $workbook.Close($false) }
    if ($excel) { $excel.Quit() }
}
