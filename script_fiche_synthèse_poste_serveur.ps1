<#
.SYNOPSIS
    Script d'inventaire matériel et logiciel pour un poste local ou l'ensemble du réseau (postes CLT/SRV).
.DESCRIPTION
    Ce script récupère les informations système, CPU, RAM, Disques et Réseau,
    et exporte les résultats dans un fichier Excel (.xlsx) en suivant exactement le style du modèle.
#>

param(
    [string]$OutputFile = "$PSScriptRoot\Inventaire_Parc.xlsx"
)

Function Get-MachineInfo {
    param([string]$ComputerName = "localhost")
    try {
        $cimParams = @{ ErrorAction = 'Stop'; ConnectionOptions = (New-CimSessionOption -Protocol Dcom) }
        # Note: Dcom is often needed for older systems or specific firewall configs, but standard Cim (WSMan) is default.
        # Removing explicit Dcom to let Cim decide, or keep it if previous tests showed it was necessary.
        # Actually, let's use standard Cim and only fallback if needed.
        $cimParams = @{ ErrorAction = 'Stop'; OperationTimeoutSec = 5 }
        
        if ($ComputerName -ne "localhost" -and $ComputerName -ne $env:COMPUTERNAME) {
            $cimParams.ComputerName = $ComputerName
        }

        $ComputerSystem = Get-CimInstance Win32_ComputerSystem @cimParams
        $BIOS = Get-CimInstance Win32_BIOS @cimParams
        $OS = Get-CimInstance Win32_OperatingSystem @cimParams
        
        $TimeConfigStr = "N/A"
        if ($ComputerName -eq "localhost" -or $ComputerName -eq $env:COMPUTERNAME) {
            $TimeConfig = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\W32Time\Parameters" -ErrorAction SilentlyContinue
            if ($TimeConfig.NtpServer) { $TimeConfigStr = $TimeConfig.NtpServer }
        }
        
        $CPUs = Get-CimInstance Win32_Processor @cimParams
        $CPU_Details = @()
        foreach ($cpu in $CPUs) {
            $CPU_Details += "$($cpu.Name) (Cœurs: $($cpu.NumberOfCores))"
        }

        $GPUs = Get-CimInstance Win32_VideoController @cimParams
        $GPU_Details = @()
        foreach ($gpu in $GPUs) {
            $GPU_Details += $gpu.Name
        }

        $Disks = Get-CimInstance Win32_DiskDrive @cimParams
        $Disk_Refs = @()
        foreach ($disk in $Disks) {
            $SizeGB = [math]::Round($disk.Size / 1GB, 2)
            $Disk_Refs += "$($disk.Model) - $SizeGB Go - SN: $($disk.SerialNumber)"
        }

        $LogicalDisks = Get-CimInstance Win32_LogicalDisk @cimParams | Where-Object { $_.DriveType -eq 3 }
        $Vol_List = @()
        foreach ($vol in $LogicalDisks) {
            $SizeGB = [math]::Round($vol.Size / 1GB, 2)
            $Vol_List += "$($vol.DeviceID) ($SizeGB Go)"
        }

        $NetAdapters = Get-CimInstance Win32_NetworkAdapterConfiguration @cimParams | Where-Object { $_.IPEnabled -eq $true }
        $Net_Info = @()
        foreach ($nic in $NetAdapters) {
            $info = @{
                Nom        = $nic.Description
                MAC        = $nic.MACAddress
                IP         = $nic.IPAddress[0]
                Masque     = $nic.IPSubnet[0]
                Passerelle = if ($nic.DefaultIPGateway) { $nic.DefaultIPGateway[0] } else { "" }
            }
            $Net_Info += $info
        }

        $Resultat = [PSCustomObject]@{
            NOM            = $ComputerSystem.Name
            GROUPE_DOMAINE = if ($ComputerSystem.PartofDomain) { $ComputerSystem.Domain } else { $ComputerSystem.Workgroup }
            FABRICANT      = $ComputerSystem.Manufacturer
            MODELE         = $ComputerSystem.Model
            SERVICE_TAG    = $BIOS.SerialNumber
            SERVEUR_NTP    = $TimeConfigStr
            OS             = $OS.Caption
            TYPE_SYSTEM    = $ComputerSystem.SystemType
            RAM            = "$([math]::Round($ComputerSystem.TotalPhysicalMemory / 1GB, 0)) Go"
            CPU1           = if ($CPU_Details[0]) { $CPU_Details[0] } else { "N/A" }
            CPU2           = if ($CPU_Details[1]) { $CPU_Details[1] } else { "" }
            GPU1           = if ($GPU_Details[0]) { $GPU_Details[0] } else { "N/A" }
            GPU2           = if ($GPU_Details[1]) { $GPU_Details[1] } else { "" }
            VOLUMES        = $Vol_List
            DISQUES        = $Disk_Refs
            RESEAU         = $Net_Info
        }
        
        return $Resultat
    }
    catch {
        Write-Warning "Impossible de lire les infos de $ComputerName : $_"
        return $null
    }
}

Function Write-ToExcel {
    param (
        [string]$FilePath,
        [PSCustomObject]$MachineInfo
    )
    
    if (-not $MachineInfo) { return }

    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false

    try {
        if (-not (Test-Path $FilePath)) {
            $modelFile = Get-ChildItem -Path $PSScriptRoot -Filter "Mod*" | Select-Object -ExpandProperty FullName -First 1
            if ($modelFile) {
                Write-Host "Initialisation à partir du modèle : $modelFile" -ForegroundColor Yellow
                Unblock-File $modelFile -ErrorAction SilentlyContinue
                Copy-Item $modelFile $FilePath
                Unblock-File $FilePath -ErrorAction SilentlyContinue
            }
            else {
                Write-Error "Modèle non trouvé. Impossible de continuer."
                return
            }
        }
        else {
            Unblock-File $FilePath -ErrorAction SilentlyContinue
        }

        $workbook = $excel.Workbooks.Open($FilePath)
        
        if ($excel.ProtectedViewWindows.Count -gt 0) {
            try {
                $pvw = $excel.ProtectedViewWindows.Item(1)
                $workbook = $pvw.Edit()
            }
            catch {
                $workbook = $excel.ActiveWorkbook
            }
        }

        $sheet = $null
        foreach ($s in $workbook.Sheets) {
            if ($s.Name -like "*Serveurs et postes clients*") {
                $sheet = $s
                break
            }
        }
        
        if ($null -eq $sheet) {
            Write-Warning "Onglet 'Serveurs et postes clients' non trouvé, utilisation du premier onglet."
            $sheet = $workbook.Sheets.Item(1)
        }
        
        # $sheet.Activate() # Pas strictement nécessaire en mode invisible
        
        $machineName = $MachineInfo.NOM
        $lastCol = $sheet.UsedRange.Columns.Count
        if ($lastCol -lt 1) { $lastCol = 1 }

        $targetCol = 0
        for ($c = 2; $c -le $lastCol + 10; $c++) {
            $val = $sheet.Cells.Item(1, $c).Text
            if ($val -eq $machineName) {
                $targetCol = $c
                break
            }
            if (-not $val -or $val.Trim() -eq "") {
                $targetCol = $c
                break
            }
        }
        
        if ($targetCol -eq 0) { $targetCol = 2 }

        Write-Host "Écriture pour $machineName dans la colonne $targetCol" -ForegroundColor Green

        $sheet.Cells.Item(1, $targetCol).Value2 = $MachineInfo.NOM
        $sheet.Cells.Item(3, $targetCol).Value2 = $MachineInfo.GROUPE_DOMAINE
        $sheet.Cells.Item(4, $targetCol).Value2 = $MachineInfo.FABRICANT
        $sheet.Cells.Item(5, $targetCol).Value2 = $MachineInfo.MODELE
        $sheet.Cells.Item(8, $targetCol).Value2 = $MachineInfo.SERVEUR_NTP
        $sheet.Cells.Item(9, $targetCol).Value2 = $MachineInfo.SERVICE_TAG
        $sheet.Cells.Item(11, $targetCol).Value2 = $MachineInfo.OS
        $sheet.Cells.Item(12, $targetCol).Value2 = $MachineInfo.TYPE_SYSTEM
        $sheet.Cells.Item(13, $targetCol).Value2 = $MachineInfo.CPU1
        $sheet.Cells.Item(14, $targetCol).Value2 = $MachineInfo.CPU2
        $sheet.Cells.Item(15, $targetCol).Value2 = $MachineInfo.RAM
        $sheet.Cells.Item(16, $targetCol).Value2 = $MachineInfo.GPU1
        $sheet.Cells.Item(17, $targetCol).Value2 = $MachineInfo.GPU2

        if ($MachineInfo.VOLUMES.Count -ge 1) { $sheet.Cells.Item(19, $targetCol).Value2 = $MachineInfo.VOLUMES[0] }
        if ($MachineInfo.VOLUMES.Count -ge 2) { $sheet.Cells.Item(21, $targetCol).Value2 = $MachineInfo.VOLUMES[1] }

        for ($i = 0; $i -lt $MachineInfo.DISQUES.Count -and $i -lt 14; $i++) {
            $sheet.Cells.Item(23 + $i, $targetCol).Value2 = $MachineInfo.DISQUES[$i]
        }

        for ($i = 0; $i -lt $MachineInfo.RESEAU.Count -and $i -lt 4; $i++) {
            $startRow = 43 + ($i * 6)
            $nic = $MachineInfo.RESEAU[$i]
            $sheet.Cells.Item($startRow, $targetCol).Value2 = $nic.Nom
            $sheet.Cells.Item($startRow + 2, $targetCol).Value2 = $nic.MAC
            $sheet.Cells.Item($startRow + 3, $targetCol).Value2 = $nic.IP
            $sheet.Cells.Item($startRow + 4, $targetCol).Value2 = $nic.Masque
            $sheet.Cells.Item($startRow + 5, $targetCol).Value2 = $nic.Passerelle
        }

        $sheet.Columns.Item($targetCol).AutoFit() | Out-Null
        $workbook.Save()
    }
    catch {
        Write-Error "Erreur lors de l'écriture Excel : $_"
    }
    finally {
        if ($workbook) { $workbook.Close() }
        $excel.Quit()
        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excel) | Out-Null
        [System.GC]::Collect()
        [System.GC]::WaitForPendingFinalizers()
    }
}

Function Get-ComputersFromAD {
    Write-Host "Recherche des machines CLT* et SRV* dans l'Active Directory..." -ForegroundColor Cyan
    try {
        $searcher = [adsisearcher]"(|(name=CLT*)(name=SRV*))"
        $searcher.PropertiesToLoad.Add("name") | Out-Null
        $searcher.SizeLimit = 0
        $results = $searcher.FindAll()
        $computers = $results | ForEach-Object { $_.Properties.name }
        return $computers
    }
    catch {
        Write-Warning "Impossible de contacter l'Active Directory. Êtes-vous sur un domaine?"
        return @()
    }
}

Function Get-ComputersByIPRange {
    $ranges = @(
        @{ Base = "192.168.200."; Start = 10; End = 255 },
        @{ Base = "192.168.201."; Start = 10; End = 255 }
    )
    
    $reachableIPs = @()
    Write-Host "Scan des plages IP (192.168.200.10-255 et 192.168.201.10-255)..." -ForegroundColor Cyan
    Write-Host "Ceci peut prendre quelques minutes. Test de réponse (Ping)..." -ForegroundColor Yellow

    foreach ($range in $ranges) {
        for ($i = $range.Start; $i -le $range.End; $i++) {
            $ip = $range.Base + $i
            if (Test-Connection -ComputerName $ip -Count 1 -Quiet -ErrorAction SilentlyContinue) {
                Write-Host "[+] $ip répond" -ForegroundColor Green
                $reachableIPs += $ip
            }
        }
    }
    return $reachableIPs
}

# --- MENU PRINCIPAL ---
do {
    Clear-Host
    Write-Host "======================================================" -ForegroundColor Cyan
    Write-Host "      Outil d'Inventaire Matériel & Logiciel          " -ForegroundColor Cyan
    Write-Host "======================================================" -ForegroundColor Cyan
    Write-Host "1. Scanner l'ordinateur local"
    Write-Host "2. Scanner le réseau via Active Directory (CLT* / SRV*)"
    Write-Host "3. Scanner le réseau via Plages IP (192.168.200.x / 201.x)"
    Write-Host "4. Scanner un ordinateur spécifique (Nom ou IP)"
    Write-Host "5. Quitter"
    Write-Host "======================================================" -ForegroundColor Cyan
    
    $choice = Read-Host "Choisissez une option (1-5)"
    
    switch ($choice) {
        "1" {
            Write-Host "`n--- Scan du poste local ---" -ForegroundColor Green
            $info = Get-MachineInfo -ComputerName "localhost"
            if ($info) {
                Write-ToExcel -FilePath $OutputFile -MachineInfo $info
                Write-Host "Fini ! Consultez $OutputFile" -ForegroundColor Green
            }
            pause
        }
        "2" {
            Write-Host "`n--- Scan via Active Directory ---" -ForegroundColor Green
            $machines = Get-ComputersFromAD
            if ($machines.Count -gt 0) {
                Write-Host "$($machines.Count) machines trouvées dans l'AD." -ForegroundColor Yellow
                foreach ($comp in $machines) {
                    Write-Host "Tentative sur $comp..." -ForegroundColor Cyan
                    $info = Get-MachineInfo -ComputerName $comp
                    if ($info) {
                        Write-ToExcel -FilePath $OutputFile -MachineInfo $info
                    }
                }
                Write-Host "Scan AD terminé !" -ForegroundColor Green
            }
            else {
                Write-Host "Aucune machine trouvée dans l'AD." -ForegroundColor Red
            }
            pause
        }
        "3" {
            Write-Host "`n--- Scan via Plages IP ---" -ForegroundColor Green
            $ips = Get-ComputersByIPRange
            if ($ips.Count -gt 0) {
                Write-Host "$($ips.Count) adresses répondent au ping. Récupération des infos..." -ForegroundColor Yellow
                foreach ($ip in $ips) {
                    Write-Host "Tentative sur $ip..." -ForegroundColor Cyan
                    $info = Get-MachineInfo -ComputerName $ip
                    if ($info) {
                        # Optionnel : Filtrer si le nom ne commence pas par CLT ou SRV ? 
                        # L'utilisateur a demandé de repérer CLT/SRV, mais ici on scanne des plages précises.
                        # On va tout garder, le nom s'affichera dans l'Excel.
                        Write-ToExcel -FilePath $OutputFile -MachineInfo $info
                    }
                }
                Write-Host "Scan des plages IP terminé !" -ForegroundColor Green
            }
            else {
                Write-Host "Aucune machine n'a répondu dans ces plages IP." -ForegroundColor Red
            }
            pause
        }
        "4" {
            $comp = Read-Host "`nEntrez le nom ou l'IP de l'ordinateur"
            Write-Host "Scanner $comp..." -ForegroundColor Cyan
            $info = Get-MachineInfo -ComputerName $comp
            if ($info) {
                Write-ToExcel -FilePath $OutputFile -MachineInfo $info
                Write-Host "Fini !" -ForegroundColor Green
            }
            pause
        }
        "5" {
            Write-Host "Fermeture..." -ForegroundColor Yellow
            break
        }
    }
} while ($choice -ne "5")
