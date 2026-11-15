CREATE TABLE `publisher_profiles` (
	`provider` text NOT NULL,
	`user_id` text NOT NULL,
	`profile_id` text NOT NULL,
	PRIMARY KEY(`provider`, `user_id`)
);
--> statement-breakpoint
ALTER TABLE `publications` ADD `provider` text;--> statement-breakpoint
ALTER TABLE `publications` ADD `last_checked_at` integer;