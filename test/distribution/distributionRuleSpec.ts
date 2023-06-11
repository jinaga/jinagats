import { DistributionEngine } from "../../src/distribution/distribution-engine";
import { DistributionRules } from "../../src/distribution/distribution-rules";
import { Dehydration } from "../../src/fact/hydrate";
import { MemoryStore } from "../../src/memory/memory-store";
import { User } from "../../src/model/user";
import { Blog, Post, Publish, model } from "../blogModel";

describe("distribution rules", () => {
  const engine = givenDistributionEngine(r => r
    .everyone(model.given(Blog).match((blog, facts) =>
      facts.ofType(Publish)
        .join(publish => publish.post.blog, blog)
    ))
    .everyone(model.given(Blog).match((blog, facts) =>
      facts.ofType(Post)
        .join(post => post.blog, blog)
        .exists(post => facts.ofType(Publish)
          .join(publish => publish.post, post)
        )
    ))
    .only(model.given(Blog).match((blog, facts) =>
      facts.ofType(Post)
        .join(post => post.blog, blog)
      ),
      model.given(Blog).match((blog, facts) =>
        facts.ofType(User)
          .join(user => user, blog.creator)
      )
    )
  );
  
  const creator = new User("creator");
  const reader = new User("reader");
  const blog = new Blog(creator, "domain");
  
  const dehydration = new Dehydration();
  const creatorReference = dehydration.dehydrate(creator);
  const readerReference = dehydration.dehydrate(reader);
  const blogReference = dehydration.dehydrate(blog);
  
  it("should prevent public access to unpublished posts", async () => {
    const specification = model.given(Blog).match((blog, facts) =>
      facts.ofType(Post)
        .join(post => post.blog, blog)
    ).specification;

    const assessment = await engine.assess(specification, [blogReference], null);
    expect(assessment).toStrictEqual({
      outcome: "deny",
      reason: "An unauthenticated user cannot follow successor of Blog Post.blog without " +
        "the condition that Post Publish.post exists."
    });
  });

  it("should permit public access to publications", async () => {
    const specification = model.given(Blog).match((blog, facts) =>
      facts.ofType(Publish)
        .join(publish => publish.post.blog, blog)
    ).specification;

    const assessment = await engine.assess(specification, [blogReference], null);
    expect(assessment).toStrictEqual({
      outcome: "permit"
    });
  });

  it("should permit public access to published posts", async () => {
    const specification = model.given(Blog).match((blog, facts) =>
      facts.ofType(Post)
        .join(post => post.blog, blog)
        .exists(post => facts.ofType(Publish)
          .join(publish => publish.post, post)
        )
    ).specification;

    const assessment = await engine.assess(specification, [blogReference], null);
    expect(assessment).toStrictEqual({
      outcome: "permit"
    });
  });

  it("should permit the creator to access all posts", async () => {
    const specification = model.given(Blog).match((blog, facts) =>
      facts.ofType(Post)
        .join(post => post.blog, blog)
    ).specification;

    const assessment = await engine.assess(specification, [blogReference], creatorReference);
    expect(assessment).toStrictEqual({
      outcome: "permit"
    });
  });

  it("should not permit a reader to access all posts", async () => {
    const specification = model.given(Blog).match((blog, facts) =>
      facts.ofType(Post)
        .join(post => post.blog, blog)
    ).specification;

    const assessment = await engine.assess(specification, [blogReference], readerReference);
    expect(assessment).toStrictEqual({
      outcome: "deny",
      reason: "This user cannot follow successor of Blog Post.blog without " +
        "the condition that Post Publish.post exists."
    });
  });

  it("should permit reader to access publications", async () => {
    const specification = model.given(Blog).match((blog, facts) =>
      facts.ofType(Publish)
        .join(publish => publish.post.blog, blog)
    ).specification;

    const assessment = await engine.assess(specification, [blogReference], readerReference);
    expect(assessment).toStrictEqual({
      outcome: "permit"
    });
  });

  it("should permit reader to access published posts", async () => {
    const specification = model.given(Blog).match((blog, facts) =>
      facts.ofType(Post)
        .join(post => post.blog, blog)
        .exists(post => facts.ofType(Publish)
          .join(publish => publish.post, post)
        )
    ).specification;

    const assessment = await engine.assess(specification, [blogReference], readerReference);
    expect(assessment).toStrictEqual({
      outcome: "permit"
    });
  });
});

function givenDistributionEngine(rules: (r: DistributionRules) => DistributionRules) {
  const distributionRules = rules(new DistributionRules([]));
  const memory = new MemoryStore();
  const engine = new DistributionEngine(distributionRules, memory);
  return engine;
}