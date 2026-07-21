module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  moduleNameMapper: {
    "^@vessify/db$": "<rootDir>/packages/db/src",
    "^@vessify/auth$": "<rootDir>/packages/auth/src",
    "^@vessify/domain$": "<rootDir>/packages/domain/src"
  },
  transform: {
    "^.+\\.(t|j)sx?$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.test.json"
      }
    ]
  }
};
