export interface PdfConversionResult {
  imageUrl: string;
  file: File | null;
  error?: string;
}

let pdfjsLib: any = null;
let isLoading = false;
let loadPromise: Promise<any> | null = null;

async function loadPdfJs(): Promise<any> {
  if (pdfjsLib) return pdfjsLib;
  if (loadPromise) return loadPromise;

  isLoading = true;

  // Dynamically import pdfjs-dist and set worker from CDN
  // @ts-expect-error - pdfjs-dist/build/pdf.mjs is not a proper module
  loadPromise = import("pdfjs-dist/build/pdf.mjs").then((lib) => {
    lib.GlobalWorkerOptions.workerSrc =
      lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    pdfjsLib = lib;
    isLoading = false;
    return lib;
  });

  return loadPromise;
}

export async function convertPdfToImage(file: File): Promise<PdfConversionResult> {
  // Ensure this runs only in browser
  if (typeof window === "undefined") {
    return {
      imageUrl: "",
      file: null,
      error: "PDF conversion must run in browser context",
    };
  }

  try {
    console.log("Starting PDF conversion...");
    console.log("File type:", file.type);

    const lib = await loadPdfJs();
    console.log("PDF.js loaded:", !!lib);

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await lib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);

    const viewport = page.getViewport({ scale: 4 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    if (context) {
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
    } else {
      return {
        imageUrl: "",
        file: null,
        error: "Failed to get canvas context",
      };
    }

    await page.render({ canvasContext: context, viewport }).promise;

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const originalName = file.name.replace(/\.pdf$/i, "");
            const imageFile = new File([blob], `${originalName}.png`, {
              type: "image/png",
            });

            resolve({
              imageUrl: URL.createObjectURL(blob),
              file: imageFile,
            });
          } else {
            console.error("Canvas toBlob failed");
            resolve({
              imageUrl: "",
              file: null,
              error: "Failed to create image blob",
            });
          }
        },
        "image/png",
        1.0
      );
    });
  } catch (err) {
    console.error("PDF conversion error:", err);
    return {
      imageUrl: "",
      file: null,
      error: `Failed to convert PDF: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}