import { NextRequest, NextResponse } from "next/server"
import { checkBasicAuth } from "@/lib/auth"

// Routes appelées par l'agent PowerShell : protégées par leur propre clé API (x-api-key)
const PUBLIC_PATHS = ["/api/scan/submit", "/api/ping"]

function unauthorized() {
    return new NextResponse("Authentification requise", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Novadis Scanner", charset="UTF-8"' },
    })
}

export function proxy(req: NextRequest) {
    if (PUBLIC_PATHS.includes(req.nextUrl.pathname)) return NextResponse.next()

    const result = checkBasicAuth(req.headers.get("authorization"))
    if (result === "misconfigured") {
        return new NextResponse("DASHBOARD_USER / DASHBOARD_PASSWORD non configurés", { status: 503 })
    }
    if (result === "unauthorized") return unauthorized()

    return NextResponse.next()
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
