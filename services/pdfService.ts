
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Equipment, ServiceRecord, Customer, EquipmentStatus } from "../types.ts";
import { formatDate } from "../utils.ts";

export const generateEquipmentReport = (equipment: Equipment, customerName: string) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(20);
  doc.setTextColor(30, 64, 175);
  doc.text("ALVS ENGINEERING & MEDICAL", 105, 20, { align: "center" });
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text("Relatório Técnico de Equipamento", 105, 28, { align: "center" });
  doc.text(`Gerado em: ${formatDate(new Date().toISOString())}`, pageWidth - 20, 15, { align: "right" });

  // Equipment Details
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text("Informações do Ativo", 20, 45);
  doc.setLineWidth(0.5);
  doc.line(20, 47, 190, 47);

  const equipData = [
    ["Código ALVS", equipment.code],
    ["Equipamento", equipment.name],
    ["Marca/Modelo", `${equipment.brand} / ${equipment.model}`],
    ["Fabricante", equipment.manufacturer],
    ["Nº de Série", equipment.serialNumber],
    ["Unidade/Cliente", customerName],
    ["Status Atual", equipment.status],
    ["Data de Entrada", formatDate(equipment.entryDate)],
  ];

  autoTable(doc, {
    startY: 52,
    head: [["Atributo", "Detalhes"]],
    body: equipData,
    theme: 'striped',
    headStyles: { fillColor: [30, 64, 175] }
  });

  // Service History
  const lastY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(14);
  doc.text("Histórico de Intervenções", 20, lastY);
  doc.line(20, lastY + 2, 190, lastY + 2);

  const serviceData = equipment.serviceRecords.map((s: ServiceRecord) => [
    formatDate(s.date),
    s.description
  ]);

  autoTable(doc, {
    startY: lastY + 7,
    head: [["Data/Hora", "Descrição Técnica do Serviço"]],
    body: serviceData.length > 0 ? serviceData : [["-", "Nenhuma ordem de serviço registrada"]],
    theme: 'grid',
    headStyles: { fillColor: [71, 85, 105] }
  });

  doc.save(`ALVS_Relatorio_${equipment.code}.pdf`);
};

export const generateGlobalReport = (equipments: Equipment[], customers: Customer[]) => {
  const doc = new jsPDF({ orientation: 'landscape' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(22);
  doc.setTextColor(30, 64, 175);
  doc.text("ALVS ENGINEERING & MEDICAL", pageWidth / 2, 20, { align: "center" });
  
  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text("Relatório Gerencial Completo de Engenharia Clínica", pageWidth / 2, 28, { align: "center" });
  doc.text(`Data de Emissão: ${formatDate(new Date().toISOString())}`, pageWidth - 20, 15, { align: "right" });

  // Resumo Executivo
  const total = equipments.length;
  const pending = equipments.filter(e => e.status === EquipmentStatus.PENDING).length;
  const progress = equipments.filter(e => e.status === EquipmentStatus.IN_PROGRESS).length;
  const done = equipments.filter(e => e.status === EquipmentStatus.COMPLETED).length;

  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text("Resumo da Frota", 20, 45);
  doc.setLineWidth(0.5);
  doc.line(20, 47, pageWidth - 20, 47);

  autoTable(doc, {
    startY: 52,
    head: [["Total de Ativos", "Aguardando Serviço", "Em Manutenção", "Concluídos"]],
    body: [[total, pending, progress, done]],
    theme: 'grid',
    headStyles: { fillColor: [30, 64, 175], halign: 'center' },
    bodyStyles: { halign: 'center', fontSize: 12, fontStyle: 'bold' }
  });

  // Tabela Detalhada de Ativos
  const currentY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(14);
  doc.text("Inventário Detalhado", 20, currentY);
  doc.line(20, currentY + 2, pageWidth - 20, currentY + 2);

  const tableData = equipments.map(e => [
    e.code,
    e.name,
    `${e.brand} / ${e.model}`,
    customers.find(c => c.id === e.customerId)?.name || "N/A",
    e.status,
    formatDate(e.entryDate).split(',')[0]
  ]);

  autoTable(doc, {
    startY: currentY + 7,
    head: [["CÓDIGO", "EQUIPAMENTO", "MARCA/MODELO", "UNIDADE DE SAÚDE", "STATUS", "ENTRADA"]],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [71, 85, 105], fontSize: 10 },
    columnStyles: {
      0: { cellWidth: 35 },
      4: { fontStyle: 'bold' }
    }
  });

  // Rodapé em todas as páginas
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Página ${i} de ${pageCount} - ALVS Engineering & Medical - Software de Gestão Hospitalar`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }

  doc.save(`ALVS_Relatorio_Geral_${new Date().getTime()}.pdf`);
};
