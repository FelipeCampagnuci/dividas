#!/bin/bash
# Atualiza o dividas na VM (igual ao atualizar.sh do meet-monitor).
# git pull -> npm install -> build -> (re)start no PM2 na porta 3200.
# Caminho fixo do projeto; pra usar outro:  DIVIDAS_DIR=/caminho ./atualizar.sh
set -euo pipefail

PROJ_DIR="${DIVIDAS_DIR:-$HOME/dividas}"

echo "--- Iniciando atualização do projeto Dividas ---"

if [ ! -d "$PROJ_DIR/.git" ]; then
  echo "ERRO: não achei o projeto em $PROJ_DIR"
  echo "      (clone lá ou rode com DIVIDAS_DIR=/seu/caminho ./atualizar.sh)"
  exit 1
fi
cd "$PROJ_DIR"

echo "Efetuando git pull..."
git pull

echo "Instalando dependências..."
npm install --include=dev

echo "Buildando..."
npm run build

echo "(Re)iniciando no pm2..."
if pm2 describe dividas > /dev/null 2>&1; then
  pm2 restart dividas --update-env
else
  pm2 start npm --name dividas -- start
fi
pm2 save

echo "--- Dividas atualizado e no ar (porta 3200) ---"
pm2 status dividas || true
