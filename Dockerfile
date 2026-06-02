FROM node:18-alpine

WORKDIR /app

# Instalar dependências do sistema para better-sqlite3
RUN apk add --no-cache python3 make g++

# Copiar arquivos de configuração
COPY package*.json ./

# Instalar dependências
RUN npm ci

# Copiar o código da aplicação
COPY . .

# Build do React
RUN npm run build

# Expor porta
EXPOSE 3001 3000

# Comando para iniciar o servidor
CMD ["npm", "start"]
