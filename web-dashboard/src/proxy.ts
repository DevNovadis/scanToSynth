import { NextRequest, NextResponse } from "next/server"

// Routes appelées par l'agent PowerShell : protégées par leur propre clé API (x-api-key)
const PUBLIC_PATHS = ["/api/scan/submit", "/api/ping"]

function safeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false
    let diff = 0
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
    return diff === 0
}

function unauthorized() {
    return new NextResponse("Authentification requise", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Novadis Scanner", charset="UTF-8"' },
    })
}

export function proxy(req: NextRequest) {
    if (PUBLIC_PATHS.includes(req.nextUrl.pathname)) return NextResponse.next()

    const user = process.env.DASHBOARD_USER
    const password = process.env.DASHBOARD_PASSWORD

    if (!user || !password) {
        // En local, pas d'auth si non configurée ; en production on refuse (fail closed)
        if (!process.env.VERCEL) return NextResponse.next()
        return new NextResponse("DASHBOARD_USER / DASHBOARD_PASSWORD non configurés", { status: 503 })
    }

    const header = req.headers.get("authorization")
    if (!header?.startsWith("Basic ")) return unauthorized()

    let decoded = ""
    try { decoded = atob(header.slice(6)) } catch { return unauthorized() }
    const sep = decoded.indexOf(":")
    if (sep < 0) return unauthorized()

    const okUser = safeEqual(decoded.slice(0, sep), user)
    const okPassword = safeEqual(decoded.slice(sep + 1), password)
    if (!okUser || !okPassword) return unauthorized()

    return NextResponse.next()
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
