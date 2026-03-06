import { NextRequest, NextResponse } from "next/server"
import path from "path"
import fs from "fs"
import { spawn } from "child_process"
import ExcelJS from "exceljs"

function getImportInfoPath() {
    return path.join(process.cwd(), "..", "import_info.json")
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData()
        const file = formData.get("file") as File
        if (!file) return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 })

        const arrayBuffer = await file.arrayBuffer()
        const rootPath = path.join(process.cwd(), "..")
        const filePath = path.join(rootPath, "Inventaire_Parc.xlsx")
        const modelPath = path.join(rootPath, "Modèle_fiche_synthèse.xlsx")

        // Lire le fichier importé avec ExcelJS car on a juste besoin des valeurs brutes (lecture = safe)
        const uploadedWorkbook = new ExcelJS.Workbook()
        await uploadedWorkbook.xlsx.load(arrayBuffer as any)
        const uploadedSheet = uploadedWorkbook.getWorksheet("Serveurs et postes clients") || uploadedWorkbook.worksheets[0]

        // Construire les données pour passer au script PowerShell
        const machinesData = []
        let mergedCount = 0

        for (let c = 2; c <= 250; c++) {
            const nameValue = uploadedSheet.getCell(1, c).text
            if (!nameValue || nameValue.trim() === "") continue

            const machineName = nameValue.trim()
            const valeurs = []

            // Récupérer toutes les valeurs de la ligne 1 à 150
            for (let r = 1; r <= 150; r++) {
                if (r === 2) {
                    valeurs.push(null) // Ligne "Status Scan", on force "non scanné"
                } else {
                    const v = uploadedSheet.getCell(r, c).value
                    valeurs.push(v !== undefined ? v : null)
                }
            }

            machinesData.push({
                NOM: machineName,
                VALEURS: valeurs
            })
            mergedCount++
        }

        if (machinesData.length === 0) {
            return NextResponse.json({ success: true, count: 0 })
        }

        // Sauvegarder les données dans un JSON temporaire
        const tempJsonPath = path.join(process.cwd(), `import_data_${Date.now()}.json`)
        fs.writeFileSync(tempJsonPath, JSON.stringify(machinesData, null, 2))

        // Exécuter le script PowerShell COM
        const scriptPath = path.join(process.cwd(), "MergeExcel.ps1")
        const psOptions = [
            "-NoProfile",
            "-ExecutionPolicy", "Bypass",
            "-File", scriptPath,
            "-InventairePath", filePath,
            "-ModelPath", modelPath,
            "-DataJsonPath", tempJsonPath,
            "-IsImport"
        ]

        const psErrors: string[] = []
        await new Promise((resolve, reject) => {
            const ps = spawn("powershell.exe", psOptions)
            ps.stdout.on("data", (data) => console.log(`[Upload Excel COM] ${data}`))
            ps.stderr.on("data", (data) => {
                const err = data.toString()
                console.error(`[Upload Excel Error] ${err}`)
                psErrors.push(err)
            })
            ps.on("close", (code) => {
                try { fs.unlinkSync(tempJsonPath) } catch { }
                if (code === 0) resolve(true)
                else reject(new Error("Erreur COM PowerShell: " + psErrors.join("\n")))
            })
        })

        fs.writeFileSync(getImportInfoPath(), JSON.stringify({ filename: file.name, date: new Date().toISOString() }))

        return NextResponse.json({ success: true, count: mergedCount })
    } catch (e: any) {
        console.error("Erreur Import Excel:", e)
        return NextResponse.json({ error: e.message || "Erreur interne" }, { status: 500 })
    }
}

export async function DELETE() {
    try {
        const rootPath = path.join(process.cwd(), "..")
        const filePath = path.join(rootPath, "Inventaire_Parc.xlsx")
        const infoPath = path.join(rootPath, "import_info.json")

        if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
        if (fs.existsSync(infoPath)) fs.unlinkSync(infoPath)

        return NextResponse.json({ success: true })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
