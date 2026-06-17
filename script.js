/**
 * SIMULATEUR FRAIS DE CRÈCHE
 * Calcul des coûts de garde en crèche publique et privée
 * avec estimation des aides CAF et crédit d'impôt
 */

// =============================================================================
// CONFIGURATION - Paramètres facilement modifiables
// =============================================================================

const CONFIG = {
    // Nombre de mois de garde par an (moyenne avec congés)
    MOIS_GARDE_PAR_AN: 11,

    // Heures de garde par jour (base de calcul PSU)
    HEURES_PAR_JOUR: 10,

    // Jours de garde par mois (moyenne)
    JOURS_PAR_MOIS: 20,

    // Crédit d'impôt
    CREDIT_IMPOT: {
        TAUX: 0.5,                    // 50% des dépenses
        PLAFOND_DEPENSES_AN: 3500,    // Plafond des dépenses par enfant par an
        CREDIT_MAX_AN: 1750           // Crédit maximum par enfant par an
    },

    // Crèche privée - Coûts mensuels moyens (base 5 jours)
    CRECHE_PRIVEE: {
        COUT_MENSUEL_IDF: 1500,       // Île-de-France
        COUT_MENSUEL_PROVINCE: 1200   // Hors Île-de-France
    },

    // Barème PSU (Prestation de Service Unique) - Crèche publique
    // Taux horaire = (Revenus annuels / 12) × Taux d'effort
    // Le taux d'effort dépend du nombre d'enfants
    PSU: {
        // Taux d'effort par nombre d'enfants (en %)
        TAUX_EFFORT: {
            1: 0.0619,    // 1 enfant : 6,19%
            2: 0.0516,    // 2 enfants : 5,16%
            3: 0.0413,    // 3 enfants : 4,13%
            4: 0.0310,    // 4 enfants et + : 3,10%
        },
        // Plancher de ressources (revenus minimums considérés)
        PLANCHER_REVENUS_ANNUEL: 7500,
        // Plafond de ressources pour le calcul
        PLAFOND_REVENUS_ANNUEL: 72000
    },

    // CMG (Complément de libre choix du Mode de Garde) - Crèche privée
    // Montants mensuels maximum selon les revenus et le nombre d'enfants
    CMG: {
        // Plafonds de revenus annuels par tranche et nombre d'enfants
        // Format: { nombreEnfants: [plafond1, plafond2] }
        PLAFONDS_REVENUS: {
            1: [23323, 51840],
            2: [26603, 59138],
            3: [29883, 66436],
            4: [33163, 73734]
        },
        // Montants d'aide mensuelle par tranche (enfant de moins de 3 ans)
        // Tranche 1 = revenus les plus bas, Tranche 3 = revenus les plus hauts
        MONTANTS: {
            TRANCHE_1: 723.09,
            TRANCHE_2: 578.47,
            TRANCHE_3: 433.86
        },
        // Reste à charge minimum (15% des dépenses)
        RESTE_CHARGE_MIN_POURCENT: 0.15
    }
};

// =============================================================================
// ÉTAT DE L'APPLICATION
// =============================================================================

const state = {
    revenuMensuel: 0,
    revenuAnnuel: 0,
    nombreEnfants: 1,
    joursGarde: 5,
    zone: 'province'  // 'idf' ou 'province'
};

// =============================================================================
// FONCTIONS DE CALCUL
// =============================================================================

/**
 * Calcule le coût de la crèche publique (barème PSU)
 * Le tarif PSU intègre déjà les aides CAF
 */
function calculerCrechePublique() {
    const { revenuAnnuel, nombreEnfants, joursGarde } = state;

    if (revenuAnnuel <= 0) {
        return { coutMois: 0, coutAn: 0, resteApresCreditMois: 0, resteApresCreditAn: 0 };
    }

    // Appliquer le plancher et plafond de revenus
    const revenusPriseEnCompte = Math.max(
        CONFIG.PSU.PLANCHER_REVENUS_ANNUEL,
        Math.min(revenuAnnuel, CONFIG.PSU.PLAFOND_REVENUS_ANNUEL)
    );

    // Obtenir le taux d'effort selon le nombre d'enfants
    const tauxEffort = CONFIG.PSU.TAUX_EFFORT[Math.min(nombreEnfants, 4)];

    // Calcul du taux horaire PSU
    // Formule : (Revenus annuels × Taux d'effort) / 100 / 12 mois
    const tauxHoraire = (revenusPriseEnCompte * tauxEffort) / 100 / 12;

    // Heures de garde par mois selon le nombre de jours
    const heuresParMois = CONFIG.HEURES_PAR_JOUR * CONFIG.JOURS_PAR_MOIS * (joursGarde / 5);

    // Coût mensuel
    const coutMois = tauxHoraire * heuresParMois;
    const coutAn = coutMois * CONFIG.MOIS_GARDE_PAR_AN;

    // Crédit d'impôt (sur le reste à charge, qui est le coût total en crèche publique)
    const creditImpotAn = calculerCreditImpot(coutAn);
    const resteApresCreditAn = coutAn - creditImpotAn;
    const resteApresCreditMois = resteApresCreditAn / CONFIG.MOIS_GARDE_PAR_AN;

    return {
        coutMois: Math.round(coutMois),
        coutAn: Math.round(coutAn),
        resteApresCreditMois: Math.round(resteApresCreditMois),
        resteApresCreditAn: Math.round(resteApresCreditAn)
    };
}

/**
 * Calcule le coût de la crèche privée avec CMG
 */
function calculerCrechePrivee() {
    const { revenuAnnuel, nombreEnfants, joursGarde, zone } = state;

    // Coût brut selon la zone (proratisé selon les jours)
    const coutBase = zone === 'idf'
        ? CONFIG.CRECHE_PRIVEE.COUT_MENSUEL_IDF
        : CONFIG.CRECHE_PRIVEE.COUT_MENSUEL_PROVINCE;

    const coutMois = coutBase * (joursGarde / 5);
    const coutAn = coutMois * CONFIG.MOIS_GARDE_PAR_AN;

    if (revenuAnnuel <= 0) {
        return {
            coutMois: Math.round(coutMois),
            coutAn: Math.round(coutAn),
            aideMois: 0,
            aideAn: 0,
            resteMois: Math.round(coutMois),
            resteAn: Math.round(coutAn),
            resteApresCreditMois: 0,
            resteApresCreditAn: 0
        };
    }

    // Calcul du CMG
    const aideMensuelle = calculerCMG(revenuAnnuel, nombreEnfants, coutMois);
    const aideMois = aideMensuelle * (joursGarde / 5);
    const aideAn = aideMois * CONFIG.MOIS_GARDE_PAR_AN;

    // Reste à charge avant crédit d'impôt
    const resteMois = Math.max(0, coutMois - aideMois);
    const resteAn = resteMois * CONFIG.MOIS_GARDE_PAR_AN;

    // Crédit d'impôt (calculé sur le reste à charge uniquement)
    const creditImpotAn = calculerCreditImpot(resteAn);
    const resteApresCreditAn = resteAn - creditImpotAn;
    const resteApresCreditMois = resteApresCreditAn / CONFIG.MOIS_GARDE_PAR_AN;

    return {
        coutMois: Math.round(coutMois),
        coutAn: Math.round(coutAn),
        aideMois: Math.round(aideMois),
        aideAn: Math.round(aideAn),
        resteMois: Math.round(resteMois),
        resteAn: Math.round(resteAn),
        resteApresCreditMois: Math.round(resteApresCreditMois),
        resteApresCreditAn: Math.round(resteApresCreditAn)
    };
}

/**
 * Calcule le CMG (Complément de libre choix du Mode de Garde)
 */
function calculerCMG(revenuAnnuel, nombreEnfants, coutMensuel) {
    const nbEnfantsIndex = Math.min(nombreEnfants, 4);
    const plafonds = CONFIG.CMG.PLAFONDS_REVENUS[nbEnfantsIndex];

    // Déterminer la tranche de revenus
    let montantAide;
    if (revenuAnnuel <= plafonds[0]) {
        montantAide = CONFIG.CMG.MONTANTS.TRANCHE_1;
    } else if (revenuAnnuel <= plafonds[1]) {
        montantAide = CONFIG.CMG.MONTANTS.TRANCHE_2;
    } else {
        montantAide = CONFIG.CMG.MONTANTS.TRANCHE_3;
    }

    // Le CMG ne peut pas dépasser 85% des dépenses
    const maxAide = coutMensuel * (1 - CONFIG.CMG.RESTE_CHARGE_MIN_POURCENT);

    return Math.min(montantAide, maxAide);
}

/**
 * Calcule le crédit d'impôt pour frais de garde
 */
function calculerCreditImpot(depensesAnnuelles) {
    // Plafond des dépenses éligibles
    const depensesEligibles = Math.min(
        depensesAnnuelles,
        CONFIG.CREDIT_IMPOT.PLAFOND_DEPENSES_AN
    );

    // Crédit = 50% des dépenses, plafonné
    const credit = depensesEligibles * CONFIG.CREDIT_IMPOT.TAUX;

    return Math.min(credit, CONFIG.CREDIT_IMPOT.CREDIT_MAX_AN);
}

// =============================================================================
// FONCTIONS D'AFFICHAGE
// =============================================================================

/**
 * Formate un nombre en euros
 */
function formatMontant(montant) {
    if (isNaN(montant) || montant === 0) return '--';
    return new Intl.NumberFormat('fr-FR').format(montant);
}

/**
 * Met à jour l'affichage des résultats
 */
function mettreAJourResultats() {
    const publicResult = calculerCrechePublique();
    const priveResult = calculerCrechePrivee();

    // Crèche publique
    document.getElementById('public-cout-mois').textContent = formatMontant(publicResult.coutMois);
    document.getElementById('public-cout-an').textContent = formatMontant(publicResult.coutAn);
    document.getElementById('public-reste-mois').textContent = formatMontant(publicResult.coutMois);
    document.getElementById('public-reste-an').textContent = formatMontant(publicResult.coutAn);
    document.getElementById('public-apres-impot-mois').textContent = formatMontant(publicResult.resteApresCreditMois);
    document.getElementById('public-apres-impot-an').textContent = formatMontant(publicResult.resteApresCreditAn);

    // Crèche privée
    document.getElementById('prive-cout-mois').textContent = formatMontant(priveResult.coutMois);
    document.getElementById('prive-cout-an').textContent = formatMontant(priveResult.coutAn);
    document.getElementById('prive-aide-mois').textContent = formatMontant(priveResult.aideMois);
    document.getElementById('prive-aide-an').textContent = formatMontant(priveResult.aideAn);
    document.getElementById('prive-reste-mois').textContent = formatMontant(priveResult.resteMois);
    document.getElementById('prive-reste-an').textContent = formatMontant(priveResult.resteAn);
    document.getElementById('prive-apres-impot-mois').textContent = formatMontant(priveResult.resteApresCreditMois);
    document.getElementById('prive-apres-impot-an').textContent = formatMontant(priveResult.resteApresCreditAn);

    // Comparaison
    mettreAJourComparaison(publicResult, priveResult);
}

/**
 * Met à jour le texte de comparaison
 */
function mettreAJourComparaison(publicResult, priveResult) {
    const comparisonText = document.getElementById('comparison-text');

    if (state.revenuAnnuel <= 0) {
        comparisonText.textContent = 'Renseignez vos informations pour voir la comparaison';
        return;
    }

    const diffMois = priveResult.resteApresCreditMois - publicResult.resteApresCreditMois;
    const diffAn = priveResult.resteApresCreditAn - publicResult.resteApresCreditAn;

    if (diffMois > 0) {
        comparisonText.innerHTML = `La <strong>crèche publique</strong> est plus avantageuse de <strong>${formatMontant(Math.abs(diffMois))} €/mois</strong> (${formatMontant(Math.abs(diffAn))} €/an)`;
    } else if (diffMois < 0) {
        comparisonText.innerHTML = `La <strong>crèche privée</strong> est plus avantageuse de <strong>${formatMontant(Math.abs(diffMois))} €/mois</strong> (${formatMontant(Math.abs(diffAn))} €/an)`;
    } else {
        comparisonText.innerHTML = 'Les deux options sont équivalentes en termes de coût';
    }
}

// =============================================================================
// GESTION DES ÉVÉNEMENTS
// =============================================================================

/**
 * Parse un montant depuis une chaîne (gère les espaces et virgules)
 */
function parseMontant(str) {
    if (!str) return 0;
    // Supprime les espaces et remplace la virgule par un point
    const cleaned = str.replace(/\s/g, '').replace(',', '.');
    const value = parseFloat(cleaned);
    return isNaN(value) ? 0 : value;
}

/**
 * Formate un nombre pour l'affichage dans un input
 */
function formatInputMontant(value) {
    if (!value || value === 0) return '';
    return new Intl.NumberFormat('fr-FR').format(Math.round(value));
}

/**
 * Initialise les écouteurs d'événements
 */
function initEventListeners() {
    // Revenus
    const revenuMensuelInput = document.getElementById('revenu-mensuel');
    const revenuAnnuelInput = document.getElementById('revenu-annuel');

    let isUpdating = false;

    revenuMensuelInput.addEventListener('input', (e) => {
        if (isUpdating) return;
        isUpdating = true;

        const mensuel = parseMontant(e.target.value);
        state.revenuMensuel = mensuel;
        state.revenuAnnuel = mensuel * 12;

        // Met à jour le champ annuel
        revenuAnnuelInput.value = mensuel > 0 ? formatInputMontant(state.revenuAnnuel) : '';

        mettreAJourResultats();
        isUpdating = false;
    });

    revenuAnnuelInput.addEventListener('input', (e) => {
        if (isUpdating) return;
        isUpdating = true;

        const annuel = parseMontant(e.target.value);
        state.revenuAnnuel = annuel;
        state.revenuMensuel = annuel / 12;

        // Met à jour le champ mensuel
        revenuMensuelInput.value = annuel > 0 ? formatInputMontant(state.revenuMensuel) : '';

        mettreAJourResultats();
        isUpdating = false;
    });

    // Nombre d'enfants
    const enfantsValue = document.getElementById('enfants-value');
    const enfantsMinus = document.getElementById('enfants-minus');
    const enfantsPlus = document.getElementById('enfants-plus');

    enfantsMinus.addEventListener('click', () => {
        if (state.nombreEnfants > 1) {
            state.nombreEnfants--;
            enfantsValue.textContent = state.nombreEnfants;
            mettreAJourResultats();
        }
    });

    enfantsPlus.addEventListener('click', () => {
        if (state.nombreEnfants < 10) {
            state.nombreEnfants++;
            enfantsValue.textContent = state.nombreEnfants;
            mettreAJourResultats();
        }
    });

    // Jours de garde
    const dayButtons = document.querySelectorAll('.day-btn');
    dayButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            dayButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.joursGarde = parseInt(btn.dataset.days, 10);
            mettreAJourResultats();
        });
    });

    // Zone géographique
    const zoneButtons = document.querySelectorAll('.zone-btn');
    zoneButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            zoneButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.zone = btn.dataset.zone;
            mettreAJourResultats();
        });
    });
}

// =============================================================================
// INITIALISATION
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    mettreAJourResultats();
});
