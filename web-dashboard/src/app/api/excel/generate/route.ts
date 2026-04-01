import { NextRequest, NextResponse } from "next/server"
import { getWorkbookBuffer } from "@/lib/excel-store"

export async function GET() {
    return handleExport()
}

export async function POST(request: NextRequest) {
    const body = await request.json().catch(() => ({}))
    const columnIds: number[] | undefined = body.columnIds
    return handleExport(columnIds)
}

async function handleExport(columnIds?: number[]) {
    try {
        const buffer = await getWorkbookBuffer(columnIds)

        if (!buffer) {
            return NextResponse.json({ error: "Fichier inventaire non trouvé. Lancez un scan d'abord." }, { status: 404 })
        }

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': 'attachment; filename="Inventaire_Parc_Global.xlsx"',
                'Content-Length': buffer.byteLength.toString(),
            }
        })
    } catch (error: any) {
        console.error("Erreur Export Excel:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
