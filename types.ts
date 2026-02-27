
export enum EquipmentStatus {
  PENDING = 'Aguardando Serviço',
  IN_PROGRESS = 'Em Manutenção',
  COMPLETED = 'Concluído',
  READY = 'Aguardando Retirada',
  DELIVERED = 'Entregue',
  CANCELLED = 'Cancelado'
}

export enum UserRole {
  ADMIN = 'Administrador',
  TECHNICIAN = 'Técnico',
  VIEWER = 'Visualizador'
}

export interface Customer {
  id: string;
  name: string;
  taxId: string; // CPF/CNPJ
  email: string;
  phone: string;
  address: string;
}

export interface Supplier {
  id: string;
  name: string;
  taxId: string;
  contactName: string;
  email: string;
  phone: string;
  equipmentId?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  date: string;
}

export interface ServiceRecord {
  id: string;
  equipmentId: string;
  date: string;
  description: string;
  serviceType: string;
  technicianId: string;
  isResolved: boolean;
  resolution: string;
  attachments?: Attachment[];
}

export interface Equipment {
  id: string;
  code: string; // Unique auto-generated code
  name: string;
  brand: string;
  model: string;
  manufacturer: string;
  serialNumber: string;
  entryDate: string; // ISO date string
  observations: string;
  status: EquipmentStatus;
  customerId: string;
  supplierId?: string;
  serviceRecords: ServiceRecord[];
  attachments?: Attachment[];
}

export type EntityType = 'equipment' | 'customer' | 'supplier' | 'user';
