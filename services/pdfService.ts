
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Equipment, ServiceRecord, Customer, EquipmentStatus } from "../types.ts";
import { formatDate } from "../utils.ts";

export const generateEquipmentReport = (equipment: Equipment, customerName: string) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Branding Header Rectangles
  doc.setFillColor(51, 51, 51); // Dark Grey
  doc.rect(0, 0, pageWidth, 40, 'F');
  doc.setFillColor(255, 61, 61); // Brand Red
  doc.rect(pageWidth - 60, 0, 60, 40, 'F');

  // Header Text
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text("ALVS ENGINEERING", 15, 20);
  doc.setFontSize(14);
  doc.text("& MEDICAL", 15, 28);
  
  doc.setFontSize(10);
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
  doc.rect(0, 0, pageWidth, 35, 'F');
  doc.setFillColor(255, 61, 61);
  doc.rect(pageWidth - 80, 0, 80, 35, 'F');

  doc.setFontSize(24);
  doc.setTextColor(255, 255, 255);
  doc.text("ALVS ENGINEERING & MEDICAL", 15, 18);
  doc.setFontSize(12);
  doc.text("RELATÓRIO GERENCIAL DE FROTA E ATIVOS", 15, 26);
  
  doc.setFontSize(10);
  doc.text(`EMITIDO EM: ${formatDate(new Date().toISOString())}`, pageWidth - 15, 20, { align: "right" });

  // Dashboard Stats Row
  const total = equipments.length;
  const pending = equipments.filter(e => e.status === EquipmentStatus.PENDING).length;
  const progress = equipments.filter(e => e.status === EquipmentStatus.IN_PROGRESS).length;
  const done = equipments.filter(e => e.status === EquipmentStatus.COMPLETED).length;

  autoTable(doc, {
    startY: 45,
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
