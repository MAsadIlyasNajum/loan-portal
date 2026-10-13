import { defineConfig } from 'prisma/config'

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL ?? 'mysql://loan_user:loan_password@localhost:3306/loan_portal?schema=public',
  },
})