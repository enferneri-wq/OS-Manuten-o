
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Equipment, ServiceRecord, Customer, EquipmentStatus, Supplier } from "../types.ts";
import { formatDate } from "../utils.ts";

const BRAND_PRIMARY: [number, number, number] = [0, 92, 169];
const DARK_GREY: [number, number, number] = [51, 51, 51];
const LIGHT_GREY: [number, number, number] = [245, 245, 245];

/**
 * Desenha o cabeçalho técnico dinâmico focado exclusivamente na logomarca (imagem)
 */
const drawHeader = (doc: jsPDF, title: string, cnpj: string, brandName: string = "ALVS", logoUrl: string | null = null) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Faixa superior cinza escura
  doc.setFillColor(DARK_GREY[0], DARK_GREY[1], DARK_GREY[2]);
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  // Bloco decorativo azul na direita
  doc.setFillColor(BRAND_PRIMARY[0], BRAND_PRIMARY[1], BRAND_PRIMARY[2]);
  doc.rect(pageWidth - 45, 0, 45, 35, 'F');

  // Identidade Visual Exclusiva
  const x = 15;
  const y = 5;
  
  if (logoUrl) {
    try {
      // Adiciona a imagem personalizada se disponível
      // Proporções mantidas, redimensionado para altura máx de 25
      doc.addImage(logoUrl, 'PNG', x, y, 25, 25, undefined, 'FAST');
    } catch (e) {
      // Fallback em caso de erro na imagem - mostra apenas título do relatório
    }
  } else {
    // Caso não tenha logo, exibimos apenas o nome da marca em fonte estilizada como substituto temporário
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text(brandName.toUpperCase(), x, y + 17);
  }

  // TÍTULO DO RELATÓRIO (CENTRALIZADO)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(title.toUpperCase(), pageWidth / 2, 18, { align: "center" });

  // Informações de Rodapé do Cabeçalho
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("SISTEMA DE GESTÃO TÉCNICA", pageWidth / 2, 24, { align: "center" });
  doc.text(`REGISTRO: ${cnpj}`, pageWidth / 2, 28, { align: "center" });
};

export const generateEquipmentReport = (equipment: Equipment, customerName: string, cnpj: string, brandName?: string, logoUrl?: string | null) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  drawHeader(doc, "Laudo Técnico de Ativo", cnpj, brandName, logoUrl);
  
  doc.setFontSize(11);
  doc.setTextColor(DARK_GREY[0], DARK_GREY[1], DARK_GREY[2]);
  doc.setFont("helvetica", "bold");
  doc.text("1. IDENTIFICAÇÃO DO EQUIPAMENTO", 15, 50);
  doc.setDrawColor(BRAND_PRIMARY[0], BRAND_PRIMARY[1], BRAND_PRIMARY[2]);
  doc.line(15, 52, pageWidth - 15, 52);

  const equipData = [
    ["SITUAÇÃO ATUAL", equipment.status.toUpperCase(), "IDENTIFICAÇÃO", equipment.code],
    ["DESCRIÇÃO", equipment.name.toUpperCase(), "UNIDADE", customerName.toUpperCase()],
    ["MARCA", equipment.brand.toUpperCase(), "MODELO", equipment.model.toUpperCase()],
    ["Nº SÉRIE", equipment.serialNumber, "TÉCNICO RESP.", "SISTEMA"],
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
    formatDate(s.date),
    s.serviceType.toUpperCase(),
    s.isResolved ? "SIM" : "NÃO",
    s.resolution || s.description
  ]);

  autoTable(doc, {
    startY: lastY + 5,
    head: [["DATA/HORA", "TIPO", "RESOLVIDO", "DESCRIÇÃO/RESOLUÇÃO"]],
    body: serviceData.length > 0 ? serviceData : [["-", "-", "-", "Sem registros."]],
    headStyles: { fillColor: DARK_GREY, textColor: [255, 255, 255] as [number, number, number] },
    alternateRowStyles: { fillColor: LIGHT_GREY },
    styles: { fontSize: 7 }
  });

  doc.save(`Laudo_${equipment.code}.pdf`);
};

export const generateServiceOrderReport = (service: ServiceRecord, equipment: Equipment, cnpj: string, brandName?: string, logoUrl?: string | null) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  drawHeader(doc, "Ordem de Serviço (OS)", cnpj, brandName, logoUrl);
  
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
      [`Identificação Interna: ${equipment.code} | Nº de Série: ${equipment.serialNumber}`],
      [`Tipo de Serviço: ${service.serviceType.toUpperCase()}`]
    ],
    theme: 'grid',
    headStyles: { fillColor: BRAND_PRIMARY, textColor: [255, 255, 255] as [number, number, number] },
    styles: { fontSize: 9 }
  });

  const descY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(11);
  doc.text("DESCRIÇÃO DO PROBLEMA", 15, descY);
  doc.rect(15, descY + 3, pageWidth - 30, 30);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(doc.splitTextToSize(service.description, pageWidth - 40), 20, descY + 10);

  const resY = descY + 40;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("AÇÕES TOMADAS (RESOLUÇÃO)", 15, resY);
  doc.rect(15, resY + 3, pageWidth - 30, 40);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(doc.splitTextToSize(service.resolution || "Nenhuma descrição de resolução fornecida.", pageWidth - 40), 20, resY + 10);

  doc.setFont("helvetica", "bold");
  doc.text(`PROBLEMA RESOLVIDO: ${service.isResolved ? "SIM" : "NÃO"}`, 15, resY + 55);
  doc.text(`STATUS FINAL: ${equipment.status.toUpperCase()}`, 15, resY + 62);

  const footerY = doc.internal.pageSize.getHeight() - 40;
  doc.line(20, footerY, 90, footerY);
  doc.text("TÉCNICO RESPONSÁVEL", 35, footerY + 5, { align: 'center' });
  doc.line(pageWidth - 90, footerY, pageWidth - 20, footerY);
  doc.text("RESPONSÁVEL UNIDADE", pageWidth - 55, footerY + 5, { align: 'center' });

  doc.save(`OS_${service.id.slice(0, 5)}.pdf`);
};

export const generateGlobalReport = (equipments: Equipment[], customers: Customer[], cnpj: string, brandName?: string, logoUrl?: string | null) => {
  const doc = new jsPDF({ orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();
  drawHeader(doc, "Relatório Gerencial de Equipamentos", cnpj, brandName, logoUrl);

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
    headStyles: { fillColor: BRAND_PRIMARY },
    styles: { fontSize: 8 }
  });

  doc.save(`Relatorio_Consolidado.pdf`);
};

export const generateCustomerListReport = (customers: Customer[], cnpj: string, brandName?: string, logoUrl?: string | null) => {
  const doc = new jsPDF();
  drawHeader(doc, "Relatório de Unidades de Saúde", cnpj, brandName, logoUrl);
  
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

  doc.save("Relatorio_Unidades.pdf");
};

export const generateSupplierListReport = (suppliers: Supplier[], cnpj: string, brandName?: string, logoUrl?: string | null) => {
  const doc = new jsPDF();
  drawHeader(doc, "Relatório de Fornecedores", cnpj, brandName, logoUrl);
  
  const tableData = suppliers.map(s => [
    s.name.toUpperCase(), s.taxId, s.contactName, s.phone
  ]);

  autoTable(doc, {
    startY: 45,
    head: [["FORNECEDOR", "CNPJ", "CONTATO", "TELEFONE"]],
    body: tableData,
    headStyles: { fillColor: BRAND_PRIMARY },
    styles: { fontSize: 8 },
    alternateRowStyles: { fillColor: LIGHT_GREY }
  });

  doc.save("Relatorio_Fornecedores.pdf");
};
