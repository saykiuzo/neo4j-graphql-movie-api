// src/index.js
import { Neo4jGraphQL } from "@neo4j/graphql";
import { ApolloServer } from "apollo-server";
import neo4j from "neo4j-driver";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { resolvers } from "./resolvers.js";
import { randomUUID } from "crypto";

// Define a função randomUUID globalmente, usado nos resolvers
global.crypto = { randomUUID };

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const typeDefs = fs.readFileSync(
  path.join(__dirname, "schema.graphql"),
  "utf-8"
);

const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(
    process.env.NEO4J_USERNAME,
    process.env.NEO4J_PASSWORD
  )
);

const setupFullTextSearch = async (driver) => {
  const session = driver.session();
  try {
    const checkResult = await session.run(
      `SHOW INDEXES WHERE type = 'FULLTEXT' AND name = 'movieIndex'`
    );

    if (checkResult.records.length === 0) {
      await session.run(
        `CREATE FULLTEXT INDEX movieIndex FOR (m:Movie) ON EACH [m.title, m.plot, m.tagline]`
      );
    } else {
      console.log("Índice de busca em texto completo já existe");
    }
  } catch (error) {
    console.error("Erro ao configurar índice de busca em texto completo:", error);
  } finally {
    await session.close();
  }
};

const startServer = async () => {
  try {
    await setupFullTextSearch(driver);

    const neoSchema = new Neo4jGraphQL({
      typeDefs,
      resolvers,
      driver,
    });

    const schema = await neoSchema.getSchema();

    const server = new ApolloServer({
      schema,
      context: ({ req }) => {
        const token = req.headers.authorization ?
          req.headers.authorization.replace('Bearer ', '') : null;

        return {
          driver,
          token
        };
      },
      introspection: true,
      playground: true,
    });

    const { url } = await server.listen();
    console.log(`🚀 Servidor GraphQL rodando em ${url}`);
  } catch (error) {
    console.error("Erro ao iniciar o servidor:", error);
    process.exit(1);
  }
};

startServer();