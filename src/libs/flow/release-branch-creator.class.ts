import { FlowBase } from 'changelog-flow/libs/flow//flow-base.class';
import { DIRS } from 'changelog-flow/libs/paths/dirs.constant';
import { readJSONSync } from 'fs-extra';
export class ReleaseBranchCreator extends FlowBase {

  private packageInfo;
  private branchName: string;

  public async create(): Promise<void> {
    this.init();
    this.getPackageInfo();
    this.setBranchName();
    console.log(`\Creating branch ${this.branchName}\n`);
    await this.createBranch(this.branchName);
    await this.pushCurrent();
  }

  private getPackageInfo(): void {
    this.packageInfo = readJSONSync(DIRS.packageJsonPath);
  }

  private setBranchName(): void {
    this.branchName = `release/${this.packageInfo.version}`;
  }

}
