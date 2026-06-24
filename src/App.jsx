import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "dividas-app-v2";

const STATUS_CONFIG = {
  pendente: { label: "Pendente", color: "#EF4444", bg: "#3A1010" },
  parcial: { label: "Parcial", color: "#F59E0B", bg: "#3A2A00" },
  pago: { label: "Pago", color: "#10B981", bg: "#0A2A1A" },
};

const CATEGORIAS = ["Cartão", "Empréstimo", "Boleto", "Aluguel", "Serviço", "Outro"];

function formatBRL(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseFloat(value) || 0);
}

function parseVal(str) {
  if (!str) return 0;
  return parseFloat(String(str).replace(/[^\d,]/g, "").replace(",", ".")) || 0;
}

function calcParcelaAtual(dataInicio, totalParcelas) {
  if (!dataInicio || !totalParcelas) return null;
  const inicio = new Date(dataInicio + "T00:00:00");
  const hoje = new Date();
  const meses = (hoje.getFullYear() - inicio.getFullYear()) * 12 + (hoje.getMonth() - inicio.getMonth());
  const atual = Math.min(Math.max(meses + 1, 1), totalParcelas);
  return atual;
}

function diasParaVencer(vencimento) {
  if (!vencimento) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const v = new Date(vencimento + "T00:00:00");
  return Math.round((v - hoje) / (1000 * 60 * 60 * 24));
}

const emptyForm = {
  nome: "", valor: "", vencimento: "", categoria: "Cartão", status: "pendente", obs: "",
  parcelado: false, totalParcelas: "", parcelaAtualManual: "", dataInicio: "", modoContagem: "manual",
};

function Dividas() {
  const [dividas, setDividas] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [filtro, setFiltro] = useState("todos");
  const [loaded, setLoaded] = useState(false);
  const [notifPerm, setNotifPerm] = useState("default");
  const [alertas, setAlertas] = useState([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setDividas(JSON.parse(raw));
    } catch {}
    setLoaded(true);
    if ("Notification" in window) setNotifPerm(Notification.permission);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dividas));
    } catch {}
  }, [dividas, loaded]);

  useEffect(() => {
    if (!loaded) return;
    const novos = [];
    dividas.forEach(d => {
      if (d.status === "pago") return;
      const dias = diasParaVencer(d.vencimento);
      if (dias !== null) {
        if (dias < 0) novos.push({ id: d.id, msg: `"${d.nome}" venceu há ${Math.abs(dias)} dia(s)!`, tipo: "erro" });
        else if (dias === 0) novos.push({ id: d.id, msg: `"${d.nome}" vence HOJE!`, tipo: "erro" });
        else if (dias <= 3) novos.push({ id: d.id, msg: `"${d.nome}" vence em ${dias} dia(s)`, tipo: "aviso" });
      }
    });
    setAlertas(novos);
  }, [dividas, loaded]);

  const pedirNotificacao = useCallback(async () => {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPerm(perm);
    if (perm === "granted") {
      dividas.forEach(d => {
        if (d.status === "pago") return;
        const dias = diasParaVencer(d.vencimento);
        if (dias !== null && dias <= 3 && dias >= 0) {
          new Notification("💸 Dívida vencendo!", {
            body: dias === 0
              ? `"${d.nome}" vence HOJE! — ${formatBRL(parseVal(d.valor))}`
              : `"${d.nome}" vence em ${dias} dia(s) — ${formatBRL(parseVal(d.valor))}`,
          });
        }
      });
    }
  }, [dividas]);

  const handleSubmit = () => {
    if (!form.nome || !form.valor) return;
    const entry = { ...form, id: editId ?? Date.now() };
    setDividas(d => editId !== null ? d.map(i => i.id === editId ? entry : i) : [...d, entry]);
    setEditId(null); setForm(emptyForm); setShowForm(false);
  };

  const handleEdit = (d) => { setForm({ ...d }); setEditId(d.id); setShowForm(true); };
  const handleDelete = (id) => setDividas(d => d.filter(i => i.id !== id));
  const handleStatusToggle = (id) => {
    setDividas(d => d.map(i => {
      if (i.id !== id) return i;
      const next = { pendente: "parcial", parcial: "pago", pago: "pendente" };
      return { ...i, status: next[i.status] };
    }));
  };

  const dividasFiltradas = filtro === "todos" ? dividas : dividas.filter(d => d.status === filtro);
  const totalPendente = dividas.filter(d => d.status !== "pago").reduce((a, d) => a + parseVal(d.valor), 0);
  const totalPago = dividas.filter(d => d.status === "pago").reduce((a, d) => a + parseVal(d.valor), 0);
  const total = dividas.reduce((a, d) => a + parseVal(d.valor), 0);

  const iSt = { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #252525", background: "#0C0C0C", color: "#F0F0F0", fontSize: 13, outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ maxWidth: 620, margin: "0 auto" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>💸 Minhas Dívidas</h1>
            <p style={{ color: "#555", fontSize: 12, margin: "3px 0 0" }}>Controle de dívidas e parcelamentos</p>
          </div>
          {notifPerm !== "granted" ? (
            <button onClick={pedirNotificacao} style={{ padding: "8px 14px", borderRadius: 10, border: "none", background: "#1E3A5F", color: "#60A5FA", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              🔔 Ativar alertas
            </button>
          ) : (
            <span style={{ fontSize: 12, color: "#10B981" }}>🔔 Alertas ativos</span>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
          {[
            { label: "Total", value: formatBRL(total), color: "#A0A0A0" },
            { label: "Em aberto", value: formatBRL(totalPendente), color: "#EF4444" },
            { label: "Pago", value: formatBRL(totalPago), color: "#10B981" },
          ].map(c => (
            <div key={c.label} style={{ background: "#161616", border: "1px solid #222", borderRadius: 12, padding: "10px 12px" }}>
              <div style={{ fontSize: 10, color: "#555", marginBottom: 3 }}>{c.label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: c.color }}>{c.value}</div>
            </div>
          ))}
        </div>

        {alertas.filter(a => a.tipo === "erro").length > 0 && (
          <div style={{ background: "#1A0A0A", border: "1px solid #4A1515", borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}>
            {alertas.filter(a => a.tipo === "erro").map(a => (
              <div key={a.id} style={{ fontSize: 13, color: "#FF7070", marginBottom: 2 }}>⚠️ {a.msg}</div>
            ))}
          </div>
        )}
        {alertas.filter(a => a.tipo === "aviso").length > 0 && (
          <div style={{ background: "#1A1400", border: "1px solid #4A3800", borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}>
            {alertas.filter(a => a.tipo === "aviso").map(a => (
              <div key={a.id} style={{ fontSize: 13, color: "#FCD34D" }}>⏰ {a.msg}</div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          {[["todos", "Todas"], ["pendente", "Pendente"], ["parcial", "Parcial"], ["pago", "Pago"]].map(([v, l]) => (
            <button key={v} onClick={() => setFiltro(v)} style={{
              padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
              background: filtro === v ? "#3B82F6" : "#1C1C1C", color: filtro === v ? "#fff" : "#666"
            }}>{l}{v !== "todos" ? ` (${dividas.filter(d => d.status === v).length})` : ""}</button>
          ))}
          <button onClick={() => { setForm(emptyForm); setEditId(null); setShowForm(true); }}
            style={{ marginLeft: "auto", padding: "6px 16px", borderRadius: 20, fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", background: "#3B82F6", color: "#fff" }}>
            + Nova
          </button>
        </div>

        {showForm && (
          <div style={{ background: "#161616", border: "1px solid #252525", borderRadius: 14, padding: 18, marginBottom: 18 }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700 }}>{editId ? "✏️ Editar" : "➕ Nova dívida"}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={{ display: "block", fontSize: 11, color: "#666", marginBottom: 4, fontWeight: 600 }}>Nome / Descrição</label>
                <input style={iSt} placeholder="ex: Cartão Nubank" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, color: "#666", marginBottom: 4, fontWeight: 600 }}>Valor (R$)</label>
                <input style={iSt} placeholder="0,00" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, color: "#666", marginBottom: 4, fontWeight: 600 }}>Vencimento</label>
                <input style={iSt} type="date" value={form.vencimento} onChange={e => setForm(f => ({ ...f, vencimento: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, color: "#666", marginBottom: 4, fontWeight: 600 }}>Categoria</label>
                <select style={iSt} value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                  {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, color: "#666", marginBottom: 4, fontWeight: 600 }}>Status</label>
                <select style={iSt} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={{ display: "block", fontSize: 11, color: "#666", marginBottom: 4, fontWeight: 600 }}>Observação</label>
                <input style={iSt} placeholder="ex: celular Samsung" value={form.obs} onChange={e => setForm(f => ({ ...f, obs: e.target.value }))} />
              </div>

              <div style={{ gridColumn: "1/-1", display: "flex", alignItems: "center", gap: 10, padding: "10px 0 4px", borderTop: "1px solid #1E1E1E" }}>
                <span style={{ fontSize: 13, color: "#888" }}>É parcelado?</span>
                <button onClick={() => setForm(f => ({ ...f, parcelado: !f.parcelado }))}
                  style={{ padding: "4px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
                    background: form.parcelado ? "#10B981" : "#222", color: form.parcelado ? "#fff" : "#666" }}>
                  {form.parcelado ? "✓ Sim" : "Não"}
                </button>
              </div>

              {form.parcelado && <>
                <div style={{ gridColumn: "1/-1" }}>
                  <label style={{ display: "block", fontSize: 11, color: "#666", marginBottom: 6, fontWeight: 600 }}>Modo de contagem</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[["manual", "Informo a parcela atual"], ["auto", "Calcular pela data de início"]].map(([v, l]) => (
                      <button key={v} onClick={() => setForm(f => ({ ...f, modoContagem: v }))}
                        style={{ flex: 1, padding: "7px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                          background: form.modoContagem === v ? "#3B82F6" : "#1C1C1C", color: form.modoContagem === v ? "#fff" : "#666" }}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: "#666", marginBottom: 4, fontWeight: 600 }}>Total de parcelas</label>
                  <input style={iSt} type="number" placeholder="12" value={form.totalParcelas} onChange={e => setForm(f => ({ ...f, totalParcelas: e.target.value }))} />
                </div>
                {form.modoContagem === "manual" ? (
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: "#666", marginBottom: 4, fontWeight: 600 }}>Parcela atual</label>
                    <input style={iSt} type="number" placeholder="3" value={form.parcelaAtualManual} onChange={e => setForm(f => ({ ...f, parcelaAtualManual: e.target.value }))} />
                  </div>
                ) : (
                  <div>
                    <label style={{ display: "block", fontSize: 11, color: "#666", marginBottom: 4, fontWeight: 600 }}>Data de início</label>
                    <input style={iSt} type="date" value={form.dataInicio} onChange={e => setForm(f => ({ ...f, dataInicio: e.target.value }))} />
                  </div>
                )}
              </>}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={handleSubmit} style={{ flex: 1, padding: 10, borderRadius: 10, border: "none", background: "#3B82F6", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                {editId ? "Salvar" : "Adicionar"}
              </button>
              <button onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm); }}
                style={{ padding: "10px 16px", borderRadius: 10, border: "none", background: "#1C1C1C", color: "#888", cursor: "pointer" }}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {dividasFiltradas.length === 0 ? (
          <div style={{ textAlign: "center", color: "#444", padding: "40px 0", fontSize: 14 }}>
            {filtro === "todos" ? "Nenhuma dívida cadastrada." : "Nenhuma dívida nesse filtro."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {dividasFiltradas.map(d => {
              const cfg = STATUS_CONFIG[d.status];
              const dias = diasParaVencer(d.vencimento);
              const vencida = d.status !== "pago" && dias !== null && dias < 0;
              const vencendoHoje = d.status !== "pago" && dias === 0;
              const vencendoLogo = d.status !== "pago" && dias !== null && dias > 0 && dias <= 3;

              const parcelaAtual = d.parcelado
                ? (d.modoContagem === "auto" ? calcParcelaAtual(d.dataInicio, d.totalParcelas) : parseInt(d.parcelaAtualManual))
                : null;
              const totalParc = d.parcelado ? parseInt(d.totalParcelas) : null;
              const progresso = parcelaAtual && totalParc ? (parcelaAtual / totalParc) * 100 : null;

              return (
                <div key={d.id} style={{
                  background: "#161616", borderRadius: 12, padding: "14px 16px",
                  border: `1px solid ${vencida || vencendoHoje ? "#4A1010" : "#222"}`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button onClick={() => handleStatusToggle(d.id)} title="Mudar status"
                      style={{ minWidth: 68, padding: "4px 0", borderRadius: 20, border: "none", cursor: "pointer",
                        background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 700 }}>
                      {cfg.label}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {d.nome}
                        {d.parcelado && parcelaAtual && totalParc && (
                          <span style={{ marginLeft: 8, fontSize: 11, color: "#3B82F6", fontWeight: 700 }}>{parcelaAtual}/{totalParc}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>
                        {d.categoria}
                        {d.vencimento && <> · {vencida ? "🔴" : vencendoHoje ? "🟠" : vencendoLogo ? "🟡" : "📅"} {new Date(d.vencimento + "T00:00:00").toLocaleDateString("pt-BR")}</>}
                        {d.obs && <> · {d.obs}</>}
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: d.status === "pago" ? "#10B981" : "#F0F0F0", whiteSpace: "nowrap" }}>
                      {formatBRL(parseVal(d.valor))}
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => handleEdit(d)} style={{ width: 28, height: 28, borderRadius: 8, border: "none", background: "#1C1C1C", cursor: "pointer", fontSize: 13 }}>✏️</button>
                      <button onClick={() => handleDelete(d.id)} style={{ width: 28, height: 28, borderRadius: 8, border: "none", background: "#1C1C1C", cursor: "pointer", fontSize: 13 }}>🗑️</button>
                    </div>
                  </div>

                  {d.parcelado && parcelaAtual && totalParc && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#555", marginBottom: 4 }}>
                        <span>Progresso das parcelas</span>
                        <span>{Math.round(progresso)}% — {totalParc - parcelaAtual} restante(s)</span>
                      </div>
                      <div style={{ height: 5, background: "#222", borderRadius: 10, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${progresso}%`, background: progresso >= 100 ? "#10B981" : "#3B82F6", borderRadius: 10 }} />
                      </div>
                      {parcelaAtual < totalParc && (
                        <div style={{ fontSize: 11, color: "#444", marginTop: 4 }}>
                          Ainda a pagar: {formatBRL(parseVal(d.valor) * (totalParc - parcelaAtual))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
  );
}

/* ============================ GASTOS DO DIA ============================ */

const GASTOS_KEY = "dividas-gastos-v1";
const CAT_GASTO = ["Alimentação", "Transporte", "Mercado", "Lazer", "Contas", "Saúde", "Outro"];
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const DIAS_SEM = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function GastosDiarios() {
  const hoje = new Date();
  const [gastos, setGastos] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [ref, setRef] = useState({ ano: hoje.getFullYear(), mes: hoje.getMonth() }); // mes: 0-11
  const [diaSel, setDiaSel] = useState(ymd(hoje));
  const [valor, setValor] = useState("");
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState(CAT_GASTO[0]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(GASTOS_KEY);
      if (raw) setGastos(JSON.parse(raw));
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(GASTOS_KEY, JSON.stringify(gastos));
    } catch {}
  }, [gastos, loaded]);

  const addGasto = () => {
    const v = parseVal(valor);
    if (!v || !diaSel) return;
    setGastos(g => [...g, { id: Date.now(), data: diaSel, valor, desc: desc.trim(), categoria: cat }]);
    setValor("");
    setDesc("");
  };

  const delGasto = (id) => setGastos(g => g.filter(x => x.id !== id));

  const mudaMes = (delta) => {
    setRef(r => {
      let m = r.mes + delta, a = r.ano;
      if (m < 0) { m = 11; a--; }
      if (m > 11) { m = 0; a++; }
      return { ano: a, mes: m };
    });
  };

  // Totais por dia + total do mês exibido
  const totalPorDia = {};
  gastos.forEach(x => { totalPorDia[x.data] = (totalPorDia[x.data] || 0) + parseVal(x.valor); });
  const prefixoMes = `${ref.ano}-${String(ref.mes + 1).padStart(2, "0")}`;
  const gastosDoMes = gastos.filter(x => x.data.startsWith(prefixoMes));
  const totalMes = gastosDoMes.reduce((a, x) => a + parseVal(x.valor), 0);
  const diasComGasto = new Set(gastosDoMes.map(x => x.data)).size;
  const mediaDia = diasComGasto ? totalMes / diasComGasto : 0;

  // Grade do calendário
  const primeiroDiaSemana = new Date(ref.ano, ref.mes, 1).getDay();
  const diasNoMes = new Date(ref.ano, ref.mes + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < primeiroDiaSemana; i++) cells.push(null);
  for (let d = 1; d <= diasNoMes; d++) cells.push(d);

  const hojeStr = ymd(hoje);
  const gastosDoDia = gastos.filter(x => x.data === diaSel).sort((a, b) => b.id - a.id);
  const totalDiaSel = gastosDoDia.reduce((a, x) => a + parseVal(x.valor), 0);

  const iSt = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #252525", background: "#0C0C0C", color: "#F0F0F0", fontSize: 14, outline: "none", boxSizing: "border-box" };
  const dataSelLabel = diaSel
    ? new Date(diaSel + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })
    : "";

  return (
    <div style={{ maxWidth: 620, margin: "0 auto" }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>🧾 Gastos do dia</h1>
        <p style={{ color: "#555", fontSize: 12, margin: "3px 0 0" }}>Anote o que gastou e veja o total do mês</p>
      </div>

      {/* Resumo do mês */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
        {[
          { label: `Total ${MESES[ref.mes]}`, value: formatBRL(totalMes), color: "#EF4444" },
          { label: "Média / dia", value: formatBRL(mediaDia), color: "#A0A0A0" },
          { label: "Dias com gasto", value: String(diasComGasto), color: "#60A5FA" },
        ].map(c => (
          <div key={c.label} style={{ background: "#161616", border: "1px solid #222", borderRadius: 12, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: "#555", marginBottom: 3 }}>{c.label}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Lançamento rápido */}
      <div style={{ background: "#161616", border: "1px solid #252525", borderRadius: 14, padding: 18, marginBottom: 18 }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700 }}>➕ Adicionar gasto</h3>
        <p style={{ margin: "0 0 14px", fontSize: 12, color: "#666", textTransform: "capitalize" }}>
          📅 {dataSelLabel} {diaSel === hojeStr && <span style={{ color: "#10B981" }}>(hoje)</span>}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, color: "#666", marginBottom: 4, fontWeight: 600 }}>Valor (R$)</label>
            <input style={iSt} placeholder="0,00" inputMode="decimal" value={valor}
              onChange={e => setValor(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addGasto(); }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, color: "#666", marginBottom: 4, fontWeight: 600 }}>Categoria</label>
            <select style={iSt} value={cat} onChange={e => setCat(e.target.value)}>
              {CAT_GASTO.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={{ display: "block", fontSize: 11, color: "#666", marginBottom: 4, fontWeight: 600 }}>Descrição (opcional)</label>
            <input style={iSt} placeholder="ex: almoço, uber, mercado" value={desc}
              onChange={e => setDesc(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addGasto(); }} />
          </div>
        </div>
        <button onClick={addGasto} style={{ width: "100%", marginTop: 14, padding: 11, borderRadius: 10, border: "none", background: "#3B82F6", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          Lançar gasto
        </button>
      </div>

      {/* Calendário */}
      <div style={{ background: "#161616", border: "1px solid #252525", borderRadius: 14, padding: 16, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <button onClick={() => mudaMes(-1)} style={{ width: 34, height: 34, borderRadius: 10, border: "none", background: "#1C1C1C", color: "#888", cursor: "pointer", fontSize: 16 }}>‹</button>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{MESES[ref.mes]} {ref.ano}</div>
          <button onClick={() => mudaMes(1)} style={{ width: 34, height: 34, borderRadius: 10, border: "none", background: "#1C1C1C", color: "#888", cursor: "pointer", fontSize: 16 }}>›</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 5 }}>
          {DIAS_SEM.map(d => (
            <div key={d} style={{ textAlign: "center", fontSize: 10, color: "#555", fontWeight: 600, paddingBottom: 4 }}>{d}</div>
          ))}
          {cells.map((d, i) => {
            if (d === null) return <div key={`e${i}`} />;
            const ds = ymd(new Date(ref.ano, ref.mes, d));
            const tot = totalPorDia[ds] || 0;
            const isHoje = ds === hojeStr;
            const isSel = ds === diaSel;
            return (
              <button key={ds} onClick={() => setDiaSel(ds)} style={{
                aspectRatio: "1", borderRadius: 9, cursor: "pointer", padding: 2,
                border: isSel ? "2px solid #3B82F6" : isHoje ? "1px solid #3B82F6" : "1px solid #1E1E1E",
                background: tot > 0 ? "#2A1212" : "#0F0F0F",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
              }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: isHoje ? "#60A5FA" : "#C0C0C0" }}>{d}</span>
                {tot > 0 && (
                  <span style={{ fontSize: 8.5, fontWeight: 700, color: "#FF7070", lineHeight: 1 }}>
                    {tot >= 1000 ? `${(tot / 1000).toFixed(1)}k` : Math.round(tot)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Detalhe do dia selecionado */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, textTransform: "capitalize" }}>{dataSelLabel}</h3>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#FF7070" }}>{formatBRL(totalDiaSel)}</span>
      </div>

      {gastosDoDia.length === 0 ? (
        <div style={{ textAlign: "center", color: "#444", padding: "30px 0", fontSize: 14 }}>
          Nenhum gasto nesse dia.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {gastosDoDia.map(g => (
            <div key={g.id} style={{ background: "#161616", borderRadius: 12, padding: "12px 14px", border: "1px solid #222", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{g.desc || g.categoria}</div>
                {g.desc && <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{g.categoria}</div>}
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#F0F0F0", whiteSpace: "nowrap" }}>{formatBRL(parseVal(g.valor))}</div>
              <button onClick={() => delGasto(g.id)} style={{ width: 28, height: 28, borderRadius: 8, border: "none", background: "#1C1C1C", cursor: "pointer", fontSize: 13 }}>🗑️</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================ APP (abas) ============================ */

export default function App() {
  const [aba, setAba] = useState("dividas");

  const tabBtn = (id, label) => (
    <button key={id} onClick={() => setAba(id)} style={{
      flex: 1, padding: "10px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700,
      background: aba === id ? "#3B82F6" : "#161616", color: aba === id ? "#fff" : "#777",
    }}>{label}</button>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0C0C0C", color: "#F0F0F0", fontFamily: "'Inter',sans-serif", padding: "20px 16px 60px" }}>
      <div style={{ maxWidth: 620, margin: "0 auto 18px", display: "flex", gap: 8 }}>
        {tabBtn("dividas", "💸 Dívidas")}
        {tabBtn("gastos", "🧾 Gastos do dia")}
      </div>
      {aba === "dividas" ? <Dividas /> : <GastosDiarios />}
    </div>
  );
}
