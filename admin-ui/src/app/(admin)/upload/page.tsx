// app/(admin)/upload/page.tsx
'use client';
import { FileUploader } from '@/components/FileUploader';

export default function UploadPage() {
  return (
    <div className="p-6 max-w-xl">
      <h1 className="font-display font-bold text-xl text-text mb-1">Subir documentos</h1>
      <p className="text-text-mid text-sm mb-5">
        Subí PDFs, DOCX o TXT. Vertex AI los indexará automáticamente en ~2 minutos.
      </p>
      <div className="card p-5">
        <FileUploader />
      </div>
    </div>
  );
}

// app/(admin)/test/page.tsx — en archivo separado abajo
