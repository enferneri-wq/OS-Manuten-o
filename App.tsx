
import React, { useState, useMemo, useEffect } from 'react';
import { 
  LayoutDashboard, Users, Search, 
  Plus, FileText, Wrench, 
  CheckCircle2, AlertCircle, Building2, 
  HardDrive, BarChart3, PieChart as PieChartIcon,
  LogOut, X, History, ArrowRight,
  Sparkles, RefreshCw, MapPin, Phone, Mail,
  Download, Briefcase, Factory
} from 'lucide-react';
import { 
  ResponsiveContainer, PieChart, Pie, Cell, 
  Tooltip, BarChart, Bar, XAxis, YAxis
} from 'recharts';
import { 
  Equipment, Customer, EquipmentStatus, 
  ServiceRecord, Supplier 
} from './types.ts';
import { generateUniqueCode, generateUUID, formatDate } from './utils.ts';
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

const INITIAL_CUSTOMERS: Customer[] = [
  { id: 'c1', name: 'Hospital das Clínicas', taxId: '12.345.678/0001-90', email: 'contato@hc.org', phone: '(11) 98888-7777', address: 'Av. Paulista, 1000' },
  { id: 'c2', name: 'Clínica Saúde Vital', taxId: '98.765.432/0001-21', email: 'adm@saudevital.com', phone: '(11) 97777-6666', address: 'Rua das Flores, 45' },
];

const INITIAL_SUPPLIERS: Supplier[] = [
  { id: 's1', name: 'MedTech Supplies', taxId: '44.555.666/0001-22', contactName: 'Ricardo', email: 'vendas@medtech.com', phone: '(11) 95555-4444' },
];

const ALVS_CNPJ = "50.438.622/0001-74";

const Logo = ({ className = "h-12", showCnpj = true }: { className?: string, showCnpj?: boolean }) => (
  <div className="flex flex-col items-center">
    <svg viewBox="0 0 350 140" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 10L35 10L5 105L5 10Z" fill="#FF3D3D" />
      <path d="M40 10H235V105H10L40 10Z" fill="#333333" />
      <text x="45" y="88" fill="white" style={{ font: '900 85px Arial, sans-serif', letterSpacing: '-5px' }}>ALVS</text>
      <rect x="240" y="10" width="105" height="105" fill="#FF3D3D" />
      <path d="M252 50H275V25H295V50H318V75H295V100H275V75H252V50Z" fill="white" />
      <path d="M252 62.5H268L275 40L285 85L292 62.5H318" stroke="#FF3D3D" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M252 62.5H268L275 40L285 85L292 62.5H318" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
      <text x="5" y="130" fill="#333333" style={{ font: '500 21px Arial, sans-serif', letterSpacing: '2.5px' }}>ENGINEERING & MEDICAL</text>
    </svg>
    {showCnpj && (
      <span className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-widest">{ALVS_CNPJ}</span>
    )}
  </div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'equipment' | 'customers' | 'suppliers'>('dashboard');
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>(INITIAL_CUSTOMERS);
  const [suppliers, setSuppliers] = useState<Supplier[]>(INITIAL_SUPPLIERS);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const [isEquipModalOpen, setIsEquipModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  const loadLocalData = () => {
    const savedEquip = localStorage.getItem(STORAGE_KEY_EQUIP);
    const savedCust = localStorage.getItem(STORAGE_KEY_CUST);
    const savedSupp = localStorage.getItem(STORAGE_KEY_SUPP);
    if (savedEquip) setEquipments(JSON.parse(savedEquip));
    if (savedCust) setCustomers(JSON.parse(savedCust));
    if (savedSupp) setSuppliers(JSON.parse(savedSupp));
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
    syncData();
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_EQUIP, JSON.stringify(equipments));
    localStorage.setItem(STORAGE_KEY_CUST, JSON.stringify(customers));
    localStorage.setItem(STORAGE_KEY_SUPP, JSON.stringify(suppliers));
  }, [equipments, customers, suppliers]);

  const stats = useMemo(() => {
    const statusCounts = equipments.reduce((acc: any, curr) => {
      acc[curr.status] = (acc[curr.status] || 0) + 1;
      return acc;
    }, {});
    
    const recentServices = equipments
      .flatMap(e => (e.serviceRecords || []).map(s => ({ ...s, equipName: e.name, equipCode: e.code })))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);

    return { recentServices };
  }, [equipments]);

  const filteredEquipments = equipments.filter(e => 
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    e.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.serialNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  const handleAddEquipment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newItem: Equipment = {
      id: generateUUID(), 
      code: generateUniqueCode('ALVS'),
      name: fd.get('name') as string, 
      brand: fd.get('brand') as string,
      model: fd.get('model') as string, 
      manufacturer: fd.get('manufacturer') as string,
      serialNumber: fd.get('serialNumber') as string, 
      entryDate: new Date().toISOString(),
      observations: fd.get('observations') as string, 
      status: EquipmentStatus.PENDING,
      customerId: fd.get('customerId') as string, 
      serviceRecords: []
    };
    setEquipments([newItem, ...equipments]);
    setIsEquipModalOpen(false);
  };

  const handleAddCustomer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newCust: Customer = {
      id: generateUUID(),
      name: fd.get('name') as string,
      taxId: fd.get('taxId') as string,
      email: fd.get('email') as string,
      phone: fd.get('phone') as string,
      address: fd.get('address') as string,
    };
    setCustomers([newCust, ...customers]);
    setIsCustomerModalOpen(false);
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
    };
    setSuppliers([newSupp, ...suppliers]);
    setIsSupplierModalOpen(false);
  };

  const handleAddService = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedEquipment) return;
    const fd = new FormData(e.currentTarget);
    const newStatus = fd.get('status') as EquipmentStatus;
    const newRecord: ServiceRecord = {
      id: generateUUID(), 
      equipmentId: selectedEquipment.id,
      date: new Date().toISOString(), 
      description: fd.get('description') as string, 
      technicianId: 'u1'
    };
    const updated = equipments.map(eq => {
      if (eq.id === selectedEquipment.id) {
        return { ...eq, status: newStatus, serviceRecords: [newRecord, ...(eq.serviceRecords || [])] };
      }
      return eq;
    });
    setEquipments(updated);
    setIsServiceModalOpen(false);
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
      case 'equipment': return 'Ativos Hospitalares';
      case 'customers': return 'Unidades de Saúde';
      case 'suppliers': return 'Suprimentos';
      default: return 'Sistema ALVS';
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-inter text-slate-900">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex w-24 lg:w-44 bg-white border-r border-slate-200 flex-col items-center py-8 z-50 transition-all">
        <div className="mb-10 px-4 w-full">
          <Logo className="w-full" showCnpj={false} />
        </div>
        <nav className="flex-1 flex flex-col gap-6">
          <SidebarIcon icon={LayoutDashboard} label="Painel" id="dashboard" activeTab={activeTab} onClick={setActiveTab} />
          <SidebarIcon icon={Wrench} label="Ativos" id="equipment" activeTab={activeTab} onClick={setActiveTab} />
          <SidebarIcon icon={Users} label="Unidades" id="customers" activeTab={activeTab} onClick={setActiveTab} />
          <SidebarIcon icon={Briefcase} label="Forn." id="suppliers" activeTab={activeTab} onClick={setActiveTab} />
        </nav>
        <div className="mt-auto">
          <SidebarIcon icon={LogOut} label="Sair" id="logout" activeTab="" onClick={() => {}} color="text-slate-300 hover:text-red-600" />
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden pb-20 md:pb-0">
        {/* Header Organizado */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 md:px-8 flex items-center justify-between z-30 shrink-0 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="md:hidden">
              <Logo className="h-8" showCnpj={false} />
            </div>
            <div className="hidden sm:block">
               <h1 className="text-sm font-black text-slate-800 uppercase tracking-tight leading-none">{getPageTitle()}</h1>
               <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">ALVS Clinical Engineering</p>
            </div>
          </div>

          <div className="flex-1 max-w-lg mx-8 hidden lg:block">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder={`Pesquisar em ${activeTab}...`} 
                className="w-full pl-10 pr-4 py-2.5 bg-slate-100/50 rounded-2xl text-xs border-transparent focus:bg-white outline-none transition-all border-2 focus:border-red-500/20"
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex flex-col items-end mr-4">
              <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">{ALVS_CNPJ}</span>
              <span className="text-[9px] font-bold text-slate-300 uppercase">Sistema Operacional</span>
            </div>
            <button onClick={syncData} className="p-2.5 text-slate-400 hover:text-red-600 transition-all bg-slate-50 border border-slate-100 rounded-xl hover:shadow-md">
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar relative">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center gap-4 animate-pulse">
               <div className="w-12 h-12 border-4 border-slate-100 border-t-red-500 rounded-full animate-spin" />
               <p className="font-black text-[9px] text-slate-400 uppercase tracking-[0.3em]">ALVS: Sincronizando Dados</p>
            </div>
          ) : (
            <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
              
              {/* Seção Dashboard */}
              {activeTab === 'dashboard' && (
                <div className="space-y-8">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
                      <StatCard label="Total Ativos" value={equipments.length} icon={HardDrive} color="blue" />
                      <StatCard label="Aguardando" value={equipments.filter(e => e.status === EquipmentStatus.PENDING).length} icon={AlertCircle} color="amber" />
                      <StatCard label="Manutenção" value={equipments.filter(e => e.status === EquipmentStatus.IN_PROGRESS).length} icon={Wrench} color="indigo" />
                      <StatCard label="Concluídos" value={equipments.filter(e => e.status === EquipmentStatus.COMPLETED).length} icon={CheckCircle2} color="emerald" />
                    </div>
                    <button 
                      onClick={() => generateGlobalReport(equipments, customers, ALVS_CNPJ)}
                      className="w-full md:w-auto px-6 py-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-center gap-3 text-slate-700 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all shadow-sm group"
                    >
                      <Download size={18} className="text-red-500" /> Relatório Consolidado
                    </button>
                  </div>

                  <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-100 shadow-sm">
                    <h3 className="font-black text-slate-400 text-[10px] uppercase tracking-widest flex items-center gap-2 mb-8">
                      <History size={14} className="text-red-500" /> Fluxo de Ordens de Serviço
                    </h3>
                    <div className="space-y-4">
                      {filteredServices.map((service) => (
                        <div key={service.id} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 group">
                          <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-red-600 shrink-0"><Wrench size={18} /></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">{service.equipName}</p>
                            <p className="text-[10px] text-slate-500 font-mono truncate">{service.equipCode}</p>
                          </div>
                          <div className="hidden lg:block flex-1 text-center italic text-slate-400 text-[11px] truncate px-4">"{service.description}"</div>
                          <div className="text-right flex items-center gap-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase">{formatDate(service.date).split(',')[0]}</p>
                            <button 
                              onClick={() => generateServiceOrderReport(service, equipments.find(e => e.id === service.equipmentId)!, ALVS_CNPJ)}
                              className="p-2 bg-white text-slate-400 hover:text-red-600 rounded-lg shadow-sm border border-slate-100 transition-all opacity-0 group-hover:opacity-100"
                            ><Download size={14} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Seção Equipamentos */}
              {activeTab === 'equipment' && (
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 md:p-8 rounded-[32px] border border-slate-100 shadow-sm gap-4">
                    <div>
                      <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Gestão de Ativos</h3>
                      <p className="text-xs text-slate-400 font-medium tracking-wide">Inventário completo de equipamentos médicos</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                      <button 
                        onClick={() => generateGlobalReport(equipments, customers, ALVS_CNPJ)}
                        className="px-6 py-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-center gap-3 text-slate-700 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all shadow-sm"
                      >
                        <Download size={18} className="text-red-500" /> Exportar Inventário
                      </button>
                      <button onClick={() => setIsEquipModalOpen(true)} className="bg-slate-800 text-white px-8 py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-black transition-all text-xs font-black uppercase tracking-widest shadow-xl active:scale-95">
                        <Plus size={20} /> Novo Registro
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredEquipments.map(equip => (
                      <div key={equip.id} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-2xl transition-all group flex flex-col">
                        <div className="flex justify-between items-start mb-6">
                          <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border ${getStatusBadge(equip.status as EquipmentStatus)}`}>
                            {equip.status}
                          </span>
                          <div className="flex gap-2">
                            <button onClick={() => { setSelectedEquipment(equip); setIsServiceModalOpen(true); }} className="p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-600 hover:text-white transition-all shadow-sm"><Wrench size={16} /></button>
                            <button onClick={() => generateEquipmentReport(equip, customers.find(c => c.id === equip.customerId)?.name || '', ALVS_CNPJ)} className="p-2 text-slate-400 bg-slate-50 rounded-lg hover:bg-slate-200 transition-all shadow-sm"><FileText size={16} /></button>
                          </div>
                        </div>
                        <h4 className="text-md font-black text-slate-800 truncate">{equip.name}</h4>
                        <p className="text-[10px] text-slate-400 font-mono font-bold uppercase mb-6">{equip.code}</p>
                        <div className="space-y-2 text-[11px] text-slate-600 bg-slate-50 p-4 rounded-xl mb-6 flex-1 border border-slate-100">
                          <div className="flex items-center gap-2 truncate font-semibold"><Building2 size={12} className="text-red-400 shrink-0" /> {customers.find(c => c.id === equip.customerId)?.name}</div>
                          <div className="flex items-center gap-2 truncate font-semibold"><HardDrive size={12} className="text-slate-400 shrink-0" /> S/N: {equip.serialNumber}</div>
                        </div>
                        <button onClick={() => handleAiAdvice(equip)} className="mt-auto w-full py-3 bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-black transition-all">
                          <Sparkles size={12} /> Diagnóstico IA
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Seção Clientes */}
              {activeTab === 'customers' && (
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 md:p-8 rounded-[32px] border border-slate-100 shadow-sm gap-4">
                    <div>
                      <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Unidades Atendidas</h3>
                      <p className="text-xs text-slate-400 font-medium tracking-wide">Base de hospitais e clínicas cadastradas</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                      <button 
                        onClick={() => generateCustomerListReport(customers, ALVS_CNPJ)}
                        className="px-6 py-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-center gap-3 text-slate-700 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all shadow-sm"
                      >
                        <Download size={18} className="text-red-500" /> Relatório de Clientes
                      </button>
                      <button onClick={() => setIsCustomerModalOpen(true)} className="bg-red-600 text-white px-8 py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-red-700 transition-all text-xs font-black uppercase tracking-widest shadow-xl active:scale-95">
                        <Plus size={20} /> Nova Unidade
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                     {filteredCustomers.map(c => (
                       <div key={c.id} className="p-6 md:p-8 bg-white rounded-[32px] border border-slate-100 hover:shadow-2xl transition-all group flex flex-col gap-6">
                          <div className="flex justify-between items-start">
                             <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 transition-all shrink-0"><Building2 size={24} /></div>
                             <div className="px-3 py-1 bg-green-50 text-green-600 text-[9px] font-black rounded-full uppercase tracking-widest">Unidade Ativa</div>
                          </div>
                          <div className="min-w-0">
                            <p className="text-lg font-black text-slate-800 uppercase tracking-tight truncate">{c.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold font-mono mt-1 truncate">{c.taxId}</p>
                          </div>
                          <div className="grid grid-cols-1 gap-3 border-t border-slate-50 pt-6">
                             <div className="flex items-center gap-3 text-xs text-slate-600 truncate"><Mail size={14} className="text-red-500 shrink-0" /> {c.email}</div>
                             <div className="flex items-center gap-3 text-xs text-slate-600 truncate"><Phone size={14} className="text-red-500 shrink-0" /> {c.phone}</div>
                             <div className="flex items-center gap-3 text-xs text-slate-600 truncate"><MapPin size={14} className="text-red-500 shrink-0" /> {c.address}</div>
                          </div>
                       </div>
                     ))}
                  </div>
                </div>
              )}

              {/* Seção Fornecedores */}
              {activeTab === 'suppliers' && (
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 md:p-8 rounded-[32px] border border-slate-100 shadow-sm gap-4">
                    <div>
                      <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Parceiros de Suprimentos</h3>
                      <p className="text-xs text-slate-400 font-medium tracking-wide">Gestão de fornecedores de peças e serviços externos</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                      <button 
                        onClick={() => generateSupplierListReport(suppliers, ALVS_CNPJ)}
                        className="px-6 py-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-center gap-3 text-slate-700 font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all shadow-sm"
                      >
                        <Download size={18} className="text-red-500" /> Lista de Fornecedores
                      </button>
                      <button onClick={() => setIsSupplierModalOpen(true)} className="bg-slate-800 text-white px-8 py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-black transition-all text-xs font-black uppercase tracking-widest shadow-xl active:scale-95">
                        <Plus size={20} /> Novo Fornecedor
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                     {filteredSuppliers.map(s => (
                       <div key={s.id} className="p-6 md:p-8 bg-white rounded-[32px] border border-slate-100 hover:shadow-2xl transition-all group flex flex-col gap-6">
                          <div className="flex justify-between items-start">
                             <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-600 transition-all shrink-0"><Factory size={24} /></div>
                             <div className="px-3 py-1 bg-blue-50 text-blue-600 text-[9px] font-black rounded-full uppercase tracking-widest">Homologado</div>
                          </div>
                          <div className="min-w-0">
                            <p className="text-lg font-black text-slate-800 uppercase tracking-tight truncate">{s.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold font-mono mt-1 truncate">{s.taxId}</p>
                          </div>
                          <div className="grid grid-cols-1 gap-3 border-t border-slate-50 pt-6">
                             <div className="flex items-center gap-3 text-xs text-slate-600 truncate"><Users size={14} className="text-red-500 shrink-0" /> {s.contactName}</div>
                             <div className="flex items-center gap-3 text-xs text-slate-600 truncate"><Mail size={14} className="text-red-500 shrink-0" /> {s.email}</div>
                             <div className="flex items-center gap-3 text-xs text-slate-600 truncate"><Phone size={14} className="text-red-500 shrink-0" /> {s.phone}</div>
                          </div>
                       </div>
                     ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <footer className="mt-auto py-12 text-center">
             <div className="flex items-center justify-center gap-4 mb-4 opacity-30 grayscale hover:grayscale-0 transition-all cursor-default">
                <Logo className="h-6" showCnpj={false} />
                <div className="w-px h-6 bg-slate-300"></div>
                <span className="text-[10px] font-black uppercase tracking-widest">ALVS Clinical Excellence</span>
             </div>
             <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.3em]">
               © 2025 ALVS ENGINEERING & MEDICAL — CNPJ: 50.438.622/0001-74 — TODOS OS DIREITOS RESERVADOS A ANTONIO SINRON NERI DA SILVA
             </p>
          </footer>
        </main>
      </div>

      {/* Nav Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-slate-100 flex items-center justify-around h-20 px-4 z-50 shadow-2xl">
        <MobileNavItem icon={LayoutDashboard} label="Painel" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
        <MobileNavItem icon={Wrench} label="Ativos" active={activeTab === 'equipment'} onClick={() => setActiveTab('equipment')} />
        <MobileNavItem icon={Users} label="Unidades" active={activeTab === 'customers'} onClick={() => setActiveTab('customers')} />
        <MobileNavItem icon={Briefcase} label="Suprim." active={activeTab === 'suppliers'} onClick={() => setActiveTab('suppliers')} />
      </nav>

      {/* Modais */}
      {isEquipModalOpen && (
        <Modal title="Novo Ativo Hospitalar" onClose={() => setIsEquipModalOpen(false)}>
          <form onSubmit={handleAddEquipment} className="space-y-6">
            <FormInput label="Equipamento" name="name" placeholder="Ex: Monitor de Sinais Vitais" required />
            <FormSelect label="Unidade Vinculada" name="customerId" options={customers.map(c => ({ value: c.id, label: c.name }))} />
            <div className="grid grid-cols-2 gap-4">
              <FormInput label="Marca" name="brand" placeholder="Philips" />
              <FormInput label="Modelo" name="model" placeholder="MX450" />
            </div>
            <FormInput label="Nº de Série" name="serialNumber" placeholder="SN-827364" required />
            <FormTextArea label="Laudo de Entrada" name="observations" placeholder="Estado inicial..." />
            <button type="submit" className="w-full py-5 bg-slate-800 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest hover:bg-black transition-all shadow-xl">Cadastrar no Sistema</button>
          </form>
        </Modal>
      )}

      {isCustomerModalOpen && (
        <Modal title="Nova Unidade de Saúde" onClose={() => setIsCustomerModalOpen(false)}>
          <form onSubmit={handleAddCustomer} className="space-y-6">
            <FormInput label="Razão Social / Nome" name="name" required />
            <FormInput label="CNPJ / CPF" name="taxId" required />
            <div className="grid grid-cols-2 gap-4">
              <FormInput label="Telefone" name="phone" />
              <FormInput label="E-mail" name="email" type="email" />
            </div>
            <FormTextArea label="Endereço" name="address" />
            <button type="submit" className="w-full py-5 bg-red-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest hover:bg-red-700 transition-all shadow-xl">Confirmar Unidade</button>
          </form>
        </Modal>
      )}

      {isSupplierModalOpen && (
        <Modal title="Novo Fornecedor" onClose={() => setIsSupplierModalOpen(false)}>
          <form onSubmit={handleAddSupplier} className="space-y-6">
            <FormInput label="Nome da Empresa" name="name" required />
            <FormInput label="CNPJ" name="taxId" required />
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
        <Modal title="Ordem de Serviço Técnica" onClose={() => setIsServiceModalOpen(false)}>
          <div className="bg-red-50 p-6 rounded-[24px] mb-8 border border-red-100">
            <p className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-1">Diagnóstico Ativo</p>
            <p className="text-sm font-bold text-slate-800">{selectedEquipment.name} <span className="text-slate-400 font-mono text-xs ml-2">[{selectedEquipment.code}]</span></p>
          </div>
          <form onSubmit={handleAddService} className="space-y-6">
            <FormTextArea label="Relatório de Atividades" name="description" placeholder="Descreva os procedimentos executados..." required />
            <FormSelect label="Encerramento de Status" name="status" defaultValue={selectedEquipment.status} options={[
              { value: EquipmentStatus.PENDING, label: 'Aguardando Peças' },
              { value: EquipmentStatus.IN_PROGRESS, label: 'Em Manutenção' },
              { value: EquipmentStatus.COMPLETED, label: 'Liberado para Uso' },
            ]} />
            <button type="submit" className="w-full py-5 bg-red-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest hover:bg-red-700 transition-all shadow-xl">Finalizar OS</button>
          </form>
        </Modal>
      )}

      {/* Alerta de IA */}
      {aiAdvice && (
        <div className="fixed bottom-24 md:bottom-10 right-4 md:right-10 z-[100] max-w-sm">
          <div className="bg-white p-6 rounded-[32px] shadow-2xl border-l-4 border-red-600 relative">
             <div className="flex items-center gap-3 mb-4 text-red-600">
               <Sparkles size={18} />
               <span className="font-black text-[9px] uppercase tracking-widest">Diagnóstico Técnico ALVS</span>
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
      className={`w-14 h-14 flex items-center justify-center rounded-2xl transition-all relative group ${active ? 'bg-red-600 text-white shadow-xl shadow-red-200' : color || 'text-slate-300 hover:bg-slate-50 hover:text-red-600'}`}
    >
      <Icon size={22} strokeWidth={active ? 2.5 : 2} />
      <div className="absolute left-20 bg-slate-800 text-white text-[9px] font-black uppercase px-2 py-1 rounded opacity-0 lg:group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[100] tracking-widest shadow-xl">
         {label}
      </div>
    </button>
  );
}

function MobileNavItem({ icon: Icon, label, active, onClick }: any) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center gap-1 w-20 transition-all ${active ? 'text-red-600 scale-110' : 'text-slate-300'}`}>
      <Icon size={20} strokeWidth={active ? 2.5 : 2} />
      <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );
}

function StatCard({ label, value, icon: Icon, color }: any) {
  const colors: any = {
    blue: 'bg-slate-50 text-slate-800 border-slate-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    indigo: 'bg-red-50 text-red-600 border-red-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  };
  return (
    <div className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm flex flex-col gap-4 group hover:shadow-xl transition-all">
      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${colors[color]}`}>
        <Icon size={18} strokeWidth={2.5} />
      </div>
      <div>
        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">{label}</p>
        <p className="text-2xl font-black text-slate-800 tracking-tighter">{value}</p>
      </div>
    </div>
  );
}

function Modal({ title, children, onClose }: any) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80] flex items-end md:items-center justify-center p-4">
      <div className="bg-white rounded-t-[40px] md:rounded-[40px] w-full max-w-lg shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200">
        <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between">
          <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">{title}</h3>
          <button onClick={onClose} className="p-2 text-slate-300 hover:text-red-500 bg-slate-50 rounded-xl transition-colors"><X size={20} /></button>
        </div>
        <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">{children}</div>
      </div>
    </div>
  );
}

function FormInput({ label, ...props }: any) {
  return (
    <div className="space-y-1.5">
      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      <input {...props} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-red-500 outline-none transition-all text-xs font-bold" />
    </div>
  );
}

function FormSelect({ label, options, ...props }: any) {
  return (
    <div className="space-y-1.5">
      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      <select {...props} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-red-500 outline-none text-xs font-bold appearance-none cursor-pointer">
        {options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function FormTextArea({ label, ...props }: any) {
  return (
    <div className="space-y-1.5">
      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      <textarea rows={3} {...props} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:border-red-500 outline-none transition-all text-xs font-medium resize-none" />
    </div>
  );
}

function getStatusBadge(status: EquipmentStatus) {
  switch (status) {
    case EquipmentStatus.PENDING: return 'bg-amber-50 text-amber-600 border-amber-100';
    case EquipmentStatus.IN_PROGRESS: return 'bg-red-50 text-red-600 border-red-100';
    case EquipmentStatus.COMPLETED: return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    default: return 'bg-slate-50 text-slate-700 border-slate-100';
  }
}
