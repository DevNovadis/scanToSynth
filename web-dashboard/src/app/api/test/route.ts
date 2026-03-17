import { NextResponse } from "next/server"

export async function GET() {
    const results: Record<string, any> = {
        env: !!process.env.VERCEL,
        blobToken: !!process.env.BLOB_READ_WRITE_TOKEN,
    }

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

    try {
        const { getWorkbook, findSheet } = await import("@/lib/excel-store")
        const workbook = await getWorkbook()
        const sheet = findSheet(workbook)
        results.sheetName = sheet?.name || "NOT FOUND"
        results.worksheets = workbook.worksheets.map(w => w.name)

        if (sheet) {
            const cols: string[] = []
            for (let c = 2; c <= 20; c++) {
                const name = sheet.getRow(1).getCell(c).text?.trim()
                const status = sheet.getRow(2).getCell(c).text?.trim()
                if (name) cols.push(`col${c}: ${name} (status: ${status})`)
            }
            results.columns = cols
        }
    } catch (e: any) {
        results.workbookError = e.message
    }

    return NextResponse.json(results, { status: 200 })
}
