//==============================================================================
// Copyright (c) 2026 g0untlet. All rights reserved.
//==============================================================================
package net.gauntlet.locate.me;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.fields;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.methods;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noConstructors;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noMethods;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.persistence.Converter;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.health.HealthCheck;
import org.eclipse.microprofile.rest.client.inject.RegisterRestClient;

/**
 * Enforces the BCE (Boundary-Control-Entity) architecture on every main class
 * during unit tests. All rules are green against the current codebase; they
 * guard against regressions (stray packages, wrong layer dependencies,
 * misplaced transactions, constructor injection, naming drift, ...).
 *
 * Documented exceptions encoded in the rules:
 *  - {@code DatabaseHealthCheck} is a health check in {@code locator.boundary}
 *    that legitimately uses {@link EntityManager} + {@link Transactional}.
 *  - {@code SystemInfo} is {@link ApplicationScoped} (not {@code @Control}):
 *    it needs application scope for its {@code @Observes StartupEvent} state,
 *    a {@code @Dependent} control would break it.
 *  - {@code net.gauntlet.locate.me.security} is a non-BCE infrastructure
 *    package (rate limiting) and is whitelisted by the component rule.
 *  - Control packages may contain interfaces with only static methods
 *    ({@code DistanceCalculator}, {@code Geoboxing}, ...) and REST client
 *    interfaces, which carry no {@code @Control} annotation.
 */
@AnalyzeClasses(packages = "net.gauntlet.locate.me", importOptions = ImportOption.DoNotIncludeTests.class)
public class BceArchitectureTest {

    /* ------------------------------------------------------------------
       Component structure: every class lives in a BCE layer package of a
       business component, the security infra package, or the root package
       (RestApplication + the Boundary/Control stereotypes).
       ------------------------------------------------------------------ */
    @ArchTest
    public static final ArchRule classes_reside_in_bce_layer_packages = classes()
            .that().resideInAPackage("net.gauntlet.locate.me..")
            .and().doNotHaveSimpleName("RestApplication")
            .and().doNotHaveSimpleName("Boundary")
            .and().doNotHaveSimpleName("Control")
            .and().haveSimpleNameNotStartingWith("package-info")
            .should().resideInAPackage("..locator.boundary")
            .orShould().resideInAPackage("..locator.control")
            .orShould().resideInAPackage("..locator.entity")
            .orShould().resideInAPackage("..aroundme.boundary")
            .orShould().resideInAPackage("..aroundme.control")
            .orShould().resideInAPackage("..aroundme.entity")
            .orShould().resideInAPackage("..system.boundary")
            .orShould().resideInAPackage("..system.control")
            .orShould().resideInAPackage("..system.entity")
            .orShould().resideInAPackage("..security");

    /* ------------------------------------------------------------------
       Layer membership: boundary / control / entity packages only contain
       the matching kind of class.
       ------------------------------------------------------------------ */
    @ArchTest
    public static final ArchRule boundary_classes_are_boundaries = classes()
            .that().resideInAPackage("..boundary..")
            .should().beAnnotatedWith(Boundary.class)
            .orShould().implement(HealthCheck.class);

    @ArchTest
    public static final ArchRule control_classes_are_controls = classes()
            .that().resideInAPackage("..control..")
            .and().areNotMemberClasses()
            .should().beAnnotatedWith(Control.class)
            .orShould().beInterfaces()
            .orShould().beAnnotatedWith(ApplicationScoped.class);

    @ArchTest
    public static final ArchRule entity_classes_are_entities = classes()
            .that().resideInAPackage("..entity..")
            .should().beAnnotatedWith(Entity.class)
            .orShould().beEnums()
            .orShould().beAnnotatedWith(Converter.class);

    /* ------------------------------------------------------------------
       Dependency direction: control never depends on boundary, entity never
       depends on boundary or control.
       ------------------------------------------------------------------ */
    @ArchTest
    public static final ArchRule control_must_not_depend_on_boundary = noClasses()
            .that().resideInAPackage("..control..")
            .should().dependOnClassesThat().resideInAPackage("..boundary..");

    @ArchTest
    public static final ArchRule entity_must_not_depend_on_boundary_or_control = noClasses()
            .that().resideInAPackage("..entity..")
            .should().dependOnClassesThat().resideInAPackage("..boundary..")
            .orShould().dependOnClassesThat().resideInAPackage("..control..");

    /* ------------------------------------------------------------------
       Persistence is encapsulated in the control layer (health check excepted).
       ------------------------------------------------------------------ */
    @ArchTest
    public static final ArchRule entity_manager_only_in_control = fields()
            .that().haveRawType(EntityManager.class)
            .should().beDeclaredInClassesThat().resideInAPackage("..control..")
            .orShould().beDeclaredInClassesThat().implement(HealthCheck.class);

    /* ------------------------------------------------------------------
       Transactions only in the boundary layer.
       ------------------------------------------------------------------ */
    @ArchTest
    public static final ArchRule transactional_only_in_boundary = noMethods()
            .that().areAnnotatedWith(Transactional.class)
            .should().beDeclaredInClassesThat().resideOutsideOfPackage("..boundary..");

    /* ------------------------------------------------------------------
       JAX-RS: boundary verb methods return Response (never JsonObject).
       ------------------------------------------------------------------ */
    @ArchTest
    public static final ArchRule boundary_jaxrs_verb_methods_return_response = methods()
            .that().areAnnotatedWith(GET.class)
            .or().areAnnotatedWith(POST.class)
            .or().areAnnotatedWith(DELETE.class)
            .and().areDeclaredInClassesThat().resideInAPackage("..boundary..")
            .should().haveRawReturnType(Response.class);

    /* ------------------------------------------------------------------
       Dependency injection: no constructor injection (field injection only).
       ------------------------------------------------------------------ */
    @ArchTest
    public static final ArchRule no_constructor_injection = noConstructors()
            .should().beAnnotatedWith(Inject.class);

    /* ------------------------------------------------------------------
       Naming: REST clients end with "Client"; no prohibited class suffixes.
       ------------------------------------------------------------------ */
    @ArchTest
    public static final ArchRule rest_clients_end_with_client = classes()
            .that().areAnnotatedWith(RegisterRestClient.class)
            .should().haveSimpleNameEndingWith("Client");

    @ArchTest
    public static final ArchRule no_prohibited_class_suffixes = classes()
            .that().resideInAPackage("..boundary..")
            .or().resideInAPackage("..control..")
            .or().resideInAPackage("..entity..")
            .or().resideInAPackage("..security")
            .should().haveSimpleNameNotEndingWith("Impl")
            .andShould().haveSimpleNameNotEndingWith("Service")
            .andShould().haveSimpleNameNotEndingWith("Manager")
            .andShould().haveSimpleNameNotEndingWith("Factory")
            .andShould().haveSimpleNameNotEndingWith("Creator")
            .andShould().haveSimpleNameNotEndingWith("Control");
}
