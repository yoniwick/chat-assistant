import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const conversations = pgTable("conversations", {
  id: uuid("id")
    .primaryKey()
    .defaultRandom(),
  title: text("title"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  summary: text("summary"),
  archived: boolean("archived").notNull().default(false),
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // 'user' | 'assistant' | 'system' | 'tool'
  content: text("content").notNull(),
  tokenCount: integer("token_count"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  searchUsed: boolean("search_used").notNull().default(false),
  sources: jsonb("sources").$type<Source[]>(),
});

export const memories = pgTable("memories", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").references(() => conversations.id, {
    onDelete: "set null",
  }),
  kind: text("kind").notNull(), // 'fact' | 'preference' | 'entity' | 'task'
  content: text("content").notNull(), // one atomic statement
  importance: integer("importance").notNull(), // 1-5
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
});

export interface Source {
  title: string;
  url: string;
  snippet: string;
}

// Helper type for messages rows that include the tsv column
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type Memory = typeof memories.$inferSelect;
export type NewMemory = typeof memories.$inferInsert;