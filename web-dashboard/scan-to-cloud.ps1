<#
.SYNOPSIS
    Scanner ce PC et envoyer les résultats vers le dashboard Novadis (Vercel).
.DESCRIPTION
    Script autonome à exécuter sur chaque machine à inventorier.
    Scanne le hardware local et envoie les données vers l'API cloud.
.USAGE
    .\scan-to-cloud.ps1
    .\scan-to-cloud.ps1 -ApiUrl "https://votre-site.vercel.app/api/scan/submit"
#>

param(
    [string]$ApiUrl = "https://scan-to-synth.vercel.app/api/scan/submit",
    [string]$ApiKey = "***CLE-REVOQUEE***"
)

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Novadis SCANNER - Scan vers Cloud" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# --- Collecte des informations systeme ---
Write-Host "[1/3] Scan du PC en cours..." -ForegroundColor Yellow

try {
    $ComputerSystem = Get-CimInstance Win32_ComputerSystem
    $BIOS = Get-CimInstance Win32_BIOS
    $OS = Get-CimInstance Win32_OperatingSystem

    $TimeConfigStr = "N/A"
    $TimeConfig = Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\W32Time\Parameters" -ErrorAction SilentlyContinue
    if ($TimeConfig.NtpServer) { $TimeConfigStr = $TimeConfig.NtpServer }

    $CPUs = Get-CimInstance Win32_Processor
    $CPU_Details = @()
    foreach ($cpu in $CPUs) {
        $CPU_Details += "$($cpu.Name) (Coeurs: $($cpu.NumberOfCores))"
    }

    $GPUs = Get-CimInstance Win32_VideoController
    $GPU_Details = @()
    foreach ($gpu in $GPUs) {
        $GPU_Details += $gpu.Name
    }

    $Disks = Get-CimInstance Win32_DiskDrive
    $Disk_Refs = @()
    foreach ($disk in $Disks) {
        $SizeGB = [math]::Round($disk.Size / 1GB, 2)
        $Disk_Refs += "$($disk.Model) - $SizeGB Go - SN: $($disk.SerialNumber)"
    }

    $LogicalDisks = Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -eq 3 }
    $Vol_List = @()
    foreach ($vol in $LogicalDisks) {
        $SizeGB = [math]::Round($vol.Size / 1GB, 2)
        $Vol_List += "$($vol.DeviceID) ($SizeGB Go)"
    }

    $NetAdapters = Get-CimInstance Win32_NetworkAdapterConfiguration | Where-Object { $_.IPEnabled -eq $true }
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

    Write-Host "  Nom     : $($ComputerSystem.Name)" -ForegroundColor White
    Write-Host "  OS      : $($OS.Caption)" -ForegroundColor White
    Write-Host "  CPU     : $($CPU_Details[0])" -ForegroundColor White
    Write-Host "  RAM     : $([math]::Round($ComputerSystem.TotalPhysicalMemory / 1GB, 0)) Go" -ForegroundColor White
    Write-Host "  Disques : $($Disk_Refs.Count)" -ForegroundColor White
    Write-Host ""
}
catch {
    Write-Host "ERREUR lors du scan : $_" -ForegroundColor Red
    Read-Host "Appuyez sur Entree pour fermer"
    exit 1
}

# --- Preparation des donnees ---
Write-Host "[2/3] Preparation des donnees..." -ForegroundColor Yellow

$body = @{
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

# --- Envoi vers le cloud ---
Write-Host "[3/3] Envoi vers $ApiUrl ..." -ForegroundColor Yellow

try {
    $json = $body | ConvertTo-Json -Depth 10
    $headers = @{
        "x-api-key"    = $ApiKey
        "Content-Type" = "application/json"
    }

    # Forcer TLS 1.2 pour les connexions HTTPS
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

    $response = Invoke-RestMethod -Uri $ApiUrl -Method Post -Body $json -Headers $headers -TimeoutSec 30

    if ($response.success) {
        Write-Host ""
        Write-Host "OK ! Machine '$($ComputerSystem.Name)' envoyee avec succes." -ForegroundColor Green
        Write-Host "Consultez le dashboard pour voir les resultats." -ForegroundColor Green
    }
    else {
        Write-Host "Reponse inattendue : $($response | ConvertTo-Json)" -ForegroundColor Yellow
    }
}
catch {
    Write-Host ""
    Write-Host "ERREUR lors de l'envoi : $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Verifiez que :" -ForegroundColor Yellow
    Write-Host "  - L'URL est correcte : $ApiUrl" -ForegroundColor Yellow
    Write-Host "  - La cle API est correcte" -ForegroundColor Yellow
    Write-Host "  - Vous avez acces a Internet" -ForegroundColor Yellow
}

Write-Host ""
Read-Host "Appuyez sur Entree pour fermer"
