import { ChangeDetails, ChangeItems } from '@bohr/changelogger/processes/releases/creator/storer/deafult-contents.constant';
import { ChangeItemsMaker } from '@bohr/changelogger/renderers/mark-down/change-items-maker.class';

export class ChangeDetailsMaker {

  private rendered = '';

  constructor(
    private changeDetails: ChangeDetails
  ) { }

  public make(): string {
    this.addTitle();
    this.handleChangeItems('added');
    this.handleChangeItems('changed');
    this.handleChangeItems('deprecated');
    this.handleChangeItems('fixed');
    this.handleChangeItems('removed');
    this.handleChangeItems('security');
    return this.rendered;
  }

  private addTitle(): void {
    this.rendered += `## [${this.changeDetails.version}] - ${this.changeDetails.date}\n`;
  }

  private handleChangeItems(scope: ChangeItems['type']): void {
    const scopedItems = this.changeDetails.items.filter(changeItem => changeItem.type === scope);
    if (scopedItems.length)
      this.addRenderedChangeItems(scope, scopedItems);
  }

  private addRenderedChangeItems(scope: ChangeItems['type'], changeItems: Array<ChangeItems>): void {
    this.rendered += new ChangeItemsMaker(scope, changeItems).make();
  }
}
