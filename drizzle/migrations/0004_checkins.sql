CREATE TABLE `checkins` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`mentor_id` text,
	`met_on` text NOT NULL,
	`covered` text NOT NULL,
	`next_step` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mentor_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "checkins_status_check" CHECK("checkins"."status" in ('on-track', 'behind', 'stuck')),
	CONSTRAINT "checkins_covered_check" CHECK(length("checkins"."covered") between 1 and 1000),
	CONSTRAINT "checkins_next_step_check" CHECK(length("checkins"."next_step") <= 500),
	CONSTRAINT "checkins_met_on_check" CHECK("checkins"."met_on" glob '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
);
--> statement-breakpoint
CREATE INDEX `checkins_team_idx` ON `checkins` (`team_id`,`met_on`);