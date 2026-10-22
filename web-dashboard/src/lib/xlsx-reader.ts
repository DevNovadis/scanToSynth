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

        // Excel COM écrit aussi des styles de colonnes jusqu'à XFD : <col min="7" max="16384" .../>
        // ExcelJS lit sans erreur mais échoue à la réécriture (colonne 16385) -> on borne à 250
        xml = xml.replace(/<col ([^>]*?)\/>/g, (match, attrs) => {
            const min = Number(/min="(\d+)"/.exec(attrs)?.[1])
            const max = Number(/max="(\d+)"/.exec(attrs)?.[1])
            if (!(max > 250)) return match
            if (min > 250) return ""
            return `<col ${attrs.replace(/max="\d+"/, 'max="250"')}/>`
        })

        // Validations de données (listes déroulantes NTP / RAID) définies jusqu'à XFD : sqref="B8:XFD8"
        xml = xml.replace(/sqref="([^"]*)"/g, (_match, ref) => `sqref="${ref.replace(/:XFD(\d+)/g, ":IP$1")}"`)

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
