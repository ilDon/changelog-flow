import { FlowBase } from '@bohr/changelogger/libs/flow//flow-base.class';
import { DIRS } from '@bohr/changelogger/libs/paths/dirs.constant';
import * as fs from 'fs-extra';
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
    this.packageInfo = fs.readJSONSync(DIRS.packageJsonPath);
  }

  private setBranchName(): void {
    this.branchName = `release/${this.packageInfo.version}`;
  }

}
