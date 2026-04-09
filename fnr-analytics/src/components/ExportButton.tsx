import React, { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { exportToExcel, ColumnDefinition } from "../utils/exportExcel";

interface ExportButtonProps {
  data: any[];
  columns: ColumnDefinition[];
  filename: string;
  className?: string;
  disabled?: boolean;
}

export default function ExportButton({ data, columns, filename, className = "", disabled = false }: ExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!data.length || exporting) return;
    setExporting(true);
    
    // Slight timeout to allow UI to update to loading state before blocking main thread
    setTimeout(() => {
      try {
        exportToExcel(data, columns, filename);
      } catch (err) {
        console.error("Export failed:", err);
      } finally {
        setExporting(false);
      }
    }, 50);
  };

  return (
    <button
      onClick={handleExport}
      disabled={disabled || data.length === 0 || exporting}
      className={`flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white/70 transition-all text-sm
        ${disabled || data.length === 0 || exporting ? 'opacity-50 cursor-not-allowed' : 'hover:text-white hover:bg-white/10'}
        ${className}`}
    >
      {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
      <span>{exporting ? 'Экспорт...' : 'Экспорт'}</span>
    </button>
  );
}
