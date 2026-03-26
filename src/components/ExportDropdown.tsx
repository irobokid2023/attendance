import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';

interface ExportDropdownProps {
  onExportExcel: () => void;
  onExportPdf: () => void;
  disabled?: boolean;
}

const ExportDropdown = ({ onExportExcel, onExportPdf, disabled }: ExportDropdownProps) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="outline" size="sm" disabled={disabled}>
        <Download className="w-4 h-4 mr-2" />Export
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={onExportExcel}>
        <FileSpreadsheet className="w-4 h-4 mr-2" />Export as Excel
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onExportPdf}>
        <FileText className="w-4 h-4 mr-2" />Export as PDF
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

export default ExportDropdown;
