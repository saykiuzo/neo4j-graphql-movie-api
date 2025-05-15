// auth.js
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "default-secret-key";

export const register = async (driver, { name, email, password }) => {
  const session = driver.session();
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
};

export const login = async (driver, { email, password }) => {
  const session = driver.session();
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
};

export const verifyToken = (token) => {
  try {
    if (!token) {
      return null;
    }
    
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};