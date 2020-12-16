import { UpdateTypes } from 'changelog-flow/processes/releases/creator/versioning/update-types.enum';
import { questionMaker } from 'changelog-flow/questions/question-maker.function';
import { UPDATE_TYPES } from 'changelog-flow/questions/update-type/update-type.constant';
import * as cmd from 'node-cmd';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs/yargs';

const argv = yargs(hideBin(process.argv)).argv;

export class UpdateVersion {

  private noGitTag = '--no-git-tag-version ';
  private baseCommand = 'version ';
  private command = '';
  private updateType: UpdateTypes;

  public async do(): Promise<void> {
    this.getUpdateType();

    if (!this.updateType)
      await this.askForUpdateType();

    console.log(`\nUpdate type: ${this.updateType}\n`);

    this.setCommand();
    await this.doUpdate();
  }

  private getUpdateType(): void {
    this.updateType = argv.p ? UpdateTypes.p : argv.f ? UpdateTypes.f : argv.m ? UpdateTypes.m : undefined;
  }

  private setCommand(): void {
    if (process.env.TESTING)
      this.command += 'cd testfiles && ';
    this.command += 'npm ';
    this.command += this.noGitTag;
    this.command += this.baseCommand;
    this.command += this.updateType;
  }

  private async doUpdate(): Promise<void> {
    await cmd.run(this.command);
    console.log('package.json updated.\n');
  }

  private async askForUpdateType(): Promise<void> {
    const choice = await questionMaker([UPDATE_TYPES]);
    this.updateType = choice.type;
  }

}
