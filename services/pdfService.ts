
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Equipment, ServiceRecord, Customer, EquipmentStatus } from "../types.ts";
import { formatDate } from "../utils.ts";

/**
 * Desenha a logomarca ALVS fielmente no documento PDF
 */
const drawLogo = (doc: jsPDF, x: number, y: number, scale: number = 0.5) => {
  const brandRed = [255, 61, 61];
  const darkGrey = [51, 51, 51];

  // Triângulo Vermelho Esquerdo
  doc.setFillColor(brandRed[0], brandRed[1], brandRed[2]);
  doc.triangle(
    x + 1 * scale, y + 2 * scale, 
    x + 7 * scale, y + 2 * scale, 
    x + 1 * scale, y + 21 * scale, 
    'F'
  );

  // Bloco Cinza Principal (Trapézio)
  doc.setFillColor(darkGrey[0], darkGrey[1], darkGrey[2]);
  // Use two triangles to draw the trapezoid as fillPoly is not available in standard jsPDF
  doc.triangle(
    x + 8 * scale, y + 2 * scale,
    x + 47 * scale, y + 2 * scale,
    x + 47 * scale, y + 21 * scale,
    'F'
  );
  doc.triangle(
    x + 8 * scale, y + 2 * scale,
    x + 47 * scale, y + 21 * scale,
    x + 2 * scale, y + 21 * scale,
    'F'
  );

  // Texto ALVS
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(38 * scale);
  doc.text("ALVS", x + 9 * scale, y + 17.5 * scale);

  // Quadrado Vermelho da Cruz
  doc.setFillColor(brandRed[0], brandRed[1], brandRed[2]);
  doc.rect(x + 48 * scale, y + 2 * scale, 21 * scale, 21 * scale, 'F');

  // Cruz Branca
  doc.setFillColor(255, 255, 255);
  const cw = 21 * scale;
  const cx = x + 48 * scale;
  const cy = y + 2 * scale;
  // Horizontal bar
  doc.rect(cx + 3 * scale, cy + 8 * scale, 15 * scale, 5 * scale, 'F');
  // Vertical bar
  doc.rect(cx + 8 * scale, cy + 3 * scale, 5 * scale, 15 * scale, 'F');

  // Linha de Pulso (EKG) simplificada para o PDF
  doc.setDrawColor(brandRed[0], brandRed[1], brandRed[2]);
  doc.setLineWidth(0.3 * scale);
  doc.line(cx + 3 * scale, cy + 10.5 * scale, cx + 6 * scale, cy + 10.5 * scale);
  doc.line(cx + 6 * scale, cy + 10.5 * scale, cx + 8 * scale, cy + 5 * scale);
  doc.line(cx + 8 * scale, cy + 5 * scale, cx + 11 * scale, cy + 16 * scale);
  doc.line(cx + 11 * scale, cy + 16 * scale, cx + 13 * scale, cy + 10.5 * scale);
  doc.line(cx + 13 * scale, cy + 10.5 * scale, cx + 18 * scale, cy + 10.5 * scale);

  // Texto Inferior
  doc.setTextColor(darkGrey[0], darkGrey[1], darkGrey[2]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10 * scale);
  doc.text("ENGINEERING & MEDICAL", x + 1 * scale, y + 26 * scale, { charSpace: 0.5 });
};

export const generateEquipmentReport = (equipment: Equipment, customerName: string) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Branding Header Rectangles
  doc.setFillColor(51, 51, 51); // Dark Grey
  doc.rect(0, 0, pageWidth, 40, 'F');
  doc.setFillColor(255, 61, 61); // Brand Red
  doc.rect(pageWidth - 80, 0, 80, 40, 'F');

  // Draw Logo on top of header
  drawLogo(doc, 15, 5, 1.1);
  
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("Relatório Técnico Individual", pageWidth - 15, 20, { align: "right" });
  doc.text(`${formatDate(new Date().toISOString()).split(',')[0]}`, pageWidth - 15, 28, { align: "right" });

  // Equipment Details Section
  doc.setFontSize(14);
  doc.setTextColor(51, 51, 51);
  doc.text("Informações do Ativo Hospitalar", 15, 55);
  doc.setDrawColor(255, 61, 61);
  doc.setLineWidth(1);
  doc.line(15, 58, 80, 58);

  const equipData = [
    ["CÓDIGO INTERNO", equipment.code],
    ["EQUIPAMENTO", equipment.name.toUpperCase()],
    ["MARCA/MODELO", `${equipment.brand} / ${equipment.model}`.toUpperCase()],
    ["Nº DE SÉRIE", equipment.serialNumber],
    ["UNIDADE SOLICITANTE", customerName.toUpperCase()],
    ["STATUS OPERACIONAL", equipment.status],
    ["DATA DE ENTRADA", formatDate(equipment.entryDate)],
  ];

  autoTable(doc, {
    startY: 65,
    head: [["PARÂMETRO", "ESPECIFICAÇÃO TÉCNICA"]],
    body: equipData,
    theme: 'striped',
    headStyles: { fillColor: [51, 51, 51], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [248, 250, 252] }
  });

  // Service History
  const lastY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(14);
  doc.text("Histórico de Intervenções e Manutenções", 15, lastY);
  doc.line(15, lastY + 3, 110, lastY + 3);

  const serviceData = equipment.serviceRecords.map((s: ServiceRecord) => [
    formatDate(s.date),
    s.description
  ]);

  autoTable(doc, {
    startY: lastY + 8,
    head: [["DATA/HORA", "DESCRIÇÃO DOS PROCEDIMENTOS REALIZADOS"]],
    body: serviceData.length > 0 ? serviceData : [["-", "Nenhuma intervenção técnica registrada até o momento."]],
    theme: 'grid',
    headStyles: { fillColor: [255, 61, 61], textColor: [255, 255, 255] }
  });

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("ALVS Engineering & Medical - Soluções em Gestão Hospitalar e Engenharia Clínica", pageWidth / 2, pageHeight - 10, { align: "center" });

  doc.save(`ALVS_Laudo_${equipment.code}.pdf`);
};

export const generateGlobalReport = (equipments: Equipment[], customers: Customer[]) => {
  const doc = new jsPDF({ orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header Styling
  doc.setFillColor(51, 51, 51);
  doc.rect(0, 0, pageWidth, 40, 'F');
  doc.setFillColor(255, 61, 61);
  doc.rect(pageWidth - 100, 0, 100, 40, 'F');

  // Draw Logo
  drawLogo(doc, 15, 5, 1.2);

  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text("RELATÓRIO GERENCIAL DE FROTA", pageWidth - 15, 20, { align: "right" });
  doc.setFontSize(10);
  doc.text(`EMISSÃO: ${formatDate(new Date().toISOString())}`, pageWidth - 15, 28, { align: "right" });

  // Dashboard Stats Row
  const total = equipments.length;
  const pending = equipments.filter(e => e.status === EquipmentStatus.PENDING).length;
  const progress = equipments.filter(e => e.status === EquipmentStatus.IN_PROGRESS).length;
  const done = equipments.filter(e => e.status === EquipmentStatus.COMPLETED).length;

  autoTable(doc, {
    startY: 50,
    head: [["KPI: TOTAL DE ATIVOS", "KPI: AGUARDANDO", "KPI: EM REPARO", "KPI: CONCLUÍDOS"]],
    body: [[total, pending, progress, done]],
    theme: 'grid',
    headStyles: { fillColor: [255, 61, 61], textColor: [255, 255, 255], halign: 'center' },
    bodyStyles: { halign: 'center', fontSize: 14, fontStyle: 'bold' }
  });

  // Full Inventory Table
  const currentY = (doc as any).lastAutoTable.finalY + 15;
  const tableData = equipments.map(e => [
    e.code,
    e.name.toUpperCase(),
    `${e.brand} / ${e.model}`.toUpperCase(),
    customers.find(c => c.id === e.customerId)?.name || "N/A",
    e.status,
    formatDate(e.entryDate).split(',')[0]
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [["CÓDIGO", "EQUIPAMENTO", "MARCA/MODELO", "UNIDADE DE SAÚDE", "STATUS", "ENTRADA"]],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [51, 51, 51], fontSize: 10, textColor: [255, 255, 255] },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 40 },
      4: { fontStyle: 'bold' }
    }
  });

  // Pagination Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Página ${i} de ${pageCount} - ALVS Engineering & Medical - Software Proprietário`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }

  doc.save(`ALVS_Relatorio_Consolidado.pdf`);
};
