# @microsoft/api-extractor


![API Extractor](https://github.com/Microsoft/web-build-tools/raw/master/common/wiki-images/api-extractor-title.png?raw=true)
<br />
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; https://aka.ms/extractor

<!-- ----------------------------------------------------------------------------------- -->
<!-- Text below this line should stay in sync with API-Extractor.md from the GitHub wiki -->
<!-- ----------------------------------------------------------------------------------- -->

**API Extractor** helps you build better [TypeScript](https://www.typescriptlang.org/) library packages.  Suppose for example that your company has published an NPM package called "**awesome-widgets**" that exports many classes and interfaces.  As developers start to depend on your library, you may encounter issues such as...

- **Accidental breaks:**  People keep reporting that their code won't compile after a supposedly "minor" update.  To address this, you boldly propose that every **awesome-widgets** pull request must be approved by an experienced developer from your team.  But that proves unrealistic -- nobody has time to look at every single PR!  What you really need is a way to detect PRs that change API contracts, and flag them for review.  That would focus attention in the right place... but how to do that?

- **Missing exports:** Suppose the **awesome-widgets** package exports an API function `AwesomeButton.draw()` that requires a parameter of type `DrawStyle`, but you forgot to export this enum.  Things seem fine at first, but when a developer tries to call that function, they discover that there's no way to specify the `DrawStyle`.  How to avoid these oversights?

- **Accidental exports:** You meant for your `DrawHelper` class to be kept internal, but one day you realize it's a package export.  When you try to remove it, consumers complain that they are using it.  How do we avoid this in the future?

- **Alpha/Beta graduation:**  You want to release previews of new APIs that are not ready for prime time yet.  But if you did a major SemVer bump every time you change these definitions, the villagers would be after you with torches and pitchforks!  A better approach is to designate certain classes/members as **alpha** quality, then promote them to **beta** and finally to **public** when they're mature.  But how to indicate this to your consumers?  (And how to detect scoping mistakes?  A **public** function should never return a **beta** result.)

- **\*.d.ts rollup:** You webpacked your library into a nice **\*.js** bundle file -- so why are you distributing your typings as a messy tree of **lib/\*.d.ts** files full of private definitions?  Let's consolidate them into a tidy **\*.d.ts** rollup file.  If you publish internal/beta/public releases, a semantic analyzer can trim the **\*.d.ts** rollup according to each release type.  Developers working on a production project don't want to see a bunch of **internal** and **beta** members in their VS Code IntelliSense!

- **Online documentation:**  You have faithfully annotated each TypeScript member with nice [JSDoc](http://usejsdoc.org/) descriptions.  Now that your library is published, you should probably set up [a nicely formatted](https://docs.microsoft.com/en-us/javascript/api/sp-http) API reference.  Which tool should we use to generate that?  (What!?  There aren't any good ones!?)

**API Extractor** provides an integrated, professional-quality solution for all these problems.  It is invoked at build time by your toolchain and leverages the TypeScript compiler engine to:

- Detect a project's exported API surface
- Capture the contracts in a concise report designed to facilitate review
- Warn about common mistakes (e.g. missing exports, inconsistent visibility, etc.)
- Generate \*.d.ts rollups
- Output API documentation in a portable format that's easy to integrate with your publishing pipeline

Best of all, **API Extractor** is free and open source.  Join the community and create a pull request!

<!-- ----------------------------------------------------------------------------------- -->
<!-- Text above this line should stay in sync with API-Extractor.md from the GitHub wiki -->
<!-- ----------------------------------------------------------------------------------- -->

# Getting Started

The GitHub wiki has complete, up-to-date documentation: https://aka.ms/extractor
