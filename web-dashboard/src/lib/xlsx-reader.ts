/**
 * Lecteur xlsx robuste qui contourne le bug ExcelJS "16385 is out of bounds"
 *
 * Stratégie : dézipper le xlsx, corriger les dimensions dans le XML des feuilles,
 * puis rezipper avant de passer à ExcelJS.
 */
import JSZip from "jszip"
import ExcelJS from "exceljs"

/**
 * Charge un fichier xlsx en corrigeant les dimensions problématiques.
 * Les fichiers créés par Excel COM ont parfois des dimensions > 16384 colonnes.
 */
export async function loadXlsxSafe(buffer: Buffer | ArrayBuffer): Promise<ExcelJS.Workbook> {
    const zip = await JSZip.loadAsync(buffer)

    // Corriger les dimensions dans chaque feuille
    const sheetFiles = Object.keys(zip.files).filter(f => f.match(/xl\/worksheets\/sheet\d+\.xml/))

    for (const sheetFile of sheetFiles) {
        let xml = await zip.file(sheetFile)!.async("string")

        // Remplacer les dimension refs qui dépassent XFD (col 16384)
        // Exemple: <dimension ref="A1:XFE150"/> -> <dimension ref="A1:IS150"/> (col 253)
        xml = xml.replace(/<dimension ref="([^"]+)"\/>/g, (match, ref) => {
            // Parser la ref, ex: "A1:XFE150"
            const parts = ref.split(":")
            if (parts.length === 2) {
                const endRef = parts[1]
                const colLetters = endRef.replace(/\d+/g, "")
                const colNum = colLettersToNumber(colLetters)
                if (colNum > 250) {
                    // Remplacer par une dimension raisonnable (250 colonnes max)
                    const row = endRef.replace(/[A-Z]+/g, "")
                    return `<dimension ref="${parts[0]}:IS${row}"/>`  // IS = colonne 253
                }
            }
            return match
        })

        zip.file(sheetFile, xml)
    }

    // Recréer le buffer xlsx corrigé
    const fixedBuffer = await zip.generateAsync({ type: "nodebuffer" })

    // Charger dans ExcelJS
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(fixedBuffer)
    return workbook
}

function colLettersToNumber(letters: string): number {
    let num = 0
    for (let i = 0; i < letters.length; i++) {
        num = num * 26 + (letters.charCodeAt(i) - 64)
    }
    return num
}
