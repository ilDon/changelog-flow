import { ReleaseBranchCreator } from 'changelog-flow/libs/flow//release-branch-creator.class';
import { BranchCloser } from 'changelog-flow/libs/git-manager/branch-closer.class';
import { Committer } from 'changelog-flow/libs/git-manager/committer.class';
import { DIRS } from 'changelog-flow/libs/paths/dirs.constant';
import { handleUncommittedChanges } from 'changelog-flow/processes/common-ops/handle-uncommitted-changes.function';
import { StepsHandler } from 'changelog-flow/processes/releases/creator/steps/steps-handler.class';
import { ChangesStorer } from 'changelog-flow/processes/releases/creator/storer/changes-storer.class';
import { ChangeDetails, ChangeItems } from 'changelog-flow/processes/releases/creator/storer/deafult-contents.constant';
import { VersionPreparator } from 'changelog-flow/processes/releases/creator/storer/version-preparator.class';
import { UpdateVersion } from 'changelog-flow/processes/releases/creator/versioning/update-version.class';
import { TempLogsGetter } from 'changelog-flow/processes/stash-logs/temp-logs-getter.class';
import { MdMaker } from 'changelog-flow/renderers/mark-down/md-maker.class';
import { readJSONSync } from 'fs-extra';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs/yargs';

const argv = yargs(hideBin(process.argv)).argv;

export class NewReleaseMaker {

  private newChanges: Array<ChangeItems>;
  private changeDetails: ChangeDetails;

  public async init(): Promise<void> {

    if (!argv.sg)
      await handleUncommittedChanges();

    await this.bumpVersion();

    setTimeout(() => this.postVersionUpdate(), 2000);

  }

  private async postVersionUpdate(): Promise<void> {
    await this.handleGitFlow();

    await this.handleTempLogs();

    await this.askChangesDetails();
    this.makeChangeDetailsObject();
    this.storeInJson();
    this.renderMd();

    if (!argv.sg)
      await this.commitNewVersion();
  }

  private async handleGitFlow(): Promise<void> {
    if (argv.sg || argv.sf || process.env.TESTING)
      return;

    await new BranchCloser('feature', 'develop', true).close();
    await new ReleaseBranchCreator().create();
  }

  private async handleTempLogs(): Promise<void> {
    this.newChanges = await new TempLogsGetter().get();
  }

  private async bumpVersion(): Promise<void> {
    await new UpdateVersion().do();
  }

  private async askChangesDetails(): Promise<void> {
    const newlyAdded = await new StepsHandler(this.newChanges.length).start() as Array<ChangeItems>;
    newlyAdded.forEach(change => this.newChanges.push(change));
  }

  private makeChangeDetailsObject(): void {
    this.changeDetails = new VersionPreparator(this.newChanges).make();
  }

  private storeInJson(): void {
    new ChangesStorer(this.changeDetails).storeChanges();
  }

  private renderMd(): void {
    new MdMaker().make();
  }

  private async commitNewVersion(): Promise<void> {
    const packageInfo = readJSONSync(DIRS.packageJsonPath);
    await new Committer(undefined, `Version ${packageInfo.version}`).commit();
  }

}
