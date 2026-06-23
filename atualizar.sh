#!/bin/bash
# Atualiza o dividas na VM (estilo do atualizar.sh do meet-monitor).
# git pull -> build (Vite) -> publica dist/ no diretório do Nginx.
# Caminho fixo do projeto; pra usar outro:  DIVIDAS_DIR=/caminho ./atualizar.sh
set -euo pipefail

PROJ_DIR="${DIVIDAS_DIR:-$HOME/dividas}"
WEB_DIR="${DIVIDAS_WEB_DIR:-/var/www/dividas}"

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

echo "Publicando em $WEB_DIR ..."
sudo mkdir -p "$WEB_DIR"
sudo rm -rf "${WEB_DIR:?}/"*
sudo cp -r dist/* "$WEB_DIR"/
sudo chown -R www-data:www-data "$WEB_DIR"

echo "Recarregando Nginx..."
sudo nginx -t && sudo systemctl reload nginx

echo "--- Dividas atualizado e no ar em http://10.100.12.23/dividas ---"
