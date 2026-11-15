CREATE TABLE `publications` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`owner` text NOT NULL,
	`platform` text NOT NULL,
	`status` text NOT NULL,
	`remote_id` text,
	`url` text,
	`external_likes` integer DEFAULT 0 NOT NULL,
	`external_views` integer DEFAULT 0 NOT NULL,
	`synced_at` integer,
	`message` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `social_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`profile_key` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `watches` (
	`user_id` text NOT NULL,
	`reel_id` text NOT NULL,
	`category` text NOT NULL,
	`channel` text NOT NULL,
	`seconds` integer DEFAULT 0 NOT NULL,
	`completions` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `reel_id`)
);
