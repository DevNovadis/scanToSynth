declare module "xlsx-populate" {
    interface Cell {
        value(): any;
        value(val: any): Cell;
        style(name: string): any;
        style(name: string, value: any): Cell;
        style(styles: Record<string, any>): Cell;
    }

    interface Row {
        cell(colNum: number): Cell;
    }

    interface Sheet {
        row(rowNum: number): Row;
        cell(address: string): Cell;
        name(): string;
    }

    interface Workbook {
        sheet(nameOrIndex: string | number): Sheet;
        toFileAsync(path: string): Promise<void>;
        outputAsync(): Promise<Buffer>;
    }

    function fromFileAsync(path: string): Promise<Workbook>;
    function fromDataAsync(data: ArrayBuffer | Buffer): Promise<Workbook>;
    function fromBlankAsync(): Promise<Workbook>;

    export default {
        fromFileAsync,
        fromDataAsync,
        fromBlankAsync,
    };
}
