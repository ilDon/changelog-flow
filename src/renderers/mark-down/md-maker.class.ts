import { DIRS } from 'changelog-flow/libs/paths/dirs.constant';
import { ChangeDetails, ChangeLogger } from 'changelog-flow/processes/releases/creator/storer/deafult-contents.constant';
import { ChangeDetailsMaker } from 'changelog-flow/renderers/mark-down/change-details-maker.class';
import { SEPARATOR } from 'changelog-flow/renderers/renderers.constant';
import { writeFileSync } from 'fs';
import { readJSONSync } from 'fs-extra';

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
    this.jsonData = readJSONSync(DIRS.pathToChangelogJson);
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
    writeFileSync(DIRS.pathToChangelogMD, this.rendered);
  }

}
