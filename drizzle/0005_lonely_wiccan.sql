CREATE TABLE `fan_events` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`kind` text NOT NULL,
	`item` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `fan_events_owner_created_idx` ON `fan_events` (`owner`,`created_at`);--> statement-breakpoint
CREATE TABLE `fan_profiles` (
	`owner` text PRIMARY KEY NOT NULL,
	`audience` text DEFAULT 'exploring' NOT NULL,
	`saved_eras` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `partner_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`company` text NOT NULL,
	`email` text NOT NULL,
	`message` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `partner_requests_owner_created_idx` ON `partner_requests` (`owner`,`created_at`);--> statement-breakpoint
ALTER TABLE `posts` ADD `source_url` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `challenge_id` text;