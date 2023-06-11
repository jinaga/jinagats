import { Blog, Post, model } from "../blogModel";
import { DistributionRules } from "../../src/distribution/distribution-rules";
import { DistributionEngine } from "../../src/distribution/distribution-engine";
import { MemoryStore } from "../../src/memory/memory-store";
import { FactReference } from "../../src/storage";

describe("distribution rules", () => {
  it("should prevent public access to unpublished posts", async () => {
    const specification = model.given(Blog).match((blog, facts) =>
      facts.ofType(Post)
        .join(post => post.blog, blog)
    ).specification;
    const distributionRules = new DistributionRules();
    const memory = new MemoryStore();
    const engine = new DistributionEngine(distributionRules, memory);

    const assessment = await engine.assess(specification, null);
    expect(assessment).toBe({
      outcome: "deny",
      reason: "An unauthenticated user cannot follow successor of Blog Post.blog."
    });
  });
});