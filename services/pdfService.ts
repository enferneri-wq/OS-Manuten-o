
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Equipment, ServiceRecord, Customer, EquipmentStatus, Supplier } from "../types.ts";
import { formatDate } from "../utils.ts";

const BRAND_RED: [number, number, number] = [255, 61, 61];
const DARK_GREY: [number, number, number] = [51, 51, 51];
const LIGHT_GREY: [number, number, number] = [245, 245, 245];

const drawHeader = (doc: jsPDF, title: string, cnpj: string) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(DARK_GREY[0], DARK_GREY[1], DARK_GREY[2]);
  doc.rect(0, 0, pageWidth, 35, 'F');
  doc.setFillColor(BRAND_RED[0], BRAND_RED[1], BRAND_RED[2]);
  doc.rect(pageWidth - 70, 0, 70, 35, 'F');

  const x = 15;
  const y = 5;
  const s = 0.9;
  doc.setFillColor(BRAND_RED[0], BRAND_RED[1], BRAND_RED[2]);
  doc.triangle(x + 1*s, y + 2*s, x + 7*s, y + 2*s, x + 1*s, y + 21*s, 'F');
  doc.setFillColor(255, 255, 255);
  doc.triangle(x + 8*s, y + 2*s, x + 47*s, y + 2*s, x + 47*s, y + 21*s, 'F');
  doc.triangle(x + 8*s, y + 2*s, x + 47*s, y + 21*s, x + 2*s, y + 21*s, 'F');
  doc.setTextColor(DARK_GREY[0], DARK_GREY[1], DARK_GREY[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(38 * s);
  doc.text("ALVS", x + 9 * s, y + 17.5 * s);

  const cx = pageWidth - 45;
  const cy = 7;
  doc.setFillColor(255, 255, 255);
  doc.rect(cx, cy, 18, 18, 'F');
  doc.setFillColor(BRAND_RED[0], BRAND_RED[1], BRAND_RED[2]);
  doc.rect(cx + 3, cy + 7.5, 12, 3, 'F');
  doc.rect(cx + 7.5, cy + 3, 3, 12, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text(title, pageWidth - 15, 20, { align: "right" });
  doc.setFontSize(8);
  doc.text(`CNPJ: ${cnpj}`, 15, 30);
  doc.text("ENGINEERING & MEDICAL", 15, 26);
};

export const generateEquipmentReport = (equipment: Equipment, customerName: string, cnpj: string) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  drawHeader(doc, "LAUDO TÉCNICO DE ATIVO", cnpj);
  doc.setFontSize(11);
  doc.setTextColor(DARK_GREY[0], DARK_GREY[1], DARK_GREY[2]);
  doc.setFont("helvetica", "bold");
  doc.text("1. IDENTIFICAÇÃO DO EQUIPAMENTO", 15, 50);
  doc.setDrawColor(BRAND_RED[0], BRAND_RED[1], BRAND_RED[2]);
  doc.line(15, 52, pageWidth - 15, 52);

  const equipData = [
    ["CÓDIGO ALVS", equipment.code, "SITUAÇÃO", equipment.status.toUpperCase()],
    ["DESCRIÇÃO", equipment.name.toUpperCase(), "UNIDADE", customerName.toUpperCase()],
    ["MARCA", equipment.brand.toUpperCase(), "MODELO", equipment.model.toUpperCase()],
    ["Nº SÉRIE", equipment.serialNumber, "FABRICANTE", equipment.manufacturer.toUpperCase()],
  ];

  autoTable(doc, {
    startY: 55,
    body: equipData,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 
      0: { fontStyle: 'bold', fillColor: [240, 240, 240] as [number, number, number], cellWidth: 35 },
      2: { fontStyle: 'bold', fillColor: [240, 240, 240] as [number, number, number], cellWidth: 35 }
    }
  });

  const lastY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(11);
  doc.text("2. HISTÓRICO DE MANUTENÇÕES", 15, lastY);
  const serviceData = (equipment.serviceRecords || []).map((s: ServiceRecord) => [
    formatDate(s.date).split(',')[0],
    s.description
  ]);

  autoTable(doc, {
    startY: lastY + 5,
    head: [["DATA", "PROCEDIMENTOS TÉCNICOS"]],
    body: serviceData.length > 0 ? serviceData : [["-", "Sem registros."]],
    headStyles: { fillColor: DARK_GREY, textColor: [255, 255, 255] as [number, number, number] },
    alternateRowStyles: { fillColor: LIGHT_GREY },
    styles: { fontSize: 8 }
  });

  doc.save(`ALVS_Laudo_${equipment.code}.pdf`);
};

export const generateServiceOrderReport = (service: ServiceRecord, equipment: Equipment, cnpj: string) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  drawHeader(doc, "ORDEM DE SERVIÇO (OS)", cnpj);
  doc.setFontSize(10);
  doc.setTextColor(DARK_GREY[0], DARK_GREY[1], DARK_GREY[2]);
  doc.setFont("helvetica", "bold");
  doc.text(`Nº DA ORDEM: ${service.id.slice(0, 8).toUpperCase()}`, 15, 45);
  doc.text(`EMISSÃO: ${formatDate(service.date)}`, pageWidth - 15, 45, { align: "right" });

  autoTable(doc, {
    startY: 50,
    head: [["DETALHES DO ATIVO"]],
    body: [
      [`${equipment.name} | Marca: ${equipment.brand} | Modelo: ${equipment.model}`],
      [`Identificação ALVS: ${equipment.code} | Nº de Série: ${equipment.serialNumber}`]
    ],
    theme: 'grid',
    headStyles: { fillColor: BRAND_RED, textColor: [255, 255, 255] as [number, number, number] },
    styles: { fontSize: 9 }
  });

  const descY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(11);
  doc.text("LAUDO TÉCNICO E PROCEDIMENTOS", 15, descY);
  doc.rect(15, descY + 3, pageWidth - 30, 80);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(doc.splitTextToSize(service.description, pageWidth - 40), 20, descY + 10);
  doc.setFont("helvetica", "bold");
  doc.text(`STATUS FINAL: ${equipment.status.toUpperCase()}`, 15, descY + 90);

  const footerY = doc.internal.pageSize.getHeight() - 40;
  doc.line(20, footerY, 90, footerY);
  doc.text("TECNICO RESPONSÁVEL", 35, footerY + 5, { align: 'center' });
  doc.line(pageWidth - 90, footerY, pageWidth - 20, footerY);
  doc.text("RESPONSÁVEL UNIDADE", pageWidth - 55, footerY + 5, { align: 'center' });

  doc.save(`ALVS_OS_${service.id.slice(0, 5)}.pdf`);
};

export const generateGlobalReport = (equipments: Equipment[], customers: Customer[], cnpj: string) => {
  const doc = new jsPDF({ orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();
  drawHeader(doc, "RELATÓRIO GERENCIAL DE FROTA", cnpj);

  const total = equipments.length;
  const inMaint = equipments.filter(e => e.status === EquipmentStatus.IN_PROGRESS).length;
  const pending = equipments.filter(e => e.status === EquipmentStatus.PENDING).length;

  autoTable(doc, {
    startY: 40,
    head: [["TOTAL ATIVOS", "EM MANUTENÇÃO", "AGUARDANDO PEÇAS"]],
    body: [[total, inMaint, pending]],
    theme: 'grid',
    headStyles: { fillColor: DARK_GREY, halign: 'center' },
    bodyStyles: { halign: 'center', fontSize: 14, fontStyle: 'bold' }
  });

  const tableData = equipments.map(e => [
    e.code, e.name.toUpperCase(), `${e.brand}/${e.model}`,
    customers.find(c => c.id === e.customerId)?.name || "N/A",
    e.status, formatDate(e.entryDate).split(',')[0]
  ]);

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 10,
    head: [["CÓDIGO", "EQUIPAMENTO", "MARCA/MODELO", "UNIDADE", "STATUS", "ENTRADA"]],
    body: tableData,
    headStyles: { fillColor: BRAND_RED },
    styles: { fontSize: 8 }
  });

  doc.save(`ALVS_Relatorio_Consolidado.pdf`);
};

export const generateCustomerListReport = (customers: Customer[], cnpj: string) => {
  const doc = new jsPDF();
  drawHeader(doc, "RELATÓRIO DE UNIDADES DE SAÚDE", cnpj);
  
  const tableData = customers.map(c => [
    c.name.toUpperCase(), c.taxId, c.email, c.phone
  ]);

  autoTable(doc, {
    startY: 45,
    head: [["UNIDADE / RAZÃO SOCIAL", "CNPJ / CPF", "E-MAIL", "CONTATO"]],
    body: tableData,
    headStyles: { fillColor: DARK_GREY },
    styles: { fontSize: 8 },
    alternateRowStyles: { fillColor: LIGHT_GREY }
  });

  doc.save("ALVS_Relatorio_Unidades.pdf");
};

export const generateSupplierListReport = (suppliers: Supplier[], cnpj: string) => {
  const doc = new jsPDF();
  drawHeader(doc, "RELATÓRIO DE FORNECEDORES", cnpj);
  
  const tableData = suppliers.map(s => [
    s.name.toUpperCase(), s.taxId, s.contactName, s.phone
  ]);

  autoTable(doc, {
    startY: 45,
    head: [["FORNECEDOR", "CNPJ", "CONTATO", "TELEFONE"]],
    body: tableData,
    headStyles: { fillColor: BRAND_RED },
    styles: { fontSize: 8 },
    alternateRowStyles: { fillColor: LIGHT_GREY }
  });

  doc.save("ALVS_Relatorio_Fornecedores.pdf");
};
