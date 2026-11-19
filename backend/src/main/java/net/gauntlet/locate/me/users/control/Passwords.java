//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.users.control;

import java.nio.charset.StandardCharsets;
import java.util.UUID;
import io.quarkus.elytron.security.common.BcryptUtil;
import jakarta.enterprise.context.ApplicationScoped;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import net.gauntlet.locate.me.security.AuthErrors;

/**
 * Password policy plus bcrypt hashing and verification.
 *
 * <p>Application scope keeps the dummy hash (used to equalize timing for unknown
 * accounts) computed once instead of on every login attempt.
 *
 * <p>Bcrypt silently truncates input beyond 72 bytes. Passwords that would be
 * truncated are rejected instead, so a long password can never be accepted with
 * a shorter effective value.
 */
@ApplicationScoped
public class Passwords {

    static final int BCRYPT_MAX_BYTES = 72;

    @ConfigProperty(name = "auth.password.min-length", defaultValue = "8")
    int minLength;

    @ConfigProperty(name = "auth.password.max-length", defaultValue = "32")
    int maxLength;

    @ConfigProperty(name = "auth.password.bcrypt-cost", defaultValue = "10")
    int bcryptCost;

    String dummyHash;

    public void validate(String password) {
        if (password == null || password.isBlank()) {
            throw AuthErrors.badRequest("password must not be blank");
        }
        if (password.length() < this.minLength || password.length() > this.maxLength) {
            throw AuthErrors.badRequest("password must be between " + this.minLength
                    + " and " + this.maxLength + " characters");
        }
        if (password.getBytes(StandardCharsets.UTF_8).length > BCRYPT_MAX_BYTES) {
            throw AuthErrors.badRequest("password must not exceed " + BCRYPT_MAX_BYTES + " bytes");
        }
    }

    public String hash(String password) {
        return BcryptUtil.bcryptHash(password, this.bcryptCost);
    }

    public boolean matches(String password, String passwordHash) {
        if (password == null || passwordHash == null) {
            return false;
        }
        return BcryptUtil.matches(password, passwordHash);
    }

    /**
     * A valid hash that never matches a real password, used to spend the same
     * bcrypt time for unknown or unmigrated accounts as for a wrong password.
     */
    public String dummyHash() {
        if (this.dummyHash == null) {
            // A random secret that is never revealed, so the dummy hash cannot be
            // matched even if an attacker learns the implementation.
            this.dummyHash = BcryptUtil.bcryptHash(UUID.randomUUID().toString(), this.bcryptCost);
        }
        return this.dummyHash;
    }
}
