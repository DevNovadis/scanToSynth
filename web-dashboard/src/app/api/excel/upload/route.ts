import { NextRequest, NextResponse } from "next/server"
import { mergeMachines, saveImportInfo, deleteInventory, type MachineData } from "@/lib/excel-store"
import { loadXlsxSafe } from "@/lib/xlsx-reader"

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData()
        const file = formData.get("file") as File
        if (!file) return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 })

        const arrayBuffer = await file.arrayBuffer()

        // Charger le fichier avec correction des dimensions (contourne le bug ExcelJS 16385)
        const uploadedWorkbook = await loadXlsxSafe(Buffer.from(arrayBuffer))
        const uploadedSheet = uploadedWorkbook.getWorksheet("Serveurs et postes clients")
            || uploadedWorkbook.worksheets.find(w => w.name?.includes("Serveurs"))
            || uploadedWorkbook.worksheets[0]

        if (!uploadedSheet) {
            return NextResponse.json({ error: "Aucune feuille trouvée dans le fichier" }, { status: 400 })
        }

        // Extraire les données machines
        const machinesData: MachineData[] = []

        for (let c = 2; c <= 250; c++) {
            const nameValue = uploadedSheet.getCell(1, c).text
            if (!nameValue || nameValue.trim() === "") continue

            const machineName = nameValue.trim()
            const valeurs: (string | number | null)[] = []

            for (let r = 1; r <= 150; r++) {
                const v = uploadedSheet.getCell(r, c).value
                valeurs.push(v !== undefined && v !== null ? v : null)
            }

            machinesData.push({ NOM: machineName, VALEURS: valeurs })
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
