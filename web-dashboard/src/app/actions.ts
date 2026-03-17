"use server"

import ExcelJS from "exceljs"
import path from "path"
import fs from "fs"
import { spawn } from "child_process"

export async function getMachines() {
    const filePath = path.join(process.cwd(), "data", "Inventaire_Parc.xlsx")

    if (!fs.existsSync(filePath)) return []

    try {
        const stats = fs.statSync(filePath)
        if (stats.size === 0) return []

        const workbook = new ExcelJS.Workbook()
        await workbook.xlsx.readFile(filePath)

        // Trouver la feuille par nom (insensible à la casse et souple)
        let sheet = workbook.getWorksheet("Serveurs et postes clients")
        if (!sheet) {
            sheet = workbook.worksheets.find(w => w.name && w.name.includes("Serveurs"))
        }
        if (!sheet) sheet = workbook.worksheets[0]

        const machines = []
        for (let c = 2; c <= 200; c++) {
            const name = sheet.getRow(1).getCell(c).text?.trim()
            if (!name) continue

            // FILTRE STRICT : Uniquement les machines avec "OUI"
            const statusScan = sheet.getRow(2).getCell(c).text?.trim()
            if (statusScan !== "OUI") continue

            const disks = []
            for (let r = 23; r <= 36; r++) {
                const diskInfo = sheet.getCell(r, c).text
                if (diskInfo) disks.push(diskInfo)
            }

            machines.push({
                id: c,
                name: name,
                manufacturer: sheet.getCell(4, c).text,
                model: sheet.getCell(5, c).text,
                service_tag: sheet.getCell(9, c).text,
                os: sheet.getCell(11, c).text,
                ip: sheet.getCell(46, c).text, // Première IP trouvée
                cpu: sheet.getCell(13, c).text,
                ram: sheet.getCell(15, c).text,
                gpu: sheet.getCell(16, c).text,
                disks: disks,
                last_scan: new Date().toISOString()
            })
        }
        return machines
    } catch (error) {
        console.error("Error reading Excel for list:", error)
        return []
    }
}

export async function triggerScan(action: 'Local' | 'AD' | 'IPRange' | 'Target', target?: string) {
    // Audit Sécurité : Protection contre l'injection de commandes
    if (target && !/^[a-zA-Z0-9.-]+$/.test(target)) {
        throw new Error("Cible invalide : Caractères non autorisés détectés.")
    }

    // Optimisation Vercel : Empêcher le scan si on est sur le Cloud
    if (process.env.VERCEL) {
        throw new Error("Le scan direct n'est pas possible depuis Vercel. Utilisez un agent local.")
    }

    const scriptPath = path.join(process.cwd(), "..", "script_fiche_synthèse_poste_serveur.ps1")

    return new Promise((resolve, reject) => {
        const args = [
            "-NoProfile",
            "-ExecutionPolicy", "Bypass",
            "-File", scriptPath,
            "-SilentMode",
            "-Action", action
        ]

        if (target) {
            args.push("-Target", target)
        }

        const ps = spawn("powershell.exe", args)

        ps.stdout.on("data", (data: any) => console.log(`PS: ${data}`))
        ps.stderr.on("data", (data: any) => console.error(`PS Error: ${data}`))

        ps.on("close", (code: number) => {
            if (code === 0) resolve({ success: true })
            else reject(new Error(`Processus PowerShell terminé avec le code ${code}`))
        })
    })
}

export async function getImportInfo() {
    const p = path.join(process.cwd(), "data", "import_info.json")
    if (fs.existsSync(p)) {
        try {
            return JSON.parse(fs.readFileSync(p, "utf-8"))
        } catch { return null }
    }
    return null
}

export async function deleteMachines(ids: number[]) {
    const rootPath = path.join(process.cwd(), "data")
    const filePath = path.join(rootPath, "Inventaire_Parc.xlsx")
    const scriptPath = path.join(process.cwd(), "DeleteInExcel.ps1")

    if (!fs.existsSync(filePath)) {
        return { success: false, error: "Fichier inventaire non trouvé." }
    }

    return new Promise((resolve) => {
        const psArgs = [
            "-NoProfile",
            "-ExecutionPolicy", "Bypass",
            "-File", scriptPath,
            "-InventairePath", filePath,
            "-Ids", ids.join(",")
        ]

        const ps = spawn("powershell.exe", psArgs)
        let output = ""
        let errorOutput = ""

        ps.stdout.on("data", (data) => output += data.toString())
        ps.stderr.on("data", (data) => errorOutput += data.toString())

        ps.on("close", (code) => {
            if (code === 0 && output.includes("SUCCESS")) {
                resolve({ success: true })
            } else {
                let msg = errorOutput || output || "Erreur lors de l'exécution PowerShell"
                if (msg.includes("EBUSY") || msg.includes("permission denied")) {
                    msg = "Le fichier Excel est probablement ouvert. Fermez-le et réessayez."
                }
                resolve({ success: false, error: msg })
            }
        })
    })
}
