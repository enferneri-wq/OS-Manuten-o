import React, { useState, useMemo, useEffect } from 'react';
import { 
  LayoutDashboard, Stethoscope, Users, Search, 
  Plus, FileText, Wrench, 
  CheckCircle2, AlertCircle, Building2, 
  HardDrive, BarChart3, PieChart as PieChartIcon,
  Settings, LogOut, Bell, X, History, ArrowRight,
  Sparkles, RefreshCw
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

// No Hostinger, o caminho seria relativo ou absoluto
const API_URL = 'api.php';

const INITIAL_CUSTOMERS: Customer[] = [
  { id: 'c1', name: 'Hospital das Clínicas', taxId: '12.345.678/0001-90', email: 'contato@hc.org', phone: '(11) 98888-7777', address: 'Av. Paulista, 1000' },
  { id: 'c2', name: 'Clínica Saúde Vital', taxId: '98.765.432/0001-21', email: 'adm@saudevital.com', phone: '(11) 97777-6666', address: 'Rua das Flores, 45' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'equipment' | 'customers'>('dashboard');
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [customers] = useState<Customer[]>(INITIAL_CUSTOMERS);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const [isEquipModalOpen, setIsEquipModalOpen] = useState(false);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  // Carregar dados da Hostinger ao iniciar
  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}?action=get_all`);
      const data = await response.json();
      if (Array.isArray(data)) {
        setEquipments(data);
      }
    } catch (error) {
      console.error('Erro ao buscar dados do servidor:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
      .flatMap(e => e.serviceRecords.map(s => ({ ...s, equipName: e.name, equipCode: e.code })))
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

    try {
      const resp = await fetch(`${API_URL}?action=add_equipment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem)
      });
      if (resp.ok) {
        setEquipments([newItem, ...equipments]);
        setIsEquipModalOpen(false);
      }
    } catch (err) {
      alert('Erro ao salvar no servidor.');
    }
  };

  const handleAddService = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedEquipment) return;
    const fd = new FormData(e.currentTarget);
    const newStatus = fd.get('status') as EquipmentStatus;
    const serviceData = {
      id: generateUUID(), 
      equipmentId: selectedEquipment.id,
      date: new Date().toISOString(), 
      description: fd.get('description') as string, 
      technicianId: 'u1',
      newStatus: newStatus
    };

    try {
      const resp = await fetch(`${API_URL}?action=add_service`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serviceData)
      });
      if (resp.ok) {
        await fetchData(); // Atualiza a lista completa para garantir consistência
        setIsServiceModalOpen(false);
      }
    } catch (err) {
      alert('Erro ao registrar serviço no servidor.');
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
    <div className="flex h-screen bg-slate-50 overflow-hidden font-inter">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex w-24 bg-white border-r border-slate-200 flex-col items-center py-8 z-50">
        <div className="mb-12">
          <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg">
            <Stethoscope size={28} strokeWidth={2.5} />
          </div>
        </div>
        
        <nav className="flex-1 flex flex-col gap-6">
          <SidebarIcon icon={LayoutDashboard} label="Painel" id="dashboard" activeTab={activeTab} onClick={setActiveTab} />
          <SidebarIcon icon={Wrench} label="Ativos" id="equipment" activeTab={activeTab} onClick={setActiveTab} />
          <SidebarIcon icon={Users} label="Clientes" id="customers" activeTab={activeTab} onClick={setActiveTab} />
        </nav>

        <div className="mt-auto flex flex-col gap-6">
          <button onClick={fetchData} className="p-3 text-slate-300 hover:text-blue-600 transition-colors">
            <RefreshCw size={24} className={loading ? 'animate-spin' : ''} />
          </button>
          <SidebarIcon icon={LogOut} label="Sair" id="logout" activeTab="" onClick={() => {}} color="text-slate-300 hover:text-red-500" />
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-100 px-8 flex items-center justify-between z-30">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-black text-slate-800 tracking-tight uppercase">
              {activeTab === 'dashboard' ? 'Painel Hostinger' : activeTab === 'equipment' ? 'Inventário' : 'Clientes'}
            </h1>
            <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold uppercase tracking-widest border border-blue-100">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
              Sincronizado
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative hidden lg:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" placeholder="Pesquisar OS..." 
                className="w-48 pl-11 pr-4 py-2 bg-slate-100 rounded-xl text-xs border-transparent focus:bg-white outline-none transition-all"
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="h-10 w-10 bg-slate-200 rounded-xl flex items-center justify-center font-bold text-slate-600">AV</div>
          </div>
        </header>

        {/* Conteúdo Principal */}
        <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center gap-4 text-slate-400">
               <RefreshCw size={48} className="animate-spin" />
               <p className="font-black text-[10px] uppercase tracking-widest">Acessando Banco de Dados Hostinger...</p>
            </div>
          ) : (
            <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
              
              {activeTab === 'dashboard' && (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard label="Total Ativos" value={equipments.length} icon={HardDrive} color="blue" />
                    <StatCard label="Pendentes" value={equipments.filter(e => e.status === EquipmentStatus.PENDING).length} icon={AlertCircle} color="amber" />
                    <StatCard label="Em Reparo" value={equipments.filter(e => e.status === EquipmentStatus.IN_PROGRESS).length} icon={Wrench} color="indigo" />
                    <StatCard label="Concluídos" value={equipments.filter(e => e.status === EquipmentStatus.COMPLETED).length} icon={CheckCircle2} color="emerald" />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col items-center">
                      <h3 className="w-full text-left font-black text-slate-400 text-[10px] uppercase tracking-widest mb-8 flex items-center gap-2">
                        <PieChartIcon size={14} /> Saúde da Frota
                      </h3>
                      <div className="w-full h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={stats.pieData} innerRadius={60} outerRadius={85} paddingAngle={8} dataKey="value" stroke="none">
                              {stats.pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: '16px', border: 'none' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm lg:col-span-2">
                      <h3 className="font-black text-slate-400 text-[10px] uppercase tracking-widest flex items-center gap-2 mb-8">
                        <History size={14} /> Histórico Sincronizado
                      </h3>
                      <div className="space-y-4">
                        {stats.recentServices.length > 0 ? stats.recentServices.map((service) => (
                          <div key={service.id} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-slate-50 transition-all">
                            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                              <Wrench size={18} />
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-bold text-slate-800">{service.equipName}</p>
                              <p className="text-[10px] text-slate-500 font-mono">{service.equipCode}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-black text-slate-400 uppercase">{formatDate(service.date).split(',')[0]}</p>
                              <p className="text-[11px] text-slate-600 truncate max-w-[150px]">{service.description}</p>
                            </div>
                          </div>
                        )) : (
                          <p className="text-center text-slate-300 text-xs py-10">Nenhum serviço registrado no banco.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'equipment' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
                    <div>
                      <h3 className="text-lg font-black text-slate-800">Inventário Geral</h3>
                      <p className="text-xs text-slate-400">Clique na chave para registrar manutenção</p>
                    </div>
                    <button onClick={() => setIsEquipModalOpen(true)} className="bg-blue-600 text-white px-6 py-3 rounded-xl flex items-center gap-2 hover:bg-blue-700 transition-all text-xs font-bold uppercase tracking-widest shadow-lg shadow-blue-100">
                      <Plus size={18} /> Adicionar Ativo
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredEquipments.map(equip => (
                      <div key={equip.id} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-xl transition-all">
                        <div className="flex justify-between items-start mb-6">
                          <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border ${getStatusBadge(equip.status as EquipmentStatus)}`}>
                            {equip.status}
                          </span>
                          <div className="flex gap-2">
                            <button onClick={() => { setSelectedEquipment(equip); setIsServiceModalOpen(true); }} className="p-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-600 hover:text-white transition-all">
                              <Wrench size={16} />
                            </button>
                            <button onClick={() => generateEquipmentReport(equip, customers.find(c => c.id === equip.customerId)?.name || '')} className="p-2 text-slate-400 bg-slate-50 rounded-lg hover:bg-slate-200 transition-all">
                              <FileText size={16} />
                            </button>
                          </div>
                        </div>

                        <h4 className="text-md font-black text-slate-800">{equip.name}</h4>
                        <p className="text-[10px] text-slate-400 font-mono font-bold uppercase mb-4">{equip.code}</p>
                        
                        <div className="space-y-2 text-[11px] text-slate-600 bg-slate-50 p-4 rounded-xl mb-4">
                          <div className="flex items-center gap-2"><Building2 size={12} /> {customers.find(c => c.id === equip.customerId)?.name}</div>
                          <div className="flex items-center gap-2"><HardDrive size={12} /> {equip.brand} {equip.model}</div>
                        </div>

                        <button onClick={() => handleAiAdvice(equip)} className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-50">
                          <Sparkles size={12} /> Sugestão Técnica IA
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'customers' && (
                <div className="bg-white p-12 rounded-[40px] border border-slate-100 shadow-sm text-center">
                  <Building2 size={48} className="mx-auto text-blue-100 mb-4" />
                  <h3 className="text-xl font-black text-slate-800 tracking-tight">Unidades Hospitalares</h3>
                  <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                     {customers.map(c => (
                       <div key={c.id} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-left hover:bg-white hover:shadow-lg transition-all">
                          <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{c.name}</p>
                          <p className="text-[10px] text-slate-400 mt-1">{c.taxId}</p>
                       </div>
                     ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Modais (Ativos e OS) permanecem similares, mas agora chamam a API */}
      {isEquipModalOpen && (
        <Modal title="Novo Ativo (MySQL)" onClose={() => setIsEquipModalOpen(false)}>
          <form onSubmit={handleAddEquipment} className="space-y-4">
            <FormInput label="Nome Equipamento" name="name" required />
            <FormSelect label="Unidade" name="customerId" options={customers.map(c => ({ value: c.id, label: c.name }))} />
            <div className="grid grid-cols-2 gap-4">
              <FormInput label="Marca" name="brand" />
              <FormInput label="Modelo" name="model" />
            </div>
            <FormInput label="Fabricante" name="manufacturer" />
            <FormInput label="Nº Série" name="serialNumber" required />
            <FormTextArea label="Observações Técnicas" name="observations" />
            <button type="submit" className="w-full py-4 bg-blue-600 text-white font-black rounded-xl uppercase text-[10px] tracking-widest shadow-lg shadow-blue-100">Persistir no Banco</button>
          </form>
        </Modal>
      )}

      {isServiceModalOpen && selectedEquipment && (
        <Modal title="Gerar Ordem de Serviço" onClose={() => setIsServiceModalOpen(false)}>
          <div className="bg-blue-50 p-4 rounded-xl mb-6">
            <p className="text-[10px] font-black text-blue-400 uppercase">Gravando OS para</p>
            <p className="text-xs font-bold text-slate-800">{selectedEquipment.name} — {selectedEquipment.code}</p>
          </div>
          <form onSubmit={handleAddService} className="space-y-4">
            <FormTextArea label="Descrição Técnica dos Serviços" name="description" required />
            <FormSelect label="Status Atualizado" name="status" defaultValue={selectedEquipment.status} options={[
              { value: EquipmentStatus.PENDING, label: 'Aguardando Peças' },
              { value: EquipmentStatus.IN_PROGRESS, label: 'Em Manutenção' },
              { value: EquipmentStatus.COMPLETED, label: 'Liberado / OK' },
            ]} />
            <button type="submit" className="w-full py-4 bg-blue-600 text-white font-black rounded-xl uppercase text-[10px] tracking-widest shadow-lg shadow-blue-100">Finalizar e Sincronizar</button>
          </form>
        </Modal>
      )}

      {/* IA Feedback */}
      {aiAdvice && (
        <div className="fixed bottom-10 right-10 z-[100] max-w-xs animate-in slide-in-from-right duration-500">
          <div className="bg-white p-6 rounded-3xl shadow-2xl border border-indigo-100">
             <div className="flex items-center gap-2 mb-3 text-indigo-600">
               <Sparkles size={16} />
               <span className="font-black text-[9px] uppercase tracking-widest">IA Clínica Gemini</span>
               <button onClick={() => setAiAdvice(null)} className="ml-auto text-slate-300 hover:text-red-500"><X size={16} /></button>
             </div>
             <p className="text-[11px] text-slate-600 leading-relaxed italic">"{aiAdvice}"</p>
          </div>
        </div>
      )}

      {isLoadingAi && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
           <div className="bg-white p-8 rounded-3xl flex flex-col items-center">
              <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
              <p className="mt-4 font-black text-slate-800 text-[9px] uppercase tracking-[0.2em]">Consultando IA Técnica...</p>
           </div>
        </div>
      )}
    </div>
  );
}

// Helpers Visuais
function SidebarIcon({ icon: Icon, label, id, activeTab, onClick, color }: any) {
  const active = activeTab === id;
  return (
    <button onClick={() => onClick(id)} className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : color || 'text-slate-300 hover:bg-slate-50 hover:text-blue-600'}`}>
      <Icon size={22} strokeWidth={active ? 2.5 : 2} />
    </button>
  );
}

function StatCard({ label, value, icon: Icon, color }: any) {
  const colorMap: any = {
    blue: 'text-blue-600 bg-blue-50',
    amber: 'text-amber-600 bg-amber-50',
    indigo: 'text-indigo-600 bg-indigo-50',
    emerald: 'text-emerald-600 bg-emerald-50',
  };
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${colorMap[color]}`}>
        <Icon size={20} strokeWidth={2.5} />
      </div>
      <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{label}</p>
      <p className="text-2xl font-black text-slate-800">{value}</p>
    </div>
  );
}

function Modal({ title, children, onClose }: any) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
      <div className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between">
          <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">{title}</h3>
          <button onClick={onClose} className="p-2 text-slate-300 hover:text-red-500"><X size={20} /></button>
        </div>
        <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar">{children}</div>
      </div>
    </div>
  );
}

function FormInput({ label, ...props }: any) {
  return (
    <div className="space-y-1">
      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      <input {...props} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-xs" />
    </div>
  );
}

function FormSelect({ label, options, ...props }: any) {
  return (
    <div className="space-y-1">
      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      <select {...props} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none text-xs font-bold appearance-none">
        {options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function FormTextArea({ label, ...props }: any) {
  return (
    <div className="space-y-1">
      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
      <textarea rows={3} {...props} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-xs" />
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