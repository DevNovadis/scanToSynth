const ExcelJS = require('exceljs');
const path = require('path');

async function check() {
    const filePath = 'C:/Users/rdenimal/Documents/App_Novadis/scan_CLT_SRV/Inventaire_Parc.xlsx';
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
    workbook.worksheets.forEach(sheet => {
        console.log('--- Sheet:', sheet.name, '---');
        for (let c = 1; c <= 50; c++) {
            const row1 = sheet.getRow(1);
            if (!row1) continue;
            const name = row1.getCell(c).text;
            
            const row2 = sheet.getRow(2);
            const status = row2 ? row2.getCell(c).text : '';
            
            const row46 = sheet.getRow(46);
            const ip = row46 ? row46.getCell(c).text : '';
            
            if (name || ip) {
                if (name.includes('114') || ip.includes('114')) {
                    console.log(`Col ${c}: Name="${name}", IP="${ip}", Status="${status}"`);
                }
            }
        }
    });
}

check().catch(console.error);
