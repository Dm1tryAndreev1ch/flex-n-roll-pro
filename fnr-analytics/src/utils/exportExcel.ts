import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

export interface ColumnDefinition {
  header: string;
  key: string;
  width?: number; // In characters
  formatter?: (value: any, row: any) => any;
}

export function exportToExcel(
  data: any[],
  columns: ColumnDefinition[],
  filename: string,
  sheetName = "Data"
) {
  if (!data || !data.length) return;

  // Format data according to columns
  const formattedData = data.map((row) => {
    const formattedRow: Record<string, any> = {};
    columns.forEach((col) => {
      let val = row[col.key];
      if (col.formatter) {
        val = col.formatter(val, row);
      }
      formattedRow[col.header] = val ?? "";
    });
    return formattedRow;
  });

  // Create workbook and worksheet
  const worksheet = XLSX.utils.json_to_sheet(formattedData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Set column widths
  const defaultWidth = 15;
  worksheet["!cols"] = columns.map((col) => ({
    wch: col.width || Math.max(col.header.length, defaultWidth),
  }));

  // Generate buffer
  const excelBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });

  // Save file
  const fileData = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
  });
  
  const timestamp = new Date().toISOString().slice(0, 10);
  saveAs(fileData, `${filename}_${timestamp}.xlsx`);
}
