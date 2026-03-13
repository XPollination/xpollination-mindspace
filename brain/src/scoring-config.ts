export const SCORING_CONFIG = {
  // Penalties
  supersededByRefinement: 0.7,     // Thought has newer refinement
  supersededByCorrection: 0.5,     // Correction marked this wrong
  supersededByConsolidation: 0.7,  // Consolidated into a summary thought
  keywordEchoFlag: 0.8,           // Contribution-time echo detection
  keywordEchoTopic: 0.3,          // Gardener-confirmed echo (stronger)

  // Boosts (pre-cap — all boosts capped at 1.0)
  correctionCategory: 1.3,        // Correction thoughts
  refinementOfSuperseded: 1.2,    // Refinement replacing bad thought

  // Category-weighted re-ranking (v0.0.2)
  // Final score = vector_similarity × category_weight × flag_penalties
  categoryWeights: {
    correction: 1.4,
    principle: 1.3,
    operational_learning: 1.2,
    decision_record: 1.1,
    design_decision: 1.1,
    task_outcome: 1.0,
    domain_summary: 1.0,
    state_snapshot: 0.7,
    transition_marker: 0.5,
    noise: 0.3,
    uncategorized: 0.6,
  } as Record<string, number>,
};
