import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { htmlToPdf, PdfOptions } from "@/lib/pdf-generator";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { html_content, pdf_options, css_stylesheet, filename } = await request.json();

    if (!html_content) {
      return NextResponse.json({ error: "html_content es requerido" }, { status: 400 });
    }

    const finalHtml = css_stylesheet
      ? html_content.replace('</head>', `<style>${css_stylesheet}</style></head>`)
      : html_content;

    const options: PdfOptions = {
      format: pdf_options?.format ?? 'A4',
      margin: pdf_options?.margin,
    };

    const pdfBuffer = await htmlToPdf(finalHtml, options);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename || 'documento.pdf'}"`,
      },
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate PDF' }, { status: 500 });
  }
}
