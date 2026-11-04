"use server"

import { getWorkbook, findSheet, deleteMachineColumns } from "@/lib/excel-store"
import { requireAuth } from "@/lib/auth"
import { isValidColumnIds } from "@/lib/validation"
import { revalidatePath, unstable_noStore as noStore } from "next/cache"
import path from "path"
import fs from "fs"
import { spawn } from "child_process"
import { createHash } from "crypto"

export async function getMachines() {
    noStore() // Force fresh data on every call — no Next.js caching
    await requireAuth()
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

const SCAN_ACTIONS = ["Local", "AD", "IPRange", "Target"] as const

export async function triggerScan(action: typeof SCAN_ACTIONS[number], target?: string) {
    await requireAuth()

    if (!SCAN_ACTIONS.includes(action)) {
        throw new Error("Action de scan invalide.")
    }
    if (target !== undefined && (typeof target !== "string" || target.length > 253)) {
        throw new Error("Cible invalide.")
    }
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

        // La clé passe par l'environnement (lu par le script via $env:NOVADIS_SCAN_API_KEY)
        // pour ne pas apparaître dans la ligne de commande du processus
        const env = { ...process.env }
        if (process.env.SCAN_API_KEY) env.NOVADIS_SCAN_API_KEY = process.env.SCAN_API_KEY

        const ps = spawn("powershell.exe", args, { env })

        ps.stdout.on("data", (data: any) => console.log(`PS: ${data}`))
        ps.stderr.on("data", (data: any) => console.error(`PS Error: ${data}`))

        ps.on("close", (code: number) => {
            if (code === 0) resolve({ success: true })
            else reject(new Error(`Processus PowerShell terminé avec le code ${code}`))
        })
    })
}

export async function deleteMachines(ids: number[]) {
    await requireAuth()

    if (!isValidColumnIds(ids)) {
        return { success: false, error: "Sélection invalide" }
    }

    try {
        await deleteMachineColumns(ids)
        revalidatePath("/")
        return { success: true }
    } catch (error: any) {
        console.error("Error deleting machines:", error)
        return { success: false, error: "Erreur lors de la suppression" }
    }
}

// Script de l'agent figé sur le commit déployé et vérifié par hash avant exécution :
// un push ultérieur sur master ne change pas le code exécuté sur les machines scannées.
let agentScriptHash: string | null = null
function getAgentScriptHash(): string {
    if (!agentScriptHash) {
        // Hash du contenu tel que stocké dans git (LF), servi à l'identique par raw.githubusercontent
        const content = fs.readFileSync(path.join(process.cwd(), "scan-to-cloud.ps1"), "utf8").replace(/\r\n/g, "\n")
        agentScriptHash = createHash("sha256").update(content).digest("hex").toUpperCase()
    }
    return agentScriptHash
}

// Commande d'installation de l'agent, avec la clé API injectée côté serveur.
// Accessible uniquement derrière l'authentification du dashboard (voir src/proxy.ts).
export async function getAgentConfig() {
    await requireAuth()
    const apiKey = process.env.SCAN_API_KEY || ""
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://scan-to-synth.vercel.app"
    const apiUrl = `${appUrl.replace(/\/$/, "")}/api/scan/submit`
    const repo = process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_SLUG
        ? `${process.env.VERCEL_GIT_REPO_OWNER}/${process.env.VERCEL_GIT_REPO_SLUG}`
        : "DevNovadis/scanToSynth"
    // Hors déploiement git Vercel (dev local), repli sur master : le contrôle de hash
    // échoue alors si master diffère du script local, ce qui reste sûr
    const ref = process.env.VERCEL_GIT_COMMIT_SHA || process.env.AGENT_SCRIPT_REF || "master"
    const scriptUrl = `https://raw.githubusercontent.com/${repo}/${ref}/web-dashboard/scan-to-cloud.ps1`
    const hash = getAgentScriptHash()
    const scanCommand = `powershell -ExecutionPolicy Bypass -Command "& { $f = Join-Path $env:TEMP 'scan.ps1'; irm '${scriptUrl}' -OutFile $f; if ((Get-FileHash $f -Algorithm SHA256).Hash -ne '${hash}') { Remove-Item $f; throw 'Script agent altere : hash invalide' }; & $f -ApiUrl '${apiUrl}' -ApiKey '${apiKey}' }"`
    return { apiKey, apiUrl, scanCommand }
}
