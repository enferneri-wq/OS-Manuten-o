
import React, { useState, useMemo, useEffect } from 'react';
import { 
  LayoutDashboard, Stethoscope, Users, Search, 
  Plus, FileText, Wrench, 
  CheckCircle2, AlertCircle, Building2, 
  HardDrive, BarChart3, PieChart as PieChartIcon,
  LogOut, X, History, ArrowRight,
  Sparkles, RefreshCw, Database, MapPin, Phone, Mail,
  Menu
} from 'lucide-react';
import { 
  ResponsiveContainer, PieChart, Pie, Cell, 
  Tooltip
} from 'recharts';
import { 
  Equipment, Customer, EquipmentStatus, 
  ServiceRecord 
} from './types.ts';
import { generateUniqueCode, generateUUID, formatDate } from './utils.ts';
import { generateEquipmentReport } from './services/pdfService.ts';
import { getMaintenanceAdvice } from './services/geminiService.ts';

const API_URL = 'api.php';
const STORAGE_KEY_EQUIP = 'alvs_equipments';
const STORAGE_KEY_CUST = 'alvs_customers';

const INITIAL_CUSTOMERS: Customer[] = [
  { id: 'c1', name: 'Hospital das Clínicas', taxId: '12.345.678/0001-90', email: 'contato@hc.org', phone: '(11) 98888-7777', address: 'Av. Paulista, 1000' },
  { id: 'c2', name: 'Clínica Saúde Vital', taxId: '98.765.432/0001-21', email: 'adm@saudevital.com', phone: '(11) 97777-6666', address: 'Rua das Flores, 45' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'equipment' | 'customers'>('dashboard');
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>(INITIAL_CUSTOMERS);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const [isEquipModalOpen, setIsEquipModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  const loadLocalData = () => {
    const savedEquip = localStorage.getItem(STORAGE_KEY_EQUIP);
    const savedCust = localStorage.getItem(STORAGE_KEY_CUST);
    if (savedEquip) setEquipments(JSON.parse(savedEquip));
    if (savedCust) setCustomers(JSON.parse(savedCust));
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
  }, [equipments, customers]);

  const stats = useMemo(() => {
    const statusCounts = equipments.reduce((acc: any, curr) => {
      acc[curr.status] = (acc[curr.status] || 0) + 1;
      return acc;
    }, {});
    
    const pieData = [
      { name: 'Pendente', value: statusCounts[EquipmentStatus.PENDING] || 0, color: '#F59E0B' },
      { name: 'Em Manutenção', value: statusCounts[EquipmentStatus.IN_PROGRESS] || 0, color: '#3B82F6' },
      { name: 'Concluído', value: statusCounts[EquipmentStatus.COMPLETED] || 0, color: '#10B981' },
    ];

    const recentServices = equipments
      .flatMap(e => (e.serviceRecords || []).map(s => ({ ...s, equipName: e.name, equipCode: e.code })))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);

    return { pieData, recentServices };
  }, [equipments]);

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

    try {
      await fetch(`${API_URL}?action=add_equipment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem)
      });
    } catch (err) {
      console.warn("Offline: Salvo localmente");
    }
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

    try {
      await fetch(`${API_URL}?action=add_customer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCust)
      });
    } catch (err) {
      console.warn("Offline: Cliente salvo localmente");
    }
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
        return {
          ...eq,
          status: newStatus,
          serviceRecords: [newRecord, ...(eq.serviceRecords || [])]
        };
      }
      return eq;
    });
    setEquipments(updated);
    setIsServiceModalOpen(false);

    try {
      await fetch(`${API_URL}?action=add_service`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newRecord, newStatus })
      });
    } catch (err) {
      console.warn("Offline: Serviço salvo localmente");
    }
  };

  const handleAiAdvice = async (equip: Equipment) => {
    setIsLoadingAi(true);
    const advice = await getMaintenanceAdvice(equip.name, equip.brand, equip.model, equip.observations);
    setAiAdvice(advice);
    setIsLoadingAi(false);
  };

  const filteredEquipments = equipments.filter(e => 
    e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    e.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-inter text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-28 bg-white border-r border-slate-200 flex-col items-center py-8 z-50">
        <div className="mb-10 text-center">
          <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-200 inline-block mb-3">
            <Stethoscope size={28} strokeWidth={2.5} />
          </div>
          <div className="px-2">
            <h2 className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] leading-tight">
              ALVS<br/>Engineering
            </h2>
          </div>
        </div>
        
        <nav className="flex-1 flex flex-col gap-6">
          <SidebarIcon icon={LayoutDashboard} label="Painel" id="dashboard" activeTab={activeTab} onClick={setActiveTab} />
          <SidebarIcon icon={Wrench} label="Equipamentos" id="equipment" activeTab={activeTab} onClick={setActiveTab} />
          <SidebarIcon icon={Users} label="Unidades" id="customers" activeTab={activeTab} onClick={setActiveTab} />
        </nav>

        <div className="mt-auto flex flex-col gap-6">
          <SidebarIcon icon={LogOut} label="Sair" id="logout" activeTab="" onClick={() => {}} color="text-slate-300 hover:text-red-500" />
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden pb-20 md:pb-0">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 md:px-8 flex items-center justify-between z-30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="md:hidden bg-blue-600 p-2 rounded-xl text-white">
              <Stethoscope size={20} />
            </div>
            <h1 className="text-sm md:text-xl font-black text-slate-800 tracking-tight uppercase truncate">
              {activeTab === 'dashboard' ? 'Status' : activeTab === 'equipment' ? 'Ativos' : 'Unidades'}
            </h1>
          </div>

          <div className="flex items-center gap-3 md:gap-6">
            <div className="relative hidden sm:block lg:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" placeholder="Buscar..." 
                className="w-32 md:w-48 pl-10 pr-4 py-2 bg-slate-100 rounded-xl text-xs border-transparent focus:bg-white outline-none transition-all shadow-inner"
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            
            <button 
              onClick={syncData} 
              title="Sincronizar"
              className="p-2 text-slate-400 hover:text-blue-600 transition-all bg-slate-50 rounded-xl"
            >
              <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>

            <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center font-bold text-white shadow-lg border-2 border-white shrink-0" title="Administrador">AV</div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center gap-4 text-slate-400 animate-pulse">
               <RefreshCw size={48} className="animate-spin text-blue-500" />
               <p className="font-black text-[10px] uppercase tracking-widest">Aguarde...</p>
            </div>
          ) : (
            <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
              {activeTab === 'dashboard' && (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                    <StatCard label="Total Ativos" value={equipments.length} icon={HardDrive} color="blue" />
                    <StatCard label="Pendentes" value={equipments.filter(e => e.status === EquipmentStatus.PENDING).length} icon={AlertCircle} color="amber" />
                    <StatCard label="Em Reparo" value={equipments.filter(e => e.status === EquipmentStatus.IN_PROGRESS).length} icon={Wrench} color="indigo" />
                    <StatCard label="Concluídos" value={equipments.filter(e => e.status === EquipmentStatus.COMPLETED).length} icon={CheckCircle2} color="emerald" />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col items-center">
                      <h3 className="w-full text-left font-black text-slate-400 text-[10px] uppercase tracking-widest mb-8 flex items-center gap-2">
                        <PieChartIcon size={14} className="text-blue-500" /> Saúde da Frota
                      </h3>
                      <div className="w-full h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={stats.pieData} innerRadius={60} outerRadius={85} paddingAngle={8} dataKey="value" stroke="none">
                              {stats.pieData.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-100 shadow-sm lg:col-span-2">
                      <h3 className="font-black text-slate-400 text-[10px] uppercase tracking-widest flex items-center gap-2 mb-8">
                        <History size={14} className="text-indigo-500" /> Atividades Recentes
                      </h3>
                      <div className="space-y-4">
                        {stats.recentServices.length > 0 ? stats.recentServices.map((service) => (
                          <div key={service.id} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-all">
                            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
                              <Wrench size={18} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate">{service.equipName}</p>
                              <p className="text-[10px] text-slate-500 font-mono truncate">{service.equipCode}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-[10px] font-black text-slate-400 uppercase">{formatDate(service.date).split(',')[0]}</p>
                              <p className="text-[11px] text-slate-600 truncate max-w-[100px] md:max-w-[150px] font-medium italic">"{service.description}"</p>
                            </div>
                          </div>
                        )) : (
                          <div className="h-40 flex flex-col items-center justify-center text-slate-300 gap-2 border-2 border-dashed border-slate-100 rounded-[24px]">
                             <FileText size={32} />
                             <p className="text-[10px] font-black uppercase tracking-widest">Sem movimentações</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'equipment' && (
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 md:p-8 rounded-[32px] border border-slate-100 shadow-sm gap-4">
                    <div>
                      <h3 className="text-lg font-black text-slate-800">Inventário de Ativos</h3>
                      <p className="text-xs text-slate-400 font-medium">Controle central — {filteredEquipments.length} itens</p>
                    </div>
                    <button onClick={() => setIsEquipModalOpen(true)} className="w-full md:w-auto bg-blue-600 text-white px-8 py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-blue-700 transition-all text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-100 active:scale-95">
                      <Plus size={20} /> Registrar Novo
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredEquipments.map(equip => (
                      <div key={equip.id} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all group flex flex-col">
                        <div className="flex justify-between items-start mb-6">
                          <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border ${getStatusBadge(equip.status as EquipmentStatus)}`}>
                            {equip.status}
                          </span>
                          <div className="flex gap-2">
                            <button onClick={() => { setSelectedEquipment(equip); setIsServiceModalOpen(true); }} className="p-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm">
                              <Wrench size={16} />
                            </button>
                            <button onClick={() => generateEquipmentReport(equip, customers.find(c => c.id === equip.customerId)?.name || '')} className="p-2 text-slate-400 bg-slate-50 rounded-lg hover:bg-slate-200 transition-all shadow-sm">
                              <FileText size={16} />
                            </button>
                          </div>
                        </div>

                        <h4 className="text-md font-black text-slate-800 group-hover:text-blue-600 transition-colors truncate">{equip.name}</h4>
                        <p className="text-[10px] text-slate-400 font-mono font-bold uppercase mb-6 flex items-center gap-2">
                           <div className="w-1.5 h-1.5 bg-slate-300 rounded-full" /> {equip.code}
                        </p>
                        
                        <div className="space-y-2 text-[11px] text-slate-600 bg-slate-50/50 p-4 rounded-xl mb-6 border border-slate-100/50">
                          <div className="flex items-center gap-2 font-semibold truncate"><Building2 size={12} className="text-blue-400 shrink-0" /> {customers.find(c => c.id === equip.customerId)?.name}</div>
                          <div className="flex items-center gap-2 font-semibold truncate"><HardDrive size={12} className="text-indigo-400 shrink-0" /> {equip.brand} {equip.model}</div>
                        </div>

                        <button 
                          onClick={() => handleAiAdvice(equip)} 
                          className="mt-auto w-full py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                        >
                          <Sparkles size={12} /> Diagnóstico IA
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'customers' && (
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 md:p-8 rounded-[32px] border border-slate-100 shadow-sm gap-4">
                    <div>
                      <h3 className="text-lg font-black text-slate-800">Unidades de Saúde</h3>
                      <p className="text-xs text-slate-400 font-medium">Gestão de clientes — {customers.length} unidades</p>
                    </div>
                    <button onClick={() => setIsCustomerModalOpen(true)} className="w-full md:w-auto bg-blue-600 text-white px-8 py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-blue-700 transition-all text-xs font-black uppercase tracking-widest shadow-xl shadow-blue-100 active:scale-95">
                      <Plus size={20} /> Adicionar Unidade
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                     {customers.map(c => (
                       <div key={c.id} className="p-6 md:p-8 bg-white rounded-[32px] border border-slate-100 text-left hover:shadow-2xl transition-all group flex flex-col gap-6">
                          <div className="flex justify-between items-start">
                             <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all shrink-0">
                               <Building2 size={24} />
                             </div>
                             <div className="px-3 py-1 bg-green-50 text-green-600 text-[10px] font-black rounded-full uppercase tracking-tighter">
                               Ativo
                             </div>
                          </div>
                          <div className="min-w-0">
                            <p className="text-lg font-black text-slate-800 uppercase tracking-tight truncate">{c.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold font-mono mt-1 truncate">{c.taxId}</p>
                          </div>
                          <div className="grid grid-cols-1 gap-3 border-t border-slate-50 pt-6">
                             <div className="flex items-center gap-3 text-xs text-slate-600 truncate"><Mail size={14} className="text-blue-400 shrink-0" /> {c.email}</div>
                             <div className="flex items-center gap-3 text-xs text-slate-600 truncate"><Phone size={14} className="text-blue-400 shrink-0" /> {c.phone}</div>
                             <div className="flex items-center gap-3 text-xs text-slate-600 truncate"><MapPin size={14} className="text-blue-400 shrink-0" /> {c.address}</div>
                          </div>
                       </div>
                     ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-slate-100 flex items-center justify-around h-20 px-4 z-50 shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.05)]">
        <MobileNavItem icon={LayoutDashboard} label="Painel" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
        <MobileNavItem icon={Wrench} label="Ativos" active={activeTab === 'equipment'} onClick={() => setActiveTab('equipment')} />
        <MobileNavItem icon={Users} label="Unidades" active={activeTab === 'customers'} onClick={() => setActiveTab('customers')} />
      </nav>

      {/* Modals */}
      {isEquipModalOpen && (
        <Modal title="Novo Ativo" onClose={() => setIsEquipModalOpen(false)}>
          <form onSubmit={handleAddEquipment} className="space-y-6">
            <FormInput label="Nome do Equipamento" name="name" placeholder="Ex: Monitor Multiparamétrico" required />
            <FormSelect label="Unidade de Saúde" name="customerId" options={customers.map(c => ({ value: c.id, label: c.name }))} />
            <div className="grid grid-cols-2 gap-4">
              <FormInput label="Marca" name="brand" placeholder="Philips" />
              <FormInput label="Modelo" name="model" placeholder="MX450" />
            </div>
            <FormInput label="Número de Série" name="serialNumber" placeholder="SN-XXXXXXXX" required />
            <FormTextArea label="Laudo de Entrada / Observações" name="observations" placeholder="Estado inicial..." />
            <button type="submit" className="w-full py-5 bg-blue-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all">Registrar Equipamento</button>
          </form>
        </Modal>
      )}

      {isCustomerModalOpen && (
        <Modal title="Nova Unidade de Saúde" onClose={() => setIsCustomerModalOpen(false)}>
          <form onSubmit={handleAddCustomer} className="space-y-6">
            <FormInput label="Nome da Unidade / Razão Social" name="name" placeholder="Ex: Hospital Municipal" required />
            <FormInput label="CNPJ / CPF" name="taxId" placeholder="00.000.000/0000-00" required />
            <div className="grid grid-cols-2 gap-4">
              <FormInput label="Telefone" name="phone" placeholder="(00) 00000-0000" />
              <FormInput label="E-mail" name="email" type="email" placeholder="contato@exemplo.com" />
            </div>
            <FormTextArea label="Endereço Completo" name="address" placeholder="Rua, Número, Bairro, Cidade..." />
            <button type="submit" className="w-full py-5 bg-blue-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all">Salvar Unidade</button>
          </form>
        </Modal>
      )}

      {isServiceModalOpen && selectedEquipment && (
        <Modal title="Ordem de Serviço" onClose={() => setIsServiceModalOpen(false)}>
          <div className="bg-blue-50 p-6 rounded-[24px] mb-8 border border-blue-100">
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Equipamento</p>
            <p className="text-sm font-bold text-slate-800">{selectedEquipment.name} — <span className="font-mono text-blue-600">{selectedEquipment.code}</span></p>
          </div>
          <form onSubmit={handleAddService} className="space-y-6">
            <FormTextArea label="Procedimentos Realizados" name="description" placeholder="Ações corretivas/preventivas..." required />
            <FormSelect label="Status" name="status" defaultValue={selectedEquipment.status} options={[
              { value: EquipmentStatus.PENDING, label: 'Aguardando Peças' },
              { value: EquipmentStatus.IN_PROGRESS, label: 'Em Manutenção' },
              { value: EquipmentStatus.COMPLETED, label: 'Liberado / Concluído' },
            ]} />
            <button type="submit" className="w-full py-5 bg-blue-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all">Salvar Intervenção</button>
          </form>
        </Modal>
      )}

      {aiAdvice && (
        <div className="fixed bottom-24 md:bottom-10 right-4 md:right-10 z-[100] max-w-sm animate-in slide-in-from-right duration-500">
          <div className="bg-white p-6 md:p-8 rounded-[32px] shadow-2xl border border-indigo-100 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-1.5 h-full bg-indigo-600"></div>
             <div className="flex items-center gap-3 mb-4 text-indigo-600">
               <div className="bg-indigo-50 p-2 rounded-xl"><Sparkles size={20} /></div>
               <span className="font-black text-[10px] uppercase tracking-widest">IA Gemini</span>
               <button onClick={() => setAiAdvice(null)} className="ml-auto text-slate-300 hover:text-red-500 transition-colors"><X size={20} /></button>
             </div>
             <p className="text-xs text-slate-700 leading-relaxed font-medium italic">"{aiAdvice}"</p>
          </div>
        </div>
      )}

      {isLoadingAi && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-md">
           <div className="bg-white p-12 rounded-[48px] shadow-2xl flex flex-col items-center">
              <div className="w-12 h-12 border-[5px] border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
              <p className="mt-8 font-black text-slate-800 text-[10px] uppercase tracking-[0.3em] animate-pulse text-center">Consultando IA...</p>
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
      className={`w-14 h-14 flex items-center justify-center rounded-2xl transition-all relative group ${active ? 'bg-blue-600 text-white shadow-xl shadow-blue-200' : color || 'text-slate-300 hover:bg-slate-50 hover:text-blue-600'}`}
    >
      <Icon size={24} strokeWidth={active ? 2.5 : 2} />
      <div className="absolute left-20 bg-slate-800 text-white text-[9px] font-black uppercase px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[100] tracking-widest shadow-xl">
         {label}
      </div>
    </button>
  );
}

function MobileNavItem({ icon: Icon, label, active, onClick }: any) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 w-20 transition-all ${active ? 'text-blue-600 scale-110' : 'text-slate-300'}`}
    >
      <Icon size={22} strokeWidth={active ? 2.5 : 2} />
      <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
      {active && <div className="w-1 h-1 bg-blue-600 rounded-full mt-0.5" />}
    </button>
  );
}

function StatCard({ label, value, icon: Icon, color }: any) {
  const colorMap: any = {
    blue: 'text-blue-600 bg-blue-50 border-blue-100',
    amber: 'text-amber-600 bg-amber-50 border-amber-100',
    indigo: 'text-indigo-600 bg-indigo-50 border-indigo-100',
    emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
  };
  return (
    <div className="bg-white p-5 md:p-6 rounded-[28px] border border-slate-100 shadow-sm flex flex-col gap-3 md:gap-4 group hover:shadow-xl transition-all">
      <div className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center border transition-transform group-hover:scale-110 ${colorMap[color]}`}>
        <Icon size={20} strokeWidth={2.5} />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">{label}</p>
        <p className="text-2xl md:text-3xl font-black text-slate-800 tracking-tighter">{value}</p>
      </div>
    </div>
  );
}

function Modal({ title, children, onClose }: any) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80] flex items-end md:items-center justify-center p-4">
      <div className="bg-white rounded-t-[40px] md:rounded-[40px] w-full max-w-lg shadow-2xl overflow-hidden animate-in slide-in-from-bottom md:zoom-in-95 duration-200">
        <div className="px-6 md:px-10 py-6 md:py-8 border-b border-slate-50 flex items-center justify-between">
          <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">{title}</h3>
          <button onClick={onClose} className="p-2 text-slate-300 hover:text-red-500 bg-slate-50 rounded-xl transition-colors"><X size={20} /></button>
        </div>
        <div className="p-6 md:p-10 max-h-[75vh] md:max-h-[75vh] overflow-y-auto custom-scrollbar">{children}</div>
      </div>
    </div>
  );
}

function FormInput({ label, ...props }: any) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      <input {...props} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm font-medium" />
    </div>
  );
}

function FormSelect({ label, options, ...props }: any) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      <div className="relative">
        <select {...props} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-sm font-bold appearance-none cursor-pointer pr-12">
          {options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
           <ArrowRight size={16} className="rotate-90" />
        </div>
      </div>
    </div>
  );
}

function FormTextArea({ label, ...props }: any) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      <textarea rows={3} {...props} className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm font-medium resize-none" />
    </div>
  );
}

function getStatusBadge(status: EquipmentStatus) {
  switch (status) {
    case EquipmentStatus.PENDING: return 'bg-amber-50 text-amber-600 border-amber-100';
    case EquipmentStatus.IN_PROGRESS: return 'bg-blue-50 text-blue-600 border-blue-100';
    case EquipmentStatus.COMPLETED: return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    default: return 'bg-slate-50 text-slate-700 border-slate-100';
  }
}
