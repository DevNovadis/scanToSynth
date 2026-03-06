import { NextRequest, NextResponse } from "next/server"
import path from "path"
import fs from "fs"

export async function GET(req: NextRequest) {
    try {
        const rootPath = path.join(process.cwd(), "..")
        const dataPath = path.join(rootPath, "Inventaire_Parc.xlsx")

        if (!fs.existsSync(dataPath)) {
            return NextResponse.json({ error: "Fichier inventaire non trouvé. Lancez un scan d'abord." }, { status: 404 })
        }

        // Lire le fichier actuel directement pour le télécharger sans interférence
        const buffer = fs.readFileSync(dataPath)

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
