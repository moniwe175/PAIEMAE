# Dockerfile — marketing_engine
# Imagem enxuta, só Python + dependências. O scheduler roda em loop dentro
# do container (ver main.py), então este serviço deve ser configurado no
# Railway como um serviço comum (sem precisar de domínio público).
FROM python:3.12-slim

WORKDIR /app

# Dependências do sistema mínimas (nenhuma lib pesada necessária aqui —
# quem precisa de Chromium/Puppeteer é o wppconnect-server, não este serviço)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Pasta onde o token de acesso à API do wppconnect-server fica em cache
# (não é a sessão do WhatsApp em si — essa fica no volume do wppconnect-server)
RUN mkdir -p /app/config/tokens

CMD ["python", "main.py"]
