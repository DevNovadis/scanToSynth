import { NextResponse } from "next/server"
import ExcelJS from "exceljs"

export async function GET() {
    const results: Record<string, any> = {
        env: !!process.env.VERCEL,
        blobToken: !!process.env.BLOB_READ_WRITE_TOKEN,
    }

    // Test 1: List blobs
    try {
        const { list } = await import("@vercel/blob")
        const blobs = await list({ limit: 10 })
        results.blobs = blobs.blobs.map(b => ({
            pathname: b.pathname,
            size: b.size,
            uploadedAt: b.uploadedAt,
            hasDownloadUrl: !!b.downloadUrl,
        }))
    } catch (e: any) {
        results.blobError = e.message
    }

    // Test 2: Download and read blob raw
    try {
        const { list } = await import("@vercel/blob")
        const result = await list({ prefix: "Inventaire_Parc.xlsx", limit: 1 })
        const blob = result.blobs[0]
        if (blob) {
            const res = await fetch(blob.downloadUrl)
            const buf = Buffer.from(await res.arrayBuffer())
            results.blobDownloadSize = buf.length

            const workbook = new ExcelJS.Workbook()
            await workbook.xlsx.load(buf)
            results.rawWorksheets = workbook.worksheets.map(w => w.name)

            const sheet = workbook.worksheets[0]
            if (sheet) {
                // Dump raw cell values for first 5 cols, first 3 rows
                const rawCells: Record<string, any> = {}
                for (let c = 1; c <= 5; c++) {
                    for (let r = 1; r <= 3; r++) {
                        const cell = sheet.getCell(r, c)
                        const key = `R${r}C${c}`
                        rawCells[key] = {
                            value: cell.value,
                            text: cell.text,
                            type: cell.type,
                        }
                    }
                }
                results.rawCells = rawCells

                // Also check actualRowCount/actualColumnCount
                results.rowCount = sheet.rowCount
                results.columnCount = sheet.columnCount
                results.actualRowCount = sheet.actualRowCount
                results.actualColumnCount = sheet.actualColumnCount
            }
        } else {
            results.blobNotFound = true
        }
    } catch (e: any) {
        results.rawReadError = e.message
    }

    // Test 3: Write and read back in-memory (no blob)
    try {
        const wb = new ExcelJS.Workbook()
        const ws = wb.addWorksheet("Test")
        ws.getCell(1, 2).value = "MACHINE_TEST"
        ws.getCell(2, 2).value = "OUI"
        const buf = Buffer.from(await wb.xlsx.writeBuffer())

        const wb2 = new ExcelJS.Workbook()
        await wb2.xlsx.load(buf)
        const ws2 = wb2.worksheets[0]
        results.memoryTest = {
            name: ws2?.getCell(1, 2).text,
            status: ws2?.getCell(2, 2).text,
            ok: ws2?.getCell(1, 2).text === "MACHINE_TEST",
        }
    } catch (e: any) {
        results.memoryTestError = e.message
    }

    return NextResponse.json(results, { status: 200 })
}
