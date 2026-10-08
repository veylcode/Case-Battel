// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

export const presence = sqliteTable("presence", {
  userId: text("user_id").primaryKey(),
  seen: integer("seen").notNull(),
}, table => [index("presence_seen_idx").on(table.seen)]);

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  login: text("login").unique(),
  password: text("password"),
  state: text("state").notNull(),
  version: integer("version").notNull().default(0),
  banned: integer("banned").notNull().default(0),
  created: integer("created").notNull(),
});
export const avatars = sqliteTable("avatars", {
  userId: text("user_id").primaryKey(),
  image: text("image").notNull(),
  updated: integer("updated").notNull(),
});
export const sessions = sqliteTable("sessions", {
  token: text("token").primaryKey(),
  userId: text("user_id").notNull(),
  role: text("role").notNull(),
  expires: integer("expires").notNull(),
});
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  version: integer("version").notNull().default(0),
});
export const audit = sqliteTable("audit", {
  id: text("id").primaryKey(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  details: text("details").notNull(),
  created: integer("created").notNull(),
});
export const tickets = sqliteTable("tickets", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  reply: text("reply").notNull().default(""),
  status: text("status").notNull().default("open"),
  created: integer("created").notNull(),
});
export const attempts = sqliteTable("attempts", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  reset: integer("reset").notNull(),
});
