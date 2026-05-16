# 🍞 ReceitaPro — App de Receitas para Indústria de Alimentos

App PWA (funciona como app no celular) para consulta e cálculo de receitas.

---

## ✅ O que o app faz

- Funcionários consultam receitas e informam o **peso final desejado** → o app recalcula todos os ingredientes automaticamente
- Admin (você) pode **cadastrar, editar e excluir** receitas com senha
- Funciona no celular — pode ser **instalado na tela inicial** como um app
- Receitas salvas em nuvem via **Supabase** (todos veem a mesma coisa em tempo real)

---

## 🚀 Como publicar (passo a passo)

### PARTE 1 — Banco de dados (Supabase)

1. Acesse [supabase.com](https://supabase.com) e crie uma conta gratuita
2. Clique em **"New Project"**, escolha um nome (ex: `receitas-industria`)
3. Após criar, vá em **SQL Editor** e execute o seguinte SQL:

```sql
-- Tabela de receitas
create table recipes (
  id bigint generated always as identity primary key,
  name text not null,
  category text default 'Outros',
  base_weight numeric not null,
  unit text default 'g',
  created_at timestamptz default now()
);

-- Tabela de ingredientes
create table ingredients (
  id bigint generated always as identity primary key,
  recipe_id bigint references recipes(id) on delete cascade,
  name text not null,
  amount numeric not null,
  unit text default 'g'
);

-- Permitir leitura pública (funcionários)
alter table recipes enable row level security;
alter table ingredients enable row level security;

create policy "Leitura pública" on recipes for select using (true);
create policy "Leitura pública" on ingredients for select using (true);
create policy "Escrita autenticada" on recipes for all using (true);
create policy "Escrita autenticada" on ingredients for all using (true);
```

4. Vá em **Settings → API** e copie:
   - **Project URL** (começa com `https://`)
   - **anon public key** (chave longa)

---

### PARTE 2 — Publicar o app (Vercel)

1. Acesse [vercel.com](https://vercel.com) e crie uma conta gratuita (pode usar o Google)
2. Clique em **"Add New Project"** → **"Import Git Repository"**
   - Se não tiver o código no GitHub ainda, use a opção **"Deploy from template"** → escolha Vite + React
   - Substitua o código pelo deste projeto
3. Antes de publicar, configure as **variáveis de ambiente** (clique em "Environment Variables"):

| Nome | Valor |
|------|-------|
| `VITE_SUPABASE_URL` | sua URL do Supabase |
| `VITE_SUPABASE_ANON_KEY` | sua chave anon do Supabase |
| `VITE_ADMIN_PASSWORD` | a senha que você quiser para o admin |

4. Clique em **Deploy** — em 2 minutos seu app estará no ar!
5. Você receberá um link tipo: `https://receitas-industria.vercel.app`

---

### PARTE 3 — Instalar no celular dos funcionários

**Android (Chrome):**
1. Abra o link no Chrome
2. Toque no menu (⋮) → **"Adicionar à tela inicial"**
3. Confirme — o app aparecerá como ícone na tela inicial

**iPhone (Safari):**
1. Abra o link no Safari
2. Toque no botão de compartilhar (□↑) → **"Adicionar à Tela de Início"**
3. Confirme

---

## 🔑 Como usar como Admin

1. No app, toque no ícone de cadeado 🔒 no canto superior direito
2. Digite a senha configurada em `VITE_ADMIN_PASSWORD`
3. Agora você pode adicionar, editar e excluir receitas
4. Para sair do modo admin, toque no cadeado novamente 🔓

---

## 📁 Estrutura do projeto

```
receitas-pwa/
├── src/
│   ├── App.jsx          ← código principal do app
│   └── main.jsx         ← entrada da aplicação
├── public/
│   ├── manifest.json    ← configuração PWA
│   └── sw.js            ← service worker (offline)
├── index.html
├── vite.config.js
└── package.json
```

---

## 🛠️ Rodar localmente (opcional)

```bash
npm install
npm run dev
```

Abra `http://localhost:5173` no navegador.

---

## ❓ Precisa de ajuda?

Peça ao Claude para ajudar com qualquer etapa! Cole o erro que aparecer e ele resolve.
