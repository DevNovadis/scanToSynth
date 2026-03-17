import { NextRequest, NextResponse } from "next/server"
import { mergeMachines, saveImportInfo, deleteInventory, type MachineData } from "@/lib/excel-store"

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData()
        const file = formData.get("file") as File
        if (!file) return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 })

        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Utiliser xlsx-populate au lieu d'ExcelJS pour la lecture
        // (ExcelJS plante sur les fichiers avec des dimensions > 16384 colonnes, bug connu)
        const XlsxPopulate = require("xlsx-populate")
        const uploadedWorkbook = await XlsxPopulate.fromDataAsync(buffer)

        // Trouver la bonne feuille
        let uploadedSheet = uploadedWorkbook.sheet("Serveurs et postes clients")
        if (!uploadedSheet) uploadedSheet = uploadedWorkbook.sheet(0)

        if (!uploadedSheet) {
            return NextResponse.json({ error: "Aucune feuille trouvée dans le fichier" }, { status: 400 })
        }

        // Extraire les données machines
        const machinesData: MachineData[] = []

        for (let c = 2; c <= 250; c++) {
            const nameValue = uploadedSheet.cell(1, c).value()
            if (!nameValue) continue
            const name = String(nameValue).trim()
            if (!name) continue

            const valeurs: (string | number | null)[] = []
            for (let r = 1; r <= 150; r++) {
                const v = uploadedSheet.cell(r, c).value()
                valeurs.push(v !== undefined && v !== null ? v : null)
            }

            machinesData.push({ NOM: name, VALEURS: valeurs })
        }

        if (machinesData.length === 0) {
            return NextResponse.json({ success: true, count: 0 })
        }

        await mergeMachines(machinesData)
        await saveImportInfo({ filename: file.name, date: new Date().toISOString() })

        return NextResponse.json({ success: true, count: machinesData.length })
    } catch (e: any) {
        console.error("Erreur Import Excel:", e)
        return NextResponse.json({ error: e.message || "Erreur interne" }, { status: 500 })
    }
}

export async function DELETE() {
    try {
        await deleteInventory()
        return NextResponse.json({ success: true })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
