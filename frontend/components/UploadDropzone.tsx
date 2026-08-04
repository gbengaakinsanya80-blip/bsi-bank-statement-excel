"use client";

import * as React from "react";
import { FileSpreadsheet, FileUp, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface UploadDropzoneProps {
  onFile?: (file: File) => void;
  onFiles?: (files: File[]) => void;
  disabled?: boolean;
  multiple?: boolean;
}

export function UploadDropzone({ onFile, onFiles, disabled, multiple }: UploadDropzoneProps) {
  const [dragOver, setDragOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [selected, setSelected] = React.useState<File[] | null>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const pdfs = Array.from(files).filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    if (pdfs.length === 0) {
      alert("Please upload a PDF file.");
      return;
    }
    if (pdfs.length < Array.from(files).length) {
      alert("Non-PDF files were ignored.");
    }
    setSelected(pdfs);
    if (pdfs.length === 1 && !onFiles) {
      onFile?.(pdfs[0]);
    } else if (onFiles) {
      onFiles(pdfs);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload PDF"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
      className={cn(
        "group relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition-colors",
        dragOver
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/30 hover:border-primary/60 hover:bg-muted/40",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple={multiple}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        {selected && !disabled ? (
          <FileSpreadsheet className="h-7 w-7" />
        ) : (
          <FileUp className="h-7 w-7" />
        )}
      </div>
      {selected && !disabled ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="max-w-[280px] truncate font-medium">
            {selected.length === 1 ? selected[0].name : `${selected.length} files`}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              setSelected(null);
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <>
          <div>
            <p className="text-base font-semibold">
              {multiple ? "Drag & drop bank statement PDFs" : "Drag & drop your bank statement PDF"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {multiple
                ? "or click to browse — process several statements in one batch"
                : "or click to browse — text, scanned, multi-page and 500+ page statements supported"}
            </p>
          </div>
          {disabled && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Processing…
            </p>
          )}
        </>
      )}
    </div>
  );
}
