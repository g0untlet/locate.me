--==============================================================================
-- V5__create_users_table.sql
-- Introduces the database-backed user accounts that replace the former
-- allowed.user.ids authorization list. The legacy environment variable is
-- still read once at startup to bootstrap unmigrated accounts, but H2 is the
-- authoritative user store from now on.
--
-- Why user_id_lower exists: the permanent identity is user_id and must keep its
-- exact spelling, because existing business data (positions.user_id) refers to
-- it. Case-insensitive uniqueness and lookup are satisfied by the mirrored
-- lower-cased column instead of rewriting the identifier.
--
-- Why there is no foreign key from positions: positions may legitimately refer
-- to the shared demo user or to users that no longer have an account, so a
-- foreign key would orphan or block existing business data.
--==============================================================================

CREATE TABLE users (
    user_id                VARCHAR(32) NOT NULL,
    user_id_lower          VARCHAR(32) NOT NULL,
    name                   VARCHAR(128),
    email                  VARCHAR(254),
    password_hash          VARCHAR(255),
    status                 VARCHAR(32) NOT NULL,
    failed_login_attempts  INTEGER NOT NULL DEFAULT 0,
    locked_until           TIMESTAMP(6) WITH TIME ZONE,
    last_login_at          TIMESTAMP(6) WITH TIME ZONE,
    created_at             TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    updated_at             TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    entity_version         BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT users_pk PRIMARY KEY (user_id),
    CONSTRAINT users_user_id_lower_uq UNIQUE (user_id_lower),
    CONSTRAINT users_email_uq UNIQUE (email)
);

CREATE TABLE user_roles (
    user_id VARCHAR(32) NOT NULL,
    role    VARCHAR(32) NOT NULL,
    CONSTRAINT user_roles_pk PRIMARY KEY (user_id, role),
    CONSTRAINT user_roles_user_fk FOREIGN KEY (user_id)
        REFERENCES users (user_id) ON DELETE CASCADE
);
