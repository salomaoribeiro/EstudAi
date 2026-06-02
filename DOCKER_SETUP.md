# Docker Setup para EstudAi

## Estrutura de Volumes

A configuração Docker usa volumes para garantir que seus dados persistem:

- **`./data`**: Pasta na raiz do projeto que armazena o banco de dados (`estudai.db`)
- Mesmo deletando o container, os dados continuam salvos em `./data/estudai.db`

## Primeiros passos

### 1. Criar a pasta de dados (primeira vez)
```bash
mkdir -p data
```

### 2. Build da imagem Docker
```bash
docker-compose build
```

### 3. Iniciar a aplicação
```bash
docker-compose up -d
```

A aplicação estará disponível em:
- **Backend**: http://localhost:3001
- **Frontend**: http://localhost:3000

### 4. Parar o container (dados persistem)
```bash
docker-compose down
```

### 5. Reiniciar o container
```bash
docker-compose up -d
```

## Verificando o banco de dados

O arquivo `estudai.db` estará sempre disponível em:
```
./data/estudai.db
```

Você pode fazer backup ou inspecionar o banco a qualquer momento.

## Logs

Ver logs da aplicação:
```bash
docker-compose logs -f app
```

## Remover tudo (incluindo volume)
```bash
docker-compose down -v
```

## Desenvolvimento

Para desenvolvimento, use:
```bash
npm run dev
```

Para produção com Docker:
```bash
docker-compose up
```

## Notas

- O volume `/app/node_modules` está separado para melhor performance
- O Dockerfile faz build do React automaticamente
- O banco de dados usa WAL mode para melhor concorrência
- A aplicação rodará apenas no modo servidor (não em desenvolvimento)
