import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PdfUploadProps {
  bookId: string;
  onUploadComplete: () => void;
}

export function PdfUpload({ bookId, onUploadComplete }: PdfUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF file");
      return;
    }

    setIsUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload to storage
      const filePath = `${user.id}/${bookId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("pdfs")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create material record
      const { data: material, error: materialError } = await supabase
        .from("materials")
        .insert([
          {
            book_id: bookId,
            filename: file.name,
            storage_path: filePath,
            pages: 0, // Will be updated after processing
          },
        ])
        .select()
        .single();

      if (materialError) throw materialError;

      toast.success("PDF uploaded successfully!");
      setIsUploading(false);
      setIsProcessing(true);

      // Start processing in background
      const { error: processError } = await supabase.functions.invoke("process-pdf", {
        body: { materialId: material.id },
      });

      if (processError) {
        console.error("Processing error:", processError);
        toast.error("PDF uploaded but processing failed. You can try regenerating content.");
      } else {
        toast.success("PDF processed successfully!");
      }

      onUploadComplete();
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload PDF");
    } finally {
      setIsUploading(false);
      setIsProcessing(false);
      event.target.value = "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          className="relative overflow-hidden border-primary/50 hover:bg-primary/5"
          disabled={isUploading || isProcessing}
        >
          <input
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={isUploading || isProcessing}
          />
          {isUploading || isProcessing ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Upload className="w-4 h-4 mr-2" />
          )}
          {isUploading
            ? "Uploading..."
            : isProcessing
            ? "Processing..."
            : "Choose PDF File"}
        </Button>
        {(isUploading || isProcessing) && (
          <p className="text-sm text-muted-foreground animate-pulse">
            {isUploading ? "Uploading file..." : "Processing PDF and extracting text..."}
          </p>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Upload a PDF textbook to generate flashcards and quizzes. The AI will extract text and create study materials automatically.
      </p>
    </div>
  );
}
