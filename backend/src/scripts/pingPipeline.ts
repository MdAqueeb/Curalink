import { connectDB } from "../config/db.js";
import { runResearchPipeline } from "../services/pipeline.js";

async function main() {
  const message = process.argv.slice(2).join(" ") || "Latest treatments for Parkinson's disease";
  console.log(`\n>>> Running pipeline for: "${message}"\n`);

  await connectDB();
  const { response } = await runResearchPipeline({ input: { message } });

  console.log("Condition overview:", JSON.stringify(response.conditionOverview, null, 2));
  console.log(`\nInsights: ${response.researchInsights.length}`);
  for (const ins of response.researchInsights.slice(0, 5)) {
    console.log(`  • [${ins.confidence}] ${ins.claim} (refs: ${ins.sourceRefs.length})`);
  }
  console.log(`\nClinical trials: ${response.clinicalTrials.length}`);
  console.log(`Sources: ${response.sources.length}`);
  console.log(`\nMetadata:`, response.metadata);

  process.exit(0);
}

main().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
