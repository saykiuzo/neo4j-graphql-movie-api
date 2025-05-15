// src/resolvers.js - Versão corrigida com ajuste nos pattern expressions
import neo4j from "neo4j-driver";

const fallbackPopularMovies = async (context, limit) => {
    const session = context.driver.session();
    try {
        const result = await session.run(
            `
            MATCH (m:Movie)
            WHERE m.imdbRating IS NOT NULL
            RETURN m
            ORDER BY m.imdbRating DESC
            LIMIT $limit
            `,
            { limit: neo4j.int(limit) }
        );

        return result.records.map(record => {
            return record.get('m').properties;
        });
    } catch (error) {
        console.error("Erro ao buscar filmes populares:", error);
        return [];
    } finally {
        await session.close();
    }
};

export const resolvers = {
    Movie: {
        similarMovies: async (parent, args, context) => {
            if (!parent || !parent.title) {
                console.error("Missing title in parent object:", parent);
                return [];
            }

            const session = context.driver.session();
            try {
                const result = await session.run(
                    `
          MATCH (m:Movie {title: $title})
          MATCH (m)-[:IN_GENRE]->(g:Genre)<-[:IN_GENRE]-(other:Movie)
          WHERE m <> other
          WITH other, count(g) AS commonGenres
          RETURN other
          ORDER BY commonGenres DESC
          LIMIT $limit
          `,
                    {
                        title: parent.title,
                        limit: neo4j.int(args.limit || 5)
                    }
                );

                return result.records.map(record => record.get('other').properties);
            } catch (error) {
                console.error("Erro ao buscar filmes similares:", error);
                return [];
            } finally {
                await session.close();
            }
        },
    },

    User: {
        recommendedMovies: async (parent, args, context) => {
            const userId = parent.userId || parent.id || (parent.properties && parent.properties.userId);

            if (!userId) {
                console.error("Não foi possível encontrar userId no objeto parent:", parent);
                return fallbackPopularMovies(context, args.limit || 10);
            }

            const session = context.driver.session();
            try {
                // Primeiro, verifica se o usuário tem avaliações
                const userRatingsCheck = await session.run(
                    `
            MATCH (u:User {userId: $userId})-[r:RATED]->(m:Movie)
            RETURN count(r) AS ratingCount
            `,
                    { userId }
                );

                const ratingCount = userRatingsCheck.records[0].get('ratingCount').toNumber();

                if (ratingCount === 0) {

                    return fallbackPopularMovies(context, args.limit || 10);
                }

                // Recomendação baseada em gêneros

                const genreBasedResult = await session.run(
                    `
            // Encontrar gêneros de filmes bem avaliados pelo usuário (rating >= 4)
            MATCH (u:User {userId: $userId})-[r:RATED]->(m:Movie)-[:IN_GENRE]->(g:Genre)
            WHERE r.rating >= 4
            WITH u, g, count(*) AS genreCount
            
            // Ordenar gêneros pelo número de filmes bem avaliados
            ORDER BY genreCount DESC
            LIMIT 3
            
            // Encontrar filmes desses gêneros
            MATCH (g)<-[:IN_GENRE]-(recommendedMovie:Movie)
            
            // Verificar se o usuário não avaliou esse filme (corrigido)
            WHERE NOT exists((u)-[:RATED]->(recommendedMovie))
              AND recommendedMovie.imdbRating IS NOT NULL
            
            // Agrupar por filme e somar a contagem de gêneros correspondentes
            WITH recommendedMovie, count(g) AS matchingGenres
            
            // Ordenar por correspondência de gêneros e depois por avaliação do IMDB
            ORDER BY matchingGenres DESC, recommendedMovie.imdbRating DESC
            
            // Retornar filmes recomendados
            RETURN DISTINCT recommendedMovie
            LIMIT $limit
            `,
                    {
                        userId,
                        limit: neo4j.int(args.limit || 10)
                    }
                );

                if (genreBasedResult.records.length > 0) {
                    // Logar os filmes recomendados
                    genreBasedResult.records.forEach(record => {
                        const movie = record.get('recommendedMovie').properties;

                    });

                    return genreBasedResult.records.map(record => {
                        return record.get('recommendedMovie').properties;
                    });
                }

                // Recomendações baseadas em similaridade

                const similarityBasedResult = await session.run(
                    `
            // Encontrar o usuário
            MATCH (u:User {userId: $userId})
            
            // Encontrar filmes bem avaliados pelo usuário (rating >= 4)
            MATCH (u)-[r:RATED]->(m:Movie)
            WHERE r.rating >= 4
            
            // Encontrar filmes do mesmo gênero
            MATCH (m)-[:IN_GENRE]->(g:Genre)<-[:IN_GENRE]-(similar:Movie)
            WHERE NOT exists((u)-[:RATED]->(similar))
              AND similar.imdbRating IS NOT NULL
              
            // Agrupar por filme similar e contar o número de gêneros em comum
            WITH similar, COUNT(DISTINCT g) AS commonGenres, m
            
            // Ordenar por número de gêneros em comum e depois por avaliação IMDB
            ORDER BY commonGenres DESC, similar.imdbRating DESC
            
            // Retornar filmes similares
            RETURN DISTINCT similar
            LIMIT $limit
            `,
                    {
                        userId,
                        limit: neo4j.int(args.limit || 10)
                    }
                );

                if (similarityBasedResult.records.length > 0) {
                    similarityBasedResult.records.forEach(record => {
                        const movie = record.get('similar').properties;
                    });

                    return similarityBasedResult.records.map(record => {
                        return record.get('similar').properties;
                    });
                }

                // Fallback para filmes populares que o usuário não avaliou
                const fallbackResult = await session.run(
                    `
            // Encontrar o usuário
            MATCH (u:User {userId: $userId})
            
            // Encontrar filmes bem avaliados que o usuário não avaliou
            MATCH (m:Movie)
            WHERE NOT exists((u)-[:RATED]->(m)) 
              AND m.imdbRating IS NOT NULL
            RETURN m
            ORDER BY m.imdbRating DESC
            LIMIT $limit
            `,
                    {
                        userId,
                        limit: neo4j.int(args.limit || 10)
                    }
                );

                fallbackResult.records.forEach(record => {
                    const movie = record.get('m').properties;

                });

                return fallbackResult.records.map(record => {
                    return record.get('m').properties;
                });
            } catch (error) {
                console.error("Erro ao buscar recomendações:", error);
                return fallbackPopularMovies(context, args.limit || 10);
            } finally {
                await session.close();
            }
        },
    },

    Query: {
        getUserRating: async (_, { userId, movieTitle }, context) => {
            const session = context.driver.session();
            try {
                const result = await session.run(
                    `
        MATCH (u:User {userId: $userId})-[r:RATED]->(m:Movie {title: $movieTitle})
        RETURN r.rating AS rating
        `,
                    { userId, movieTitle }
                );

                if (result.records.length === 0) {

                    return { rating: null };
                }

                const rating = result.records[0].get('rating').toNumber();
                return { rating };
            } catch (error) {
                console.error(`Erro ao buscar avaliação:`, error);
                return { rating: null };
            } finally {
                await session.close();
            }
        },

        searchMovies: async (_, { searchText, limit }, context) => {
            const session = context.driver.session();
            try {
                const checkIndex = await session.run(
                    `SHOW INDEXES WHERE type = 'FULLTEXT' AND name = 'movieIndex'`
                );

                if (checkIndex.records.length === 0) {
                    console.warn("O índice fulltext 'movieIndex' não existe. A busca pode não funcionar corretamente.");
                }

                const result = await session.run(
                    `
          CALL db.index.fulltext.queryNodes("movieIndex", $searchText + "~") 
          YIELD node, score
          WHERE node:Movie
          RETURN node, score
          ORDER BY score DESC
          LIMIT $limit
          `,
                    {
                        searchText,
                        limit: neo4j.int(limit || 5)
                    }
                );

                return result.records.map(record => {
                    const movie = record.get('node').properties;
                    const score = record.get('score');

                    return {
                        ...movie,
                        searchScore: score
                    };
                });
            } catch (error) {
                console.error("Erro na busca de filmes:", error);
                if (error.message.includes("Unknown procedure")) {
                    console.error("O procedimento de busca fulltext não está disponível ou o índice não existe.");
                }
                return [];
            } finally {
                await session.close();
            }
        }
    },

    Mutation: {
        register: async (_, { name, email, password }, context) => {
            const session = context.driver.session();
            try {
                const checkUser = await session.run(
                    `MATCH (u:User {email: $email}) RETURN u`,
                    { email }
                );

                if (checkUser.records.length > 0) {
                    throw new Error("Um usuário com este email já existe");
                }

                const hashedPassword = await bcrypt.hash(password, 10);

                const userId = crypto.randomUUID();

                const result = await session.run(
                    `
          CREATE (u:User {
            userId: $userId,
            name: $name,
            email: $email,
            password: $hashedPassword
          })
          RETURN u {.*} AS user
          `,
                    { userId, name, email, hashedPassword }
                );

                if (result.records.length === 0) {
                    throw new Error("Falha ao criar usuário");
                }

                const user = result.records[0].get('user');

                delete user.password;

                const token = jwt.sign({ userId: user.userId }, JWT_SECRET, {
                    expiresIn: '7d'
                });

                return {
                    token,
                    user
                };
            } finally {
                await session.close();
            }
        },

        login: async (_, { email, password }, context) => {
            const session = context.driver.session();
            try {
                const result = await session.run(
                    `MATCH (u:User {email: $email}) RETURN u {.*} AS user`,
                    { email }
                );

                if (result.records.length === 0) {
                    throw new Error("Email ou senha inválidos");
                }

                const user = result.records[0].get('user');

                const isValidPassword = await bcrypt.compare(password, user.password);

                if (!isValidPassword) {
                    throw new Error("Email ou senha inválidos");
                }

                delete user.password;

                const token = jwt.sign({ userId: user.userId }, JWT_SECRET, {
                    expiresIn: '7d'
                });

                return {
                    token,
                    user
                };
            } finally {
                await session.close();
            }
        },

        addRating: async (_, { userId, movieTitle, rating }, context) => {
            const session = context.driver.session();
            try {
                if (rating < 1 || rating > 5) {
                    throw new Error("A avaliação deve ser entre 1 e 5");
                }

                const result = await session.executeWrite(tx =>
                    tx.run(
                        `
          MATCH (u:User {userId: $userId})
          MATCH (m:Movie {title: $movieTitle})
          
          // Criar ou atualizar o relacionamento RATED
          MERGE (u)-[r:RATED]->(m)
          ON CREATE SET r.rating = $rating, r.timestamp = datetime()
          ON MATCH SET r.rating = $rating, r.timestamp = datetime()
          
          // Retornar o filme com a avaliação
          RETURN m {
            .*,
            rating: r.rating
          } AS movie, u {
            .*
          } AS user
          `,
                        {
                            userId,
                            movieTitle,
                            rating: neo4j.int(rating)
                        }
                    )
                );

                if (result.records.length === 0) {
                    throw new Error("Usuário ou filme não encontrado");
                }

                const record = result.records[0];
                const movie = record.get('movie');
                const user = record.get('user');

                delete user.password;

                return {
                    movie,
                    user,
                    rating: movie.rating.toNumber()
                };
            } finally {
                await session.close();
            }
        },

        removeRating: async (_, { userId, movieTitle }, context) => {
            const session = context.driver.session();
            try {
                const result = await session.executeWrite(tx =>
                    tx.run(
                        `
          MATCH (u:User {userId: $userId})-[r:RATED]->(m:Movie {title: $movieTitle})
          DELETE r
          RETURN m {.*} AS movie, u {.*} AS user
          `,
                        { userId, movieTitle }
                    )
                );

                if (result.records.length === 0) {
                    throw new Error("Avaliação não encontrada");
                }

                const record = result.records[0];
                const movie = record.get('movie');
                const user = record.get('user');

                delete user.password;

                return {
                    movie,
                    user,
                    success: true
                };
            } finally {
                await session.close();
            }
        }
    }
};