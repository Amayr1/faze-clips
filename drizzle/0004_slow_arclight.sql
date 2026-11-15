CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`clip_id` text NOT NULL,
	`owner` text NOT NULL,
	`author` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `comments_clip_created_idx` ON `comments` (`clip_id`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `comments_owner_created_idx` ON `comments` (`owner`,`created_at`);--> statement-breakpoint
ALTER TABLE `posts` ADD `stream_url` text;