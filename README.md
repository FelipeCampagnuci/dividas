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

## Deploy na VM (Nginx — http://10.100.12.23/dividas)

O app é estático e roda **na mesma VM do meet-monitor**, servido pelo Nginx
num subpath `/dividas`. O fluxo é via Git (igual ao meet-monitor): clona o
repo na VM, builda e publica o `dist/` no diretório do Nginx.

### 1. Primeira vez — clonar na VM

```bash
cd ~
git clone https://github.com/FelipeCampagnuci/dividas.git
cd dividas
```

> Precisa de Node (>=18) na VM — a mesma que builda o meet-monitor já tem.

### 2. Adicionar o location no Nginx

Edite o `server { }` que já existe na VM (o que serve o meet-monitor) e cole
o conteúdo de [`deploy/nginx-dividas.conf`](deploy/nginx-dividas.conf) dentro
dele. Depois:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### 3. Buildar e publicar

```bash
./atualizar.sh
```

O `atualizar.sh` faz `git pull` + `npm install` + `npm run build` e copia o
`dist/` pra `/var/www/dividas`, recarregando o Nginx no fim.

Pronto — acesse **http://10.100.12.23/dividas**.

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
atualizar.sh            # deploy na VM: git pull + build + publica no Nginx
deploy/nginx-*.conf     # location /dividas pro Nginx da VM
```
