/**
 * Post (or update) a reviewable PR comment with ZERODAY ranked findings.
 * Used by .github/actions/zeroday-locate-gate — fail closed on pull_request.
 *
 * @param {{ github: import('@actions/github-script').AsyncFunctionArguments['github'], context: import('@actions/github-script').AsyncFunctionArguments['context'], core: import('@actions/github-script').AsyncFunctionArguments['core'], marker?: string, commentPath?: string }} args
 */
module.exports = async function postPrComment({
  github,
  context,
  core,
  marker = "<!-- zeroday-antares-locate-ci -->",
  commentPath = process.env.COMMENT_PATH,
}) {
  if (!commentPath) {
    throw new Error(
      "COMMENT_PATH is required — refusing to skip PR findings comment on pull_request",
    );
  }
  // CommonJS: executed by actions/github-script, not bundled.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("fs");
  if (!fs.existsSync(commentPath)) {
    throw new Error(
      `comment.md missing at ${commentPath} — fail closed (no silent skip)`,
    );
  }
  const raw = fs.readFileSync(commentPath, "utf8");
  if (
    !raw.includes("Ranked candidate files") &&
    !raw.includes("No vulnerable files submitted") &&
    !raw.includes("**Not scanned**")
  ) {
    throw new Error(
      "comment.md missing ranked-files section — refuse to post incomplete findings comment",
    );
  }
  if (!raw.includes("Human review required")) {
    throw new Error(
      "comment.md missing human-review posture — refuse to post",
    );
  }

  const body = `${marker}\n${raw}`;
  const { owner, repo } = context.repo;
  const issue_number = context.payload.pull_request?.number;
  if (!issue_number) {
    throw new Error(
      "pull_request.number missing — post-comment only runs on pull_request (fail closed)",
    );
  }

  const comments = await github.paginate(github.rest.issues.listComments, {
    owner,
    repo,
    issue_number,
    per_page: 100,
  });
  const existing = comments.find(
    (c) => c.user?.type === "Bot" && c.body?.includes(marker),
  );
  if (existing) {
    await github.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body,
    });
    core.info(`Updated PR comment ${existing.id}`);
    return { action: "updated", commentId: existing.id };
  }
  const created = await github.rest.issues.createComment({
    owner,
    repo,
    issue_number,
    body,
  });
  core.info(`Created PR comment ${created.data.id}`);
  return { action: "created", commentId: created.data.id };
};
