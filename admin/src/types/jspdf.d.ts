declare module 'jspdf' {
  export class jsPDF {
    constructor(orientation?: string, unit?: string, format?: string);
    
    internal: {
      pageSize: {
        getWidth(): number;
        getHeight(): number;
      };
    };
    
    setFontSize(size: number): void;
    setTextColor(r: number, g: number, b: number): void;
    setFont(fontName: string, fontStyle: string): void;
    text(text: string, x: number, y: number): void;
    setFillColor(r: number, g: number, b: number): void;
    setDrawColor(r: number, g: number, b: number): void;
    rect(x: number, y: number, width: number, height: number, style?: string): void;
    line(x1: number, y1: number, x2: number, y2: number): void;
    save(filename: string): void;
    output(type: string): any;
  }
}