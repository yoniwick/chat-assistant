CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"summary" text,
	"archived" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid,
	"kind" text NOT NULL,
	"content" text NOT NULL,
	"importance" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"token_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"search_used" boolean DEFAULT false NOT NULL,
	"sources" jsonb
);
--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
ALTER TABLE messages ADD COLUMN tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;
--> statement-breakpoint
CREATE INDEX messages_tsv_idx ON messages USING GIN (tsv);
--> statement-breakpoint
ALTER TABLE memories ADD COLUMN tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;
--> statement-breakpoint
CREATE INDEX memories_tsv_idx ON memories USING GIN (tsv);
