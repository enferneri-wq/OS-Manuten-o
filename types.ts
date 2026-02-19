
export enum EquipmentStatus {
  PENDING = 'Aguardando Serviço',
  IN_PROGRESS = 'Em Manutenção',
  COMPLETED = 'Concluído',
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
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
}

export interface ServiceRecord {
  id: string;
  equipmentId: string;
  date: string;
  description: string;
  technicianId: string;
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
  serviceRecords: ServiceRecord[];
}

export type EntityType = 'equipment' | 'customer' | 'supplier' | 'user';
