import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

export interface ColumnDefinition {
  header: string;
  key: string;
  width?: number;
  formatter?: (value: any, row: any) => any;
  numFmt?: string; // Excel number format, e.g. "#,##0.00" for currency
}

export interface SheetDefinition {
  name: string;
  columns: ColumnDefinition[];
  data: any[];
  summaryRows?: Record<string, any>[]; // Extra rows at the bottom (totals, averages, etc.)
}

/**
 * Simple single-sheet export (backward compatible).
 */
export function exportToExcel(
  data: any[],
  columns: ColumnDefinition[],
  filename: string,
  sheetName = "Data"
) {
  exportMultiSheetExcel([{ name: sheetName, columns, data }], filename);
}

/**
 * Rich multi-sheet Excel export with formatting.
 */
export function exportMultiSheetExcel(
  sheets: SheetDefinition[],
  filename: string
) {
  if (!sheets || !sheets.length) return;

  const workbook = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const { name, columns, data, summaryRows } = sheet;

    // Format data rows
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

    // Add summary rows at the bottom
    if (summaryRows?.length) {
      formattedData.push({}); // Empty separator row
      for (const summaryRow of summaryRows) {
        const formatted: Record<string, any> = {};
        columns.forEach((col) => {
          formatted[col.header] = summaryRow[col.key] ?? summaryRow[col.header] ?? "";
        });
        formattedData.push(formatted);
      }
    }

    const worksheet = XLSX.utils.json_to_sheet(formattedData);

    // Column widths: use defined width or auto-detect from content
    worksheet["!cols"] = columns.map((col) => ({
      wch: col.width || Math.max(
        col.header.length + 2,
        ...data.slice(0, 50).map((row) => {
          const val = col.formatter ? col.formatter(row[col.key], row) : row[col.key];
          return String(val || "").length;
        }),
        12
      ),
    }));

    // Freeze the header row
    worksheet["!freeze"] = { xSplit: 0, ySplit: 1 };

    XLSX.utils.book_append_sheet(workbook, worksheet, name.substring(0, 31)); // Excel limit: 31 chars
  }

  // Generate and save
  const excelBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });

  const fileData = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
  });

  const timestamp = new Date().toISOString().slice(0, 10);
  saveAs(fileData, `${filename}_${timestamp}.xlsx`);
}
