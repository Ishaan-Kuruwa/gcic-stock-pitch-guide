CREATE TABLE `team_code_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `team_code_attempts_userId_idx` ON `team_code_attempts` (`user_id`);--> statement-breakpoint
CREATE TABLE `team_links` (
	`team_id` text NOT NULL,
	`kind` text NOT NULL,
	`url` text NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`team_id`, `kind`),
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "team_links_kind_check" CHECK("team_links"."kind" in ('report', 'slides', 'financials', 'comps', 'video'))
);
--> statement-breakpoint
CREATE TABLE `team_members` (
	`team_id` text NOT NULL,
	`user_id` text PRIMARY KEY NOT NULL,
	`joined_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `team_members_teamId_idx` ON `team_members` (`team_id`);--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`join_code` text NOT NULL,
	`company` text,
	`ticker` text,
	`mentorship_status` text DEFAULT 'self-guided' NOT NULL,
	`mentor_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`mentor_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "teams_mentorship_status_check" CHECK("teams"."mentorship_status" in ('self-guided', 'applied', 'mentored', 'declined'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teams_join_code_unique` ON `teams` (`join_code`);