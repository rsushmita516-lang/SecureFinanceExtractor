import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: any;
};

// Simple, smart in-memory Prisma mock to allow local operation without PostgreSQL
const dbStore: Record<string, any[]> = {
  user: [],
  session: [],
  account: [],
  organization: [],
  member: [],
  team: [],
  teamMember: [],
  verification: [],
  transaction: [],
  extractionJob: [],
  jwks: []
};

function matches(item: any, where: any): boolean {
  if (!where) return true;
  
  // Handle top-level OR
  if (where.OR && Array.isArray(where.OR)) {
    const otherConditions = { ...where };
    delete otherConditions.OR;
    if (!matches(item, otherConditions)) return false;
    return where.OR.some((orCond: any) => matches(item, orCond));
  }
  
  for (const key of Object.keys(where)) {
    const condition = where[key];
    if (condition instanceof Date) {
      if (item[key]?.getTime?.() !== condition.getTime()) return false;
    } else if (condition && typeof condition === "object" && !Array.isArray(condition)) {
      if ("equals" in condition) {
        const val = condition.equals;
        if (val instanceof Date) {
          if (item[key]?.getTime?.() !== val.getTime()) return false;
        } else if (item[key] !== val) return false;
      }
      if ("in" in condition && !condition.in.includes(item[key])) return false;
      if ("lt" in condition) {
        const val = condition.lt instanceof Date ? condition.lt.getTime() : condition.lt;
        const itemVal = item[key] instanceof Date ? item[key].getTime() : item[key];
        if (!(itemVal < val)) return false;
      }
      if ("lte" in condition) {
        const val = condition.lte instanceof Date ? condition.lte.getTime() : condition.lte;
        const itemVal = item[key] instanceof Date ? item[key].getTime() : item[key];
        if (!(itemVal <= val)) return false;
      }
      if ("gt" in condition) {
        const val = condition.gt instanceof Date ? condition.gt.getTime() : condition.gt;
        const itemVal = item[key] instanceof Date ? item[key].getTime() : item[key];
        if (!(itemVal > val)) return false;
      }
      if ("gte" in condition) {
        const val = condition.gte instanceof Date ? condition.gte.getTime() : condition.gte;
        const itemVal = item[key] instanceof Date ? item[key].getTime() : item[key];
        if (!(itemVal >= val)) return false;
      }
      if ("not" in condition && item[key] === condition.not) return false;
    } else {
      if (item[key] !== condition) return false;
    }
  }
  return true;
}

function createModelMock(modelName: string) {
  return {
    findMany: async (args: any = {}) => {
      const list = dbStore[modelName] || [];
      let result = list.filter(item => matches(item, args.where));
      if (args.orderBy) {
        const orderArray = Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy];
        result.sort((a, b) => {
          for (const order of orderArray) {
            const key = Object.keys(order)[0];
            if (!key) continue;
            const direction = order[key];
            const valA = a[key];
            const valB = b[key];
            if (valA < valB) return direction === "desc" ? 1 : -1;
            if (valA > valB) return direction === "desc" ? -1 : 1;
          }
          return 0;
        });
      }
      if (args.take !== undefined) {
        result = result.slice(0, args.take);
      }
      return result;
    },
    findFirst: async (args: any = {}) => {
      const list = dbStore[modelName] || [];
      return list.find(item => matches(item, args.where)) || null;
    },
    findUnique: async (args: any = {}) => {
      const list = dbStore[modelName] || [];
      return list.find(item => matches(item, args.where)) || null;
    },
    create: async (args: any = {}) => {
      const list = dbStore[modelName] || [];
      const data = { ...args.data };
      if (!data.id) {
        data.id = Math.random().toString(36).slice(2, 11);
      }
      if (!data.createdAt) {
        data.createdAt = new Date();
      }
      if (!data.updatedAt) {
        data.updatedAt = new Date();
      }
      list.push(data);
      return data;
    },
    update: async (args: any = {}) => {
      const list = dbStore[modelName] || [];
      const index = list.findIndex(item => matches(item, args.where));
      if (index === -1) {
        throw new Error(`Record to update not found in ${modelName}`);
      }
      const data = args.data;
      list[index] = { ...list[index], ...data, updatedAt: new Date() };
      return list[index];
    },
    updateMany: async (args: any = {}) => {
      const list = dbStore[modelName] || [];
      let count = 0;
      list.forEach((item, index) => {
        if (matches(item, args.where)) {
          list[index] = { ...item, ...args.data, updatedAt: new Date() };
          count++;
        }
      });
      return { count };
    },
    delete: async (args: any = {}) => {
      const list = dbStore[modelName] || [];
      const index = list.findIndex(item => matches(item, args.where));
      if (index === -1) {
        throw new Error(`Record to delete not found in ${modelName}`);
      }
      const deleted = list[index];
      list.splice(index, 1);
      return deleted;
    },
    deleteMany: async (args: any = {}) => {
      const list = dbStore[modelName] || [];
      let count = 0;
      for (let i = list.length - 1; i >= 0; i--) {
        if (matches(list[i], args.where)) {
          list.splice(i, 1);
          count++;
        }
      }
      return { count };
    },
    count: async (args: any = {}) => {
      const list = dbStore[modelName] || [];
      return list.filter(item => matches(item, args.where)).length;
    }
  };
}

const mockPrisma: any = {
  $transaction: async (arg: any) => {
    if (typeof arg === "function") {
      return arg(mockPrisma);
    }
    return Promise.all(arg);
  }
};

const models = [
  "user", "session", "account", "organization", "member",
  "team", "teamMember", "verification", "transaction", "extractionJob", "jwks"
];

models.forEach(model => {
  mockPrisma[model] = createModelMock(model);
});

// Detect database availability and assign the exporter
export const prisma = (() => {
  const dbUrl = process.env.DATABASE_URL;
  const isCloudSandbox = process.env.APP_URL && process.env.APP_URL.includes(".run.app");

  if (dbUrl && !(isCloudSandbox && dbUrl.includes("localhost"))) {
    console.log("[DATABASE] Real database connected via DATABASE_URL");
    return (
      globalForPrisma.prisma ??
      new PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"]
      })
    );
  } else {
    console.warn(
      dbUrl && isCloudSandbox && dbUrl.includes("localhost")
        ? "[DATABASE] Running in cloud sandbox, but DATABASE_URL points to localhost. Falling back to high-performance in-memory mock."
        : "[DATABASE] No DATABASE_URL found. Running with high-performance in-memory mock."
    );
    return globalForPrisma.prisma ?? mockPrisma;
  }
})();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "@prisma/client";
