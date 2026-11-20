CREATE TABLE `club_code_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `club_code_attempts_userId_idx` ON `club_code_attempts` (`user_id`);--> statement-breakpoint
CREATE TABLE `mentor_invites` (
	`email` text PRIMARY KEY NOT NULL,
	`added_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`name` text,
	`grade` integer,
	`role` text DEFAULT 'mentee' NOT NULL,
	`club_code_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "profiles_grade_check" CHECK("profiles"."grade" is null or "profiles"."grade" between 9 and 12),
	CONSTRAINT "profiles_role_check" CHECK("profiles"."role" in ('mentee', 'mentor', 'admin'))
);
