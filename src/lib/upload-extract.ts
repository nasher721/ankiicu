import { PDFParse } from "pdf-parse";

function isBinaryPdf(bytes: Uint8Array): boolean {
  if (bytes.length < 5) return false;
  const head = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4]);
  return head === "%PDF-";
}

function utf8ByteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

export function inferFileType(filename: string, isPdfBinary: boolean): "pdf" | "md" | "txt" {
  const lower = filename.toLowerCase();
  if (isPdfBinary || lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "md";
  return "txt";
}

/**
 * Decode upload bytes: extract text from binary PDFs, otherwise UTF-8 (lossy).
 */
export async function bytesToUploadText(buf: ArrayBuffer, filename: string): Promise<{
  content: string;
  fileType: "pdf" | "md" | "txt";
}> {
  const bytes = new Uint8Array(buf);
  const isPdf = isBinaryPdf(bytes);

  if (isPdf) {
    const data = new Uint8Array(bytes); // copy; pdf-parse may transfer array to worker
    const parser = new PDFParse({ data });
    try {
      const result = await parser.getText();
      const content = (result.text || "").replace(/\0/g, "");
      return { content, fileType: inferFileType(filename, true) };
    } finally {
      await parser.destroy().catch(() => {});
    }
  }

  const raw = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const content = raw.replace(/\0/g, "");
  return { content, fileType: inferFileType(filename, false) };
}

export function isContentWithinByteLimit(content: string, maxBytes: number): boolean {
  return utf8ByteLength(content) <= maxBytes;
}
