"use server"

import { getWorkbook, findSheet, deleteMachineColumns, getImportInfo as _getImportInfo } from "@/lib/excel-store"
import { revalidatePath, unstable_noStore as noStore } from "next/cache"
import path from "path"
import { spawn } from "child_process"

export async function getMachines() {
    noStore() // Force fresh data on every call — no Next.js caching
    try {
        const workbook = await getWorkbook()
        const sheet = findSheet(workbook)
        if (!sheet) {
            console.log("[getMachines] No sheet found")
            return []
        }
        console.log("[getMachines] Sheet found:", sheet.name, "- worksheets:", workbook.worksheets.map(w => w.name))

        const machines = []
        for (let c = 2; c <= 200; c++) {
            const name = sheet.getRow(1).getCell(c).text?.trim()
            if (!name) continue

            console.log(`[getMachines] Col ${c}: name="${name}"`)

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
                ip: sheet.getCell(46, c).text,
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
    if (target && !/^[a-zA-Z0-9.-]+$/.test(target)) {
        throw new Error("Cible invalide : Caractères non autorisés détectés.")
    }

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
    return _getImportInfo()
}

export async function deleteMachines(ids: number[]) {
    try {
        await deleteMachineColumns(ids)
        revalidatePath("/")
        return { success: true }
    } catch (error: any) {
        console.error("Error deleting machines:", error)
        return { success: false, error: error.message || "Erreur lors de la suppression" }
    }
}
