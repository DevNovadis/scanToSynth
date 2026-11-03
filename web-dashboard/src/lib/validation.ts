// Colonnes machines : la colonne 1 contient les libellés, 16384 est la dernière colonne Excel
const MIN_COLUMN = 2
const MAX_COLUMN = 16384
const MAX_COLUMN_IDS = 1000

export function isValidColumnIds(ids: unknown): ids is number[] {
    return Array.isArray(ids)
        && ids.length <= MAX_COLUMN_IDS
        && ids.every(id => Number.isInteger(id) && id >= MIN_COLUMN && id <= MAX_COLUMN)
}

const MAX_CELL_LENGTH = 255

// Normalise une valeur venant de l'agent avant écriture dans une cellule :
// seules les chaînes et les nombres sont acceptés. Un objet ({ formula }, { hyperlink }…)
// serait interprété par ExcelJS comme une formule ou un lien, il est donc rejeté.
export function toCellValue(v: unknown): string | number | null {
    if (typeof v === "number") return Number.isFinite(v) ? v : null
    if (typeof v !== "string") return null
    const s = v.trim().slice(0, MAX_CELL_LENGTH)
    return s === "" ? null : s
}
