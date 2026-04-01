import { NextRequest, NextResponse } from "next/server"
import { mergeMachines } from "@/lib/excel-store"
import { revalidatePath } from "next/cache"

export const dynamic = "force-dynamic"

export async function GET() { return NextResponse.json({ status: "OK" }) }

export async function POST(req: NextRequest) {
    const apiKey = req.headers.get("x-api-key")
    if (apiKey !== process.env.SCAN_API_KEY) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 })
    }

    try {
        const data = await req.json()
        const { NOM } = data

        if (!NOM) return NextResponse.json({ error: "Nom de machine manquant" }, { status: 400 })

        // Construire les valeurs exactes attendues de la ligne 1 à 150
        const valeurs = new Array(150).fill(null)

        const w = (r: number, v: any) => {
            if (v !== undefined && v !== null && v !== "") valeurs[r - 1] = v
        }

        valeurs[0] = NOM
        w(3, data.GROUPE_DOMAINE); w(4, data.FABRICANT); w(5, data.MODELE)
        w(8, data.SERVEUR_NTP); w(9, data.SERVICE_TAG)
        w(11, data.OS); w(12, data.TYPE_SYSTEM)
        w(13, data.CPU1); w(14, data.CPU2); w(15, data.RAM)
        w(16, data.GPU1); w(17, data.GPU2)

        if (Array.isArray(data.VOLUMES)) {
            if (data.VOLUMES[0]) w(19, data.VOLUMES[0]); if (data.VOLUMES[1]) w(21, data.VOLUMES[1])
        }
        if (Array.isArray(data.DISQUES)) {
            data.DISQUES.forEach((d: string, i: number) => { if (i < 14) w(23 + i, d) })
        }
        if (Array.isArray(data.RESEAU)) {
            data.RESEAU.forEach((nic: any, i: number) => {
                if (i < 4) {
                    const r = 43 + (i * 6)
                    w(r, nic.Nom); w(r + 1, nic.Nom); w(r + 2, nic.MAC); w(r + 3, nic.IP); w(r + 4, nic.Masque); w(r + 5, nic.Passerelle)
                }
            })
        }

        await mergeMachines([{ NOM, VALEURS: valeurs }])

        // Invalidate the Next.js cache so the dashboard shows the new machine immediately
        revalidatePath("/")
        revalidatePath("/inventory")

        return NextResponse.json({ success: true, machine: NOM })
    } catch (e: any) {
        console.error("ERREUR scan submit:", e.message)
        return NextResponse.json({ error: e.message || "Erreur interne" }, { status: 500 })
    }
}
