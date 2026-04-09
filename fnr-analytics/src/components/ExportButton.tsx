import { useState } from "react";
import { Loader2, FileSpreadsheet } from "lucide-react";
import { exportToExcel, exportMultiSheetExcel, ColumnDefinition, SheetDefinition } from "../utils/exportExcel";

interface ExportButtonProps {
  data: any[];
  columns: ColumnDefinition[];
  filename: string;
  className?: string;
  disabled?: boolean;
  /** Full multi-sheet export. When provided, overrides data/columns. */
  sheets?: SheetDefinition[];
  label?: string;
}

export default function ExportButton({ 
  data, columns, filename, className = "", disabled = false,
  sheets, label 
}: ExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    
    setTimeout(() => {
      try {
        if (sheets && sheets.length > 0) {
          exportMultiSheetExcel(sheets, filename);
        } else if (data.length) {
          exportToExcel(data, columns, filename);
        }
      } catch (err) {
        console.error("Export failed:", err);
      } finally {
        setExporting(false);
      }
    }, 50);
  };

  const hasData = sheets ? sheets.some(s => s.data.length > 0) : data.length > 0;

  return (
    <button
      onClick={handleExport}
      disabled={disabled || !hasData || exporting}
      className={`flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white/70 transition-all text-sm
        ${disabled || !hasData || exporting ? 'opacity-50 cursor-not-allowed' : 'hover:text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30'}
        ${className}`}
    >
      {exporting ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}
      <span>{exporting ? 'Экспорт...' : label || 'Excel отчёт'}</span>
    </button>
  );
}
