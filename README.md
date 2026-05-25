# estudaí

Plataforma local de acompanhamento de estudos por matéria e assunto.  
Stack: Node.js + Express + SQLite + React — tudo em um projeto só.

## Requisitos

- [Node.js](https://nodejs.org) v20 (inclui o npm)

## Instalação e uso

```bash
# 1. Instale as dependências (só na primeira vez)
npm install

# 2. Suba o sistema completo
npm run dev
```

Acesse em **http://localhost:3000**

Para acessar do tablet/celular na mesma rede Wi-Fi:
- Descubra o IP do seu PC (`ipconfig` no Windows, `ifconfig` no Mac/Linux)
- Acesse `http://SEU-IP:3000` no navegador do tablet

## Estrutura

```
estudai/
  server/
    index.js          ← API Express (porta 3001) + banco SQLite
    estudai.db        ← banco de dados (criado automaticamente)
  src/
    pages/            ← telas React
    components/       ← componentes reutilizáveis (Sidebar)
    hooks/            ← contexto de usuário (useUsuario)
    lib/api.js        ← cliente HTTP para a API
  seed.js             ← utilitário de exportação/importação de dados
  package.json
```

## Telas

| Tela | Descrição |
|---|---|
| **Seleção de usuário** | Escolha quem vai estudar — suporta múltiplos usuários |
| **Dashboard** | Sequência de dias, minutos hoje, gráfico semanal e progresso por matéria |
| **Disciplinas** | Cadastre disciplinas com assuntos e acompanhe o progresso de cada um |
| **Editais** | Cadastre editais de concursos/vestibulares com suas disciplinas e assuntos |
| **Estudar** | Cronômetro de sessão com registro de tempo e progresso por assunto |
| **Meta & prova** | Configure a data da prova e a meta diária em minutos |
| **Grupo** | Progresso comparativo de todos os usuários cadastrados |

## Banco de dados

O banco inteiro está em `server/estudai.db`. Para fazer backup, basta copiar esse arquivo.

### Seed — exportar e importar dados

```bash
# Exporta os dados atuais para seed-data.json
npm run seed:export

# Carrega os dados do seed-data.json no banco (substitui os dados existentes)
npm run seed:load
```

Útil para migrar dados entre máquinas ou restaurar um estado conhecido.
