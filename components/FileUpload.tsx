"use client";

import { useState, useRef } from "react";
import { Paperclip, Eye, Upload, Loader2, FileText } from "lucide-react";

interface FileUploadProps {
  transactionId: string | number;
  initialPath?: string;
  onSuccess?: () => void;
}

export default function FileUpload({
  transactionId,
  initialPath,
  onSuccess,
}: FileUploadProps) {
  const [documentPath, setDocumentPath] = useState<string | undefined>(initialPath);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      // Step 1: Upload file to /api/upload
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const uploadResult = await uploadResponse.json();

      if (!uploadResult.success) {
        alert("שגיאה בהעלאת הקובץ: " + uploadResult.error);
        return;
      }

      const filePath = uploadResult.path;

      // Step 2: Attach document to transaction
      const attachResponse = await fetch(
        `/api/transactions/${transactionId}/attach-doc`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentPath: filePath }),
        }
      );

      const attachResult = await attachResponse.json();

      if (!attachResult.success) {
        alert("שגיאה בשיוך המסמך: " + attachResult.error);
        return;
      }

      // Success!
      setDocumentPath(filePath);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Error uploading document:", error);
      alert("שגיאה בהעלאת המסמך");
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleViewDocument = () => {
    if (documentPath) {
      window.open(documentPath, "_blank");
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex items-center gap-2">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.pdf"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />

      {uploading ? (
        // Loading state
        <button
          disabled
          className="p-2 text-gray-400 cursor-not-allowed"
          title="מעלה..."
        >
          <Loader2 className="w-4 h-4 animate-spin" />
        </button>
      ) : documentPath ? (
        // Document exists - show eye icon
        <div className="flex items-center gap-1">
          <button
            onClick={handleViewDocument}
            className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
            title="צפה במסמך"
          >
            <Eye className="w-4 h-4" />
          </button>
          {/* Option to upload new document */}
          <button
            onClick={handleUploadClick}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded transition-colors"
            title="החלף מסמך"
          >
            <Upload className="w-3 h-3" />
          </button>
        </div>
      ) : (
        // No document - show paperclip icon
        <button
          onClick={handleUploadClick}
          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
          title="צרף מסמך"
        >
          <Paperclip className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
