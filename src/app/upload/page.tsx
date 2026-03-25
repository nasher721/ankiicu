"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { 
  FileUp, 
  CheckCircle2, 
  Trash2, 
  FolderOpen, 
  Loader2,
  FileText,
  AlertCircle,
  ChevronRight,
  BookOpen,
  RefreshCw
} from "lucide-react";
import Link from "next/link";

interface Chapter {
  id: number;
  label: string;
  startIdx: number;
  endIdx: number;
  questionCount: number;
}

interface SourceFile {
  id: string;
  filename: string;
  fileType: string;
  chapters: Chapter[];
  totalQuestions: number;
  createdAt: string;
}

export default function UploadPage() {
  const [sourceFile, setSourceFile] = useState<SourceFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSourceFile = useCallback(async () => {
    try {
      const res = await fetch("/api/upload");
      const data = await res.json();
      if (data.file) {
        setSourceFile(data.file);
      }
    } catch (error) {
      console.error("Failed to fetch source file:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSourceFile();
  }, [fetchSourceFile]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      
      if (data.success) {
        setSourceFile(data.file);
        toast({ 
          title: "File uploaded successfully!", 
          description: `${data.file.filename} - ${data.file.totalQuestions} questions detected across ${data.file.chapters.length} chapters.` 
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      toast({ 
        title: "Upload failed", 
        description: error instanceof Error ? error.message : "Unknown error", 
        variant: "destructive" 
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, []);

  const handleDeleteFile = useCallback(async () => {
    if (!confirm("Are you sure you want to delete this file? This will also reset your generation progress.")) return;
    
    try {
      await fetch("/api/upload", { method: "DELETE" });
      setSourceFile(null);
      toast({ title: "File deleted", description: "Upload a new file to start over." });
    } catch {
      toast({ title: "Failed to delete file", variant: "destructive" });
    }
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Upload</h1>
          <p className="text-muted-foreground mt-2">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Upload Source File</h1>
        <p className="text-muted-foreground mt-2">
          Upload your Neurocritical Care textbook to generate Anki flashcards. 
          We support PDF (extracted text), Markdown, and plain text files.
        </p>
      </div>

      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5 text-primary" />
            File Upload
          </CardTitle>
          <CardDescription>
            Upload a file containing your textbook questions and answers
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sourceFile ? (
            <div className="p-6 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                    <FileText className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-lg">{sourceFile.filename}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-green-700 dark:text-green-300">
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-4 w-4" />
                        {sourceFile.chapters.length} chapters
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="h-4 w-4" />
                        ~{sourceFile.totalQuestions} questions
                      </span>
                    </div>
                    <p className="text-xs text-green-600/70 dark:text-green-400/70 mt-2">
                      Uploaded on {new Date(sourceFile.createdAt).toLocaleDateString(undefined, { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Replace
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleDeleteFile}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div 
              className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-all"
              onClick={() => fileInputRef.current?.click()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file && fileInputRef.current) {
                  const dt = new DataTransfer();
                  dt.items.add(file);
                  fileInputRef.current.files = dt.files;
                  handleFileUpload({ target: fileInputRef.current } as any);
                }
              }}
              onDragOver={(e) => e.preventDefault()}
            >
              {isUploading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <p className="text-lg font-medium">Uploading and analyzing...</p>
                  <p className="text-sm text-muted-foreground">Detecting chapters and questions</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="p-4 bg-accent rounded-full">
                    <FolderOpen className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-lg font-medium">Click to upload or drag and drop</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      PDF (as extracted text), Markdown, or Text files
                    </p>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Badge variant="secondary">.md</Badge>
                    <Badge variant="secondary">.txt</Badge>
                    <Badge variant="secondary">.pdf</Badge>
                  </div>
                </div>
              )}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".md,.txt,.pdf"
            onChange={handleFileUpload}
          />
        </CardContent>
      </Card>

      {/* Chapters List */}
      {sourceFile && sourceFile.chapters.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Detected Chapters
            </CardTitle>
            <CardDescription>
              These chapters were automatically detected in your textbook
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {sourceFile.chapters.map((chapter) => (
                  <div 
                    key={chapter.id}
                    className="flex items-center justify-between p-4 bg-secondary/50 hover:bg-secondary rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary font-medium text-sm">
                        {chapter.id}
                      </div>
                      <div>
                        <p className="font-medium">{chapter.label}</p>
                        <p className="text-xs text-muted-foreground">
                          Questions detected: ~{chapter.questionCount}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline">~{chapter.questionCount} Qs</Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Empty State / Instructions */}
      {!sourceFile && (
        <Card className="border-dashed">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-medium">Expected File Format</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Chapters are detected from lines like{" "}
                  <code className="text-xs bg-muted px-1 rounded">## 3. Acute Ischemic Stroke</code>,{" "}
                  <code className="text-xs bg-muted px-1 rounded">3. Stroke</code>, or{" "}
                  <code className="text-xs bg-muted px-1 rounded">Chapter 4: Monitoring</code>. Questions
                  use numbered stems such as <code className="text-xs bg-muted px-1 rounded">1. A 45-year-old…</code>.
                  After upload, open Generate to pick the current chapter and scope for batch runs.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Next Steps */}
      {sourceFile && (
        <div className="flex justify-end">
          <Button asChild size="lg">
            <Link href="/generate">
              Continue to Generation
              <ChevronRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
