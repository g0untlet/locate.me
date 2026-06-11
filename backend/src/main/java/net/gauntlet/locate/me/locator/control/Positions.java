//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me.locator.control;

import java.util.List;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import net.gauntlet.locate.me.Control;
import net.gauntlet.locate.me.locator.entity.Position;

@Control
public class Positions {

    static final System.Logger LOG = System.getLogger(Positions.class.getName());

    @Inject
    EntityManager em;

    public Position create(Position position) {
        LOG.log(System.Logger.Level.DEBUG, "Creating position for user {0}", position.userId());
        this.em.persist(position);
        return position;
    }

    public void delete(Long id) {
        LOG.log(System.Logger.Level.DEBUG, "Deleting position with id {0}", id);
        Position position = this.em.find(Position.class, id);
        if (position != null) {
            this.em.remove(position);
        }
    }

    public List<Position> findByUserId(String userId) {
        LOG.log(System.Logger.Level.DEBUG, "Finding positions for user {0}", userId);
        return this.em.createQuery("SELECT p FROM Position p WHERE p.userId = :userId ORDER BY p.timestamp DESC", Position.class)
                .setParameter("userId", userId)
                .getResultList();
    }

    public List<Position> findAll() {
        LOG.log(System.Logger.Level.DEBUG, "Finding all positions");
        return this.em.createQuery("SELECT p FROM Position p ORDER BY p.timestamp DESC", Position.class)
                .getResultList();
    }
}
