import { NextRequest, NextResponse } from "next/server"
import { getWorkbookBuffer } from "@/lib/excel-store"
import { checkBasicAuth } from "@/lib/auth"
import { isValidColumnIds } from "@/lib/validation"

// Défense en profondeur : revérifie l'auth déjà faite par src/proxy.ts
function isAuthorized(request: NextRequest) {
    return checkBasicAuth(request.headers.get("authorization")) === "ok"
}

export async function GET(request: NextRequest) {
    if (!isAuthorized(request)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    return handleExport()
}

export async function POST(request: NextRequest) {
    if (!isAuthorized(request)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    const body = await request.json().catch(() => ({}))
    const columnIds = body?.columnIds
    if (columnIds !== undefined && !isValidColumnIds(columnIds)) {
        return NextResponse.json({ error: "Sélection invalide" }, { status: 400 })
    }
    return handleExport(columnIds)
}

async function handleExport(columnIds?: number[]) {
    try {
        const buffer = await getWorkbookBuffer(columnIds)

        if (!buffer) {
            return NextResponse.json({ error: "Fichier inventaire non trouvé. Lancez un scan d'abord." }, { status: 404 })
        }

        return new NextResponse(new Uint8Array(buffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': 'attachment; filename="Inventaire_Parc_Global.xlsx"',
                'Content-Length': buffer.byteLength.toString(),
            }
        })
    } catch (error: any) {
        console.error("Erreur Export Excel:", error)
        return NextResponse.json({ error: "Erreur lors de la génération de l'export" }, { status: 500 })
    }
}
