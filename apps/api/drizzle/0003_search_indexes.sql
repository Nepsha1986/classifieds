DROP INDEX "listings_seller_idx";--> statement-breakpoint
CREATE INDEX "listings_seller_created_idx" ON "listings" USING btree ("seller_id","created_at");--> statement-breakpoint
CREATE INDEX "listings_active_category_created_idx" ON "listings" USING btree ("category_id","created_at") WHERE "listings"."status" = 'active';--> statement-breakpoint
CREATE INDEX "listings_active_city_idx" ON "listings" USING btree (lower("city")) WHERE "listings"."status" = 'active';--> statement-breakpoint
CREATE INDEX "listings_active_price_idx" ON "listings" USING btree ("price") WHERE "listings"."status" = 'active';