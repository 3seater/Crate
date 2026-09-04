CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"magic_issuer" text NOT NULL,
	"email" text NOT NULL,
	"wallet_address" text NOT NULL,
	"safe_address" text,
	"encrypted_creds" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_magic_issuer_unique" UNIQUE("magic_issuer"),
	CONSTRAINT "users_wallet_address_unique" UNIQUE("wallet_address")
);
