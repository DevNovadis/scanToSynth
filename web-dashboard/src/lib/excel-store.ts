import ExcelJS from "exceljs"
import path from "path"
import fs from "fs"

// ---------- Types ----------
export interface MachineData {
    NOM: string
    VALEURS: (string | number | null)[]
}

// ---------- Helpers Vercel Blob (dynamic import to avoid errors in local dev) ----------
async function blobPut(pathname: string, body: Buffer | Uint8Array): Promise<string> {
    const { put } = await import("@vercel/blob")
    // Essayer public d'abord, fallback sur private
    try {
        const result = await put(pathname, body, { access: "public", addRandomSuffix: false, allowOverwrite: true })
        return result.url
    } catch {
        const result = await put(pathname, body, { access: "private", addRandomSuffix: false, allowOverwrite: true })
        return result.url
    }
}

async function blobGet(pathname: string): Promise<Buffer | null> {
    const { list, getDownloadUrl } = await import("@vercel/blob")
    const result = await list({ prefix: pathname, limit: 1 })
    const blob = result.blobs.find(b => b.pathname === pathname)
    if (!blob) return null
    // Essayer fetch direct (public), sinon getDownloadUrl (private)
    let res = await fetch(blob.url)
    if (!res.ok) {
        try {
            const signedUrl = await getDownloadUrl(blob.url)
            res = await fetch(signedUrl)
            if (!res.ok) return null
        } catch {
            return null
        }
    }
    return Buffer.from(await res.arrayBuffer())
}

async function blobDel(pathname: string): Promise<void> {
    const { list, del } = await import("@vercel/blob")
    const result = await list({ prefix: pathname, limit: 1 })
    const blob = result.blobs.find(b => b.pathname === pathname)
    if (blob) await del(blob.url)
}

const isVercel = !!process.env.VERCEL

// ---------- Paths (local dev) ----------
function localInventairePath() {
    return path.join(process.cwd(), "data", "Inventaire_Parc.xlsx")
}
function localImportInfoPath() {
    return path.join(process.cwd(), "data", "import_info.json")
}

// ---------- Row labels for column A (exact match from template) ----------
const ROW_LABELS: Record<number, string> = {
    1: "NOM",
    2: "LOCALISATION",
    3: "GROUPE DE TRAVAIL OU DOMAINE",
    4: "FABRICANT DU SYSTÈME",
    5: "MODELE DU SYSTÈME",
    6: "DOMAINE DE SURETE",
    7: "FONCTIONS",
    8: "SERVEUR NTP",
    9: "SERVICE TAG",
    10: "FIN DE GARANTIE",
    11: "SYSTÈME D'EXPLOITATION",
    12: "TYPE DU SYSTÈME",
    13: "PROCESSEUR N° 1",
    14: "PROCESSEUR N° 2",
    15: "MÉMOIRE PHYSIQUE (RAM)",
    16: "CARTE GRAPHIQUE N° 1",
    17: "CARTE GRAPHIQUE N° 2",
    // 18: separator row (empty, with gray fill)
    19: "TAILLE DISQUE VIRTUEL 0",
    20: "RAID DISQUE VIRTUEL 0",
    21: "TAILLE DISQUE VIRTUEL 1",
    22: "RAID DISQUE VIRTUEL 1",
    23: "REFERENCE DU DISQUE 00",
    24: "REFERENCE DU DISQUE 01",
    25: "REFERENCE DU DISQUE 02",
    26: "REFERENCE DU DISQUE 03",
    27: "REFERENCE DU DISQUE 04",
    28: "REFERENCE DU DISQUE 05",
    29: "REFERENCE DU DISQUE 06",
    30: "REFERENCE DU DISQUE 07",
    31: "REFERENCE DU DISQUE 08",
    32: "REFERENCE DU DISQUE 09",
    33: "REFERENCE DU DISQUE 10",
    34: "REFERENCE DU DISQUE 11",
    35: "REFERENCE DU DISQUE 12",
    36: "REFERENCE DU DISQUE 13",
    37: "MONITEUR 1 - CONNECTIQUE",
    38: "MONITEUR 2 - CONNECTIQUE",
    39: "EQUIPEMENT TIERS N °1",
    40: "EQUIPEMENT TIERS N °2",
    41: "EQUIPEMENT TIERS N °3",
    // 42: separator row (empty, with gray fill)
    43: "CARTE RESEAU N° 1 - NOM DE LA CONNEXION",
    44: "CARTE RESEAU N° 1 - REFERENCE",
    45: "CARTE RESEAU N° 1 - ADRESSE MAC",
    46: "CARTE RESEAU N° 1 - ADRESSE IP",
    47: "CARTE RESEAU N° 1 - MASQUE DE SOUS-RESEAU",
    48: "CARTE RESEAU N° 1 - PASSERELLE",
    49: "CARTE RESEAU N° 2 - NOM DE LA CONNEXION",
    50: "CARTE RESEAU N° 2 - REFERENCE",
    51: "CARTE RESEAU N° 2 - ADRESSE MAC",
    52: "CARTE RESEAU N° 2 - ADRESSE IP",
    53: "CARTE RESEAU N° 2 - MASQUE DE SOUS-RESEAU",
    54: "CARTE RESEAU N° 2 - PASSERELLE",
    55: "CARTE RESEAU N° 3 - NOM DE LA CONNEXION",
    56: "CARTE RESEAU N° 3 - REFERENCE",
    57: "CARTE RESEAU N° 3 - ADRESSE MAC",
    58: "CARTE RESEAU N° 3 - ADRESSE IP",
    59: "CARTE RESEAU N° 3 - MASQUE DE SOUS-RESEAU",
    60: "CARTE RESEAU N° 3 - PASSERELLE",
    61: "CARTE RESEAU N° 4 - NOM DE LA CONNEXION",
    62: "CARTE RESEAU N° 4 - REFERENCE",
    63: "CARTE RESEAU N° 4 - ADRESSE MAC",
    64: "CARTE RESEAU N° 4 - ADRESSE IP",
    65: "CARTE RESEAU N° 4 - MASQUE DE SOUS-RESEAU",
    66: "CARTE RESEAU N° 4 - PASSERELLE",
}

// Separator rows (empty but with gray fill)
const SEPARATOR_ROWS = [18, 42]

// Gray fill (theme:0 tint:-0.35 ≈ #A6A6A6)
const GRAY_FILL: ExcelJS.FillPattern = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFA6A6A6" },
}
const WHITE_BOLD_FONT: Partial<ExcelJS.Font> = {
    bold: true,
    color: { argb: "FFFFFFFF" },
    size: 11,
    name: "Calibri",
}
const BLACK_BOLD_FONT: Partial<ExcelJS.Font> = {
    bold: true,
    color: { argb: "FF000000" },
    size: 11,
    name: "Calibri",
}
const LEFT_ALIGN: Partial<ExcelJS.Alignment> = { horizontal: "left" }

function applyTemplateFormatting(sheet: ExcelJS.Worksheet): void {
    // Column widths
    sheet.getColumn(1).width = 65.27

    // Row 1 (NOM): no fill, black bold text
    const cell1 = sheet.getCell(1, 1)
    if (!cell1.value) cell1.value = ROW_LABELS[1]
    cell1.font = BLACK_BOLD_FONT
    cell1.alignment = LEFT_ALIGN

    // Rows 2-66: gray fill, white bold text
    for (let r = 2; r <= 66; r++) {
        const cell = sheet.getCell(r, 1)
        const label = ROW_LABELS[r]
        if (label && !cell.value) {
            cell.value = label
        }
        // Apply gray fill and white font to all rows 2-66 (including separators 18, 42)
        cell.fill = GRAY_FILL
        cell.font = WHITE_BOLD_FONT
        cell.alignment = LEFT_ALIGN
    }

    // Set default width for data columns (B onward)
    for (let c = 2; c <= 25; c++) {
        sheet.getColumn(c).width = 84
    }
}

function createFormattedWorkbook(): ExcelJS.Workbook {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet("Serveurs et postes clients")
    applyTemplateFormatting(sheet)
    return workbook
}

// ---------- Get the current workbook ----------
export async function getWorkbook(): Promise<ExcelJS.Workbook> {
    if (isVercel) {
        const buf = await blobGet("Inventaire_Parc.xlsx")
        if (buf) {
            const workbook = new ExcelJS.Workbook()
            await workbook.xlsx.load(buf)
            return workbook
        }
        // No file in blob yet -> create formatted workbook with labels
        return createFormattedWorkbook()
    }

    // Local dev
    const workbook = new ExcelJS.Workbook()
    const filePath = localInventairePath()
    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
        await workbook.xlsx.readFile(filePath)
    }
    return workbook
}

// ---------- Save the workbook ----------
export async function saveWorkbook(workbook: ExcelJS.Workbook): Promise<void> {
    if (isVercel) {
        const buffer = Buffer.from(await workbook.xlsx.writeBuffer())
        await blobPut("Inventaire_Parc.xlsx", buffer)
    } else {
        const filePath = localInventairePath()
        await workbook.xlsx.writeFile(filePath)
    }
}

// ---------- Get workbook as buffer (for download, with labels ensured) ----------
export async function getWorkbookBuffer(): Promise<Buffer | null> {
    const workbook = await getWorkbook()
    const sheet = findSheet(workbook)
    if (!sheet) return null

    // Ensure template formatting is applied
    applyTemplateFormatting(sheet)

    return Buffer.from(await workbook.xlsx.writeBuffer())
}

// ---------- Find the right sheet ----------
export function findSheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet | undefined {
    let sheet = workbook.getWorksheet("Serveurs et postes clients")
    if (!sheet) sheet = workbook.worksheets.find(w => w.name?.includes("Serveurs"))
    if (!sheet) sheet = workbook.worksheets[0]
    return sheet
}

// ---------- Merge machines (replaces MergeExcel.ps1) ----------
export async function mergeMachines(machinesData: MachineData[]): Promise<void> {
    console.log("[Merge] Getting workbook...")
    const workbook = await getWorkbook()
    let sheet = findSheet(workbook)

    if (!sheet) {
        // Create sheet if workbook is empty
        sheet = workbook.addWorksheet("Serveurs et postes clients")
    }

    // Read headers (row 1, columns 2-250) into memory
    const headers: (string | null)[] = []
    for (let c = 2; c <= 250; c++) {
        const val = sheet.getCell(1, c).text?.trim()
        headers.push(val || null)
    }

    for (const machine of machinesData) {
        const name = machine.NOM?.toString().trim()
        if (!name) continue

        // Find existing column by name
        let targetCol = 0
        for (let i = 0; i < headers.length; i++) {
            if (headers[i] && headers[i]!.toLowerCase() === name.toLowerCase()) {
                targetCol = i + 2 // +2 because headers start at col 2
                break
            }
        }

        // If not found, find first empty column
        if (targetCol === 0) {
            for (let i = 0; i < headers.length; i++) {
                if (!headers[i]) {
                    targetCol = i + 2
                    headers[i] = name // Update in-memory header
                    break
                }
            }
        }

        if (targetCol === 0) targetCol = 2

        // Write values (150 rows)
        const valeurs = machine.VALEURS || []
        for (let r = 0; r < 150; r++) {
            const val = r < valeurs.length ? valeurs[r] : null
            if (val !== null && val !== undefined && val.toString().trim() !== "") {
                sheet.getCell(r + 1, targetCol).value = val
            } else {
                sheet.getCell(r + 1, targetCol).value = null
            }
        }
    }

    console.log("[Merge] Saving workbook...")
    await saveWorkbook(workbook)
    console.log("[Merge] Done!")
}

// ---------- Delete machine columns (replaces DeleteInExcel.ps1) ----------
export async function deleteMachineColumns(columnIds: number[]): Promise<void> {
    const workbook = await getWorkbook()
    const sheet = findSheet(workbook)
    if (!sheet) throw new Error("Feuille non trouvée")

    for (const colId of columnIds) {
        for (let r = 1; r <= 150; r++) {
            sheet.getCell(r, colId).value = null
        }
    }

    await saveWorkbook(workbook)
}

// ---------- Import info (small JSON metadata) ----------
export async function getImportInfo(): Promise<any | null> {
    if (isVercel) {
        const buf = await blobGet("import_info.json")
        if (!buf) return null
        try { return JSON.parse(buf.toString("utf-8")) } catch { return null }
    }
    const p = localImportInfoPath()
    if (!fs.existsSync(p)) return null
    try { return JSON.parse(fs.readFileSync(p, "utf-8")) } catch { return null }
}

export async function saveImportInfo(info: { filename: string; date: string }): Promise<void> {
    const json = JSON.stringify(info)
    if (isVercel) {
        await blobPut("import_info.json", Buffer.from(json, "utf-8"))
    } else {
        fs.writeFileSync(localImportInfoPath(), json)
    }
}

export async function deleteInventory(): Promise<void> {
    if (isVercel) {
        await blobDel("Inventaire_Parc.xlsx")
        await blobDel("import_info.json")
    } else {
        const filePath = localInventairePath()
        const infoPath = localImportInfoPath()
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
        if (fs.existsSync(infoPath)) fs.unlinkSync(infoPath)
    }
}
