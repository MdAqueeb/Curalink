export interface RankingWeights {
  bm25: number;
  semantic: number;
  recency: number;
  credibility: number;
}

export const rankingWeights: RankingWeights = {
  bm25: 0.25,
  semantic: 0.4,
  recency: 0.2,
  credibility: 0.15,
};
