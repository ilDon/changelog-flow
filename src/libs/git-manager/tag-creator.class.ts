import * as cmd from 'node-cmd';
import { promisify } from 'util';

export class TagCreator {

  constructor(
    private tagName: string
  ) { }

  public async create(): Promise<void> {
    await this.doCreateTag();
    await this.pushTag();
  }

  private async doCreateTag(): Promise<void> {
    await promisify(cmd.get)(`git tag ${this.tagName}`);
  }

  private async pushTag(): Promise<void> {
    await promisify(cmd.get)(`git push origin ${this.tagName}`);
  }

}
