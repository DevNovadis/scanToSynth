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
        }))
    } catch (e: any) {
        results.blobError = e.message
    }

    // Test 2: Download blob via get() + auth header (same as blobGet)
    try {
        const { get } = await import("@vercel/blob")
        const blob = await get("Inventaire_Parc.xlsx", {})
        const res = await fetch(blob.url, {
            headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` }
        })
        const buf = Buffer.from(await res.arrayBuffer())
        results.downloadMethod = "get+auth"
        results.downloadSize = buf.length
        results.downloadStatus = res.status

        if (buf.length > 100) {
            const workbook = new ExcelJS.Workbook()
            await workbook.xlsx.load(buf)
            const sheet = workbook.worksheets[0]
            if (sheet) {
                const rawCells: Record<string, any> = {}
                for (let c = 1; c <= 5; c++) {
                    for (let r = 1; r <= 3; r++) {
                        const cell = sheet.getCell(r, c)
                        rawCells[`R${r}C${c}`] = { value: cell.value, text: cell.text }
                    }
                }
                results.rawCells = rawCells
                results.rowCount = sheet.actualRowCount
                results.colCount = sheet.actualColumnCount
            }
        } else {
            // Show what we got instead
            results.downloadContent = buf.toString("utf-8").substring(0, 200)
        }
    } catch (e: any) {
        results.downloadError = e.message
    }

    // Test 3: Memory round-trip (always works)
    try {
        const wb = new ExcelJS.Workbook()
        const ws = wb.addWorksheet("Test")
        ws.getCell(1, 2).value = "MACHINE_TEST"
        ws.getCell(2, 2).value = "OUI"
        const buf = Buffer.from(await wb.xlsx.writeBuffer())
        const wb2 = new ExcelJS.Workbook()
        await wb2.xlsx.load(buf)
        const ws2 = wb2.worksheets[0]
        results.memoryTestOk = ws2?.getCell(1, 2).text === "MACHINE_TEST"
    } catch (e: any) {
        results.memoryTestError = e.message
    }

    return NextResponse.json(results, { status: 200 })
}
