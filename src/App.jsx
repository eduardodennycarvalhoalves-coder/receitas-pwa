import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── CONFIGURAÇÃO SUPABASE ───────────────────────────────────────────────────
// Substitua pelos seus valores do Supabase (veja o README)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || "admin123";

const supabase = SUPABASE_URL ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// ─── RECEITAS DE EXEMPLO (usadas quando Supabase não está configurado) ────────
const DEMO_RECIPES = [
  {
    id: 1,
    name: "Bolo de Chocolate",
    category: "Confeitaria",
    base_weight: 1000,
    unit: "g",
    ingredients: [
      { id: 1, name: "Farinha de trigo", amount: 300, unit: "g" },
      { id: 2, name: "Açúcar", amount: 250, unit: "g" },
      { id: 3, name: "Cacau em pó", amount: 80, unit: "g" },
      { id: 4, name: "Ovos", amount: 120, unit: "g" },
      { id: 5, name: "Óleo vegetal", amount: 100, unit: "ml" },
      { id: 6, name: "Leite", amount: 150, unit: "ml" },
    ],
  },
  {
    id: 2,
    name: "Pão Francês",
    category: "Panificação",
    base_weight: 2000,
    unit: "g",
    ingredients: [
      { id: 1, name: "Farinha de trigo", amount: 1000, unit: "g" },
      { id: 2, name: "Água", amount: 600, unit: "ml" },
      { id: 3, name: "Fermento biológico", amount: 20, unit: "g" },
      { id: 4, name: "Sal", amount: 18, unit: "g" },
      { id: 5, name: "Açúcar", amount: 10, unit: "g" },
      { id: 6, name: "Gordura vegetal", amount: 30, unit: "g" },
    ],
  },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function fmt(value, unit) {
  if (value < 0.1) return `${(value * 1000).toFixed(0)} m${unit}`;
  if (value >= 1000) return `${(value / 1000).toFixed(2).replace(/\.?0+$/, "")} ${unit === "g" ? "kg" : "L"}`;
  if (!Number.isInteger(value)) return `${value.toFixed(1)} ${unit}`;
  return `${value} ${unit}`;
}

const CATEGORIES = ["Confeitaria", "Panificação", "Conservas", "Laticínios", "Bebidas", "Outros"];
const UNITS = ["g", "kg", "ml", "L", "un"];

// ─── ICONS ────────────────────────────────────────────────────────────────────
const Icon = {
  back: "←",
  search: "🔍",
  add: "+",
  edit: "✏️",
  delete: "🗑️",
  copy: "📋",
  check: "✓",
  lock: "🔒",
  unlock: "🔓",
  bread: "🍞",
};

// ═════════════════════════════════════════════════════════════════════════════
// APP
// ═════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [recipes, setRecipes] = useState(DEMO_RECIPES);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [view, setView] = useState("list"); // list | detail | admin-login | add | edit
  const [selected, setSelected] = useState(null);
  const [targetWeight, setTargetWeight] = useState("");
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("Todas");
  const [adminPass, setAdminPass] = useState("");
  const [passError, setPassError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);

  // ── Carregar receitas ──────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      if (!supabase) { setLoading(false); return; }
      const { data, error } = await supabase
        .from("recipes")
        .select("*, ingredients(*)")
        .order("name");
      if (!error && data?.length) setRecipes(data);
      setLoading(false);
    }
    load();
  }, []);

  // ── Realtime updates ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!supabase) return;
    const ch = supabase.channel("recipes").on(
      "postgres_changes",
      { event: "*", schema: "public", table: "recipes" },
      () => { /* reload */ }
    ).subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  // ── Filtros ────────────────────────────────────────────────────────────────
  const displayed = recipes.filter((r) => {
    const matchCat = filterCat === "Todas" || r.category === filterCat;
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const allCats = ["Todas", ...new Set(recipes.map((r) => r.category))];

  // ── Admin login ────────────────────────────────────────────────────────────
  function handleAdminLogin() {
    if (adminPass === ADMIN_PASSWORD) {
      setIsAdmin(true);
      setView("list");
      setAdminPass("");
      setPassError(false);
    } else {
      setPassError(true);
    }
  }

  // ── Selecionar receita ─────────────────────────────────────────────────────
  function openRecipe(r) {
    setSelected(r);
    setTargetWeight(String(r.base_weight));
    setView("detail");
  }

  // ── Copiar receita ─────────────────────────────────────────────────────────
  function copyRecipe() {
    if (!selected) return;
    const sf = parseFloat(targetWeight) / selected.base_weight;
    const lines = [
      `📋 ${selected.name}`,
      `Peso final: ${targetWeight} ${selected.unit}  |  Fator: ${sf.toFixed(3)}×`,
      "",
      ...selected.ingredients.map((i) => `• ${i.name}: ${fmt(i.amount * sf, i.unit)}`),
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Salvar receita ─────────────────────────────────────────────────────────
  async function saveRecipe() {
    if (!form?.name || !form?.base_weight) return;
    setSaving(true);
    const ings = form.ingredients.filter((i) => i.name && i.amount);

    if (supabase) {
      if (form.id) {
        await supabase.from("recipes").update({
          name: form.name, category: form.category,
          base_weight: parseFloat(form.base_weight), unit: form.unit,
        }).eq("id", form.id);
        await supabase.from("ingredients").delete().eq("recipe_id", form.id);
        await supabase.from("ingredients").insert(
          ings.map((i) => ({ recipe_id: form.id, name: i.name, amount: parseFloat(i.amount), unit: i.unit }))
        );
        setRecipes((prev) => prev.map((r) => r.id === form.id
          ? { ...r, ...form, base_weight: parseFloat(form.base_weight), ingredients: ings.map((i, idx) => ({ ...i, id: idx, amount: parseFloat(i.amount) })) }
          : r));
      } else {
        const { data } = await supabase.from("recipes").insert({
          name: form.name, category: form.category,
          base_weight: parseFloat(form.base_weight), unit: form.unit,
        }).select().single();
        if (data) {
          await supabase.from("ingredients").insert(
            ings.map((i) => ({ recipe_id: data.id, name: i.name, amount: parseFloat(i.amount), unit: i.unit }))
          );
          setRecipes((prev) => [...prev, { ...data, ingredients: ings.map((i, idx) => ({ ...i, id: idx, amount: parseFloat(i.amount) })) }]);
        }
      }
    } else {
      // modo demo
      const newR = {
        ...form,
        id: form.id || Date.now(),
        base_weight: parseFloat(form.base_weight),
        ingredients: ings.map((i, idx) => ({ ...i, id: idx, amount: parseFloat(i.amount) })),
      };
      setRecipes((prev) => form.id ? prev.map((r) => r.id === form.id ? newR : r) : [...prev, newR]);
    }
    setSaving(false);
    setView("list");
  }

  // ── Deletar receita ────────────────────────────────────────────────────────
  async function deleteRecipe(id) {
    if (!confirm("Excluir esta receita?")) return;
    if (supabase) await supabase.from("recipes").delete().eq("id", id);
    setRecipes((prev) => prev.filter((r) => r.id !== id));
    setView("list");
  }

  // ── Abrir form ─────────────────────────────────────────────────────────────
  function openForm(recipe = null) {
    setForm(recipe
      ? { ...recipe, ingredients: recipe.ingredients.map((i) => ({ ...i })) }
      : { name: "", category: "Confeitaria", base_weight: "", unit: "g", ingredients: [{ id: Date.now(), name: "", amount: "", unit: "g" }] }
    );
    setView(recipe ? "edit" : "add");
  }

  const scaleFactor = selected && targetWeight
    ? parseFloat(targetWeight) / selected.base_weight
    : 1;

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div style={styles.root}>
      <Header isAdmin={isAdmin} view={view}
        onAdminClick={() => isAdmin ? setIsAdmin(false) : setView("admin-login")}
        onBack={() => setView("list")}
        onAdd={() => openForm()}
        showBack={view !== "list"}
        showAdd={isAdmin && view === "list"}
      />

      <main style={styles.main}>
        {/* ── ADMIN LOGIN ── */}
        {view === "admin-login" && (
          <div style={styles.card}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🔒</div>
              <h2 style={styles.h2}>Área do Administrador</h2>
              <p style={{ color: "#888", fontSize: 14, margin: 0 }}>Digite a senha para continuar</p>
            </div>
            <input
              type="password"
              placeholder="Senha"
              value={adminPass}
              onChange={(e) => { setAdminPass(e.target.value); setPassError(false); }}
              onKeyDown={(e) => e.key === "Enter" && handleAdminLogin()}
              style={{ ...styles.input, borderColor: passError ? "#e53e3e" : "#e0d8cc", marginBottom: 8 }}
              autoFocus
            />
            {passError && <p style={{ color: "#e53e3e", fontSize: 13, margin: "0 0 12px" }}>Senha incorreta</p>}
            <button onClick={handleAdminLogin} style={styles.btnPrimary}>Entrar</button>
          </div>
        )}

        {/* ── LIST ── */}
        {view === "list" && (
          <>
            {!SUPABASE_URL && (
              <div style={styles.banner}>
                ⚠️ Modo demonstração — conecte o Supabase para salvar receitas permanentemente. Veja o README.
              </div>
            )}
            <div style={styles.searchBar}>
              <span style={{ fontSize: 16, opacity: 0.5 }}>🔍</span>
              <input
                placeholder="Buscar receita..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={styles.searchInput}
              />
            </div>
            <div style={styles.chips}>
              {allCats.map((c) => (
                <button key={c} onClick={() => setFilterCat(c)}
                  style={{ ...styles.chip, ...(filterCat === c ? styles.chipActive : {}) }}>
                  {c}
                </button>
              ))}
            </div>
            {loading ? (
              <div style={styles.empty}>Carregando receitas...</div>
            ) : displayed.length === 0 ? (
              <div style={styles.empty}>Nenhuma receita encontrada.</div>
            ) : (
              <div style={styles.list}>
                {displayed.map((r) => (
                  <RecipeCard key={r.id} recipe={r} isAdmin={isAdmin}
                    onOpen={() => openRecipe(r)}
                    onEdit={() => openForm(r)}
                    onDelete={() => deleteRecipe(r.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── DETAIL ── */}
        {view === "detail" && selected && (
          <div style={styles.card}>
            <div style={styles.detailHeader}>
              <div>
                <h2 style={{ ...styles.h2, marginBottom: 2 }}>{selected.name}</h2>
                <span style={styles.badge}>{selected.category}</span>
              </div>
              {isAdmin && (
                <button onClick={() => openForm(selected)} style={styles.btnIcon}>✏️</button>
              )}
            </div>

            {/* Calculadora */}
            <div style={styles.calcBox}>
              <label style={styles.calcLabel}>Peso final desejado ({selected.unit})</label>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <input
                  type="number"
                  inputMode="decimal"
                  value={targetWeight}
                  onChange={(e) => setTargetWeight(e.target.value)}
                  style={styles.calcInput}
                />
                <div>
                  <div style={{ fontSize: 11, color: "#a89070", marginBottom: 2 }}>Fator</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: scaleFactor !== 1 ? "#c8872a" : "#2d1f0e" }}>
                    {scaleFactor.toFixed(3)}×
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#b0a090", marginTop: 6 }}>
                Receita base: {selected.base_weight} {selected.unit}
              </div>
            </div>

            {/* Ingredientes */}
            <div style={styles.ingList}>
              {selected.ingredients.map((ing, i) => {
                const scaled = ing.amount * scaleFactor;
                return (
                  <div key={ing.id} style={{ ...styles.ingRow, background: i % 2 === 0 ? "#faf6f0" : "#fff" }}>
                    <span style={styles.ingName}>{ing.name}</span>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ ...styles.ingAmt, color: scaleFactor !== 1 ? "#c8872a" : "#2d1f0e" }}>
                        {fmt(scaled, ing.unit)}
                      </span>
                      {scaleFactor !== 1 && (
                        <div style={styles.ingBase}>base: {fmt(ing.amount, ing.unit)}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <button onClick={copyRecipe} style={{ ...styles.btnSecondary, marginTop: 16 }}>
              {copied ? "✓ Copiado!" : "📋 Copiar receita ajustada"}
            </button>
          </div>
        )}

        {/* ── ADD / EDIT ── */}
        {(view === "add" || view === "edit") && form && (
          <RecipeForm
            form={form}
            setForm={setForm}
            onSave={saveRecipe}
            saving={saving}
            categories={CATEGORIES}
            units={UNITS}
          />
        )}
      </main>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═════════════════════════════════════════════════════════════════════════════
function Header({ isAdmin, view, onAdminClick, onBack, onAdd, showBack, showAdd }) {
  return (
    <header style={styles.header}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {showBack ? (
          <button onClick={onBack} style={styles.btnHeader}>{Icon.back}</button>
        ) : (
          <span style={{ fontSize: 24 }}>{Icon.bread}</span>
        )}
        <div>
          <div style={styles.headerTitle}>ReceitaPro</div>
          <div style={styles.headerSub}>Indústria de Alimentos</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {showAdd && (
          <button onClick={onAdd} style={styles.btnHeaderAdd}>+ Nova</button>
        )}
        <button onClick={onAdminClick} title={isAdmin ? "Sair do modo admin" : "Modo admin"}
          style={{ ...styles.btnHeader, background: isAdmin ? "#c8872a22" : "transparent", color: isAdmin ? "#c8872a" : "#f7f0e6" }}>
          {isAdmin ? Icon.unlock : Icon.lock}
        </button>
      </div>
    </header>
  );
}

function RecipeCard({ recipe, isAdmin, onOpen, onEdit, onDelete }) {
  return (
    <div style={styles.recipeCard}>
      <div onClick={onOpen} style={{ flex: 1, cursor: "pointer", padding: "16px 14px" }}>
        <div style={styles.cardName}>{recipe.name}</div>
        <div style={styles.cardMeta}>
          {recipe.category} · {recipe.ingredients?.length ?? 0} ingredientes
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
        <div onClick={onOpen} style={{ ...styles.cardWeight, cursor: "pointer" }}>
          <span style={{ fontWeight: 800 }}>{recipe.base_weight}</span>
          <span style={{ fontSize: 11 }}>{recipe.unit}</span>
        </div>
        {isAdmin && (
          <div style={{ display: "flex", flexDirection: "column", borderLeft: "1px solid #f0e8dc" }}>
            <button onClick={onEdit} style={styles.cardBtn} title="Editar">✏️</button>
            <button onClick={onDelete} style={{ ...styles.cardBtn, color: "#e53e3e" }} title="Excluir">🗑️</button>
          </div>
        )}
      </div>
    </div>
  );
}

function RecipeForm({ form, setForm, onSave, saving, categories, units }) {
  function updateIng(id, field, value) {
    setForm((f) => ({ ...f, ingredients: f.ingredients.map((i) => i.id === id ? { ...i, [field]: value } : i) }));
  }
  function addIng() {
    setForm((f) => ({ ...f, ingredients: [...f.ingredients, { id: Date.now(), name: "", amount: "", unit: "g" }] }));
  }
  function removeIng(id) {
    setForm((f) => ({ ...f, ingredients: f.ingredients.filter((i) => i.id !== id) }));
  }
  const valid = form.name && form.base_weight;

  return (
    <div style={styles.card}>
      <h2 style={styles.h2}>{form.id ? "Editar Receita" : "Nova Receita"}</h2>

      <label style={styles.label}>Nome</label>
      <input style={styles.input} value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        placeholder="Ex: Biscoito amanteigado" />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div>
          <label style={styles.label}>Categoria</label>
          <select style={styles.input} value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
            {categories.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={styles.label}>Peso base</label>
          <div style={{ display: "flex", gap: 6 }}>
            <input style={{ ...styles.input, flex: 2, margin: 0 }} type="number"
              value={form.base_weight} placeholder="1000"
              onChange={(e) => setForm((f) => ({ ...f, base_weight: e.target.value }))} />
            <select style={{ ...styles.input, flex: 1, margin: 0 }} value={form.unit}
              onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}>
              {units.map((u) => <option key={u}>{u}</option>)}
            </select>
          </div>
        </div>
      </div>

      <label style={styles.label}>Ingredientes</label>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
        {form.ingredients.map((ing, idx) => (
          <div key={ing.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input style={{ ...styles.input, flex: 3, margin: 0 }}
              placeholder={`Ingrediente ${idx + 1}`} value={ing.name}
              onChange={(e) => updateIng(ing.id, "name", e.target.value)} />
            <input style={{ ...styles.input, flex: 1, margin: 0, minWidth: 55 }}
              type="number" placeholder="Qtd" value={ing.amount}
              onChange={(e) => updateIng(ing.id, "amount", e.target.value)} />
            <select style={{ ...styles.input, flex: 1, margin: 0 }} value={ing.unit}
              onChange={(e) => updateIng(ing.id, "unit", e.target.value)}>
              {units.map((u) => <option key={u}>{u}</option>)}
            </select>
            {form.ingredients.length > 1 && (
              <button onClick={() => removeIng(ing.id)}
                style={{ background: "#fde8e8", border: "none", borderRadius: 6, width: 32, height: 40, cursor: "pointer", fontSize: 15, color: "#c53030", flexShrink: 0 }}>×</button>
            )}
          </div>
        ))}
      </div>
      <button onClick={addIng} style={styles.btnDashed}>+ Adicionar ingrediente</button>

      <button onClick={onSave} disabled={!valid || saving}
        style={{ ...styles.btnPrimary, opacity: valid ? 1 : 0.5, marginTop: 8 }}>
        {saving ? "Salvando..." : form.id ? "Salvar alterações" : "Criar receita"}
      </button>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// STYLES
// ═════════════════════════════════════════════════════════════════════════════
const styles = {
  root: { minHeight: "100vh", background: "#f5efe6", fontFamily: "'Georgia', 'Times New Roman', serif", color: "#2d1f0e" },
  header: { background: "#2d1f0e", color: "#f7f0e6", padding: "0 16px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50, boxShadow: "0 2px 8px #0004" },
  headerTitle: { fontWeight: 700, fontSize: 17, letterSpacing: 0.5 },
  headerSub: { fontSize: 10, opacity: 0.5, letterSpacing: 2, textTransform: "uppercase" },
  btnHeader: { background: "transparent", border: "none", color: "#f7f0e6", fontSize: 18, cursor: "pointer", padding: "6px 10px", borderRadius: 8 },
  btnHeaderAdd: { background: "#c8872a", border: "none", color: "#fff", fontWeight: 700, fontSize: 13, padding: "6px 14px", borderRadius: 8, cursor: "pointer" },
  main: { maxWidth: 540, margin: "0 auto", padding: "16px 14px 40px" },
  banner: { background: "#fff8e1", border: "1px solid #ffe082", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#7a5c1e", marginBottom: 14 },
  searchBar: { display: "flex", alignItems: "center", gap: 8, background: "#fff", borderRadius: 12, padding: "10px 14px", marginBottom: 12, boxShadow: "0 1px 4px #0001" },
  searchInput: { border: "none", outline: "none", fontSize: 15, fontFamily: "Georgia, serif", color: "#2d1f0e", width: "100%", background: "transparent" },
  chips: { display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" },
  chip: { background: "#fff", border: "2px solid #d4bfa0", borderRadius: 20, padding: "5px 14px", fontSize: 12, cursor: "pointer", fontFamily: "Georgia, serif", color: "#6b4e2a", transition: "all 0.1s" },
  chipActive: { background: "#2d1f0e", border: "2px solid #2d1f0e", color: "#f7f0e6", fontWeight: 700 },
  list: { display: "flex", flexDirection: "column", gap: 10 },
  recipeCard: { background: "#fff", borderRadius: 12, display: "flex", alignItems: "stretch", boxShadow: "0 1px 6px #0001", overflow: "hidden", border: "1.5px solid #ede4d8" },
  cardName: { fontWeight: 700, fontSize: 16, marginBottom: 3 },
  cardMeta: { fontSize: 11, color: "#a08060", letterSpacing: 1, textTransform: "uppercase" },
  cardWeight: { background: "#faf0e0", padding: "0 14px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, color: "#8a5c20", minWidth: 56 },
  cardBtn: { background: "none", border: "none", cursor: "pointer", fontSize: 15, padding: "8px 10px", lineHeight: 1 },
  card: { background: "#fff", borderRadius: 14, padding: "20px 18px", boxShadow: "0 2px 10px #0001", border: "1.5px solid #ede4d8" },
  h2: { fontSize: 20, fontWeight: 700, margin: "0 0 16px" },
  detailHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  badge: { background: "#faf0e0", color: "#8a5c20", borderRadius: 6, padding: "2px 10px", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700 },
  calcBox: { background: "#fffbf2", border: "2px solid #c8872a", borderRadius: 12, padding: "14px 16px", marginBottom: 18 },
  calcLabel: { display: "block", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#9a6820", fontWeight: 700, marginBottom: 8 },
  calcInput: { border: "2px solid #c8872a", borderRadius: 8, padding: "10px 12px", fontSize: 24, fontWeight: 800, width: 130, fontFamily: "Georgia, serif", color: "#2d1f0e", background: "#fff", outline: "none" },
  ingList: { display: "flex", flexDirection: "column", borderRadius: 10, overflow: "hidden", border: "1px solid #ede4d8" },
  ingRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 14px" },
  ingName: { fontSize: 15, color: "#2d1f0e" },
  ingAmt: { fontWeight: 800, fontSize: 16 },
  ingBase: { fontSize: 11, color: "#c0a880", textAlign: "right" },
  label: { display: "block", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#a08060", fontWeight: 700, marginBottom: 5 },
  input: { width: "100%", boxSizing: "border-box", border: "2px solid #e0d8cc", borderRadius: 8, padding: "10px 12px", fontSize: 15, fontFamily: "Georgia, serif", color: "#2d1f0e", background: "#faf6f0", outline: "none", marginBottom: 14 },
  btnPrimary: { width: "100%", background: "#2d1f0e", color: "#f7f0e6", border: "none", borderRadius: 10, padding: 14, fontSize: 16, fontWeight: 700, cursor: "pointer", letterSpacing: 0.5, fontFamily: "Georgia, serif" },
  btnSecondary: { width: "100%", background: "#faf0e0", color: "#6b4e2a", border: "2px solid #d4bfa0", borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "Georgia, serif" },
  btnDashed: { width: "100%", background: "none", border: "2px dashed #c8872a", borderRadius: 8, padding: "10px", fontSize: 13, fontWeight: 700, color: "#9a6820", cursor: "pointer", marginBottom: 16, fontFamily: "Georgia, serif" },
  btnIcon: { background: "#faf0e0", border: "none", borderRadius: 8, width: 38, height: 38, cursor: "pointer", fontSize: 16 },
  empty: { textAlign: "center", color: "#b0a080", padding: "48px 20px", fontSize: 15 },
};
