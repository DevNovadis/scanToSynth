import { NextRequest, NextResponse } from "next/server"
import ExcelJS from "exceljs"
import { mergeMachines, saveImportInfo, deleteInventory, type MachineData } from "@/lib/excel-store"

function extractMachinesFromSheet(sheet: ExcelJS.Worksheet): MachineData[] {
    const machinesData: MachineData[] = []

    // Utiliser sheet.getSheetValues() pour accéder aux données brutes sans déclencher de validation de colonnes
    const rows: any[][] = []
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        if (rowNumber <= 150) {
            rows[rowNumber] = []
            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                if (colNumber >= 2 && colNumber <= 250) {
                    rows[rowNumber][colNumber] = cell.value
                }
            })
        }
    })

    // Trouver les machines (noms en ligne 1)
    const row1 = rows[1] || []
    for (let c = 2; c <= 250; c++) {
        const nameValue = row1[c]
        if (!nameValue) continue
        const name = String(nameValue).trim()
        if (!name) continue

        const valeurs: (string | number | null)[] = []
        for (let r = 1; r <= 150; r++) {
            const v = rows[r]?.[c]
            valeurs.push(v !== undefined && v !== null ? v : null)
        }

        machinesData.push({ NOM: name, VALEURS: valeurs })
    }

    return machinesData
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData()
        const file = formData.get("file") as File
        if (!file) return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 })

        console.log("[Upload] Step 1: Reading uploaded file...")
        const arrayBuffer = await file.arrayBuffer()

        console.log("[Upload] Step 2: Loading with ExcelJS...")
        const uploadedWorkbook = new ExcelJS.Workbook()
        await uploadedWorkbook.xlsx.load(arrayBuffer as any)

        console.log("[Upload] Step 3: Finding sheet...")
        const uploadedSheet = uploadedWorkbook.getWorksheet("Serveurs et postes clients") || uploadedWorkbook.worksheets[0]

        if (!uploadedSheet) {
            return NextResponse.json({ error: "Aucune feuille trouvée dans le fichier" }, { status: 400 })
        }

        console.log("[Upload] Step 4: Extracting machine data safely...")
        const machinesData = extractMachinesFromSheet(uploadedSheet)
        console.log(`[Upload] Step 5: Found ${machinesData.length} machines`)

        if (machinesData.length === 0) {
            return NextResponse.json({ success: true, count: 0 })
        }

        console.log("[Upload] Step 6: Merging machines...")
        await mergeMachines(machinesData)

        console.log("[Upload] Step 7: Saving import info...")
        await saveImportInfo({ filename: file.name, date: new Date().toISOString() })

        console.log("[Upload] Done!")
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
