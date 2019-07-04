import { DIRS } from '@bohr/changelogger/libs/paths/dirs.constant';
import { ChangeDetails, ChangeLogger } from '@bohr/changelogger/processes/releases/creator/storer/deafult-contents.constant';
import { ChangeDetailsMaker } from '@bohr/changelogger/renderers/mark-down/change-details-maker.class';
import { SEPARATOR } from '@bohr/changelogger/renderers/renderers.constant';
import * as fs from 'fs-extra';

export class MdMaker {

  private jsonData: ChangeLogger;
  private rendered = '';

  public make(): void {
    this.loadJson();
    this.addTitle();
    this.addDescription();
    this.addSeparator();
    this.handleChanges();
    this.storeRendered();
    console.log('CHANGELOG.md updated.');
  }

  private loadJson(): void {
    this.jsonData = fs.readJSONSync(DIRS.pathToChangelogJson);
  }

  private addTitle(): void {
    this.rendered += `# ${this.jsonData.title}\n`;
  }

  private addDescription(): void {
    this.rendered += `${this.jsonData.description}\n`;
  }

  private addSeparator(): void {
    this.rendered += `\n${SEPARATOR}\n\n`;
  }

  private handleChanges(): void {
    this.jsonData.changes.forEach(changeDetails => this.addRenderedChange(changeDetails));
  }

  private addRenderedChange(changeDetails: ChangeDetails): void {
    this.rendered += `${new ChangeDetailsMaker(changeDetails).make()}`;
  }

  private storeRendered(): void {
    fs.writeFileSync(DIRS.pathToChangelogMD, this.rendered);
  }

}
