# Evolution API do PAIEMAE

Stack enxuta para uma VPS pequena:

- Evolution API `v2.3.7`;
- PostgreSQL e Redis privados;
- worker do PAIEMAE para consumir `marketing_queue`;
- QR Code e status publicados em `whatsapp_connection_status`;
- nenhuma porta pública adicional e nenhum inbox/painel pesado.

## 1. Preparar a VPS

```bash
sudo apt update
sudo apt install -y ca-certificates curl git openssl
curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
sudo sh /tmp/get-docker.sh
sudo usermod -aG docker "$USER"
```

Saia do SSH e entre novamente para o grupo `docker` ser aplicado.

Em VPS com 1 GB de RAM, confira se já existe swap:

```bash
free -h
swapon --show
```

Se não existir, crie 2 GB:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 2. Configurar os segredos

Na raiz do repositório:

```bash
cd deploy/evolution
cp .env.example .env
chmod 600 .env
openssl rand -hex 32
openssl rand -hex 24
nano .env
```

Use o primeiro valor aleatório em `AUTHENTICATION_API_KEY` e o segundo em
`POSTGRES_PASSWORD`.

No Supabase, copie a URL do projeto e uma chave **Secret** (`sb_secret_...`).
Se o projeto ainda só possuir as chaves legadas, a `service_role` funciona como
transição. Essa chave fica apenas no `.env` da VPS e nunca deve usar prefixo
`VITE_` nem ser colocada no frontend.

## 3. Subir os serviços

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f evolution-api worker
```

O worker cria automaticamente a instância `paiemae`. O QR Code aparecerá em
**PAIEMAE → Integrações → Motor → Conexão WhatsApp**.

## Operação

```bash
# Estado dos serviços
docker compose ps

# Logs recentes
docker compose logs --tail=100 evolution-api worker

# Reiniciar sem apagar dados
docker compose restart evolution-api worker

# Atualizar a imagem e recriar os contêineres
docker compose pull
docker compose up -d --build
```

Não abra as portas `5432`, `6379` ou `8080` no firewall/NSG da Oracle. A porta
`8080` está vinculada somente a `127.0.0.1` para diagnóstico local.
