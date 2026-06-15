const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const DB_PATH = path.join(__dirname, "data/estudai.db");
const BACKUP_PATH = path.join(__dirname, "data/estudai.db.backup");

if (!fs.existsSync(DB_PATH)) {
  console.error(`Banco não encontrado: ${DB_PATH}`);
  process.exit(1);
}

fs.copyFileSync(DB_PATH, BACKUP_PATH);
console.log(`Backup criado em ${BACKUP_PATH}`);

const db = new Database(DB_PATH);
db.pragma("journal_mode=WAL");

// Edital TJCE 2026 - Edital nº 01/2026 (retificado pelo Edital nº 02/2026)
// Cargo F06 - Analista Judiciário - Área Apoio Especializado -
// Especialidade Ciência da Computação - Área Tecnologia da Informação - Sistemas
const EDITAL = {
  nome: "TJCE - Analista Judiciário (TI - Sistemas)",
  instituicao: "Tribunal de Justiça do Estado do Ceará",
  data_prova: "2026-08-09",
  descricao:
    "Cargo F06 - Analista Judiciário - Área Apoio Especializado - Especialidade Ciência da Computação - " +
    "Área Tecnologia da Informação - Sistemas. Edital nº 01/2026, retificado pelo Edital nº 02/2026. " +
    "Vencimento inicial: R$ 8.829,24.",
};

// Cada assunto: { id: <catalogId existente> } para reaproveitar do catálogo,
// ou { nome: <nome novo> } para criar uma entrada nova no catálogo.
// nomeNoEdital define como o assunto aparece nesta disciplina do edital.
const DISCIPLINAS = [
  {
    nome: "Gestão de Produtos Digitais",
    assuntos: [
      { nome: "Visão de Produto, proposição de valor e análise competitiva" },
      { nome: "Ciclo de vida do produto: introdução, crescimento, maturidade e descontinuação" },
      { nome: "Gestão de Backlog: priorização (MoSCoW, RICE, WSJF, Matriz Valor x Esforço)" },
      { nome: "Papéis do Product Owner e Product Manager em Scrum e Kanban" },
      { nome: "Release Planning, MVP e MMF" },
      { nome: "Feature flags, planned rollouts e dark launches" },
      { nome: "Gestão de Stakeholders" },
      { nome: "Arquitetura corporativa: fundamentos do TOGAF" },
    ],
  },
  {
    nome: "Análise de Negócio e Requisitos",
    assuntos: [
      { id: 691, nomeNoEdital: "Técnicas de Elicitação de Requisitos (entrevistas, questionários, observação, workshops)" },
      { id: 65, nomeNoEdital: "Modelagem de Processos de Negócio (BPMN 2.0) e análise AS-IS/TO-BE" },
      { id: 231, nomeNoEdital: "Especificação de Requisitos Funcionais, Não Funcionais e Regras de Negócio" },
      { nome: "Documentação Ágil: User Stories, Definition of Ready e Definition of Done" },
      { nome: "Análise de Lacunas (Gap Analysis) e Viabilidade Técnica" },
    ],
  },
  {
    nome: "Estratégia, Ideação e Design de Produto",
    assuntos: [
      { nome: "Design Thinking: empatia, ideação e prototipação" },
      { nome: "Product Discovery: técnicas de exploração e validação de soluções" },
      { nome: "Experiência do Usuário (UX) e Interface do Usuário (UI)" },
      { id: 400, nomeNoEdital: "Planejamento Estratégico de TI com OKRs" },
      { nome: "Roadmaps de Produto" },
    ],
  },
  {
    nome: "Agilidade, Fluxo e Gestão de Portfólio",
    assuntos: [
      { id: 401, nomeNoEdital: "Framework Scrum e Método Kanban" },
      { nome: "Agilidade em Escala: Flight Levels (Nível 1, 2 e 3)" },
      { nome: "Planejamento Trimestral (PI Planning)" },
      { id: 284, nomeNoEdital: "Gestão de Portfólio de Produtos e Sistemas" },
      { nome: "Gestão de dependências entre produtos e sistemas legados" },
    ],
  },
  {
    nome: "Métricas e Análise de Dados de Produto",
    assuntos: [
      { nome: "Métricas de Processo: Lead Time, Cycle Time, Throughput e CFD" },
      { nome: "Métricas de Produto: NPS, CSAT, testes A/B e Cohort Analysis" },
      { nome: "Resultados de Negócio: Outcomes vs Outputs" },
      { id: 111, nomeNoEdital: "Governança de Dados de Produto" },
      { id: 540, nomeNoEdital: "Qualidade de Dados para Tomada de Decisão" },
    ],
  },
  {
    nome: "Riscos, Qualidade e Conformidade",
    assuntos: [
      { id: 1, nomeNoEdital: "Gestão de Riscos de Produto: valor, viabilidade, usabilidade e riscos jurídicos/regulatórios" },
      { id: 360, nomeNoEdital: "LGPD aplicada ao desenvolvimento de sistemas judiciais" },
      { id: 742, nomeNoEdital: "Qualidade de Software: Privacy by Design e Privacy by Default" },
      { nome: "FinOps: gestão de custos em nuvem e eficiência financeira" },
    ],
  },
  {
    nome: "Engenharia de Domínio e Modernização de Sistemas",
    assuntos: [
      { id: 209, nomeNoEdital: "Domain-Driven Design (DDD) Estratégico" },
      { nome: "Mapeamento de Contextos (Context Mapping) e Bounded Contexts" },
      { nome: "Estratégias de Decomposição de Monólitos para Microsserviços" },
      { nome: "Padrão Strangler Fig (Estrangulamento de Legado)" },
      { nome: "API-led Connectivity: APIs como produtos de negócio" },
      { nome: "Gestão de Dívida Técnica" },
      { nome: "Modernização de Sistemas Legados sob a Ótica de Negócio" },
      { nome: "Interoperabilidade e Integração com a Plataforma Digital do Poder Judiciário (PDPJ-Br)" },
      { nome: "Modelo TIME para Gestão de Portfólio de Aplicações" },
    ],
  },
  {
    nome: "Segurança de Software e Governança",
    assuntos: [
      { nome: "OWASP SAMM (Software Assurance Maturity Model)" },
      { id: 188, nomeNoEdital: "Segurança no Ciclo de Vida do Desenvolvimento (Security by Design)" },
      { nome: "Modelagem de Ameaças (Threat Modeling)" },
      { id: 288, nomeNoEdital: "Gestão de Vulnerabilidades de Negócio e Fluxos de Aprovação Judicial" },
      { nome: "Privacidade e Proteção de Dados: Relatórios de Impacto (RIPD/DPIA)" },
      { nome: "Gestão de Identidade e Acesso (IAM) e Controle de Acesso Baseado em Papéis (RBAC)" },
      { nome: "Segurança da Cadeia de Suprimentos de Software (SBOM)" },
      { id: 59, nomeNoEdital: "Conformidade, Auditoria e Rastreabilidade de Ações" },
    ],
  },
  {
    nome: "Inteligência Artificial Aplicada ao Produto",
    assuntos: [
      { id: 328, nomeNoEdital: "Fundamentos de Inteligência Artificial e Aprendizado de Máquina" },
      { id: 380, nomeNoEdital: "Aprendizado de Máquina aplicado a produtos" },
      { id: 511, nomeNoEdital: "Processamento de Linguagem Natural (PLN) aplicado ao contexto jurídico" },
      { id: 310, nomeNoEdital: "IA Generativa no Ciclo de Desenvolvimento de Software (SDLC)" },
      { nome: "Engenharia de Prompt: princípios e aplicações práticas" },
      { nome: "Product Discovery Impulsionado por IA" },
      { nome: "Padrões de Design para IA (UX for AI)" },
      { nome: "Arquiteturas de IA para Negócio: APIs de Modelos e Pipelines de Dados" },
      { nome: "Retrieval-Augmented Generation (RAG)" },
      { nome: "Agentes e Workflows Agênticos de IA" },
      { id: 413, nomeNoEdital: "Avaliação e Monitoramento de Sistemas de IA" },
      { id: 294, nomeNoEdital: "Ética, Governança e Riscos de IA (Viés e Transparência)" },
    ],
  },
  {
    nome: "Engenharia de Dados e Plataformas Analíticas",
    assuntos: [
      { id: 167, nomeNoEdital: "Data Lake: conceitos e arquitetura" },
      { id: 166, nomeNoEdital: "Data Warehouse e Lakehouse" },
      { id: 410, nomeNoEdital: "Modelagem Dimensional (Star Schema e Snowflake)" },
      { id: 408, nomeNoEdital: "Modelagem de Dados Relacional" },
      { id: 516, nomeNoEdital: "Processos de Ingestão e Transformação: ETL" },
      { id: 515, nomeNoEdital: "Processos de Ingestão e Transformação: ELT" },
      { id: 542, nomeNoEdital: "Qualidade, Governança e Catalogação de Dados" },
      { id: 76, nomeNoEdital: "Processamento de Dados em Larga Escala (Big Data)" },
      { id: 327, nomeNoEdital: "Integração de Dados: APIs e Mensageria para BI e IA" },
    ],
  },
  {
    nome: "Automação de Processos e RPA",
    assuntos: [
      { nome: "RPA (Robotic Process Automation): conceitos e identificação de processos automatizáveis (BPM)" },
      { nome: "Desenvolvimento e Orquestração de Robôs: fluxos, exceções e reprocessamento" },
      { nome: "Integração de RPA com Sistemas Corporativos e APIs" },
      { nome: "Governança, Monitoramento e Hyperautomation" },
    ],
  },
  {
    nome: "Engenharia de Software Moderna e Integração de Sistemas",
    assuntos: [
      { id: 51, nomeNoEdital: "Arquiteturas de Sistemas Distribuídos e Microsserviços" },
      { id: 7, nomeNoEdital: "Desenvolvimento Orientado a APIs (REST)" },
      { id: 52, nomeNoEdital: "Desenvolvimento Orientado a Eventos (EDA)" },
      { nome: "Integração entre Sistemas Legados e Modernos" },
      { id: 203, nomeNoEdital: "Conteinerização com Docker" },
      { id: 355, nomeNoEdital: "Orquestração de Containers com Kubernetes" },
      { id: 82, nomeNoEdital: "Práticas de DevOps e DevSecOps: Pipelines de CI/CD" },
      { id: 669, nomeNoEdital: "Testes Automatizados e Qualidade de Software" },
      { nome: "Observabilidade: Logs, Métricas e Rastreamento Distribuído" },
    ],
  },
  {
    nome: "Desenvolvimento com Java",
    assuntos: [
      { id: 346, nomeNoEdital: "Linguagem Java" },
      { id: 522, nomeNoEdital: "Programação Orientada a Objetos" },
      { id: 683, nomeNoEdital: "Tratamento de Exceções e Boas Práticas de Codificação" },
      { id: 648, nomeNoEdital: "Desenvolvimento com Spring Boot" },
      { id: 653, nomeNoEdital: "Spring MVC" },
      { nome: "Estratégias de Decomposição de Monólitos para Microsserviços", nomeNoEdital: "Decomposição de Sistemas Monolíticos" },
      { nome: "Padrões de Arquitetura: API Gateway, Service Discovery e Circuit Breaker" },
      { id: 343, nomeNoEdital: "JPA e Hibernate: mapeamento objeto-relacional" },
      { id: 283, nomeNoEdital: "Transações e Controle de Concorrência" },
      { id: 396, nomeNoEdital: "Comunicação Assíncrona: Mensageria com Kafka e RabbitMQ" },
    ],
  },
  {
    nome: "Planejamento, Contratação e Fiscalização de TIC",
    assuntos: [
      { nome: "Estudo Técnico Preliminar (ETP) e Termo de Referência/Projeto Básico" },
      { id: 367, nomeNoEdital: "Lei nº 14.133/2021 aplicada à Contratação de TIC" },
      { id: 478, nomeNoEdital: "Planejamento estratégico e tático de TIC" },
      { id: 480, nomeNoEdital: "Plano Diretor de Tecnologia da Informação (PDTI)" },
      { nome: "Gestão e Fiscalização de Contratos de TI: Métricas, SLA e ANS" },
      { nome: "Gestão Contratual de TIC: Papéis, Medição, Penalidades e Reequilíbrio Econômico-Financeiro" },
    ],
  },
  {
    nome: "Inglês Técnico",
    // Reaproveita integralmente o catálogo já usado na disciplina "Inglês Técnico" do TRT 6ª Região
    assuntos: [
      { id: 43 }, { id: 88 }, { id: 90 }, { id: 102 }, { id: 108 }, { id: 115 },
      { id: 206 }, { id: 207 }, { id: 208 }, { id: 334 }, { id: 369 }, { id: 370 },
      { id: 382 }, { id: 383 }, { id: 561 }, { id: 579 }, { id: 667 }, { id: 686 },
      { id: 712 }, { id: 718 },
    ],
  },
];

const insertCatalog = db.prepare("INSERT OR IGNORE INTO assuntos_catalogo (nome) VALUES (?)");
const getCatalogByNome = db.prepare("SELECT id, nome FROM assuntos_catalogo WHERE nome = ?");
const getCatalogById = db.prepare("SELECT id, nome FROM assuntos_catalogo WHERE id = ?");
const insertEditalAssunto = db.prepare(
  "INSERT INTO edital_assuntos (edital_disciplina_id, assunto_id, nome_no_edital) VALUES (?, ?, ?)"
);

const run = db.transaction(() => {
  const editalExistente = db.prepare("SELECT id FROM editais WHERE nome = ?").get(EDITAL.nome);
  if (editalExistente) {
    console.log(`Edital "${EDITAL.nome}" já existe (id ${editalExistente.id}). Abortando para não duplicar.`);
    return;
  }

  const editalRes = db.prepare(`
    INSERT INTO editais (nome, instituicao, data_prova, descricao)
    VALUES (?, ?, ?, ?)
  `).run(EDITAL.nome, EDITAL.instituicao, EDITAL.data_prova, EDITAL.descricao);

  const editalId = editalRes.lastInsertRowid;
  console.log(`Edital criado: ${EDITAL.nome} (id ${editalId})`);

  let novosNoCatalogo = 0;
  let reaproveitados = 0;

  for (const disc of DISCIPLINAS) {
    const discRes = db.prepare("INSERT INTO edital_disciplinas (edital_id, nome) VALUES (?, ?)")
      .run(editalId, disc.nome);
    const discId = discRes.lastInsertRowid;
    console.log(`  Disciplina: ${disc.nome} (id ${discId})`);

    for (const assunto of disc.assuntos) {
      let catalogId, catalogNome;

      if (assunto.id) {
        const found = getCatalogById.get(assunto.id);
        if (!found) throw new Error(`assuntos_catalogo id ${assunto.id} não encontrado`);
        catalogId = found.id;
        catalogNome = found.nome;
        reaproveitados++;
      } else {
        const inserted = insertCatalog.run(assunto.nome);
        const found = getCatalogByNome.get(assunto.nome);
        catalogId = found.id;
        catalogNome = found.nome;
        if (inserted.changes > 0) novosNoCatalogo++;
        else reaproveitados++;
      }

      const nomeNoEdital = assunto.nomeNoEdital || catalogNome;
      insertEditalAssunto.run(discId, catalogId, nomeNoEdital);
    }
  }

  console.log(`\nTotal: ${reaproveitados} assuntos reaproveitados do catálogo, ${novosNoCatalogo} novas entradas criadas no catálogo.`);
});

run();
db.close();
console.log("\nConcluído.");
