CREATE TABLE `presence` (
	`user_id` text PRIMARY KEY NOT NULL,
	`seen` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `presence_seen_idx` ON `presence` (`seen`);