import { createHash, timingSafeEqual } from "crypto"
import { headers } from "next/headers"

// Comparaison à temps constant : on compare des hash SHA-256 pour ne pas laisser fuiter la longueur
export function safeEqual(a: string, b: string): boolean {
    const ha = createHash("sha256").update(a).digest()
    const hb = createHash("sha256").update(b).digest()
    return timingSafeEqual(ha, hb)
}

export type AuthResult = "ok" | "unauthorized" | "misconfigured"

// Vérifie un en-tête Authorization Basic contre DASHBOARD_USER / DASHBOARD_PASSWORD.
// Fail closed : sans identifiants configurés, seul `next dev` laisse passer.
export function checkBasicAuth(header: string | null): AuthResult {
    const user = process.env.DASHBOARD_USER
    const password = process.env.DASHBOARD_PASSWORD

    if (!user || !password) {
        return process.env.NODE_ENV === "development" ? "ok" : "misconfigured"
    }

    if (!header?.startsWith("Basic ")) return "unauthorized"

    let decoded = ""
    try { decoded = atob(header.slice(6)) } catch { return "unauthorized" }
    const sep = decoded.indexOf(":")
    if (sep < 0) return "unauthorized"

    const okUser = safeEqual(decoded.slice(0, sep), user)
    const okPassword = safeEqual(decoded.slice(sep + 1), password)
    return okUser && okPassword ? "ok" : "unauthorized"
}

// Défense en profondeur : à appeler au début de chaque server action et route handler protégé,
// en plus du contrôle fait par src/proxy.ts.
export async function requireAuth(): Promise<void> {
    const h = await headers()
    if (checkBasicAuth(h.get("authorization")) !== "ok") {
        throw new Error("Non autorisé")
    }
}
