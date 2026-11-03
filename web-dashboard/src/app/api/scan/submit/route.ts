import { NextRequest, NextResponse } from "next/server"
import { mergeMachines } from "@/lib/excel-store"
import { revalidatePath } from "next/cache"
import { safeEqual } from "@/lib/auth"
import { toCellValue } from "@/lib/validation"

export const dynamic = "force-dynamic"

// Un rapport d'agent fait quelques Ko : on refuse ce qui dépasse largement
const MAX_BODY_BYTES = 64 * 1024

export async function GET() { return NextResponse.json({ status: "OK" }) }

export async function POST(req: NextRequest) {
    const expectedKey = process.env.SCAN_API_KEY
    if (!expectedKey) {
        return NextResponse.json({ error: "SCAN_API_KEY non configurée sur le serveur" }, { status: 503 })
    }
    const apiKey = req.headers.get("x-api-key")
    if (!apiKey || !safeEqual(apiKey, expectedKey)) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    if (Number(req.headers.get("content-length") || 0) > MAX_BODY_BYTES) {
        return NextResponse.json({ error: "Requête trop volumineuse" }, { status: 413 })
    }

    try {
        const raw = await req.text()
        if (Buffer.byteLength(raw) > MAX_BODY_BYTES) {
            return NextResponse.json({ error: "Requête trop volumineuse" }, { status: 413 })
        }

        let data: any
        try { data = JSON.parse(raw) } catch {
            return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
        }
        if (!data || typeof data !== "object" || Array.isArray(data)) {
            return NextResponse.json({ error: "Format invalide" }, { status: 400 })
        }

        const NOM = toCellValue(data.NOM)
        if (typeof NOM !== "string") return NextResponse.json({ error: "Nom de machine manquant" }, { status: 400 })

        // Construire les valeurs exactes attendues de la ligne 1 à 150
        const valeurs = new Array(150).fill(null)

        // toCellValue n'accepte que chaînes et nombres : un objet { formula } ou { hyperlink }
        // serait sinon interprété par ExcelJS
        const w = (r: number, v: unknown) => {
            const value = toCellValue(v)
            if (value !== null) valeurs[r - 1] = value
        }

        valeurs[0] = NOM
        w(3, data.GROUPE_DOMAINE); w(4, data.FABRICANT); w(5, data.MODELE)
        w(8, data.SERVEUR_NTP); w(9, data.SERVICE_TAG)
        w(11, data.OS); w(12, data.TYPE_SYSTEM)
        w(13, data.CPU1); w(14, data.CPU2); w(15, data.RAM)
        w(16, data.GPU1); w(17, data.GPU2)

        if (Array.isArray(data.VOLUMES)) {
            w(19, data.VOLUMES[0]); w(21, data.VOLUMES[1])
        }
        if (Array.isArray(data.DISQUES)) {
            data.DISQUES.slice(0, 14).forEach((d: unknown, i: number) => w(23 + i, d))
        }
        if (Array.isArray(data.RESEAU)) {
            data.RESEAU.slice(0, 4).forEach((nic: any, i: number) => {
                if (!nic || typeof nic !== "object") return
                const r = 43 + (i * 6)
                w(r, nic.Nom); w(r + 1, nic.Nom); w(r + 2, nic.MAC); w(r + 3, nic.IP); w(r + 4, nic.Masque); w(r + 5, nic.Passerelle)
            })
        }

        await mergeMachines([{ NOM, VALEURS: valeurs }])

        // Invalidate the Next.js cache so the dashboard shows the new machine immediately
        revalidatePath("/")
        revalidatePath("/inventory")

        return NextResponse.json({ success: true, machine: NOM })
    } catch (e: any) {
        console.error("ERREUR scan submit:", e)
        return NextResponse.json({ error: "Erreur interne" }, { status: 500 })
    }
}
