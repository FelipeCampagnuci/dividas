# 💸 Minhas Dívidas

App de controle de dívidas e parcelamentos (React + Vite). Os dados ficam
salvos no **`localStorage` do navegador** — não há backend nem banco. Cada
navegador/dispositivo guarda suas próprias dívidas.

## Rodar localmente

```bash
npm install
npm run dev      # http://localhost:5173
```

## Gerar o build de produção

```bash
npm run build    # gera a pasta dist/
npm run preview  # (opcional) testa o build em http://localhost:4173
```

## Deploy na VM (PM2 — http://10.100.12.23:3200)

Roda **na mesma VM do meet-monitor e do mesmo jeito**: PM2 executando um
servidor Node (`server.mjs`) que serve o build do Vite numa porta dedicada
(**3200**). O fluxo é via Git: clona o repo, builda e o PM2 mantém no ar.

### 1. Primeira vez — clonar na VM

```bash
cd ~
git clone https://github.com/FelipeCampagnuci/dividas.git
cd dividas
```

> Precisa de Node (>=18) na VM — a mesma que roda o meet-monitor já tem.

### 2. Buildar e subir no PM2

```bash
./atualizar.sh
```

O `atualizar.sh` faz `git pull` + `npm install` + `npm run build` e
`pm2 start npm --name dividas -- start` (ou `pm2 restart` se já existir).
O `npm start` roda `node server.mjs`, que serve o `dist/` na porta 3200.

Pronto — acesse **http://10.100.12.23:3200**.

> Pra trocar a porta:  `PORT=3300 pm2 restart dividas --update-env`

## Atualizar depois de mudar o código

Faça o push das mudanças e, na VM:

```bash
cd ~/dividas && ./atualizar.sh
```

> Os assets têm hash no nome (`index-xxxx.js`), então o navegador sempre
> carrega a versão nova sem precisar limpar cache.

## Estrutura

```
index.html              # entrada do Vite
src/main.jsx            # bootstrap do React
src/App.jsx             # o app inteiro (estado em localStorage)
server.mjs              # servidor estático (Node, sem deps) que o PM2 roda
atualizar.sh            # deploy na VM: git pull + build + pm2 restart
```
