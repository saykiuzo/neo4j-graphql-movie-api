# CineGraph - API GraphQL de Recomendação de Filmes com Neo4j

CineGraph é uma API GraphQL que utiliza o banco de dados Neo4j para fornecer recomendações personalizadas de filmes baseadas nas preferências e avaliações dos usuários.
O banco de dados populado dessa aplicação é o [Movie Graph](https://neo4j.com/labs/graph-movies/) da Neo4j, que contém informações detalhadas sobre filmes, diretores, atores e gêneros.

## Características

- **Sistema de Autenticação**: Registro e login de usuários com geração de tokens JWT
- **Catálogo de Filmes**: Acesso a informações detalhadas sobre filmes, incluindo diretores, atores e gêneros
- **Sistema de Avaliações**: Permite aos usuários avaliar filmes em uma escala de 1 a 5
- **Pesquisa Avançada**: Busca em texto completo nos títulos, sinopses e taglines dos filmes
- **Recomendações Personalizadas**: Algoritmo inteligente que sugere filmes com base em:
  - Preferências de gênero do usuário
  - Filmes similares aos bem avaliados pelo usuário
  - Filmes populares como fallback

## Tecnologias

- **Neo4j**: Banco de dados orientado a grafos
- **GraphQL**: API de consulta e manipulação de dados
- **Apollo Server**: Servidor GraphQL
- **Neo4j-GraphQL**: Integração entre Neo4j e GraphQL
- **JWT**: Autenticação baseada em tokens
- **bcrypt**: Criptografia de senhas

## Modelo de Dados

A API utiliza um modelo de dados orientado a grafos com os seguintes nós e relacionamentos:

### Nós

- **Movie**: Representa um filme com suas propriedades (título, sinopse, classificação, etc.)
- **Person**: Representa pessoas envolvidas nos filmes (atores, diretores)
- **Genre**: Representa gêneros de filmes
- **User**: Representa usuários do sistema

### Relacionamentos

- **ACTED_IN**: Conecta Person a Movie (com propriedade "role")
- **DIRECTED**: Conecta Person a Movie
- **IN_GENRE**: Conecta Movie a Genre
- **RATED**: Conecta User a Movie (com propriedade "rating")
- **HAS_FAVORITE**: Conecta User a Movie

## Algoritmo de Recomendação

O sistema oferece recomendações personalizadas em três níveis:

1. **Baseado em Gêneros**: Recomenda filmes de gêneros que o usuário avaliou bem (≥ 4)
2. **Baseado em Similaridade**: Recomenda filmes semelhantes aos bem avaliados pelo usuário
3. **Fallback para Filmes Populares**: Recomenda filmes populares que o usuário ainda não avaliou

## Instalação

### Pré-requisitos

- Node.js (versão 18)
- Neo4j Database (versão 4.4)

### Configuração

1. Clone o repositório:
   ```bash
   git clone https://github.com/saykiuzo/neo4j-graphql-movie-api.git
   cd neo4j-graphql-movie-api
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:
   ```
    NEO4J_URI=bolt://44.211.140.85:7687
    NEO4J_USERNAME=neo4j
    NEO4J_PASSWORD=blast-ingredient-response
   ```
    Os valores acima são do banco de dados público do Movie Graph da Neo4j.

### Execução

Para iniciar o servidor em modo de desenvolvimento:
```bash
npm run dev
```

Para iniciar o servidor em modo de produção:
```bash
npm start
```

O servidor GraphQL estará disponível em `http://localhost:4000`

## Consultas GraphQL Disponíveis

### Consultas (Queries)

- **searchMovies**: Busca filmes por texto
  ```graphql
  query {
    searchMovies(searchText: "Matrix", limit: 5) {
      title
      plot
      imdbRating
    }
  }
  ```

- **getUserRating**: Obtém a avaliação de um usuário para um filme específico
  ```graphql
  query {
    getUserRating(userId: "123", movieTitle: "The Matrix") {
      rating
    }
  }
  ```

- **Movie.similarMovies**: Obtém filmes similares a um filme específico
  ```graphql
  query {
    movies {
      title
      similarMovies(limit: 5) {
        title
        imdbRating
      }
    }
  }
  ```

- **User.recommendedMovies**: Obtém recomendações personalizadas para um usuário
  ```graphql
  query {
    users {
      name
      recommendedMovies(limit: 10) {
        title
        imdbRating
      }
    }
  }
  ```

### Mutações (Mutations)

- **register**: Registra um novo usuário
  ```graphql
  mutation {
    register(
      name: "Usuário Teste"
      email: "usuario@teste.com"
      password: "senha123"
    ) {
      token
      user {
        userId
        name
      }
    }
  }
  ```

- **login**: Autentica um usuário
  ```graphql
  mutation {
    login(
      email: "usuario@teste.com"
      password: "senha123"
    ) {
      token
      user {
        userId
        name
      }
    }
  }
  ```

- **addRating**: Adiciona ou atualiza uma avaliação de filme
  ```graphql
  mutation {
    addRating(
      userId: "123"
      movieTitle: "The Matrix"
      rating: 5
    ) {
      movie {
        title
      }
      rating
    }
  }
  ```

- **removeRating**: Remove uma avaliação de filme
  ```graphql
  mutation {
    removeRating(
      userId: "123"
      movieTitle: "The Matrix"
    ) {
      success
    }
  }
  ```

## Estrutura do Projeto

```
cinegraph/
├── src/
│   ├── index.js        # Ponto de entrada da aplicação
│   ├── schema.graphql  # Esquema GraphQL
│   ├── resolvers.js    # Resolvers GraphQL
│   └── auth.js         # Autenticação e autorização
├── .env               # Configurações de ambiente
├── package.json       # Dependências e scripts
└── README.md          # Documentação
```

## Índice de Busca em Texto Completo

O sistema configura automaticamente um índice de busca em texto completo (fulltext) no Neo4j para permitir pesquisas eficientes nos títulos, sinopses e taglines dos filmes.