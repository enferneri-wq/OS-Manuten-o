import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Equipment, ServiceRecord } from "../types.ts";
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