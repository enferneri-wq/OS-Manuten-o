
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Equipment, ServiceRecord, Customer, EquipmentStatus } from "../types.ts";
import { formatDate } from "../utils.ts";

/**
 * Desenha a logomarca ALVS fielmente no documento PDF com CNPJ
 */
const drawLogo = (doc: jsPDF, x: number, y: number, scale: number = 0.5, cnpj?: string) => {
  const brandRed = [255, 61, 61];
  const darkGrey = [51, 51, 51];

  doc.setFillColor(brandRed[0], brandRed[1], brandRed[2]);
  doc.triangle(x + 1 * scale, y + 2 * scale, x + 7 * scale, y + 2 * scale, x + 1 * scale, y + 21 * scale, 'F');

  doc.setFillColor(darkGrey[0], darkGrey[1], darkGrey[2]);
  doc.triangle(x + 8 * scale, y + 2 * scale, x + 47 * scale, y + 2 * scale, x + 47 * scale, y + 21 * scale, 'F');
  doc.triangle(x + 8 * scale, y + 2 * scale, x + 47 * scale, y + 21 * scale, x + 2 * scale, y + 21 * scale, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(38 * scale);
  doc.text("ALVS", x + 9 * scale, y + 17.5 * scale);

  doc.setFillColor(brandRed[0], brandRed[1], brandRed[2]);
  doc.rect(x + 48 * scale, y + 2 * scale, 21 * scale, 21 * scale, 'F');

  doc.setFillColor(255, 255, 255);
  const cx = x + 48 * scale;
  const cy = y + 2 * scale;
  doc.rect(cx + 3 * scale, cy + 8 * scale, 15 * scale, 5 * scale, 'F');
  doc.rect(cx + 8 * scale, cy + 3 * scale, 5 * scale, 15 * scale, 'F');

  doc.setTextColor(darkGrey[0], darkGrey[1], darkGrey[2]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10 * scale);
  doc.text("ENGINEERING & MEDICAL", x + 1 * scale, y + 26 * scale, { charSpace: 0.5 });
  
  if (cnpj) {
    doc.setFontSize(8 * scale);
    doc.setFont("helvetica", "bold");
    doc.text(`CNPJ: ${cnpj}`, x + 1 * scale, y + 31 * scale);
  }
};

export const generateEquipmentReport = (equipment: Equipment, customerName: string, cnpj: string) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(51, 51, 51);
  doc.rect(0, 0, pageWidth, 40, 'F');
  doc.setFillColor(255, 61, 61);
  doc.rect(pageWidth - 80, 0, 80, 40, 'F');

  drawLogo(doc, 15, 5, 1.1, cnpj);
  
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text("LAUDO TÉCNICO DE EQUIPAMENTO", pageWidth - 15, 20, { align: "right" });
  doc.text(`${formatDate(new Date().toISOString()).split(',')[0]}`, pageWidth - 15, 28, { align: "right" });

  const equipData = [
    ["CÓDIGO INTERNO", equipment.code],
    ["EQUIPAMENTO", equipment.name.toUpperCase()],
    ["MARCA/MODELO", `${equipment.brand} / ${equipment.model}`.toUpperCase()],
    ["Nº DE SÉRIE", equipment.serialNumber],
    ["UNIDADE SOLICITANTE", customerName.toUpperCase()],
    ["STATUS ATUAL", equipment.status],
  ];

  autoTable(doc, {
    startY: 65,
    head: [["PARÂMETRO", "ESPECIFICAÇÃO TÉCNICA"]],
    body: equipData,
    theme: 'striped',
    headStyles: { fillColor: [51, 51, 51], textColor: [255, 255, 255] }
  });

  const lastY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(14);
  doc.setTextColor(51, 51, 51);
  doc.text("HISTÓRICO DE MANUTENÇÃO", 15, lastY);

  const serviceData = equipment.serviceRecords.map((s: ServiceRecord) => [
    formatDate(s.date),
    s.description
  ]);

  autoTable(doc, {
    startY: lastY + 5,
    head: [["DATA/HORA", "DESCRIÇÃO DOS PROCEDIMENTOS"]],
    body: serviceData.length > 0 ? serviceData : [["-", "Sem registros."]],
    theme: 'grid',
    headStyles: { fillColor: [255, 61, 61], textColor: [255, 255, 255] }
  });

  doc.save(`ALVS_Equipamento_${equipment.code}.pdf`);
};

export const generateServiceOrderReport = (service: ServiceRecord, equipment: Equipment, cnpj: string) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(255, 61, 61);
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  drawLogo(doc, 15, 5, 1.1, cnpj);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text("ORDEM DE SERVIÇO TÉCNICO", pageWidth - 15, 20, { align: "right" });
  doc.setFontSize(10);
  doc.text(`ID OS: ${service.id.slice(0,8).toUpperCase()}`, pageWidth - 15, 28, { align: "right" });

  doc.setFontSize(12);
  doc.setTextColor(51, 51, 51);
  doc.text("DETALHES DO ATENDIMENTO", 15, 55);
  doc.line(15, 57, 80, 57);

  const data = [
    ["DATA DO SERVIÇO", formatDate(service.date)],
    ["EQUIPAMENTO", equipment.name],
    ["CÓDIGO ATIVO", equipment.code],
    ["MARCA/MODELO", `${equipment.brand} / ${equipment.model}`],
    ["NÚMERO DE SÉRIE", equipment.serialNumber],
    ["TÉCNICO RESPONSÁVEL", "Engenharia Clínica ALVS"],
  ];

  autoTable(doc, {
    startY: 65,
    body: data,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } }
  });

  const nextY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(12);
  doc.text("DESCRIÇÃO TÉCNICA DAS ATIVIDADES", 15, nextY);
  
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  const splitDesc = doc.splitTextToSize(service.description, pageWidth - 30);
  doc.text(splitDesc, 15, nextY + 8);

  const footerY = doc.internal.pageSize.getHeight() - 40;
  doc.line(15, footerY, 90, footerY);
  doc.text("Assinatura do Técnico", 35, footerY + 5);
  
  doc.line(pageWidth - 90, footerY, pageWidth - 15, footerY);
  doc.text("Assinatura do Cliente", pageWidth - 70, footerY + 5);

  doc.save(`ALVS_OS_${service.id.slice(0,5)}.pdf`);
};

export const generateGlobalReport = (equipments: Equipment[], customers: Customer[], cnpj: string) => {
  const doc = new jsPDF({ orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(51, 51, 51);
  doc.rect(0, 0, pageWidth, 40, 'F');
  doc.setFillColor(255, 61, 61);
  doc.rect(pageWidth - 100, 0, 100, 40, 'F');

  drawLogo(doc, 15, 5, 1.2, cnpj);
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text("RELATÓRIO GERENCIAL DE FROTA", pageWidth - 15, 20, { align: "right" });

  const tableData = equipments.map(e => [
    e.code, e.name.toUpperCase(), `${e.brand} / ${e.model}`,
    customers.find(c => c.id === e.customerId)?.name || "N/A",
    e.status, formatDate(e.entryDate).split(',')[0]
  ]);

  autoTable(doc, {
    startY: 50,
    head: [["CÓDIGO", "EQUIPAMENTO", "MARCA/MODELO", "UNIDADE", "STATUS", "ENTRADA"]],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [51, 51, 51] }
  });

  doc.save(`ALVS_Relatorio_Consolidado.pdf`);
};
