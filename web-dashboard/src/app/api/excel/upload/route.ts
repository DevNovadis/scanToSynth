import { NextRequest, NextResponse } from "next/server"
import ExcelJS from "exceljs"
import { mergeMachines, saveImportInfo, deleteInventory } from "@/lib/excel-store"

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData()
        const file = formData.get("file") as File
        if (!file) return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 })

        const arrayBuffer = await file.arrayBuffer()

        // Lire le fichier importé avec ExcelJS
        const uploadedWorkbook = new ExcelJS.Workbook()
        await uploadedWorkbook.xlsx.load(arrayBuffer as any)
        const uploadedSheet = uploadedWorkbook.getWorksheet("Serveurs et postes clients") || uploadedWorkbook.worksheets[0]

        // Construire les données machines
        const machinesData = []
        let mergedCount = 0

        for (let c = 2; c <= 250; c++) {
            const nameValue = uploadedSheet.getCell(1, c).text
            if (!nameValue || nameValue.trim() === "") continue

            const machineName = nameValue.trim()
            const valeurs = []

            for (let r = 1; r <= 150; r++) {
                const v = uploadedSheet.getCell(r, c).value
                valeurs.push(v !== undefined ? v : null)
            }

            machinesData.push({ NOM: machineName, VALEURS: valeurs })
            mergedCount++
        }

        if (machinesData.length === 0) {
            return NextResponse.json({ success: true, count: 0 })
        }

        // Merge via pure JS (plus de PowerShell)
        await mergeMachines(machinesData)
        await saveImportInfo({ filename: file.name, date: new Date().toISOString() })

        return NextResponse.json({ success: true, count: mergedCount })
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
