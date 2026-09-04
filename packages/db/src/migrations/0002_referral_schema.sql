CREATE TABLE "referral_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"code" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"max_uses" integer,
	"use_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "referral_codes_code_unique" UNIQUE("code"),
	CONSTRAINT "referral_codes_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "referral_codes_use_count_nonneg" CHECK ("use_count" >= 0),
	CONSTRAINT "referral_codes_max_uses_positive" CHECK ("max_uses" IS NULL OR "max_uses" > 0),
	CONSTRAINT "referral_codes_use_count_limit" CHECK ("max_uses" IS NULL OR "use_count" <= "max_uses")
);
--> statement-breakpoint
CREATE TABLE "referral_code_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referral_code_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"old_code" text NOT NULL,
	"replaced_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "referral_code_aliases_old_code_unique" UNIQUE("old_code")
);
--> statement-breakpoint
CREATE TABLE "referral_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referral_code_id" uuid NOT NULL,
	"referrer_user_id" uuid,
	"referee_user_id" uuid NOT NULL,
	"code" text NOT NULL,
	"source" text DEFAULT 'login_gate' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "referral_redemptions_referee_unique" UNIQUE("referee_user_id")
);
--> statement-breakpoint
ALTER TABLE "referral_codes" ADD CONSTRAINT "referral_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_code_aliases" ADD CONSTRAINT "referral_code_aliases_referral_code_id_fk" FOREIGN KEY ("referral_code_id") REFERENCES "public"."referral_codes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_code_aliases" ADD CONSTRAINT "referral_code_aliases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_redemptions" ADD CONSTRAINT "referral_redemptions_referral_code_id_fk" FOREIGN KEY ("referral_code_id") REFERENCES "public"."referral_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_redemptions" ADD CONSTRAINT "referral_redemptions_referrer_user_id_users_id_fk" FOREIGN KEY ("referrer_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_redemptions" ADD CONSTRAINT "referral_redemptions_referee_user_id_users_id_fk" FOREIGN KEY ("referee_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "referral_codes_user_id_idx" ON "referral_codes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "referral_code_aliases_referral_code_id_idx" ON "referral_code_aliases" USING btree ("referral_code_id");--> statement-breakpoint
CREATE INDEX "referral_code_aliases_user_id_idx" ON "referral_code_aliases" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "referral_redemptions_referrer_id_idx" ON "referral_redemptions" USING btree ("referrer_user_id");--> statement-breakpoint
CREATE INDEX "referral_redemptions_code_id_idx" ON "referral_redemptions" USING btree ("referral_code_id");
--> statement-breakpoint
INSERT INTO "referral_codes" ("user_id", "code", "is_active", "max_uses", "use_count")
VALUES (NULL, 'DOJI100', true, 100, 0)
ON CONFLICT ("code") DO NOTHING;
