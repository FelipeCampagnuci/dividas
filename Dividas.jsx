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

export default function App() {
  const [dividas, setDividas] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [filtro, setFiltro] = useState("todos");
  const [loaded, setLoaded] = useState(false);
  const [notifPerm, setNotifPerm] = useState("default");
  const [alertas, setAlertas] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await window.storage.get(STORAGE_KEY);
        if (r?.value) setDividas(JSON.parse(r.value));
      } catch {}
      setLoaded(true);
    };
    load();
    if ("Notification" in window) setNotifPerm(Notification.permission);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    window.storage.set(STORAGE_KEY, JSON.stringify(dividas)).catch(() => {});
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
    <div style={{ minHeight: "100vh", background: "#0C0C0C", color: "#F0F0F0", fontFamily: "'Inter',sans-serif", padding: "20px 16px 60px" }}>
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
    </div>
  );
}
