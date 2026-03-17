import { NextRequest, NextResponse } from "next/server"
import path from "path"
import fs from "fs"
import { spawn } from "child_process"

export async function GET() { return NextResponse.json({ status: "OK" }) }

export async function POST(req: NextRequest) {
    const apiKey = req.headers.get("x-api-key")
    if (apiKey !== process.env.SCAN_API_KEY) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    let tempJsonPath = ""
    try {
        const data = await req.json()
        const { NOM } = data

        if (!NOM) return NextResponse.json({ error: "Nom de machine manquant" }, { status: 400 })

        const rootPath = path.join(process.cwd(), "..")
        const filePath = path.join(rootPath, "Inventaire_Parc.xlsx")
        const modelPath = path.join(rootPath, "Modèle_fiche_synthèse.xlsx")

        // Construire les valeurs exactes attendues de la ligne 1 à 150
        const valeurs = new Array(150).fill(null)

        const w = (r: number, v: any) => {
            if (v !== undefined && v !== null && v !== "") valeurs[r - 1] = v
        }

        valeurs[0] = NOM // Ligne 1 (0-indexed)
        valeurs[1] = "OUI" // Ligne 2 (0-indexed) "Status Scan"
        w(3, data.GROUPE_DOMAINE); w(4, data.FABRICANT); w(5, data.MODELE)
        w(8, data.SERVEUR_NTP); w(9, data.SERVICE_TAG)
        w(11, data.OS); w(12, data.TYPE_SYSTEM)
        w(13, data.CPU1); w(14, data.CPU2); w(15, data.RAM)
        w(16, data.GPU1); w(17, data.GPU2)

        if (Array.isArray(data.VOLUMES)) {
            if (data.VOLUMES[0]) w(19, data.VOLUMES[0]); if (data.VOLUMES[1]) w(21, data.VOLUMES[1])
        }
        if (Array.isArray(data.DISQUES)) {
            data.DISQUES.forEach((d: string, i: number) => { if (i < 14) w(23 + i, d) })
        }
        if (Array.isArray(data.RESEAU)) {
            data.RESEAU.forEach((nic: any, i: number) => {
                if (i < 4) {
                    const r = 43 + (i * 6)
                    w(r, nic.Nom); w(r + 2, nic.MAC); w(r + 3, nic.IP); w(r + 4, nic.Masque); w(r + 5, nic.Passerelle)
                }
            })
        }

        const machineData = [{ NOM: NOM, VALEURS: valeurs }]

        // Créer un fichier JSON temporaire
        tempJsonPath = path.join(process.cwd(), `scan_data_${Date.now()}.json`)
        fs.writeFileSync(tempJsonPath, JSON.stringify(machineData, null, 2))

        // Appeler le script PowerShell COM
        const scriptPath = path.join(process.cwd(), "MergeExcel.ps1")
        const psOptions = [
            "-NoProfile",
            "-ExecutionPolicy", "Bypass",
            "-File", scriptPath,
            "-InventairePath", filePath,
            "-ModelPath", modelPath,
            "-DataJsonPath", tempJsonPath
        ]

        const psLogs: string[] = []
        const psErrors: string[] = []
        await new Promise((resolve, reject) => {
            const ps = spawn("powershell.exe", psOptions)
            ps.stdout.on("data", (d: any) => {
                const log = d.toString()
                console.log(`[Scan COM] ${log}`)
                psLogs.push(log)
            })
            ps.stderr.on("data", (d: any) => {
                const err = d.toString()
                console.error(`[Scan COM Err] ${err}`)
                psErrors.push(err)
            })
            ps.on("close", (code) => {
                if (code === 0) resolve(true)
                else reject(new Error("Erreur COM PowerShell: " + psErrors.join("\n")))
            })
        })

        if (fs.existsSync(tempJsonPath)) fs.unlinkSync(tempJsonPath)

        return NextResponse.json({ success: true, machine: NOM, log: psLogs.join("\n") })
    } catch (e: any) {
        if (tempJsonPath && fs.existsSync(tempJsonPath)) fs.unlinkSync(tempJsonPath)
        console.error("ERREUR scan submit:", e.message)
        return NextResponse.json({ error: e.message || "Erreur interne" }, { status: 500 })
    }
}
