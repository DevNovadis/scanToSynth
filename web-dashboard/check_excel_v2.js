const ExcelJS = require('exceljs');

async function check() {
    const filePath = 'C:/Users/rdenimal/Documents/App_Novadis/scan_CLT_SRV/Inventaire_Parc.xlsx';
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
    const sheet = workbook.getWorksheet("Serveurs et postes clients") || workbook.worksheets[0];
    console.log('Using sheet:', sheet.name);
    
    for (let c = 1; c <= 100; c++) {
        const nameCell = sheet.getRow(1).getCell(c);
        const name = nameCell ? nameCell.text : '';
        
        const ipCell = sheet.getRow(46).getCell(c);
        const ip = ipCell ? ipCell.text : '';
        
        const statusCell = sheet.getRow(2).getCell(c);
        const status = statusCell ? statusCell.text : '';
        
        if (name || ip) {
            console.log(`Col ${c}: Name="${name}", IP="${ip}", Status="${status}"`);
        }
    }
}

check().catch(console.error);
