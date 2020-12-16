import { Committer } from 'changelog-flow/libs/git-manager/committer.class';
import { UncommittedChecker } from 'changelog-flow/libs/git-manager/uncommitted-checker.class';
import { COMMIT_CHANGED_SEPARATELY } from 'changelog-flow/questions/git/commit-changed-separately.constant';
import { questionMaker } from 'changelog-flow/questions/question-maker.function';

export async function handleUncommittedChanges(): Promise<void> {
  const files = await new UncommittedChecker().exist();
  if (!files.uncommitted.length && !files.untracked.length)
    return;

  const commitSeparately = await questionMaker(COMMIT_CHANGED_SEPARATELY);

  if (commitSeparately.choice)
    await new Committer(files).commit();
}
