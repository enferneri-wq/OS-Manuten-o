
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, Users, Search, 
  Plus, FileText, Wrench, 
  CheckCircle2, AlertCircle, Building2, 
  HardDrive, BarChart3, PieChart as PieChartIcon,
  LogOut, X, History, ArrowRight,
  Sparkles, RefreshCw, MapPin, Phone, Mail,
  Download, Briefcase, Factory, Settings,
  Upload, Trash2, Image as ImageIcon, Paperclip,
  Lock, User as UserIcon, Shield, Pencil
} from 'lucide-react';
import { 
  ResponsiveContainer, PieChart, Pie, Cell, 
  Tooltip, BarChart, Bar, XAxis, YAxis
} from 'recharts';
import { 
  Equipment, Customer, EquipmentStatus, 
  ServiceRecord, Supplier, Attachment, User, UserRole 
} from './types.ts';
import { generateUniqueCode, generateUUID, formatDate, fileToBase64 } from './utils.ts';
import { 
  generateEquipmentReport, 
  generateGlobalReport, 
  generateServiceOrderReport,
  generateCustomerListReport,
  generateSupplierListReport
} from './services/pdfService.ts';
import { getMaintenanceAdvice } from './services/geminiService.ts';

const API_URL = 'api.php';
const STORAGE_KEY_EQUIP = 'alvs_equipments';
const STORAGE_KEY_CUST = 'alvs_customers';
const STORAGE_KEY_SUPP = 'alvs_suppliers';
const STORAGE_KEY_BRAND = 'alvs_brand_config';

const INITIAL_CUSTOMERS: Customer[] = [
  { id: 'c1', name: 'Hospital das Clínicas', taxId: '12.345.678/0001-90', email: 'contato@hc.org', phone: '(11) 98888-7777', address: 'Av. Paulista, 1000' },
  { id: 'c2', name: 'Clínica Saúde Vital', taxId: '98.765.432/0001-21', email: 'adm@saudevital.com', phone: '(11) 97777-6666', address: 'Rua das Flores, 45' },
];

const INITIAL_SUPPLIERS: Supplier[] = [
  { id: 's1', name: 'MedTech Supplies', taxId: '44.555.666/0001-22', contactName: 'Ricardo', email: 'vendas@medtech.com', phone: '(11) 95555-4444' },
];

const ALVS_CNPJ = "51.795.594/0001-05";

interface BrandConfig {
  name: string;
  slogan: string;
  logoUrl: string | null;
}

const Logo = ({ config, className = "h-12" }: { config: BrandConfig, className?: string }) => {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      {config.logoUrl ? (
        <img src={config.logoUrl} alt="Logo" className="max-h-16 w-auto object-contain transition-transform hover:scale-105" />
      ) : (
        <div className="flex flex-col items-center gap-1 opacity-20">
          <ImageIcon size={32} className="text-slate-400" />
          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Sem Logo</span>
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'equipment' | 'customers' | 'suppliers'>('dashboard');
  const [brandConfig, setBrandConfig] = useState<BrandConfig>({
    name: 'ALVS',
    slogan: 'Engineering & Medical',
    logoUrl: null
  });

  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>(INITIAL_CUSTOMERS);
  const [suppliers, setSuppliers] = useState<Supplier[]>(INITIAL_SUPPLIERS);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const [isEquipModalOpen, setIsEquipModalOpen] = useState(false);
  const [isAttachmentModalOpen, setIsAttachmentModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [isEquipHistoryModalOpen, setIsEquipHistoryModalOpen] = useState(false);
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editingServiceRecord, setEditingServiceRecord] = useState<{ record: ServiceRecord; equipment: Equipment } | null>(null);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [tempAttachments, setTempAttachments] = useState<Attachment[]>([]);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedCompanyEquipId, setSelectedCompanyEquipId] = useState<string | null>(null);
  const [newCustomerEquipPhoto, setNewCustomerEquipPhoto] = useState<string | null>(null);
  const [newCustomerEquipAttachments, setNewCustomerEquipAttachments] = useState<Attachment[]>([]);
  const [newEquipPhoto, setNewEquipPhoto] = useState<string | null>(null);
  const [newEquipAttachments, setNewEquipAttachments] = useState<Attachment[]>([]);
  const [equipFormCustomerId, setKeepEquipFormCustomerId] = useState<string>('');

  const openEquipModal = (companyId?: string) => {
    if (companyId) {
      setKeepEquipFormCustomerId(companyId);
    } else if (selectedCompanyId) {
      setKeepEquipFormCustomerId(selectedCompanyId);
    } else if (customers.length > 0) {
      setKeepEquipFormCustomerId(customers[0].id);
    } else {
      setKeepEquipFormCustomerId('');
    }
    setIsEquipModalOpen(true);
  };

  const getLastMaintenanceInfo = (equip: Equipment) => {
    if (!equip.serviceRecords || equip.serviceRecords.length === 0) {
      return { date: 'Nenhuma realizada', details: 'Sem registros de manutenção.' };
    }
    const sorted = [...equip.serviceRecords].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const last = sorted[0];
    return {
      date: formatDate(last.date),
      details: last.resolution || last.description || 'Sem descrição.'
    };
  };

  const handleEquipmentPhotoUpload = async (equipId: string, file: File) => {
    try {
      const base64 = await fileToBase64(file);
      const updated = equipments.map(eq => {
        if (eq.id === equipId) {
          return { ...eq, photoUrl: base64 };
        }
        return eq;
      });
      setEquipments(updated);
    } catch (err) {
      console.error("Error uploading photo:", err);
    }
  };

  useEffect(() => {
    if (customers.length > 0 && !selectedCompanyId) {
      setSelectedCompanyId(customers[0].id);
    }
  }, [customers, selectedCompanyId]);

  useEffect(() => {
    if (selectedCompanyId) {
      const companyEquips = equipments.filter(e => e.customerId === selectedCompanyId);
      if (companyEquips.length > 0) {
        setSelectedCompanyEquipId(companyEquips[0].id);
      } else {
        setSelectedCompanyEquipId(null);
      }
    }
  }, [selectedCompanyId, equipments]);

  const loadLocalData = () => {
    const savedEquip = localStorage.getItem(STORAGE_KEY_EQUIP);
    const savedCust = localStorage.getItem(STORAGE_KEY_CUST);
    const savedSupp = localStorage.getItem(STORAGE_KEY_SUPP);
    const savedBrand = localStorage.getItem(STORAGE_KEY_BRAND);
    const savedUser = localStorage.getItem('alvs_user');
    
    if (savedEquip) setEquipments(JSON.parse(savedEquip));
    if (savedCust) setCustomers(JSON.parse(savedCust));
    if (savedSupp) setSuppliers(JSON.parse(savedSupp));
    if (savedBrand) {
      const parsedBrand = JSON.parse(savedBrand);
      setBrandConfig(parsedBrand);
      setLogoPreview(parsedBrand.logoUrl);
    }
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('alvs_user');
    setUser(null);
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>, equipId: string) => {
    const file = e.target.files?.[0];
    if (file) {
      handleEquipmentPhotoUpload(equipId, file);
    }
  };

  const syncData = async () => {
    setLoading(true);
    try {
      const resEquip = await fetch(`${API_URL}?action=get_all`);
      if (resEquip.ok) {
        const data = await resEquip.json();
        if (Array.isArray(data)) setEquipments(data);
      }
      const resCust = await fetch(`${API_URL}?action=get_customers`);
      if (resCust.ok) {
        const data = await resCust.json();
        if (Array.isArray(data)) setCustomers(data);
      }
    } catch (error) {
      loadLocalData();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLocalData();
    syncData();
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_EQUIP, JSON.stringify(equipments));
    localStorage.setItem(STORAGE_KEY_CUST, JSON.stringify(customers));
    localStorage.setItem(STORAGE_KEY_SUPP, JSON.stringify(suppliers));
    localStorage.setItem(STORAGE_KEY_BRAND, JSON.stringify(brandConfig));
  }, [equipments, customers, suppliers, brandConfig]);

  const stats = useMemo(() => {
    const recentServices = equipments
      .flatMap(e => (e.serviceRecords || []).map(s => ({ ...s, equipName: e.name, equipCode: e.code, serviceType: s.serviceType, isResolved: s.isResolved })))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);

    return { recentServices };
  }, [equipments]);

  const filteredEquipments = equipments.filter(e => {
    const customer = customers.find(c => c.id === e.customerId);
    const supplier = suppliers.find(s => s.id === e.supplierId);
    const hasServiceType = e.serviceRecords?.some(s => s.serviceType.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      e.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      supplier?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hasServiceType;
  });

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.taxId.includes(searchQuery)
  );

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.taxId.includes(searchQuery)
  );

  const filteredServices = stats.recentServices.filter(s => 
    s.equipName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.equipCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateBrand = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBrandConfig({
      name: fd.get('name') as string,
      slogan: fd.get('slogan') as string,
      logoUrl: logoPreview
    });
    setIsBrandModalOpen(false);
  };

  const handleAddEquipment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newItem: Equipment = {
      id: generateUUID(), 
      code: generateUniqueCode(brandConfig.name),
      name: fd.get('name') as string, 
      brand: fd.get('brand') as string,
      model: fd.get('model') as string, 
      manufacturer: fd.get('manufacturer') as string,
      serialNumber: fd.get('serialNumber') as string, 
      entryDate: new Date().toISOString(),
      observations: fd.get('observations') as string, 
      status: EquipmentStatus.PENDING,
      customerId: fd.get('customerId') as string, 
      supplierId: fd.get('supplierId') as string,
      serviceRecords: [],
      attachments: newEquipAttachments,
      photoUrl: newEquipPhoto || undefined,
      technicalReport: (fd.get('technicalReport') as string) || ''
    };
    setEquipments([newItem, ...equipments]);
    setNewEquipPhoto(null);
    setNewEquipAttachments([]);
    setIsEquipModalOpen(false);
  };

  const handleAddCustomer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newCustId = generateUUID();
    const newCust: Customer = {
      id: newCustId,
      name: fd.get('name') as string,
      taxId: fd.get('taxId') as string,
      email: fd.get('email') as string,
      phone: fd.get('phone') as string,
      address: fd.get('address') as string,
    };
    setCustomers([newCust, ...customers]);

    // Check if initial equipment is provided
    const equipName = fd.get('equipName') as string;
    if (equipName && equipName.trim() !== '') {
      const newEquip: Equipment = {
        id: generateUUID(),
        code: generateUniqueCode(brandConfig.name),
        name: equipName,
        brand: (fd.get('equipBrand') as string) || '',
        model: '',
        manufacturer: '',
        serialNumber: (fd.get('equipSerial') as string) || 'S/N',
        entryDate: new Date().toISOString(),
        observations: 'Cadastrado junto com a empresa.',
        status: EquipmentStatus.PENDING,
        customerId: newCustId,
        supplierId: '',
        serviceRecords: [],
        attachments: newCustomerEquipAttachments,
        photoUrl: newCustomerEquipPhoto || undefined,
        technicalReport: (fd.get('equipTechnicalReport') as string) || ''
      };
      setEquipments(prev => [newEquip, ...prev]);
    }

    setNewCustomerEquipPhoto(null);
    setNewCustomerEquipAttachments([]);
    setSelectedCompanyId(newCustId); // Auto-select the newly created company
    setIsCustomerModalOpen(false);
  };

  const handleDeleteCustomer = (customerId: string) => {
    setCustomers(prev => {
      const updated = prev.filter(c => c.id !== customerId);
      if (selectedCompanyId === customerId) {
        if (updated.length > 0) {
          setSelectedCompanyId(updated[0].id);
        } else {
          setSelectedCompanyId(null);
          setSelectedCompanyEquipId(null);
        }
      }
      return updated;
    });
    setEquipments(prev => prev.filter(e => e.customerId !== customerId));
    setCustomerToDelete(null);
  };

  const handleUpdateCustomer = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingCustomer) return;
    const fd = new FormData(e.currentTarget);
    const updatedCustomer: Customer = {
      ...editingCustomer,
      name: fd.get('name') as string,
      taxId: fd.get('taxId') as string,
      email: fd.get('email') as string,
      phone: fd.get('phone') as string,
      address: fd.get('address') as string,
    };
    setCustomers(prev => prev.map(c => c.id === editingCustomer.id ? updatedCustomer : c));
    setEditingCustomer(null);
  };

  const handleUpdateServiceRecord = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingServiceRecord) return;
    const { record, equipment } = editingServiceRecord;
    const fd = new FormData(e.currentTarget);
    const isResolved = fd.get('isResolved') === 'on';
    const isDelivered = fd.get('isDelivered') === 'on';

    const updatedRecord: ServiceRecord = {
      ...record,
      serviceType: fd.get('serviceType') as string,
      description: fd.get('description') as string,
      resolution: fd.get('resolution') as string,
      isResolved: isResolved,
      isDelivered: isDelivered,
    };

    // Auto status update based on transition
    let newStatus = EquipmentStatus.PENDING;
    if (isDelivered) {
      newStatus = EquipmentStatus.DELIVERED;
    } else if (isResolved) {
      newStatus = EquipmentStatus.READY;
    }

    setEquipments(prev => prev.map(eq => {
      if (eq.id === equipment.id) {
        const updatedRecords = eq.serviceRecords.map(r => r.id === record.id ? updatedRecord : r);
        return { 
          ...eq, 
          status: newStatus,
          serviceRecords: updatedRecords 
        };
      }
      return eq;
    }));

    setEditingServiceRecord(null);
  };

  const handleUpdateEquipment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingEquipment) return;
    const fd = new FormData(e.currentTarget);
    const updatedEquip: Equipment = {
      ...editingEquipment,
      name: fd.get('name') as string,
      brand: fd.get('brand') as string,
      model: fd.get('model') as string,
      serialNumber: fd.get('serialNumber') as string,
      observations: fd.get('observations') as string,
      status: fd.get('status') as EquipmentStatus,
      technicalReport: fd.get('technicalReport') as string,
    };
    setEquipments(prev => prev.map(eq => eq.id === editingEquipment.id ? updatedEquip : eq));
    setEditingEquipment(null);
  };

  const handleAddSupplier = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newSupp: Supplier = {
      id: generateUUID(),
      name: fd.get('name') as string,
      taxId: fd.get('taxId') as string,
      contactName: fd.get('contactName') as string,
      email: fd.get('email') as string,
      phone: fd.get('phone') as string,
      equipmentId: fd.get('equipmentId') as string || undefined,
    };
    setSuppliers([newSupp, ...suppliers]);
    setIsSupplierModalOpen(false);
  };

  const handleAddService = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedEquipment) return;
    const fd = new FormData(e.currentTarget);
    const isResolved = fd.get('isResolved') === 'on';
    const isDelivered = fd.get('isDelivered') === 'on';
    
    // Automação: Se entregue -> Entregue. Se apenas resolvido -> Aguardando Retirada. Se não -> Aguardando Serviço (Pendente)
    let newStatus = EquipmentStatus.PENDING;
    if (isDelivered) {
      newStatus = EquipmentStatus.DELIVERED;
    } else if (isResolved) {
      newStatus = EquipmentStatus.READY;
    }

    const newRecord: ServiceRecord = {
      id: generateUUID(), 
      equipmentId: selectedEquipment.id,
      date: new Date().toISOString(), 
      description: fd.get('description') as string, 
      serviceType: fd.get('serviceType') as string,
      technicianId: 'u1',
      isResolved: isResolved,
      isDelivered: isDelivered,
      resolution: fd.get('resolution') as string,
      attachments: tempAttachments
    };
    const updated = equipments.map(eq => {
      if (eq.id === selectedEquipment.id) {
        return { ...eq, status: newStatus, serviceRecords: [newRecord, ...(eq.serviceRecords || [])] };
      }
      return eq;
    });
    setEquipments(updated);
    setTempAttachments([]);
    setIsServiceModalOpen(false);
  };

  const handleUpdateAttachments = (newAtts: Attachment[]) => {
    if (!selectedEquipment) return;
    const updated = equipments.map(eq => {
      if (eq.id === selectedEquipment.id) {
        return { ...eq, attachments: [...(eq.attachments || []), ...newAtts] };
      }
      return eq;
    });
    setEquipments(updated);
  };

  const handleRemoveAttachment = (attId: string) => {
    if (!selectedEquipment) return;
    const updated = equipments.map(eq => {
      if (eq.id === selectedEquipment.id) {
        return { ...eq, attachments: (eq.attachments || []).filter(a => a.id !== attId) };
      }
      return eq;
    });
    setEquipments(updated);
  };

  const handleAiAdvice = async (equip: Equipment) => {
    setIsLoadingAi(true);
    const advice = await getMaintenanceAdvice(equip.name, equip.brand, equip.model, equip.observations);
    setAiAdvice(advice);
    setIsLoadingAi(false);
  };

  const getPageTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Status Engenharia';
      case 'equipment': return 'Equipamentos Médicos';
      case 'customers': return 'Cadastro de Empresas';
      case 'suppliers': return 'Fornecedores';
      default: return 'Sistema';
    }
  };

  if (!user) {
    return (
      <LoginScreen 
        onLogin={(loggedInUser) => {
          localStorage.setItem('alvs_user', JSON.stringify(loggedInUser));
          setUser(loggedInUser);
        }} 
        brandConfig={brandConfig} 
      />
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden font-inter text-slate-100 relative">
      {/* Background visuals */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-red-600/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-600/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Sidebar Desktop */}
      <aside className="hidden md:flex w-24 lg:w-48 bg-slate-950 border-r border-slate-850 flex-col py-8 z-50 transition-all shadow-2xl relative">
        <div className="mb-10 px-4 w-full h-24 flex items-center justify-center">
          <Logo config={brandConfig} className="w-full" />
        </div>
        <nav className="w-full px-3 flex-1 flex flex-col gap-4">
          <SidebarIcon icon={LayoutDashboard} label="Painel" id="dashboard" activeTab={activeTab} onClick={setActiveTab} />
          <SidebarIcon icon={Wrench} label="Equipamentos" id="equipment" activeTab={activeTab} onClick={setActiveTab} />
          <SidebarIcon icon={Users} label="Empresas" id="customers" activeTab={activeTab} onClick={setActiveTab} />
          <SidebarIcon icon={Briefcase} label="Fornecedores" id="suppliers" activeTab={activeTab} onClick={setActiveTab} />
        </nav>
        <div className="w-full px-3 mt-auto flex flex-col gap-3">
          <SidebarIcon icon={Settings} label="Marca" id="brand" activeTab="" onClick={() => { setLogoPreview(brandConfig.logoUrl); setIsBrandModalOpen(true); }} color="text-slate-400 hover:text-white" />
          <SidebarIcon icon={LogOut} label="Sair" id="logout" activeTab="" onClick={handleLogout} color="text-slate-400 hover:text-red-400" />
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden pb-20 md:pb-0 relative z-10">
        {/* Header */}
        <header className="h-20 bg-slate-950 border-b border-slate-850 px-6 md:px-8 flex items-center justify-between z-30 shrink-0 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="md:hidden">
              <Logo config={brandConfig} className="h-10" />
            </div>
            <div className="hidden sm:block">
               <h1 className="text-sm font-black text-white uppercase tracking-tight leading-none">{getPageTitle()}</h1>
               <p className="text-[9px] font-black text-slate-500 mt-1 uppercase tracking-widest">{brandConfig.name} Clinical Intel</p>
            </div>
          </div>

          <div className="flex-1 max-w-lg mx-8 hidden lg:block">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
              <input 
                type="text" 
                placeholder={`Pesquisar equipamentos, clientes ou serviços...`} 
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/60 rounded-2xl text-xs border-slate-800 text-white placeholder:text-slate-600 outline-none transition-all border-2 focus:border-red-500/50"
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end text-end mr-2">
              <span className="text-[10px] font-black text-white uppercase tracking-widest">{user?.name || 'Administrador'}</span>
              <span className="text-[9px] font-bold text-slate-500 uppercase">{user?.email || 'admin@alvs.com'}</span>
            </div>
            <button onClick={syncData} title="Sincronizar dados" className="p-2.5 text-slate-400 hover:text-white transition-all bg-slate-900 border border-slate-800 rounded-xl hover:shadow-md">
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button 
              onClick={handleLogout} 
              title="Sair do sistema" 
              className="p-2.5 text-slate-400 hover:text-red-400 transition-all bg-slate-900 border border-slate-800 rounded-xl hover:shadow-md"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar relative">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center gap-4 animate-pulse">
               <div className="w-12 h-12 border-4 border-slate-100 border-t-red-500 rounded-full animate-spin" />
               <p className="font-black text-[9px] text-slate-400 uppercase tracking-[0.3em]">Sincronizando Dados</p>
            </div>
          ) : (
            <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
              
              {activeTab === 'dashboard' && (
                <div className="space-y-8">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 flex-1">
                      <StatCard label="Total Ativos" value={equipments.length} icon={HardDrive} color="blue" />
                      <StatCard label="Manutenção" value={equipments.filter(e => e.status === EquipmentStatus.IN_PROGRESS).length} icon={Wrench} color="indigo" />
                      <StatCard label="Concluídos" value={equipments.filter(e => e.status === EquipmentStatus.COMPLETED).length} icon={CheckCircle2} color="emerald" />
                      <StatCard label="Prontos" value={equipments.filter(e => e.status === EquipmentStatus.READY).length} icon={History} color="amber" />
                      <StatCard label="Entregues" value={equipments.filter(e => e.status === EquipmentStatus.DELIVERED).length} icon={Users} color="blue" />
                    </div>
                    <button 
                      onClick={() => generateGlobalReport(equipments, customers, ALVS_CNPJ, brandConfig.name, brandConfig.logoUrl)}
                      className="w-full md:w-auto px-6 py-4 bg-slate-900 border border-slate-800/85 rounded-2xl flex items-center justify-center gap-3 text-slate-200 font-black uppercase text-[10px] tracking-widest hover:bg-slate-850/80 hover:text-white transition-all shadow-sm group cursor-pointer"
                    >
                      <Download size={18} className="text-red-500" /> Relatório Consolidado
                    </button>
                  </div>

                  <div className="bg-slate-900/60 backdrop-blur-md p-6 md:p-8 rounded-[32px] border border-slate-800/80 shadow-2xl">
                    <h3 className="font-black text-slate-400 text-[10px] uppercase tracking-widest flex items-center gap-2 mb-8">
                      <History size={14} className="text-red-500" /> Fluxo de Manutenções
                    </h3>
                    <div className="space-y-4">
                      {filteredServices.map((service) => (
                        <div key={service.id} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-950/60 transition-all border border-transparent hover:border-slate-850 group">
                          <button 
                            onClick={() => {
                              const equip = equipments.find(e => e.id === service.equipmentId);
                              if (equip) {
                                setSelectedEquipment(equip);
                                setIsServiceModalOpen(true);
                              }
                            }}
                            className="w-10 h-10 bg-slate-950 rounded-xl flex items-center justify-center text-red-500 shrink-0 hover:bg-red-650 hover:text-white transition-all shadow-sm border border-slate-850"
                            title="Nova Manutenção"
                          >
                            <Wrench size={18} />
                          </button>
                          <div 
                            onClick={() => {
                              const equip = equipments.find(e => e.id === service.equipmentId);
                              if (equip) {
                                setSelectedEquipment(equip);
                                setIsEquipHistoryModalOpen(true);
                              }
                            }}
                            className="flex-1 min-w-0 cursor-pointer group/item hover:opacity-85 transition-opacity"
                            title="Ver histórico e empresa vinculada"
                          >
                            <p className="text-xs font-black text-slate-200 group-hover/item:text-red-500 transition-colors truncate">{service.equipName}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-[10px] text-slate-500 font-mono font-black truncate">{service.equipCode}</p>
                              <span className="text-[9px] font-black text-red-500 uppercase px-1.5 py-0.5 bg-red-500/10 border border-red-500/20 rounded italic">{service.serviceType}</span>
                            </div>
                          </div>
                          <div 
                            onClick={() => {
                              const equip = equipments.find(e => e.id === service.equipmentId);
                              if (equip) {
                                setSelectedEquipment(equip);
                                setIsEquipHistoryModalOpen(true);
                              }
                            }}
                            className="hidden lg:block flex-1 text-center italic text-slate-400 text-[11px] truncate px-4 cursor-pointer hover:text-slate-200 transition-colors"
                            title="Ver histórico e empresa vinculada"
                          >
                            "{service.description}"
                          </div>
                          <div className="text-right flex items-center gap-4">
                            <div className="flex flex-col items-end">
                              <p className="text-[10px] font-black text-slate-500 uppercase">{formatDate(service.date)}</p>
                              {(service as any).isResolved ? (
                                <span className="text-[8px] font-black text-emerald-400 uppercase flex items-center gap-1"><CheckCircle2 size={10} /> Resolvido</span>
                              ) : (
                                <span className="text-[8px] font-black text-amber-500 uppercase flex items-center gap-1"><AlertCircle size={10} /> Pendente</span>
                              )}
                            </div>
                            <button 
                              onClick={() => generateServiceOrderReport(service as any, equipments.find(e => e.id === service.equipmentId)!, ALVS_CNPJ, brandConfig.name, brandConfig.logoUrl)}
                              className="p-2 bg-slate-950 text-slate-500 hover:text-red-500 rounded-lg shadow-sm border border-slate-800 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                            ><Download size={14} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'equipment' && (
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900/60 backdrop-blur-md p-6 md:p-8 rounded-[32px] border border-slate-800/80 shadow-2xl gap-4">
                    <div>
                      <h3 className="text-lg font-black text-white uppercase tracking-tight">Gestão de Ativos</h3>
                      <p className="text-xs text-slate-550 font-medium tracking-wide">Inventário completo de equipamentos médicos</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                      <button 
                        onClick={() => generateGlobalReport(equipments, customers, ALVS_CNPJ, brandConfig.name, brandConfig.logoUrl)}
                        className="px-6 py-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center gap-3 text-slate-200 font-black uppercase text-[10px] tracking-widest hover:bg-slate-850 hover:text-white transition-all shadow-md cursor-pointer"
                      >
                        <Download size={18} className="text-red-500" /> Exportar Inventário
                      </button>
                      <button onClick={() => openEquipModal()} className="bg-red-650 text-white px-8 py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-red-750 transition-all text-xs font-black uppercase tracking-widest shadow-xl active:scale-95 cursor-pointer">
                        <Plus size={20} /> Novo Registro
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredEquipments.map(equip => (
                      <div key={equip.id} className="bg-slate-900/60 backdrop-blur-md p-6 rounded-[32px] border border-slate-800 shadow-xl hover:shadow-2xl hover:border-slate-700/60 transition-all group flex flex-col relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-red-600/5 rounded-full blur-2xl pointer-events-none" />
                        <div className="flex justify-between items-start mb-6">
                          <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border ${getStatusBadge(equip.status as EquipmentStatus)}`}>
                            {equip.status}
                          </span>
                          <div className="flex gap-2">
                            <button onClick={() => { setSelectedEquipment(equip); setIsServiceModalOpen(true); }} className="p-2 text-red-500 bg-slate-950 rounded-lg hover:bg-red-650 hover:text-white transition-all border border-slate-850 shadow-sm cursor-pointer" title="Manutenção"><Wrench size={16} /></button>
                            <button onClick={() => { setSelectedEquipment(equip); setIsAttachmentModalOpen(true); }} className="p-2 text-blue-400 bg-slate-950 rounded-lg hover:bg-blue-600 hover:text-white transition-all border border-slate-850 shadow-sm cursor-pointer" title="Anexos"><Upload size={16} /></button>
                            <button onClick={() => generateEquipmentReport(equip, customers.find(c => c.id === equip.customerId)?.name || '', ALVS_CNPJ, brandConfig.name, brandConfig.logoUrl)} className="p-2 text-slate-400 bg-slate-950 rounded-lg hover:bg-slate-800 transition-all border border-slate-850 shadow-sm cursor-pointer" title="Relatório"><FileText size={16} /></button>
                          </div>
                        </div>
                        <h4 className="text-md font-black text-white truncate">{equip.name}</h4>
                        <p className="text-[10px] text-slate-500 font-mono font-bold uppercase mb-6">{equip.code}</p>
                        
                        <div className="space-y-2 text-[11px] text-slate-350 bg-slate-950/60 p-4 rounded-xl mb-6 flex-1 border border-slate-850">
                          <div className="flex items-center gap-2 truncate font-semibold"><Building2 size={12} className="text-red-500 shrink-0" /> {customers.find(c => c.id === equip.customerId)?.name}</div>
                          <div className="flex items-center gap-2 truncate font-semibold"><HardDrive size={12} className="text-slate-500 shrink-0" /> S/N: {equip.serialNumber}</div>
                          {equip.serviceRecords && equip.serviceRecords.length > 0 ? (
                            <div className="flex items-center gap-2 truncate font-bold text-red-500">
                              <Wrench size={12} className="shrink-0 text-red-500" />
                              <span>Último serviço: {equip.serviceRecords[0].serviceType}</span>
                            </div>
                          ) : null}
                          <div className="flex flex-col gap-0.5 mt-2 pt-2 border-t border-slate-850">
                            <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Última Manutenção</span>
                            <span className="text-[11px] font-bold text-slate-300">{getLastMaintenanceInfo(equip).date}</span>
                          </div>
                          {equip.technicalReport && (
                            <div className="mt-2 pt-2 border-t border-slate-850">
                              <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Parecer Técnico</span>
                              <p className="text-[10px] text-slate-400 italic font-medium leading-relaxed bg-slate-950 p-2.5 rounded-lg border border-slate-850 line-clamp-3">
                                "{equip.technicalReport}"
                              </p>
                            </div>
                          )}
                          <AttachmentList attachments={equip.attachments} />
                        </div>
                        <button onClick={() => handleAiAdvice(equip)} className="mt-auto w-full py-3 bg-slate-950 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-650 hover:text-white hover:border-red-500/50 transition-all border border-slate-850 cursor-pointer">
                          <Sparkles size={12} className="text-red-500" /> Diagnóstico IA
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'customers' && (
                <div className="space-y-8 animate-in fade-in duration-300">
                  {/* Top Bar */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900/60 backdrop-blur-md p-6 md:p-8 rounded-[32px] border border-slate-800 shadow-2xl gap-4">
                    <div>
                      <h3 className="text-lg font-black text-white uppercase tracking-tight">Cadastro de Empresas</h3>
                      <p className="text-xs text-slate-400 font-medium tracking-wide">Gerenciamento de empresas parceiras, equipamentos vinculados e registros de manutenção</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                      <button 
                        onClick={() => generateCustomerListReport(customers, ALVS_CNPJ, brandConfig.name, brandConfig.logoUrl)}
                        className="px-6 py-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center gap-3 text-slate-200 font-black uppercase text-[10px] tracking-widest hover:bg-slate-850 hover:text-white transition-all shadow-md cursor-pointer"
                      >
                        <Download size={18} className="text-red-500" /> Relatório de Empresas
                      </button>
                      <button onClick={() => setIsCustomerModalOpen(true)} className="bg-red-600 text-white px-8 py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-red-750 transition-all text-xs font-black uppercase tracking-widest shadow-xl active:scale-95 cursor-pointer">
                        <Plus size={20} /> Nova Empresa
                      </button>
                    </div>
                  </div>

                  {/* Main Grid split */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    {/* Column 1: Lista de Empresas */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-2 px-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Selecione uma Empresa ({filteredCustomers.length})</p>
                      </div>
                      <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {filteredCustomers.length > 0 ? (
                          filteredCustomers.map(c => {
                            const isActive = selectedCompanyId === c.id;
                            const companyEquipsCount = equipments.filter(e => e.customerId === c.id).length;
                            return (
                              <div 
                                key={c.id} 
                                onClick={() => setSelectedCompanyId(c.id)}
                                className={`p-5 rounded-[24px] border transition-all cursor-pointer flex flex-col gap-3 group relative ${
                                  isActive 
                                    ? 'bg-red-650/15 border-red-500/40 shadow-xl scale-[1.01]' 
                                    : 'bg-slate-900/60 border-slate-850 hover:border-slate-800'
                                }`}
                              >
                                {isActive && (
                                  <div className="absolute top-4 right-4 w-2 h-2 bg-red-500 rounded-full animate-ping" />
                                )}
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div className={`p-2.5 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                                      isActive ? 'bg-red-600 text-white shadow-md' : 'bg-slate-950 text-slate-500 border border-slate-850'
                                    }`}>
                                      <Building2 size={16} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className={`text-xs font-black uppercase tracking-tight truncate leading-tight transition-all ${
                                        isActive ? 'text-white' : 'text-slate-300 group-hover:text-white'
                                      }`}>{c.name}</p>
                                      <p className="text-[10px] font-bold font-mono text-slate-500 mt-0.5 truncate">{c.taxId}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingCustomer(c);
                                      }}
                                      className="p-2 text-slate-550 hover:text-blue-400 hover:bg-blue-500/10 rounded-xl transition-all cursor-pointer"
                                      title="Editar Empresa"
                                    >
                                      <Pencil size={14} />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setCustomerToDelete(c);
                                      }}
                                      className="p-2 text-slate-550 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer"
                                      title="Excluir Empresa"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between pt-1 text-[10px] border-t border-slate-850">
                                  <span className="text-slate-500 font-medium font-inter">Ativos vinculados</span>
                                  <span className="font-bold text-slate-300 bg-slate-950 px-2.5 py-0.5 rounded-full border border-slate-850">{companyEquipsCount} {companyEquipsCount === 1 ? 'Ativo' : 'Ativos'}</span>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-center py-12 bg-slate-900/60 rounded-2xl border border-dashed border-slate-800">
                            <Building2 className="mx-auto text-slate-500 mb-2" size={24} />
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nenhuma empresa encontrada.</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Column 2 & 3: Painel de Controle e Equipamentos */}
                    <div className="lg:col-span-2 space-y-6">
                      {selectedCompanyId ? (() => {
                        const currentCompany = customers.find(c => c.id === selectedCompanyId);
                        if (!currentCompany) return null;
                        const companyEquipments = equipments.filter(e => e.customerId === selectedCompanyId);
                        const selectedEquip = companyEquipments.find(e => e.id === selectedCompanyEquipId) || companyEquipments[0];

                        return (
                          <div className="space-y-6">
                            {/* Card de Informações da Empresa */}
                            <div className="bg-slate-900/60 backdrop-blur-md p-6 md:p-8 rounded-[32px] border border-slate-800 shadow-2xl flex flex-col gap-6">
                              <div className="flex justify-between items-start flex-wrap gap-4">
                                <div className="flex items-center gap-4">
                                  <div className="w-14 h-14 bg-red-500/10 text-red-500 border border-red-500/20 rounded-2xl flex items-center justify-center shadow-inner"><Building2 size={28} /></div>
                                  <div>
                                    <h4 className="text-lg font-black text-white uppercase tracking-tight leading-none mb-2">{currentCompany.name}</h4>
                                    <span className="bg-red-500/10 text-red-400 text-[8px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest border border-red-500/20">Parceiro Oficial</span>
                                  </div>
                                </div>
                                <div className="flex gap-2 items-center">
                                  <button onClick={() => setViewingCustomer(currentCompany)} className="px-4 py-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 hover:text-white font-bold uppercase rounded-xl text-[9px] tracking-widest transition-all cursor-pointer">Ver Detalhes</button>
                                  <button 
                                    onClick={() => setEditingCustomer(currentCompany)} 
                                    className="px-4 py-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 hover:text-white font-bold uppercase rounded-xl text-[9px] tracking-widest transition-all cursor-pointer flex items-center gap-1"
                                    title="Editar Empresa"
                                  >
                                    <Pencil size={11} /> Editar
                                  </button>
                                  <button
                                    onClick={() => setCustomerToDelete(currentCompany)}
                                    className="p-2.5 bg-red-950/20 hover:bg-red-650/30 text-red-500 hover:text-red-400 border border-red-500/20 hover:border-red-500/40 rounded-xl transition-all cursor-pointer"
                                    title="Excluir Empresa"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-slate-850 pt-6">
                                <div className="flex flex-col gap-1 min-w-0">
                                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">CNPJ / CPF</span>
                                  <span className="text-xs text-slate-300 font-mono font-bold truncate">{currentCompany.taxId}</span>
                                </div>
                                <div className="flex flex-col gap-1 min-w-0">
                                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">E-mail de Contato</span>
                                  <span className="text-xs text-slate-300 font-semibold truncate hover:text-red-405 cursor-pointer">{currentCompany.email || 'Não informado'}</span>
                                </div>
                                <div className="flex flex-col gap-1 min-w-0">
                                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Telefone</span>
                                  <span className="text-xs text-slate-300 font-semibold truncate">{currentCompany.phone || 'Não informado'}</span>
                                </div>
                              </div>
                            </div>

                            {/* Detalhes do Equipamento Vinculado */}
                            <div className="bg-slate-900/60 backdrop-blur-md p-6 md:p-8 rounded-[32px] border border-slate-800 shadow-2xl space-y-6">
                              <div className="flex items-center justify-between flex-wrap gap-4">
                                <div>
                                  <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                                    <HardDrive size={16} className="text-red-500" /> Informações do Equipamento
                                  </h4>
                                  <p className="text-[10px] text-slate-450 font-semibold tracking-wide">Selecione para puxar as informações e a última manutenção direta do banco de dados</p>
                                </div>
                                {companyEquipments.length > 0 && (
                                  <button 
                                    onClick={() => openEquipModal(currentCompany.id)}
                                    className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[9px] tracking-widest rounded-xl hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <Plus size={14} /> Vincular Novo Equipamento
                                  </button>
                                )}
                              </div>

                              <div className="space-y-4">
                                <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Escolha o Equipamento Ativo</label>
                                {companyEquipments.length > 0 ? (
                                  <select
                                    value={selectedCompanyEquipId || ""}
                                    onChange={(e) => setSelectedCompanyEquipId(e.target.value)}
                                    className="w-full px-5 py-4 bg-slate-950 border border-slate-800 rounded-2xl text-xs font-black font-mono text-slate-300 outline-none focus:ring-1 focus:ring-red-500 transition-all cursor-pointer uppercase shadow-inner [&>option]:bg-slate-900 [&>option]:text-white"
                                  >
                                    {companyEquipments.map((eq) => (
                                      <option key={eq.id} value={eq.id}>
                                        {eq.name} — ({eq.code}) [S/N: {eq.serialNumber}]
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <div className="p-6 bg-slate-950 rounded-2xl border-2 border-dashed border-slate-850 text-center">
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-3">Nenhum equipamento cadastrado para esta empresa.</p>
                                    <button 
                                      onClick={() => {
                                        openEquipModal(currentCompany.id);
                                      }}
                                      className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-750 transition-all cursor-pointer"
                                    >
                                      <Plus size={12} /> Vincular Equipamento agora
                                    </button>
                                  </div>
                                )}
                              </div>

                              {selectedEquip && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-slate-850">
                                  {/* Col 1: Foto e Botão de Envio de arquivos */}
                                  <div className="space-y-4">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Foto Oficial do Equipamento</p>
                                    <div className="relative group rounded-[24px] overflow-hidden border border-slate-800 bg-slate-950 h-56 flex flex-col items-center justify-center shadow-inner transition-all hover:border-red-500/30">
                                      {selectedEquip.photoUrl ? (
                                        <img 
                                          src={selectedEquip.photoUrl} 
                                          alt={selectedEquip.name} 
                                          className="w-full h-full object-contain p-4"
                                          referrerPolicy="no-referrer"
                                        />
                                      ) : (
                                        <div className="text-center p-6 flex flex-col items-center gap-2">
                                          <ImageIcon size={32} className="text-slate-600" />
                                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sem foto do ativo cadastrada</p>
                                        </div>
                                      )}
                                      
                                      {/* Hover Overlay para Upload */}
                                      <div className="absolute inset-0 bg-slate-950/85 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-2 backdrop-blur-sm">
                                        <button 
                                          onClick={() => {
                                            const fileInput = document.getElementById(`equip-photo-input-${selectedEquip.id}`) as HTMLInputElement;
                                            fileInput?.click();
                                          }} 
                                          className="px-4 py-2.5 bg-red-600 text-white text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-red-700 transition-all flex items-center gap-2 shadow-lg cursor-pointer"
                                        >
                                          <Upload size={12} /> Enviar Nova Foto
                                        </button>
                                        <span className="text-[8px] text-red-200 font-bold uppercase tracking-wider">Formatos aceitos: Imagens</span>
                                      </div>
                                      
                                      <input 
                                        type="file" 
                                        id={`equip-photo-input-${selectedEquip.id}`}
                                        accept="image/*" 
                                        className="hidden" 
                                        onChange={(e) => handlePhotoFileChange(e, selectedEquip.id)}
                                      />
                                    </div>
                                    
                                    {selectedEquip.photoUrl && (
                                      <div className="flex justify-between items-center px-1">
                                        {/* Download Link */}
                                        <a 
                                          href={selectedEquip.photoUrl}
                                          download={`Foto_${selectedEquip.code}.png`}
                                          className="text-[9px] font-black text-red-500 hover:text-red-400 uppercase tracking-widest flex items-center gap-1 transition-all"
                                        >
                                          <Download size={12} /> Baixar Imagem do Ativo
                                        </a>
                                        <button 
                                          onClick={() => {
                                            const updated = equipments.map(eq => {
                                              if (eq.id === selectedEquip.id) {
                                                return { ...eq, photoUrl: undefined };
                                              }
                                              return eq;
                                            });
                                            setEquipments(updated);
                                          }}
                                          className="text-[9px] font-black text-red-500 hover:opacity-75 uppercase tracking-widest flex items-center gap-1 transition-all"
                                        >
                                          <Trash2 size={12} /> Remover
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  {/* Col 2: Informações Técnicas e Última Manutenção */}
                                  <div className="space-y-6">
                                    <div className="space-y-4">
                                      <div className="flex justify-between items-center px-1">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Especificações do Sistema</p>
                                        <button 
                                          onClick={() => setEditingEquipment(selectedEquip)}
                                          className="text-[9px] font-black text-red-500 hover:text-red-400 uppercase tracking-widest flex items-center gap-1.5 transition-all cursor-pointer"
                                        >
                                          <Pencil size={11} /> Editar Ativo
                                        </button>
                                      </div>
                                      <div className="bg-slate-950 p-4 rounded-2xl space-y-2 border border-slate-850">
                                        <div className="flex justify-between text-xs font-medium"><span className="text-slate-500">Identificação:</span> <span className="font-bold text-white font-mono uppercase">{selectedEquip.code}</span></div>
                                        <div className="flex justify-between text-xs font-medium"><span className="text-slate-500">Nº de Série:</span> <span className="font-bold text-white font-mono">{selectedEquip.serialNumber}</span></div>
                                        <div className="flex justify-between text-xs font-medium"><span className="text-slate-500">Marca/Modelo:</span> <span className="font-bold text-white uppercase">{selectedEquip.brand} / {selectedEquip.model}</span></div>
                                        <div className="flex justify-between text-xs font-medium"><span className="text-slate-500">Data de Entrada:</span> <span className="font-bold text-white">{formatDate(selectedEquip.entryDate).split(',')[0]}</span></div>
                                        <div className="flex justify-between text-xs font-medium items-center pt-2 border-t border-slate-850">
                                          <span className="text-slate-500">Situação:</span> 
                                          <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border ${getStatusBadge(selectedEquip.status as EquipmentStatus)}`}>
                                            {selectedEquip.status}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Última Manutenção */}
                                    <div className="p-5 rounded-[24px] border border-dashed border-red-500/20 bg-red-500/5 space-y-3">
                                      <div className="flex items-center gap-2">
                                        <Wrench size={16} className="text-red-500" />
                                        <p className="text-[10px] font-black uppercase tracking-widest text-red-500">Última Manutenção Ativa</p>
                                      </div>
                                      
                                      <div className="space-y-2">
                                        <div>
                                          <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Data da manutenção</span>
                                          <p className="text-xs font-bold text-white">{getLastMaintenanceInfo(selectedEquip).date}</p>
                                        </div>
                                        <div>
                                          <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">O que foi feito / Resolução</span>
                                          <p className="text-xs text-slate-300 leading-relaxed italic bg-slate-950 p-3 rounded-xl border border-slate-850 font-medium font-inter">
                                            "{getLastMaintenanceInfo(selectedEquip).details}"
                                          </p>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Parecer Técnico do Equipamento */}
                                    <div className="p-5 rounded-[24px] border border-dashed border-red-500/20 bg-red-500/5 space-y-3">
                                      <div className="flex items-center gap-2">
                                        <FileText size={16} className="text-red-500" />
                                        <p className="text-[10px] font-black uppercase tracking-widest text-red-500">Parecer Técnico Oficial</p>
                                      </div>
                                      <p className="text-xs text-slate-300 leading-relaxed font-semibold italic bg-slate-950 p-3 rounded-xl border border-slate-850 font-inter">
                                        {selectedEquip.technicalReport || "Nenhum parecer técnico cadastrado."}
                                      </p>
                                    </div>

                                    {/* Documentos e Anexos do Equipamento */}
                                    <div className="p-5 rounded-[24px] border border-slate-850 bg-slate-950/40 space-y-3">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <Paperclip size={16} className="text-slate-500" />
                                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Documentos / Anexos</p>
                                        </div>
                                        <button 
                                          onClick={() => { setSelectedEquipment(selectedEquip); setIsAttachmentModalOpen(true); }}
                                          className="text-[9px] font-black text-red-600 uppercase tracking-widest hover:underline"
                                        >
                                          Gerenciar Anexos
                                        </button>
                                      </div>
                                      {selectedEquip.attachments && selectedEquip.attachments.length > 0 ? (
                                        <AttachmentList attachments={selectedEquip.attachments} />
                                      ) : (
                                        <p className="text-[10px] text-slate-500 italic font-medium">Nenhum anexo adicional (PDF/Equipamento).</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })() : (
                        <div className="text-center py-24 bg-slate-900/60 rounded-[32px] border border-dashed border-slate-800 shadow-xl flex flex-col items-center justify-center gap-4">
                          <Building2 size={48} className="text-slate-500" />
                          <div>
                            <p className="text-sm font-black text-white uppercase tracking-wider">Nenhuma Empresa Selecionada</p>
                            <p className="text-xs text-slate-550 mt-1">Escolha uma empresa ao lado ou clique abaixo para cadastrar</p>
                          </div>
                          <button onClick={() => setIsCustomerModalOpen(true)} className="px-6 py-3 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-750 transition-all flex items-center gap-2 shadow-lg hover:shadow-red-500/10 cursor-pointer">
                            <Plus size={14} /> Cadastrar Nova Empresa
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'suppliers' && (
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900/60 backdrop-blur-md p-6 md:p-8 rounded-[32px] border border-slate-800 shadow-2xl gap-4">
                    <div>
                      <h3 className="text-lg font-black text-white uppercase tracking-tight">Parceiros de Suprimentos</h3>
                      <p className="text-xs text-slate-400 font-medium tracking-wide">Gestão de fornecedores de peças e serviços externos</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                      <button 
                        onClick={() => generateSupplierListReport(suppliers, ALVS_CNPJ, brandConfig.name, brandConfig.logoUrl)}
                        className="px-6 py-4 bg-slate-900 border border-slate-850 rounded-2xl flex items-center justify-center gap-3 text-slate-200 font-black uppercase text-[10px] tracking-widest hover:bg-slate-850 hover:text-white transition-all shadow-md cursor-pointer"
                      >
                        <Download size={18} className="text-red-500" /> Lista de Fornecedores
                      </button>
                      <button onClick={() => setIsSupplierModalOpen(true)} className="bg-red-600 text-white px-8 py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-red-700 transition-all text-xs font-black uppercase tracking-widest shadow-xl active:scale-95 cursor-pointer">
                        <Plus size={20} /> Novo Fornecedor
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                     {filteredSuppliers.map(s => (
                       <div key={s.id} className="p-6 md:p-8 bg-slate-900/60 backdrop-blur-md rounded-[32px] border border-slate-850 hover:border-slate-800 hover:shadow-2xl transition-all group flex flex-col gap-6">
                          <div className="flex justify-between items-start">
                             <div className="w-12 h-12 bg-slate-950 text-slate-400 border border-slate-850 rounded-2xl flex items-center justify-center transition-all shrink-0"><Factory size={24} /></div>
                             <div className="px-3 py-1 bg-red-500/10 border border-red-500/20 text-red-400 text-[9px] font-black rounded-full uppercase tracking-widest">Homologado</div>
                          </div>
                          <div className="min-w-0">
                            <p className="text-lg font-black text-white uppercase tracking-tight truncate">{s.name}</p>
                            <p className="text-[10px] text-slate-500 font-bold font-mono mt-1 truncate">{s.taxId}</p>
                          </div>
                          <div className="grid grid-cols-1 gap-3 border-t border-slate-850 pt-6">
                             <div className="flex items-center gap-3 text-xs text-slate-300 truncate"><Users size={14} className="text-red-500 shrink-0" /> {s.contactName}</div>
                             <div className="flex items-center gap-3 text-xs text-slate-300 truncate"><Mail size={14} className="text-red-500 shrink-0" /> {s.email}</div>
                             <div className="flex items-center gap-3 text-xs text-slate-300 truncate"><Phone size={14} className="text-red-500 shrink-0" /> {s.phone}</div>
                             {s.equipmentId && (
                               <div className="flex items-center gap-3 text-xs text-red-400 font-bold truncate">
                                 <HardDrive size={14} className="shrink-0 text-red-500" /> 
                                 {equipments.find(e => e.id === s.equipmentId)?.name || 'Equipamento não encontrado'}
                               </div>
                             )}
                          </div>
                       </div>
                     ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <footer className="mt-auto py-12 text-center border-t border-slate-900">
             <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">
               © 2025 — TODOS OS DIREITOS RESERVADOS A ANTONIO SINRON NERI DA SILVA
             </p>
          </footer>
        </main>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur-lg border-t border-slate-900 flex items-center justify-around h-20 px-4 z-50 shadow-2xl">
        <MobileNavItem icon={LayoutDashboard} label="Painel" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
        <MobileNavItem icon={Wrench} label="Ativos" active={activeTab === 'equipment'} onClick={() => setActiveTab('equipment')} />
        <MobileNavItem icon={Users} label="Empresas" active={activeTab === 'customers'} onClick={() => setActiveTab('customers')} />
        <MobileNavItem icon={Briefcase} label="Suprim." active={activeTab === 'suppliers'} onClick={() => setActiveTab('suppliers')} />
      </nav>

      {viewingCustomer && (
        <Modal 
          title={`Detalhes da Unidade: ${viewingCustomer.name}`} 
          onClose={() => setViewingCustomer(null)}
          className="max-w-4xl"
        >
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-950/65 p-4 rounded-2xl border border-slate-850">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">CNPJ / CPF</p>
                <p className="text-xs font-bold text-white font-mono">{viewingCustomer.taxId}</p>
              </div>
              <div className="bg-slate-950/65 p-4 rounded-2xl border border-slate-850">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Contato</p>
                <p className="text-xs font-bold text-white">{viewingCustomer.phone || "Não informado"}</p>
              </div>
              <div className="bg-slate-950/65 p-4 rounded-2xl border border-slate-850">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">E-mail</p>
                <p className="text-xs font-bold text-white truncate">{viewingCustomer.email || "Não informado"}</p>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-2">
                <HardDrive size={14} /> Equipamentos Vinculados ({equipments.filter(e => e.customerId === viewingCustomer.id).length})
              </h4>
              
              <div className="grid grid-cols-1 gap-4">
                {equipments.filter(e => e.customerId === viewingCustomer.id).length > 0 ? (
                  equipments.filter(e => e.customerId === viewingCustomer.id).map(equip => (
                    <div key={equip.id} className="bg-slate-950/60 border border-slate-850 rounded-[24px] p-5 hover:shadow-2xl transition-all">
                      <div className="flex flex-col md:flex-row justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <h5 className="font-black text-white text-sm uppercase">{equip.name}</h5>
                            <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border ${getStatusBadge(equip.status as EquipmentStatus)}`}>
                              {equip.status}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-550 font-mono font-bold uppercase mb-3">{equip.code} | S/N: {equip.serialNumber}</p>
                          <AttachmentList attachments={equip.attachments} label="Documentos do Equipamento" />
                          
                          <div className="space-y-3">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Histórico de Serviços</p>
                            {equip.serviceRecords && equip.serviceRecords.length > 0 ? (
                              <div className="space-y-2">
                                {equip.serviceRecords.slice(0, 3).map(record => (
                                  <div key={record.id} className="bg-slate-950 p-3 rounded-xl border border-slate-850">
                                    <div className="flex justify-between items-start mb-1">
                                      <span className="text-[9px] font-black text-red-500 uppercase italic">{record.serviceType}</span>
                                      <span className="text-[9px] font-bold text-slate-500">{formatDate(record.date)}</span>
                                    </div>
                                    <p className="text-[11px] text-slate-300 font-medium font-inter leading-relaxed">"{record.description}"</p>
                                    <AttachmentList attachments={record.attachments} label="Anexos do Serviço" />
                                    {record.resolution && (
                                      <div className="mt-2 pt-2 border-t border-slate-850">
                                        <p className="text-[9px] font-black text-emerald-505 uppercase mb-1">Resolução:</p>
                                        <p className="text-[10px] text-slate-400 italic">"{record.resolution}"</p>
                                      </div>
                                    )}
                                  </div>
                                ))}
                                {equip.serviceRecords.length > 3 && (
                                  <p className="text-[9px] text-center text-slate-500 font-bold uppercase tracking-widest">+ {equip.serviceRecords.length - 3} outros registros</p>
                                )}
                              </div>
                            ) : (
                              <p className="text-[10px] text-slate-500 italic bg-slate-950 p-3 rounded-xl border border-dashed border-slate-850">Nenhum serviço registrado para este equipamento.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 bg-slate-950/40 rounded-[32px] border border-dashed border-slate-850">
                    <HardDrive size={32} className="mx-auto text-slate-600 mb-3" />
                    <p className="text-xs font-bold text-slate-550 uppercase tracking-widest">Nenhum equipamento vinculado a esta unidade.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {isBrandModalOpen && (
        <Modal title="Configurações de Marca" onClose={() => setIsBrandModalOpen(false)}>
          <form onSubmit={handleUpdateBrand} className="space-y-6">
            <FormInput label="Nome Oculto da Empresa" name="name" defaultValue={brandConfig.name} required />
            <FormInput label="Slogan Oculto" name="slogan" defaultValue={brandConfig.slogan} />
            
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Logomarca (Identidade Exclusiva)</label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-48 border-2 border-dashed border-slate-200 rounded-[32px] flex flex-col items-center justify-center gap-3 bg-slate-50 hover:bg-slate-100 hover:border-red-300 transition-all cursor-pointer group relative overflow-hidden shadow-inner"
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="Preview" className="w-full h-full object-contain p-6" />
                ) : (
                  <>
                    <div className="p-4 bg-white rounded-3xl text-slate-400 group-hover:text-red-500 shadow-md transition-all group-hover:scale-110">
                      <Upload size={32} />
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Clique para enviar logomarca</span>
                  </>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleLogoUpload} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>
              {logoPreview && (
                <button 
                  type="button" 
                  onClick={() => setLogoPreview(null)}
                  className="flex items-center gap-2 text-[10px] font-black text-red-500 uppercase tracking-widest mt-2 hover:opacity-70 transition-all"
                >
                  <Trash2 size={12} /> Remover Identidade
                </button>
              )}
            </div>

            <button type="submit" className="w-full py-5 bg-slate-800 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest hover:bg-black transition-all shadow-xl active:scale-95">Atualizar Sistema</button>
          </form>
        </Modal>
      )}

      {isEquipModalOpen && (
        <Modal title="Novo Equipamento" onClose={() => { setIsEquipModalOpen(false); setNewEquipPhoto(null); setNewEquipAttachments([]); }}>
          <form onSubmit={handleAddEquipment} className="space-y-6">
            <FormInput label="Equipamento" name="name" placeholder="Ex: Monitor de Sinais Vitais" required />
             <div className="grid grid-cols-2 gap-4">
              <FormSelect 
                label="Cliente Vinculado" 
                name="customerId" 
                value={equipFormCustomerId} 
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setKeepEquipFormCustomerId(e.target.value)}
                options={customers.map(c => ({ value: c.id, label: c.name }))} 
              />
              <FormSelect label="Fornecedor Vinculado" name="supplierId" options={[{ value: '', label: 'Nenhum' }, ...suppliers.map(s => ({ value: s.id, label: s.name }))]} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormInput label="Marca" name="brand" placeholder="Philips" />
              <FormInput label="Modelo" name="model" placeholder="MX450" />
            </div>
            <FormInput label="Nº de Série" name="serialNumber" placeholder="SN-827364" required />
            <FormTextArea label="Observações de Entrada" name="observations" placeholder="Estado inicial..." />
            
            {/* Upload de Imagem do Equipamento */}
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Imagem do Equipamento (Foto)</label>
              <div 
                onClick={() => document.getElementById('new-standalone-equip-photo-input')?.click()}
                className="w-full h-36 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 hover:border-blue-500 transition-all cursor-pointer group relative overflow-hidden shadow-inner font-inter"
              >
                {newEquipPhoto ? (
                  <img src={newEquipPhoto} alt="Equipamento" className="w-full h-full object-contain p-4" referrerPolicy="no-referrer" />
                ) : (
                  <>
                    <div className="p-3 bg-white rounded-2xl text-slate-400 group-hover:text-blue-500 shadow-md transition-all group-hover:scale-105">
                      <ImageIcon size={20} />
                    </div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Enviar foto do equipamento</span>
                  </>
                )}
                <input 
                  type="file" 
                  id="new-standalone-equip-photo-input" 
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      try {
                        const base64 = await fileToBase64(file);
                        setNewEquipPhoto(base64);
                      } catch (err) {
                        console.error('Error uploading standalone equip photo:', err);
                      }
                    }
                  }} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>
              {newEquipPhoto && (
                <button 
                  type="button" 
                  onClick={() => setNewEquipPhoto(null)}
                  className="flex items-center gap-1.5 text-[9px] font-black text-red-500 uppercase tracking-widest mt-1 hover:opacity-75 transition-all"
                >
                  <Trash2 size={12} /> Remover Imagem
                </button>
              )}
            </div>

            {/* Parecer Técnico */}
            <FormTextArea label="Parecer Técnico" name="technicalReport" placeholder="Digite o parecer técnico oficial para este equipamento..." />

            {/* Upload de Anexos do Equipamento (PDF ou Imagens) */}
            <FileUploader 
              label="Anexos do Equipamento (PDF ou Imagem)"
              attachments={newEquipAttachments} 
              onUpload={(newAtts) => setNewEquipAttachments([...newEquipAttachments, ...newAtts])}
              onRemove={(id) => setNewEquipAttachments(newEquipAttachments.filter(a => a.id !== id))}
            />

            <button type="submit" className="w-full py-5 bg-slate-800 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest hover:bg-black transition-all shadow-xl">Cadastrar Equipamento</button>
          </form>
        </Modal>
      )}

      {isAttachmentModalOpen && selectedEquipment && (
        <Modal title={`Gerenciar Anexos: ${selectedEquipment.name}`} onClose={() => setIsAttachmentModalOpen(false)}>
          <div className="space-y-6">
            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
              <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1">Equipamento</p>
              <p className="text-xs font-bold text-slate-800">{selectedEquipment.code} | {selectedEquipment.name}</p>
            </div>
            
            <FileUploader 
              label="Adicionar Novos Documentos"
              attachments={[]} 
              onUpload={handleUpdateAttachments}
              onRemove={() => {}}
            />

            <div className="space-y-3">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Arquivos Atuais</p>
              <div className="grid grid-cols-1 gap-2">
                {(equipments.find(e => e.id === selectedEquipment.id)?.attachments || []).length > 0 ? (
                  (equipments.find(e => e.id === selectedEquipment.id)?.attachments || []).map(att => (
                    <div key={att.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="p-2 bg-slate-50 rounded-lg text-blue-500">
                          {att.type.includes('image') ? <ImageIcon size={14} /> : <FileText size={14} />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-slate-700 truncate">{att.name}</p>
                          <p className="text-[8px] text-slate-400 font-bold uppercase">{formatDate(att.date)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a 
                          href={att.url} 
                          download={att.name}
                          className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                          title="Baixar"
                        >
                          <Download size={16} />
                        </a>
                        <button 
                          onClick={() => handleRemoveAttachment(att.id)}
                          className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-[10px] text-slate-400 italic text-center py-4">Nenhum arquivo anexado.</p>
                )}
              </div>
            </div>
            
            <button 
              onClick={() => setIsAttachmentModalOpen(false)}
              className="w-full py-4 bg-slate-800 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest hover:bg-black transition-all"
            >
              Fechar
            </button>
          </div>
        </Modal>
      )}

      {isCustomerModalOpen && (
        <Modal title="Nova Empresa / Unidade de Saúde" onClose={() => { setIsCustomerModalOpen(false); setNewCustomerEquipPhoto(null); }}>
          <form onSubmit={handleAddCustomer} className="space-y-6">
            <FormInput label="Razão Social / Nome" name="name" required />
            <FormInput label="CNPJ / CPF" name="taxId" required />
            <div className="grid grid-cols-2 gap-4">
              <FormInput label="Telefone" name="phone" />
              <FormInput label="E-mail" name="email" type="email" />
            </div>
            <FormTextArea label="Endereço" name="address" />

            {/* Seção Equipamento Inicial */}
            <div className="pt-6 border-t border-slate-100 space-y-4">
              <div className="flex items-center gap-2">
                <HardDrive size={16} className="text-red-500" />
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-700">Equipamento Inicial (Opcional)</h4>
              </div>
              <p className="text-[10px] text-slate-400 font-medium leading-relaxed">Cadastre o primeiro equipamento diretamente com a empresa, incluindo a foto para agilizar o login do ativo no sistema.</p>

              <FormInput label="Nome do Equipamento" name="equipName" placeholder="Ex: Monitor Multiparamétrico" />
              <div className="grid grid-cols-2 gap-4">
                <FormInput label="Marca do Equipamento" name="equipBrand" placeholder="Ex: Philips" />
                <FormInput label="Nº de Série" name="equipSerial" placeholder="Ex: SN-928374" />
              </div>

              {/* Upload de Imagem do Equipamento */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Imagem do Equipamento</label>
                <div 
                  onClick={() => document.getElementById('new-customer-equip-photo-input')?.click()}
                  className="w-full h-36 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 hover:border-red-300 transition-all cursor-pointer group relative overflow-hidden shadow-inner font-inter"
                >
                  {newCustomerEquipPhoto ? (
                    <img src={newCustomerEquipPhoto} alt="Equipamento" className="w-full h-full object-contain p-4" referrerPolicy="no-referrer" />
                  ) : (
                    <>
                      <div className="p-3 bg-white rounded-2xl text-slate-400 group-hover:text-red-500 shadow-md transition-all group-hover:scale-105">
                        <Upload size={20} />
                      </div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Enviar foto do equipamento</span>
                    </>
                  )}
                  <input 
                    type="file" 
                    id="new-customer-equip-photo-input" 
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          const base64 = await fileToBase64(file);
                          setNewCustomerEquipPhoto(base64);
                        } catch (err) {
                          console.error('Error uploading initial equip photo:', err);
                        }
                      }
                    }} 
                    accept="image/*" 
                    className="hidden" 
                  />
                </div>
                {newCustomerEquipPhoto && (
                  <button 
                    type="button" 
                    onClick={() => setNewCustomerEquipPhoto(null)}
                    className="flex items-center gap-1.5 text-[9px] font-black text-red-500 uppercase tracking-widest mt-1 hover:opacity-75 transition-all"
                  >
                    <Trash2 size={12} /> Remover Imagem
                  </button>
                )}
              </div>

              {/* Parecer Técnico do Equipamento Inicial */}
              <FormTextArea label="Parecer Técnico" name="equipTechnicalReport" placeholder="Digite o parecer técnico oficial inicial para este equipamento..." />

              {/* Anexos Adicionais (PDF ou Imagem) do Equipamento Inicial */}
              <FileUploader 
                label="Anexos do Equipamento (PDF ou Imagem)"
                attachments={newCustomerEquipAttachments} 
                onUpload={(newAtts) => setNewCustomerEquipAttachments([...newCustomerEquipAttachments, ...newAtts])}
                onRemove={(id) => setNewCustomerEquipAttachments(newCustomerEquipAttachments.filter(a => a.id !== id))}
              />
            </div>

            <button type="submit" className="w-full py-5 bg-red-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest hover:bg-red-700 transition-all shadow-xl">Confirmar Cadastro</button>
          </form>
        </Modal>
      )}

      {customerToDelete && (
        <Modal 
          title="Excluir Empresa" 
          onClose={() => setCustomerToDelete(null)}
          className="max-w-md"
        >
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 bg-red-500/10 text-red-500 border border-red-500/20 rounded-full flex items-center justify-center mx-auto shadow-inner mb-2 animate-bounce">
              <Trash2 size={24} />
            </div>
            
            <div className="space-y-2">
              <h4 className="text-sm font-black text-white uppercase tracking-wider">Atenção! Ação Irreversível</h4>
              <p className="text-xs text-slate-400 leading-relaxed font-semibold font-inter">
                Você está prestes a excluir a empresa <span className="text-white font-bold">"{customerToDelete.name}"</span>. 
                Isso removerá permanentemente todos os seus dados e equipamentos vinculados do banco de dados local.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button 
                type="button"
                onClick={() => setCustomerToDelete(null)}
                className="w-full sm:flex-1 py-4 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-white font-bold uppercase rounded-2xl text-[10px] tracking-widest transition-all border border-slate-850 cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={() => handleDeleteCustomer(customerToDelete.id)}
                className="w-full sm:flex-1 py-4 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest transition-all shadow-xl shadow-red-500/10 hover:shadow-red-500/20 cursor-pointer"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </Modal>
      )}

      {editingCustomer && (
        <Modal 
          title="Editar Empresa / Unidade de Saúde" 
          onClose={() => setEditingCustomer(null)}
          className="max-w-lg"
        >
          <form onSubmit={handleUpdateCustomer} className="space-y-6">
            <FormInput 
              label="Razão Social / Nome" 
              name="name" 
              defaultValue={editingCustomer.name} 
              required 
            />
            <FormInput 
              label="CNPJ / CPF" 
              name="taxId" 
              defaultValue={editingCustomer.taxId} 
              required 
            />
            <div className="grid grid-cols-2 gap-4">
              <FormInput 
                label="Telefone" 
                name="phone" 
                defaultValue={editingCustomer.phone || ""} 
              />
              <FormInput 
                label="E-mail" 
                name="email" 
                type="email" 
                defaultValue={editingCustomer.email || ""} 
              />
            </div>
            <FormTextArea 
              label="Endereço" 
              name="address" 
              defaultValue={editingCustomer.address || ""} 
            />

            <div className="flex gap-3 pt-2">
              <button 
                type="button"
                onClick={() => setEditingCustomer(null)}
                className="w-1/2 py-4 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-white font-bold uppercase rounded-2xl text-[10px] tracking-widest transition-all border border-slate-850 cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                className="w-1/2 py-5 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest hover:shadow-lg transition-all cursor-pointer"
              >
                Salvar Alterações
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editingServiceRecord && (
        <Modal 
          title="Editar Registro de Manutenção" 
          onClose={() => setEditingServiceRecord(null)}
          className="max-w-lg"
        >
          <div className="bg-slate-50 p-6 rounded-[24px] mb-6 border border-slate-200">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Equipamento Vinculado</p>
            <p className="text-xs font-bold text-slate-800">
              {editingServiceRecord.equipment.name} 
              <span className="text-slate-450 font-mono text-xs ml-2">[{editingServiceRecord.equipment.code}]</span>
            </p>
          </div>
          <form onSubmit={handleUpdateServiceRecord} className="space-y-6">
            <FormInput 
              label="Tipo de Serviço" 
              name="serviceType" 
              defaultValue={editingServiceRecord.record.serviceType} 
              placeholder="Ex: Preventiva, Corretiva, Calibração" 
              required 
            />
            <FormTextArea 
              label="Descrição do Problema" 
              name="description" 
              defaultValue={editingServiceRecord.record.description} 
              placeholder="Descreva o problema relatado..." 
              required 
            />
            <FormTextArea 
              label="O que foi feito (Resolução)" 
              name="resolution" 
              defaultValue={editingServiceRecord.record.resolution} 
              placeholder="Descreva as ações tomadas para resolver o problema..." 
              required 
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <input 
                  type="checkbox" 
                  name="isResolved" 
                  id="editIsResolved" 
                  defaultChecked={editingServiceRecord.record.isResolved}
                  className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" 
                />
                <label htmlFor="editIsResolved" className="text-xs font-bold text-slate-700 uppercase tracking-widest cursor-pointer">Problema Resolvido?</label>
              </div>

              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <input 
                  type="checkbox" 
                  name="isDelivered" 
                  id="editIsDelivered" 
                  defaultChecked={editingServiceRecord.record.isDelivered}
                  className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" 
                />
                <label htmlFor="editIsDelivered" className="text-xs font-bold text-slate-700 uppercase tracking-widest cursor-pointer">Entregue ao Cliente?</label>
              </div>
            </div>
            
            <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Atualização Automática de Status</p>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Se marcado como <b>Entregue ao Cliente</b>, o status do ativo mudará para <b>Entregue</b>.
                Se marcado apenas como <b>Resolvido</b>, o status mudará para <b>Aguardando Retirada</b>.
                Caso contrário, o status voltará para <b>Aguardando Serviço</b>.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                type="button"
                onClick={() => setEditingServiceRecord(null)}
                className="w-1/2 py-4 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-white font-bold uppercase rounded-2xl text-[10px] tracking-widest transition-all border border-slate-850 cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                className="w-1/2 py-5 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest hover:shadow-lg transition-all cursor-pointer"
              >
                Salvar Alterações
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editingEquipment && (
        <Modal 
          title="Editar Equipamento / Ativo" 
          onClose={() => setEditingEquipment(null)}
          className="max-w-lg"
        >
          <form onSubmit={handleUpdateEquipment} className="space-y-6">
            <FormInput 
              label="Nome do Equipamento" 
              name="name" 
              defaultValue={editingEquipment.name} 
              required 
            />
            <div className="grid grid-cols-2 gap-4">
              <FormInput 
                label="Marca" 
                name="brand" 
                defaultValue={editingEquipment.brand} 
              />
              <FormInput 
                label="Modelo" 
                name="model" 
                defaultValue={editingEquipment.model} 
              />
            </div>
            <FormInput 
              label="Nº de Série" 
              name="serialNumber" 
              defaultValue={editingEquipment.serialNumber} 
              required 
            />
            
            <FormSelect 
              label="Situação do Ativo (Status)" 
              name="status" 
              defaultValue={editingEquipment.status}
              options={[
                { value: EquipmentStatus.PENDING, label: EquipmentStatus.PENDING },
                { value: EquipmentStatus.IN_PROGRESS, label: EquipmentStatus.IN_PROGRESS },
                { value: EquipmentStatus.COMPLETED, label: EquipmentStatus.COMPLETED },
                { value: EquipmentStatus.READY, label: EquipmentStatus.READY },
                { value: EquipmentStatus.DELIVERED, label: EquipmentStatus.DELIVERED },
                { value: EquipmentStatus.CANCELLED, label: EquipmentStatus.CANCELLED },
              ]}
            />

            <FormTextArea 
              label="Observações de Entrada" 
              name="observations" 
              defaultValue={editingEquipment.observations || ""} 
            />

            <FormTextArea 
              label="Parecer Técnico" 
              name="technicalReport" 
              defaultValue={editingEquipment.technicalReport || ""} 
              placeholder="Se houver, declare o parecer técnico oficial..."
            />

            <div className="flex gap-3 pt-2">
              <button 
                type="button"
                onClick={() => setEditingEquipment(null)}
                className="w-1/2 py-4 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-white font-bold uppercase rounded-2xl text-[10px] tracking-widest transition-all border border-slate-850 cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                className="w-1/2 py-5 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest hover:shadow-lg transition-all cursor-pointer"
              >
                Salvar Alterações
              </button>
            </div>
          </form>
        </Modal>
      )}

      {isSupplierModalOpen && (
        <Modal title="Novo Fornecedor" onClose={() => setIsSupplierModalOpen(false)}>
          <form onSubmit={handleAddSupplier} className="space-y-6">
            <FormInput label="Nome da Empresa" name="name" required />
            <FormInput label="CNPJ" name="taxId" required />
            <FormSelect label="Equipamento Associado" name="equipmentId" options={[{ value: '', label: 'Nenhum' }, ...equipments.map(e => ({ value: e.id, label: `${e.name} (${e.code})` }))]} />
            <FormInput label="Pessoa de Contato" name="contactName" />
            <div className="grid grid-cols-2 gap-4">
              <FormInput label="Telefone" name="phone" />
              <FormInput label="E-mail" name="email" type="email" />
            </div>
            <button type="submit" className="w-full py-5 bg-slate-800 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest hover:bg-black transition-all shadow-xl">Registrar Parceiro</button>
          </form>
        </Modal>
      )}

      {isServiceModalOpen && selectedEquipment && (
        <Modal title="Registro de Manutenção" onClose={() => { setIsServiceModalOpen(false); setTempAttachments([]); }}>
          <div className="bg-blue-50 p-6 rounded-[24px] mb-8 border border-blue-100">
            <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-1">Equipamento em Atendimento</p>
            <p className="text-sm font-bold text-slate-800">{selectedEquipment.name} <span className="text-slate-400 font-mono text-xs ml-2">[{selectedEquipment.code}]</span></p>
          </div>
          <form onSubmit={handleAddService} className="space-y-6">
            <FormInput label="Tipo de Serviço" name="serviceType" placeholder="Ex: Preventiva, Corretiva, Calibração" required />
            <FormTextArea label="Descrição do Problema" name="description" placeholder="Descreva o problema relatado..." required />
            <FormTextArea label="O que foi feito (Resolução)" name="resolution" placeholder="Descreva as ações tomadas para resolver o problema..." required />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <input type="checkbox" name="isResolved" id="isResolved" className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                <label htmlFor="isResolved" className="text-xs font-bold text-slate-700 uppercase tracking-widest cursor-pointer">Problema Resolvido?</label>
              </div>

              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <input type="checkbox" name="isDelivered" id="isDelivered" className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                <label htmlFor="isDelivered" className="text-xs font-bold text-slate-700 uppercase tracking-widest cursor-pointer">Entregue ao Cliente?</label>
              </div>
            </div>
            
            <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Atualização Automática de Status</p>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Se marcado como <b>Entregue ao Cliente</b>, o status do ativo mudará para <b>Entregue</b>.
                Se marcado apenas como <b>Resolvido</b>, o status mudará para <b>Aguardando Retirada</b>.
                Caso contrário, o status voltará para <b>Aguardando Serviço</b>.
              </p>
            </div>

            <FileUploader 
              label="Documentos / Fotos da Manutenção"
              attachments={tempAttachments} 
              onUpload={(newAtts) => setTempAttachments([...tempAttachments, ...newAtts])}
              onRemove={(id) => setTempAttachments(tempAttachments.filter(a => a.id !== id))}
            />

            <button type="submit" className="w-full py-5 bg-slate-800 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest hover:bg-black transition-all shadow-xl">Salvar Manutenção</button>
          </form>
        </Modal>
      )}

      {isEquipHistoryModalOpen && selectedEquipment && (
        <Modal 
          title={`Histórico e Vínculo do Ativo: ${selectedEquipment.name}`} 
          onClose={() => setIsEquipHistoryModalOpen(false)}
          className="max-w-4xl"
        >
          <div className="space-y-6">
            {/* Secao 1: Cartão de Ativo */}
            <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 flex flex-col md:flex-row gap-6 items-center justify-between">
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
                  <HardDrive size={28} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-400 font-mono font-bold uppercase">{selectedEquipment.code}</p>
                  <h4 className="text-md md:text-lg font-black text-slate-800 uppercase tracking-tight truncate">{selectedEquipment.name}</h4>
                  <p className="text-[10px] text-slate-500 font-medium">S/N: {selectedEquipment.serialNumber} • Marca: {selectedEquipment.brand} • Modelo: {selectedEquipment.model || 'N/A'}</p>
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border ${getStatusBadge(selectedEquipment.status as EquipmentStatus)}`}>
                  {selectedEquipment.status}
                </span>
              </div>
            </div>

            {/* Secao 2: Empresa Vinculada */}
            {(() => {
              const company = customers.find(c => c.id === selectedEquipment.customerId);
              return (
                <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="text-red-500" size={16} />
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-700">Empresa Vinculada (Unidade de Saúde)</h4>
                  </div>
                  {company ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 border-t border-slate-50">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Nome / Razão Social</span>
                        <span className="text-xs text-slate-800 font-black uppercase tracking-tight">{company.name}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">CNPJ / CPF</span>
                        <span className="text-xs text-slate-700 font-mono font-bold">{company.taxId}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Contato</span>
                        <span className="text-xs text-slate-700 font-medium truncate">{company.phone || company.email || 'Não informado'}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-amber-600 font-semibold italic">Este equipamento não está vinculado a nenhuma empresa cadastrada.</div>
                  )}
                </div>
              );
            })()}

            {/* Secao 3: Historico Completo de Manutencoes */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <History className="text-blue-500" size={16} />
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-700">Histórico Completo de Manutenções ({selectedEquipment.serviceRecords?.length || 0})</h4>
              </div>
              
              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                {selectedEquipment.serviceRecords && selectedEquipment.serviceRecords.length > 0 ? (
                  selectedEquipment.serviceRecords.map((record, index) => (
                    <div key={record.id || index} className="p-5 bg-slate-50/50 rounded-2xl border border-slate-100 flex flex-col gap-4 relative hover:border-slate-300 transition-colors">
                      <div className="flex justify-between items-center flex-wrap gap-2">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-black">{selectedEquipment.serviceRecords.length - index}</span>
                          <span className="text-[9px] font-black text-blue-500 uppercase px-2.5 py-0.5 bg-blue-50 rounded italic border border-blue-100">{record.serviceType}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-400 font-mono">{formatDate(record.date)}</span>
                          <button
                            onClick={() => {
                              setEditingServiceRecord({ record, equipment: selectedEquipment });
                            }}
                            className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-500 hover:bg-blue-50/80 px-2.5 py-1 rounded bg-blue-50 transition-all cursor-pointer border border-blue-100/50"
                            title="Editar Serviço"
                          >
                            <Pencil size={10} /> Editar
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-50/80 pt-3">
                        <div>
                          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Descrição do Problema</p>
                          <p className="text-xs text-slate-700 font-medium leading-relaxed italic">"{record.description}"</p>
                        </div>
                        <div>
                          <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Resolução do Técnico</p>
                          <p className="text-xs text-slate-800 font-semibold leading-relaxed">"{record.resolution}"</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-50/80 pt-3 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Situação:</span>
                          {record.isResolved ? (
                            <span className="text-[9px] font-black text-emerald-600 uppercase flex items-center gap-1 px-2 py-0.5 bg-green-50 rounded-full border border-green-100"><CheckCircle2 size={12} /> Resolvido</span>
                          ) : (
                            <span className="text-[9px] font-black text-amber-600 uppercase flex items-center gap-1 px-2 py-0.5 bg-amber-50 rounded-full border border-amber-100"><AlertCircle size={12} /> Pendente</span>
                          )}
                          {record.isDelivered && (
                            <span className="text-[9px] font-black text-blue-600 uppercase flex items-center gap-1 px-2 py-0.5 bg-blue-50 rounded-full border border-blue-100"><Users size={12} /> Entregue</span>
                          )}
                        </div>

                        {/* Record attachments */}
                        {record.attachments && record.attachments.length > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1"><Paperclip size={10} /> Anexos do Serviço:</span>
                            <AttachmentList attachments={record.attachments} />
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 bg-white rounded-2xl border border-dashed border-slate-200">
                    <History className="mx-auto text-slate-300 mb-2" size={24} />
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nenhum registro de manutenção encontrado para este ativo.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {aiAdvice && (
        <div className="fixed bottom-24 md:bottom-10 right-4 md:right-10 z-[100] max-w-sm">
          <div className="bg-white p-6 rounded-[32px] shadow-2xl border-l-4 border-red-600 relative">
             <div className="flex items-center gap-3 mb-4 text-red-600">
               <Sparkles size={18} />
               <span className="font-black text-[9px] uppercase tracking-widest">Diagnóstico Técnico</span>
               <button onClick={() => setAiAdvice(null)} className="ml-auto text-slate-300 hover:text-red-500"><X size={18} /></button>
             </div>
             <p className="text-[11px] text-slate-700 leading-relaxed font-medium italic">"{aiAdvice}"</p>
          </div>
        </div>
      )}

      {isLoadingAi && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-md">
           <div className="bg-white p-12 rounded-[48px] shadow-2xl flex flex-col items-center">
              <div className="w-10 h-10 border-4 border-red-100 border-t-red-600 rounded-full animate-spin"></div>
              <p className="mt-8 font-black text-slate-800 text-[9px] uppercase tracking-[0.3em] text-center">IA Analisando Ativo</p>
           </div>
        </div>
      )}
    </div>
  );
}

function SidebarIcon({ icon: Icon, label, id, activeTab, onClick, color }: any) {
  const active = activeTab === id;
  return (
    <button 
      onClick={() => onClick(id)} 
      className={`w-full py-3 px-2 lg:px-4 flex flex-col lg:flex-row items-center lg:justify-start gap-1.5 lg:gap-3 rounded-2xl transition-all relative group ${active ? 'bg-red-650 text-white shadow-xl shadow-red-900/40 border border-red-500/50' : color || 'text-slate-400 hover:bg-slate-900 hover:text-white'}`}
    >
      <Icon size={18} strokeWidth={active ? 2.5 : 2} className="shrink-0" />
      <span className="text-[9px] lg:text-xs font-black uppercase tracking-wider text-center lg:text-left truncate w-full max-w-full leading-tight">
        {label}
      </span>
    </button>
  );
}

function MobileNavItem({ icon: Icon, label, active, onClick }: any) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center gap-1 w-20 transition-all ${active ? 'text-red-500 scale-110' : 'text-slate-500 hover:text-slate-300'}`}>
      <Icon size={20} strokeWidth={active ? 2.5 : 2} />
      <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}

function StatCard({ label, value, icon: Icon, color }: any) {
  const colors: any = {
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    amber: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    indigo: 'bg-red-500/10 text-red-500 border-red-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  };
  return (
    <div className="bg-slate-900/60 backdrop-blur-md p-5 rounded-[28px] border border-slate-800 shadow-xl flex flex-col gap-4 group hover:shadow-2xl hover:border-slate-700/60 transition-all">
      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${colors[color]}`}>
        <Icon size={18} strokeWidth={2.5} />
      </div>
      <div>
        <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest mb-1">{label}</p>
        <p className="text-2xl font-black text-white tracking-tighter">{value}</p>
      </div>
    </div>
  );
}

function AttachmentList({ attachments, label }: { attachments?: Attachment[], label?: string }) {
  if (!attachments || attachments.length === 0) return null;
  
  return (
    <div className="space-y-2 mt-3">
      {label && <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{label}</p>}
      <div className="flex flex-wrap gap-2">
        {attachments.map(att => (
          <a 
            key={att.id} 
            href={att.url} 
            download={att.name}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-[10px] font-bold text-slate-300 hover:text-red-500 hover:border-red-550/40 transition-all shadow-sm group"
          >
            {att.type.includes('image') ? <ImageIcon size={12} className="text-red-500" /> : <FileText size={12} className="text-slate-400" />}
            <span className="max-w-[120px] truncate">{att.name}</span>
            <Download size={10} className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
        ))}
      </div>
    </div>
  );
}

function FileUploader({ attachments, onUpload, onRemove, label = "Documentos e Imagens" }: { attachments: Attachment[], onUpload: (atts: Attachment[]) => void, onRemove: (id: string) => void, label?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    const newAttachments: Attachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const base64 = await fileToBase64(file);
      newAttachments.push({
        id: generateUUID(),
        name: file.name,
        url: base64,
        type: file.type,
        date: new Date().toISOString()
      });
    }
    onUpload(newAttachments);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">{label}</label>
      <div className="grid grid-cols-1 gap-2">
        {attachments.map(att => (
          <div key={att.id} className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-xl group">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="p-2 bg-slate-900 rounded-lg text-red-500 shadow-sm border border-slate-850">
                {att.type.includes('image') ? <ImageIcon size={14} /> : <FileText size={14} />}
              </div>
              <span className="text-[10px] font-bold text-slate-300 truncate">{att.name}</span>
            </div>
            <button 
              type="button" 
              onClick={() => onRemove(att.id)}
              className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button 
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full py-4 border-2 border-dashed border-slate-800 rounded-2xl flex items-center justify-center gap-3 text-slate-500 hover:bg-slate-900 hover:border-red-500 hover:text-slate-200 transition-all group"
        >
          <Upload size={18} className="group-hover:scale-110 transition-transform text-red-500" />
          <span className="text-[10px] font-black uppercase tracking-widest">Anexar Arquivos (PDF/IMG)</span>
        </button>
        <input 
          type="file" 
          ref={inputRef} 
          onChange={handleFileChange} 
          multiple 
          accept="image/*,application/pdf" 
          className="hidden" 
        />
      </div>
    </div>
  );
}

function Modal({ title, children, onClose, className = "max-w-lg" }: any) {
  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[80] flex items-end md:items-center justify-center p-4">
      <div className={`bg-slate-900 border border-slate-800 rounded-t-[40px] md:rounded-[40px] w-full ${className} shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200`}>
        <div className="px-8 py-6 border-b border-slate-800/60 flex items-center justify-between">
          <h3 className="text-[10px] font-black text-white uppercase tracking-widest">{title}</h3>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-red-500 bg-slate-950/60 rounded-xl transition-colors border border-slate-850"><X size={20} /></button>
        </div>
        <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar text-slate-200">{children}</div>
      </div>
    </div>
  );
}

function FormInput({ label, ...props }: any) {
  return (
    <div className="space-y-1.5">
      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      <input {...props} className="w-full px-5 py-4 bg-slate-950/60 border border-slate-800 rounded-2xl focus:border-red-500 outline-none transition-all text-xs font-bold text-white placeholder:text-slate-650" />
    </div>
  );
}

function FormSelect({ label, options, ...props }: any) {
  return (
    <div className="space-y-1.5">
      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      <select {...props} className="w-full px-5 py-4 bg-slate-950/60 border border-slate-800 rounded-2xl focus:border-red-500 outline-none text-xs font-bold appearance-none cursor-pointer text-white [&>option]:bg-slate-900 [&>option]:text-white">
        {options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function FormTextArea({ label, ...props }: any) {
  return (
    <div className="space-y-1.5">
      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      <textarea rows={3} {...props} className="w-full px-5 py-4 bg-slate-950/60 border border-slate-800 rounded-2xl focus:border-red-500 outline-none transition-all text-xs font-medium resize-none text-white placeholder:text-slate-650" />
    </div>
  );
}

function getStatusBadge(status: EquipmentStatus) {
  switch (status) {
    case EquipmentStatus.PENDING: return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    case EquipmentStatus.IN_PROGRESS: return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case EquipmentStatus.COMPLETED: return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case EquipmentStatus.READY: return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
    case EquipmentStatus.DELIVERED: return 'bg-slate-500/15 text-slate-350 border-slate-500/20';
    default: return 'bg-slate-500/10 text-slate-400 border-slate-800';
  }
}

interface LoginScreenProps {
  onLogin: (user: User) => void;
  brandConfig: BrandConfig;
}

function LoginScreen({ onLogin, brandConfig }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if ((cleanEmail === 'admin' || cleanEmail === 'admin@alvs.com') && password === 'admin') {
      const adminUser: User = {
        id: 'u-admin',
        name: 'Administrador ALVS',
        email: 'admin@alvs.com',
        phone: '(11) 98888-8888',
        role: UserRole.ADMIN
      };
      onLogin(adminUser);
    } else {
      setErrorCode('Usuário ou senha incorretos.');
    }
  };

  const autofillAdmin = () => {
    setEmail('admin@alvs.com');
    setPassword('admin');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-6 relative overflow-hidden font-inter text-slate-100">
      {/* Background visual decoration */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-red-600/10 rounded-full blur-[120px] pointer-events-none -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none translate-x-1/2 translate-y-1/2" />

      <div className="w-full max-w-md bg-slate-950/40 backdrop-blur-md rounded-[40px] border border-slate-800 p-8 shadow-2xl relative z-10 space-y-8">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-slate-900 border border-slate-850 rounded-3xl mx-auto flex items-center justify-center p-3 shadow-inner">
            {brandConfig.logoUrl ? (
              <img src={brandConfig.logoUrl} alt="Logo" className="max-h-12 w-auto object-contain" />
            ) : (
              <Shield size={36} className="text-red-500" />
            )}
          </div>
          <div>
            <h2 className="text-xl font-black uppercase tracking-tight text-white">{brandConfig.name} {brandConfig.slogan}</h2>
            <p className="text-[9px] font-black tracking-[0.2em] text-slate-500 uppercase mt-1">Clinical Engineering & Medical Solutions</p>
          </div>
        </div>

        {errorCode && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-xs text-red-400 font-bold">
            <AlertCircle size={16} className="shrink-0 animate-bounce" />
            <span>{errorCode}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail ou Usuário</label>
            <div className="relative">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-550" size={16} />
              <input
                type="text"
                required
                placeholder="ex: admin@alvs.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-5 py-4 bg-slate-900/60 border border-slate-800 rounded-2xl focus:border-red-500 focus:bg-slate-900 outline-none transition-all text-xs font-bold text-white placeholder:text-slate-600 shadow-md"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Senha de Acesso</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-550" size={16} />
              <input
                type="password"
                required
                placeholder="Sua senha secreta"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-5 py-4 bg-slate-900/60 border border-slate-800 rounded-2xl focus:border-red-500 focus:bg-slate-900 outline-none transition-all text-xs font-bold text-white placeholder:text-slate-600 shadow-md"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-4.5 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest transition-all shadow-xl active:scale-[0.98] mt-6 flex items-center justify-center gap-2 cursor-pointer"
          >
            Acessar Sistema <ArrowRight size={14} />
          </button>
        </form>

        <div className="pt-6 border-t border-slate-900 text-center space-y-3">
          <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest block">Credenciais Administrativas de Teste</span>
          <button
            onClick={autofillAdmin}
            className="px-4 py-2 border-slate-800 bg-slate-900/40 rounded-xl text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-white hover:bg-slate-850 hover:border-slate-750 transition-all border cursor-pointer"
          >
            Preencher como Admin (admin / admin)
          </button>
        </div>
      </div>

      <footer className="mt-12 text-center">
         <p className="text-[8px] font-black text-slate-600 uppercase tracking-[0.3em]">
           © 2025 — TODOS OS DIREITOS RESERVADOS A ANTONIO SINRON NERI DA SILVA
         </p>
      </footer>
    </div>
  );
}
