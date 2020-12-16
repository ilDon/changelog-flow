import { FlowBase } from 'changelog-flow/libs/flow//flow-base.class';
import { handleUncommittedChanges } from 'changelog-flow/processes/common-ops/handle-uncommitted-changes.function';
import { FEATURE_NAME } from 'changelog-flow/questions/git/feature-name.constant';
import { questionMaker } from 'changelog-flow/questions/question-maker.function';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs/yargs';

const argv = yargs(hideBin(process.argv)).argv;

export class NewFeatureStarter extends FlowBase {

  private featureName: string;

  public async start(): Promise<void> {
    if (!argv.sg)
      await handleUncommittedChanges();

    await this.getFeatureName();

    this.cleanFeatureName();

    this.init();

    await this.checkoutToBranch('develop');

    await this.createBranch(`feature/${this.featureName}`);

    await this.pushCurrent();
  }

  private async getFeatureName(): Promise<void> {
    const res = await questionMaker(FEATURE_NAME);
    this.featureName = res.name;
  }

  private cleanFeatureName(): void {
    this.featureName = this.removeSpecialChars(this.featureName);
    this.featureName = this.featureName.replace(/\s{1,}/g, '_');
    this.featureName = this.featureName.replace(/\.{1,}/g, '-');
    this.featureName = this.featureName.replace(/\/{1,}/g, '-');
    this.featureName = this.featureName.toLowerCase();
  }

  private removeSpecialChars(source: string): string {
    let r = source.toLowerCase();
    const NON_ASCIIS = {
      a: '[àáâãäå]',
      ae: 'æ',
      c: 'ç',
      e: '[èéêë]',
      i: '[ìíîï]',
      n: 'ñ',
      o: '[òóôõö]',
      oe: 'œ',
      u: '[ùúûűü]',
      y: '[ýÿ]'
    };
    for (const i in NON_ASCIIS)
      r = r.replace(new RegExp(NON_ASCIIS[i], 'g'), i);

    return r;
  }

}
